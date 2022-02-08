eth_account_abi = [
    {
        "inputs": [],
        "name": "get_nonce",
        "outputs": [{"name": "res", "type": "felt"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "_eth_address", "type": "felt"}],
        "name": "constructor",
        "outputs": [],
        "type": "constructor",
    },
    {
        "inputs": [
            {"name": "to", "type": "felt"},
            {"name": "selector", "type": "felt"},
            {"name": "calldata_len", "type": "felt"},
            {"name": "calldata", "type": "felt*"},
            {"name": "nonce", "type": "felt"},
        ],
        "name": "execute",
        "outputs": [
            {"name": "response_len", "type": "felt"},
            {"name": "response", "type": "felt*"},
        ],
        "type": "function",
    },
    {
        "inputs": [
            {"name": "to", "type": "felt"},
            {"name": "selector", "type": "felt"},
            {"name": "calldata_len", "type": "felt"},
            {"name": "calldata", "type": "felt*"},
            {"name": "nonce", "type": "felt"},
        ],
        "name": "haha",
        "outputs": [
            {"name": "response_len", "type": "felt"},
            {"name": "response", "type": "felt*"},
        ],
        "type": "function",
    },
]
