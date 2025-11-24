// 3. Deploy IggyLaunchpad721Bonding contract
// npx hardhat run scripts/nft-launchpad/3_launchpadBonding.deploy.ts --network monadMainnet

import { network } from "hardhat";

const contractName = "IggyLaunchpad721Bonding";

const metadataAddress = "0xa89DC49a31D0067dAfdd1d6047C3b11b3042d0d6";
const mintingFeeReceiver = "0xE08033d0bDBcEbE7e619c3aE165E7957Ab577961"; // can be revenue distributor contract address
const directoryAddress = "0x64a2489c6ECd8535BCC8E57DbB88ceB10b345766";
const statsMiddlewareAddress = "0x1Db529706557c35D34e31d789f64F999b7D8AA4F";
const mintingFeePercentage = 0.02; // 2%
const price = 169; // price for creating a new NFT collection (in MON)

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

  const parsedMintingFeePercentage = ethers.parseEther(mintingFeePercentage.toString());
  const parsedPrice = ethers.parseEther(price.toString());
  
  // Deploy the contract
  console.log("Deploying the contract...");
  const contract = await ethers.getContractFactory(contractName);
  const instance = await contract.deploy(
    metadataAddress,
    mintingFeeReceiver,
    directoryAddress,
    statsMiddlewareAddress,
    parsedMintingFeePercentage,
    parsedPrice
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
  
  // Create a stats middleware contract instance
  if (statsMiddlewareAddress != ethers.ZeroAddress) {
    const statsMiddlewareInstance = await ethers.getContractAt("StatsMiddleware", statsMiddlewareAddress);
    
    // Set the launchpad contract address as writer in the stats middleware contract (addWriter function)
    console.log(`Adding ${contractName} contract as writer in the stats middleware contract...`);
    const tx1 = await statsMiddlewareInstance.addWriter(address);
    await tx1.wait();
    console.log("Launchpad added as writer in stats middleware successfully");
  }
  
  // Create a directory contract instance
  const directoryInstance = await ethers.getContractAt("NftDirectory", directoryAddress);
  
  // Set the launchpad contract address as writer in the directory contract (addWriter function)
  console.log(`Adding ${contractName} contract as writer in the directory contract...`);
  const tx2 = await directoryInstance.addWriter(address);
  await tx2.wait();
  console.log("Launchpad added as writer in directory successfully");
  
  console.log("========================\n");
  
  console.log("\n=== Deployment Summary ===");
  console.log("Contract deployed to:", address);
  console.log("Network:", networkName);
  console.log("Deployer:", deployer.address);
  console.log("Metadata Address:", metadataAddress);
  console.log("Minting Fee Receiver:", mintingFeeReceiver);
  console.log("Directory Address:", directoryAddress);
  console.log("Stats Middleware Address:", statsMiddlewareAddress);
  console.log("Minting Fee Percentage:", mintingFeePercentage.toString(), "%");
  console.log("Price:", price.toString(), "MON");
  console.log("========================\n");
  
  // Contract verification instructions
  console.log("\n=== Contract Verification ===");
  if (networkName !== "hardhat") {
    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network ${networkName} ${address} ${metadataAddress} ${mintingFeeReceiver} ${directoryAddress} ${statsMiddlewareAddress} "${parsedMintingFeePercentage}" "${parsedPrice}"`);
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

