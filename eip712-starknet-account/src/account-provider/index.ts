import { isValidAddress } from 'ethereumjs-util';
import {
  Abi,
  Account,
  AddTransactionResponse,
  Call,
  // Call,
  // CallContractResponse,
  CompressedCompiledContract,
  InvocationsDetails,
  InvocationsSignerDetails,
  Provider,
  Signature,
} from 'starknet';
import { fromCallsToExecuteCalldataWithNonce } from 'starknet/dist/utils/transaction';
import { getSelectorFromName, transactionVersion } from 'starknet/utils/hash';
// import { getSelectorFromName } from 'starknet/utils/hash';
// import { BlockIdentifier } from 'starknet/provider/utils';
// import { getSelectorFromName } from 'starknet/utils/hash';
import {
  BigNumberish,
  hexToDecimalString,
  toBN,
  toHex,
} from 'starknet/utils/number';
import { estimatedFeeToMaxFee } from 'starknet/utils/stark';

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
    // const signer = new PersonalSigner(client, ethAddress);
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
    let maxFee: BigNumberish = '0';
    if (transactionsDetail.maxFee || transactionsDetail.maxFee === 0) {
      maxFee = transactionsDetail.maxFee;
    } else {
      const estimatedFee = (await this.estimateFee(transactions, { nonce }))
        .amount;
      maxFee = estimatedFeeToMaxFee(estimatedFee).toString();
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
      signature: signature,
      max_fee: toHex(toBN(maxFee)),
    });
  }

  /* Account deployment methods */

  public async isDeployed(): Promise<boolean> {
    const code = await this.getCode(this.address);
    return !!code.bytecode.length;
  }

  // public async getNonce(): Promise<string> {
  //   const { result } = await this.fetchEndpoint(
  //     'call_contract',
  //     { blockIdentifier: 'pending' },
  //     {
  //       contract_address: this.address,
  //       entry_point_selector: '__default__',
  //       calldata: [hexToDecimalString(getSelectorFromName('get_nonce'))],
  //       signature: [],
  //     }
  //   );

  //   return toHex(toBN(result[0]));
  // }

  // public async callContract(
  //   { contractAddress, entrypoint, calldata = [] }: Call,
  //   { blockIdentifier = 'pending' }: { blockIdentifier?: BlockIdentifier } = {}
  // ): Promise<CallContractResponse> {
  //   console.log('calling:', contractAddress);
  //   console.log('calling:', entrypoint);
  //   console.log('calling:', calldata);

  //   // return super.callContract(
  //   //   { contractAddress, entrypoint, calldata },
  //   //   { blockIdentifier }
  //   // );
  //   return this.fetchEndpoint(
  //     'call_contract',
  //     { blockIdentifier },
  //     {
  //       signature: [],
  //       contract_address: contractAddress,
  //       entry_point_selector: getSelectorFromName(entrypoint),
  //       calldata: [getSelectorFromName(entrypoint), ...calldata],
  //     }
  //   );
  // }

  // public async getNonce(): Promise<string> {
  //   try {
  //     const { result } = await this.callContract({
  //       contractAddress: this.address,
  //       entrypoint: getSelectorFromName('get_nonce'),
  //     });

  //     return toHex(toBN(result[0]));
  //   } catch (e) {
  //     console.log('Error while getting nonce');
  //     console.error(e);
  //     throw e;
  //   }
  // }

  public deployAccount = async (): Promise<AddTransactionResponse> => {
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

    console.log('deployment ends');

    // await this.callContract({
    //   contractAddress: this.address,
    //   entrypoint: 'initializer',
    //   calldata: [
    //     hexToDecimalString(this.address),
    //     hexToDecimalString(this.ethAddress),
    //     this.chain.chainId.toString(),
    //   ],
    // });
    console.log(this.chain);
    console.log(this.ethAddress);

    return deploymentResult;
  };
}
