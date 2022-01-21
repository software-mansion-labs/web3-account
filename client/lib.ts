import detectEthereumProvider = require("@metamask/detect-provider");
import {MetaMaskInpageProvider} from "@metamask/providers";
import {computeHashOnElements} from "starknet/utils/hash";
import {Provider} from "starknet";
import {getSelectorFromName} from "starknet/utils/stark";
import {serialize} from "@ethersproject/transactions";
import {toBufferBE} from "bigint-buffer";

const chain = {
    chainId: process.env.CHAIN_ID,
    chainName: "Starknet",
    rpcUrls: ["https://localhost:8000"]
}

const chainId = process.env.CHAIN_ID;

console.log({chainId})

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
    nonce: bigint;
    address: bigint;
    selector: bigint;
    calldata: bigint[];
}

const UNRECOGNIZED_CHAIN = 4902;
const WRONG_ADDRESS = -32602

class MetamaskClient {
    constructor(protected provider: MetaMaskInpageProvider) {
    }

    public useStarknet = async () => {
        try {
            await this.switch();
        } catch (e) {
            if ("code" in e && e.code === UNRECOGNIZED_CHAIN) {
                await this.request("wallet_addEthereumChain", chain);
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

    protected switch = () => this.request("wallet_switchEthereumChain", {chainId});

    request = (method: string, ...params: any[]) => this.provider.request({method, params})
}

export class AccountClient extends MetamaskClient {
    constructor(provider: MetaMaskInpageProvider, public readonly address: string) {
        super(provider);
    }

    invoke = async (payload: Omit<Payload, "nonce"> & { nonce?: bigint }) => {
        const transactionData = Buffer.concat([
            toBufferBE(payload.address, 32),
            toBufferBE(payload.selector, 32),
            ...payload.calldata.map(v => toBufferBE(v, 32)),
        ]);
        const nonce = payload.nonce || await this.fetchNonce();
        const signature = await this.sign({...payload, nonce});
        const transaction = serialize({
            data: transactionData,
            nonce: Number(nonce)
        }, signature as any);
        return await this.request("eth_sendRawTransaction", transaction)
    }

    sign = this.withStarknet(async (payload: Payload) => {
        return await this.request("eth_signTypedData_v4", this.address, JSON.stringify(makeData(payload)));
    });

    fetchNonce = async (): Promise<bigint> => {
        const provider = new Provider({baseUrl: process.env.NODE_URL});
        const response = await provider.callContract({
            contract_address: computeAddress(this.address),
            entry_point_selector: getSelectorFromName("get_nonce"),
            calldata: [],
        });
        return BigInt(response.result[0]);
    }
}

type AccountsChangeHandler = (accounts: AccountClient[]) => void;
type HandlerRemover = () => void;

export class StarknetAdapter extends MetamaskClient {
    getAccounts = this.withStarknet(async (): Promise<AccountClient[]> => {
        const accounts = await this.request("eth_requestAccounts") as string[];
        return accounts.map(a => new AccountClient(this.provider, a));
    });

    addAccountsChangeHandler = (handler: AccountsChangeHandler): HandlerRemover => {
        const eventHandler = (accounts: string[]) => {
            handler(accounts.map(a => new AccountClient(this.provider, a)));
        }
        this.provider.on("accountsChanged", eventHandler);
        return () => {
            this.provider.removeListener("accountsChanged", eventHandler);
        }
    }
}

export const getAdapter = async (): Promise<StarknetAdapter | undefined> => {
    const provider = await detectEthereumProvider() as MetaMaskInpageProvider | undefined;

    if (!provider) {
        alert("No metamask found!")
        return;
    }

    if (provider !== window.ethereum) {
        alert("Multiple wallets installed");
        return;
    }

    return new StarknetAdapter(provider);
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