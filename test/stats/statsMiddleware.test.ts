// npx hardhat test test/stats/statsMiddleware.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("StatsMiddleware", function () {
  let ethers: any;
  let statsContract: any;
  let middlewareContract: any;

  let owner: any, user1: any, user2: any, writer1: any, writer2: any;

  before(async function () {
    const connection = await network.connect();
    ethers = connection.ethers;
  });

  beforeEach(async function () {
    [owner, user1, user2, writer1, writer2] = await ethers.getSigners();

    const Stats = await ethers.getContractFactory("Stats");
    statsContract = await Stats.deploy();
    await statsContract.waitForDeployment();

    const StatsMiddleware = await ethers.getContractFactory("StatsMiddleware");
    middlewareContract = await StatsMiddleware.deploy(await statsContract.getAddress());
    await middlewareContract.waitForDeployment();

    // Set middleware as writer in stats contract
    await statsContract.connect(owner).addWriter(await middlewareContract.getAddress());
  });

  it("initializes with correct stats address", async function () {
    expect(await middlewareContract.statsAddress()).to.equal(await statsContract.getAddress());
  });

  it("allows owner to add writer", async function () {
    await middlewareContract.connect(owner).addWriter(writer1.address);
    expect(await middlewareContract.writers(writer1.address)).to.be.true;
  });

  it("allows owner to remove writer", async function () {
    await middlewareContract.connect(owner).addWriter(writer1.address);
    expect(await middlewareContract.writers(writer1.address)).to.be.true;

    await middlewareContract.connect(owner).removeWriter(writer1.address);
    expect(await middlewareContract.writers(writer1.address)).to.be.false;
  });

  it("allows writer to add wei spent through middleware", async function () {
    await middlewareContract.connect(owner).addWriter(writer1.address);
    
    const weiSpent = ethers.parseEther("2.0");
    await middlewareContract.connect(writer1).addWeiSpent(user1.address, weiSpent);

    expect(await middlewareContract.getWeiSpent(user1.address)).to.equal(weiSpent);
    expect(await middlewareContract.weiSpentTotal()).to.equal(weiSpent);
    expect(await statsContract.getWeiSpent(user1.address)).to.equal(weiSpent);
  });

  it("accumulates wei spent for multiple users through middleware", async function () {
    await middlewareContract.connect(owner).addWriter(writer1.address);
    
    const weiSpent1 = ethers.parseEther("1.0");
    const weiSpent2 = ethers.parseEther("3.0");
    
    await middlewareContract.connect(writer1).addWeiSpent(user1.address, weiSpent1);
    await middlewareContract.connect(writer1).addWeiSpent(user2.address, weiSpent2);

    expect(await middlewareContract.getWeiSpent(user1.address)).to.equal(weiSpent1);
    expect(await middlewareContract.getWeiSpent(user2.address)).to.equal(weiSpent2);
    expect(await middlewareContract.weiSpentTotal()).to.equal(weiSpent1 + weiSpent2);
  });

  it("allows writer to add another writer", async function () {
    await middlewareContract.connect(owner).addWriter(writer1.address);
    
    await middlewareContract.connect(writer1).addWriterByWriter(writer2.address);
    expect(await middlewareContract.writers(writer2.address)).to.be.true;
  });

  it("allows new writer added by writer to add wei spent", async function () {
    await middlewareContract.connect(owner).addWriter(writer1.address);
    await middlewareContract.connect(writer1).addWriterByWriter(writer2.address);
    
    const weiSpent = ethers.parseEther("1.5");
    await middlewareContract.connect(writer2).addWeiSpent(user1.address, weiSpent);

    expect(await middlewareContract.getWeiSpent(user1.address)).to.equal(weiSpent);
  });

  it("prevents non-writer from adding wei spent", async function () {
    await middlewareContract.connect(owner).addWriter(writer1.address);
    
    const weiSpent = ethers.parseEther("1.0");
    
    await expect(
      middlewareContract.connect(user1).addWeiSpent(user1.address, weiSpent)
    ).to.be.revertedWith("Not a writer contract");
  });

  it("prevents non-writer from adding another writer", async function () {
    await middlewareContract.connect(owner).addWriter(writer1.address);
    
    await expect(
      middlewareContract.connect(user1).addWriterByWriter(writer2.address)
    ).to.be.revertedWith("Not a writer contract");
  });

  it("prevents removed writer from adding wei spent", async function () {
    await middlewareContract.connect(owner).addWriter(writer1.address);
    await middlewareContract.connect(owner).removeWriter(writer1.address);
    
    const weiSpent = ethers.parseEther("1.0");
    
    await expect(
      middlewareContract.connect(writer1).addWeiSpent(user1.address, weiSpent)
    ).to.be.revertedWith("Not a writer contract");
  });

  it("allows owner to change stats address", async function () {
    const Stats = await ethers.getContractFactory("Stats");
    const newStatsContract = await Stats.deploy();
    await newStatsContract.waitForDeployment();
    await newStatsContract.connect(owner).addWriter(await middlewareContract.getAddress());

    await middlewareContract.connect(owner).setStatsAddress(await newStatsContract.getAddress());
    expect(await middlewareContract.statsAddress()).to.equal(await newStatsContract.getAddress());
  });

  it("prevents non-owner from setting stats address", async function () {
    await expect(
      middlewareContract.connect(user1).setStatsAddress(user1.address)
    ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");
  });

  it("prevents non-owner from adding writer", async function () {
    await expect(
      middlewareContract.connect(user1).addWriter(writer1.address)
    ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");
  });

  it("prevents non-owner from removing writer", async function () {
    await middlewareContract.connect(owner).addWriter(writer1.address);
    
    await expect(
      middlewareContract.connect(user1).removeWriter(writer1.address)
    ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");
  });
});

