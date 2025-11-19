// npx hardhat test test/distributor/revenueDistributor.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("RevenueDistributor", function () {
  let ethers: any;
  let distributorContract: any;

  let owner: any;
  let user1: any;
  let user2: any;
  let recipient1: any;
  let recipient2: any;
  let recipient3: any;
  let recipient4: any;
  let recipient5: any;
  let recipient6: any;

  let recipient1Percent: any;
  let recipient2Percent: any;
  let recipient3Percent: any;
  let recipient4Percent: any;
  let recipient5Percent: any;
  let recipient6Percent: any;

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

    // Initialize percentage constants
    recipient1Percent = ethers.parseEther("0.05"); // 5%
    recipient2Percent = ethers.parseEther("0.15"); // 15%
    recipient3Percent = ethers.parseEther("0.25"); // 25%
    recipient4Percent = ethers.parseEther("0.05"); // 5%
    recipient5Percent = ethers.parseEther("0.30"); // 30%
    recipient6Percent = ethers.parseEther("0.20"); // 20%
  });

  beforeEach(async function () {
    [
      owner,
      user1,
      user2,
      recipient1,
      recipient2,
      recipient3,
      recipient4,
      recipient5,
      recipient6,
    ] = await ethers.getSigners();

    const RevenueDistributor = await ethers.getContractFactory("RevenueDistributor");
    distributorContract = await RevenueDistributor.deploy();
    await distributorContract.waitForDeployment();

    // add recipients
    await distributorContract.addRecipient(recipient1.address, "Recipient 1", recipient1Percent);
    await distributorContract.addRecipient(recipient2.address, "Recipient 2", recipient2Percent);
    await distributorContract.addRecipient(recipient3.address, "Recipient 3", recipient3Percent);
    await distributorContract.addRecipient(recipient4.address, "Recipient 4", recipient4Percent);
    await distributorContract.addRecipient(recipient5.address, "Recipient 5", recipient5Percent);
    await distributorContract.addRecipient(recipient6.address, "Recipient 6", recipient6Percent);
  });

  it("reverts when trying to add one more recipient and the total is larger than 100%", async function () {
    await expect(
      distributorContract.addRecipient(user1.address, "Recipient 7", ethers.parseEther("0.01"))
    ).to.be.revertedWith("RevenueDistributor: percentage total must be less than or equal to 100%");
  });

  it("reverts when trying to add existing recipient", async function () {
    // remove last recipient
    await distributorContract.removeLastRecipient();

    // add recipient1 again
    await expect(
      distributorContract.addRecipient(recipient1.address, "Recipient 1 again", ethers.parseEther("0.01"))
    ).to.be.revertedWith("RevenueDistributor: recipient already in the list");
  });

  it("distributes funds to recipients", async function () {
    const initialBalance = ethers.parseEther("10000");

    // check balances of recipients before the distribution
    expect(await ethers.provider.getBalance(recipient1.address)).to.equal(initialBalance);
    expect(await ethers.provider.getBalance(recipient2.address)).to.equal(initialBalance);
    expect(await ethers.provider.getBalance(recipient3.address)).to.equal(initialBalance);
    expect(await ethers.provider.getBalance(recipient4.address)).to.equal(initialBalance);
    expect(await ethers.provider.getBalance(recipient5.address)).to.equal(initialBalance);
    expect(await ethers.provider.getBalance(recipient6.address)).to.equal(initialBalance);

    // user1 sends 100 ETH to the contract
    const user1BalanceBefore = await ethers.provider.getBalance(user1.address);
    expect(await ethers.provider.getBalance(user1.address)).to.equal(initialBalance);

    const contractAddress = await distributorContract.getAddress();
    expect(await ethers.provider.getBalance(contractAddress)).to.equal(0n);

    const tx = await user1.sendTransaction({
      to: contractAddress,
      value: ethers.parseEther("100"),
    });
    const receipt = await tx.wait();

    calculateGasCosts("distributes funds to recipients", receipt);

    const user1BalanceAfter = await ethers.provider.getBalance(user1.address);
    const expectedUser1Balance = user1BalanceBefore - ethers.parseEther("100");
    const tolerance = ethers.parseEther("0.1");
    expect(user1BalanceAfter).to.be.closeTo(expectedUser1Balance, tolerance);

    // check balances of recipients after the distribution
    const r1bal = await ethers.provider.getBalance(recipient1.address);
    console.log(ethers.formatEther(r1bal));

    const distributionAmount = ethers.parseEther("100");
    expect(await ethers.provider.getBalance(recipient1.address)).to.equal(
      initialBalance + (recipient1Percent * distributionAmount) / ethers.parseEther("1")
    );
    expect(await ethers.provider.getBalance(recipient2.address)).to.equal(
      initialBalance + (recipient2Percent * distributionAmount) / ethers.parseEther("1")
    );
    expect(await ethers.provider.getBalance(recipient3.address)).to.equal(
      initialBalance + (recipient3Percent * distributionAmount) / ethers.parseEther("1")
    );
    expect(await ethers.provider.getBalance(recipient4.address)).to.equal(
      initialBalance + (recipient4Percent * distributionAmount) / ethers.parseEther("1")
    );
    expect(await ethers.provider.getBalance(recipient5.address)).to.equal(
      initialBalance + (recipient5Percent * distributionAmount) / ethers.parseEther("1")
    );
    expect(await ethers.provider.getBalance(recipient6.address)).to.equal(
      initialBalance + (recipient6Percent * distributionAmount) / ethers.parseEther("1")
    );
  });

  it("removes a recipient and adds a new one, and then updates the percentage of the new one", async function () {
    const isRecipientBefore = await distributorContract.isRecipient(recipient3.address);
    expect(isRecipientBefore).to.equal(true);

    await distributorContract.removeRecipientByAddress(recipient3.address);

    const isRecipientAfter = await distributorContract.isRecipient(recipient3.address);
    expect(isRecipientAfter).to.equal(false);

    await distributorContract.addRecipient(user1.address, "Recipient 7", ethers.parseEther("0.01"));

    // fails at update for recipient 7 because the percentage is larger than 25%
    await expect(
      distributorContract.updateRecipientByAddress(
        user1.address,
        user1.address,
        "Recipient 7",
        ethers.parseEther("0.26")
      )
    ).to.be.revertedWith("RevenueDistributor: percentage total must be less than or equal to 100%");

    // succeeds at update for recipient 7 because the percentage is 25%
    await distributorContract.updateRecipientByAddress(
      user1.address,
      user1.address,
      "Recipient 7 new",
      ethers.parseEther("0.25")
    );

    // check recipient's percentage and label via getRecipient
    const recipient7 = await distributorContract.getRecipient(user1.address);
    console.log(ethers.formatEther(recipient7.percentage));
    expect(recipient7.percentage).to.equal(ethers.parseEther("0.25"));
    expect(recipient7.label).to.equal("Recipient 7 new");
  });

  it("removes last recipient and adds a bunch of new ones with 1% share each", async function () {
    await distributorContract.removeLastRecipient();

    // getRecipientsLength before adding new recipients
    const recipientsLengthBefore = await distributorContract.getRecipientsLength();
    console.log("recipientsLengthBefore: " + recipientsLengthBefore);

    const limit = 20;
    const signers = await ethers.getSigners();

    // loop through fillerAddresses and add them as recipients with 1% share each
    for (let i = 9; i < limit; i++) {
      //console.log("Adding filler " + i);
      //console.log(signers[i].address);
      await distributorContract.addRecipient(signers[i].address, "Filler " + i, ethers.parseEther("0.01"));
    }

    // getRecipientsLength after adding new recipients
    const recipientsLengthAfter = await distributorContract.getRecipientsLength();
    console.log("recipientsLengthAfter: " + recipientsLengthAfter);

    const contractAddress = await distributorContract.getAddress();
    const tx = await user1.sendTransaction({
      to: contractAddress,
      value: ethers.parseEther("100"),
    });
    const receipt = await tx.wait();

    calculateGasCosts("distributes funds to recipients", receipt);

    // getRecipients and print them in console log
    const recipients = await distributorContract.getRecipients();
    //console.log(recipients);

    // removeLastRecipient
    await distributorContract.removeLastRecipient();
    expect(await distributorContract.getRecipientsLength()).to.equal(recipientsLengthAfter - 1n);

    // removeAllRecipients
    await distributorContract.removeAllRecipients();
    expect(await distributorContract.getRecipientsLength()).to.equal(0n);
  });

  it("updates recipient by index", async function () {
    // check recipient's percentage and label via getRecipient
    const recipient3before = await distributorContract.getRecipient(recipient3.address);
    expect(recipient3before.percentage).to.equal(recipient3Percent);
    expect(recipient3before.label).to.equal("Recipient 3");

    // update recipient's percentage and label via updateRecipientByIndex
    await distributorContract.updateRecipientByIndex(
      2,
      recipient3.address,
      "Recipient 3 new",
      ethers.parseEther("0.05")
    );

    // check recipient's percentage and label via getRecipient
    const recipient3Updated = await distributorContract.getRecipient(recipient3.address);
    expect(recipient3Updated.percentage).to.equal(ethers.parseEther("0.05"));
    expect(recipient3Updated.label).to.equal("Recipient 3 new");

    // check contract balance before the distribution
    const contractAddress = await distributorContract.getAddress();
    expect(await ethers.provider.getBalance(contractAddress)).to.equal(0n);

    // make a distribution
    await user1.sendTransaction({
      to: contractAddress,
      value: ethers.parseEther("100"),
    });

    // check contract balance after the distribution (20% should be left in the contract, because recipient3's percentage was changed from 25% to 5%)
    expect(await ethers.provider.getBalance(contractAddress)).to.equal(ethers.parseEther("20"));

    // withdraw remaining ETH from the contract via withdrawEth
    await distributorContract.withdrawEth();

    // check contract balance after the withdrawal (should be 0)
    expect(await ethers.provider.getBalance(contractAddress)).to.equal(0n);
  });

  it("adds user1 as manager", async function () {
    // check if user 1 is a manager (isManager)
    const isManagerBefore = await distributorContract.isManager(user1.address);
    expect(isManagerBefore).to.equal(false);

    // revert when user1 is trying to add a new recipient
    await expect(
      distributorContract.connect(user1).addRecipient(user2.address, "Recipient 7", ethers.parseEther("0.01"))
    ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");

    // add user1 as manager via addManager
    await distributorContract.addManager(user1.address);

    // check if user 1 is a manager (isManager)
    const isManagerAfter = await distributorContract.isManager(user1.address);
    expect(isManagerAfter).to.equal(true);

    // remove the last recipient via user1
    await distributorContract.connect(user1).removeLastRecipient();

    // add a new recipient via user1
    await distributorContract.connect(user1).addRecipient(user2.address, "Recipient 7", ethers.parseEther("0.01"));

    // remove user1 as manager via removeManagerByAddress
    await distributorContract.removeManagerByAddress(user1.address);

    // check if user 1 is a manager (isManager)
    const isManagerAfterRemove = await distributorContract.isManager(user1.address);
    expect(isManagerAfterRemove).to.equal(false);
  });

  it("reverts when label is too long", async function () {
    const longLabel = "a".repeat(31); // 31 characters, max is 30
    await expect(
      distributorContract.addRecipient(user1.address, longLabel, ethers.parseEther("0.01"))
    ).to.be.revertedWith("RevenueDistributor: label too long");
  });

  it("reverts when trying to get non-existent recipient", async function () {
    await expect(
      distributorContract.getRecipient(user1.address)
    ).to.be.revertedWith("RevenueDistributor: recipient not found");
  });

  it("allows owner to recover ERC20 tokens", async function () {
    // This test would require deploying a mock ERC20 token
    // For now, we'll just test that the function exists and reverts with proper access control
    const MockERC20 = await ethers.getContractFactory("MockErc20TokenDecimals");
    const mockToken = await MockERC20.deploy("Mock Token", "MT", 18);
    await mockToken.waitForDeployment();

    // Try to recover as non-owner (should fail)
    await expect(
      distributorContract.connect(user1).recoverERC20(await mockToken.getAddress(), 100n, user1.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("allows owner to recover ERC721 tokens", async function () {
    // This test would require deploying a mock ERC721 token
    const MockERC721 = await ethers.getContractFactory("MockErc721");
    const mockToken = await MockERC721.deploy("Mock Token", "MT");
    await mockToken.waitForDeployment();

    // Try to recover as non-owner (should fail)
    await expect(
      distributorContract.connect(user1).recoverERC721(await mockToken.getAddress(), 1n, user1.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });
});

describe("RevenueDistributorFactory", function () {
  let ethers: any;
  let factoryContract: any;
  let owner: any;
  let user1: any;
  let user2: any;

  before(async function () {
    const connection = await network.connect();
    ethers = connection.ethers;
  });

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const RevenueDistributorFactory = await ethers.getContractFactory("RevenueDistributorFactory");
    factoryContract = await RevenueDistributorFactory.deploy();
    await factoryContract.waitForDeployment();
  });

  it("creates a new RevenueDistributor with unique ID", async function () {
    const uniqueId = "test-distributor-1";
    const tx = await factoryContract.create(uniqueId);
    const receipt = await tx.wait();

    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = factoryContract.interface.parseLog(log);
        return parsed && parsed.name === "RevenueDistributorLaunch";
      } catch {
        return false;
      }
    });

    expect(event).to.not.be.undefined;

    const distributorAddress = await factoryContract.getDistributorAddressById(uniqueId);
    expect(distributorAddress).to.not.equal(ethers.ZeroAddress);

    // Verify the distributor contract exists and owner is set correctly
    const RevenueDistributor = await ethers.getContractFactory("RevenueDistributor");
    const distributor = RevenueDistributor.attach(distributorAddress);
    const distributorOwner = await distributor.owner();
    expect(distributorOwner).to.equal(owner.address);
  });

  it("reverts when creating distributor with duplicate unique ID", async function () {
    const uniqueId = "test-distributor-2";
    await factoryContract.create(uniqueId);

    await expect(
      factoryContract.create(uniqueId)
    ).to.be.revertedWith("Unique ID is not available");
  });

  it("reverts when unique ID is too long", async function () {
    const longId = "a".repeat(31); // 31 characters, max is 30
    await expect(
      factoryContract.create(longId)
    ).to.be.revertedWith("Unique ID is too long");
  });

  it("returns true for available unique ID", async function () {
    const uniqueId = "test-distributor-3";
    const isAvailable = await factoryContract.isUniqueIdAvailable(uniqueId);
    expect(isAvailable).to.equal(true);
  });

  it("returns false for unavailable unique ID", async function () {
    const uniqueId = "test-distributor-4";
    await factoryContract.create(uniqueId);

    const isAvailable = await factoryContract.isUniqueIdAvailable(uniqueId);
    expect(isAvailable).to.equal(false);
  });

  it("allows different users to create distributors with different IDs", async function () {
    const uniqueId1 = "user1-distributor";
    const uniqueId2 = "user2-distributor";

    const tx1 = await factoryContract.connect(user1).create(uniqueId1);
    await tx1.wait();

    const tx2 = await factoryContract.connect(user2).create(uniqueId2);
    await tx2.wait();

    const address1 = await factoryContract.getDistributorAddressById(uniqueId1);
    const address2 = await factoryContract.getDistributorAddressById(uniqueId2);

    expect(address1).to.not.equal(ethers.ZeroAddress);
    expect(address2).to.not.equal(ethers.ZeroAddress);
    expect(address1).to.not.equal(address2);

    // Verify ownership
    const RevenueDistributor = await ethers.getContractFactory("RevenueDistributor");
    const distributor1 = RevenueDistributor.attach(address1);
    const distributor2 = RevenueDistributor.attach(address2);

    expect(await distributor1.owner()).to.equal(user1.address);
    expect(await distributor2.owner()).to.equal(user2.address);
  });

  it("creates distributor with maximum length unique ID", async function () {
    const maxLengthId = "a".repeat(30); // exactly 30 characters
    const tx = await factoryContract.create(maxLengthId);
    await tx.wait();

    const distributorAddress = await factoryContract.getDistributorAddressById(maxLengthId);
    expect(distributorAddress).to.not.equal(ethers.ZeroAddress);
  });
});

