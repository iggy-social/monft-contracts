# MONFT smart contracts

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

### Environment variables

Hardhat has an encrypted keystore for environment variables.

Make sure to set the following environment variables before deploying:
- `MONAD_TESTNET_RPC` - Monad Testnet RPC endpoint (and similar for other networks)
- `DEPLOYER_PRIVATE_KEY` - Private key of the deployer account
- `ETHERSCAN_API_KEY` - API key for Etherscan verification (optional)

```shell
npx hardhat keystore set MONAD_TESTNET_RPC
npx hardhat keystore set DEPLOYER_PRIVATE_KEY
npx hardhat keystore set ETHERSCAN_API_KEY
```

Check existing values with the `get` keyword, for example:

```shell
npx hardhat keystore get MONAD_TESTNET_RPC
```


### Deploy the contract

The project includes a TypeScript deployment script using ethers.js that automatically tests the deployed contract:

**Deploy to local Hardhat network:**
```shell
npx hardhat run scripts/chat/moderatorSbt.deploy.ts
```

**Deploy to Sepolia testnet:**
```shell
npx hardhat run scripts/chat/moderatorSbt.deploy.ts --network monadTestnet
```

**Deploy to a simulated mainnet:**
```shell
npx hardhat run scripts/chat/moderatorSbt.deploy.ts --network hardhatMainnet
```

After deployment, the script will provide instructions for verifying the contract. For Sepolia, you can verify using:

```shell
npx hardhat verify --network monadTestnet <CONTRACT_ADDRESS>
```
