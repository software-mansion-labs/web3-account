from eip712_structs import EIP712Struct, Uint, make_domain, Array

from adapter.settings import DOMAIN_NAME


class Call(EIP712Struct):
    address = Uint(256)
    selector = Uint(256)
    calldata = Array(Uint(256))


class Payload(EIP712Struct):
    nonce = Uint(256)
    maxFee = Uint(256)
    version = Uint(256)
    calls = Array(Call)


adapter_domain = make_domain(name=DOMAIN_NAME, version="1")
