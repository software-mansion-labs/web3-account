# Based on Account from OpenZeppelin

%lang starknet
%builtins pedersen range_check ecdsa bitwise

from starkware.cairo.common.registers import get_fp_and_pc
from starkware.starknet.common.syscalls import get_contract_address
from starkware.cairo.common.signature import verify_ecdsa_signature
from starkware.cairo.common.cairo_builtins import HashBuiltin, SignatureBuiltin
from starkware.starknet.common.syscalls import call_contract, get_caller_address, get_tx_signature
from starkware.cairo.common.hash_state import (
    hash_init, hash_finalize, hash_update, hash_update_single
)
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.math import assert_in_range, assert_not_equal, assert_not_zero
from starkware.cairo.common.uint256 import Uint256
from starkware.cairo.common.bitwise import bitwise_and
from contracts.secp.secp_contract import calc_eth_address
from contracts.eip712 import get_hash

struct Message:
    member sender: felt
    member to: felt
    member selector: felt
    member calldata: felt*
    member calldata_size: felt
    member nonce: felt
end

@storage_var
func current_nonce() -> (res: felt):
end

@storage_var
func eth_address() -> (res: felt):
end


@view
func get_nonce{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }() -> (res: felt):
    let (res) = current_nonce.read()
    return (res=res)
end


@constructor
func constructor{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr
    }(_eth_address: felt):
    eth_address.write(_eth_address)
    return()
end


@external
func haha{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr,
        ecdsa_ptr: SignatureBuiltin*,
        bitwise_ptr : BitwiseBuiltin*
    }(
        to: felt,
        selector: felt,
        calldata_len: felt,
        calldata: felt*,
        nonce: felt
    ) -> (hash: Uint256, r: Uint256, s: Uint256):
    alloc_locals
    let (__fp__, _) = get_fp_and_pc()
    let (_address) = get_contract_address()
    let (_current_nonce) = current_nonce.read()
    # validate nonce
    assert _current_nonce = nonce
    local message: Message = Message(
        _address,
        to,
        selector,
        calldata,
        calldata_size=calldata_len,
        _current_nonce
    )
    let (signature_len, signature) = get_tx_signature()
    assert signature_len = 5
    let v = signature[0]
    let r = Uint256(signature[1], signature[2])
    let s = Uint256(signature[3], signature[4])
    let (hash) = get_hash(to, selector, calldata_len, calldata, nonce)
    #let (address) = calc_eth_address(hash, v, r, s)
    #let (stored) = eth_address.read()
    return (hash, r, s)
end

@external
func execute{
        syscall_ptr : felt*,
        pedersen_ptr : HashBuiltin*,
        range_check_ptr,
        ecdsa_ptr: SignatureBuiltin*,
        bitwise_ptr : BitwiseBuiltin*
    }(
        to: felt,
        selector: felt,
        calldata_len: felt,
        calldata: felt*,
        nonce: felt
    ) -> (response_len: felt, response: felt*):
    alloc_locals

    let (__fp__, _) = get_fp_and_pc()
    let (_address) = get_contract_address()
    let (_current_nonce) = current_nonce.read()

    # validate nonce
    assert _current_nonce = nonce

    local message: Message = Message(
        _address,
        to,
        selector,
        calldata,
        calldata_size=calldata_len,
        _current_nonce
    )

    let (signature_len, signature) = get_tx_signature()
    assert signature_len = 5

    let v = signature[0]
    let r = Uint256(signature[1], signature[2])
    let s = Uint256(signature[3], signature[4])
    let (hash) = get_hash(to, selector, calldata_len, calldata, nonce)
    let (address) = calc_eth_address(hash, v, r, s)
    let (stored) = eth_address.read()
    assert stored = address

    # bump nonce
    current_nonce.write(_current_nonce + 1)

    # execute call
    let response = call_contract(
        contract_address=message.to,
        function_selector=message.selector,
        calldata_size=message.calldata_size,
        calldata=message.calldata
    )

    return (response_len=response.retdata_size, response=response.retdata)
end