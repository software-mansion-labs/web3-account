# 🐍 web3 to StarkNet json-rpc adapter

# Development setup
## Clone deps with submodules
```
git clone --recurse-submodules git@github.com:software-mansion-labs/starknet-web3-rpc-adapter.git 
```

## Install dependencies
```
poetry install
yarn --cwd client install
```

## Setup envs
Setup envs as showed in `.env.example`, for instance using direnv.

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
In separate terminals start required services:

Dev network & setup contracts:
``
poe devnet --eth_address YOUR_ETH_ADDRESS
``

Run server:
```
po devserver
```

Run client:
```
poe devdemo
```

You can run interactive python shell with `account` and `erc20` available: 
```
CAIRO_PATH=./contracts/keccak-cairo/keccak:./contracts/cairo-contracts/ PYTHONPATH=$PWD poetry run python -i contracts/interactive.py ETH_ADDRESS
```


Open `http://localhost:1234/` and click "CONNECT TO METAMASK".