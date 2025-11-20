// npx hardhat test test/names/flexiFactory.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("FlexiPunkTLDFactory", function () {
  let ethers: any;
  let contract: any;
  let forbTldsContract: any;
  let signer: any;
  let anotherUser: any;
  let provider: any;
  let tldPrice: any;

  before(async function () {
    const connection = await network.connect();
    ethers = connection.ethers;
    provider = ethers.provider;
    tldPrice = ethers.parseEther("1");
  });

  beforeEach(async function () {
    [signer, anotherUser] = await ethers.getSigners();

    const PunkForbiddenTlds = await ethers.getContractFactory("PunkForbiddenTlds");
    forbTldsContract = await PunkForbiddenTlds.deploy();
    await forbTldsContract.waitForDeployment();

    const FlexiPunkMetadata = await ethers.getContractFactory("FlexiPunkMetadata");
    const metadataContract = await FlexiPunkMetadata.deploy();
    await metadataContract.waitForDeployment();

    const PunkTLDFactory = await ethers.getContractFactory("FlexiPunkTLDFactory");
    contract = await PunkTLDFactory.deploy(
      tldPrice,
      await forbTldsContract.getAddress(),
      await metadataContract.getAddress()
    );
    await contract.waitForDeployment();

    await forbTldsContract.addFactoryAddress(await contract.getAddress());
  });

  it("should confirm forbidden TLD names defined in the constructor", async function () {
    const forbiddenCom = await forbTldsContract.forbidden(".com");
    expect(forbiddenCom).to.be.true;

    const forbiddenEth = await forbTldsContract.forbidden(".eth");
    expect(forbiddenEth).to.be.true;
  });

  it("should create a new valid TLD", async function () {
    await contract.toggleBuyingTlds(); // enable buying TLDs

    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    // get user&signer balances BEFORE
    const balanceSignerBefore = await provider.getBalance(signer.address); // signer is the factory owner
    const balanceUserBefore = await provider.getBalance(anotherUser.address);

    await expect(
      contract.connect(anotherUser).createTld(
        ".web3", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.emit(contract, "TldCreated");

    // get another user's balance AFTER (should be smaller by 1 ETH + gas)
    const balanceUserAfter = await provider.getBalance(anotherUser.address);
    const balUsrBef = Number(ethers.formatEther(balanceUserBefore));
    const balUsrAft = Number(ethers.formatEther(balanceUserAfter));
    expect(balUsrBef - balUsrAft).to.be.greaterThan(1); // diff: 1 ETH + gas

    // get signer's balance after (should be bigger by exactly 1 ETH)
    const balanceSignerAfter = await provider.getBalance(signer.address);
    const balSigBef = Number(ethers.formatEther(balanceSignerBefore));
    const balSigAft = Number(ethers.formatEther(balanceSignerAfter));
    expect(balSigAft - balSigBef).to.equal(1); // diff: 1 ETH exactly

    // get TLD from array by index
    const firstTld = await contract.tlds(0);
    expect(firstTld).to.equal(".web3");

    // get TLD address by name
    const firstTldAddress = await contract.tldNamesAddresses(".web3");
    expect(firstTldAddress.startsWith("0x")).to.be.true;
  });

  it("should fail to create a new valid TLD if Buying TLDs disabled", async function () {
    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    await expect(
      contract.createTld(
        ".web3", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.be.revertedWithCustomError(contract, "BuyingDisabled");
  });

  it("should fail to create a new valid TLD if payment is too low", async function () {
    await contract.toggleBuyingTlds(); // enable buying TLDs

    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    await expect(
      contract.createTld(
        ".web3", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: ethers.parseEther("0.9") // pay 0.9 ETH for the TLD - TOO LOW!
        }
      )
    ).to.be.revertedWithCustomError(contract, "ValueBelowPrice");
  });

  it("should fail to create a new valid TLD if more than 1 dot in the name", async function () {
    await contract.toggleBuyingTlds(); // enable buying TLDs

    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    await expect(
      contract.createTld(
        ".web.3", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.be.revertedWithCustomError(contract, "InvalidDotCount");
  });

  it("should fail to create a new valid TLD if no dot in the name", async function () {
    await contract.toggleBuyingTlds(); // enable buying TLDs

    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    await expect(
      contract.createTld(
        "web3", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.be.revertedWithCustomError(contract, "InvalidDotCount");
  });

  it("should fail to create a new valid TLD if name does not start with dot", async function () {
    await contract.toggleBuyingTlds(); // enable buying TLDs

    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    await expect(
      contract.createTld(
        "web.3", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.be.revertedWithCustomError(contract, "MustStartWithDot");
  });

  it("should fail to create a new valid TLD if name is of length 1", async function () {
    await contract.toggleBuyingTlds(); // enable buying TLDs

    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    await expect(
      contract.createTld(
        ".", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.be.revertedWithCustomError(contract, "TldTooShort");
  });

  it("should fail to create a new valid TLD with empty name", async function () {
    await contract.toggleBuyingTlds(); // enable buying TLDs

    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    await expect(
      contract.createTld(
        "", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.be.revertedWithCustomError(contract, "TldTooShort");
  });

  it("should fail to create a new valid TLD if TLD already exists", async function () {
    await contract.toggleBuyingTlds(); // enable buying TLDs

    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    // create a valid TLD
    await expect(
      contract.createTld(
        ".web3", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.emit(contract, "TldCreated");

    // try to create a TLD with the same name
    await expect(
      contract.createTld(
        ".web3", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.be.revertedWithCustomError(contract, "TldForbidden");
  });

  it("should fail to create a new valid TLD if TLD name is too long", async function () {
    await contract.toggleBuyingTlds(); // enable buying TLDs

    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    // try to create a TLD with the same name
    await expect(
      contract.createTld(
        ".web3dfferopfmeomeriovneriovneriovndferfgergf", // TLD
        "WEB3", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.be.revertedWithCustomError(contract, "TldTooLong");
  });

  it("should fail to create a new valid TLD if TLD name is forbidden", async function () {
    await contract.toggleBuyingTlds(); // enable buying TLDs

    const price = await contract.price();
    expect(price).to.equal(tldPrice);

    // try to create a TLD that's on the forbidden list
    await expect(
      contract.createTld(
        ".com", // TLD
        "COM", // symbol
        signer.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false, // buying enabled
        {
          value: tldPrice // pay 1 ETH for the TLD
        }
      )
    ).to.be.revertedWithCustomError(contract, "TldForbidden");
  });
});

