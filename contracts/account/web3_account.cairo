# Based on Account from OpenZeppelin

%lang starknet

from starkware.cairo.common.registers import get_fp_and_pc
from starkware.cairo.common.signature import verify_ecdsa_signature
from starkware.cairo.common.cairo_builtins import HashBuiltin, SignatureBuiltin
from starkware.starknet.common.syscalls import call_contract, get_caller_address, get_contract_address, get_tx_signature, get_tx_info
from starkware.cairo.common.hash_state import (
    hash_init, hash_finalize, hash_update, hash_update_single)
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.math import assert_in_range, assert_not_equal, assert_not_zero, assert_250_bit, assert_lt_felt, split_felt
from starkware.cairo.common.uint256 import Uint256, uint256_check
from starkware.cairo.common.bitwise import bitwise_and
from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.cairo_secp.signature import verify_eth_signature_uint256, recover_public_key, public_key_point_to_eth_address
from starkware.cairo.common.cairo_keccak.keccak import finalize_keccak
from starkware.cairo.common.cairo_secp.bigint import (
    BASE,
    BigInt3,
    UnreducedBigInt3,
    bigint_mul,
    bigint_to_uint256,
    nondet_bigint3,
    uint256_to_bigint,
)

from openzeppelin.account.library import (
    Call,
    AccountCallArray,
    Account,
)

from contracts.account.eip712 import get_hash
from contracts.account.upgrades import Proxy_get_implementation, Proxy_set_implementation

# Last 160 bits are used for Ethereum address, 80 bits are used for nonce
@storage_var
func account_state() -> (res : felt):
end

# Nonce shares storage with eth address and chain id, so it has to be shifted by 160 bits
const ETH_ADDRESS_MASK = 2 ** 160 - 1
const NONCE_SHIFT = 2 ** 160
const NONCE_MASK = 2**240 - 1 - ETH_ADDRESS_MASK

func assert_only_self{
    syscall_ptr: felt*
} () -> ():
    let (self) = get_contract_address()
    let (caller_address) = get_caller_address()
    with_attr error_message("Must be called via execute."):
        assert self = caller_address
    end
    return()
end

@view
func get_eth_address{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*}() -> (address: felt):
    let (state) = account_state.read()
    let (address) = bitwise_and(state, ETH_ADDRESS_MASK)
    return (address)
end

@view
func get_nonce{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*}() -> (nonce : felt):
    let (state) = account_state.read()
    let (nonce) = bitwise_and(state, NONCE_MASK)
    let nonce = nonce / NONCE_SHIFT
    return (nonce)
end

func increment_nonce{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}() -> ():
    let (state) = account_state.read()
    let new_state = state + NONCE_SHIFT

    with_attr error_message("Account state value should be 250 bits."):
        assert_250_bit(new_state)
    end

    account_state.write(new_state)

    return ()
end

@external
func upgrade{
    syscall_ptr: felt*,
    pedersen_ptr: HashBuiltin*,
    range_check_ptr
}(
    implementation: felt
):
    assert_only_self()

    Proxy_set_implementation(implementation)

    return ()
end

@view
func get_implementation{
    syscall_ptr: felt*,
    pedersen_ptr: HashBuiltin*,
    range_check_ptr
}() -> (implementation: felt):
    let (implementation) = Proxy_get_implementation()

    return (implementation)
end


@external
func initializer{
    syscall_ptr: felt*,
    pedersen_ptr: HashBuiltin*,
    range_check_ptr
}(
    eth_address: felt,
):
    alloc_locals

    with_attr error_message("Account already initialized."):
        let (state) = account_state.read()
        assert state = 0
    end

    with_attr error_message("Invalid address length."):
        assert_lt_felt(eth_address, NONCE_SHIFT)
    end

    account_state.write(eth_address)
    return ()
end

@external
func __execute__{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr,
    ecdsa_ptr : SignatureBuiltin*,
    bitwise_ptr : BitwiseBuiltin*
}(
    call_array_len: felt,
    call_array  : AccountCallArray*,
    calldata_len: felt,
    calldata: felt*,
    nonce: felt
) -> (
    response_len : felt,
    response : felt*
):
    alloc_locals

    let (caller) = get_caller_address()

    with_attr error_message("Caller must be external."):
        assert caller = 0
    end

    let (local current_nonce) = get_nonce()

    # validate nonce
    with_attr error_message("Invalid nonce. Received: {nonce}, should be {current_nonce}."):
        assert current_nonce = nonce
    end

    validate_tx_signature()

    # bump nonce
    increment_nonce()

    # execute call
    let (calls : Call*) = alloc()
    Account._from_call_array_to_call(call_array_len, call_array, calldata, calls)
    let calls_len = call_array_len

    let (response : felt*) = alloc()
    let (response_len) = Account._execute_list(calls_len, calls, response)

    return (response_len=response_len, response=response)
end

@view
func is_valid_signature{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr,
        ecdsa_ptr : SignatureBuiltin*, bitwise_ptr : BitwiseBuiltin*
}(hash: felt, signature_len: felt, signature: felt*):
    alloc_locals
    with_attr error_message(
        "Invalid signature length. Signature should have exactly 5 elements."
    ):
        assert signature_len = 5
    end

    let v = signature[0]
    let r = Uint256(signature[1], signature[2])
    let s = Uint256(signature[3], signature[4])


    let (local keccak_ptr_start) = alloc()
    let keccak_ptr = keccak_ptr_start

    let (hash_uint) = get_hash{keccak_ptr=keccak_ptr}(hash, Uint256(1,1))

    let (stored) = get_eth_address()

    let (msg_hash_bigint : BigInt3) = uint256_to_bigint(hash_uint)
    let (r_bigint : BigInt3) = uint256_to_bigint(r)
    let (s_bigint : BigInt3) = uint256_to_bigint(s)
    let (public_key_point) = recover_public_key(msg_hash=msg_hash_bigint, r=r_bigint, s=s_bigint, v=v)
    let (calculated_eth_address) = public_key_point_to_eth_address{keccak_ptr=keccak_ptr}(
        public_key_point=public_key_point
    )
    #verify_eth_signature_uint256{keccak_ptr=keccak_ptr}(hash_uint, r, s, v, stored)
    finalize_keccak(keccak_ptr_start=keccak_ptr_start, keccak_ptr_end=keccak_ptr)

    return ()
end

func validate_tx_signature{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr,
        ecdsa_ptr : SignatureBuiltin*, bitwise_ptr : BitwiseBuiltin*
}():
    alloc_locals
    let (signature_len, signature) = get_tx_signature()
    let (tx_info) = get_tx_info()
    is_valid_signature(tx_info.transaction_hash, signature_len, signature)
    return ()
end