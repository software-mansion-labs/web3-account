import os
import sys
from pathlib import Path

from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId
from starkware.starknet.public.abi import get_selector_from_name

if __name__ != "__main__":
    raise Exception("Not run as a script")

eth_address = int(sys.argv[1], 0)
client = Client(net="http://localhost:5000", chain=StarknetChainId.TESTNET)

account_script = Path("./contracts/ETH_Account.cairo").read_text()
erc_20_scripts = {
    "ERC_20.cairo": Path("./contracts/token/ERC20.cairo").read_text(),
    # "ERC20_base": Path('./contracts/token/ERC20_base.cairo').read_text(),
}
ACCOUNT_ADDRESS_SALT = int(os.getenv("ACCOUNT_ADDRESS_SALT"))

account_hash = Contract.compute_contract_hash(compilation_source=account_script)
print("ACCOUNT CONTRACT HASH:", account_hash)

account = Contract.deploy_sync(
    client=client,
    compilation_source=account_script,
    constructor_args=[eth_address],
    salt=ACCOUNT_ADDRESS_SALT,
)
print("ACCOUNT ADDRESS:", account.address)

erc20 = Contract.deploy_sync(
    client=client,
    compilation_source=erc_20_scripts,
    constructor_args={
        "name": "COIN",
        "symbol": "COIN",
        "initial_supply": 11111111,
        "recipient": account.address,
    },
    salt=ACCOUNT_ADDRESS_SALT,
)
print("ERC20 ADDRESS:", erc20.address)
print("ERC20 ADDRESS TRANSFER SELECTOR", get_selector_from_name("transfer"))
