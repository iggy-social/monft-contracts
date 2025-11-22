// npx hardhat run scripts/names/6_minter.deploy.ts --network monadTestnet

import { network } from "hardhat";

const contractName = "MONFTNameMinter";

const revenueAddress = ""; // Revenue address
const statsAddress = ""; // Stats middleware address
const tldAddress = ""; // TLD contract address

// Prices in MON
const price1char = "1"; // 1 char domain price
const price2char = "0.1"; // 2 chars domain price
const price3char = "0.05"; // 3 chars domain price
const price4char = "0.002"; // 4 chars domain price
const price5char = "0.0009"; // 5+ chars domain price

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
  
  // Validate addresses
  if (!revenueAddress || !statsAddress || !tldAddress) {
    throw new Error("Please set revenueAddress, statsAddress, and tldAddress in the script");
  }
  
  // Parse prices to wei (using parseEther since prices are in MON)
  const price1charWei = ethers.parseEther(price1char);
  const price2charWei = ethers.parseEther(price2char);
  const price3charWei = ethers.parseEther(price3char);
  const price4charWei = ethers.parseEther(price4char);
  const price5charWei = ethers.parseEther(price5char);
  
  // Deploy the minter contract
  console.log("Deploying the minter contract...");
  const contract = await ethers.getContractFactory(contractName);
  const instance = await contract.deploy(
    revenueAddress,
    statsAddress,
    tldAddress,
    price1charWei,
    price2charWei,
    price3charWei,
    price4charWei,
    price5charWei
  );
  
  // Wait for deployment to complete
  await instance.waitForDeployment();
  
  // Get the transaction receipt
  const deploymentTx = instance.deploymentTransaction();
  if (
    deploymentTx) {
    await deploymentTx.wait();
    console.log("Deployment transaction confirmed");
  }

  const minterAddress = await instance.getAddress();
  console.log("Minter contract deployed to:", minterAddress);
  
  // Add minter address to the TLD contract
  console.log("\nAdding minter address to the TLD contract...");
  const contractTld = await ethers.getContractFactory("FlexiPunkTLD");
  const instanceTld = contractTld.attach(tldAddress);
  const txChangeMinter = await instanceTld.changeMinter(minterAddress);
  await txChangeMinter.wait();
  console.log("Done! Minter address added to TLD contract");
  
  // Add minter address to the StatsMiddleware contract
  console.log("\nAdding minter address to the StatsMiddleware contract...");
  const contractStats = await ethers.getContractFactory("StatsMiddleware");
  const instanceStats = contractStats.attach(statsAddress);
  const txAddWriter = await instanceStats.addWriter(minterAddress);
  await txAddWriter.wait();
  console.log("Done! Minter address added to StatsMiddleware as writer");
  
  console.log("\n========================\n");
  
  console.log("\n=== Deployment Summary ===");
  console.log("Minter contract deployed to:", minterAddress);
  console.log("Network:", networkName);
  console.log("Deployer:", deployer.address);
  console.log("Revenue Address:", revenueAddress);
  console.log("Stats Address:", statsAddress);
  console.log("TLD Address:", tldAddress);
  console.log("\n=== Prices ===");
  console.log("1 char:", price1char, "MON");
  console.log("2 chars:", price2char, "MON");
  console.log("3 chars:", price3char, "MON");
  console.log("4 chars:", price4char, "MON");
  console.log("5+ chars:", price5char, "MON");
  console.log("========================\n");
  
  // Contract verification instructions
  console.log("\n=== Contract Verification ===");
  if (networkName !== "hardhat") {
    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network ${networkName} ${minterAddress} ${revenueAddress} ${statsAddress} ${tldAddress} "${price1charWei}" "${price2charWei}" "${price3charWei}" "${price4charWei}" "${price5charWei}"`);
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

