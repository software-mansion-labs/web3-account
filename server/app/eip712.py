from typing import List

from eip712_structs import EIP712Struct, Uint, make_domain, Array


from eth_utils import keccak


class Payload(EIP712Struct):
    nonce = Uint(256)
    address = Uint(256)
    selector = Uint(256)
    calldata = Array(Uint(256))


domain = make_domain(name="Starknet adapter", chainId=0xB, version="1")


def to_message_hash(
    nonce: int,
    address: int,
    selector: int,
    calldata: List[int],
):
    payload = Payload(
        nonce=nonce,
        address=address,
        selector=selector,
        calldata=calldata,
    )

    message = payload.signable_bytes(domain=domain)
    return keccak(message)
