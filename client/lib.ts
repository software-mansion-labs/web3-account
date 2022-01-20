import detectEthereumProvider = require("@metamask/detect-provider");
import {MetaMaskInpageProvider} from "@metamask/providers";
import {computeHashOnElements} from "starknet/utils/hash";
import {Provider} from "starknet";
import {getSelectorFromName} from "starknet/utils/stark";

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

class MetamaskClient {
    constructor(protected provider: MetaMaskInpageProvider) {
    }

    request = (method: string, ...params: any[]) => this.provider.request({method, params})
}

const UNRECOGNIZED_CHAIN = 4902;

export class Lib extends MetamaskClient {
    private accounts?: string[];

    useStarknet = async () => {
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

    connectAccounts = async () => {
        await this.request("eth_requestAccounts")
        const accounts = await this.request("eth_accounts") as string[];
        this.accounts = [...accounts];
        return accounts
    }

    private switch = () => this.request("wallet_switchEthereumChain", {chainId});

    sign = async (payload: Payload) => {
        this.ensureAccountExists();
        console.log("DATA", makeData(payload))
        return await this.request("eth_signTypedData_v4", this.accounts[0], JSON.stringify(makeData(payload)));
    }

    sendTransaction = (transaction: string) => this.request("eth_sendRawTransaction", transaction)

    fetchNonce = async (): Promise<bigint> => {
        const account = this.ensureAccountExists();
        const provider = new Provider({baseUrl: process.env.NODE_URL});
        const response = await provider.callContract({
            contract_address: computeAddress(account),
            entry_point_selector: getSelectorFromName("get_nonce"),
            calldata: [],
        });
        return BigInt(response.result[0]);
    }

    ensureAccountExists = (): string => {
        if (!this.accounts || !this.accounts[0]) {
            throw Error("No account available")
        }
        return this.accounts[0];
    }
}

export const getLib = async (): Promise<Lib | undefined> => {
    const provider = await detectEthereumProvider() as MetaMaskInpageProvider | undefined;

    if (!provider) {
        alert("No metamask found!")
        return;
    }

    if (provider !== window.ethereum) {
        alert("Multiple wallets installed");
        return;
    }

    return new Lib(provider);
}

const contractHash = "0x" + BigInt(process.env.ACCOUNT_CONTRACT_HASH).toString(16);
const contractSalt = "0x" + BigInt(process.env.ACCOUNT_ADDRESS_SALT).toString(16);

export const computeAddress = (ethAddress: string) => computeHashOnElements([
    "0x" + new Buffer("STARKNET_CONTRACT_ADDRESS", "ascii").toString("hex"),
    0,
    contractSalt,
    contractHash, // Contract hash
    computeHashOnElements([ethAddress])
])