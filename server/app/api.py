# pylint: disable=invalid-name
from typing import Union

from fastapi import FastAPI, Request, Response
from jsonrpcserver import Result, Success, async_dispatch, method
from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId

from server.app.deserialize import decode_eip712, decode_raw_tx, get_simple_signature
from server.app.erc20 import call_erc20, prepare_erc20_invocation
from server.app.settings import NODE_URL, TOKENS_MAPPING
from server.app.starknet import compute_eth_account_address

Block = Union[str, int]

client = Client(net=NODE_URL, chain=StarknetChainId.TESTNET)


@method
async def eth_chainId() -> Result:
    return Success("0xb")


@method
async def net_version() -> Result:
    return Success("3")


import time


@method
async def eth_blockNumber() -> Result:
    # block = await client.get_block()
    # return Success(hex(block["block_number"]))
    return Success(hex(round(time.time())))


@method
async def eth_gasPrice() -> Result:
    return Success("0x0")


@method
async def eth_getBalance(_address: str, _block: Block) -> Result:
    return Success("0xc94")


@method
async def eth_getBlockByNumber(_block: Block, _full: bool) -> Result:
    return Success(
        {
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
    )


@method
async def eth_getBlockByHash(block_hash, _full: bool) -> Result:
    return Success(
        {
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
    )


@method
async def eth_sendRawTransaction(transaction: str) -> str:
    print("RECEIVED TRANSACTION", transaction)
    tx = decode_raw_tx(transaction)
    if tx.to:  # erc20
        method_id = int.from_bytes(tx.to, "big")
        token = TOKENS_MAPPING[method_id]
        from_address = get_simple_signature(
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
        contract = await Contract.from_address(token, client=client)
        prepared = prepare_erc20_invocation(contract, tx.data)
        sn_eth_address = compute_eth_account_address(from_address)
        print("target address", sn_eth_address)
        account = await Contract.from_address(sn_eth_address, client=client)
        print("target calldata", prepared.calldata)
        prepared_invocation = account.functions["execute"].prepare(
            to=prepared._contract_data.address,
            selector=prepared.selector,
            calldata=prepared.calldata,
            nonce=tx.nonce,
        )
        invocation = await prepared_invocation.invoke([0])
        print()
        print(
            {
                "calldata": prepared_invocation.calldata,
            }
        )
        print()
        await invocation.wait_for_acceptance()
        return Success(invocation.hash)
    else:
        decoded = decode_eip712(tx)
        print(decoded)
        sn_eth_address = compute_eth_account_address(decoded.from_address)
        print("target address", sn_eth_address)
        contract = await Contract.from_address(sn_eth_address, client=client)
        prepared = contract.functions["execute"].prepare(
            to=decoded.call_info.address,
            selector=decoded.call_info.selector,
            calldata=decoded.call_info.calldata,
            nonce=decoded.call_info.nonce,
        )
        print("CALLDATA", prepared.calldata)
        result = await prepared.invoke([0])

        print("CALL RESULT", result)

        await result.wait_for_acceptance()

        # 32 Bytes - the transaction hash, or the zero hash if the transaction is not yet available.
        return Success(result.hash)


@method
async def eth_call(call_info, _block_number):
    print(call_info)
    token = TOKENS_MAPPING[int(call_info["to"], 0)]
    contract = await Contract.from_address(token, client=client)
    data = bytes.fromhex(call_info["data"][2:])  # trim 0x
    result = await call_erc20(contract, data)
    return Success("0x" + result.hex())


@method
async def eth_getTransactionCount(address, _block_number):
    contract = await Contract.from_address(
        compute_eth_account_address(address), client=client
    )
    response = await contract.functions["get_nonce"].call()
    result: int = response[0]
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
