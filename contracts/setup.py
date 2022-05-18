import json
import os
from pathlib import Path
from argparse import ArgumentParser


from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId, Deploy, Transaction
from starknet_py.compile.compiler import starknet_compile
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
proxy_script = Path("./contracts/proxy.cairo").read_text()
erc_20_script = Path("./contracts/demo_token.cairo").read_text()
CONTRACT_SALT = int(os.getenv("CONTRACT_SALT"))

proxy_hash = Contract.compute_contract_hash(compilation_source=proxy_script)
print("PROXY CONTRACT HASH:", proxy_hash)

GOERLI_CHAIN_ID = 5

# Save contract definition
# Starknet.js compresses program in a different way
definition = ContractDefinition.loads(starknet_compile(proxy_script))
dump = Transaction.Schema().dump(obj=Deploy(
    contract_address_salt=CONTRACT_SALT,
    contract_definition=definition,
    constructor_calldata=[],
))
Path("eip712-starknet-account/src/web3_account_proxy.json").write_text(json.dumps(dump))

account_deployment = Contract.deploy_sync(
    client=client,
    compilation_source=account_script,
    salt=CONTRACT_SALT
)

account_deployment.wait_for_acceptance_sync()
account = account_deployment.deployed_contract

print("ACCOUNT ADDRESS:", account.address)

erc20_deployment = Contract.deploy_sync(
    client=client,
    compilation_source=erc_20_script,
    constructor_args={
        "name": "COIN",
        "symbol": "COIN",
    },
    salt=CONTRACT_SALT,
)
erc20_deployment.wait_for_acceptance_sync()
erc20 = erc20_deployment.deployed_contract

print("ERC20 ADDRESS:", erc20.address)
print("ERC20 ADDRESS TRANSFER SELECTOR", get_selector_from_name("transfer"))
