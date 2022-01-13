import detectEthereumProvider = require("@metamask/detect-provider");
import { MetaMaskInpageProvider } from "@metamask/providers";


const chain = {
    chainId: "0xb",
    chainName: "Starknet",
    rpcUrls: ["https://localhost:8000"]
}

export class Lib {
    constructor(private provider: MetaMaskInpageProvider) {}

    suggestChain = () => this.provider.request({method: "wallet_addEthereumChain", params: [chain]})
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