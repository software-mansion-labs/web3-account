# 🐍 StarknNet web3 account

# Development setup
## Clone deps with submodules
```
git clone --recurse-submodules git@github.com:software-mansion-labs/starknet-web3-rpc-adapter.git 
```

## Install dependencies
```
poetry install
yarn --cwd client install
yarn --cwd starknet-web3-account install
yarn --cwd starknet-web3-account build
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

## Running demo
In separate terminals start required services.

Dev network & setup contracts:
``
poe devnet
``

Run client:
```
poe devclient
```