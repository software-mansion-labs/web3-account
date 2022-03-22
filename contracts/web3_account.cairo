# Based on Account from OpenZeppelin

%lang starknet

from starkware.cairo.common.registers import get_fp_and_pc
from starkware.starknet.common.syscalls import get_contract_address
from starkware.cairo.common.signature import verify_ecdsa_signature
from starkware.cairo.common.cairo_builtins import HashBuiltin, SignatureBuiltin
from starkware.starknet.common.syscalls import call_contract, get_caller_address, get_tx_signature
from starkware.cairo.common.hash_state import (
    hash_init, hash_finalize, hash_update, hash_update_single)
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.math import assert_in_range, assert_not_equal, assert_not_zero, assert_250_bit, assert_lt_felt
from starkware.cairo.common.uint256 import Uint256, uint256_check
from starkware.cairo.common.bitwise import bitwise_and
from contracts.recover import calc_eth_address
from contracts.eip712 import get_hash

struct Message:
    member sender : felt
    member to : felt
    member selector : felt
    member calldata : felt*
    member calldata_size : felt
    member nonce : felt
end

# Last 160 bits are used for Ethereum address, 90 bits are used for nonce
@storage_var
func account_state() -> (res : felt):
end

@storage_var
func domain() -> (hash : Uint256):
end

# Nonce shares storage with eth address, so it has to be shifted by 160 bits
const NONCE_UNIT = 2 ** 160
const ETH_ADDRESS_MASK = 2 ** 160 - 1
const NONCE_MASK = 2**250 - 1 - ETH_ADDRESS_MASK

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
    let nonce = nonce / NONCE_UNIT
    return (nonce)
end

func increment_nonce{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}() -> ():
    let (state) = account_state.read()
    let new_state = state + NONCE_UNIT

    with_attr error_message(
            "Account state value should be 250 bits."):
        assert_250_bit(new_state)
    end

    account_state.write(new_state)

    return ()
end

@constructor
func constructor{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(eth_address : felt, domain_hash : Uint256):
    with_attr error_message(
            "Invalid address length."):
        assert_lt_felt(eth_address, NONCE_UNIT)
    end

    with_attr error_message(
            "Invalid domain hash value."):
        uint256_check(domain_hash)
    end

    account_state.write(eth_address)
    domain.write(domain_hash)
    return ()
end

@external
func execute{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr,
        ecdsa_ptr : SignatureBuiltin*, bitwise_ptr : BitwiseBuiltin*}(
        to : felt, selector : felt, calldata_len : felt, calldata : felt*, nonce : felt) -> (
        response_len : felt, response : felt*):
    alloc_locals

    let (_address) = get_contract_address()
    let (current_nonce) = get_nonce()

    # validate nonce
    with_attr error_message(
            "Invalid nonce. Received: {nonce}, should be {current_nonce}"):
        assert current_nonce = nonce
    end

    local message : Message = Message(
        _address,
        to,
        selector,
        calldata,
        calldata_size=calldata_len,
        current_nonce
    )

    validate_signature(message)

    # bump nonce
    increment_nonce()

    # execute call
    let response = call_contract(
        contract_address=message.to,
        function_selector=message.selector,
        calldata_size=message.calldata_size,
        calldata=message.calldata
    )

    return (response_len=response.retdata_size, response=response.retdata)
end

func validate_signature{
        syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr,
        ecdsa_ptr : SignatureBuiltin*, bitwise_ptr : BitwiseBuiltin*
}(message : Message) -> ():
    alloc_locals
    let (signature_len, signature) = get_tx_signature()
    let (domain_hash) = domain.read()
    
    with_attr error_message(
            "Invalid signature length. Signature should have exactly 5 elements."):
        assert signature_len = 5
    end

    let v = signature[0]
    let r = Uint256(signature[1], signature[2])
    let s = Uint256(signature[3], signature[4])
    let (hash) = get_hash(
        message.to, message.selector, message.calldata_size, message.calldata, message.nonce, domain_hash
    )
    let (address) = calc_eth_address(hash, v, r, s)
    let (stored) = get_eth_address()
    
    with_attr error_message(
            "Decoded address does not match expected address. Decoded: ${address}, expected: {stored}."):
        assert stored = address
    end

    return ()
end
