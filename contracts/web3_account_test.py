import os

import pytest
from starkware.starknet.core.os.transaction_hash.transaction_hash import calculate_transaction_hash_common, \
    TransactionHashPrefix
from starkware.starknet.public.abi import get_selector_from_name
from starkware.starknet.testing.contract import StarknetContractFunctionInvocation

from starkware.starknet.testing.starknet import Starknet

from eth_account import Account

ACCOUNT_FILE = os.path.join(
    os.path.dirname(__file__), "./account/web3_account.cairo")

PROXY_FILE = os.path.join(
    os.path.dirname(__file__), "./account/proxy.cairo")

TEST_CONTRACT_FILE = os.path.join(
    os.path.dirname(__file__), "./test_contract.cairo")

CAIRO_PATH = [os.path.join(os.path.dirname(__file__), "./cairo-contracts/src")]

ACCOUNT = Account.from_key("0xf95e53f6ba8055b25ac3c5576e818e57a84d5d68e03b73f5a441f0464f5980ae")
ADDRESS = int(ACCOUNT.address, 16)


@pytest.fixture
async def starknet():
    return await Starknet.empty()


@pytest.fixture
async def test_contract(starknet):
    return await starknet.deploy(
        source=TEST_CONTRACT_FILE,
        cairo_path=CAIRO_PATH,
    )


@pytest.fixture
async def contract(starknet):
    contract = await starknet.deploy(
        source=ACCOUNT_FILE,
        cairo_path=CAIRO_PATH,
    )
    await contract.initializer(ADDRESS).invoke()
    result = await contract.get_eth_address().call()
    assert result.result.address == ADDRESS
    return contract


def to_uint256(v):
    return v % 2 ** 128, v // 2 ** 128


def sign(value):
    padded = f"{value:#0{65}x}"
    signed = ACCOUNT.signHash(padded)
    return [signed.v - 27, *to_uint256(signed.r), *to_uint256(signed.s)]


def hash_invocation(invocation: StarknetContractFunctionInvocation, selector="__execute__"):
    return calculate_transaction_hash_common(
        tx_hash_prefix=TransactionHashPrefix.INVOKE,
        version=0,
        contract_address=invocation.contract_address,
        entry_point_selector=get_selector_from_name(selector),
        calldata=invocation.calldata,
        max_fee=0,
        chain_id=invocation.state.general_config.chain_id.value,
        additional_data=[],
    )


# TODO: make sure caller is checked

@pytest.mark.asyncio
async def test_web3_account_valid_signature(test_contract, contract):
    execution: StarknetContractFunctionInvocation = contract.__execute__(
        call_array=[
            (test_contract.contract_address, get_selector_from_name("sum_three_values"), 0, 3),
            (test_contract.contract_address, get_selector_from_name("sum_three_values"), 3, 3)
        ],
        calldata=[1, 2, 3, 10, 20, 30],
        nonce=0,
    )

    result = await contract.get_nonce().call()
    assert result.result.nonce == 0

    hash = hash_invocation(execution)
    signature = sign(hash)

    invocation = await execution.invoke(signature=signature)
    assert invocation.result.response[0] == 1 + 2 + 3
    assert invocation.result.response[1] == 10 + 20 + 30

    # Fails if something goes wrong
    await contract.is_valid_signature(hash, signature).call()

    result = await contract.get_nonce().call()
    assert result.result.nonce == 1


@pytest.mark.asyncio
async def test_web3_account_invalid_signature(test_contract, contract):
    execution: StarknetContractFunctionInvocation = contract.__execute__(
        call_array=[
            (test_contract.contract_address, get_selector_from_name("sum_three_values"), 0, 3),
            (test_contract.contract_address, get_selector_from_name("sum_three_values"), 3, 3)
        ],
        calldata=[1, 2, 3, 10, 20, 30],
        nonce=0,
    )

    result = await contract.get_nonce().call()
    assert result.result.nonce == 0

    hash = hash_invocation(execution)
    signature = sign(11)

    with pytest.raises(Exception) as excinfo:
        await execution.invoke(signature=signature)
    assert "TRANSACTION_FAILED" in str(excinfo)

    with pytest.raises(Exception) as excinfo:
        await contract.is_valid_signature(hash, signature).call(hash, signature)
    assert "TRANSACTION_FAILED" in str(excinfo)

    result = await contract.get_nonce().call()
    assert result.result.nonce == 0


@pytest.mark.asyncio
async def test_multiple_txs(test_contract, contract):
    for current_nonce in range(4):
        execution: StarknetContractFunctionInvocation = contract.__execute__(
            call_array=[
                (test_contract.contract_address, get_selector_from_name("sum_three_values"), 0, 3),
            ],
            calldata=[1, 2, 3],
            nonce=current_nonce,
        )
        hash = hash_invocation(execution)
        signature = sign(hash)

        await execution.invoke(signature=signature)

        # Make sure eth address and eth don't interfere
        result = await contract.get_nonce().call()
        assert result.result.nonce == current_nonce + 1

        result = await contract.get_eth_address().call()
        assert result.result.address == ADDRESS


# TODO: test this with an actual proxy
@pytest.mark.asyncio
async def test_upgrade(contract):
    new_implementation = 1234
    execution: StarknetContractFunctionInvocation = contract.__execute__(
        call_array=[
            (contract.contract_address, get_selector_from_name("upgrade"), 0, 1),
        ],
        calldata=[new_implementation],
        nonce=0,
    )
    hash = hash_invocation(execution)
    signature = sign(hash)

    await execution.invoke(signature=signature)

    result = await contract.get_implementation().call()
    assert result.result.implementation == new_implementation