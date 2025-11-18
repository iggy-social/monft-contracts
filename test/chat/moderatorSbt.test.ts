// npx hardhat test test/chat/moderatorSbt.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("ModeratorSbt tests", function () {
  let ethers: any;
  let contract: any;

  let owner: any, user1: any, user2: any, user3: any;

  const contractName = "ModeratorSbt";

  const tokenName = "Moderator SBT";
  const symbol = "MSBT";

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
    [owner, user1, user2, user3] = await ethers.getSigners();

    const ModeratorSbt = await ethers.getContractFactory(contractName);

    contract = await ModeratorSbt.deploy(tokenName, symbol);
    await contract.waitForDeployment();
  });

  it("should deploy the contract with the correct parameters", async function () {
    console.log("contract address:", await contract.getAddress());

    expect(await contract.name()).to.equal(tokenName);
    expect(await contract.symbol()).to.equal(symbol);
    expect(await contract.counter()).to.equal(1n);
    expect(await contract.owner()).to.equal(owner.address);
  });

  it("should support ERC5192 interface", async function () {
    const IERC5192_INTERFACE_ID = "0xb45a3c0e"; // ERC5192 interface ID
    expect(await contract.supportsInterface(IERC5192_INTERFACE_ID)).to.be.true;
  });

  it("should support ERC721 interface", async function () {
    const ERC721_INTERFACE_ID = "0x80ac58cd"; // ERC721 interface ID
    expect(await contract.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;
  });

  it("should allow contract owner to mint tokens", async function () {
    const tx = await contract.mint(user1.address);
    const receipt = await tx.wait();
    calculateGasCosts("mint", receipt);

    expect(await contract.ownerOf(1)).to.equal(user1.address);
    expect(await contract.balanceOf(user1.address)).to.equal(1n);
    expect(await contract.counter()).to.equal(2n);
  });

  it("should increment counter on each mint", async function () {
    await contract.mint(user1.address);
    expect(await contract.counter()).to.equal(2n);

    await contract.mint(user2.address);
    expect(await contract.counter()).to.equal(3n);

    await contract.mint(user3.address);
    expect(await contract.counter()).to.equal(4n);
  });

  it("should return correct token IDs when minting", async function () {
    // Verify mint returns correct tokenId by checking what tokenId was actually minted
    // Counter starts at 1, so first mint should return 1
    await contract.mint(user1.address);
    expect(await contract.ownerOf(1)).to.equal(user1.address);
    expect(await contract.counter()).to.equal(2n);
    
    // Second mint should return 2
    await contract.mint(user2.address);
    expect(await contract.ownerOf(2)).to.equal(user2.address);
    expect(await contract.counter()).to.equal(3n);
    
    // Third mint should return 3
    await contract.mint(user3.address);
    expect(await contract.ownerOf(3)).to.equal(user3.address);
    expect(await contract.counter()).to.equal(4n);
  });

  it("should allow contract owner to burn tokens", async function () {
    await contract.mint(user1.address);
    expect(await contract.ownerOf(1)).to.equal(user1.address);

    const tx = await contract.burn(1);
    const receipt = await tx.wait();
    calculateGasCosts("burn", receipt);

    await expect(contract.ownerOf(1)).to.be.revertedWith("ERC721: invalid token ID");
    expect(await contract.balanceOf(user1.address)).to.equal(0n);
  });

  it("should not allow non-contract-owner to mint", async function () {
    await expect(contract.connect(user1).mint(user2.address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("should not allow non-contract-owner to burn", async function () {
    await contract.mint(user1.address);
    await expect(contract.connect(user1).burn(1)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("should revert when burning non-existent token", async function () {
    await expect(contract.burn(999)).to.be.revertedWith("ERC721: invalid token ID");
  });

  it("should have locked tokens (soulbound)", async function () {
    await contract.mint(user1.address);
    expect(await contract.locked(1)).to.be.true;
  });

  it("should not allow transfer of locked tokens", async function () {
    await contract.mint(user1.address);
    const tokenId = 1n;

    await expect(
      contract.connect(user1).transferFrom(user1.address, user2.address, tokenId)
    ).to.be.revertedWithCustomError(contract, "ErrLocked");

    await expect(
      contract.connect(user1)["safeTransferFrom(address,address,uint256)"](user1.address, user2.address, tokenId)
    ).to.be.revertedWithCustomError(contract, "ErrLocked");
  });

  it("should not allow approval of locked tokens", async function () {
    await contract.mint(user1.address);
    const tokenId = 1n;

    await expect(contract.connect(user1).approve(user2.address, tokenId)).to.be.revertedWithCustomError(
      contract,
      "ErrLocked"
    );

    await expect(contract.connect(user1).setApprovalForAll(user2.address, true)).to.be.revertedWithCustomError(
      contract,
      "ErrLocked"
    );
  });

  it("should revert when checking locked status of non-existent token", async function () {
    await expect(contract.locked(999)).to.be.revertedWithCustomError(contract, "ErrNotFound");
  });

  it("should emit Transfer event on mint", async function () {
    await expect(contract.mint(user1.address))
      .to.emit(contract, "Transfer")
      .withArgs(ethers.ZeroAddress, user1.address, 1n);
  });

  it("should emit Transfer event on burn", async function () {
    await contract.mint(user1.address);
    await expect(contract.burn(1))
      .to.emit(contract, "Transfer")
      .withArgs(user1.address, ethers.ZeroAddress, 1n);
  });

  it("should emit Locked event on mint", async function () {
    await expect(contract.mint(user1.address))
      .to.emit(contract, "Locked")
      .withArgs(1n);
  });

  it("should handle multiple mints correctly", async function () {
    await contract.mint(user1.address);
    await contract.mint(user2.address);
    await contract.mint(user3.address);

    expect(await contract.ownerOf(1)).to.equal(user1.address);
    expect(await contract.ownerOf(2)).to.equal(user2.address);
    expect(await contract.ownerOf(3)).to.equal(user3.address);

    expect(await contract.balanceOf(user1.address)).to.equal(1n);
    expect(await contract.balanceOf(user2.address)).to.equal(1n);
    expect(await contract.balanceOf(user3.address)).to.equal(1n);

    expect(await contract.counter()).to.equal(4n);
  });

  it("should allow contract owner to transfer ownership", async function () {
    await contract.transferOwnership(user1.address);
    expect(await contract.owner()).to.equal(user1.address);

    // New owner should be able to mint
    await contract.connect(user1).mint(user2.address);
    expect(await contract.ownerOf(1)).to.equal(user2.address);
  });

  it("should allow new contract owner to burn tokens", async function () {
    await contract.mint(user1.address);
    await contract.transferOwnership(user2.address);

    await contract.connect(user2).burn(1);
    await expect(contract.ownerOf(1)).to.be.revertedWith("ERC721: invalid token ID");
  });
});

