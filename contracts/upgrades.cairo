%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin

@storage_var
func Proxy_implementation_address() -> (implementation_address: felt):
end

@event
func Upgraded(implementation: felt):
end

func Proxy_set_implementation{
    syscall_ptr: felt*,
    pedersen_ptr: HashBuiltin*,
    range_check_ptr
}(new_implementation: felt):
    Proxy_implementation_address.write(new_implementation)
    Upgraded.emit(new_implementation)
    return ()
end

func Proxy_get_implementation{
    syscall_ptr: felt*,
    pedersen_ptr: HashBuiltin*,
    range_check_ptr
}() -> (implementation: felt):
    let (implementation) = Proxy_implementation_address.read()

    return (implementation)
end
