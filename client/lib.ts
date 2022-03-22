import detectEthereumProvider = require("@metamask/detect-provider");
import { MetaMaskInpageProvider } from "@metamask/providers";
import { computeHashOnElements } from "starknet/utils/hash";
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
import { hexToDecimalString, toBN } from "starknet/utils/number";
import { BN, fromRpcSig } from "ethereumjs-util";
import contract_deploy_tx from "./web3_account.json";

const contractHash =
  "0x" + BigInt(process.env.ACCOUNT_CONTRACT_HASH).toString(16);
const contractSalt =
  "0x" + BigInt(process.env.ACCOUNT_ADDRESS_SALT).toString(16);

const RECOVERY_OFFSET = 27;

const chainName = process.env.DOMAIN_NAME;

const domainHash =
  chainName === "Starknet Alpha Mainnet"
    ? {
        low: "116859380687502041814386376410414224434",
        high: "230894979361313997426860759335020630660",
      }
    : {
        low: "280762518416471191671265710498463056466",
        high: "289143051483791655410673577656337791506",
      };

export const computeAddress = (ethAddress: string) =>
  computeHashOnElements([
    "0x" + new Buffer("STARKNET_CONTRACT_ADDRESS", "ascii").toString("hex"),
    0,
    contractSalt,
    contractHash,
    computeHashOnElements([ethAddress, domainHash.low, domainHash.high]),
  ]);

export const typedData = {
  domain: {
    name: chainName,
    version: "1",
  },

  // Refers to the keys of the *types* object below.
  primaryType: "Payload",
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
    ],
    Payload: [
      { name: "nonce", type: "uint256" },
      { name: "address", type: "uint256" },
      { name: "selector", type: "uint256" },
      { name: "calldata", type: "uint256[]" },
    ],
  },
};

export const makeData = (payload: Payload): Record<string, any> => ({
  ...typedData,
  message: {
    nonce: payload.nonce.toString(),
    address: payload.address.toString(),
    selector: payload.selector.toString(),
    calldata: payload.calldata.map((v) => v.toString()),
  },
});

interface Payload {
  nonce: BN;
  address: BN;
  selector: BN;
  calldata: BN[];
}

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

    if (transactions.length > 1) {
      throw new Error("Signing multiple transactions is not supported");
    }

    const transaction = transactions[0];

    const message = {
      address: transaction.contractAddress,
      calldata: transaction.calldata,
      selector: transaction.entrypoint,
      nonce: transactionsDetail.nonce,
    };

    const data = {
      ...typedData,
      message,
    };

    const signature = await this.sign(data);

    return this.parseSignature(signature);
  }

  sign(data: Record<string, any>): Promise<string> {
    return this.client.request(
      "eth_signTypedData_v4",
      this.address,
      JSON.stringify(data)
    ) as Promise<string>;
  }

  parseSignature(signature: string): Signature {
    const { v, r, s } = fromRpcSig(signature);

    const rHigh = "0x" + r.slice(0, 16).toString("hex");
    const rLow = "0x" + r.slice(16, 32).toString("hex");

    const sHigh = "0x" + s.slice(0, 16).toString("hex");
    const sLow = "0x" + s.slice(16, 32).toString("hex");

    const vStr = "0x" + (v - RECOVERY_OFFSET).toString(16);

    return [vStr, rLow, rHigh, sLow, sHigh];
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

    const result = await contract.invoke("execute", [
      invocation.contractAddress,
      invocation.entrypoint,
      invocation.calldata,
      nonce,
      signature,
    ]);

    return result;
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
        domainHash.low,
        domainHash.high,
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
