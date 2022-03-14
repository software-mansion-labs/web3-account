import detectEthereumProvider = require("@metamask/detect-provider");
import { MetaMaskInpageProvider } from "@metamask/providers";
import { computeHashOnElements } from "starknet/utils/hash";
import {
  Abi,
  AddTransactionResponse,
  Contract,
  Provider,
  Transaction,
} from "starknet";
import { getSelectorFromName } from "starknet/utils/stark";
import { hexToDecimalString, toBN } from "starknet/utils/number";
import { BN, fromRpcSig } from "ethereumjs-util";
import contract_deploy_tx from "./web3_account.json";

const contractHash =
  "0x" + BigInt(process.env.ACCOUNT_CONTRACT_HASH).toString(16);
const contractSalt =
  "0x" + BigInt(process.env.ACCOUNT_ADDRESS_SALT).toString(16);

export const computeAddress = (ethAddress: string) =>
  computeHashOnElements([
    "0x" + new Buffer("STARKNET_CONTRACT_ADDRESS", "ascii").toString("hex"),
    0,
    contractSalt,
    contractHash,
    computeHashOnElements([ethAddress]),
  ]);

const RECOVERY_OFFSET = 27;

interface ChainInfo {
  chainId: string;
  chainName: string;
  rpcUrls: string[];
}

const rpcUrl = "https://127.0.0.1:8000";
const chainName = process.env.DOMAIN_NAME;

const chainId = process.env.CHAIN_ID;
const chain: ChainInfo = {
  chainId,
  chainName,
  rpcUrls: [rpcUrl],
};

export const typedData = {
  domain: {
    chainId: chainId,
    name: chainName,
    version: "1",
  },

  // Refers to the keys of the *types* object below.
  primaryType: "Payload",
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
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

const UNRECOGNIZED_CHAIN = 4902;
const WRONG_ADDRESS = -32602;

class MetamaskClient {
  constructor(
    protected provider: MetaMaskInpageProvider,
    protected chainConfig: ChainInfo = chain
  ) {}

  public useStarknet = async () => {
    try {
      await this.request("wallet_addEthereumChain", this.chainConfig);
      const r = await this.switch();
      // alert("SWITCHED " + r);
    } catch (e) {
      if ("code" in e && e.code === UNRECOGNIZED_CHAIN) {
        await this.request("wallet_addEthereumChain", this.chainConfig);
        await this.switch();
        return;
      }
      throw e;
    }
  };

  protected switch = () =>
    this.request("wallet_switchEthereumChain", {
      chainId: this.chainConfig.chainId,
    });

  request = (method: string, ...params: any[]) =>
    this.provider.request({ method, params });
}

type NetworkName = "mainnet-alpha" | "georli-alpha";

type ProviderOptions =
  | {
      network: NetworkName;
    }
  | {
      baseUrl: string;
    };

export class EthAccountProvider extends Provider {
  public readonly starknetAddress: string;

  constructor(
    optionsOrProvider: ProviderOptions | Provider,
    private client: MetamaskClient,
    public readonly address: string
  ) {
    super(optionsOrProvider);
    this.starknetAddress = computeAddress(this.address);
  }

  public override async addTransaction(
    transaction: Transaction
  ): Promise<AddTransactionResponse> {
    if (transaction.type === "DEPLOY") {
      return super.addTransaction(transaction);
    }

    if (transaction.signature) {
      return super.addTransaction(transaction);
    }

    const nonce = transaction.nonce
      ? toBN(transaction.nonce)
      : await this.fetchNonce();

    const payload = {
      address: toBN(transaction.contract_address),
      calldata: transaction.calldata.map((v) => toBN(v)),
      selector: toBN(transaction.entry_point_selector),
      nonce,
    };

    await this.client.useStarknet();
    const signature = await this.signMessage(payload);

    const { v, r, s } = fromRpcSig(signature);

    const rLow = new BN(r.slice(0, 16));
    const rHigh = new BN(r.slice(16, 32));

    const sLow = new BN(s.slice(0, 16));
    const sHigh = new BN(s.slice(16, 32));

    const signatureArray = [v - RECOVERY_OFFSET, rHigh, rLow, sHigh, sLow];

    const contract = new Contract(
      contract_deploy_tx.contract_definition.abi as Abi[],
      this.starknetAddress,
      this
    );

    const result = await contract.invoke(
      "execute",
      {
        to: transaction.contract_address,
        selector: transaction.entry_point_selector,
        calldata: transaction.calldata,
        nonce: nonce.toString("hex"),
      },
      signatureArray
    );

    return result;
  }

  public switchChain = this.client.useStarknet;

  public isAccountDeployed = async (): Promise<boolean> => {
    const code = await this.getCode(this.starknetAddress);
    return !!code.bytecode.length;
  };

  public deployAccount = async (): Promise<AddTransactionResponse> => {
    return this.addTransaction({
      ...contract_deploy_tx,
      type: "DEPLOY",
      contract_address_salt: contractSalt,
      constructor_calldata: [hexToDecimalString(this.address)],
    });
  };

  fetchNonce = async (): Promise<BN> => {
    const response = await this.callContract({
      contract_address: this.starknetAddress,
      entry_point_selector: getSelectorFromName("get_nonce"),
      calldata: [],
    });
    return toBN(response.result[0]);
  };

  signMessage = (payload: Payload): Promise<string> => {
    const data = makeData(payload);
    // const {chainId, ...domain} = data.domain;
    // data.domain = domain;
    console.log(JSON.stringify(data, null, 2));
    return this.client.request(
      "eth_signTypedData_v4",
      this.address,
      JSON.stringify(data)
    ) as Promise<string>;
  };
}

type AccountsChangeHandler = (accounts: EthAccountProvider[]) => void;
type HandlerRemover = () => void;

interface AdapterOptions {
  starknet: ProviderOptions;
  adapterChain?: ChainInfo;
}

export class StarknetAdapter extends MetamaskClient {
  constructor(
    private readonly options: AdapterOptions,
    metamask: MetaMaskInpageProvider
  ) {
    super(metamask, options.adapterChain);
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
