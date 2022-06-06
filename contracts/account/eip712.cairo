%lang starknet

from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.math import split_felt
from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.bitwise import bitwise_and
from starkware.cairo.common.cairo_keccak.keccak import keccak_uint256s, keccak_uint256s_bigend, keccak

const PREFIX = 0x1901
# Has to be recalculated when type is changed with Payload.type_hash()
const TYPE_HASH_HIGH = 0x71430fb281ccdfae35ad0b5d5279034e
const TYPE_HASH_LOW = 0x04e1e56c77b10d30506aad6cad95206f
# Has to be recalculated when type is changed with adapter_domain.hash_struct()
const DOMAIN_SEP_HIGH = 0xd986ed154f5666297a4a36c4e72f7a12
const DOMAIN_SEP_LOW = 0xd338e4e6e1e35a9cfc4b4f3cf1778252

# value has to be a 16 byte word
# prefix length = PREFIX_BITS
func add_prefix{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value : felt, prefix : felt) -> (
        result : felt, overflow):
    let shifted_prefix = prefix * 2 ** 128
    # with_prefix is 18 bytes long
    let with_prefix = shifted_prefix + value
    let overflow_mask = 2 ** 16 - 1
    let (overflow) = bitwise_and(with_prefix, overflow_mask)
    let result = (with_prefix - overflow) / 2 ** 16
    return (result, overflow)
end

func get_hash{range_check_ptr,  keccak_ptr: felt*, bitwise_ptr : BitwiseBuiltin*}(tx_hash: felt, domain_hash : Uint256) -> (
        hashed_msg : Uint256):
    alloc_locals

    let (tx_hash_h, tx_hash_l) = split_felt(tx_hash)

    let (encoded_data : Uint256*) = alloc()
    assert encoded_data[0] = Uint256(TYPE_HASH_LOW, TYPE_HASH_HIGH)
    assert encoded_data[1] = Uint256(tx_hash_l, tx_hash_h)
    let (data_hash) = keccak_uint256s_bigend{keccak_ptr=keccak_ptr}(2, encoded_data)

    let prefix = PREFIX
    let (w1, prefix) = add_prefix(domain_hash.high, prefix)
    let (w0, prefix) = add_prefix(domain_hash.low, prefix)
    let (w3, prefix) = add_prefix(data_hash.high, prefix)
    let (w2, overflow) = add_prefix(data_hash.low, prefix)
    let (signable_bytes : Uint256*) = alloc()
    assert signable_bytes[0] = Uint256(w0, w1)
    assert signable_bytes[1] = Uint256(w2, w3)
    assert signable_bytes[2] = Uint256(overflow, 0)
    let (res) = keccak_uint256s_bigend{keccak_ptr=keccak_ptr}(2, signable_bytes)
    return (res)
end