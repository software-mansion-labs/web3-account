import { isValidAddress } from 'ethereumjs-util';
import {
  Abi,
  Account,
  AddTransactionResponse,
  Call,
  CompressedCompiledContract,
  InvocationsDetails,
  InvocationsSignerDetails,
  Provider,
  Signature,
} from 'starknet/src';
import {
  getSelectorFromName,
  transactionVersion,
} from 'starknet/src/utils/hash';
import {
  BigNumberish,
  bigNumberishArrayToDecimalStringArray,
  hexToDecimalString,
  toBN,
  toHex,
} from 'starknet/src/utils/number';
import { estimatedFeeToMaxFee } from 'starknet/src/utils/stark';
import { fromCallsToExecuteCalldataWithNonce } from 'starknet/src/utils/transaction';

import { MetamaskClient } from '../client';
import { contractSalt, implementationAddress } from '../config';
import { Eip712Signer } from '../signer';
import { Chain, NetworkName } from '../types';
import { chainForNetwork, computeAddress } from '../utils';
import contract_deploy_tx from '../web3_account_proxy.json';

export class EthAccount extends Account {
  public readonly chain: Chain;
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

  public async execute(
    calls: Call | Call[],
    abis: Abi[] | undefined = undefined,
    transactionsDetail: InvocationsDetails = {}
  ): Promise<AddTransactionResponse> {
    const transactions = Array.isArray(calls) ? calls : [calls];
    const nonce = toBN(transactionsDetail.nonce ?? (await this.getNonce()));
    const maxFee: BigNumberish = '0';

    // maxFee, not maxFee_, is used in add_transaction, because devnet doesn't support calling invoking functions
    // with non-zero maxFee
    let maxFee_: BigNumberish = '0';
    if (transactionsDetail.maxFee || transactionsDetail.maxFee === 0) {
      maxFee_ = transactionsDetail.maxFee;
    } else {
      const estimatedFee = (await this.estimateFee(transactions, { nonce }))
        .amount;

      maxFee_ = estimatedFeeToMaxFee(estimatedFee).toString();
    }

    console.log(maxFee_);

    const signerDetails: InvocationsSignerDetails = {
      walletAddress: this.address,
      nonce,
      maxFee,
      version: toBN(transactionVersion),
      chainId: this.chainId, // It's actually not used by our signer.
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
    console.log('deployment starts', hexToDecimalString(implementationAddress));

    const deploymentResult = await this.fetchEndpoint(
      'add_transaction',
      undefined,
      {
        type: 'DEPLOY',
        contract_address_salt: contractSalt,
        constructor_calldata: [
          hexToDecimalString(implementationAddress),
          hexToDecimalString(this.ethAddress),
          this.chain.chainId.toString(),
        ],
        contract_definition:
          contract_deploy_tx.contract_definition as CompressedCompiledContract,
      }
    );

    return deploymentResult;
  }

  public computeStarknetAddress(ethAddress: string) {
    return computeAddress(ethAddress, this.chain.chainId);
  }
}
