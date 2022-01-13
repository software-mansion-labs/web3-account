import detectEthereumProvider = require("@metamask/detect-provider");
import {MetaMaskInpageProvider} from "@metamask/providers";

const chain = {
    chainId: "0xb",
    chainName: "Starknet",
    rpcUrls: ["https://localhost:8000"]
}

const chainId = "0xb";

const makeData = (payload: Payload): string => JSON.stringify({
    domain: {
        chainId: chainId,
        name: 'Starknet adapter',
        version: '1',
    },

    // Defining the message signing data content.
    message: {
        address: payload.address.toString(),
        selector: payload.selector.toString(),
        calldata: payload.calldata.map(v => v.toString())
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
            {name: 'address', type: 'uint256'},
            {name: 'selector', type: 'uint256'},
            {name: 'calldata', type: 'uint256[]'},
        ],
    },
});

interface Payload {
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
    private accounts?: string[] = undefined;

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
        if (!this.accounts || !this.accounts[0]) {
            throw new Error("No account available");
        }
        console.log("DATA", makeData(payload))
        return await this.request("eth_signTypedData_v4", this.accounts[0], makeData(payload));
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