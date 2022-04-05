import { isValidAddress } from 'ethereumjs-util';
import {
  Account,
  AddTransactionResponse,
  CompressedCompiledContract,
  Provider,
  Signature,
} from 'starknet';
import { hexToDecimalString } from 'starknet/utils/number';

import { MetamaskClient } from '../client';
import { contractSalt, implementationAddress } from '../config';
import { Eip712Signer } from '../signer';
import { Chain, NetworkName } from '../types';
import { chainForNetwork, computeAddress } from '../utils';
import contract_deploy_tx from '../web3_account_proxy.json';

export class EthAccount extends Account {
  private readonly chain: Chain;
  private readonly ethAddress: string;

  constructor(
    provider: Provider,
    client: MetamaskClient,
    ethAddress: string,
    network: NetworkName
  ) {
    if (!isValidAddress(ethAddress)) {
      throw new Error('Provided address is not valid ethereum address.');
    }

    const chain = chainForNetwork(network);
    const starknetAddress = computeAddress(ethAddress, chain.chainId);
    const signer = new Eip712Signer(client, ethAddress, chain);

    super(provider, starknetAddress, signer);

    this.chain = chain;
    this.ethAddress = ethAddress;
  }

  signMessage(): Promise<Signature> {
    throw new Error('signMessage is not supported for EthAccount');
  }

  /* Account deployment methods */

  public isDeployed() {
    this.getCode(this.address);
  }

  public deployAccount = async (): Promise<AddTransactionResponse> => {
    return this.fetchEndpoint('add_transaction', undefined, {
      type: 'DEPLOY',
      contract_address_salt: contractSalt,
      constructor_calldata: [
        implementationAddress,
        hexToDecimalString(this.ethAddress),
        this.chain.chainId.toString(),
      ],
      contract_definition:
        contract_deploy_tx.contract_definition as CompressedCompiledContract,
    });
  };
}
