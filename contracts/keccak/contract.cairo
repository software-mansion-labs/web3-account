%lang starknet

from keccak import finalize_keccak, keccak
from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.bitwise import bitwise_and
from starkware.cairo.common.keccak import unsafe_keccak
from starkware.cairo.common.math import split_felt
from starkware.cairo.common.uint256 import Uint256


@view
func to_integers{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value) -> (res0 : felt, res1 : felt, res2 : felt, res3 : felt):
    alloc_locals
    local first_mask = 2 ** 64 - 1
    # No shift needed
    let (r0) = bitwise_and(value, first_mask)

    local second_mask = 2 ** 128 - 1 - first_mask
    let (second_masked) = bitwise_and(value, second_mask)
    local second_shift = 2 ** 64
    let r1 = second_masked / second_shift

    local third_mask = 2 ** 192 - 1 - second_mask - first_mask
    let (third_masked) = bitwise_and(value, third_mask)
    local third_shift = 2 ** 128
    let r2 = third_masked / third_shift

    # Felt doesn't contain 256 bits, so it is not so easy to create a mask, but we can simply substract the
    # whole rest
    let fourth_masked = value - third_masked - second_masked - r0
    local fourth_shift = 2 ** 192
    let r3 = fourth_masked  / fourth_shift

    return (r0,r1,r2,r3)
end

func pow(base, power) -> (result: felt):
    if power == 0:
        return (1)
    end
        let (result) = pow(base, power-1)
        return (result*base)
end

func mask{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value, byte_index, bytes_len) -> (result: felt):
    alloc_locals

    tempvar bits = bytes_len * 8
    if byte_index == 0:
        let (mask) = pow(2, bits)
        let mask = mask - 1
        let (result) = bitwise_and(value, mask)
        return (result)
    end

    tempvar start_bit = byte_index * 8
    tempvar end_bit = start_bit + bits

    # mask = 2 ^ (end_bit) - 2 ^ (start_bit)
    let (mask_sub) = pow(2, start_bit)
    let (mask) = pow(2, end_bit)
    let mask = mask - mask_sub

    let (result) = bitwise_and(value, mask)
    return (result)
end

func move_left{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value, byte_index, bytes) -> (result: felt):
    alloc_locals
    let (masked) = mask(value, byte_index, 1)
    local masked = masked
    let (shift) = pow(2, bytes*8)
    let shifted = masked * shift
    return (shifted)
end

func move_right{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value, byte_index, bytes) -> (result: felt):
    alloc_locals
    let (masked) = mask(value, byte_index, 1)
    local masked = masked
    let (shift) = pow(2, bytes*8)
    let shifted = masked / shift
    return (shifted)
end

@view
func to_little_endian{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value: felt) -> (result: felt):
    alloc_locals
    let (l0) = move_left(value, 0, 7)
    local l0 = l0
    let (l1) = move_left(value, 1, 5)
    local l1 = l1
    let (l2) = move_left(value, 2, 3)
    local l2 = l2
    let (l3) = move_left(value, 3, 1)
    local l3 = l3
    let (l4) = move_right(value, 4, 1)
    local l4 = l4
    let (l5) = move_right(value, 5, 3)
    local l5 = l5
    let (l6) = move_right(value, 6, 5)
    local l6 = l6
    let (l7) = move_right(value, 7, 7)
    local l7 = l7
    let result = l0 + l1 + l2 + l3 + l4 + l5 + l6 + l7
    return (result)
end

@view
func felt_keccak{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value: felt) -> (r0 : felt, r1 : felt, r2 : felt, r3 : felt):
    alloc_locals
    let (r0,r1,r2,r3) = to_integers(value)

    let (inputs: felt*) = alloc()
    let (le0) = to_little_endian(r0)
    let (le1) = to_little_endian(r1)
    let (le2) = to_little_endian(r2)
    let (le3) = to_little_endian(r3)
    assert inputs[0] = le3
    assert inputs[1] = le2
    assert inputs[2] = le1
    assert inputs[3] = le0

    let (local keccak_ptr_start : felt*) = alloc()
    let keccak_ptr = keccak_ptr_start

    let (local output : felt*) = keccak{keccak_ptr=keccak_ptr}(inputs, 32)
    finalize_keccak(keccak_ptr_start=keccak_ptr_start, keccak_ptr_end=keccak_ptr)
    return (output[0], output[1], output[2], output[3])
end

func to_16_integers{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value) -> (low: felt, high: felt):
    alloc_locals
    local first_mask = 2 ** 128 - 1
    # No shift needed
    let (low) = bitwise_and(value, first_mask)

    let second_masked = value - low
    local fourth_shift = 2 ** 128
    let high = second_masked  / fourth_shift

    return (low, high)
end

@view
func keckec{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value: felt) -> (low: felt, high: felt):
    alloc_locals
    local range_check_ptr = range_check_ptr
    let (inputs: felt*) = alloc()
    let (high, low) = split_felt(value)
    assert inputs[0] = high
    assert inputs[1] = low
    let (low, high) = unsafe_keccak(inputs, 32)
    return (low, high)
end

func fill_with_felts(result: felt*, values: Uint256*, values_len: felt) -> ():
    alloc_locals
    if values_len == 0:
        return ()
    end

    let value = values[0]
    let high = value.high
    let low = value.low
    assert result[0] = high
    assert result[1] = low
    fill_with_felts(result + 2, values + 2, values_len - 1)
    return ()
end

func fill_with_uint256{range_check_ptr}(result: Uint256*, values: felt*, values_len: felt) -> ():
    if values_len == 0:
        return ()
    end

    let (value) = to_uint256([values])
    assert [result] = value
    fill_with_uint256(result + 2, values + 1, values_len - 1)
    return ()
end


func map_felts_to_uint256{range_check_ptr}(values: felt*, values_len: felt) -> (arr: Uint256*):
    alloc_locals
    let (inputs: Uint256*) = alloc()
    fill_with_uint256(inputs, values, values_len)
    return (inputs)
end

func to_uint256{range_check_ptr}(value: felt) -> (value: Uint256):
    let (high, low) = split_felt(value)
    return (Uint256(low, high))
end

func keccak_data(values: Uint256*, values_len: felt) -> (result: Uint256):
    alloc_locals
    let bytes = values_len * 32
    let (inputs: felt*) = alloc()
    fill_with_felts(inputs, values, values_len)
    let (low, high) = unsafe_keccak(inputs, bytes)
    return (Uint256(low, high))
end

@view
func keccak_data_view{range_check_ptr}(values_len: felt, values: felt*) -> (result: Uint256):
    alloc_locals
    let (inputs: Uint256*) = alloc()
    fill_with_uint256(inputs, values, values_len)
    let (result) = keccak_data(inputs, values_len)
    return (result)
end

@view
func to_uint256_view{range_check_ptr}(values_len: felt, values: felt*) -> (r0: Uint256, r1: Uint256):
    alloc_locals
    let (inputs: Uint256*) = alloc()
    fill_with_uint256(inputs, values, values_len)
    return (inputs[0], inputs[1])
end


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
const TYPE_HASH_HIGH = 0x71430fb281ccdfae35ad0b5d5279034e
const TYPE_HASH_LOW =   0x04e1e56c77b10d30506aad6cad95206f
const DOMAIN_SEP_HIGH = 0x91ad78de7411f710180a9a7d63d190f2
const DOMAIN_SEP_LOW = 0xbb5962361c7beb5df697fb012e216fdd

# value has to be a 16 byte word
# prefix length = PREFIX_BITS
func add_prefix{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value: felt, prefix: felt) -> (result: felt, overflow):
    let shifted_prefix = prefix * 2**128
    # Result is 18 bytes long
    # 0x0x1901XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
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

# Computes the keccak hash of the given input (up to 127 bytes).
# input should consist of a list of 64-bit integers (each representing 8 bytes, in little endian).
# n_bytes should be the number of input bytes (for example, it should be between 8*input_len - 7 and
# 8*input_len).
@view
func compute_keccak{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(
        input_len : felt, input : felt*, n_bytes : felt) -> (
        res0 : felt, res1 : felt, res2 : felt, res3 : felt):
    alloc_locals

    let (local keccak_ptr_start : felt*) = alloc()
    let keccak_ptr = keccak_ptr_start

    let (local output : felt*) = keccak{keccak_ptr=keccak_ptr}(input, n_bytes)
    finalize_keccak(keccak_ptr_start=keccak_ptr_start, keccak_ptr_end=keccak_ptr)

    return (output[0], output[1], output[2], output[3])
end
