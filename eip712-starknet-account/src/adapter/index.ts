import detectEthereumProvider from '@metamask/detect-provider';
import { MetaMaskInpageProvider } from '@metamask/providers';
import { Provider, ProviderInterface } from 'starknet/src';

import { EthAccount } from '../account';
import { MetamaskClient } from '../client';
import {
  AccountsChangeHandler,
  HandlerRemover,
  ProviderOptions,
} from '../types';

export class StarknetAdapter extends MetamaskClient {
  constructor(
    private readonly optionsOrProvider: ProviderInterface | ProviderOptions,
    metamask: MetaMaskInpageProvider
  ) {
    super(metamask);
  }

  requestAccounts = async (): Promise<EthAccount[]> => {
    const accounts = (await this.request('eth_requestAccounts')) as string[];
    return this.mapAccounts(accounts);
  };

  getAccounts = async (): Promise<EthAccount[] | undefined> => {
    const accounts = (await this.request('eth_accounts')) as string[];
    return this.mapAccounts(accounts);
  };

  addAccountsChangeHandler = (
    handler: AccountsChangeHandler
  ): HandlerRemover => {
    const eventHandler = (...args: unknown[]) => {
      if (args.length === 0) return;

      const accounts = args[0] as string[];

      handler(this.mapAccounts(accounts));
    };
    this.provider.on('accountsChanged', eventHandler);
    return () => {
      this.provider.removeListener('accountsChanged', eventHandler);
    };
  };

  private mapAccounts = (accounts: string[]) => {
    return accounts.map((a) => {
      const provider: ProviderInterface =
        this.optionsOrProvider instanceof ProviderInterface
          ? this.optionsOrProvider
          : new Provider(this.optionsOrProvider);

      return new EthAccount(provider, this, a);
    });
  };
}

export const getAdapter = async (
  optionsOrProvider: ProviderOptions | ProviderInterface
): Promise<StarknetAdapter | undefined> => {
  const ethereumProvider = (await detectEthereumProvider()) as
    | MetaMaskInpageProvider
    | undefined;

  if (!ethereumProvider) {
    alert('No metamask found!');
    return;
  }

  if (ethereumProvider !== window.ethereum) {
    alert('Multiple wallets installed');
    return;
  }

  return new StarknetAdapter(optionsOrProvider, ethereumProvider);
};
