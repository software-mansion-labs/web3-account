from typing import Union

from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import compute_address

from server.app.eth_account_abi import eth_account_abi
from server.app.settings import ACCOUNT_CONTRACT_HASH, ACCOUNT_ADDRESS_SALT


async def get_eth_account_contract(client: Client, eth_address: str) -> Contract:
    address = compute_eth_account_address(eth_address)
    return Contract(address=address, client=client, abi=eth_account_abi)


def compute_eth_account_address(address: Union[str, int]) -> int:
    address = address if isinstance(address, int) else int(address, 0)
    return compute_address(
        contract_hash=ACCOUNT_CONTRACT_HASH,
        constructor_calldata=[address],
        salt=ACCOUNT_ADDRESS_SALT,
    )
