import { isValidAddress } from 'ethereumjs-util';
import {
  Account,
  AddTransactionResponse,
  Call,
  CompressedCompiledContract,
  ProviderInterface,
} from 'starknet';
import { BigNumberish } from 'starknet/utils/number';

import { MetamaskClient } from '../client';
import { contractSalt } from '../config';
import { Eip712Signer } from '../signer';
import { computeStarknetAddress, constructorArguments } from '../utils';
import contract_deploy_tx from '../web3_account_proxy.json';

export class EthAccount extends Account {
  public readonly ethAddress: string;

  constructor(
    provider: ProviderInterface,
    client: MetamaskClient,
    ethAddress: string
  ) {
    if (!isValidAddress(ethAddress)) {
      throw new Error('Provided address is not a valid ethereum address.');
    }

    const starknetAddress = computeStarknetAddress(
      ethAddress,
      provider.chainId
    );

    const signer = new Eip712Signer(client, ethAddress);

    super(provider, starknetAddress, signer);

    this.ethAddress = ethAddress;
  }

  /* Account deployment methods */

  public async isDeployed(): Promise<boolean> {
    const code = await this.getCode(this.address);
    return !!code.bytecode.length;
  }

  public async deployAccount(): Promise<AddTransactionResponse> {
    return await this.fetchEndpoint('add_transaction', undefined, {
      type: 'DEPLOY',
      contract_address_salt: contractSalt,
      constructor_calldata: constructorArguments(this.ethAddress, this.chainId),
      contract_definition:
        contract_deploy_tx.contract_definition as CompressedCompiledContract,
    });
  }

  public async upgradeAccount(
    implementation: BigNumberish
  ): Promise<AddTransactionResponse> {
    const call: Call = {
      contractAddress: this.address,
      entrypoint: 'upgrade',
      calldata: [implementation],
    };

    return this.execute(call);
  }
}
