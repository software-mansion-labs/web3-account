# Based on Account from OpenZeppelin

%lang starknet

from starkware.cairo.common.registers import get_fp_and_pc
from starkware.starknet.common.syscalls import get_contract_address
from starkware.cairo.common.signature import verify_ecdsa_signature
from starkware.cairo.common.cairo_builtins import HashBuiltin, SignatureBuiltin
from starkware.starknet.common.syscalls import call_contract, get_caller_address, get_tx_signature, get_tx_info
from starkware.cairo.common.hash_state import (
    hash_init, hash_finalize, hash_update, hash_update_single)
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.math import assert_in_range, assert_not_equal, assert_not_zero, assert_250_bit, assert_lt_felt, split_felt
from starkware.cairo.common.uint256 import Uint256, uint256_check
from starkware.cairo.common.bitwise import bitwise_and
from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.cairo_secp.signature import verify_eth_signature_uint256

from openzeppelin.account.library import (
    Call,
    AccountCallArray,
    from_call_array_to_call,
    MultiCall,
    execute_list,
)

from openzeppelin.upgrades.library import (
    Proxy_initialized,
    Proxy_initializer,
)

# Last 160 bits are used for Ethereum address, 80 bits are used for nonce
@storage_var
func account_state() -> (res : felt):
end

# Nonce shares storage with eth address and chain id, so it has to be shifted by 160 bits
const ETH_ADDRESS_MASK = 2 ** 160 - 1
const NONCE_SHIFT = 2 ** 160
const NONCE_MASK = 2**240 - 1 - ETH_ADDRESS_MASK

func assert_initialized{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr 
}():
    with_attr error_message(
            "Account not initialized."):
        let (state) = account_state.read()
        assert_not_zero(state)
    end
    return ()
end

@view
func get_eth_address{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*}() -> (address: felt):
    assert_initialized()

    let (state) = account_state.read()
    let (address) = bitwise_and(state, ETH_ADDRESS_MASK)
    return (address)
end

@view
func get_nonce{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*}() -> (nonce : felt):
    assert_initialized()

    let (state) = account_state.read()
    let (nonce) = bitwise_and(state, NONCE_MASK)
    let nonce = nonce / NONCE_SHIFT
    return (nonce)
end

func increment_nonce{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}() -> ():
    assert_initialized()

    let (state) = account_state.read()
    let new_state = state + NONCE_SHIFT

    with_attr error_message(
            "Account state value should be 250 bits."):
        assert_250_bit(new_state)
    end

    account_state.write(new_state)

    return ()
end

@external
func initializer{
    syscall_ptr: felt*,
    pedersen_ptr: HashBuiltin*,
    range_check_ptr
}(
    proxy_admin: felt,
    eth_address: felt,
    chain: felt
):
    alloc_locals

    with_attr error_message(
            "Invalid address length."):
        assert_lt_felt(eth_address, NONCE_SHIFT)
    end

    tempvar range_check_ptr = range_check_ptr

    Proxy_initializer(proxy_admin)

    account_state.write(eth_address)
    return ()
end

@external
func __execute__{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr,
    ecdsa_ptr : SignatureBuiltin*,
    bitwise_ptr : BitwiseBuiltin*,
}(
    call_array_len: felt,
    call_array: AccountCallArray*,
    calldata_len: felt,
    calldata: felt*,
    nonce: felt
) -> (
    response_len : felt,
    response : felt*
):
    alloc_locals

    let (current_nonce) = get_nonce()

    # validate nonce
    with_attr error_message(
            "Invalid nonce. Received: {nonce}, should be {current_nonce}"):
        assert current_nonce = nonce
    end

    validate_signature()

    # bump nonce
    increment_nonce()

    # execute call
    let (calls : Call*) = alloc()
    from_call_array_to_call(call_array_len, call_array, calldata, calls)
    let calls_len = call_array_len

    let (tx_info) = get_tx_info()

    local multicall: MultiCall = MultiCall(
        tx_info.account_contract_address,
        calls_len,
        calls,
        nonce,
        tx_info.max_fee,
        tx_info.version
    )
    let (response : felt*) = alloc()
    let (response_len) = execute_list(multicall.calls_len, multicall.calls, response)

    return (response_len=response_len, response=response)
end

func validate_signature{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr,
        ecdsa_ptr : SignatureBuiltin*, bitwise_ptr : BitwiseBuiltin*
}() -> ():
    alloc_locals
    let (signature_len, signature) = get_tx_signature()
    let (tx_info) = get_tx_info()

    with_attr error_message(
        "Invalid signature length. Signature should have exactly 5 elements."
    ):
        assert signature_len = 5
    end

    let v = signature[0]
    let r = Uint256(signature[1], signature[2])
    let s = Uint256(signature[3], signature[4])

    let (tx_hash_high, tx_hash_low) = split_felt(tx_info.transaction_hash)
    let hash_uint = Uint256(tx_hash_low, tx_hash_high)

    let (stored) = get_eth_address()

    let (keccak_ptr: felt*) = alloc()

    with keccak_ptr:
        verify_eth_signature_uint256(hash_uint, r, s, v, stored)
    end

    return ()
end
