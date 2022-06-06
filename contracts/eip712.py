from eip712_structs import EIP712Struct, Uint, make_domain, Array
from eth_utils import keccak

class Payload(EIP712Struct):
    tx_hash = Uint(256)


adapter_domain = make_domain(name="web3 account SN_GOERLI", version="1")


def eip712_hash(tx_hash: int) -> bytes:
    payload = Payload(tx_hash=tx_hash)
    return keccak(payload.signable_bytes(domain=adapter_domain))
