import os

from pathlib import Path
import json


def require_env(name):
    value = os.getenv(name)
    assert value, f"Env {name} not provided."
    return value


ACCOUNT_CONTRACT_HASH = int(require_env("ACCOUNT_CONTRACT_HASH"), 0)
ACCOUNT_ADDRESS_SALT = int(require_env("ACCOUNT_ADDRESS_SALT"), 0)
NODE_URL = require_env("NODE_URL")
TOKENS_MAPPING = {
    int(key, 0): int(address, 0)
    for key, address in json.loads(
        Path("./erc20_mapping.json").read_text(encoding="utf-8") or "{}"
    ).items()
}
CHAIN_ID = int(require_env("CHAIN_ID"), 0)
