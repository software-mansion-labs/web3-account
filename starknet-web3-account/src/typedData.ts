import { StarknetChainId } from 'starknet/constants';

import { nameForStarknetChain } from './utils';

export const getTypedData = (chain: StarknetChainId) => ({
  domain: {
    name: nameForStarknetChain(chain),
    version: '1',
  },

  primaryType: 'Payload',
  types: {
    domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
    ],
    Payload: [
      { name: 'txHash', type: 'uint256' },
    ],
  },
});