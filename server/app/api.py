# pylint: disable=invalid-name
from typing import Union

from fastapi import FastAPI, Request, Response
from jsonrpcserver import Result, Success, dispatch, method

from server.app.deserialize import decode_raw_tx
from server.app.starknet import compute_eth_account_address

Block = Union[str, int]


@method
def eth_chainId() -> Result:
    return Success("0xb")


@method
def net_version() -> Result:
    return Success("3")


@method
def eth_blockNumber() -> Result:
    return Success("0x1b4")


@method
def eth_gasPrice() -> Result:
    return Success("0x0")


@method
def eth_getBalance(_address: str, _block: Block) -> Result:
    return Success("0xc94")


@method
def eth_getBlockByNumber(_block: Block, _full: bool) -> Result:
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
def eth_sendRawTransaction(transaction: str) -> str:
    print("RECEIVED TRANSACTION", transaction)
    decoded = decode_raw_tx(transaction)
    print(decoded)
    sn_eth_address = compute_eth_account_address(decoded.from_address)
    print("target address", sn_eth_address)
    # 32 Bytes - the transaction hash, or the zero hash if the transaction is not yet available.
    return Success("0x")


app = FastAPI()


@app.post("/")
async def index(request: Request):
    return Response(dispatch(await request.body()))
