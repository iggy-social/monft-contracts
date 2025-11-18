// npx hardhat test test/activity-points/activityPoints.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("Activity Points", function () {
  let ethers: any;
  let activityPointsContract: any;
  let statsContract: any;

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

    const ActivityPoints = await ethers.getContractFactory("ActivityPoints");
    activityPointsContract = await ActivityPoints.deploy(
      await statsContract.getAddress(),
      ethers.ZeroAddress,
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

    // add bonus points to user1 via the activity points contract
    // Note: addBonusPoints expects points that already include the multiplier
    const bonusPoints = ethers.parseEther("0.69");
    const tx2 = await activityPointsContract.addBonusPoints(user1.address, bonusPoints);
    await tx2.wait();

    let user1points3 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points3:", ethers.formatEther(user1points3) + " points");
    expect(user1points3).to.equal(weiSpent * multiplier + bonusPoints);

    let user2points3 = await activityPointsContract.getPoints(user2.address);
    console.log("user2 points3:", ethers.formatEther(user2points3) + " points");
    expect(user2points3).to.equal(0n);

    // add bonus points to user2 via the activity points contract
    const bonusPoints2 = ethers.parseEther("4.2069");
    const tx3 = await activityPointsContract.addBonusPoints(user2.address, bonusPoints2);
    await tx3.wait();

    let user1points4 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points4:", ethers.formatEther(user1points4) + " points");
    expect(user1points4).to.equal(weiSpent * multiplier + bonusPoints);

    let user2points4 = await activityPointsContract.getPoints(user2.address);
    console.log("user2 points4:", ethers.formatEther(user2points4) + " points");
    expect(user2points4).to.equal(bonusPoints2);

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
    expect(user1points5).to.equal(weiSpent * multiplier + bonusPoints - bonusPoints3);

    let user2points5 = await activityPointsContract.getPoints(user2.address);
    console.log("user2 points5:", ethers.formatEther(user2points5) + " points");
    expect(user2points5).to.equal(bonusPoints2 - bonusPoints4);

    // add bonus wei spent to user1 via the activity points contract
    // Note: addBonusWei expects wei that does NOT include the multiplier
    const weiSpent2 = ethers.parseEther("0.42");
    const tx6 = await activityPointsContract.addBonusWei(user1.address, weiSpent2);
    await tx6.wait();

    let user1points6 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points6:", ethers.formatEther(user1points6) + " points");
    expect(user1points6).to.equal(BigInt(weiSpent) * BigInt(multiplier) + BigInt(bonusPoints) - BigInt(bonusPoints3) + BigInt(weiSpent2) * BigInt(multiplier));

    // remove the added bonus wei spent from user1 via the activity points contract
    const tx7 = await activityPointsContract.removeBonusWei(user1.address, weiSpent2);
    await tx7.wait();

    let user1points7 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points7:", ethers.formatEther(user1points7) + " points");
    expect(user1points7).to.equal(weiSpent * multiplier + bonusPoints - bonusPoints3);

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
    // totalWeiSpent for user1 = 0.1337
    // So: (0.0063 + 0.1337) * 1000 = 140
    // But wait, let me recalculate:
    // bonusWei added via addBonusPoints: bonusPoints / multiplier = 0.69 / 100 = 0.0069
    // bonusWei removed via removeBonusPoints: bonusPoints3 / multiplier = 0.06 / 100 = 0.0006
    // So bonusWei = 0.0069 - 0.0006 = 0.0063
    // totalWeiSpent = 0.1337
    // total = (0.0063 + 0.1337) * 1000 = 140
    // But the old test expects: weiSpent.mul(multiplier).add(bonusPoints).sub(bonusPoints3).mul(multiplierDiff)
    // = (0.1337 * 100 + 0.69 - 0.06) * 10 = (13.37 + 0.69 - 0.06) * 10 = 14.0 * 10 = 140
    // So the expected value is 140 ETH worth of points = 140 * 10^18
    const multiplierDiff = newMultiplier / multiplier;
    const expectedPoints = (BigInt(weiSpent) * BigInt(multiplier) + BigInt(bonusPoints) - BigInt(bonusPoints3)) * BigInt(multiplierDiff);
    let user1points8 = await activityPointsContract.getPoints(user1.address);
    console.log("user1 points8:", ethers.formatEther(user1points8) + " points");
    expect(user1points8).to.equal(expectedPoints);
  });
});
