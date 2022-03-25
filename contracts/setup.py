import json
import os
from pathlib import Path
from argparse import ArgumentParser


from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId, Deploy, Transaction
from starknet_py.utils.compiler.starknet_compile import starknet_compile
from starkware.starknet.public.abi import get_selector_from_name
from starkware.starknet.services.api.contract_definition import ContractDefinition

if __name__ != "__main__":
    raise Exception("Not run as a script")

parser = ArgumentParser()
parser.add_argument('network', choices=["testnet", "devnet"])

network = parser.parse_args().network

if network == "devnet":
    client = Client(net=os.getenv("NODE_URL"), chain=StarknetChainId.TESTNET)
else:
    client = Client("testnet")

account_script = Path("./contracts/web3_account.cairo").read_text()
erc_20_script = Path("./contracts/demo_token.cairo").read_text()
ACCOUNT_ADDRESS_SALT = int(os.getenv("ACCOUNT_ADDRESS_SALT"))

account_hash = Contract.compute_contract_hash(compilation_source=account_script)
print("ACCOUNT CONTRACT HASH:", account_hash)


GOERLI_CHAIN_ID = 5

# Save contract definition
# Starknet.js compresses program in a different way
definition = ContractDefinition.loads(starknet_compile(account_script))
dump = Transaction.Schema().dump(obj=Deploy(
    contract_address_salt=ACCOUNT_ADDRESS_SALT,
    contract_definition=definition,
    constructor_calldata=[],
))
Path("eip712-starknet-account/src/web3_account.json").write_text(json.dumps(dump))

deployment = Contract.deploy_sync(
    client=client,
    compilation_source=erc_20_script,
    constructor_args={
        "name": "COIN",
        "symbol": "COIN",
    },
    salt=ACCOUNT_ADDRESS_SALT,
)
deployment.wait_for_acceptance_sync()
erc20 = deployment.deployed_contract

print("ERC20 ADDRESS:", erc20.address)
print("ERC20 ADDRESS TRANSFER SELECTOR", get_selector_from_name("transfer"))
