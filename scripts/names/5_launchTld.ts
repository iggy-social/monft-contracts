// npx hardhat run scripts/names/5_launchTld.ts --network monadTestnet

import { network } from "hardhat";

const factoryAddress = ""; // FlexiPunkTLDFactory contract address
const resolverAddress = ""; // PunkResolverNonUpgradable contract address
const forbiddenTldsAddress = ""; // PunkForbiddenTlds contract address
const tldOwnerAddress = ""; // TLD owner address
const newFactoryOwnerAddress = ""; // New factory owner address (will receive ownership of factory, resolver, and forbiddenTlds)

const tldName = ".monft";
const tldSymbol = ".MONFT";

async function main() {
  // Connect to the network and get the network name
  const connection = await network.connect();
  const networkName = connection.networkName;
  console.log(`Running on network: ${networkName}`);
  
  // Destructure ethers from the connection
  const { ethers } = connection;
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Executing with account:", deployer.address);
  
  // Get the balance of the deployer
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "MON");
  
  // Validate addresses
  if (!factoryAddress || !resolverAddress || !forbiddenTldsAddress || !tldOwnerAddress || !newFactoryOwnerAddress) {
    throw new Error("Please set all required addresses in the script");
  }
  
  // Get contract instances
  const contractFactory = await ethers.getContractFactory("FlexiPunkTLDFactory");
  const instanceFactory = contractFactory.attach(factoryAddress);
  
  const contractResolver = await ethers.getContractFactory("PunkResolverNonUpgradable");
  const instanceResolver = contractResolver.attach(resolverAddress);
  
  const contractForbiddenTlds = await ethers.getContractFactory("PunkForbiddenTlds");
  const instanceForbiddenTlds = contractForbiddenTlds.attach(forbiddenTldsAddress);
  
  // Launch the .monft TLD
  console.log(`\nLaunching ${tldName} TLD...`);
  console.log(`TLD Symbol: ${tldSymbol}`);
  console.log(`TLD Owner: ${tldOwnerAddress}`);
  
  const txCreateTld = await instanceFactory.ownerCreateTld(
    tldName,
    tldSymbol,
    tldOwnerAddress,
    0, // Price is set to 0, because minter contract will set the prices
    false // Buying is not enabled, because buying will be done via minter contract
  );
  
  const receipt = await txCreateTld.wait();
  if (receipt) {
    console.log(`Transaction confirmed: ${receipt.hash}`);
  }
  
  // Transfer ownership of factory contract
  try {
    console.log(`\nTransferring ownership of Factory contract to ${newFactoryOwnerAddress}...`);
    const txTransferFactory = await instanceFactory.transferOwnership(newFactoryOwnerAddress);
    await txTransferFactory.wait();
    console.log("Factory ownership transferred successfully");
  } catch (error) {
    console.error("Failed to transfer ownership of Factory contract. Please do it manually by calling transferOwnership function in the Factory contract.");
    console.error("Error:", error);
  }

  try {
    // Transfer ownership of resolver contract
    console.log(`\nTransferring ownership of Resolver contract to ${newFactoryOwnerAddress}...`);
    const txTransferResolver = await instanceResolver.transferOwnership(newFactoryOwnerAddress);
    await txTransferResolver.wait();
    console.log("Resolver ownership transferred successfully");
  } catch (error) {
    console.error("Failed to transfer ownership of Resolver contract. Please do it manually by calling transferOwnership function in the Resolver contract.");
    console.error("Error:", error);
  }
    
  try {
    // Transfer ownership of forbiddenTlds contract
    console.log(`\nTransferring ownership of ForbiddenTlds contract to ${newFactoryOwnerAddress}...`);
    const txTransferForbiddenTlds = await instanceForbiddenTlds.transferOwnership(newFactoryOwnerAddress);
    await txTransferForbiddenTlds.wait();
    console.log("ForbiddenTlds ownership transferred successfully");
  } catch (error) {
    console.error("Failed to transfer ownership of ForbiddenTlds contract. Please do it manually by calling transferOwnership function in the ForbiddenTlds contract.");
    console.error("Error:", error);
  }

  // Get the TLD contract address from the event or mapping
  const tldAddress = await instanceFactory.tldNamesAddresses(tldName);
  console.log(`\n${tldName} TLD launched successfully!`);
  console.log(`TLD Contract Address: ${tldAddress}`);
  
  console.log("\n========================\n");
  
  console.log("\n=== Launch Summary ===");
  console.log("TLD Name:", tldName);
  console.log("TLD Symbol:", tldSymbol);
  console.log("TLD Contract Address:", tldAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

