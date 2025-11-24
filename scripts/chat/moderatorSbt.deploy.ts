// npx hardhat run scripts/chat/moderatorSbt.deploy.ts --network monadMainnet

import { network } from "hardhat";

const contractName = "ModeratorSbt";

const sbtName = "Moderator SBT";
const sbtSymbol = "MSBT";
const moderators = [
  "0xb29050965A5AC70ab487aa47546cdCBc97dAE45D",
  "0x6771F33Cfd8C6FC0A1766331f715f5d2E1d4E0e2",
  "0x5FfD23B1B0350debB17A2cB668929aC5f76d0E18",
  "0xE64AE6B6c7BDAFefad768D9354bBED2C55C9B0F2",
  "0x19931aF80ad59Cc22841983EA3057B8776558A7f",
  "0xD22c9708D7638575801Eb042be1d2BFEab94BC23"
]

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
  const instance = await contract.deploy(sbtName, sbtSymbol);
  
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
  
  // Mint tokens to moderators
  for (const moderator of moderators) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    let tx = await instance.mint(moderator);
    await tx.wait();
    console.log("Moderator added:", moderator);
  }
  console.log("========================\n");
  
  console.log("\n=== Deployment Summary ===");
  console.log("Contract deployed to:", address);
  console.log("Network:", networkName);
  console.log("Deployer:", deployer.address);
  console.log("========================\n");
  
  // Contract verification instructions
  console.log("\n=== Contract Verification ===");
  if (networkName !== "hardhat") {
    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network ${networkName} ${address} "${sbtName}" "${sbtSymbol}"`);
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

