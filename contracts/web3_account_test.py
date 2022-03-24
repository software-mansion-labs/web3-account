import os
from pathlib import Path

import pytest
from eth_account import Account

from starkware.starknet.testing.objects import StarknetTransactionExecutionInfo, StarknetContractCall
from starkware.starknet.testing.starknet import Starknet

from contracts.test_utils import deploy_contract_with_hints

ACCOUNT_FILE = os.path.join(
    os.path.dirname(__file__), "./web3_account.cairo")

TEST_CONTRACT_FILE = os.path.join(
    os.path.dirname(__file__), "./test_contract.cairo")

PRIVATE_KEY = "0xf95e53f6ba8055b25ac3c5576e818e57a84d5d68e03b73f5a441f0464f5980ae"
ETH_ACCOUNT = Account.from_key(PRIVATE_KEY)
GOERLI_CHAIN_ID = 5

# Generated from generateHashes
test_cases = [
    {
        "message": {
            "nonce": "0",
            "maxFee": "0",
            "version": "0",
            "calls": [
                {
                    "address": "0x7156fb3c40b9636425931f57a87c507aa472d1b97d52859e5c68b9ba2b3570",
                    "selector": "0x1326ba54c1a0ca5f0593bfe36b9adeaf723e0ce0e8737bd108812706386cefb",
                    "calldata": [
                        0,
                        1,
                        2
                    ]
                }
            ]
        },
        "result": 3,
        "signature": [
            "0x1",
            "0x26a92a79db8bded9d19432be42a9485b",
            "0x5eedeca8e2cd59259533ed85d07dce07",
            "0xadff5fa94ac1b24c91bd926f818e285f",
            "0x2436377b8b6f4b7dbcd3408bc513cd45"
        ]
    },
    {
        "message": {
            "nonce": "1",
            "maxFee": "0",
            "version": "0",
            "calls": [
                {
                    "address": "0x7156fb3c40b9636425931f57a87c507aa472d1b97d52859e5c68b9ba2b3570",
                    "selector": "0x1326ba54c1a0ca5f0593bfe36b9adeaf723e0ce0e8737bd108812706386cefb",
                    "calldata": [
                        1,
                        2,
                        3
                    ]
                }
            ]
        },
        "result": 6,
        "signature": [
            "0x0",
            "0xb48999fc7b519065e517c40c7057bda5",
            "0x0b1703e4e8401a4422c57fb7029cc463",
            "0xbc6785b688fda1e22cf13e38819eecf0",
            "0x230e8ce3598b2c879dcc2c2cc84a2276"
        ]
    },
    {
        "message": {
            "nonce": "2",
            "maxFee": "0",
            "version": "0",
            "calls": [
                {
                    "address": "0x7156fb3c40b9636425931f57a87c507aa472d1b97d52859e5c68b9ba2b3570",
                    "selector": "0x1326ba54c1a0ca5f0593bfe36b9adeaf723e0ce0e8737bd108812706386cefb",
                    "calldata": [
                        2,
                        3,
                        4
                    ]
                }
            ]
        },
        "result": 9,
        "signature": [
            "0x0",
            "0x7be3b80b70fa7a5bc1a0a8db60e44326",
            "0xc57755d099e481c2ae552daa0235315a",
            "0x3303f59c71e9b151716667f7966b2464",
            "0x4db3d8a33edfa009ecb2027b8bbef02c"
        ]
    }
]


@pytest.mark.asyncio
async def test_web3_account_valid_signatures():
    starknet = await Starknet.empty()

    await starknet.deploy(
        source=TEST_CONTRACT_FILE,
        contract_address_salt=0,
    )

    account = await deploy_contract_with_hints(
        starknet,
        Path(ACCOUNT_FILE).read_text(),
        [
            int(ETH_ACCOUNT.address, 0),
            GOERLI_CHAIN_ID,
        ]
    )

    for test_case in test_cases:
        message = test_case["message"]
        call = message["calls"][0]

        invocation: StarknetTransactionExecutionInfo = await account.__execute__(
            call_array=[
                (int(call["address"], 0), int(call["selector"], 0), 0, len(call["calldata"]))
            ],
            calldata=call["calldata"],
            nonce=int(message["nonce"], 0)
        ).invoke(
            signature=test_case["signature"]
        )

        info: StarknetContractCall = invocation.call_info
        print(f"web3 account execute {message['nonce']}", info.cairo_usage)
        assert invocation.result[0][0] == test_case["result"]
