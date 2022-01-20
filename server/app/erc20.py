import dataclasses
from typing import List, Tuple

from eth_abi import decode_abi, encode_single
from eth_utils import keccak
from hexbytes import HexBytes
from starknet_py.cairo.felt import decode_shortstring
from starknet_py.contract import Contract, PreparedFunctionCall
from starknet_py.net import Client

from server.app.erc_20_abi import erc_20_abi
from server.app.eth_account import compute_eth_account_address


def get_erc20_contract(client: Client, address: str) -> Contract:
    return Contract(address=address, client=client, abi=erc_20_abi)


@dataclasses.dataclass
class Param:
    name: str
    type: str


@dataclasses.dataclass
class ContractMethod:
    name: str
    params: List[Param]
    result_type: str


eth_methods = [
    ContractMethod("name", [], "string"),
    ContractMethod("symbol", [], "string"),
    ContractMethod("decimals", [], "uint8"),
    ContractMethod("totalSupply", [], "uint256"),
    ContractMethod("balanceOf", [Param("_owner", "address")], "uint256"),
    ContractMethod(
        "transfer", [Param("_to", "address"), Param("_value", "uint256")], "bool"
    ),
    ContractMethod(
        "transferFrom",
        [
            Param("_from", "address"),
            Param("_to", "address"),
            Param("_value", "uint256"),
        ],
        "bool",
    ),
    ContractMethod(
        "approve", [Param("_spender", "address"), Param("_value", "uint256")], "bool"
    ),
    ContractMethod(
        "allowance",
        [Param("_owner", "address"), Param("_spender", "address")],
        "uint256",
    ),
]


# https://docs.soliditylang.org/en/latest/abi-spec.html#examples
def make_method_id(method: ContractMethod) -> bytes:
    signature = f"{method.name}({','.join(p.type for p in method.params)})"
    return keccak(text=signature)[:4]


method_by_id = {make_method_id(method): method for method in eth_methods}

SUPPORTED_TYPES = ("address", "uint256", "uint8", "string", "bool")


def decoded_to_sdk(param, value):
    if param.type not in SUPPORTED_TYPES:
        raise ValueError(f"{param.type} is not supported.")

    if param.type == "address":
        return compute_eth_account_address(value)
    if param.type == "bool":
        return 1 if value else 0

    # All others are handled by sdk (like translating integers to uint256)
    return value


def get_args(method: ContractMethod, data: bytes) -> list:
    decoded = decode_abi([p.type for p in method.params], data)
    return [
        decoded_to_sdk(param, value) for param, value in zip(method.params, decoded)
    ]


def get_method(method_id: bytes) -> ContractMethod:
    if method_id not in method_by_id:
        raise Exception(f"Method id {method_id} not found.")

    return method_by_id[method_id]


def get_method_with_args(data: bytes) -> Tuple[ContractMethod, list]:
    method_id, encoded_args = data[:4], data[4:]
    method = get_method(method_id)
    args = get_args(method, encoded_args)
    return method, args


def get_prepared_erc20_call(contract: Contract, data: bytes) -> PreparedFunctionCall:
    method, args = get_method_with_args(data)
    return contract.functions[method.name].prepare(*args)


async def call_erc20(contract: Contract, data: bytes) -> HexBytes:
    method, args = get_method_with_args(data)
    response = await contract.functions[method.name].call(*args)
    result = response[0]

    if method.result_type == "string":
        result = decode_shortstring(result)
    return HexBytes(encode_single(method.result_type, result))
