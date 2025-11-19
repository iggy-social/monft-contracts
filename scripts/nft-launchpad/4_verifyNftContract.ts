// TODO:
// 1. Create the first NFT collection through the factory.
// 2. Verify the contract on block explorer using this script (run the command below).

// Run: npx hardhat run scripts/nft-launchpad/4_verifyNftContract.ts --network monadTestnet

import { network } from "hardhat";

const contractAddress = "";

async function main() {
  // Connect to the network and get the network name
  const connection = await network.connect();
  const networkName = connection.networkName;
  
  console.log("Copy the line below and paste it in your terminal to verify the NFT contract on block explorer:");
  console.log("");
  console.log(`npx hardhat verify --network ${networkName} --constructor-args scripts/nft-launchpad/4_arguments.ts ${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

