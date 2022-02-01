import os
from pathlib import Path

from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId
from eth_keys.backends.native import ecdsa

account_script = Path("./contracts/test_contract.cairo").read_text()

client = Client(net=os.getenv("NODE_URL"), chain=StarknetChainId.TESTNET)

MASK = 2 ** 86 - 1


def to_bi(value):
    d0 = value & MASK
    d1 = (value >> 86) & MASK
    d2 = (value >> 86 >> 86) & MASK
    return {"d0": d0, "d1": d1, "d2": d2}


def from_bi(value):
    SHIFT = 2 ** 86
    return value["d0"] + value["d1"] * SHIFT + value["d2"] * SHIFT * SHIFT


data = [
    {
        "hash": 0x2BF48AEB9AB0166C95A0969EAEDB963360D8D59D9A48386787B52EC6CA2B09CE,
        "nonce": 0,
        "r": 49889939729419846473469178468407042968464043146947480718388333416639839826018,
        "s": 25530215217058592092123713048714498634643748819454630745752228645446179086800,
        "v": 0,
        "to": 1163308742098555569960465159468647871770197725574891985116107457341806645109,
        "calldata": [
            831393796364618046884172354791239982701466280696939442457185044076596457944,
            1,
            0,
        ],
        "selector": 232670485425082704932579856502088130646006032362877466777181098476241604910,
        "address": 0x7FC37B5571E7128DB2CFA7714EDAA4E9BEDF0883,
    },
    # {
    #     "hash": 0x3c11df16eeb44dc701d5aa1a26539b4f2d71041b5bc120972a4e2c4a7df4b01a,
    #     "nonce": 0,
    #     "r": 115677382432984384345066713111125974432679791672809521250879183357318056459534,
    #     "s": 45162930428700119605207514904164101675117859996116977570288814184482171001451,
    #     "v": 0,
    #     "to": 1163308742098555569960465159468647871770197725574891985116107457341806645109,
    #     "calldata": [831393796364618046884172354791239982701466280696939442457185044076596457944, 1, 0],
    #     "selector": 232670485425082704932579856502088130646006032362877466777181098476241604910,
    #     "address": 0x7FC37b5571e7128DB2CfA7714eDAA4e9Bedf0883
    # }
]

hash = 0x2BF48AEB9AB0166C95A0969EAEDB963360D8D59D9A48386787B52EC6CA2B09CE  # 0x3c11df16eeb44dc701d5aa1a26539b4f2d71041b5bc120972a4e2c4a7df4b01a #0x2bf48aeb9ab0166c95a0969eaedb963360d8d59d9a48386787b52ec6ca2b09ce
nonce = 0
r = 49889939729419846473469178468407042968464043146947480718388333416639839826018  # 115677382432984384345066713111125974432679791672809521250879183357318056459534 #49889939729419846473469178468407042968464043146947480718388333416639839826018
s = 25530215217058592092123713048714498634643748819454630745752228645446179086800  # 25530215217058592092123713048714498634643748819454630745752228645446179086800
v = 0 + 27
to = 1163308742098555569960465159468647871770197725574891985116107457341806645109
calldata = [
    831393796364618046884172354791239982701466280696939442457185044076596457944,
    1,
    0,
]
selector = 232670485425082704932579856502088130646006032362877466777181098476241604910
address = 0x7FC37B5571E7128DB2CFA7714EDAA4E9BEDF0883

P = 2 ** 256 - 2 ** 32 - 977
N = 115792089237316195423570985008687907852837564279074904382605163141518161494337
A = 0
B = 7

pk = 0x8266FF26EAB1662A25A01A5AA7CE28AD596B956C435B87A9257AB8A6A8D14E6B074D869A516FEAA0287B07664FDD16EBC7CC43DE2BFCDE5B693A44A5ACC47B54
GX = 55066263022277343669578718895168534326250603453777594175500187360389116729240
GY = 32670510020758816978083085130507043184471273380659243275938904335757337482424
G = {"x": GX, "y": GY}

z = hash
x = r
xcubedaxb = (x * x * x + A * x + B) % P
beta = pow(xcubedaxb, (P + 1) // 4, P)
y = beta if v % 2 ^ beta % 2 else (P - beta)
if (xcubedaxb - y * y) % P != 0 or not (r % N) or not (s % N):
    raise Exception("Invalid signature")
Gz = ecdsa.jacobian_multiply((GX, GY, 1), (N - z) % N)
XY = ecdsa.jacobian_multiply((x, y, 1), s)
Qr = ecdsa.jacobian_add(Gz, XY)
Q = ecdsa.jacobian_multiply(Qr, ecdsa.inv(r, N))
raw_public_key = ecdsa.from_jacobian(Q)
print("RAW KEY", "0x" + ecdsa.encode_raw_public_key(raw_public_key).hex())
#
# for case in data:
#     z = case["hash"]
#     # assert case["hash"] == contract.functions["get_hash_test"].call_sync(case["to"], case["selector"], case["calldata"], case["nonce"])[0]
#     print("PUBLIC KEY",  contract.functions["ecdsa_raw_recover_test"].call_sync(
#         to_bi(case["hash"]),
#         case["v"],
#         to_bi(case["r"]),
#         to_bi(case["s"]))[0]ś
#     )
#     print("ADDRESS",  contract.functions["calc_eth_address_test"].call_sync(case["hash"], case["v"], case["r"], case["s"])[0])

# G x u1 = 4894531689826781044583723188027109040056273815818778255474067220875961385954

u1 = -z * pow(r, -1, N) % N


u2 = s * pow(r, -1, N) % N
calculated = ecdsa.ecdsa_raw_recover(hash.to_bytes(32, "big"), (v - 27, r, s)).hex()


print("CALC", calculated)
assert hex(pk) == "0x" + calculated


contract = Contract.deploy_sync(
    client=client,
    compilation_source=account_script,
    constructor_args=[],
)


def raw_call():
    return contract.functions["ecdsa_raw_recover2_test"].call_sync(
        to_bi(hash), v - 27, to_bi(r), to_bi(s)
    )
