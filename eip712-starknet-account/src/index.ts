import detectEthereumProvider from '@metamask/detect-provider';
import { MetaMaskInpageProvider } from '@metamask/providers';
import { BN } from 'ethereumjs-util';
import {
  Abi,
  AddTransactionResponse,
  CompressedCompiledContract,
  Contract,
  Invocation,
  InvocationsSignerDetails,
  Provider,
  Signature,
  SignerInterface,
} from 'starknet';
import { hexToDecimalString, toBN } from 'starknet/utils/number';

import { contractSalt } from './config';
import { getTypedData } from './typedData';
import { AdapterOptions, Chain, NetworkName, ProviderOptions } from './types';
import { chainForNetwork, computeAddress, parseSignature } from './utils';
import contract_deploy_tx from './web3_account.json';

class MetamaskClient {
  constructor(protected provider: MetaMaskInpageProvider) {}

  request = (method: string, ...params: any[]) =>
    this.provider.request({ method, params });
}

export class EthSigner implements SignerInterface {
  constructor(
    private client: MetamaskClient,
    public readonly address: string,
    private chain: Chain
  ) {}

  public async getPubKey(): Promise<string> {
    return (await this.client.request('eth_getEncryptionPublicKey', [
      this.address,
    ])) as string;
  }

  public async signMessage(): Promise<Signature> {
    throw new Error(
      'signMessage is not supported in ETHSigner, use default Signer.'
    );
  }

  public async signTransaction(
    transactions: Invocation[],
    transactionsDetail: InvocationsSignerDetails
  ): Promise<Signature> {
    if (transactions.length === 0) {
      throw new Error('No transaction to sign');
    }

    const message = {
      nonce: transactionsDetail.nonce,
      maxFee: transactionsDetail.maxFee,
      version: 0,
      calls: transactions.map((transaction) => ({
        address: transaction.contractAddress,
        selector: transaction.entrypoint,
        calldata: transaction.calldata,
      })),
    };

    const data = {
      ...getTypedData(this.chain.chainName),
      message,
    };

    const signature = await this.sign(data);

    return parseSignature(signature);
  }

  sign(data: Record<string, any>): Promise<string> {
    return this.client.request(
      'eth_signTypedData_v4',
      this.address,
      JSON.stringify(data)
    ) as Promise<string>;
  }
}

export class EthAccountProvider extends Provider {
  public readonly starknetAddress: string;
  private signer: EthSigner;
  private readonly chain: Chain;

  constructor(
    optionsOrProvider: Provider | ProviderOptions,
    client: MetamaskClient,
    public readonly address: string,
    network: NetworkName
  ) {
    super(optionsOrProvider);

    this.chain = chainForNetwork(network);
    this.starknetAddress = computeAddress(this.address, this.chain.chainId);
    this.signer = new EthSigner(client, address, this.chain);
  }

  public override async invokeFunction(
    invocation: Invocation,
    _abi?: Abi
  ): Promise<AddTransactionResponse> {
    if (invocation.signature) {
      return super.invokeFunction(invocation, _abi);
    }

    const nonce = await this.fetchNonce();

    const signature = await this.signer.signTransaction([invocation], {
      nonce: nonce,
      maxFee: 0,
      walletAddress: '',
    });

    const contract = new Contract(
      contract_deploy_tx.contract_definition.abi as Abi,
      this.starknetAddress,
      this
    );

    const callArray = [
      [
        invocation.contractAddress,
        invocation.entrypoint,
        0,
        invocation.calldata?.length ?? 0,
      ],
    ];

    return contract.invoke('__execute__', [
      callArray,
      invocation.calldata,
      nonce,
      signature,
    ]);
  }

  public isAccountDeployed = async (): Promise<boolean> => {
    const code = await this.getCode(this.starknetAddress);
    return !!code.bytecode.length;
  };

  public deployAccount = async (): Promise<AddTransactionResponse> => {
    return this.fetchEndpoint('add_transaction', undefined, {
      type: 'DEPLOY',
      contract_address_salt: contractSalt,
      constructor_calldata: [
        hexToDecimalString(this.address),
        this.chain.chainId.toString(),
      ],
      contract_definition:
        contract_deploy_tx.contract_definition as CompressedCompiledContract,
    });
  };

  public computeAddress = (ethAddress: string) => {
    return computeAddress(ethAddress, this.chain.chainId);
  };

  fetchNonce = async (): Promise<BN> => {
    const response = await this.callContract({
      contractAddress: this.starknetAddress,
      entrypoint: 'get_nonce',
      calldata: [],
    });
    return toBN(response.result[0]);
  };
}

type AccountsChangeHandler = (accounts: EthAccountProvider[]) => void;
type HandlerRemover = () => void;

export class StarknetAdapter extends MetamaskClient {
  constructor(
    private readonly options: AdapterOptions,
    metamask: MetaMaskInpageProvider
  ) {
    super(metamask);
  }

  requestAccounts = async (): Promise<EthAccountProvider[]> => {
    const accounts = (await this.request('eth_requestAccounts')) as string[];
    return this.mapAccounts(accounts);
  };

  getAccounts = async (): Promise<EthAccountProvider[] | undefined> => {
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
        new EthAccountProvider(
          this.options.starknet,
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

export { AdapterOptions, Chain, ProviderOptions };

export { getTypedData, parseSignature };
