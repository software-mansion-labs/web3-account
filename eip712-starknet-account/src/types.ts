import { EthAccountProvider } from './account-provider';

export type NetworkName = 'mainnet-alpha' | 'goerli-alpha';

export type Chain = {
  chainId: number;
  chainName: string;
};

export type ProviderOptions =
  | {
      network: NetworkName;
    }
  | {
      baseUrl: string;
    };

export type AdapterOptions = {
  starknet: ProviderOptions;
  network: NetworkName;
};

export type AccountsChangeHandler = (accounts: EthAccountProvider[]) => void;

export type HandlerRemover = () => void;
