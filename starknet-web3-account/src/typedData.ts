import { StarknetChainId } from 'starknet/constants';

import { nameForStarknetChain } from './utils';

export const getTypedData = (chain: StarknetChainId) => ({
  domain: {
    name: nameForStarknetChain(chain),
    version: '1',
  },

  primaryType: 'Payload',
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
    ],
    Payload: [
      { name: 'nonce', type: 'uint256' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'version', type: 'uint256' },
      { name: 'calls', type: 'Call[]' },
    ],
    Call: [
      { name: 'address', type: 'uint256' },
      { name: 'selector', type: 'uint256' },
      { name: 'calldata', type: 'uint256[]' },
    ],
  },
});
