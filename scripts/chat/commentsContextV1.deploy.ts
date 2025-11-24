// npx hardhat run scripts/chat/commentsContextV1.deploy.ts --network monadMainnet

import { network } from "hardhat";

const contractName = "CommentsContextV1";

const modTokenAddress = "0xE9a696F428725134AB06454A0CB2E7434e3deC4c";
const modMinBalance = 1; // 1 NFT
const chatOwnerAddress = "0x6771F33Cfd8C6FC0A1766331f715f5d2E1d4E0e2";

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
    modTokenAddress,
    chatOwnerAddress,
    modMinBalance
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
  console.log("Mod Token Address:", modTokenAddress);
  console.log("Chat Owner Address:", chatOwnerAddress);
  console.log("Mod Min Balance:", modMinBalance);
  console.log("========================\n");
  
  // Contract verification instructions
  console.log("\n=== Contract Verification ===");
  if (networkName !== "hardhat") {
    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network ${networkName} ${address} ${modTokenAddress} ${chatOwnerAddress} "${modMinBalance}"`);
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

