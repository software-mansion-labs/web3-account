
%lang starknet

from starkware.starknet.common.syscalls import delegate_call, get_tx_info
from starkware.cairo.common.cairo_builtins import HashBuiltin
from openzeppelin.upgrades.library import (
    Proxy_implementation_address,
    Proxy_set_implementation,
    Proxy_only_admin
)

#
# State
#

@storage_var
func account_state() -> (res: felt):
end

#
# Constructor
#

@constructor
func constructor{
    syscall_ptr: felt*,
    pedersen_ptr: HashBuiltin*,
    range_check_ptr
}(implementation_address: felt):
    let (tx_info) = get_tx_info()

    Proxy_initializer(proxy_admin=tx_info.account_contract_address)
    Proxy_set_implementation(implementation_address)

    return ()
end

@external
@raw_input
@raw_output
func __default__{
        syscall_ptr: felt*,
        pedersen_ptr: HashBuiltin*,
        range_check_ptr
    }(
        selector: felt,
        calldata_size: felt,
        calldata: felt*
    ) -> (
        retdata_size: felt,
        retdata: felt*
    ):
    let (address) = Proxy_implementation_address.read()

    let (retdata_size: felt, retdata: felt*) = delegate_call(
        contract_address=address,
        function_selector=selector,
        calldata_size=calldata_size,
        calldata=calldata
    )

    return (retdata_size=retdata_size, retdata=retdata)
end
