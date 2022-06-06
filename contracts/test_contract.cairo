%lang starknet

from starkware.starknet.common.syscalls import call_contract, get_caller_address, get_tx_info
from starkware.cairo.common.cairo_keccak.keccak import keccak_uint256s, finalize_keccak, keccak_uint256s_bigend, keccak
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.alloc import alloc


@view
func sum_three_values(v1: felt, v2:felt, v3: felt) -> (res: felt):
    return (v1+v2+v3)
end


@view
func uint256_keccak_view{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(
        values_len: felt,
        values: Uint256*,
    ) -> (res: felt):
    alloc_locals
    let (local keccak_ptr_start) = alloc()
    let keccak_ptr = keccak_ptr_start
    let (res) = keccak_uint256s_bigend{keccak_ptr=keccak_ptr}(1, values)
    #let (res) = keccak_uint256s_bigend{keccak_ptr=keccak_ptr}(3, values)
    #let (res) = keccak{keccak_ptr=keccak_ptr}(values, 66)
    #let (res) = keccak_uint256s_bigend{keccak_ptr=keccak_ptr}(2, values)

    finalize_keccak(keccak_ptr_start=keccak_ptr_start, keccak_ptr_end=keccak_ptr)
    return (1)
end