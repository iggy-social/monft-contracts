// npx hardhat test test/activity-points/activityPointsAlt.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("Activity Points Alt", function () {
  let ethers: any;
  let activityPointsContract: any;
  let statsContract: any;
  let tldContract: any;

  const multiplier = 100n;

  let owner: any, user1: any, user2: any;

  const calculateGasCosts = (testName: string, receipt: any) => {
    const ethPrice = 4000; // price in USD for calculating gas costs
    const ethGwei = 5;
    const gasCostEthereum = ethers.formatUnits(
      String(Number(ethers.parseUnits(String(ethGwei), "gwei")) * Number(receipt.gasUsed)),
      "ether"
    );
    const gasCostUSD = Number(gasCostEthereum) * ethPrice;
    console.log(`Gas cost for ${testName}: ${gasCostEthereum} ETH (${gasCostUSD} USD)`);
  };

  before(async function () {
    const connection = await network.connect();
    ethers = connection.ethers;
  });

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const Stats = await ethers.getContractFactory("Stats");
    statsContract = await Stats.deploy();
    await statsContract.waitForDeployment();

    await statsContract.addWriter(owner.address);

    const MockPunkTld = await ethers.getContractFactory("MockPunkTld");
    tldContract = await MockPunkTld.deploy(ethers.ZeroAddress, "");
    await tldContract.waitForDeployment();

    const ActivityPointsAlt = await ethers.getContractFactory("ActivityPointsAlt");
    activityPointsContract = await ActivityPointsAlt.deploy(
      await statsContract.getAddress(),
      ethers.ZeroAddress, // _mintedPostsStatsAddress (unused)
      await tldContract.getAddress(),
      multiplier
    );
    await activityPointsContract.waitForDeployment();
  });

  it("shows activity points for users", async function () {
    let user1points1 = await activityPointsContract.getPoints(user1.address);
    expect(user1points1).to.equal(0n);
    console.log("user1 points1:", Number(user1points1));

    let user2points1 = await activityPointsContract.getPoints(user2.address);
    expect(user2points1).to.equal(0n);
    console.log("user2 points1:", Number(user2points1));

    // add wei spent to user1 via the stats contract
    const weiSpent = ethers.parseEther("0.1337");
    const tx1 = await statsContract.addWeiSpent(user1.address, weiSpent);
    await tx1.wait();

    let user1points2 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points2:", ethers.formatEther(user1points2) + " points");
    expect(user1points2).to.equal(weiSpent * multiplier);

    let user2points2 = await activityPointsContract.getPoints(user2.address);
    console.log("user2 points2:", ethers.formatEther(user2points2) + " points");
    expect(user2points2).to.equal(0n);

    // mint domains to user1 (should add points based on weiPerDomain)
    const domainsForUser1 = 3n;
    const txMint1 = await tldContract.mint(user1.address, domainsForUser1);
    await txMint1.wait();

    const weiPerDomain = await activityPointsContract.weiPerDomain();
    const expectedDomainWei = weiPerDomain * domainsForUser1;

    let user1points2b = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points2b (after domains):", ethers.formatEther(user1points2b) + " points");
    expect(user1points2b).to.equal((weiSpent + expectedDomainWei) * multiplier);

    // mint domains to user2
    const domainsForUser2 = 2n;
    const txMint2 = await tldContract.mint(user2.address, domainsForUser2);
    await txMint2.wait();

    const expectedDomainWei2 = weiPerDomain * domainsForUser2;
    let user2points2b = await activityPointsContract.getPoints(user2.address);
    console.log("user2 points2b (after domains):", ethers.formatEther(user2points2b) + " points");
    expect(user2points2b).to.equal(expectedDomainWei2 * multiplier);

    // add bonus points to user1 via the activity points contract
    // Note: addBonusPoints expects points that already include the multiplier
    const bonusPoints = ethers.parseEther("0.69");
    const tx2 = await activityPointsContract.addBonusPoints(user1.address, bonusPoints);
    await tx2.wait();

    let user1points3 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points3:", ethers.formatEther(user1points3) + " points");
    expect(user1points3).to.equal((weiSpent + expectedDomainWei) * multiplier + bonusPoints);

    let user2points3 = await activityPointsContract.getPoints(user2.address);
    console.log("user2 points3:", ethers.formatEther(user2points3) + " points");
    expect(user2points3).to.equal(expectedDomainWei2 * multiplier);

    // add bonus points to user2 via the activity points contract
    const bonusPoints2 = ethers.parseEther("4.2069");
    const tx3 = await activityPointsContract.addBonusPoints(user2.address, bonusPoints2);
    await tx3.wait();

    let user1points4 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points4:", ethers.formatEther(user1points4) + " points");
    expect(user1points4).to.equal((weiSpent + expectedDomainWei) * multiplier + bonusPoints);

    let user2points4 = await activityPointsContract.getPoints(user2.address);
    console.log("user2 points4:", ethers.formatEther(user2points4) + " points");
    expect(user2points4).to.equal(expectedDomainWei2 * multiplier + bonusPoints2);

    // remove 0.06 bonus points from user1 via the activity points contract
    const bonusPoints3 = ethers.parseEther("0.06");
    const tx4 = await activityPointsContract.removeBonusPoints(user1.address, bonusPoints3);
    await tx4.wait();

    // remove 0.0069 bonus points from user2 via the activity points contract
    const bonusPoints4 = ethers.parseEther("0.0069");
    const tx5 = await activityPointsContract.removeBonusPoints(user2.address, bonusPoints4);
    await tx5.wait();

    let user1points5 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points5:", ethers.formatEther(user1points5) + " points");
    expect(user1points5).to.equal((weiSpent + expectedDomainWei) * multiplier + bonusPoints - bonusPoints3);

    let user2points5 = await activityPointsContract.getPoints(user2.address);
    console.log("user2 points5:", ethers.formatEther(user2points5) + " points");
    expect(user2points5).to.equal(expectedDomainWei2 * multiplier + bonusPoints2 - bonusPoints4);

    // add bonus wei spent to user1 via the activity points contract
    // Note: addBonusWei expects wei that does NOT include the multiplier
    const weiSpent2 = ethers.parseEther("0.42");
    const tx6 = await activityPointsContract.addBonusWei(user1.address, weiSpent2);
    await tx6.wait();

    let user1points6 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points6:", ethers.formatEther(user1points6) + " points");
    expect(user1points6).to.equal(BigInt(weiSpent) * BigInt(multiplier) + BigInt(expectedDomainWei) * BigInt(multiplier) + BigInt(bonusPoints) - BigInt(bonusPoints3) + BigInt(weiSpent2) * BigInt(multiplier));

    // remove the added bonus wei spent from user1 via the activity points contract
    const tx7 = await activityPointsContract.removeBonusWei(user1.address, weiSpent2);
    await tx7.wait();

    let user1points7 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points7:", ethers.formatEther(user1points7) + " points");
    expect(user1points7).to.equal((weiSpent + expectedDomainWei) * multiplier + bonusPoints - bonusPoints3);

    // fail at removing more bonus wei spent than user1 has
    const weiSpent3 = ethers.parseEther("1000");
    await expect(
      activityPointsContract.removeBonusWei(user1.address, weiSpent3)
    ).to.be.revertedWith("ActivityPoints: not enough bonus wei");

    // fail at removing more bonus points than user1 has
    await expect(
      activityPointsContract.removeBonusPoints(user1.address, weiSpent3)
    ).to.be.revertedWith("ActivityPoints: not enough bonus points");

    // check multiplier
    const multiplierBefore = await activityPointsContract.multiplier();
    console.log("Multiplier before:", Number(multiplierBefore));

    // owner change multiplier
    const newMultiplier = 1000n;
    const tx8 = await activityPointsContract.setMultiplier(newMultiplier);
    await tx8.wait();

    const multiplierAfter = await activityPointsContract.multiplier();
    console.log("Multiplier after:", Number(multiplierAfter));
    expect(multiplierAfter).to.equal(newMultiplier);

    // check points after multiplier change
    // The points should be recalculated with the new multiplier
    // Formula: (bonusWei + totalWeiSpent) * newMultiplier
    // bonusWei for user1 = (bonusPoints - bonusPoints3) / oldMultiplier = (0.69 - 0.06) / 100 = 0.0063
    // totalWeiSpent for user1 = 0.1337 + (domains * weiPerDomain)
    // So: (0.0063 + 0.1337 + expectedDomainWei) * 1000
    const multiplierDiff = newMultiplier / multiplier;
    const expectedPoints = (BigInt(weiSpent) * BigInt(multiplier) + BigInt(expectedDomainWei) * BigInt(multiplier) + BigInt(bonusPoints) - BigInt(bonusPoints3)) * BigInt(multiplierDiff);
    let user1points8 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points8:", ethers.formatEther(user1points8) + " points");
    expect(user1points8).to.equal(expectedPoints);
  });

  it("calculates points from domains correctly", async function () {
    const weiPerDomain = await activityPointsContract.weiPerDomain();
    console.log("weiPerDomain:", Number(weiPerDomain));

    // Initially no domains, no points
    let user1points = await activityPointsContract.getPoints(user1.address);
    expect(user1points).to.equal(0n);

    // Mint 5 domains to user1
    const domains1 = 5n;
    await tldContract.mint(user1.address, domains1);
    
    user1points = await activityPointsContract.getPoints(user1.address);
    const expectedPoints1 = weiPerDomain * domains1 * multiplier;
    expect(user1points).to.equal(expectedPoints1);
    console.log("user1 points with 5 domains:", ethers.formatEther(user1points) + " points");

    // Mint 3 more domains to user1
    const domains2 = 3n;
    await tldContract.mint(user1.address, domains2);
    
    user1points = await activityPointsContract.getPoints(user1.address);
    const expectedPoints2 = weiPerDomain * (domains1 + domains2) * multiplier;
    expect(user1points).to.equal(expectedPoints2);
    console.log("user1 points with 8 domains:", ethers.formatEther(user1points) + " points");

    // Mint domains to user2
    const domains3 = 2n;
    await tldContract.mint(user2.address, domains3);
    
    let user2points = await activityPointsContract.getPoints(user2.address);
    const expectedPoints3 = weiPerDomain * domains3 * multiplier;
    expect(user2points).to.equal(expectedPoints3);
    console.log("user2 points with 2 domains:", ethers.formatEther(user2points) + " points");
  });

  it("calculates total points for all users correctly", async function () {
    // Add wei spent to user1
    const weiSpent1 = ethers.parseEther("1.0");
    await statsContract.addWeiSpent(user1.address, weiSpent1);

    // Add wei spent to user2
    const weiSpent2 = ethers.parseEther("2.0");
    await statsContract.addWeiSpent(user2.address, weiSpent2);

    // Mint domains
    await tldContract.mint(user1.address, 3n);
    await tldContract.mint(user2.address, 2n);

    const weiPerDomain = await activityPointsContract.weiPerDomain();
    const totalDomainWei = weiPerDomain * 5n; // 3 + 2 domains
    const totalStatsWei = weiSpent1 + weiSpent2;

    const totalPoints = await activityPointsContract.getTotalPointsAllUsers();
    const expectedTotalPoints = (totalStatsWei + totalDomainWei) * multiplier;
    expect(totalPoints).to.equal(expectedTotalPoints);
    console.log("Total points for all users:", ethers.formatEther(totalPoints) + " points");
  });

  it("allows owner to set weiPerDomain", async function () {
    const newWeiPerDomain = ethers.parseEther("0.001");
    
    // Set new weiPerDomain
    const tx = await activityPointsContract.setWeiPerDomain(newWeiPerDomain);
    await tx.wait();

    const weiPerDomainAfter = await activityPointsContract.weiPerDomain();
    expect(weiPerDomainAfter).to.equal(newWeiPerDomain);

    // Mint a domain and verify points calculation uses new value
    await tldContract.mint(user1.address, 1n);
    
    const user1points = await activityPointsContract.getPoints(user1.address);
    const expectedPoints = newWeiPerDomain * multiplier;
    expect(user1points).to.equal(expectedPoints);
    console.log("user1 points with new weiPerDomain:", ethers.formatEther(user1points) + " points");
  });

  it("allows owner to set statsAddress", async function () {
    // Create a new stats contract
    const Stats2 = await ethers.getContractFactory("Stats");
    const statsContract2 = await Stats2.deploy();
    await statsContract2.waitForDeployment();
    await statsContract2.addWriter(owner.address);

    // Set new stats address
    const tx = await activityPointsContract.setStatsAddress(await statsContract2.getAddress());
    await tx.wait();

    const statsAddressAfter = await activityPointsContract.statsAddress();
    expect(statsAddressAfter).to.equal(await statsContract2.getAddress());

    // Add wei spent via new stats contract
    const weiSpent = ethers.parseEther("0.5");
    await statsContract2.addWeiSpent(user1.address, weiSpent);

    const user1points = await activityPointsContract.getPoints(user1.address);
    expect(user1points).to.equal(weiSpent * multiplier);
    console.log("user1 points from new stats contract:", ethers.formatEther(user1points) + " points");
  });
});

