import {
  Invocation,
  InvocationsSignerDetails,
  Signature,
  SignerInterface,
} from 'starknet';
import { getMessageHash } from 'starknet/src/utils/typedData';
import {
  calculcateTransactionHash,
  getSelectorFromName,
} from 'starknet/utils/hash';
import { fromCallsToExecuteCalldataWithNonce } from 'starknet/utils/transaction';

import { MetamaskClient } from '../client';
import { parseSignature } from '../utils';

export class EthSigner implements SignerInterface {
  constructor(
    private client: MetamaskClient,
    public readonly ethAddress: string
  ) {}

  public async getPubKey(): Promise<string> {
    return (await this.client.request('eth_getEncryptionPublicKey', [
      this.ethAddress,
    ])) as string;
  }

  public signMessage(typedData, accountAddress): Promise<Signature> {
    const msgHash = getMessageHash(typedData, accountAddress);
    return this.signRaw(msgHash);
  }

  public async signTransaction(
    transactions: Invocation[],
    transactionsDetail: InvocationsSignerDetails
  ): Promise<Signature> {
    const calldata = fromCallsToExecuteCalldataWithNonce(
      transactions,
      transactionsDetail.nonce
    );

    const msgHash = calculcateTransactionHash(
      transactionsDetail.walletAddress,
      transactionsDetail.version,
      getSelectorFromName('__execute__'),
      calldata,
      transactionsDetail.maxFee,
      transactionsDetail.chainId
    );

    const hash = '0x' + msgHash.slice(2).padStart(64, '0');

    return this.signRaw(hash);
  }

  public async signRaw(data: string): Promise<Signature> {
    const signature = (await this.client.request(
      'eth_sign',
      this.ethAddress,
      data
    )) as string;

    return parseSignature(signature);
  }
}
