// npx hardhat test test/chat/commentsContextTokenGated.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("CommentsContextTokenGated", function () {
  let ethers: any;
  let commentsContract: any;
  let modTokenContract: any;
  let subjectTokenContract: any;

  let owner: any, user1: any, user2: any, user3: any;
  let subjectAddress: string;

  const contractName = "CommentsContextTokenGated";
  const mockTokenName = "ModToken";
  const mockTokenSymbol = "MT";
  const subjectTokenName = "SubjectToken";
  const subjectTokenSymbol = "ST";
  const price = 0n; // ethers.parseEther("0.00001");

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

    const MockErc721 = await ethers.getContractFactory("MockErc721");
    modTokenContract = await MockErc721.deploy(mockTokenName, mockTokenSymbol);
    await modTokenContract.waitForDeployment();

    subjectTokenContract = await MockErc721.deploy(subjectTokenName, subjectTokenSymbol);
    await subjectTokenContract.waitForDeployment();

    const CommentsContextTokenGated = await ethers.getContractFactory(contractName);
    commentsContract = await CommentsContextTokenGated.deploy(
      await modTokenContract.getAddress(),
      owner.address,
      1, // commentMinBalance
      1, // modMinBalance
      price
    );
    await commentsContract.waitForDeployment();

    // mint mod token to user1
    await modTokenContract.mint(user1.address);

    // mint subject token to user2
    await subjectTokenContract.mint(user2.address);

    subjectAddress = await subjectTokenContract.getAddress();
  });

  it("checks if state variables are set correctly", async function () {
    expect(await commentsContract.modTokenAddress()).to.equal(await modTokenContract.getAddress());
    expect(await commentsContract.modMinBalance()).to.equal(1n);
    expect(await commentsContract.commentMinBalance()).to.equal(1n);
    expect(await commentsContract.owner()).to.equal(owner.address);
    expect(await commentsContract.price()).to.equal(price);
  });

  it("allows creating a comment and sets the index correctly", async function () {
    const tx = await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: price });
    const receipt = await tx.wait();
    calculateGasCosts("createComment", receipt);

    const block = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(commentsContract, "CommentPosted")
      .withArgs(user2.address, "ar://comment1", subjectAddress, block.timestamp);

    const comment = await commentsContract.getComment(subjectAddress, 0);
    expect(comment.author).to.equal(user2.address);
    expect(comment.url).to.equal("ar://comment1");
    expect(comment.deleted).to.be.false;
    expect(comment.index).to.equal(0n);
  });

  it("prevents creating a comment without sufficient token balance", async function () {
    await expect(
      commentsContract.connect(user3).createComment(subjectAddress, "ar://comment1", { value: price })
    ).to.be.revertedWith("You do not have the minimum balance to post a comment");
  });

  it("allows author to delete their comment", async function () {
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: price });
    const tx = await commentsContract.connect(user2).deleteComment(subjectAddress, 0);
    const receipt = await tx.wait();
    calculateGasCosts("deleteComment", receipt);

    const block = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(commentsContract, "CommentDeleted")
      .withArgs(user2.address, "ar://comment1", subjectAddress, 0n, block.timestamp);

    const comment = await commentsContract.getComment(subjectAddress, 0);
    expect(comment.deleted).to.be.true;
  });

  it("allows mod to restore a deleted comment", async function () {
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: price });
    await commentsContract.connect(user2).deleteComment(subjectAddress, 0);
    const tx = await commentsContract.connect(user1).restoreComment(subjectAddress, 0);
    const receipt = await tx.wait();
    calculateGasCosts("restoreComment", receipt);

    const block = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(commentsContract, "CommentRestored")
      .withArgs(user1.address, "ar://comment1", subjectAddress, 0n, block.timestamp);

    const comment = await commentsContract.getComment(subjectAddress, 0);
    expect(comment.deleted).to.be.false;
  });

  it("allows mod to pause and unpause the contract", async function () {
    await commentsContract.connect(user1).togglePaused();
    expect(await commentsContract.paused()).to.be.true;

    await commentsContract.connect(user1).togglePaused();
    expect(await commentsContract.paused()).to.be.false;
  });

  it("prevents creating comments when paused", async function () {
    await commentsContract.connect(user1).togglePaused();

    await expect(
      commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: price })
    ).to.be.revertedWith("Contract is paused");
  });

  it("allows fetching comments with pagination", async function () {
    for (let i = 0; i < 5; i++) {
      await commentsContract.connect(user2).createComment(subjectAddress, `ar://comment${i}`, { value: price });
    }

    const comments = await commentsContract.fetchComments(true, subjectAddress, 1, 3);
    expect(comments.length).to.equal(3);
    expect(comments[0].url).to.equal("ar://comment1");
    expect(comments[2].url).to.equal("ar://comment3");
  });

  it("excludes deleted comments when fetching if specified", async function () {
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment0", { value: price });
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: price });
    await commentsContract.connect(user2).deleteComment(subjectAddress, 0);

    const commentsIncluded = await commentsContract.fetchComments(true, subjectAddress, 0, 2);
    expect(commentsIncluded.length).to.equal(2);

    const commentsExcluded = await commentsContract.fetchComments(false, subjectAddress, 0, 2);
    expect(commentsExcluded.length).to.equal(1);
    expect(commentsExcluded[0].url).to.equal("ar://comment1");
  });

  it("prevents non-mods from using mod functions", async function () {
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment0", { value: price });
    await commentsContract.connect(user2).deleteComment(subjectAddress, 0);

    await expect(commentsContract.connect(user2).restoreComment(subjectAddress, 0)).to.be.revertedWith(
      "Not a mod or owner"
    );
    await expect(commentsContract.connect(user2).togglePaused()).to.be.revertedWith(
      "Not a mod or owner"
    );
  });

  it("allows owner to change mod token address and minimum balance", async function () {
    const NewMockErc721 = await ethers.getContractFactory("MockErc721");
    const newModToken = await NewMockErc721.deploy("NewModToken", "NMT");
    await newModToken.waitForDeployment();

    await commentsContract.connect(owner).setModTokenAddress(await newModToken.getAddress());
    expect(await commentsContract.modTokenAddress()).to.equal(await newModToken.getAddress());

    await commentsContract.connect(owner).setModMinBalance(2);
    expect(await commentsContract.modMinBalance()).to.equal(2n);

    // prevent non-owner from changing mod token address and minimum balance
    await expect(
      commentsContract.connect(user1).setModTokenAddress(await newModToken.getAddress())
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(commentsContract.connect(user1).setModMinBalance(2)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("allows mod to suspend and unsuspend a user", async function () {
    await commentsContract.connect(user1).suspendUser(user2.address);
    expect(await commentsContract.suspended(user2.address)).to.be.true;

    await commentsContract.connect(user1).unsuspendUser(user2.address);
    expect(await commentsContract.suspended(user2.address)).to.be.false;

    // non-mod cannot suspend or unsuspend
    await expect(commentsContract.connect(user2).suspendUser(user3.address)).to.be.revertedWith(
      "Not a mod or owner"
    );
    await expect(commentsContract.connect(user2).unsuspendUser(user3.address)).to.be.revertedWith(
      "Not a mod or owner"
    );
  });

  it("prevents suspended users from creating comments", async function () {
    await commentsContract.connect(user1).suspendUser(user2.address);
    expect(await commentsContract.suspended(user2.address)).to.be.true;

    await expect(
      commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: price })
    ).to.be.revertedWith("You are suspended from posting");

    await commentsContract.connect(user1).unsuspendUser(user2.address);
    expect(await commentsContract.suspended(user2.address)).to.be.false;

    const tx = await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: price });
    await expect(tx).to.emit(commentsContract, "CommentPosted");
  });

  it("allows owner to withdraw revenue", async function () {
    // change price to 0.01
    const newPrice = ethers.parseEther("0.01");
    await commentsContract.connect(owner).setPrice(newPrice);

    // Create a comment to generate revenue
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: newPrice });

    // Check contract balance
    const contractBalance = await ethers.provider.getBalance(await commentsContract.getAddress());
    expect(contractBalance).to.equal(newPrice);

    // Withdraw revenue
    const initialBalance = await ethers.provider.getBalance(user3.address);
    const tx = await commentsContract.connect(owner).withdrawRevenue(user3.address);
    const receipt = await tx.wait();
    calculateGasCosts("withdrawRevenue", receipt);

    const finalBalance = await ethers.provider.getBalance(user3.address);
    expect(finalBalance).to.be.above(initialBalance);
  });

  it("prevents non-owner from withdrawing revenue", async function () {
    const newPrice = ethers.parseEther("0.01");
    await commentsContract.connect(owner).setPrice(newPrice);
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: newPrice });

    await expect(commentsContract.connect(user1).withdrawRevenue(user1.address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("allows owner to set a new price", async function () {
    const newPrice = ethers.parseEther("0.0002");
    await commentsContract.connect(owner).setPrice(newPrice);
    expect(await commentsContract.price()).to.equal(newPrice);
  });

  it("prevents creating a comment with insufficient payment", async function () {
    // set price to 0.00001 via setPrice function
    const requiredPrice = ethers.parseEther("0.00001");
    await commentsContract.connect(owner).setPrice(requiredPrice);

    const insufficientPrice = ethers.parseEther("0.000009");
    await expect(
      commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: insufficientPrice })
    ).to.be.revertedWith("Payment is less than the price");
  });

  it("correctly identifies mods and non-mods", async function () {
    // Check if owner is considered a mod
    expect(await commentsContract.isUserMod(owner.address)).to.be.true;

    // Check if user1 (who has a mod token) is considered a mod
    expect(await commentsContract.isUserMod(user1.address)).to.be.true;

    // Check if user2 (who doesn't have a mod token) is not considered a mod
    expect(await commentsContract.isUserMod(user2.address)).to.be.false;

    // Mint a mod token to user2 and check again
    await modTokenContract.mint(user2.address);
    expect(await commentsContract.isUserMod(user2.address)).to.be.true;

    // Change the minimum balance required to be a mod
    await commentsContract.connect(owner).setModMinBalance(2);

    // Check if user2 (who now has 1 token) is no longer considered a mod
    expect(await commentsContract.isUserMod(user2.address)).to.be.false;

    // Mint another token to user2 and check again
    await modTokenContract.mint(user2.address);
    expect(await commentsContract.isUserMod(user2.address)).to.be.true;
  });

  it("fetches the last N comments correctly", async function () {
    for (let i = 0; i < 5; i++) {
      await commentsContract.connect(user2).createComment(subjectAddress, `ar://comment${i}`, { value: price });
    }

    const comments = await commentsContract.fetchLastComments(true, subjectAddress, 3);
    expect(comments.length).to.equal(3);
    expect(comments[0].url).to.equal("ar://comment2");
    expect(comments[1].url).to.equal("ar://comment3");
    expect(comments[2].url).to.equal("ar://comment4");
  });

  it("handles case when requested length is larger than comments array", async function () {
    for (let i = 0; i < 3; i++) {
      await commentsContract.connect(user2).createComment(subjectAddress, `ar://comment${i}`, { value: price });
    }

    const comments = await commentsContract.fetchLastComments(true, subjectAddress, 5);
    expect(comments.length).to.equal(3);
    expect(comments[0].url).to.equal("ar://comment0");
    expect(comments[2].url).to.equal("ar://comment2");
  });

  it("returns empty array when there are no comments", async function () {
    const comments = await commentsContract.fetchLastComments(true, subjectAddress, 5);
    expect(comments.length).to.equal(0);
  });

  it("excludes deleted comments when specified in fetchLastComments", async function () {
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment0", { value: price });
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: price });
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment2", { value: price });
    await commentsContract.connect(user2).deleteComment(subjectAddress, 1);

    const commentsIncluded = await commentsContract.fetchLastComments(true, subjectAddress, 3);
    expect(commentsIncluded.length).to.equal(3);

    const commentsExcluded = await commentsContract.fetchLastComments(false, subjectAddress, 3);
    expect(commentsExcluded.length).to.equal(2);
    expect(commentsExcluded[0].url).to.equal("ar://comment0");
    expect(commentsExcluded[1].url).to.equal("ar://comment2");
  });

  it("prevents creating comments with empty URLs", async function () {
    await expect(
      commentsContract.connect(user2).createComment(subjectAddress, "", { value: price })
    ).to.be.revertedWith("URL cannot be empty");
  });

  it("correctly handles comment counts", async function () {
    expect(await commentsContract.getCommentCount(subjectAddress)).to.equal(0n);
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment0", { value: price });
    expect(await commentsContract.getCommentCount(subjectAddress)).to.equal(1n);

    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment1", { value: price });
    expect(await commentsContract.getCommentCount(subjectAddress)).to.equal(2n);
  });

  it("allows owner to delete any comment", async function () {
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment0", { value: price });
    const tx = await commentsContract.connect(owner).deleteComment(subjectAddress, 0);
    await expect(tx).to.emit(commentsContract, "CommentDeleted");
  });

  it("prevents restoring a non-deleted comment", async function () {
    await commentsContract.connect(user2).createComment(subjectAddress, "ar://comment0", { value: price });
    await expect(commentsContract.connect(user1).restoreComment(subjectAddress, 0)).to.be.revertedWith(
      "Comment is not deleted"
    );
  });

  it("prevents deleting a non-existent comment", async function () {
    await expect(commentsContract.connect(user2).deleteComment(subjectAddress, 0)).to.be.revertedWithPanic();
  });
});

