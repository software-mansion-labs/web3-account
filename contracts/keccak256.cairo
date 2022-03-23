%lang starknet

# fossil
from starknet.lib.keccak import keccak256
from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.bitwise import bitwise_and
from starkware.cairo.common.math import split_felt, unsigned_div_rem, assert_le, assert_in_range
from starkware.cairo.common.math_cmp import is_nn, is_le
from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.pow import pow

func keccak_result_to_uint256(
        r0 : felt, r1 : felt, r2 : felt, r3 : felt) -> (res : Uint256):
    let low = r3 + r2 * 2 ** 64
    let high = r1 + r0 * 2 ** 64

    return (Uint256(low, high))
end

func split_uint256{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(value : Uint256) -> (
        res0 : felt, res1 : felt, res2 : felt, res3 : felt):
    alloc_locals
    local first_mask = 2 ** 64 - 1
    local second_mask = 2 ** 128 - 1 - first_mask
    local second_shift = 2 ** 64

    let (r0) = bitwise_and(value.low, first_mask)

    let (second_masked) = bitwise_and(value.low, second_mask)
    let r1 = second_masked / second_shift

    let (r2) = bitwise_and(value.high, first_mask)

    let (fourth_masked) = bitwise_and(value.high, second_mask)
    let r3 = fourth_masked / second_shift

    return (r0, r1, r2, r3)
end

func split_uint256_array{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(
        values_len : felt, values : Uint256*, result : felt*) -> (res : felt*):
    alloc_locals
    if values_len == 0:
        return (result)
    end

    let value = [values]
    let (r0, r1, r2, r3) = split_uint256(value)

    assert result[0] = r3
    assert result[1] = r2
    assert result[2] = r1
    assert result[3] = r0

    split_uint256_array(values_len - 1, values + 2, result + 4)
    return (result)
end

# Handles additional 2 bytes is were provided
func handle_leftover{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(
        uint256_count : felt, rem_bytes : felt, values : Uint256*, inputs : felt*) -> ():
    alloc_locals
    if rem_bytes == 0:
        return ()
    end

    if rem_bytes != 2:
        assert 1 = 0
    end

    let value = values[uint256_count]
    let target_index = uint256_count * 4
    assert inputs[target_index] = value.low
    return ()
end

# Supports bytes = 32*n + k, where k = 0 or k = 2 and n >= 0
func uint256_keccak{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(
        values : Uint256*, bytes : felt) -> (res : Uint256):
    alloc_locals
    let (uint256_count, rem_bytes) = unsigned_div_rem(bytes, 32)
    let (inputs : felt*) = alloc()
    split_uint256_array(uint256_count, values, inputs)
    handle_leftover(uint256_count, rem_bytes, values, inputs)

    let (local keccak_ptr_start : felt*) = alloc()
    let keccak_ptr = keccak_ptr_start
    let (local output : felt*) = keccak256{keccak_ptr=keccak_ptr}(inputs, bytes)

    let (res) = keccak_result_to_uint256(output[0], output[1], output[2], output[3])
    return (res)
end
