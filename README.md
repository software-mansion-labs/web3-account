# 🐍 web3 to StarkNet json-rpc adapter

# Development setup
## Install dependencies
```
poetry install
yarn --cwd client install
```

## Setup envs
Setup envs as showed in `.env.example`.

## Git hooks
Run this snippet to enable lint checks and automatic formatting before commit/push.
```
cp pre-push ./.git/hooks/
cp pre-commit ./.git/hooks/
chmod +x ./.git/hooks/pre-commit
chmod +x ./.git/hooks/pre-push
```

## Certificates

Metamask support suggesting nodes only with https. Install `mkcert` first.

```
mkcert -key-file key.pem -cert-file cert.pem example.com *.example.com
```

## Running demo
Run dev network & setup contracts:
``
poe devnet --eth_address YOUR_ETH_ADDRESS
``

Run server:
```
po devserver
```

Run client:
```
poe devclient
```

You can run interactive python shell with `account` and `erc20` available: 
```
CAIRO_PATH=./contracts/keccak-cairo/keccak:./contracts/cairo-contracts/ PYTHONPATH=$PWD poetry run python -i contracts/interactive.py ETH_ADDRESS
```


Open `http://localhost:1234/` and click "CONNECT TO METAMASK".