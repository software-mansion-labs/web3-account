# 🐍 web3 to StarkNet json-rpc adapter

# Development setup
## Git hooks
Run this snippet to enable lint checks and automatic formatting before commit/push.
```
cp pre-push ./.git/hooks/
cp pre-commit ./.git/hooks/
chmod +x ./.git/hooks/pre-commit
chmod +x ./.git/hooks/pre-push
```

## Using in metamask
```
poe dev
```

Use new network with url = `http://localhost:8000` and id = `11` (same as returned from `eth_chainId`). 