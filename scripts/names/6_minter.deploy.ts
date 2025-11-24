// npx hardhat run scripts/names/6_minter.deploy.ts --network monadMainnet

import { network } from "hardhat";

const contractName = "MONFTNameMinter";

const revenueAddress = "0xE08033d0bDBcEbE7e619c3aE165E7957Ab577961"; // Revenue address
const statsAddress = "0x1Db529706557c35D34e31d789f64F999b7D8AA4F"; // Stats middleware address
const tldAddress = "0x6aaFe10424C5CF9734cAF9d251aE339c45d251E2"; // TLD contract address
const minterManagers = [ // Minter managers addresses
  "0xb29050965A5AC70ab487aa47546cdCBc97dAE45D",
  "0x6771F33Cfd8C6FC0A1766331f715f5d2E1d4E0e2",
  "0x5FfD23B1B0350debB17A2cB668929aC5f76d0E18",
  "0xE64AE6B6c7BDAFefad768D9354bBED2C55C9B0F2",
  "0x19931aF80ad59Cc22841983EA3057B8776558A7f"
];
const newTldOwnerAddress = "0x6771F33Cfd8C6FC0A1766331f715f5d2E1d4E0e2"; // New TLD owner address

// Prices in MON
const price1char = "69420"; // 1 char domain price
const price2char = "6969"; // 2 chars domain price
const price3char = "1337"; // 3 chars domain price
const price4char = "420"; // 4 chars domain price
const price5char = "69"; // 5+ chars domain price

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

  // set minter managers
  console.log("\nSetting minter managers...");
  for (const manager of minterManagers) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const txAddManager = await instance.addManager(manager);
    await txAddManager.wait();
    console.log("Done! Manager added:", manager);
  }

  // transfer ownership of minter contract to new TLD owner
  console.log("\nTransferring ownership of minter contract to new TLD owner...");
  const txTransferOwnership = await instance.transferOwnership(newTldOwnerAddress);
  await txTransferOwnership.wait();
  console.log("Done! Ownership transferred to new TLD owner");
  
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

