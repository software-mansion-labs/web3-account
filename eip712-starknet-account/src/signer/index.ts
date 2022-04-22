import {
  Invocation,
  InvocationsSignerDetails,
  Signature,
  SignerInterface,
} from 'starknet';

import { MetamaskClient } from '../client';
import { getTypedData } from '../typedData';
import { Chain } from '../types';
import { parseSignature } from '../utils';

export class Eip712Signer implements SignerInterface {
  constructor(
    private client: MetamaskClient,
    public readonly ethAddress: string,
    private chain: Chain
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

  sign(data: Record<string, unknown>): Promise<string> {
    return this.client.request(
      'eth_signTypedData_v4',
      this.ethAddress,
      JSON.stringify(data)
    ) as Promise<string>;
  }
}

// export class PersonalSigner implements SignerInterface {
//   constructor(
//     private client: MetamaskClient,
//     public readonly ethAddress: string
//   ) {}

//   public async getPubKey(): Promise<string> {
//     return (await this.client.request('eth_getEncryptionPublicKey', [
//       this.ethAddress,
//     ])) as string;
//   }

//   public async signMessage(): Promise<Signature> {
//     throw new Error(
//       'signMessage is not supported in ETHSigner, use default Signer.'
//     );
//   }

//   public async signTransaction(
//     transactions: Invocation[],
//     transactionsDetail: InvocationsSignerDetails
//   ): Promise<Signature> {
//     if (transactions.length === 0) {
//       throw new Error('No transaction to sign');
//     }

//     const msgHash = hashMulticall(
//       transactionsDetail.walletAddress,
//       transactions,
//       transactionsDetail.nonce.toString(),
//       transactionsDetail.maxFee.toString()
//     );

//     console.log(msgHash);

//     const signature = (await this.client.request(
//       'eth_personalSign',
//       this.ethAddress,
//       msgHash
//     )) as string;

//     console.log(signature);

//     return parseSignature(signature);
//   }
// }
