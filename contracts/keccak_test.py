import os

import pytest
from starkware.starknet.testing.starknet import Starknet

CONTRACT_FILE = os.path.join(
    os.path.dirname(__file__), "test_contract.cairo")
@pytest.mark.asyncio
async def test_raw_keccak():
    starknet = await Starknet.empty()
    account = await starknet.deploy(
        source=CONTRACT_FILE,
    )
    # account = await deploy_contract_with_hints(starknet, code, [])

    # 160 bytes
    values = [i for i in range(40)]

    call = await account.uint256_keccak_view(
        [(v*2137,2**(80+v)+v) for v in values]
    ).call()

    print("KECCAK 160 CAIRO USAGE", call)