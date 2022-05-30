import { MetaMaskInpageProvider } from '@metamask/providers';

export class MetamaskClient {
  constructor(protected provider: MetaMaskInpageProvider) {}

  request = (method: string, ...params: unknown[]) =>
    this.provider.request({ method, params });
}
