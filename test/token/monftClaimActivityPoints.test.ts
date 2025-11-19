// npx hardhat test test/token/monftClaimActivityPoints.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("MONFTClaimActivityPoints", function () {
  let ethers: any;
  let monftContract: any;
  let monftMinterContract: any;
  let statsContract: any;
  let activityPointsContract: any;
  let monftClaimActivityPoints: any;

  let owner: any;
  let user1: any;
  let user2: any;
  let user3: any;

  const chatEthRatio = 1000n;

  let user1mintedWei: any;
  let user2mintedWei: any;

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
    user1mintedWei = ethers.parseEther("1.337");
    user2mintedWei = ethers.parseEther("4.2069");
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

    // deploy Stats
    const Stats = await ethers.getContractFactory("Stats");
    statsContract = await Stats.deploy();
    await statsContract.waitForDeployment();

    // add owner as writer to Stats
    await statsContract.addWriter(owner.address);

    // deploy ActivityPoints
    const ActivityPoints = await ethers.getContractFactory("ActivityPoints");
    activityPointsContract = await ActivityPoints.deploy(
      await statsContract.getAddress(), // Stats address
      ethers.ZeroAddress, // no TLD stats address
      1n // multiplier = 1
    );
    await activityPointsContract.waitForDeployment();

    // deploy MONFTClaimActivityPoints
    const MONFTClaimActivityPoints = await ethers.getContractFactory("MONFTClaimActivityPoints");
    monftClaimActivityPoints = await MONFTClaimActivityPoints.deploy(
      await monftMinterContract.getAddress(), // MONFTMinter address
      await activityPointsContract.getAddress(), // ActivityPoints address
      chatEthRatio // how many tokens per ETH spent will user get (1000 MONFT per ETH)
    );
    await monftClaimActivityPoints.waitForDeployment();

    // add MONFTClaimActivityPoints address as minter in MONFTMinter
    await monftMinterContract.addMinter(await monftClaimActivityPoints.getAddress());

    // add some data in the stats contract (addWeiSpent for user1 and user2)
    await statsContract.addWeiSpent(user1.address, user1mintedWei);
    await statsContract.addWeiSpent(user2.address, user2mintedWei);
  });

  it("can claim MONFT tokens based on data from the stats contract", async function () {
    // user1: check MONFT balance 1
    const user1MonftBalance1 = await monftContract.balanceOf(user1.address);
    expect(user1MonftBalance1).to.equal(0n);

    // user1: check claim preview 1
    const user1ClaimPreview1 = await monftClaimActivityPoints.claimPreview(user1.address);
    expect(user1ClaimPreview1).to.equal(user1mintedWei * chatEthRatio);
    console.log("user1 claim preview: ", ethers.formatEther(user1ClaimPreview1), " MONFT");

    // user1: claim MONFT tokens
    const user1ClaimTx = await monftClaimActivityPoints.connect(user1).claim();
    const receiptUser1ClaimTx = await user1ClaimTx.wait();
    calculateGasCosts("user1 claim", receiptUser1ClaimTx);

    // user1: check MONFT balance 2
    const user1MonftBalance2 = await monftContract.balanceOf(user1.address);
    expect(user1MonftBalance2).to.equal(user1mintedWei * chatEthRatio);

    // user1: check claim preview 2
    const user1ClaimPreview2 = await monftClaimActivityPoints.claimPreview(user1.address);
    expect(user1ClaimPreview2).to.equal(0n);

    // user1: fail to claim MONFT tokens again
    await expect(monftClaimActivityPoints.connect(user1).claim()).to.be.revertedWith(
      "MONFTClaimActivityPoints: user already claimed"
    );

    // user2: check MONFT balance 1
    const user2MonftBalance1 = await monftContract.balanceOf(user2.address);
    expect(user2MonftBalance1).to.equal(0n);

    // user2: check claim preview 1
    const user2ClaimPreview1 = await monftClaimActivityPoints.claimPreview(user2.address);
    expect(user2ClaimPreview1).to.equal(user2mintedWei * chatEthRatio);
    console.log("user2 claim preview: ", ethers.formatEther(user2ClaimPreview1), " MONFT");

    // user2: claim MONFT tokens
    const user2ClaimTx = await monftClaimActivityPoints.connect(user2).claim();
    const receiptUser2ClaimTx = await user2ClaimTx.wait();
    calculateGasCosts("user2 claim", receiptUser2ClaimTx);

    // user2: check MONFT balance 2
    const user2MonftBalance2 = await monftContract.balanceOf(user2.address);
    expect(user2MonftBalance2).to.equal(user2mintedWei * chatEthRatio);

    // user2: check claim preview 2
    const user2ClaimPreview2 = await monftClaimActivityPoints.claimPreview(user2.address);
    expect(user2ClaimPreview2).to.equal(0n);

    // user2: fail to claim MONFT tokens again
    await expect(monftClaimActivityPoints.connect(user2).claim()).to.be.revertedWith(
      "MONFTClaimActivityPoints: user already claimed"
    );
  });

  it("should revert when user tries to claim with no tokens to claim", async function () {
    // user3 has no wei spent, so claimPreview should return 0
    const user3ClaimPreview = await monftClaimActivityPoints.claimPreview(user3.address);
    expect(user3ClaimPreview).to.equal(0n);

    // user3 should not be able to claim
    await expect(monftClaimActivityPoints.connect(user3).claim()).to.be.revertedWith(
      "MONFTClaimActivityPoints: no tokens to claim"
    );
  });

  it("should revert when claiming is paused", async function () {
    // pause claiming
    await monftClaimActivityPoints.togglePaused();
    expect(await monftClaimActivityPoints.paused()).to.equal(true);

    // user1 should not be able to claim when paused
    await expect(monftClaimActivityPoints.connect(user1).claim()).to.be.revertedWith(
      "MONFTClaimActivityPoints: claiming is paused"
    );

    // unpause claiming
    await monftClaimActivityPoints.togglePaused();
    expect(await monftClaimActivityPoints.paused()).to.equal(false);

    // user1 should now be able to claim
    const user1ClaimTx = await monftClaimActivityPoints.connect(user1).claim();
    await user1ClaimTx.wait();

    const user1MonftBalance = await monftContract.balanceOf(user1.address);
    expect(user1MonftBalance).to.equal(user1mintedWei * chatEthRatio);
  });

  it("should revert deployment with invalid constructor parameters", async function () {
    const MONFTClaimActivityPoints = await ethers.getContractFactory("MONFTClaimActivityPoints");

    // should revert with zero chatEthRatio
    await expect(
      MONFTClaimActivityPoints.deploy(
        await monftMinterContract.getAddress(),
        await activityPointsContract.getAddress(),
        0n
      )
    ).to.be.revertedWith("MONFTClaimActivityPoints: chatEthRatio must be greater than 0");

    // should revert with zero monftMinter address
    await expect(
      MONFTClaimActivityPoints.deploy(
        ethers.ZeroAddress,
        await activityPointsContract.getAddress(),
        chatEthRatio
      )
    ).to.be.revertedWith("MONFTClaimActivityPoints: monftMinter cannot be zero address");

    // should revert with zero apAddress
    await expect(
      MONFTClaimActivityPoints.deploy(
        await monftMinterContract.getAddress(),
        ethers.ZeroAddress,
        chatEthRatio
      )
    ).to.be.revertedWith("MONFTClaimActivityPoints: apAddress cannot be zero address");
  });
});

