// npx hardhat run scripts/token/monftClaimActivityPoints.deploy.ts --network monadTestnet
// This script deploys the MONFTClaimActivityPoints contract and sets it as a minter in the MONFTMinter contract.
// If setting the minter address fails, do it manually by calling the addMinter function in the MONFTMinter contract.

import { network } from "hardhat";

const contractName = "MONFTClaimActivityPoints";

const monftMinterAddress = ""; // TODO
const activityPointsAddress = ""; // TODO
const monftMonRatio = 1_000; // TODO: 1 MON = 1,000 MONFT

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
    monftMinterAddress,
    activityPointsAddress,
    monftMonRatio
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
  console.log("MONFT Minter Address:", monftMinterAddress);
  console.log("Activity Points Address:", activityPointsAddress);
  console.log("MONFT/MON Ratio:", monftMonRatio, "(1 MON =", monftMonRatio, "MONFT)");
  console.log("========================\n");
  
  // Add the deployed contract as a minter in MONFTMinter
  console.log("Adding MONFTClaimActivityPoints contract address as the Minter in the MONFTMinter contract...");
  try {
    const monftMinterContract = await ethers.getContractFactory("MONFTMinter");
    const monftMinterInstance = monftMinterContract.attach(monftMinterAddress);
    
    const addMinterTx = await monftMinterInstance.addMinter(address);
    await addMinterTx.wait();
    console.log("Successfully added as minter!");
  } catch (error) {
    console.error("Failed to add minter automatically. Please do it manually by calling addMinter function in the MONFTMinter contract.");
    console.error("Error:", error);
  }
  
  // Contract verification instructions
  console.log("\n=== Contract Verification ===");
  if (networkName !== "hardhat") {
    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network ${networkName} ${address} ${monftMinterAddress} ${activityPointsAddress} "${monftMonRatio}"`);
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

