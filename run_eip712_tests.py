import asyncio
import os
from pathlib import Path

from eip712_structs import make_domain
from starknet_py.contract import Contract
from starknet_py.net import Client
from starknet_py.net.models import StarknetChainId

from adapter.app.eip712 import Payload, to_message_hash

if __name__ != "__main__":
    raise Exception("Not run as a script")

print("PAYLOAD TYPE HASH", "0x" + Payload.type_hash().hex())

adapter_domain = make_domain(
    name="Starknet adapter", chainId=int(os.getenv("CHAIN_ID"), 0), version="1"
)

print("DOMAIN SEPARATOR", "0x" + adapter_domain.hash_struct().hex())

client = Client(net=os.getenv("NODE_URL"), chain=StarknetChainId.TESTNET)

script = Path("./contracts/eip712.cairo").read_text()

contract = Contract.deploy_sync(
    client=client,
    compilation_source=script,
    constructor_args=[],
)
get_hash = contract.functions["get_hash"]

nonces = [0, 1, 2123, 414124142543543]
addresses = [
    1,
    0x025D1EA3B6986EDC0F95094CD113596F1B4F18A0C2AB7853009F80CFA443AA1A,
    0x0595087499ABAD6FF3FB9E730E00281CDC7BD7F20EC06F3A04048964479438AF,
]
selectors = [
    0x0595087499ABAD6FF3FB9E730E00281CDC7BD7F20EC06F3A04048964479438AF,
    0x02F501398F1C86AE356CC0A42616658B8A57DBAC129B19C9342705A3235EC30F,
]
calldatas = [[], [1], [1, 2, 3, 4, 5, 6, 7, 8, 9], [2 ** 190, 2 ** 191, 2 ** 191]]


async def run_tests():
    print("RUNNING TESTS")
    i = 0
    for nonce in nonces:
        for address in addresses:
            for selector in selectors:
                for calldata in calldatas:
                    result = (
                        await get_hash.call(
                            **{
                                "to": address,
                                "selector": selector,
                                "calldata": calldata,
                                "nonce": nonce,
                            }
                        ),
                    )
                    expected = int.from_bytes(
                        to_message_hash(
                            nonce=nonce,
                            address=address,
                            selector=selector,
                            calldata=calldata,
                        ),
                        "big",
                    )
                    assert result[0][0] == expected
                    print("DONE", i)
                    i += 1


loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
result = loop.run_until_complete(run_tests())
