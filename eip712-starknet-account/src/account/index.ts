import {isValidAddress} from 'ethereumjs-util';
import {
  Abi,
  Account,
  AddTransactionResponse,
  Call,
  CompressedCompiledContract,
  InvocationsDetails,
  InvocationsSignerDetails,
  ProviderInterface,
  Signature,
} from 'starknet';
import { estimatedFeeToMaxFee } from 'starknet/dist/utils/stark';
import { getSelectorFromName, transactionVersion } from 'starknet/utils/hash';
import {
  BigNumberish,
  bigNumberishArrayToDecimalStringArray,
  hexToDecimalString,
  toBN,
  toHex,
} from 'starknet/utils/number';
import { fromCallsToExecuteCalldataWithNonce } from 'starknet/utils/transaction';

import { MetamaskClient } from '../client';
import { contractSalt, implementationAddress } from '../config';
import { EthSigner } from '../signer';
import { computeStarknetAddress } from '../utils';
import contract_deploy_tx from '../web3_account_proxy.json';

export class EthAccount extends Account {
  public readonly ethAddress: string;

  constructor(
    provider: ProviderInterface,
    client: MetamaskClient,
    ethAddress: string
  ) {
    if (!isValidAddress(ethAddress)) {
      throw new Error('Provided address is not valid ethereum address.');
    }

    const starknetAddress = computeStarknetAddress(ethAddress);

    const signer = new EthSigner(client, ethAddress);

    super(provider, starknetAddress, signer);

    this.ethAddress = ethAddress;
  }

  signMessage(): Promise<Signature> {
    throw new Error('signMessage is not supported for EthAccount');
  }

  public async execute(
    calls: Call | Call[],
    abis: Abi[] | undefined = undefined,
    transactionsDetail: InvocationsDetails = {}
  ): Promise<AddTransactionResponse> {
    const transactions = Array.isArray(calls) ? calls : [calls];
    const nonce = toBN(transactionsDetail.nonce ?? (await this.getNonce()));

    let maxFee: BigNumberish;
    if (transactionsDetail.maxFee == undefined) {
      const estimatedFee = (await this.estimateFee(transactions, {nonce}))
          .amount;

      maxFee = estimatedFeeToMaxFee(estimatedFee).toString();
    } else {
      maxFee = transactionsDetail.maxFee;
    }

    const signerDetails: InvocationsSignerDetails = {
      walletAddress: this.address,
      nonce,
      maxFee,
      version: toBN(transactionVersion),
      chainId: this.chainId,
    };

    const signature = await this.signer.signTransaction(
      transactions,
      signerDetails,
      abis
    );

    const calldata = fromCallsToExecuteCalldataWithNonce(transactions, nonce);
    return this.fetchEndpoint('add_transaction', undefined, {
      type: 'INVOKE_FUNCTION',
      contract_address: this.address,
      entry_point_selector: getSelectorFromName('__execute__'),
      calldata,
      signature: bigNumberishArrayToDecimalStringArray(signature),
      max_fee: toHex(toBN(maxFee)),
    });
  }

  /* Account deployment methods */

  public async isDeployed(): Promise<boolean> {
    const code = await this.getCode(this.address);
    return !!code.bytecode.length;
  }

  public async deployAccount(): Promise<AddTransactionResponse> {
    return await this.fetchEndpoint(
        'add_transaction',
        undefined,
        {
          type: 'DEPLOY',
          contract_address_salt: contractSalt,
          constructor_calldata: [
            hexToDecimalString(implementationAddress),
            hexToDecimalString(getSelectorFromName('initializer')),
            '1',
            hexToDecimalString(this.ethAddress),
          ],
          contract_definition:
              contract_deploy_tx.contract_definition as CompressedCompiledContract,
        }
    );
  }

  public async upgradeImplementationAddress(
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
