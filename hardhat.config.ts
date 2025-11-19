import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      production: {
        version: "0.8.17",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    monadTestnet: {
      type: "http",
      chainType: "l1",
      url: configVariable("MONAD_TESTNET_RPC"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
  },

  // Custom block explorer configs go here (by chainId)
  chainDescriptors: {
    10143: {
      name: "monadTestnet",
      chainType: "l1",
      blockExplorers: {
        etherscan: {
          name: "Etherscan",
          url: "https://testnet.monadscan.com/",
          apiUrl: "https://api.etherscan.io/v2/api",
        },
        blockscout: {
          url: "https://monad-testnet.socialscan.io",
          apiUrl: "https://api.socialscan.io/monad-testnet/v1/explorer/command_api/contract"
        },
      },
    },
  },

  verify: {
    blockscout: {
      enabled: false,
    },
    etherscan: { // https://testnet.monadscan.com/
      apiKey: configVariable("ETHERSCAN_API_KEY"),
      enabled: false,
    },
    sourcify: { // blockvision sourcify: https://testnet.monvision.io/
      enabled: true,
      apiUrl: "https://sourcify-api-monad.blockvision.org",
    },
  },
});
