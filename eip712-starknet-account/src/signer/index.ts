import {
  Invocation,
  InvocationsSignerDetails,
  Signature,
  SignerInterface,
} from 'starknet';
import { getSelectorFromName } from 'starknet/utils/hash';
import { toBN, toHex } from 'starknet/utils/number';

import { MetamaskClient } from '../client';
import { getTypedData } from '../typedData';
import { parseSignature } from '../utils';

export class Eip712Signer implements SignerInterface {
  constructor(
    private client: MetamaskClient,
    public readonly ethAddress: string
  ) {}

  public async getPubKey(): Promise<string> {
    return (await this.client.request('eth_getEncryptionPublicKey', [
      this.ethAddress,
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

    let version: string;
    if (typeof transactionsDetail.version === 'string') {
      version = transactionsDetail.version;
    } else {
      version = toHex(toBN(transactionsDetail.version));
    }

    const message = {
      nonce: transactionsDetail.nonce,
      maxFee: transactionsDetail.maxFee,
      version: version,
      calls: transactions.map((transaction) => ({
        address: transaction.contractAddress,
        selector: getSelectorFromName(transaction.entrypoint),
        calldata: transaction.calldata,
      })),
    };

    const data = {
      ...getTypedData(transactionsDetail.chainId),
      message,
    };

    const signature = await this.sign(data);

    return parseSignature(signature);
  }

  sign(data: Record<string, unknown>): Promise<string> {
    return this.client.request(
      'eth_signTypedData_v4',
      this.ethAddress,
      JSON.stringify(data)
    ) as Promise<string>;
  }
}
