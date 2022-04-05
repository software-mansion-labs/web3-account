import detectEthereumProvider from '@metamask/detect-provider';
import { MetaMaskInpageProvider } from '@metamask/providers';
import { Provider } from 'starknet';

import { EthAccount } from '../account-provider';
import { MetamaskClient } from '../client';
import {
  AccountsChangeHandler,
  AdapterOptions,
  HandlerRemover,
} from '../types';

export class StarknetAdapter extends MetamaskClient {
  constructor(
    private readonly options: AdapterOptions,
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
    return accounts.map(
      (a) =>
        new EthAccount(
          new Provider(this.options.starknet),
          this,
          a,
          this.options.network
        )
    );
  };
}

export const getAdapter = async (
  options: AdapterOptions
): Promise<StarknetAdapter | undefined> => {
  const provider = (await detectEthereumProvider()) as
    | MetaMaskInpageProvider
    | undefined;

  if (!provider) {
    alert('No metamask found!');
    return;
  }

  if (provider !== window.ethereum) {
    alert('Multiple wallets installed');
    return;
  }

  return new StarknetAdapter(options, provider);
};
