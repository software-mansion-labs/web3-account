import { StarknetChainId } from 'starknet/src/constants';

import { EthAccount } from './account-provider';

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
