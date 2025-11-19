// npx hardhat run scripts/staking/stakingRewards.deploy.ts --network monadTestnet

import { network } from "hardhat";

const contractName = "StakingRewards";

const assetAddress = ""; // token to stake
const wethAddress = ""; // wrapped native coin (WETH, WSGB, WBNB, etc.)
const tokenName = "Governance Token";
const symbol = "GT";
const claimRewardsMinimum = "0.001"; // 0.001 ETH minimum total reward for a given week (if not met, rewards are rolled over to the next week)
const minDeposit = "0.001"; // 0.001 LP tokens minimum deposit to stake
const periodLength = 604800; // 7 days

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
  
  // Parse values that require ethers (must be done after ethers is initialized)
  const parsedClaimRewardsMinimum = ethers.parseEther(claimRewardsMinimum);
  const parsedMinDeposit = ethers.parseEther(minDeposit);
  
  // Deploy the contract
  console.log("Deploying the contract...");
  const contract = await ethers.getContractFactory(contractName);
  const instance = await contract.deploy(
    assetAddress,
    wethAddress,
    tokenName,
    symbol,
    parsedClaimRewardsMinimum,
    parsedMinDeposit,
    periodLength
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
  console.log("Asset Address:", assetAddress);
  console.log("WETH Address:", wethAddress);
  console.log("Token Name:", tokenName);
  console.log("Symbol:", symbol);
  console.log("Claim Rewards Minimum:", claimRewardsMinimum, "ETH");
  console.log("Min Deposit:", minDeposit, "LP tokens");
  console.log("Period Length:", periodLength, "seconds (7 days)");
  console.log("========================\n");
  
  // Contract verification instructions
  console.log("\n=== Contract Verification ===");
  if (networkName !== "hardhat") {
    console.log("\nTo verify the contract, run:");
    console.log(`npx hardhat verify --network ${networkName} ${address} ${assetAddress} ${wethAddress} "${tokenName}" "${symbol}" "${parsedClaimRewardsMinimum}" "${parsedMinDeposit}" "${periodLength}"`);
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

