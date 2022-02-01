%lang starknet
%builtins pedersen range_check ecdsa bitwise

from contracts.secp.secp_ec import EcPoint, ec_mul, ec_add
from contracts.secp.bigint import BigInt3
from contracts.eip712 import get_hash
from contracts.secp.secp_contract import calc_eth_address, ecdsa_raw_recover, ecdsa_raw_recover2
from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256



@external
func get_hash_test{
        range_check_ptr, bitwise_ptr : BitwiseBuiltin*
    }(
        to: felt,
        selector: felt,
        calldata_len: felt,
        calldata: felt*,
        nonce: felt
    ) -> (hashed_msg: Uint256):
    let (result) = get_hash(
        to,
        selector,
        calldata_len,
        calldata,
        nonce,
    )
    return (result)
end

@external
func calc_eth_address_test{
        range_check_ptr, bitwise_ptr : BitwiseBuiltin*
    }(
        hash: Uint256,
        v: felt,
        r: Uint256,
        s: Uint256,
    ) -> (address: felt):
    let (result) = calc_eth_address(
        hash, v, r, s
    )
    return (result)
end

@external
func ecdsa_raw_recover_test{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(hash: BigInt3, v: felt, r: BigInt3, s: BigInt3) -> (
    res: EcPoint
):
    let (pk) = ecdsa_raw_recover(hash, v, r, s)
    return (pk)
end

@external
func ecdsa_raw_recover2_test{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(hash: BigInt3, v: felt, r: BigInt3, s: BigInt3) -> (
    res: EcPoint, u1: BigInt3, u2: BigInt3, first: EcPoint, second: EcPoint
):
    let (res, u1, u2, first, second) = ecdsa_raw_recover2(hash, v, r, s)
    return (res, u1, u2, first, second)
end
