import json
import os
import sys
from pathlib import Path

from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId, Deploy, Transaction
from starknet_py.utils.compiler.starknet_compile import starknet_compile
from starkware.starknet.public.abi import get_selector_from_name
from starkware.starknet.services.api.contract_definition import ContractDefinition

if __name__ != "__main__":
    raise Exception("Not run as a script")

eth_address = int(sys.argv[1], 0)
client = Client(net=os.getenv("NODE_URL"), chain=StarknetChainId.TESTNET)

account_script = Path("./contracts/web3_account.cairo").read_text()
erc_20_scripts = Path("./contracts/cairo-contracts/contracts/token/ERC20.cairo").read_text()
ACCOUNT_ADDRESS_SALT = int(os.getenv("ACCOUNT_ADDRESS_SALT"))

account_hash = Contract.compute_contract_hash(compilation_source=account_script)
print("ACCOUNT CONTRACT HASH:", account_hash)


# Save contract definition
# Starknet.js compresses program in a different way
definition = ContractDefinition.loads(starknet_compile(account_script))
dump = Transaction.Schema().dump(obj=Deploy(
    contract_address_salt=ACCOUNT_ADDRESS_SALT,
    contract_definition=definition,
    constructor_calldata=[],
))
Path("client/web3_account.json").write_text(json.dumps(dump))

account = Contract.deploy_sync(
    client=client,
    compilation_source=account_script,
    constructor_args=[eth_address],
    salt=ACCOUNT_ADDRESS_SALT,
).deployed_contract

print("ACCOUNT ADDRESS:", account.address)

erc20 = Contract.deploy_sync(
    client=client,
    compilation_source=erc_20_scripts,
    constructor_args={
        "name": "COIN",
        "symbol": "COIN",
        "initial_supply": round(1e6 * 1e18),
        "recipient": account.address,
    },
    salt=ACCOUNT_ADDRESS_SALT,
).deployed_contract

print("ERC20 ADDRESS:", erc20.address)
print("ERC20 ADDRESS TRANSFER SELECTOR", get_selector_from_name("transfer"))
