# pylint: disable=invalid-name
import time
from typing import Union

from eth_utils import to_bytes
from fastapi import FastAPI, Request, Response
from jsonrpcserver import Result, Success, async_dispatch, method
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId

from server.app.deserialize import (
    decode_eip712,
    decode_raw_tx,
    simple_signature_to_address,
)
from server.app.erc20 import (
    get_erc20_contract,
    get_prepared_erc20_call,
    call_erc20,
)
from server.app.eth_account import get_eth_account_contract
from server.app.settings import NODE_URL, TOKENS_MAPPING, CHAIN_ID

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
    # Metmask won't fetch statuses of ongoing transactions if block number doesn't change
    # block = await client.get_block()
    # return Success(hex(block["block_number"]))
    return Success(hex(round(time.time())))


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
    print("RECEIVED TRANSACTION", transaction)
    tx = decode_raw_tx(transaction)
    if tx.to:  # erc20 handling, might be removed
        method_id = int.from_bytes(tx.to, "big")
        token = TOKENS_MAPPING[method_id]
        from_address = simple_signature_to_address(
            nonce=tx.nonce,
            gas_price=tx.gas_price,
            gas_limit=tx.gas,
            to=tx.to,
            value=tx.value,
            data=tx.data,
            v=tx.v,
            r=tx.r,
            s=tx.s,
        )
        contract = get_erc20_contract(client, token)
        prepared = get_prepared_erc20_call(contract, tx.data)
        account = get_eth_account_contract(client, from_address)
        invocation = await account.functions["execute"].invoke(
            # TODO: expose contract's address
            # noinspection PyProtectedMember
            # pylint: disable=protected-access
            to=prepared._contract_data.address,
            selector=prepared.selector,
            calldata=prepared.calldata,
            nonce=tx.nonce,
        )
    else:
        decoded = decode_eip712(tx)
        account = get_eth_account_contract(client, decoded.from_address)
        invocation = account.functions["execute"].invoke(
            to=decoded.call_info.address,
            selector=decoded.call_info.selector,
            calldata=decoded.call_info.calldata,
            nonce=decoded.call_info.nonce,
        )

    # TODO: Remove
    await invocation.wait_for_acceptance()

    return Success(invocation.hash)


@method
async def eth_call(call_info, _block_number):
    token = TOKENS_MAPPING[int(call_info["to"], 0)]
    contract = get_erc20_contract(client, token)
    data = to_bytes(call_info["data"])
    result = await call_erc20(contract, data)
    return Success(result.hex())


@method
async def eth_getTransactionCount(address, _block_number):
    contract = get_eth_account_contract(client, address)
    response = await contract.functions["get_nonce"].call()
    result = response[0]
    return Success(hex(result))


@method
async def eth_getTransactionReceipt(hash):
    return Success(
        {
            "transactionHash": hash,
            "transactionIndex": "0x1",
            "blockNumber": hex(round(time.time())),
            "blockHash": "0xc6ef2fc5426d6ad6fd9e2a26abeab0aa2411b7ab17f30a99d3cb96aed1d1055b",
            "cumulativeGasUsed": "0x33bc",
            "gasUsed": "0x4dc",
            "contractAddress": None,
            "logs": [],
            "logsBloom": "0x" + (0).to_bytes(32, "big").hex(),
            "status": "0x1",
        }
    )


app = FastAPI()


@app.post("/")
async def index(request: Request):
    return Response(await async_dispatch(await request.body()))
