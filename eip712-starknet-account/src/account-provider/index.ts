import { BN } from 'ethereumjs-util';
import {
  Abi,
  AddTransactionResponse,
  CompressedCompiledContract,
  Contract,
  Invocation,
  Provider,
} from 'starknet';
import { hexToDecimalString, toBN } from 'starknet/utils/number';

import { MetamaskClient } from '../client';
import { contractSalt } from '../config';
import { Eip712Signer } from '../signer';
import { Chain, NetworkName, ProviderOptions } from '../types';
import { chainForNetwork, computeAddress } from '../utils';
import contract_deploy_tx from '../web3_account.json';

export class EthAccountProvider extends Provider {
  public readonly starknetAddress: string;
  private signer: Eip712Signer;
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
    this.signer = new Eip712Signer(client, address, this.chain);
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
