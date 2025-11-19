// If verifying contract via step 4 does not work, use this script instead

// 5. Deploy mock/test Nft721Bonding contract so that others created through factory can get auto-verified.
// npx hardhat run scripts/nft-launchpad/5_mockNftContract.ts --network monadTestnet

import { network } from "hardhat";

const contractName = "Nft721Bonding";

const factoryAddress = "";
const metadataAddress = "";
const mintingFeeReceiver = "";
const cName = "Test collection";
const cSymbol = "TEST";
const mintingFeePercentage = 0.02; // 2%
const ratio = 69; // ratio for bonding curve

async function main() {
  // Connect to the network and get the network name
  const connection = await network.connect();
  const networkName = connection.networkName;
  console.log(`Deploying to network: ${networkName}`);
  
  // Destructure ethers from the connection
  const { ethers } = connection;
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);
  
  // Get the balance of the deployer
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MON");
  
  // Parse values that require ethers
  const parsedMintingFeePercentage = ethers.parseEther(mintingFeePercentage.toString());
  const parsedRatio = ethers.parseEther(ratio.toString());
  
  // Deploy the contract
  console.log("Deploying the contract...");
  const contract = await ethers.getContractFactory(contractName);
  const instance = await contract.deploy(
    factoryAddress,
    metadataAddress,
    mintingFeeReceiver,
    cName,
    cSymbol,
    parsedMintingFeePercentage,
    parsedRatio
  );
  
  // Wait for deployment to complete
  await instance.waitForDeployment();
  
  const address = await instance.getAddress();
  console.log("Contract deployed to:", address);
  
  // Get the transaction receipt
  const deploymentTx = instance.deploymentTransaction();
  if (deploymentTx) {
    await deploymentTx.wait();
    console.log("Deployment transaction confirmed");
  }
  
  console.log("========================\n");
  
  console.log("\n=== Deployment Summary ===");
  console.log("Contract deployed to:", address);
  console.log("Network:", networkName);
  console.log("Deployer:", deployer.address);
  console.log("Factory Address:", factoryAddress);
  console.log("Metadata Address:", metadataAddress);
  console.log("Minting Fee Receiver:", mintingFeeReceiver);
  console.log("Collection Name:", cName);
  console.log("Collection Symbol:", cSymbol);
  console.log("Minting Fee Percentage:", mintingFeePercentage.toString(), "%");
  console.log("Ratio:", ratio.toString());
  console.log("========================\n");
  
  // Contract verification instructions
  console.log("\n=== Contract Verification ===");
  if (networkName !== "hardhat") {
    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network ${networkName} ${address} ${factoryAddress} ${metadataAddress} ${mintingFeeReceiver} "${cName}" "${cSymbol}" "${parsedMintingFeePercentage}" "${parsedRatio}"`);
  } else {
    console.log("Skipping verification for local network");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

