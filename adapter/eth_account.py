from typing import Union

from starknet_py.net.models import compute_address

from adapter.settings import ACCOUNT_CONTRACT_HASH, ACCOUNT_ADDRESS_SALT


def compute_eth_account_address(address: Union[str, int]) -> int:
    address = address if isinstance(address, int) else int(address, 0)
    return compute_address(
        contract_hash=ACCOUNT_CONTRACT_HASH,
        constructor_calldata=[address],
        salt=ACCOUNT_ADDRESS_SALT,
    )
