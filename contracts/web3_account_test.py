import os
from pathlib import Path

import pytest
from eth_account import Account
from eth_account._utils.signing import to_standard_v
from eth_account.messages import SignableMessage
from hexbytes import HexBytes
from starkware.starknet.public.abi import get_selector_from_name
from starkware.starknet.testing.objects import StarknetTransactionExecutionInfo, StarknetContractCall
from starkware.starknet.testing.starknet import Starknet
from starkware.starkware_utils.error_handling import StarkException

from contracts.test_utils import deploy_contract_with_hints, to_uint256
from adapter.eip712 import Payload, adapter_domain, Call

ACCOUNT_FILE = os.path.join(
    os.path.dirname(__file__), "./web3_account.cairo")

TEST_CONTRACT_FILE = os.path.join(
    os.path.dirname(__file__), "./test_contract.cairo")

PRIVATE_KEY = "0xf95e53f6ba8055b25ac3c5576e818e57a84d5d68e03b73f5a441f0464f5980ae"
ETH_ACCOUNT = Account.from_key(PRIVATE_KEY)
GOERLI_CHAIN_ID = 5

domain_hash = adapter_domain.hash_struct()

@pytest.mark.asyncio
async def test_web3_account_valid_signatures():
    starknet = await Starknet.empty()

    target_contract = await starknet.deploy(
        source=TEST_CONTRACT_FILE,
    )

    account = await deploy_contract_with_hints(
        starknet,
        Path(ACCOUNT_FILE).read_text(),
        [
            int(ETH_ACCOUNT.address, 0),
            GOERLI_CHAIN_ID,
        ]
    )

    for i in range(4):
        call = Call(
            address=target_contract.contract_address,
            selector=get_selector_from_name("sum_three_values"),
            calldata=[i, i + 1, i + 2],
        )
        payload = Payload(nonce=i, maxFee=0, version=0, calls=[call])
        hashed_payload = payload.signable_bytes(adapter_domain)[2:]
        # Remove header and version
        signed = ETH_ACCOUNT.sign_message(SignableMessage(HexBytes(b"\x01"), HexBytes(b""), HexBytes(hashed_payload)))

        invocation: StarknetTransactionExecutionInfo = await account.__execute__(
            call_array=[
                (call["address"], call["selector"], 0, len(call["calldata"]))
            ],
            calldata=call["calldata"],
            nonce=payload["nonce"]
        ).invoke(
            signature=[
                to_standard_v(signed.v),
                *to_uint256(signed.r),
                *to_uint256(signed.s),
            ]
        )

        info: StarknetContractCall = invocation.call_info
        print(f"web3 account execute {i}", info.cairo_usage)
        assert invocation.result[0][0] == sum(call["calldata"])


@pytest.mark.asyncio
async def test_web3_account_invalid_signatures():
   starknet = await Starknet.empty()

   target_contract = await starknet.deploy(
       source=TEST_CONTRACT_FILE,
   )

   # Use a different address
   account = await deploy_contract_with_hints(
       starknet,
       Path(ACCOUNT_FILE).read_text(),
       [
            0x7FC37b5571e7128DB2CfA7714eDAA4e9Bedf0883,
            GOERLI_CHAIN_ID,
       ]
   )

   call = Call(
       address=target_contract.contract_address,
       selector=get_selector_from_name("sum_three_values"),
       calldata=[1,2,3],
   )
   payload = Payload(nonce=0, maxFee=0, version=0, calls=[call])

   hashed_payload = payload.signable_bytes(adapter_domain)[2:]
   signed = ETH_ACCOUNT.sign_message(SignableMessage(HexBytes(b"\x01"), HexBytes(b""), HexBytes(hashed_payload)))

   with pytest.raises(StarkException):
       await account.__execute__(
            call_array=[
                (call["address"], call["selector"], 0, len(call["calldata"]))
            ],
            calldata=call["calldata"],
            nonce=payload["nonce"]
        ).invoke(
            signature=[
                to_standard_v(signed.v),
                *to_uint256(signed.r),
                *to_uint256(signed.s),
            ]
        )
