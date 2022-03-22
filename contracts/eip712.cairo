%lang starknet

from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.math import split_felt
from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.bitwise import bitwise_and
from contracts.keccak256 import uint256_keccak
from openzeppelin.account.library import AccountCallArray

func fill_with_uint256{range_check_ptr}(result : Uint256*, values : felt*, values_len : felt) -> ():
    if values_len == 0:
        return ()
    end

    let (high, low) = split_felt([values])
    assert result[0] = Uint256(low, high)
    fill_with_uint256(result + 2, values + 1, values_len - 1)
    return ()
end

func map_to_uint256{range_check_ptr}(values : felt*, values_len : felt) -> (result : Uint256*):
    alloc_locals
    let (result : Uint256*) = alloc()
    fill_with_uint256(result, values, values_len)
    return (result)
end

const PREFIX = 0x1901
# TODO: UPDATE!
# Has to be recalculated when type is changed with Payload.type_hash()
const TYPE_HASH_HIGH = 0x71430fb281ccdfae35ad0b5d5279034e
const TYPE_HASH_LOW = 0x04e1e56c77b10d30506aad6cad95206f

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

func get_call_hash{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(
    to : felt, selector : felt, calldata_len : felt, calldata : felt*
) -> (hash: Uint256):
    alloc_locals
    let (calldata_uint256) = map_to_uint256(calldata, calldata_len)
    let (calldata_hash) = uint256_keccak(calldata_uint256, calldata_len * 32)

    let (encoded_data : Uint256*) = alloc()

    let (to_h, to_l) = split_felt(to)
    assert encoded_data[0] = Uint256(to_l, to_h)
    let (selector_h, selector_l) = split_felt(selector)
    assert encoded_data[1] = Uint256(selector_l, selector_h)
    assert encoded_data[2] = Uint256(calldata_hash.low, calldata_hash.high)
    let (call_hash) = uint256_keccak(encoded_data, 3 * 32)

    return (call_hash)
end

func calls_hash_loop{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(
    results: Uint256*,
    call_index: felt,
    call_array_len: felt,
    call_array: AccountCallArray*,
    calldata: felt*,
) -> ():
   if call_index == call_array_len:
        return ()
   end

   let call_info = call_array[call_index]
   let call_calldata = calldata + call_info.data_offset
   let (hash) = get_call_hash(
        to=call_info.to,
        selector=call_info.selector,
        calldata_len=call_info.data_len,
        calldata=call_calldata,
   )
   assert results[call_index] = hash
   return ()
end


func get_calls_hash{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(
    call_array_len: felt,
    call_array: AccountCallArray*,
    calldata: felt*,
) -> (
    calls_hash: Uint256
):
    alloc_locals
    let (hashes : Uint256*) = alloc()
    calls_hash_loop(
        results=hashes,
        call_index=0,
        call_array_len=call_array_len,
        call_array=call_array,
        calldata=calldata,
    )

    let (calls_hash) = uint256_keccak(hashes, call_array_len * 32)
    return (calls_hash)
end

func get_hash{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(
    call_array_len: felt,
    call_array: AccountCallArray*,
    calldata: felt*,
    nonce: felt,
    max_fee: felt,
    domain_hash: Uint256,
) -> (
    hashed_msg : Uint256
):
    alloc_locals
    let (calls_hash) = get_calls_hash(call_array_len, call_array, calldata)

    let (nonce_h, nonce_l) = split_felt(nonce)
    let (max_fee_h, max_fee_l) = split_felt(max_fee)

    let (encoded_data : Uint256*) = alloc()
    assert encoded_data[0] = Uint256(TYPE_HASH_LOW, TYPE_HASH_HIGH)
    assert encoded_data[1] = Uint256(nonce_l, nonce_h)
    assert encoded_data[2] = Uint256(max_fee_l, max_fee_h)
    assert encoded_data[3] = Uint256(calls_hash.low, calls_hash.high)
    let (data_hash) = uint256_keccak(encoded_data, 4 * 32)

    let prefix = PREFIX
    let (w1, prefix) = add_prefix(domain_hash.high, prefix)
    let (w0, prefix) = add_prefix(domain_hash.low, prefix)
    let (w3, prefix) = add_prefix(data_hash.high, prefix)
    let (w2, overflow) = add_prefix(data_hash.low, prefix)
    let (signable_bytes : Uint256*) = alloc()
    assert signable_bytes[0] = Uint256(w0, w1)
    assert signable_bytes[1] = Uint256(w2, w3)
    assert signable_bytes[2] = Uint256(overflow, 0)
    let (res) = uint256_keccak(signable_bytes, 32 + 32 + 2)
    return (res)
end
