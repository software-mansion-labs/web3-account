# pylint: skip-file
from dataclasses import dataclass
from typing import Optional

import rlp
from eth_account._utils.signing import to_standard_v
from eth_keys.datatypes import Signature
from eth_typing import HexStr
from eth_utils import keccak, to_bytes
from hexbytes import HexBytes
from rlp.sedes import Binary, big_endian_int, binary
from web3 import Web3
from web3.auto import w3


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


@dataclass
class DecodedTx:
    hash_tx: str
    from_: str
    to: Optional[str]
    nonce: int
    gas: int
    gas_price: int
    value: int
    data: str
    chain_id: int
    r: str
    s: str
    v: int


def hex_to_bytes(data: str) -> bytes:
    return to_bytes(hexstr=HexStr(data))


def decode_raw_tx(raw_tx: str):
    tx = rlp.decode(hex_to_bytes(raw_tx), Transaction)
    hash_tx = Web3.toHex(keccak(hex_to_bytes(raw_tx)))
    hash = HexBytes(keccak(tx.data))
    from_address = (
        Signature(vrs=(to_standard_v(tx.v), tx.r, tx.s))
        .recover_public_key_from_msg_hash(hash)
        .to_checksum_address()
    )
    to = w3.toChecksumAddress(tx.to) if tx.to else None
    data = w3.toHex(tx.data)
    r = hex(tx.r)
    s = hex(tx.s)
    chain_id = (tx.v - 35) // 2 if tx.v % 2 else (tx.v - 36) // 2

    return DecodedTx(
        hash_tx,
        from_address,
        to,
        tx.nonce,
        tx.gas,
        tx.gas_price,
        tx.value,
        data,
        chain_id,
        r,
        s,
        tx.v,
    )
