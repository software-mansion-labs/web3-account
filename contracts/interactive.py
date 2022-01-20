import os
import sys
from pathlib import Path

from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId

from server.app.eth_account import compute_eth_account_address

if __name__ != "__main__":
    raise Exception("Must be run as a script")

ACCOUNT_ADDRESS_SALT = int(os.getenv("ACCOUNT_ADDRESS_SALT"))
eth_address = int(sys.argv[1], 0)
client = Client(net="http://localhost:5000", chain=StarknetChainId.TESTNET)

account_address = compute_eth_account_address(eth_address)
print("ADDRESS", account_address)
er20_hash = Contract.compute_contract_hash(
    Path("./contracts/token/ERC20.cairo").read_text()
)
erc20_address = Contract.compute_address(
    compilation_source=Path("./contracts/token/ERC20.cairo").read_text(),
    constructor_args={
        "name": "COIN",
        "symbol": "COIN",
        "initial_supply": round(1e6 * 1e18),
        "recipient": account_address,
    },
    salt=ACCOUNT_ADDRESS_SALT,
)
print("ERC ADDRESS", erc20_address)

account = Contract.from_address_sync(account_address, client=client)
erc20 = Contract.from_address_sync(erc20_address, client=client)
print("READY:")
