// npx hardhat run scripts/names/4_factory.deploy.ts --network monadMainnet

import { network } from "hardhat";

const contractNameFactory = "FlexiPunkTLDFactory";

const metaAddress = "0xA37a65518ef4ff8b9584Fbb0C322f2532800D0A0"; // FlexiPunkMetadata contract address
const forbAddress = "0x7BF660E8C36070F81828d17b500E33A86601FF70"; // PunkForbiddenTlds contract address
const resolverAddress = "0xe9C63616387bbd4902a10671619534eef04e63f1"; // PunkResolverNonUpgradable contract address
const tldPrice = "694200"; // default price in MON

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
  if (!metaAddress || !forbAddress || !resolverAddress) {
    throw new Error("Please set metaAddress, forbAddress, and resolverAddress in the script");
  }
  
  // Deploy the factory contract
  console.log("Deploying the factory contract...");
  const tldPriceWei = ethers.parseEther(tldPrice);
  const contractFactory = await ethers.getContractFactory(contractNameFactory);
  const instanceFactory = await contractFactory.deploy(tldPriceWei, forbAddress, metaAddress);
  
  // Wait for deployment to complete
  await instanceFactory.waitForDeployment();
  
  const factoryAddress = await instanceFactory.getAddress();
  console.log("Factory contract deployed to:", factoryAddress);
  
  // Get the transaction receipt
  const deploymentTx = instanceFactory.deploymentTransaction();
  if (deploymentTx) {
    await deploymentTx.wait();
    console.log("Deployment transaction confirmed");
  }
  
  // Add factory address to the ForbiddenTlds whitelist
  console.log("\nAdding factory contract to the ForbiddenTlds whitelist...");
  const contractForbiddenTlds = await ethers.getContractFactory("PunkForbiddenTlds");
  const instanceForbiddenTlds = contractForbiddenTlds.attach(forbAddress);
  const txAddFactoryAddress = await instanceForbiddenTlds.addFactoryAddress(factoryAddress);
  await txAddFactoryAddress.wait();
  console.log("Done! Factory address added to ForbiddenTlds whitelist");
  
  // Add factory address to the Resolver
  console.log("\nAdding factory contract to the Resolver...");
  const contractResolver = await ethers.getContractFactory("PunkResolverNonUpgradable");
  const instanceResolver = contractResolver.attach(resolverAddress);
  const txAddFactoryAddress2 = await instanceResolver.addFactoryAddress(factoryAddress);
  await txAddFactoryAddress2.wait();
  console.log("Done! Factory address added to Resolver");
  
  console.log("\n========================\n");
  
  console.log("\n=== Deployment Summary ===");
  console.log("Factory contract deployed to:", factoryAddress);
  console.log("Network:", networkName);
  console.log("Deployer:", deployer.address);
  console.log("TLD Price:", tldPrice, "MON");
  console.log("ForbiddenTlds Address:", forbAddress);
  console.log("Metadata Address:", metaAddress);
  console.log("Resolver Address:", resolverAddress);
  console.log("========================\n");
  
  // Contract verification instructions
  console.log("\n=== Contract Verification ===");
  if (networkName !== "hardhat") {
    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network ${networkName} ${factoryAddress} "${tldPriceWei}" ${forbAddress} ${metaAddress}`);
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

