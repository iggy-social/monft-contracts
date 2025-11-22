// npx hardhat test test/names/minter.test.ts

import { expect } from "chai";
import { network } from "hardhat";

function calculateGasCosts(testName: string, receipt: any, ethers: any) {
  console.log(testName + " gasUsed: " + receipt.gasUsed);

  // coin prices in USD
  const eth = 3000;

  const gasCostEthereum = ethers.formatUnits(
    String(Number(ethers.parseUnits("1", "gwei")) * Number(receipt.gasUsed)),
    "ether"
  );
  const gasCostArbitrum = ethers.formatUnits(
    String(Number(ethers.parseUnits("0.02", "gwei")) * Number(receipt.gasUsed)),
    "ether"
  );

  console.log(testName + " gas cost (Ethereum): $" + String(Number(gasCostEthereum) * eth));
  console.log(testName + " gas cost (Arbitrum): $" + String(Number(gasCostArbitrum) * eth));
}

describe("MONFTNameMinter", function () {
  let ethers: any;
  let tldContract: any;
  let minterContract: any;
  let factoryContract: any;
  let metadataContract: any;
  let forbTldsContract: any;
  let statsContract: any;
  let statsMiddlewareContract: any;

  let owner: any;
  let user1: any;
  let user2: any;
  let referrer: any;
  let manager: any;
  let revenueAddress: any;
  let provider: any;

  const tldName = ".monft";
  const tldSymbol = "MONFT";
  let tldPrice: any;

  let price1char: any;
  let price2char: any;
  let price3char: any;
  let price4char: any;
  let price5char: any;

  before(async function () {
    const connection = await network.connect();
    ethers = connection.ethers;
    provider = ethers.provider;
    tldPrice = ethers.parseEther("0"); // price in TLD contract must be 0 for minter to work
    price1char = ethers.parseEther("1");
    price2char = ethers.parseEther("0.5");
    price3char = ethers.parseEther("0.1");
    price4char = ethers.parseEther("0.05");
    price5char = ethers.parseEther("0.01");
  });

  beforeEach(async function () {
    [owner, user1, user2, referrer, manager, revenueAddress] = await ethers.getSigners();

    // Deploy PunkForbiddenTlds
    const PunkForbiddenTlds = await ethers.getContractFactory("PunkForbiddenTlds");
    forbTldsContract = await PunkForbiddenTlds.deploy();
    await forbTldsContract.waitForDeployment();

    // Deploy FlexiPunkMetadata
    const FlexiPunkMetadata = await ethers.getContractFactory("FlexiPunkMetadata");
    metadataContract = await FlexiPunkMetadata.deploy();
    await metadataContract.waitForDeployment();

    // Deploy FlexiPunkTLDFactory
    const PunkTLDFactory = await ethers.getContractFactory("FlexiPunkTLDFactory");
    const priceToCreateTld = ethers.parseEther("1");
    factoryContract = await PunkTLDFactory.deploy(
      priceToCreateTld,
      await forbTldsContract.getAddress(),
      await metadataContract.getAddress()
    );
    await factoryContract.waitForDeployment();

    await forbTldsContract.addFactoryAddress(await factoryContract.getAddress());

    // Create TLD
    const tx = await factoryContract.ownerCreateTld(
      tldName,
      tldSymbol,
      owner.address,
      tldPrice,
      false // buying disabled initially
    );
    await tx.wait();

    // Get TLD contract address
    const tldContractAddress = await factoryContract.tldNamesAddresses(tldName);
    tldContract = await ethers.getContractAt("FlexiPunkTLD", tldContractAddress);

    // Deploy Stats contract
    const Stats = await ethers.getContractFactory("Stats");
    statsContract = await Stats.deploy();
    await statsContract.waitForDeployment();

    // Deploy StatsMiddleware contract
    const StatsMiddleware = await ethers.getContractFactory("StatsMiddleware");
    statsMiddlewareContract = await StatsMiddleware.deploy(await statsContract.getAddress());
    await statsMiddlewareContract.waitForDeployment();

    // Set StatsMiddleware as writer in Stats contract
    await statsContract.addWriter(await statsMiddlewareContract.getAddress());

    // Deploy MONFTNameMinter
    const MONFTNameMinter = await ethers.getContractFactory("MONFTNameMinter");
    minterContract = await MONFTNameMinter.deploy(
      revenueAddress.address,
      await statsMiddlewareContract.getAddress(),
      await tldContract.getAddress(),
      price1char,
      price2char,
      price3char,
      price4char,
      price5char
    );
    await minterContract.waitForDeployment();

    // Add minter as writer in StatsMiddleware
    await statsMiddlewareContract.addWriter(await minterContract.getAddress());

    // Set minter address in TLD contract
    await tldContract.changeMinter(await minterContract.getAddress());

    // Unpause the minter
    await minterContract.togglePaused();
  });

  it("should initialize with correct values", async function () {
    expect(await minterContract.revenueAddress()).to.equal(revenueAddress.address);
    expect(await minterContract.statsAddress()).to.equal(await statsMiddlewareContract.getAddress());
    expect(await minterContract.tldContract()).to.equal(await tldContract.getAddress());
    expect(await minterContract.price1char()).to.equal(price1char);
    expect(await minterContract.price2char()).to.equal(price2char);
    expect(await minterContract.price3char()).to.equal(price3char);
    expect(await minterContract.price4char()).to.equal(price4char);
    expect(await minterContract.price5char()).to.equal(price5char);
    expect(await minterContract.referralFee()).to.equal(1000); // 10% default
    expect(await minterContract.paused()).to.equal(false);
  });

  it("should mint 1-character domain", async function () {
    const domainName = "a";
    const balanceBefore = await provider.getBalance(revenueAddress.address);

    const tx = await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price1char,
    });
    const receipt = await tx.wait();
    calculateGasCosts("Mint 1-char domain", receipt, ethers);

    const domain = await tldContract.domains(domainName);
    expect(domain.name).to.equal(domainName);
    expect(domain.holder).to.equal(user1.address);

    const balanceAfter = await provider.getBalance(revenueAddress.address);
    expect(balanceAfter - balanceBefore).to.equal(price1char);
  });

  it("should mint 2-character domain", async function () {
    const domainName = "ab";
    const balanceBefore = await provider.getBalance(revenueAddress.address);

    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price2char,
    });

    const domain = await tldContract.domains(domainName);
    expect(domain.name).to.equal(domainName);
    expect(domain.holder).to.equal(user1.address);

    const balanceAfter = await provider.getBalance(revenueAddress.address);
    expect(balanceAfter - balanceBefore).to.equal(price2char);
  });

  it("should mint 3-character domain", async function () {
    const domainName = "abc";
    const balanceBefore = await provider.getBalance(revenueAddress.address);

    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price3char,
    });

    const domain = await tldContract.domains(domainName);
    expect(domain.name).to.equal(domainName);
    expect(domain.holder).to.equal(user1.address);

    const balanceAfter = await provider.getBalance(revenueAddress.address);
    expect(balanceAfter - balanceBefore).to.equal(price3char);
  });

  it("should mint 4-character domain", async function () {
    const domainName = "abcd";
    const balanceBefore = await provider.getBalance(revenueAddress.address);

    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price4char,
    });

    const domain = await tldContract.domains(domainName);
    expect(domain.name).to.equal(domainName);
    expect(domain.holder).to.equal(user1.address);

    const balanceAfter = await provider.getBalance(revenueAddress.address);
    expect(balanceAfter - balanceBefore).to.equal(price4char);
  });

  it("should mint 5+ character domain", async function () {
    const domainName = "abcde";
    const balanceBefore = await provider.getBalance(revenueAddress.address);

    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price5char,
    });

    const domain = await tldContract.domains(domainName);
    expect(domain.name).to.equal(domainName);
    expect(domain.holder).to.equal(user1.address);

    const balanceAfter = await provider.getBalance(revenueAddress.address);
    expect(balanceAfter - balanceBefore).to.equal(price5char);
  });

  it("should mint long domain (5+ chars)", async function () {
    const domainName = "verylongdomainname";
    const balanceBefore = await provider.getBalance(revenueAddress.address);

    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price5char,
    });

    const domain = await tldContract.domains(domainName);
    expect(domain.name).to.equal(domainName.toLowerCase());
    expect(domain.holder).to.equal(user1.address);

    const balanceAfter = await provider.getBalance(revenueAddress.address);
    expect(balanceAfter - balanceBefore).to.equal(price5char);
  });

  it("should send referral fee when referrer is provided", async function () {
    const domainName = "test123";
    const referrerBalanceBefore = await provider.getBalance(referrer.address);
    const revenueBalanceBefore = await provider.getBalance(revenueAddress.address);

    await minterContract.connect(user1).mint(domainName, user1.address, referrer.address, {
      value: price5char,
    });

    const referrerBalanceAfter = await provider.getBalance(referrer.address);
    const revenueBalanceAfter = await provider.getBalance(revenueAddress.address);

    const expectedReferralFee = (price5char * 1000n) / 10000n; // 10% = 1000 bips
    expect(referrerBalanceAfter - referrerBalanceBefore).to.equal(expectedReferralFee);
    expect(revenueBalanceAfter - revenueBalanceBefore).to.equal(price5char - expectedReferralFee);
  });

  it("should not send referral fee when referrer is zero address", async function () {
    const domainName = "test123";
    const revenueBalanceBefore = await provider.getBalance(revenueAddress.address);

    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price5char,
    });

    const revenueBalanceAfter = await provider.getBalance(revenueAddress.address);
    expect(revenueBalanceAfter - revenueBalanceBefore).to.equal(price5char);
  });

  it("should not send referral fee when referral fee is zero", async function () {
    await minterContract.changeReferralFee(0);

    const domainName = "test123";
    const referrerBalanceBefore = await provider.getBalance(referrer.address);
    const revenueBalanceBefore = await provider.getBalance(revenueAddress.address);

    await minterContract.connect(user1).mint(domainName, user1.address, referrer.address, {
      value: price5char,
    });

    const referrerBalanceAfter = await provider.getBalance(referrer.address);
    const revenueBalanceAfter = await provider.getBalance(revenueAddress.address);

    expect(referrerBalanceAfter - referrerBalanceBefore).to.equal(0n);
    expect(revenueBalanceAfter - revenueBalanceBefore).to.equal(price5char);
  });

  it("should revert when minting is paused", async function () {
    await minterContract.togglePaused();
    expect(await minterContract.paused()).to.equal(true);

    await expect(
      minterContract.connect(user1).mint("test123", user1.address, ethers.ZeroAddress, {
        value: price5char,
      })
    ).to.be.revertedWith("Minting paused");
  });

  it("should revert when payment is too low", async function () {
    await expect(
      minterContract.connect(user1).mint("test123", user1.address, ethers.ZeroAddress, {
        value: price5char - 1n,
      })
    ).to.be.revertedWith("Value below price");
  });

  it("should accept payment higher than required price", async function () {
    const domainName = "test123";
    const extraPayment = ethers.parseEther("0.001");
    const revenueBalanceBefore = await provider.getBalance(revenueAddress.address);

    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price5char + extraPayment,
    });

    const domain = await tldContract.domains(domainName);
    expect(domain.name).to.equal(domainName);
    expect(domain.holder).to.equal(user1.address);

    const revenueBalanceAfter = await provider.getBalance(revenueAddress.address);
    expect(revenueBalanceAfter - revenueBalanceBefore).to.equal(price5char + extraPayment);
  });

  it("should allow owner to change price for 1-char domains", async function () {
    const newPrice = ethers.parseEther("2");
    await minterContract.changePrice(newPrice, 1);
    expect(await minterContract.price1char()).to.equal(newPrice);
  });

  it("should allow owner to change price for 2-char domains", async function () {
    const newPrice = ethers.parseEther("1");
    await minterContract.changePrice(newPrice, 2);
    expect(await minterContract.price2char()).to.equal(newPrice);
  });

  it("should allow owner to change price for 3-char domains", async function () {
    const newPrice = ethers.parseEther("0.2");
    await minterContract.changePrice(newPrice, 3);
    expect(await minterContract.price3char()).to.equal(newPrice);
  });

  it("should allow owner to change price for 4-char domains", async function () {
    const newPrice = ethers.parseEther("0.1");
    await minterContract.changePrice(newPrice, 4);
    expect(await minterContract.price4char()).to.equal(newPrice);
  });

  it("should allow owner to change price for 5+ char domains", async function () {
    const newPrice = ethers.parseEther("0.02");
    await minterContract.changePrice(newPrice, 5);
    expect(await minterContract.price5char()).to.equal(newPrice);
  });

  it("should revert when changing price to zero", async function () {
    await expect(minterContract.changePrice(0, 1)).to.be.revertedWith("Cannot be zero");
  });

  it("should allow owner to change referral fee", async function () {
    const newReferralFee = 1500; // 15%
    await minterContract.changeReferralFee(newReferralFee);
    expect(await minterContract.referralFee()).to.equal(newReferralFee);
  });

  it("should revert when referral fee exceeds 20%", async function () {
    await expect(minterContract.changeReferralFee(2001)).to.be.revertedWith("Cannot exceed 20%");
  });

  it("should allow referral fee of exactly 20%", async function () {
    await minterContract.changeReferralFee(2000);
    expect(await minterContract.referralFee()).to.equal(2000);
  });

  it("should allow owner to free mint", async function () {
    const domainName = "freemint";
    const tx = await minterContract.ownerFreeMint(domainName, user1.address);
    const receipt = await tx.wait();
    calculateGasCosts("Owner free mint", receipt, ethers);

    const domain = await tldContract.domains(domainName);
    expect(domain.name).to.equal(domainName);
    expect(domain.holder).to.equal(user1.address);
  });

  it("should allow manager to free mint", async function () {
    await minterContract.addManager(manager.address);

    const domainName = "managermint";
    await minterContract.connect(manager).ownerFreeMint(domainName, user1.address);

    const domain = await tldContract.domains(domainName);
    expect(domain.name).to.equal(domainName);
    expect(domain.holder).to.equal(user1.address);
  });

  it("should revert when non-owner tries to free mint", async function () {
    await expect(
      minterContract.connect(user1).ownerFreeMint("test", user1.address)
    ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");
  });

  it("should allow owner to set revenue address", async function () {
    const newRevenueAddress = user2.address;
    await minterContract.setRevenueAddress(newRevenueAddress);
    expect(await minterContract.revenueAddress()).to.equal(newRevenueAddress);
  });

  it("should allow owner to set stats address", async function () {
    // Deploy a new StatsMiddleware for testing
    const StatsMiddleware = await ethers.getContractFactory("StatsMiddleware");
    const newStatsMiddleware = await StatsMiddleware.deploy(await statsContract.getAddress());
    await newStatsMiddleware.waitForDeployment();

    await statsContract.addWriter(await newStatsMiddleware.getAddress());
    await newStatsMiddleware.addWriter(await minterContract.getAddress());

    await minterContract.setStatsAddress(await newStatsMiddleware.getAddress());
    expect(await minterContract.statsAddress()).to.equal(await newStatsMiddleware.getAddress());
  });

  it("should revert when non-owner tries to set stats address", async function () {
    await expect(
      minterContract.connect(user1).setStatsAddress(user2.address)
    ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");
  });

  it("should revert when non-owner tries to set revenue address", async function () {
    await expect(
      minterContract.connect(user1).setRevenueAddress(user2.address)
    ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");
  });

  it("should send funds to new revenue address after change", async function () {
    const newRevenueAddress = user2.address;
    await minterContract.setRevenueAddress(newRevenueAddress);

    const domainName = "test123";
    const balanceBefore = await provider.getBalance(newRevenueAddress);

    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price5char,
    });

    const balanceAfter = await provider.getBalance(newRevenueAddress);
    expect(balanceAfter - balanceBefore).to.equal(price5char);
  });

  it("should allow owner to toggle paused", async function () {
    expect(await minterContract.paused()).to.equal(false);
    await minterContract.togglePaused();
    expect(await minterContract.paused()).to.equal(true);
    await minterContract.togglePaused();
    expect(await minterContract.paused()).to.equal(false);
  });

  it("should revert when non-owner tries to toggle paused", async function () {
    await expect(minterContract.connect(user1).togglePaused()).to.be.revertedWith(
      "OwnableWithManagers: caller is not a manager or owner"
    );
  });

  it("should allow owner to withdraw ETH", async function () {
    // Send some ETH to the contract
    await owner.sendTransaction({
      to: await minterContract.getAddress(),
      value: ethers.parseEther("1"),
    });

    const contractBalanceBefore = await provider.getBalance(await minterContract.getAddress());
    const revenueBalanceBefore = await provider.getBalance(revenueAddress.address);

    expect(contractBalanceBefore).to.equal(ethers.parseEther("1"));

    await minterContract.withdraw();

    const contractBalanceAfter = await provider.getBalance(await minterContract.getAddress());
    const revenueBalanceAfter = await provider.getBalance(revenueAddress.address);

    expect(contractBalanceAfter).to.equal(0n);
    expect(revenueBalanceAfter - revenueBalanceBefore).to.equal(ethers.parseEther("1"));
  });

  it("should revert when non-owner tries to withdraw", async function () {
    await expect(minterContract.connect(user1).withdraw()).to.be.revertedWith(
      "OwnableWithManagers: caller is not a manager or owner"
    );
  });

  it("should allow owner to recover ERC20 tokens", async function () {
    // Deploy a mock ERC20 token
    const MockErc20TokenDecimals = await ethers.getContractFactory("MockErc20TokenDecimals");
    const mockToken = await MockErc20TokenDecimals.deploy("Mock Token", "MT", 18);
    await mockToken.waitForDeployment();

    // Send tokens to the minter contract
    const recoverAmount = ethers.parseEther("100");
    await mockToken.mint(await minterContract.getAddress(), recoverAmount);

    const ownerBalanceBefore = await mockToken.balanceOf(owner.address);
    await minterContract.recoverERC20(await mockToken.getAddress(), recoverAmount, owner.address);
    const ownerBalanceAfter = await mockToken.balanceOf(owner.address);

    expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(recoverAmount);
  });

  it("should revert when non-owner tries to recover ERC20", async function () {
    const MockErc20TokenDecimals = await ethers.getContractFactory("MockErc20TokenDecimals");
    const mockToken = await MockErc20TokenDecimals.deploy("Mock Token", "MT", 18);
    await mockToken.waitForDeployment();

    await expect(
      minterContract.connect(user1).recoverERC20(await mockToken.getAddress(), ethers.parseEther("1"), user1.address)
    ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");
  });

  it("should mint even when TLD buying is disabled (minter can bypass)", async function () {
    // Ensure TLD buying is disabled
    expect(await tldContract.buyingEnabled()).to.equal(false);

    // Minter should still be able to mint
    const domainName = "bypass";
    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price5char,
    });

    const domain = await tldContract.domains(domainName);
    expect(domain.name).to.equal(domainName);
    expect(domain.holder).to.equal(user1.address);
  });

  it("should return token ID when minting", async function () {
    const domainName = "test123";
    const tx = await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price5char,
    });
    const receipt = await tx.wait();

    // Parse the return value from the transaction
    const domain = await tldContract.domains(domainName);
    expect(domain.tokenId).to.be.greaterThan(0n);
  });

  it("should handle multiple mints correctly", async function () {
    const domain1 = "test1";
    const domain2 = "test2";
    const domain3 = "test3";

    await minterContract.connect(user1).mint(domain1, user1.address, ethers.ZeroAddress, {
      value: price5char,
    });
    await minterContract.connect(user2).mint(domain2, user2.address, ethers.ZeroAddress, {
      value: price5char,
    });
    await minterContract.connect(user1).mint(domain3, user1.address, ethers.ZeroAddress, {
      value: price5char,
    });

    const domainData1 = await tldContract.domains(domain1);
    const domainData2 = await tldContract.domains(domain2);
    const domainData3 = await tldContract.domains(domain3);

    expect(domainData1.holder).to.equal(user1.address);
    expect(domainData2.holder).to.equal(user2.address);
    expect(domainData3.holder).to.equal(user1.address);
  });

  it("should update stats when minting", async function () {
    const domainName = "stats";
    const weiSpentBefore = await statsMiddlewareContract.getWeiSpent(user1.address);
    const totalWeiSpentBefore = await statsMiddlewareContract.weiSpentTotal();

    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price5char,
    });

    const weiSpentAfter = await statsMiddlewareContract.getWeiSpent(user1.address);
    const totalWeiSpentAfter = await statsMiddlewareContract.weiSpentTotal();

    // selectedPrice should be price5char (no referrer, so full amount)
    expect(weiSpentAfter - weiSpentBefore).to.equal(price5char);
    expect(totalWeiSpentAfter - totalWeiSpentBefore).to.equal(price5char);
  });

  it("should update stats correctly when referrer is provided", async function () {
    const domainName = "statsref";
    const weiSpentBefore = await statsMiddlewareContract.getWeiSpent(user1.address);
    const totalWeiSpentBefore = await statsMiddlewareContract.weiSpentTotal();

    await minterContract.connect(user1).mint(domainName, user1.address, referrer.address, {
      value: price5char,
    });

    const weiSpentAfter = await statsMiddlewareContract.getWeiSpent(user1.address);
    const totalWeiSpentAfter = await statsMiddlewareContract.weiSpentTotal();

    // selectedPrice should be price5char - referralFee
    const expectedReferralFee = (price5char * 1000n) / 10000n;
    const expectedSelectedPrice = price5char - expectedReferralFee;

    expect(weiSpentAfter - weiSpentBefore).to.equal(expectedSelectedPrice);
    expect(totalWeiSpentAfter - totalWeiSpentBefore).to.equal(expectedSelectedPrice);
  });

  it("should not update stats when stats address is zero", async function () {
    // Set stats address to zero
    await minterContract.setStatsAddress(ethers.ZeroAddress);

    const domainName = "nostats";
    const weiSpentBefore = await statsMiddlewareContract.getWeiSpent(user1.address);

    // Should still mint successfully
    await minterContract.connect(user1).mint(domainName, user1.address, ethers.ZeroAddress, {
      value: price5char,
    });

    // Stats should not be updated
    const weiSpentAfter = await statsMiddlewareContract.getWeiSpent(user1.address);
    expect(weiSpentAfter - weiSpentBefore).to.equal(0n);
  });
});

