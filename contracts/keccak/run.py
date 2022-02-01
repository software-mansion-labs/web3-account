import os
from pathlib import Path

from eip712_structs import EIP712Struct, Uint, Array, make_domain
from eth_utils import keccak
from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId

if __name__ != "__main__":
    raise Exception("Not run as a script")


class Payload(EIP712Struct):
    nonce = Uint(256)
    address = Uint(256)
    selector = Uint(256)
    calldata = Array(Uint(256))


print("PAYLOAD TYPE HASH", "0x" + Payload.type_hash().hex())

payload = Payload(nonce=1, address=1, selector=1, calldata=[1, 1])
print("PAYLOAD HASH", "0x" + payload.hash_struct().hex())

adapter_domain = make_domain(
    name="Starknet adapter", chainId=int(os.getenv("CHAIN_ID"), 0), version="1"
)

print("DOMAIN SEPARATOR", "0x" + adapter_domain.hash_struct().hex())
print("FULL HASH", "0x" + keccak(payload.signable_bytes(domain=adapter_domain)).hex())

client = Client(net=os.getenv("NODE_URL"), chain=StarknetChainId.TESTNET)

script = Path("./contract.cairo").read_text()

contract = Contract.deploy_sync(
    client=client,
    compilation_source=script,
    constructor_args=[],
)

all_bytes = 0xFFFFFFFFFFFFFFFF


# result = contract.functions["compute_keccak"].call_sync([all_bytes, all_bytes, all_bytes, all_bytes], 32)


def to_bytes(values):
    return b"".join(values)


def get_hex(result):
    return "0x" + to_bytes([r.to_bytes(8, "little") for r in result]).hex()


def py_keccak(value, bytes):
    from Crypto.Hash import keccak

    k = keccak.new(digest_bits=256)
    k.update(value.to_bytes(bytes, "little"))
    return k.hexdigest()


f = contract.functions["to_integers"]

args = {
    "to": payload["address"],
    "selector": payload["selector"],
    "calldata": payload["calldata"],
    "nonce": payload["nonce"],
}


payload2 = Payload(nonce=1, address=1, selector=1, calldata=[])
