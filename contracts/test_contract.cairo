%lang starknet

from starkware.starknet.common.syscalls import call_contract, get_caller_address, get_tx_info


@view
func sum_three_values(v1: felt, v2:felt, v3: felt) -> (res: felt):
    return (v1+v2+v3)
end