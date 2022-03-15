from typing import List, Optional

from eip712_structs import EIP712Struct, Uint, make_domain, Array


from eth_utils import keccak

from adapter.settings import DOMAIN_NAME


class Payload(EIP712Struct):
    nonce = Uint(256)
    address = Uint(256)
    selector = Uint(256)
    calldata = Array(Uint(256))


adapter_domain = make_domain(name=DOMAIN_NAME, version="1")


def to_message_hash(
    nonce: int,
    address: int,
    selector: int,
    calldata: List[int],
    domain: Optional[EIP712Struct] = None,
):
    domain = domain or adapter_domain
    payload = Payload(
        nonce=nonce,
        address=address,
        selector=selector,
        calldata=calldata,
    )

    message = payload.signable_bytes(domain=domain)
    return keccak(message)
