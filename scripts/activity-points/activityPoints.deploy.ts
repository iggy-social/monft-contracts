// npx hardhat run scripts/activity-points/activityPoints.deploy.ts --network monadTestnet

import { network } from "hardhat";

const contractName = "ActivityPoints";

const statsAddress = ""; // stats contract
const tldStatsAddress = "";
const multiplier = 1_000_000; // points for 1 ETH

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
  
  // Deploy the contract
  console.log("Deploying the contract...");
  const contract = await ethers.getContractFactory(contractName);
  const instance = await contract.deploy(
    statsAddress,
    tldStatsAddress,
    multiplier
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
  console.log("Stats Address:", statsAddress);
  console.log("TLD Stats Address:", tldStatsAddress);
  console.log("Multiplier:", multiplier);
  console.log("========================\n");
  
  // Contract verification instructions
  console.log("\n=== Contract Verification ===");
  if (networkName !== "hardhat") {
    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network ${networkName} ${address} ${statsAddress} ${tldStatsAddress} "${multiplier}"`);
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

