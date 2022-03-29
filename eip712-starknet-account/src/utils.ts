import { fromRpcSig } from 'ethereumjs-util';
import { Signature } from 'starknet';
import { computeHashOnElements } from 'starknet/utils/hash';

import { contractHash, contractSalt, implementationAddress } from './config';
import { NetworkName } from './types';

const RECOVERY_OFFSET = 27;

export const parseSignature = (signature: string): Signature => {
  const { v, r, s } = fromRpcSig(signature);

  const rHigh = '0x' + r.slice(0, 16).toString('hex');
  const rLow = '0x' + r.slice(16, 32).toString('hex');

  const sHigh = '0x' + s.slice(0, 16).toString('hex');
  const sLow = '0x' + s.slice(16, 32).toString('hex');

  const vStr = '0x' + (v - RECOVERY_OFFSET).toString(16);

  return [vStr, rLow, rHigh, sLow, sHigh];
};

export const computeAddress = (ethAddress: string, chainId: number) =>
  computeHashOnElements([
    '0x' + new Buffer('STARKNET_CONTRACT_ADDRESS', 'ascii').toString('hex'),
    0,
    contractSalt,
    contractHash,
    computeHashOnElements([implementationAddress, ethAddress, chainId]),
  ]);

export const chainForNetwork = (network: NetworkName) => {
  if (network === 'mainnet-alpha') {
    return {
      chainId: 1,
      chainName: 'SN_MAINNET',
    };
  } else {
    return {
      chainId: 5,
      chainName: 'SN_GOERLI',
    };
  }
};
