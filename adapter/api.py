# pylint: disable=invalid-name
from typing import Union
import logging

from eth_account._utils.signing import to_standard_v
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from jsonrpcserver import Result, Success, async_dispatch, method
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId

from adapter.deserialize import (
    decode_eip712,
    decode_raw_tx,
)
from adapter.eth_account import get_eth_account_contract
from adapter.settings import NODE_URL, CHAIN_ID

logging.basicConfig(level=logging.DEBUG)

Block = Union[str, int]


client = Client(net=NODE_URL, chain=StarknetChainId.TESTNET)


@method
async def eth_chainId() -> Result:
    return Success(hex(CHAIN_ID))


@method
async def net_version() -> Result:
    return Success("3")


@method
async def eth_blockNumber() -> Result:
    return Success("0x123")


@method
async def eth_gasPrice() -> Result:
    return Success("0x0")


@method
async def eth_getBalance(_address: str, _block: Block) -> Result:
    return Success("0x0")


example_block = {
    "number": "0x1b4",
    "difficulty": "0x4ea3f27bc",
    "extraData": "0x476574682f4c5649562f76312e302e302f6c696e75782f676f312e342e32",
    "gasLimit": "0x1388",
    "gasUsed": "0x0",
    "hash": "0xdc0818cf78f21a8e70579cb46a43643f78291264dda342ae31049421c82d21ae",
    # pylint: disable=line-too-long
    "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "miner": "0xbb7b8287f3f0a933474a79eae42cbca977791171",
    "mixHash": "0x4fffe9ae21f1c9e15207b1f472d5bbdd68c9595d461666602f2be20daf5e7843",
    "nonce": "0x689056015818adbe",
    "parentHash": "0xe99e022112df268087ea7eafaf4790497fd21dbeeb6bd7a1721df161a6657a54",
    "receiptsRoot": "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
    "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
    "size": "0x220",
    "stateRoot": "0xddc8b0234c2e0cad087c8b389aa7ef01f7d79b2570bccb77ce48648aa61c904d",
    "timestamp": "0x55ba467c",
    "totalDifficulty": "0x78ed983323d",
    "transactions": [],
    "transactionsRoot": "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",
    "uncles": [],
}


@method
async def eth_getBlockByNumber(_block: Block, _full: bool) -> Result:
    return Success(example_block)


@method
async def eth_getBlockByHash(_block_hash, _full: bool) -> Result:
    return Success(example_block)


@method
async def eth_sendRawTransaction(transaction: str) -> str:
    tx = decode_raw_tx(transaction)
    decoded = decode_eip712(tx)

    logging.debug("TO %s", decoded.call_info.address)
    logging.debug("CALLDATA %s", decoded.call_info.calldata)
    logging.debug("NONCE %s", decoded.call_info.nonce)
    logging.debug("SELECTOR %s", decoded.call_info.selector)

    account = await get_eth_account_contract(client, decoded.from_address)
    prepared = account.functions["execute"].prepare(
        to=decoded.call_info.address,
        selector=decoded.call_info.selector,
        calldata=decoded.call_info.calldata,
        nonce=decoded.call_info.nonce,
    )
    base = 2 ** 128
    invocation = await prepared.invoke(
        [
            to_standard_v(tx["v"]),
            tx["r"] % base,
            tx["r"] // base,
            tx["s"] % base,
            tx["s"] // base,
        ]
    )

    return Success(invocation.hash)


@method
async def eth_getTransactionCount(address, _block_number):
    contract = get_eth_account_contract(client, address)
    response = await contract.functions["get_nonce"].call()
    result = response[0]
    return Success(hex(result))


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/")
async def index(request: Request):
    return Response(await async_dispatch(await request.body()))
