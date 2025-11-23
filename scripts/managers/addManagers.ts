// npx hardhat run scripts/managers/addManagers.ts --network monadTestnet

import { network } from "hardhat";

const contractAddresses: string[] = [
  // Add your contract addresses here
  "0xe5970402b86870CC80246e168E6192F0BB993C43", // directory
  "0xe9C63616387bbd4902a10671619534eef04e63f1", // launchpad
  "0xd1b328B5Ff4bF06ef9c6E7CDacDa69be5F522649", // minter
  "0x64a2489c6ECd8535BCC8E57DbB88ceB10b345766", // chat
  "0x8f594531ae52618265d2BddF25A2d1B656151972", // comments
];

const managerAddresses: string[] = [
  // Add your manager addresses here
  "0xb29050965A5AC70ab487aa47546cdCBc97dAE45D",
  "0x6771F33Cfd8C6FC0A1766331f715f5d2E1d4E0e2",
  "0x5FfD23B1B0350debB17A2cB668929aC5f76d0E18",
  "0xE64AE6B6c7BDAFefad768D9354bBED2C55C9B0F2",
  "0x19931aF80ad59Cc22841983EA3057B8776558A7f"
];

async function main() {
  // Connect to the network and get the network name
  const connection = await network.connect();
  const networkName = connection.networkName;
  console.log(`Running script on network: ${networkName}`);
  
  // Destructure ethers from the connection
  const { ethers } = connection;
  
  // Get the deployer account
  const [owner] = await ethers.getSigners();
  
  console.log("Running script with the account:", owner.address);
  
  // Get the balance of the deployer
  const balance = await ethers.provider.getBalance(owner.address);
  console.log("Account balance:", ethers.formatEther(balance), "MON");
  
  // Create interface for addManager function
  const intrfc = new ethers.Interface([
    "function addManager(address manager_) external"
  ]);
  
  // Loop through each contract
  for (let i = 0; i < contractAddresses.length; i++) {
    const contractAddress = contractAddresses[i];
    console.log(`\nProcessing contract: ${contractAddress}`);
    
    // Loop through each manager for this contract
    for (let j = 0; j < managerAddresses.length; j++) {
      const managerAddress = managerAddresses[j];
      console.log(`  Adding manager ${managerAddress} to ${contractAddress}`);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const contract = new ethers.Contract(contractAddress, intrfc, owner);
        const tx = await contract.addManager(managerAddress);
        await tx.wait();
        console.log(`  ✓ Manager added successfully`);
      } catch (error: any) {
        console.log(`  ✗ Error: ${error.code || error.message}`);
        continue;
      }
    }
    
    console.log(`Completed processing contract: ${contractAddress}`);
  }
  
  console.log("\nDone");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

