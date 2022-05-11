import { StarknetChainId } from 'starknet/constants';

import { EthAccount } from './account';

export type NetworkName = 'mainnet-alpha' | 'goerli-alpha';

export type ProviderOptions =
  | {
      network: NetworkName;
    }
  | {
      baseUrl: string;
    };

export type AccountsChangeHandler = (accounts: EthAccount[]) => void;

export type HandlerRemover = () => void;

export { StarknetChainId };
