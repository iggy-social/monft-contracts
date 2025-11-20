// npx hardhat test test/names/flexiFactory.owner.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("FlexiPunkTLDFactory (onlyOwner)", function () {
  let ethers: any;
  let contract: any;
  let forbTldsContract: any;
  let owner: any;
  let nonOwner: any;
  let provider: any;
  let tldPrice: any;

  before(async function () {
    const connection = await network.connect();
    ethers = connection.ethers;
    provider = ethers.provider;
    tldPrice = ethers.parseEther("1");
  });

  beforeEach(async function () {
    [owner, nonOwner] = await ethers.getSigners();

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

  it("should create a new valid TLD through ownerCreateTld()", async function () {
    await expect(
      contract.ownerCreateTld(
        ".web3", // TLD
        "WEB3", // symbol
        owner.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false // buying enabled
      )
    ).to.emit(contract, "TldCreated");
  });

  it("should fail to create a new valid TLD if user is not owner", async function () {
    await expect(
      contract.connect(nonOwner).ownerCreateTld(
        ".web3", // TLD
        "WEB3", // symbol
        nonOwner.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false // buying enabled
      )
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should fail to create a new valid TLD if more than 1 dot in the name", async function () {
    await expect(
      contract.ownerCreateTld(
        ".web.3", // TLD
        "WEB3", // symbol
        owner.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false // buying enabled
      )
    ).to.be.revertedWithCustomError(contract, "InvalidDotCount");
  });

  it("should fail to create a new valid TLD if no dot in the name", async function () {
    await expect(
      contract.ownerCreateTld(
        "web3", // TLD
        "WEB3", // symbol
        owner.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false // buying enabled
      )
    ).to.be.revertedWithCustomError(contract, "InvalidDotCount");
  });

  it("should fail to create a new valid TLD if name does not start with dot", async function () {
    await expect(
      contract.ownerCreateTld(
        "web.3", // TLD
        "WEB3", // symbol
        owner.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false // buying enabled
      )
    ).to.be.revertedWithCustomError(contract, "MustStartWithDot");
  });

  it("should fail to create a new valid TLD if name is of length 1", async function () {
    await expect(
      contract.ownerCreateTld(
        ".", // TLD
        "WEB3", // symbol
        owner.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false // buying enabled
      )
    ).to.be.revertedWithCustomError(contract, "TldTooShort");
  });

  it("should fail to create a new valid TLD with empty name", async function () {
    await expect(
      contract.ownerCreateTld(
        "", // TLD
        "WEB3", // symbol
        owner.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false // buying enabled
      )
    ).to.be.revertedWithCustomError(contract, "TldTooShort");
  });

  it("should fail to create a new valid TLD if TLD already exists", async function () {
    // create a valid TLD
    await expect(
      contract.ownerCreateTld(
        ".web3", // TLD
        "WEB3", // symbol
        owner.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false // buying enabled
      )
    ).to.emit(contract, "TldCreated");

    // try to create a TLD with the same name
    await expect(
      contract.ownerCreateTld(
        ".web3", // TLD
        "WEB3", // symbol
        owner.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false // buying enabled
      )
    ).to.be.revertedWithCustomError(contract, "TldForbidden");
  });

  it("should fail to create a new valid TLD if TLD name is too long", async function () {
    // try to create a TLD with the same name
    await expect(
      contract.ownerCreateTld(
        ".web3dfferopfmeomeriovneriovneriovndferfgergf", // TLD
        "WEB3", // symbol
        owner.address, // TLD owner
        ethers.parseEther("0.2"), // domain price
        false // buying enabled
      )
    ).to.be.revertedWithCustomError(contract, "TldTooLong");
  });

  it("should change the TLD price", async function () {
    const priceBefore = await contract.price();
    expect(priceBefore).to.equal(tldPrice);

    const newPrice = ethers.parseEther("2");

    await contract.changePrice(newPrice);

    const priceAfter = await contract.price();
    expect(priceAfter).to.equal(newPrice);

    // fail if sender is not owner
    await expect(
      contract.connect(nonOwner).changePrice(ethers.parseEther("2"))
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should add a new forbidden domain", async function () {
    const tld = ".co";

    const forbiddenTldBefore = await forbTldsContract.forbidden(tld);
    expect(forbiddenTldBefore).to.be.false;

    await forbTldsContract.ownerAddForbiddenTld(tld);

    const forbiddenTldAfter = await forbTldsContract.forbidden(tld);
    expect(forbiddenTldAfter).to.be.true;

    // fail if sender is not owner
    await expect(
      forbTldsContract.connect(nonOwner).ownerAddForbiddenTld(".io")
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should remove a forbidden domain", async function () {
    const tld = ".eth";

    const forbiddenTldBefore = await forbTldsContract.forbidden(tld);
    expect(forbiddenTldBefore).to.be.true;

    await forbTldsContract.removeForbiddenTld(tld);

    const forbiddenTldAfter = await forbTldsContract.forbidden(tld);
    expect(forbiddenTldAfter).to.be.false;

    // fail if sender is not owner
    await expect(
      forbTldsContract.connect(nonOwner).removeForbiddenTld(".net")
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should change max length for a TLD name", async function () {
    const nameMaxLengthBefore = await contract.nameMaxLength();
    expect(nameMaxLengthBefore).to.equal(40);

    await contract.changeNameMaxLength(52);

    const nameMaxLengthAfter = await contract.nameMaxLength();
    expect(nameMaxLengthAfter).to.equal(52);

    // fail if sender is not owner
    await expect(
      contract.connect(nonOwner).changeNameMaxLength(60)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should change the royalty amount", async function () {
    const royaltyBefore = await contract.royalty();
    expect(royaltyBefore).to.equal(0);

    const newRoyalty = 10;

    await contract.changeRoyalty(newRoyalty);

    const royaltyAfter = await contract.royalty();
    expect(royaltyAfter).to.equal(10);

    // if user is not owner, the tx should revert
    await expect(
      contract.connect(nonOwner).changeRoyalty(20)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });
});

