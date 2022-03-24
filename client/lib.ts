import detectEthereumProvider = require("@metamask/detect-provider");
import {MetaMaskInpageProvider} from "@metamask/providers";
import {computeHashOnElements} from "starknet/utils/hash";
import {
  Abi,
  AddTransactionResponse,
  CompressedCompiledContract,
  Contract,
  Invocation,
  InvocationsSignerDetails,
  Provider,
  Signature,
  SignerInterface,
} from "starknet";
import {hexToDecimalString, toBN} from "starknet/utils/number";
import {BN, fromRpcSig} from "ethereumjs-util";
import contract_deploy_tx from "./web3_account.json";
import {typedData} from "./typedData";
import {parseSignature} from "./utils";

const contractHash =
  "0x" + BigInt(process.env.ACCOUNT_CONTRACT_HASH).toString(16);
const contractSalt =
  "0x" + BigInt(process.env.ACCOUNT_ADDRESS_SALT).toString(16);

const chainId = process.env.CHAIN_ID ?? 5;

export const computeAddress = (ethAddress: string) =>
  computeHashOnElements([
    "0x" + new Buffer("STARKNET_CONTRACT_ADDRESS", "ascii").toString("hex"),
    0,
    contractSalt,
    contractHash,
    computeHashOnElements([ethAddress, chainId]),
  ]);

class MetamaskClient {
  constructor(protected provider: MetaMaskInpageProvider) {}

  request = (method: string, ...params: any[]) =>
    this.provider.request({ method, params });
}

type NetworkName = "mainnet-alpha" | "goerli-alpha";

type ProviderOptions =
  | {
      network: NetworkName;
    }
  | {
      baseUrl: string;
    };

export class EthSigner implements SignerInterface {
  public readonly starknetAddress: string;

  constructor(private client: MetamaskClient, public readonly address: string) {
    this.starknetAddress = computeAddress(this.address);
  }

  public async getPubKey(): Promise<string> {
    return (await this.client.request("eth_getEncryptionPublicKey", [
      this.address,
    ])) as string;
  }

  public async signMessage(
    typedData: {
      types: { StarkNetDomain: { type: string; name: string }[] } & Record<
        string,
        { type: string; name: string }[]
      >;
      primaryType: string;
      domain: { name?: string; version?: string; chainId?: string | number };
      message: Record<string, unknown>;
    },
    accountAddress: string
  ): Promise<Signature> {
    throw new Error(
      "signMessage is not supported in ETHSigner, use default Signer."
    );
  }

  public async signTransaction(
    transactions: Invocation[],
    transactionsDetail: InvocationsSignerDetails,
    abis?: Abi[]
  ): Promise<Signature> {
    if (transactions.length === 0) {
      throw new Error("No transaction to sign");
    }

    const message = {
      nonce: transactionsDetail.nonce,
      maxFee: transactionsDetail.maxFee,
      version: 0,
      calls: transactions.map((transaction) => ({
        address: transaction.contractAddress,
        selector: transaction.entrypoint,
        calldata: transaction.calldata,
      })),
    };

    const data = {
      ...typedData,
      message,
    };

    const signature = await this.sign(data);

    return parseSignature(signature);
  }

  sign(data: Record<string, any>): Promise<string> {
    return this.client.request(
      "eth_signTypedData_v4",
      this.address,
      JSON.stringify(data)
    ) as Promise<string>;
  }
}

export class EthAccountProvider extends Provider {
  public readonly starknetAddress: string;
  private signer: EthSigner;

  constructor(
    optionsOrProvider: Provider | ProviderOptions,
    private client: MetamaskClient,
    public readonly address: string
  ) {
    super(optionsOrProvider);
    this.starknetAddress = computeAddress(this.address);
    this.signer = new EthSigner(client, address);
  }

  public override async invokeFunction(
    invocation: Invocation,
    _abi?: Abi
  ): Promise<AddTransactionResponse> {
    if (invocation.signature) {
      return super.invokeFunction(invocation, _abi);
    }

    const nonce = await this.fetchNonce();

    const signature = await this.signer.signTransaction([invocation], {
      nonce: nonce,
      maxFee: 0,
      walletAddress: "",
    });

    const contract = new Contract(
      contract_deploy_tx.contract_definition.abi as Abi,
      this.starknetAddress,
      this
    );

    const callArray = [
      [
        invocation.contractAddress,
        invocation.entrypoint,
        0,
        invocation.calldata?.length ?? 0,
      ],
    ];

    return contract.invoke("__execute__", [
      callArray,
      invocation.calldata,
      nonce,
      signature,
    ]);
  }

  public isAccountDeployed = async (): Promise<boolean> => {
    const code = await this.getCode(this.starknetAddress);
    return !!code.bytecode.length;
  };

  public deployAccount = async (): Promise<AddTransactionResponse> => {
    return this.fetchEndpoint("add_transaction", undefined, {
      type: "DEPLOY",
      contract_address_salt: contractSalt,
      constructor_calldata: [
        hexToDecimalString(this.address),
        chainId.toString(),
      ],
      contract_definition:
        contract_deploy_tx.contract_definition as CompressedCompiledContract,
    });
  };

  fetchNonce = async (): Promise<BN> => {
    const response = await this.callContract({
      contractAddress: this.starknetAddress,
      entrypoint: "get_nonce",
      calldata: [],
    });
    return toBN(response.result[0]);
  };
}

type AccountsChangeHandler = (accounts: EthAccountProvider[]) => void;
type HandlerRemover = () => void;

interface AdapterOptions {
  starknet: ProviderOptions;
}

export class StarknetAdapter extends MetamaskClient {
  constructor(
    private readonly options: AdapterOptions,
    metamask: MetaMaskInpageProvider
  ) {
    super(metamask);
  }

  requestAccounts = async (): Promise<EthAccountProvider[]> => {
    const accounts = (await this.request("eth_requestAccounts")) as string[];
    return accounts.map(
      (a) => new EthAccountProvider(this.options.starknet, this, a)
    );
  };

  getAccounts = async (): Promise<EthAccountProvider[] | undefined> => {
    const accounts = (await this.request("eth_accounts")) as string[];
    return accounts.map(
      (a) => new EthAccountProvider(this.options.starknet, this, a)
    );
  };

  addAccountsChangeHandler = (
    handler: AccountsChangeHandler
  ): HandlerRemover => {
    const eventHandler = (accounts: string[]) => {
      handler(
        accounts.map(
          (a) => new EthAccountProvider(this.options.starknet, this, a)
        )
      );
    };
    this.provider.on("accountsChanged", eventHandler);
    return () => {
      this.provider.removeListener("accountsChanged", eventHandler);
    };
  };
}

export const getAdapter = async (
  options: AdapterOptions = { starknet: { baseUrl: process.env.NODE_URL } }
): Promise<StarknetAdapter | undefined> => {
  const provider = (await detectEthereumProvider()) as
    | MetaMaskInpageProvider
    | undefined;

  if (!provider) {
    alert("No metamask found!");
    return;
  }

  if (provider !== window.ethereum) {
    alert("Multiple wallets installed");
    return;
  }

  return new StarknetAdapter(options, provider);
};
