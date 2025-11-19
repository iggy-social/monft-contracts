// npx hardhat test test/token/monftClaimDomains.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("MONFTClaimDomains", function () {
  let ethers: any;
  let monftContract: any;
  let monftMinterContract: any;
  let mockPunkTldContract: any;
  let monftClaimDomainsContract: any;

  let owner: any;
  let user1: any;
  let user2: any;
  let user3: any;

  const domain1 = "user1a";
  const domain2 = "user1b";
  const domain3 = "user2a";
  const domain4 = "user2b";

  let chatReward: any;

  const calculateGasCosts = (testName: string, receipt: any) => {
    console.log(testName + " gasUsed: " + receipt.gasUsed);

    // coin prices in USD
    const matic = 1.5;
    const eth = 1500;

    const gasCostMatic = ethers.formatUnits(
      String(Number(ethers.parseUnits("500", "gwei")) * Number(receipt.gasUsed)),
      "ether"
    );
    const gasCostEthereum = ethers.formatUnits(
      String(Number(ethers.parseUnits("50", "gwei")) * Number(receipt.gasUsed)),
      "ether"
    );
    const gasCostArbitrum = ethers.formatUnits(
      String(Number(ethers.parseUnits("1.25", "gwei")) * Number(receipt.gasUsed)),
      "ether"
    );

    console.log(testName + " gas cost (Ethereum): $" + String(Number(gasCostEthereum) * eth));
    console.log(testName + " gas cost (Arbitrum): $" + String(Number(gasCostArbitrum) * eth));
    console.log(testName + " gas cost (Polygon): $" + String(Number(gasCostMatic) * matic));
  };

  before(async function () {
    const connection = await network.connect();
    ethers = connection.ethers;
    chatReward = ethers.parseEther("1337");
  });

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // deploy MONFT
    const MONFT = await ethers.getContractFactory("MONFT");
    monftContract = await MONFT.deploy("MONFT Token", "MONFT");
    await monftContract.waitForDeployment();

    // deploy MONFTMinter
    const MONFTMinter = await ethers.getContractFactory("MONFTMinter");
    monftMinterContract = await MONFTMinter.deploy(await monftContract.getAddress());
    await monftMinterContract.waitForDeployment();

    // add minter to MONFT
    await monftContract.setMinter(await monftMinterContract.getAddress());

    // deploy MockPunkTld
    const MockPunkTld = await ethers.getContractFactory("MockPunkTld");
    mockPunkTldContract = await MockPunkTld.deploy(user3.address, "user3");
    await mockPunkTldContract.waitForDeployment();

    // deploy MONFTClaimDomains
    const MONFTClaimDomains = await ethers.getContractFactory("MONFTClaimDomains");
    monftClaimDomainsContract = await MONFTClaimDomains.deploy(
      await monftMinterContract.getAddress(), // MONFTMinter address
      await mockPunkTldContract.getAddress(), // TLD address
      chatReward, // chat rewards per domain
      100n // max domain NFT ID eligible for airdrop (aka snapshot)
    );
    await monftClaimDomainsContract.waitForDeployment();

    // add MONFTClaimDomains address as minter in MONFTMinter
    await monftMinterContract.addMinter(await monftClaimDomainsContract.getAddress());

    // register some domains
    await mockPunkTldContract.register(domain1, user1.address);
    await mockPunkTldContract.register(domain2, user1.address);
    await mockPunkTldContract.register(domain3, user2.address);
    await mockPunkTldContract.register(domain4, user2.address);
  });

  it("can claim MONFT airdrop for a domain", async function () {
    // user1: check MONFT balance 1
    const user1MonftBalance1 = await monftContract.balanceOf(user1.address);
    expect(user1MonftBalance1).to.equal(0n);

    const tx = await monftClaimDomainsContract.connect(user1).claim(domain1);
    const receipt = await tx.wait();
    calculateGasCosts("claimDomain user1a", receipt);

    // user1: check MONFT balance 2
    const user1MonftBalance2 = await monftContract.balanceOf(user1.address);
    expect(user1MonftBalance2).to.equal(chatReward);

    // fail to claim the same domain again
    await expect(monftClaimDomainsContract.connect(user1).claim(domain1)).to.be.revertedWith(
      "MONFTClaimDomains: domain already claimed"
    );

    // fail to claim non-existing domain
    await expect(monftClaimDomainsContract.connect(user1).claim("non-existing")).to.be.revertedWith(
      "MONFTClaimDomains: domain not registered"
    );

    // user1: claim another domain
    await monftClaimDomainsContract.connect(user1).claim(domain2);

    // user1: check MONFT balance 3
    const user1MonftBalance3 = await monftContract.balanceOf(user1.address);
    expect(user1MonftBalance3).to.equal(chatReward * 2n);

    // user2: check MONFT balance 1
    const user2MonftBalance1 = await monftContract.balanceOf(user2.address);
    expect(user2MonftBalance1).to.equal(0n);

    // user2: claim domain
    await monftClaimDomainsContract.connect(user2).claim(domain3);

    // user2: check MONFT balance 2
    const user2MonftBalance2 = await monftContract.balanceOf(user2.address);
    expect(user2MonftBalance2).to.equal(chatReward);

    // user1: claim for user2
    await monftClaimDomainsContract.connect(user1).claim(domain4);

    // user2: check MONFT balance 3
    const user2MonftBalance3 = await monftContract.balanceOf(user2.address);
    expect(user2MonftBalance3).to.equal(chatReward * 2n);

    // user1: check MONFT balance 4
    const user1MonftBalance4 = await monftContract.balanceOf(user1.address);
    expect(user1MonftBalance4).to.equal(user1MonftBalance3); // unchanged
  });

  it("should revert when claiming is paused", async function () {
    // pause claiming
    await monftClaimDomainsContract.togglePaused();
    expect(await monftClaimDomainsContract.paused()).to.equal(true);

    // user1 should not be able to claim when paused
    await expect(monftClaimDomainsContract.connect(user1).claim(domain1)).to.be.revertedWith(
      "MONFTClaimDomains: claiming is paused"
    );

    // unpause claiming
    await monftClaimDomainsContract.togglePaused();
    expect(await monftClaimDomainsContract.paused()).to.equal(false);

    // user1 should now be able to claim
    const tx = await monftClaimDomainsContract.connect(user1).claim(domain1);
    await tx.wait();

    const user1MonftBalance = await monftContract.balanceOf(user1.address);
    expect(user1MonftBalance).to.equal(chatReward);
  });

  it("should revert when domain ID exceeds maxIdEligible", async function () {
    // Deploy a new contract with maxIdEligible = 0
    const MONFTClaimDomains = await ethers.getContractFactory("MONFTClaimDomains");
    const newClaimContract = await MONFTClaimDomains.deploy(
      await monftMinterContract.getAddress(),
      await mockPunkTldContract.getAddress(),
      chatReward,
      0n // maxIdEligible = 0
    );
    await newClaimContract.waitForDeployment();

    // Add as minter
    await monftMinterContract.addMinter(await newClaimContract.getAddress());

    // Should revert because domain ID (1) > maxIdEligible (0)
    await expect(newClaimContract.connect(user1).claim(domain1)).to.be.revertedWith(
      "MONFTClaimDomains: domain ID not eligible for claiming"
    );
  });

  it("should allow owner to change chatReward and maxIdEligible", async function () {
    const newChatReward = ethers.parseEther("2000");
    const newMaxIdEligible = 200n;

    // Change chat reward
    await monftClaimDomainsContract.changeChatReward(newChatReward);
    expect(await monftClaimDomainsContract.chatReward()).to.equal(newChatReward);

    // Change max ID eligible
    await monftClaimDomainsContract.changeMaxIdEligible(newMaxIdEligible);
    expect(await monftClaimDomainsContract.maxIdEligible()).to.equal(newMaxIdEligible);

    // Claim with new reward
    await monftClaimDomainsContract.connect(user1).claim(domain1);
    const user1MonftBalance = await monftContract.balanceOf(user1.address);
    expect(user1MonftBalance).to.equal(newChatReward);
  });

  it("should revert deployment with invalid constructor parameters", async function () {
    const MONFTClaimDomains = await ethers.getContractFactory("MONFTClaimDomains");

    // should revert with zero chatReward
    await expect(
      MONFTClaimDomains.deploy(
        await monftMinterContract.getAddress(),
        await mockPunkTldContract.getAddress(),
        0n,
        100n
      )
    ).to.be.revertedWith("MONFTClaimDomains: chatReward must be greater than 0");

    // should revert with zero monftMinter address
    await expect(
      MONFTClaimDomains.deploy(
        ethers.ZeroAddress,
        await mockPunkTldContract.getAddress(),
        chatReward,
        100n
      )
    ).to.be.revertedWith("MONFTClaimDomains: monftMinter cannot be zero address");

    // should revert with zero domain address
    await expect(
      MONFTClaimDomains.deploy(
        await monftMinterContract.getAddress(),
        ethers.ZeroAddress,
        chatReward,
        100n
      )
    ).to.be.revertedWith("MONFTClaimDomains: domain contract cannot be zero address");
  });

  it("should revert when trying to change chatReward to zero", async function () {
    await expect(monftClaimDomainsContract.changeChatReward(0n)).to.be.revertedWith(
      "MONFTClaimDomains: chatReward must be greater than 0"
    );
  });
});

