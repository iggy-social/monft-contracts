// npx hardhat run scripts/token/monftMinter.deploy.ts --network monadTestnet
// This script deploys the MONFTMinter contract and sets it as the minter in the MONFT contract.
// If setting the minter address fails, do it manually by calling the setMinter function in the MONFT contract.

import { network } from "hardhat";

const contractName = "MONFTMinter";

const monftTokenAddress = ""; // TODO

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
    monftTokenAddress
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
  console.log("MONFT Token Address:", monftTokenAddress);
  console.log("========================\n");
  
  // Set the minter contract address as the Minter in the MONFT contract
  console.log("Setting minter contract address as the Minter in the MONFT contract...");
  try {
    const monftTokenContract = await ethers.getContractFactory("MONFT");
    const monftTokenInstance = monftTokenContract.attach(monftTokenAddress);
    
    const setMinterTx = await monftTokenInstance.setMinter(address);
    await setMinterTx.wait();
    console.log("Successfully set as minter!");
  } catch (error) {
    console.error("Failed to set minter automatically. Please do it manually by calling setMinter function in the MONFT contract.");
    console.error("Error:", error);
  }
  
  // Contract verification instructions
  console.log("\n=== Contract Verification ===");
  if (networkName !== "hardhat") {
    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network ${networkName} ${address} ${monftTokenAddress}`);
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

