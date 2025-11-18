// npx hardhat test test/stats/stats.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("Stats", function () {
  let ethers: any;
  let statsContract: any;

  let owner: any, user1: any, user2: any, writer: any;

  before(async function () {
    const connection = await network.connect();
    ethers = connection.ethers;
  });

  beforeEach(async function () {
    [owner, user1, user2, writer] = await ethers.getSigners();

    const Stats = await ethers.getContractFactory("Stats");
    statsContract = await Stats.deploy();
    await statsContract.waitForDeployment();
  });

  it("initializes with zero values", async function () {
    expect(await statsContract.totalVolumeWei()).to.equal(0n);
    expect(await statsContract.getWeiSpent(user1.address)).to.equal(0n);
    expect(await statsContract.weiSpentTotal()).to.equal(0n);
  });

  it("allows owner to set stats writer address", async function () {
    await statsContract.connect(owner).setStatsWriterAddress(writer.address);
    expect(await statsContract.statsWriterAddress()).to.equal(writer.address);
  });

  it("allows owner to add writer using addWriter", async function () {
    await statsContract.connect(owner).addWriter(writer.address);
    expect(await statsContract.statsWriterAddress()).to.equal(writer.address);
  });

  it("allows writer to add wei spent for a user", async function () {
    await statsContract.connect(owner).addWriter(writer.address);
    
    const weiSpent = ethers.parseEther("1.5");
    await statsContract.connect(writer).addWeiSpent(user1.address, weiSpent);

    expect(await statsContract.getWeiSpent(user1.address)).to.equal(weiSpent);
    expect(await statsContract.totalVolumeWei()).to.equal(weiSpent);
    expect(await statsContract.weiSpentTotal()).to.equal(weiSpent);
  });

  it("accumulates wei spent for multiple users", async function () {
    await statsContract.connect(owner).addWriter(writer.address);
    
    const weiSpent1 = ethers.parseEther("1.0");
    const weiSpent2 = ethers.parseEther("2.5");
    
    await statsContract.connect(writer).addWeiSpent(user1.address, weiSpent1);
    await statsContract.connect(writer).addWeiSpent(user2.address, weiSpent2);

    expect(await statsContract.getWeiSpent(user1.address)).to.equal(weiSpent1);
    expect(await statsContract.getWeiSpent(user2.address)).to.equal(weiSpent2);
    expect(await statsContract.totalVolumeWei()).to.equal(weiSpent1 + weiSpent2);
  });

  it("accumulates wei spent for the same user", async function () {
    await statsContract.connect(owner).addWriter(writer.address);
    
    const weiSpent1 = ethers.parseEther("1.0");
    const weiSpent2 = ethers.parseEther("0.5");
    
    await statsContract.connect(writer).addWeiSpent(user1.address, weiSpent1);
    await statsContract.connect(writer).addWeiSpent(user1.address, weiSpent2);

    expect(await statsContract.getWeiSpent(user1.address)).to.equal(weiSpent1 + weiSpent2);
    expect(await statsContract.totalVolumeWei()).to.equal(weiSpent1 + weiSpent2);
  });

  it("prevents non-writer from adding wei spent", async function () {
    await statsContract.connect(owner).addWriter(writer.address);
    
    const weiSpent = ethers.parseEther("1.0");
    
    await expect(
      statsContract.connect(user1).addWeiSpent(user1.address, weiSpent)
    ).to.be.revertedWith("Not a stats writer");
  });

  it("prevents adding wei spent when no writer is set", async function () {
    const weiSpent = ethers.parseEther("1.0");
    
    await expect(
      statsContract.connect(writer).addWeiSpent(user1.address, weiSpent)
    ).to.be.revertedWith("Not a stats writer");
  });

  it("allows owner to change writer address", async function () {
    await statsContract.connect(owner).addWriter(writer.address);
    expect(await statsContract.statsWriterAddress()).to.equal(writer.address);

    const newWriter = ethers.Wallet.createRandom();
    await statsContract.connect(owner).setStatsWriterAddress(newWriter.address);
    expect(await statsContract.statsWriterAddress()).to.equal(newWriter.address);
  });

  it("prevents non-owner from setting writer address", async function () {
    await expect(
      statsContract.connect(user1).setStatsWriterAddress(writer.address)
    ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");
  });

  it("prevents non-owner from adding writer", async function () {
    await expect(
      statsContract.connect(user1).addWriter(writer.address)
    ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");
  });
});

