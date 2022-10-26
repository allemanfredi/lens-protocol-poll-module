# lens-protocol-poll-module (work in progress)

Simple Lens Protocol module to create polls in which the voter can keep anonimity while voting. At the moment the module is completely experimental in order to test the feasibility.

&nbsp;

***

&nbsp;

## :white_check_mark: Publish & Verify

Create an __.env__ file with the following fields:

```
ETHERSCAN_API_KEY=
POLYGON_MAINNET_NODE=
POLYGON_MAINNET_PRIVATE_KEY=
```


### publish


```
❍ npx hardhat run --network mainnet scripts/deploy-script.js
```

### verify

```
❍ npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS "Constructor argument 1"
```

&nbsp;

***

&nbsp;

Part of the code is taken from [here](https://github.com/semaphore-protocol).