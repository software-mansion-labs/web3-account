import pytest
from starkware.starknet.testing.objects import StarknetContractCall
from starkware.starknet.testing.starknet import Starknet

from contracts.test_utils import deploy_contract_with_hints, to_uint256

code = """
%lang starknet

from starkware.cairo.common.cairo_builtins import BitwiseBuiltin
from starkware.cairo.common.uint256 import Uint256
from contracts.recover import calc_eth_address, uint256_to_bigint3, ecdsa_raw_recover
from contracts.secp.secp_ec import EcPoint
from contracts.secp.bigint import BigInt3

@view
func ecdsa_raw_recover_view{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(
        hash : Uint256, v : felt, r : Uint256, s : Uint256) -> (key : EcPoint):
    alloc_locals

    let (hash_bigint3) = uint256_to_bigint3(hash)
    let (r_bigint3) = uint256_to_bigint3(r)
    let (s_bigint3) = uint256_to_bigint3(s)
    let (public_key) = ecdsa_raw_recover(hash_bigint3, v, r_bigint3, s_bigint3)

    return (public_key)
end

@view
func calc_eth_address_view{range_check_ptr, bitwise_ptr : BitwiseBuiltin*}(hash: Uint256, v: felt, r: Uint256, s: Uint256) -> (
    address: felt
):
    let (address) = calc_eth_address(hash, v, r, s)
    return (address)
end
"""
MSG_HASH = 0x9be87f5efdc2874778864b9abe695afb383146d14ee12bb461b2d42ec825dc43
R = 91371428948140721292053366927303155729780387242950088058739584932119801737335
S = 10445357150428373527866486749585752345788028030487035436249255629148545670353
V = 1
ADDRESS = 0x7FC37b5571e7128DB2CfA7714eDAA4e9Bedf0883

@pytest.mark.asyncio
async def test_calc_public_key():
    starknet = await Starknet.empty()

    account = await deploy_contract_with_hints(starknet, code, [])

    call = await account.ecdsa_raw_recover_view(
        hash=to_uint256(MSG_HASH),
        v=V,
        r=to_uint256(R),
        s=to_uint256(S),
    ).call()

    info: StarknetContractCall = call.call_info
    print("RECOVER PUBLIC KEY", info.cairo_usage)
    # assert call.result[0] == ADDRESS

@pytest.mark.asyncio
async def test_calc_eth_address():
    starknet = await Starknet.empty()

    account = await deploy_contract_with_hints(starknet, code, [])

    call = await account.calc_eth_address_view(
        hash=to_uint256(MSG_HASH),
        v=V,
        r=to_uint256(R),
        s=to_uint256(S),
    ).call()

    info: StarknetContractCall = call.call_info
    print("RECOVER ETH ADDRESS", info.cairo_usage)
    assert call.result[0] == ADDRESS
