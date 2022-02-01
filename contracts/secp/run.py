import os
from pathlib import Path
from eth_keys.backends.native import ecdsa
from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId

if __name__ != "__main__":
    raise Exception("Not run as a script")

client = Client(net=os.getenv("NODE_URL"), chain=StarknetChainId.TESTNET)

script = Path("./contracts/secp/secp_contract.cairo").read_text()

contract = Contract.deploy_sync(
    client=client,
    compilation_source=script,
    constructor_args=[],
)

MASK = 2 ** 86 - 1


def to_bi(value):
    d0 = value & MASK
    d1 = (value >> 86) & MASK
    d2 = (value >> 86 >> 86) & MASK
    return {"d0": d0, "d1": d1, "d2": d2}


def from_bi(value):
    SHIFT = 2 ** 86
    return value["d0"] + value["d1"] * SHIFT + value["d2"] * SHIFT * SHIFT


P = 2 ** 256 - 2 ** 32 - 977
A = 0
B = 7

msg_hash = 0x2BF48AEB9AB0166C95A0969EAEDB963360D8D59D9A48386787B52EC6CA2B09CE  # bytes.fromhex("3c11df16eeb44dc701d5aa1a26539b4f2d71041b5bc120972a4e2c4a7df4b01a")
r = 49889939729419846473469178468407042968464043146947480718388333416639839826018  # 115677382432984384345066713111125974432679791672809521250879183357318056459534
s = 25530215217058592092123713048714498634643748819454630745752228645446179086800  # 45162930428700119605207514904164101675117859996116977570288814184482171001451
v = 0 + 27
pk = 0x8266FF26EAB1662A25A01A5AA7CE28AD596B956C435B87A9257AB8A6A8D14E6B074D869A516FEAA0287B07664FDD16EBC7CC43DE2BFCDE5B693A44A5ACC47B54
N = 115792089237316195423570985008687907852837564279074904382605163141518161494337
GX = 55066263022277343669578718895168534326250603453777594175500187360389116729240
GY = 32670510020758816978083085130507043184471273380659243275938904335757337482424
z = 0x3C11DF16EEB44DC701D5AA1A26539B4F2D71041B5BC120972A4E2C4A7DF4B01A


def do_call():
    return contract.functions["calc_eth_address"].call_sync(
        z,
        v - 27,
        r,
        s,
    )


x = r
xcubedaxb = (x * x * x + A * x + B) % P
beta = pow(xcubedaxb, (P + 1) // 4, P)
y = beta if v % 2 ^ beta % 2 else (P - beta)
if (xcubedaxb - y * y) % P != 0 or not (r % N) or not (s % N):
    raise Exception("Invalid signature")

Gz = ecdsa.jacobian_multiply((GX, GY, 1), (N - z) % N)


u1 = -z * pow(r, -1, N) % N
u2 = s * pow(r, -1, N) % N
