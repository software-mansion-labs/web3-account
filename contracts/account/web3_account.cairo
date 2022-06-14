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
from starkware.cairo.common.cairo_secp.signature import verify_eth_signature_uint256
from starkware.cairo.common.cairo_keccak.keccak import finalize_keccak

from openzeppelin.account.library import (
    Call,
    AccountCallArray,
    Account,
)

from contracts.account.upgrades import Proxy_get_implementation, Proxy_set_implementation
from contracts.account.eip712 import get_hash

# Last 160 bits are used for Ethereum address, 80 bits are used for nonce
@storage_var
func account_state() -> (res : felt):
end

# Nonce shares storage with eth address and chain id, so it has to be shifted by 160 bits
const ETH_ADDRESS_MASK = 2 ** 160 - 1
const NONCE_SHIFT = 2 ** 160
const NONCE_MASK = 2**240 - 1 - ETH_ADDRESS_MASK
const CHAIN_SHIFT = 2 ** 240
const CHAIN_MASK = 2**250 - 1 - NONCE_MASK - ETH_ADDRESS_MASK

const TESTNET_CHAIN_ID = 0x534e5f474f45524c49
const MAINNET_CHAIN_ID = 0x534e5f4d41494e

const COMPRESSED_MAINNET_CHAIN_ID = 0
const COMPRESSED_TESTNET_CHAIN_ID = 1

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

func compressed_chain_id_to_domain_hash(chain_id: felt) -> (domain_hash: Uint256):
    if chain_id == COMPRESSED_TESTNET_CHAIN_ID:
        # low, high
        return (Uint256(0x1315bc26e0a4f976bb3f649475ef6193, 0xdb8ed783e9bc3dbcdb61cf4544b464e2))
    end

    if chain_id == COMPRESSED_MAINNET_CHAIN_ID:
        return (Uint256(0x48b4069472bb322fbeef1215f6aac583, 0xacc9506a403c36e093633648560ab569))
    end

    with_attr error_message("Invalid compressed chain id {chain_id}."):
        assert 1 = 0
    end

    # Never reached
    return (Uint256(0,0))
end

func compress_chain_id(chain_id: felt) -> (compressed_chain_id: felt):
    if chain_id == MAINNET_CHAIN_ID:
        return (COMPRESSED_MAINNET_CHAIN_ID)
    end

    if chain_id == TESTNET_CHAIN_ID:
        return (COMPRESSED_TESTNET_CHAIN_ID)
    end

    with_attr error_message("Invalid chain id {chain_id}."):
        assert 1 = 0
    end

    # Never reached
    return (0)
end

@view
func get_domain_hash{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr, bitwise_ptr : BitwiseBuiltin*}() -> (domain_hash: Uint256):
    alloc_locals
    assert_initialized()

    let (state) = account_state.read()
    let (chain) = bitwise_and(state, CHAIN_MASK)
    let chain = chain / CHAIN_SHIFT
    let (domain_hash) = compressed_chain_id_to_domain_hash(chain)
    return (domain_hash)
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
    chain: felt
):
    alloc_locals

    with_attr error_message("Account already initialized."):
        let (state) = account_state.read()
        assert state = 0
    end

    with_attr error_message("Invalid address length."):
        assert_lt_felt(eth_address, NONCE_SHIFT)
    end

    let (compressed_chain_id) = compress_chain_id(chain)

    let state = eth_address + compressed_chain_id * CHAIN_SHIFT
    account_state.write(state)
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

    let (tx_info) = get_tx_info()

    validate_signature(call_array_len, call_array, calldata, nonce, tx_info.max_fee, tx_info.version)

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

func validate_signature{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr,
        ecdsa_ptr : SignatureBuiltin*, bitwise_ptr : BitwiseBuiltin*
}(
    call_array_len: felt,
    call_array: AccountCallArray*,
    calldata: felt*,
    nonce: felt,
    max_fee: felt,
    version: felt,
):
    alloc_locals

    let (domain_hash) = get_domain_hash()
    let low = domain_hash.low
    let high = domain_hash.high

    let (local keccak_ptr_start) = alloc()
    let keccak_ptr = keccak_ptr_start

    let (hash) = get_hash{keccak_ptr=keccak_ptr}(
        call_array_len,
        call_array,
        calldata,
        nonce,
        max_fee,
        version,
        domain_hash,
    )

    let (signature_len, signature) = get_tx_signature()

    validate_signature_with_hash{keccak_ptr=keccak_ptr}(hash, signature_len, signature)

    finalize_keccak(keccak_ptr_start=keccak_ptr_start, keccak_ptr_end=keccak_ptr)

    return ()
end

func validate_signature_with_hash{
    syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr,
    ecdsa_ptr : SignatureBuiltin*, bitwise_ptr : BitwiseBuiltin*,
    keccak_ptr : felt*
}(hash: Uint256, signature_len: felt, signature: felt*):
    alloc_locals
    with_attr error_message(
        "Invalid signature length. Signature should have exactly 5 elements."
    ):
        assert signature_len = 5
    end

    let v = signature[0]
    let r = Uint256(signature[1], signature[2])
    let s = Uint256(signature[3], signature[4])

    let (stored) = get_eth_address()

    verify_eth_signature_uint256{keccak_ptr=keccak_ptr}(hash, r, s, v, stored)

    return ()
end

@view
func is_valid_signature{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr,
        ecdsa_ptr : SignatureBuiltin*, bitwise_ptr : BitwiseBuiltin*
}(hash: felt, signature_len: felt, signature: felt*):
    alloc_locals

    let (tx_hash_high, tx_hash_low) = split_felt(hash)
    let hash_uint = Uint256(tx_hash_low, tx_hash_high)

    let (stored) = get_eth_address()

    let (local keccak_ptr_start) = alloc()
    let keccak_ptr = keccak_ptr_start

    validate_signature_with_hash{keccak_ptr=keccak_ptr}(hash_uint, signature_len, signature)

    finalize_keccak(keccak_ptr_start=keccak_ptr_start, keccak_ptr_end=keccak_ptr)

    return ()
end
