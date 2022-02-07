import os
from pathlib import Path

import pytest
from eth_account import Account
from eth_account._utils.signing import to_standard_v
from eth_account.messages import SignableMessage
from hexbytes import HexBytes
from starknet_py.net.models import Deploy
from starkware.cairo.lang.cairo_constants import DEFAULT_PRIME
from starkware.cairo.lang.compiler.cairo_compile import get_module_reader
from starkware.cairo.lang.compiler.constants import MAIN_SCOPE
from starkware.cairo.lang.compiler.preprocessor.preprocess_codes import preprocess_codes
from starkware.starknet.business_logic.internal_transaction import InternalDeploy
from starkware.starknet.compiler.compile import assemble_starknet_contract
from starkware.starknet.compiler.starknet_pass_manager import starknet_pass_manager
from starkware.starknet.public.abi import get_selector_from_name
from starkware.starknet.testing.objects import StarknetTransactionExecutionInfo
from starkware.starknet.testing.starknet import Starknet

from server.app.eip712 import Payload, adapter_domain

ACCOUNT_FILE = os.path.join(
    os.path.dirname(__file__), "./web3_account.cairo")

TEST_CONTRACT_FILE = os.path.join(
    os.path.dirname(__file__), "./test_contract.cairo")

PRIVATE_KEY = "0xf95e53f6ba8055b25ac3c5576e818e57a84d5d68e03b73f5a441f0464f5980ae"
ETH_ACCOUNT = Account.from_key(PRIVATE_KEY)


@pytest.mark.asyncio
async def test_web3_account():
    starknet = await Starknet.empty()
    cairo_path = [os.path.join(os.path.dirname(__file__), "./keccak-cairo/keccak/")]

    module_reader = get_module_reader(cairo_path=cairo_path)

    pass_manager = starknet_pass_manager(
        prime=DEFAULT_PRIME,
        read_module=module_reader.read,
        disable_hint_validation=True,
    )

    preprocessed = preprocess_codes(
        codes=[(Path(ACCOUNT_FILE).read_text(), "account.cairo")],
        pass_manager=pass_manager,
        main_scope=MAIN_SCOPE,
    )

    assembled_program = assemble_starknet_contract(
        preprocessed,
        main_scope=MAIN_SCOPE,
        add_debug_info=False,
        file_contents_for_debug_info={},
    )

    deploy = InternalDeploy.from_external(Deploy(
        contract_address_salt=0,
        contract_definition=assembled_program,
        constructor_calldata=[int(ETH_ACCOUNT.address, 0)],
    ), starknet.state.general_config)

    target_contract = await starknet.deploy(
        source=TEST_CONTRACT_FILE,
    )
    account = await starknet.deploy(
        contract_def=deploy.contract_definition,
        constructor_calldata=[int(ETH_ACCOUNT.address, 0)],
    )

    for i in range(5):
        payload = Payload(
            nonce=i,
            address=target_contract.contract_address,
            selector=get_selector_from_name("sum_three_values"),
            calldata=[i, i + 1, i + 2]
        )
        hashed_payload = payload.signable_bytes(adapter_domain)[2:]
        # Remove header and version
        signed = ETH_ACCOUNT.sign_message(SignableMessage(HexBytes(b"\x01"), HexBytes(b""), HexBytes(hashed_payload)))

        invocation: StarknetTransactionExecutionInfo = await account.execute(
            to=payload["address"],
            selector=payload["selector"],
            calldata=payload["calldata"],
            nonce=payload["nonce"]
        ).invoke(
            signature=[
                to_standard_v(signed.v),
                signed.r % 2 ** 128, signed.r // 2 ** 128,
                signed.s % 2 ** 128, signed.s // 2 ** 128,
            ]
        )

        assert invocation.result.response[0] == sum(payload["calldata"])
