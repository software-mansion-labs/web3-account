import detectEthereumProvider = require("@metamask/detect-provider");
import {MetaMaskInpageProvider} from "@metamask/providers";
import {computeHashOnElements} from "starknet/utils/hash";
import {AddTransactionResponse, Provider, Transaction} from "starknet";
import {getSelectorFromName} from "starknet/utils/stark";
import {serialize} from "@ethersproject/transactions";
import {toBN} from "starknet/utils/number";
import {BN} from "ethereumjs-util";

interface ChainInfo {
    chainId: string,
    chainName: string,
    rpcUrls: string[],
}

const rpcUrl = "https://localhost:8000";

const chainId = process.env.CHAIN_ID;
const chain: ChainInfo = {
    chainId,
    chainName: "Starknet",
    rpcUrls: [rpcUrl]
}

export const typedData = {
    domain: {
        chainId: chainId,
        name: 'Starknet adapter',
        version: '1',
    },

    // Refers to the keys of the *types* object below.
    primaryType: 'Payload',
    types: {
        EIP712Domain: [
            {name: 'name', type: 'string'},
            {name: 'version', type: 'string'},
            {name: 'chainId', type: 'uint256'},
        ],
        Payload: [
            {name: 'nonce', type: 'uint256'},
            {name: 'address', type: 'uint256'},
            {name: 'selector', type: 'uint256'},
            {name: 'calldata', type: 'uint256[]'},
        ],
    },
}


export const makeData = (payload: Payload): Record<string, any> => ({
    ...typedData,
    message: {
        nonce: payload.nonce.toString(),
        address: payload.address.toString(),
        selector: payload.selector.toString(),
        calldata: payload.calldata.map(v => v.toString())
    },
});

interface Payload {
    nonce: BN;
    address: BN;
    selector: BN;
    calldata: BN[];
}

const UNRECOGNIZED_CHAIN = 4902;
const WRONG_ADDRESS = -32602

class MetamaskClient {
    constructor(protected provider: MetaMaskInpageProvider, protected chainConfig: ChainInfo = chain) {
    }

    public useStarknet = async () => {
        try {
            await this.switch();
        } catch (e) {
            if ("code" in e && e.code === UNRECOGNIZED_CHAIN) {
                await this.request("wallet_addEthereumChain", this.chainConfig);
                await this.switch();
                return
            }
            throw e;
        }
    }

    // Handling changes in network is problematic, useStarknet has minimal overhead
    protected withStarknet = <Args extends Array<any>, Result>(fn: (...args: Args) => Promise<Result>) => async (...args: Args): Promise<Result> => {
        await this.useStarknet();
        return fn(...args);
    };

    protected switch = () => this.request("wallet_switchEthereumChain", {chainId: this.chainConfig.chainId});

    request = (method: string, ...params: any[]) => this.provider.request({method, params})
}

type NetworkName = 'mainnet-alpha' | 'georli-alpha';

type ProviderOptions =
    | {
    network: NetworkName;
}
    | {
    baseUrl: string;
};

export class EthAccountProvider extends Provider {
    constructor(optionsOrProvider: ProviderOptions | Provider, private client: MetamaskClient, public readonly address: string) {
        super(optionsOrProvider)

    }

    public override async addTransaction(transaction: Transaction): Promise<AddTransactionResponse> {
        if (transaction.type === 'DEPLOY') {
            return super.addTransaction(transaction);
        }

        if (transaction.signature) {
            throw Error("EthAccountProvider.addTransaction doesn't support adding signatures.")
        }

        const nonce = transaction.nonce ? toBN(transaction.nonce) : this.fetchNonce();

        const payload = {
            address: toBN(transaction.contract_address),
            calldata: transaction.calldata.map(v => toBN(v)),
            selector: toBN(transaction.entry_point_selector),
            nonce
        }
        const transactionData = Buffer.concat([
            payload.address.toArrayLike(Buffer, "big", 32),
            payload.selector.toArrayLike(Buffer, "big", 32),
            ...payload.calldata.map(v => v.toArrayLike(Buffer, "big", 32)),
        ]);
        const signature = await this.signMessage(payload);
        const ethTx = serialize({
            data: transactionData,
            nonce: nonce.toNumber(),
        }, signature);
        const txHash = await this.client.request("eth_sendRawTransaction", ethTx) as string;
        return {
            code: "TRANSACTION_RECEIVED",
            transaction_hash: txHash,
        };
    }

    fetchNonce = async (): Promise<BN> => {
        const response = await this.callContract({
            contract_address: computeAddress(this.address),
            entry_point_selector: getSelectorFromName("get_nonce"),
            calldata: [],
        });
        console.log("RESPONSE", response)
        return toBN(response.result[0]);
    }

    signMessage = (payload: Payload): Promise<string> => this.client.request(
        "eth_signTypedData_v4", this.address, JSON.stringify(makeData(payload))
    ) as Promise<string>;
}

type AccountsChangeHandler = (accounts: EthAccountProvider[]) => void;
type HandlerRemover = () => void;

interface AdapterOptions {
    starknet: ProviderOptions;
    adapterChain?: ChainInfo;
}

export class StarknetAdapter extends MetamaskClient {
    constructor(private readonly options: AdapterOptions, metamask: MetaMaskInpageProvider) {
        super(metamask, options.adapterChain);
    }

    getAccounts = this.withStarknet(async (): Promise<EthAccountProvider[]> => {
        const accounts = await this.request("eth_requestAccounts") as string[];
        return accounts.map(a => new EthAccountProvider(this.options.starknet, this, a));
    });

    addAccountsChangeHandler = (handler: AccountsChangeHandler): HandlerRemover => {
        const eventHandler = (accounts: string[]) => {
            handler(accounts.map(a => new EthAccountProvider(this.options.starknet, this, a)));
        }
        this.provider.on("accountsChanged", eventHandler);
        return () => {
            this.provider.removeListener("accountsChanged", eventHandler);
        }
    }
}

export const getAdapter = async (options: AdapterOptions = {starknet: {baseUrl: process.env.NODE_URL}}): Promise<StarknetAdapter | undefined> => {
    const provider = await detectEthereumProvider() as MetaMaskInpageProvider | undefined;

    if (!provider) {
        alert("No metamask found!")
        return;
    }

    if (provider !== window.ethereum) {
        alert("Multiple wallets installed");
        return;
    }

    return new StarknetAdapter(options, provider);
}

const contractHash = "0x" + BigInt(process.env.ACCOUNT_CONTRACT_HASH).toString(16);
const contractSalt = "0x" + BigInt(process.env.ACCOUNT_ADDRESS_SALT).toString(16);

export const computeAddress = (ethAddress: string) => computeHashOnElements([
    "0x" + new Buffer("STARKNET_CONTRACT_ADDRESS", "ascii").toString("hex"),
    0,
    contractSalt,
    contractHash,
    computeHashOnElements([ethAddress])
])