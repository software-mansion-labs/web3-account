# pylint: skip-file
from dataclasses import dataclass
from typing import List, NamedTuple, Any

import rlp
from eth_account._utils.signing import to_standard_v
from eth_keys.datatypes import Signature
from eth_typing import HexStr
from eth_utils import to_bytes
from hexbytes import HexBytes
from rlp.sedes import Binary, big_endian_int, binary

from eip712 import to_message_hash


class Transaction(rlp.Serializable):
    fields = [
        ("nonce", big_endian_int),
        ("gas_price", big_endian_int),
        ("gas", big_endian_int),
        ("to", Binary.fixed_length(20, allow_empty=True)),
        ("value", big_endian_int),
        ("data", binary),
        ("v", big_endian_int),
        ("r", big_endian_int),
        ("s", big_endian_int),
    ]


class StarknetCallInfo(NamedTuple):
    nonce: int
    address: int
    selector: int
    calldata: List[int]


@dataclass
class DecodedTx:
    call_info: StarknetCallInfo
    from_address: str
    nonce: str


def hex_to_bytes(data: str) -> bytes:
    return to_bytes(hexstr=HexStr(data))


def get_data(nonce: int, value: bytes) -> StarknetCallInfo:
    parsed = []
    for i in range(0, len(value), 32):
        parsed.append(int.from_bytes(value[i : i + 32], "big"))

    return StarknetCallInfo(nonce, parsed[0], parsed[1], parsed[2:])


def decode_raw_tx(raw_tx: str) -> Any:
    return rlp.decode(hex_to_bytes(raw_tx), Transaction)


def decode_eip712(tx: Transaction):
    data = get_data(tx.nonce, tx.data)

    hash = HexBytes(
        to_message_hash(
            nonce=data.nonce,
            address=data.address,
            selector=data.selector,
            calldata=data.calldata,
        )
    )
    public_key = Signature(
        vrs=(to_standard_v(tx.v), tx.r, tx.s)
    ).recover_public_key_from_msg_hash(hash)
    print("MSG HASH", hash.hex())
    print("PUBLIC KEY", public_key.to_hex())
    print("NONCE", tx.nonce)
    print("R", tx.r)
    print("S", tx.s)
    print("V", to_standard_v(tx.v))
    from_address = (
        Signature(vrs=(to_standard_v(tx.v), tx.r, tx.s))
        .recover_public_key_from_msg_hash(hash)
        .to_checksum_address()
    )
    data = get_data(tx.nonce, tx.data)

    return DecodedTx(
        call_info=data,
        from_address=from_address,
        nonce=tx.nonce,
    )
