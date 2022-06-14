import { fromRpcSig } from 'ethereumjs-util';
import { Signature } from 'starknet';
import { StarknetChainId } from 'starknet/constants';
import {
  computeHashOnElements,
  getSelectorFromName,
} from 'starknet/utils/hash';
import { hexToDecimalString, isHex } from 'starknet/utils/number';
import { decodeShortString } from 'starknet/utils/shortString';

import { contractHash, contractSalt, implementationAddress } from './config';

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

export const nameForStarknetChain = (chain: StarknetChainId) => {
  return decodeShortString(chain);
};

export const constructorArguments = (
  ethAddress: string,
  chainId: StarknetChainId
) =>
  [
    implementationAddress,
    getSelectorFromName('initializer'),
    '2',
    ethAddress,
    chainId,
  ].map((arg) => (isHex(arg) ? hexToDecimalString(arg) : arg));

export const computeStarknetAddress = (
  ethAddress: string,
  chainId: StarknetChainId
) =>
  computeHashOnElements([
    '0x' + new Buffer('STARKNET_CONTRACT_ADDRESS', 'ascii').toString('hex'),
    0,
    contractSalt,
    contractHash,
    computeHashOnElements(constructorArguments(ethAddress, chainId)),
  ]);
