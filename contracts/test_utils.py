import os

from starknet_py.net.models import Deploy
from starkware.cairo.lang.cairo_constants import DEFAULT_PRIME
from starkware.cairo.lang.compiler.cairo_compile import get_module_reader
from starkware.cairo.lang.compiler.constants import MAIN_SCOPE
from starkware.cairo.lang.compiler.preprocessor.preprocess_codes import preprocess_codes
from starkware.starknet.business_logic.internal_transaction import InternalDeploy
from starkware.starknet.compiler.compile import assemble_starknet_contract
from starkware.starknet.compiler.starknet_pass_manager import starknet_pass_manager
from starkware.starknet.definitions.fields import ContractAddressSalt
from starkware.starknet.testing.contract import StarknetContract


def to_uint256(v):
    base = 2 ** 128
    return (v % base, v // base)


async def deploy_contract_with_hints(starknet, code, calldata) -> StarknetContract:
    cairo_path = [
        os.path.join(os.path.dirname(__file__), "./fossil/contracts/"),
        os.path.join(os.path.dirname(__file__), "./cairo-contracts/"),
    ]

    module_reader = get_module_reader(cairo_path=cairo_path)

    pass_manager = starknet_pass_manager(
        prime=DEFAULT_PRIME,
        read_module=module_reader.read,
        disable_hint_validation=True,
    )

    preprocessed = preprocess_codes(
        codes=[(code, "contract.cairo")],
        pass_manager=pass_manager,
        main_scope=MAIN_SCOPE,
    )

    assembled_program = assemble_starknet_contract(
        preprocessed,
        main_scope=MAIN_SCOPE,
        add_debug_info=False,
        file_contents_for_debug_info={},
    )

    return await starknet.deploy(
        contract_def=assembled_program,
        constructor_calldata=calldata,
    )
