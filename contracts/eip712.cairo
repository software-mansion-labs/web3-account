%lang starknet

from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.math import split_felt
from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.keccak import unsafe_keccak
from starkware.cairo.common.bitwise import bitwise_and

func fill_with_uint128{range_check_ptr}(result: felt*, values: felt*, values_len: felt) -> ():
    if values_len == 0:
        return ()
    end

    let (high, low) = split_felt([values])
    assert [result] = high
    assert [result+1] = low
    fill_with_uint128(result + 2, values + 1, values_len - 1)
    return ()
end

func map_to_uint128{range_check_ptr}(values: felt*, values_len: felt) -> (result: felt*):
    alloc_locals
    let (result: felt*) = alloc()
    fill_with_uint128(result, values, values_len)
    return (result)
end

const PREFIX = 0x1901
# Has to be recalculated when type is changed with Payload.type_hash()
const TYPE_HASH_HIGH = 0x71430fb281ccdfae35ad0b5d5279034e
const TYPE_HASH_LOW =   0x04e1e56c77b10d30506aad6cad95206f
# Has to be recalculated when type is changed with adapter_domain.hash_struct()
const DOMAIN_SEP_HIGH = 0x91ad78de7411f710180a9a7d63d190f2
const DOMAIN_SEP_LOW = 0xbb5962361c7beb5df697fb012e216fdd

# value has to be a 16 byte word
# prefix length = PREFIX_BITS
func add_prefix{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value: felt, prefix: felt) -> (result: felt, overflow):
    let shifted_prefix = prefix * 2**128
    # with_prefix is 18 bytes long
    let with_prefix = shifted_prefix + value
    let overflow_mask = 2 ** 16 - 1
    let (overflow) = bitwise_and(with_prefix, overflow_mask)
    let result = (with_prefix - overflow) / 2 ** 16
    return (result, overflow)
end

@external
func get_hash{
        range_check_ptr, bitwise_ptr : BitwiseBuiltin*
    }(
        to: felt,
        selector: felt,
        calldata_len: felt,
        calldata: felt*,
        nonce: felt
    ) -> (hashed_msg: Uint256):
    alloc_locals
    let (calldata_uint128) = map_to_uint128(calldata, calldata_len)

    let (calldata_hash_l, calldata_hash_h) = unsafe_keccak(calldata_uint128, calldata_len * 32)
    # split_felt returns high, low (unlike unsafe_keccak)
    let (nonce_h, nonce_l) = split_felt(nonce)
    let (to_h, to_l) = split_felt(to)
    let (selector_h, selector_l) = split_felt(selector)

    let (encoded_data: felt*) = alloc()
    assert encoded_data[0] = TYPE_HASH_HIGH
    assert encoded_data[1] = TYPE_HASH_LOW
    assert encoded_data[2] = nonce_h
    assert encoded_data[3] = nonce_l
    assert encoded_data[4] = to_h
    assert encoded_data[5] = to_l
    assert encoded_data[6] = selector_h
    assert encoded_data[7] = selector_l
    assert encoded_data[8] = calldata_hash_h
    assert encoded_data[9] = calldata_hash_l
    let (data_hash_l, data_hash_h) = unsafe_keccak(encoded_data, 5 * 32)

    let prefix = PREFIX
    let (w0, prefix) = add_prefix(DOMAIN_SEP_HIGH, prefix)
    let (w1, prefix)= add_prefix(DOMAIN_SEP_LOW, prefix)
    let (w2, prefix)= add_prefix(data_hash_h, prefix)
    let (w3, overflow)= add_prefix(data_hash_l, prefix)
    let (signable_bytes: felt*) = alloc()
    assert signable_bytes[0] = w0
    assert signable_bytes[1] = w1
    assert signable_bytes[2] = w2
    assert signable_bytes[3] = w3
    assert signable_bytes[4] = overflow
    let (low, high) = unsafe_keccak(signable_bytes, 16 + 16 + 16 + 16 + 2)
    let hashed_msg = Uint256(low, high)
    return (hashed_msg)
end