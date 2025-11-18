// npx hardhat test test/chat/chatContextV1.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("ChatContextV1", function () {
  let ethers: any;
  let chatContract: any;
  let modTokenContract: any;

  let owner: any, user1: any, user2: any, user3: any;

  const contractName = "ChatContextV1";
  const mockTokenName = "ModToken";
  const mockTokenSymbol = "MT";
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

    const ChatContextV1 = await ethers.getContractFactory(contractName);
    chatContract = await ChatContextV1.deploy(
      await modTokenContract.getAddress(),
      owner.address,
      1
    );
    await chatContract.waitForDeployment();

    // mint mod token to user1
    await modTokenContract.mint(user1.address);
  });

  it("checks if state variables are set correctly", async function () {
    const modTokenAddress = await chatContract.modTokenAddress();
    expect(modTokenAddress).to.equal(await modTokenContract.getAddress());

    const modMinBalance = await chatContract.modMinBalance();
    expect(modMinBalance).to.equal(1n);

    const ownerAddress = await chatContract.owner();
    expect(ownerAddress).to.equal(owner.address);
  });

  it("allows creating a main message", async function () {
    const tx = await chatContract.connect(user2).createMessage("ar://message1", { value: price });
    const receipt = await tx.wait();
    calculateGasCosts("createMessage", receipt);

    const block = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(chatContract, "MessagePosted")
      .withArgs(user2.address, "ar://message1", block.timestamp);

    const message = await chatContract.getMainMessage(0);
    expect(message.author).to.equal(user2.address);
    expect(message.url).to.equal("ar://message1");
    expect(message.deleted).to.be.false;
    expect(message.index).to.equal(0n);
  });

  it("allows creating a reply", async function () {
    await chatContract.connect(user2).createMessage("ar://message1", { value: price });

    // get replies count before
    const message1 = await chatContract.getMainMessage(0);
    expect(message1.repliesCount).to.equal(0n);

    const tx = await chatContract.connect(user3).createReply(0, "ar://reply1", { value: price });
    const receipt = await tx.wait();
    calculateGasCosts("createReply", receipt);

    const block = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(chatContract, "MessageReplied")
      .withArgs(user3.address, "ar://reply1", 0n, block.timestamp);

    // get replies count after
    const message2 = await chatContract.getMainMessage(0);
    expect(message2.repliesCount).to.equal(1n);

    const reply = await chatContract.getReply(0, 0);
    expect(reply.author).to.equal(user3.address);
    expect(reply.url).to.equal("ar://reply1");
    expect(reply.deleted).to.be.false;
    expect(reply.index).to.equal(0n);
  });

  it("allows author to delete their main message", async function () {
    await chatContract.connect(user2).createMessage("ar://message1", { value: price });
    const tx = await chatContract.connect(user2).deleteMessage(0);
    const receipt = await tx.wait();
    calculateGasCosts("deleteMessage", receipt);

    const block = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(chatContract, "MainMessageDeleted")
      .withArgs(user2.address, "ar://message1", 0n, block.timestamp);

    const message = await chatContract.getMainMessage(0);
    expect(message.deleted).to.be.true;
  });

  it("allows author to delete their reply", async function () {
    await chatContract.connect(user2).createMessage("ar://message1", { value: price });
    await chatContract.connect(user3).createReply(0, "ar://reply1", { value: price });
    const tx = await chatContract.connect(user3).deleteReply(0, 0);
    const receipt = await tx.wait();
    calculateGasCosts("deleteReply", receipt);

    const block = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(chatContract, "ReplyDeleted")
      .withArgs(user3.address, "ar://reply1", 0n, 0n, block.timestamp);

    const reply = await chatContract.getReply(0, 0);
    expect(reply.deleted).to.be.true;
  });

  it("allows mod to restore a deleted main message", async function () {
    await chatContract.connect(user2).createMessage("ar://message1", { value: price });
    await chatContract.connect(user2).deleteMessage(0);
    const tx = await chatContract.connect(user1).restoreMessage(0);
    const receipt = await tx.wait();
    calculateGasCosts("restoreMessage", receipt);

    const block = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(chatContract, "MainMessageRestored")
      .withArgs(user1.address, "ar://message1", 0n, block.timestamp);

    const message = await chatContract.getMainMessage(0);
    expect(message.deleted).to.be.false;
  });

  it("allows mod to restore a deleted reply", async function () {
    await chatContract.connect(user2).createMessage("ar://message1", { value: price });
    await chatContract.connect(user3).createReply(0, "ar://reply1", { value: price });
    await chatContract.connect(user3).deleteReply(0, 0);
    const tx = await chatContract.connect(user1).restoreReply(0, 0);
    const receipt = await tx.wait();
    calculateGasCosts("restoreReply", receipt);

    const block = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(chatContract, "ReplyRestored")
      .withArgs(user1.address, "ar://reply1", 0n, 0n, block.timestamp);

    const reply = await chatContract.getReply(0, 0);
    expect(reply.deleted).to.be.false;
  });

  it("allows mod to pause and unpause the contract", async function () {
    await chatContract.connect(user1).togglePaused();
    expect(await chatContract.paused()).to.be.true;

    await chatContract.connect(user1).togglePaused();
    expect(await chatContract.paused()).to.be.false;
  });

  it("prevents creating messages when paused", async function () {
    await chatContract.connect(user1).togglePaused();

    await expect(
      chatContract.connect(user2).createMessage("ar://message1", { value: price })
    ).to.be.revertedWith("Contract is paused");

    await expect(
      chatContract.connect(user2).createReply(0, "ar://reply1", { value: price })
    ).to.be.revertedWith("Contract is paused");
  });

  it("allows fetching main messages with pagination", async function () {
    for (let i = 0; i < 5; i++) {
      await chatContract.connect(user2).createMessage(`ar://message${i}`, { value: price });
    }

    const messages = await chatContract.fetchMainMessages(true, 1, 3);
    expect(messages.length).to.equal(3);
    expect(messages[0].url).to.equal("ar://message1");
    expect(messages[2].url).to.equal("ar://message3");
  });

  it("allows fetching replies with pagination", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    for (let i = 0; i < 5; i++) {
      await chatContract.connect(user3).createReply(0, `ar://reply${i}`, { value: price });
    }

    const replies = await chatContract.fetchReplies(true, 0, 1, 3);
    expect(replies.length).to.equal(3);
    expect(replies[0].url).to.equal("ar://reply1");
    expect(replies[2].url).to.equal("ar://reply3");
  });

  it("excludes deleted messages when fetching if specified", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    await chatContract.connect(user2).createMessage("ar://message1", { value: price });
    await chatContract.connect(user2).deleteMessage(0);

    const messagesIncluded = await chatContract.fetchMainMessages(true, 0, 2);
    expect(messagesIncluded.length).to.equal(2);

    const messagesExcluded = await chatContract.fetchMainMessages(false, 0, 2);
    expect(messagesExcluded.length).to.equal(1);
    expect(messagesExcluded[0].url).to.equal("ar://message1");
  });

  it("prevents non-mods from using mod functions", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    await chatContract.connect(user2).deleteMessage(0);

    await expect(chatContract.connect(user2).restoreMessage(0)).to.be.revertedWith(
      "Not a mod or owner"
    );
    await expect(chatContract.connect(user2).togglePaused()).to.be.revertedWith(
      "Not a mod or owner"
    );
  });

  it("allows owner to change mod token address and minimum balance", async function () {
    const NewMockErc721 = await ethers.getContractFactory("MockErc721");
    const newModToken = await NewMockErc721.deploy("NewModToken", "NMT");
    await newModToken.waitForDeployment();

    await chatContract.connect(owner).setModTokenAddress(await newModToken.getAddress());
    expect(await chatContract.modTokenAddress()).to.equal(await newModToken.getAddress());

    await chatContract.connect(owner).setModMinBalance(2);
    expect(await chatContract.modMinBalance()).to.equal(2n);

    // prevent non-owner from changing mod token address and minimum balance
    await expect(
      chatContract.connect(user1).setModTokenAddress(await newModToken.getAddress())
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(chatContract.connect(user1).setModMinBalance(2)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("prevents creating messages with empty URLs", async function () {
    await expect(chatContract.connect(user2).createMessage("", { value: price })).to.be.revertedWith(
      "URL cannot be empty"
    );
    await expect(chatContract.connect(user2).createReply(0, "", { value: price })).to.be.revertedWith(
      "URL cannot be empty"
    );
  });

  it("correctly handles message and reply counts", async function () {
    expect(await chatContract.getMainMessageCount()).to.equal(0n);
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    expect(await chatContract.getMainMessageCount()).to.equal(1n);

    expect(await chatContract.getReplyCount(0)).to.equal(0n);
    await chatContract.connect(user3).createReply(0, "ar://reply0", { value: price });
    expect(await chatContract.getReplyCount(0)).to.equal(1n);
  });

  it("allows mod to suspend and unsuspend a user", async function () {
    // Suspend user2
    await chatContract.connect(user1).suspendUser(user2.address);
    expect(await chatContract.suspended(user2.address)).to.be.true;

    // Unsuspend user2
    await chatContract.connect(user1).unsuspendUser(user2.address);
    expect(await chatContract.suspended(user2.address)).to.be.false;

    // non-mod cannot suspend or unsuspend
    await expect(chatContract.connect(user2).suspendUser(user3.address)).to.be.revertedWith(
      "Not a mod or owner"
    );
    await expect(chatContract.connect(user2).unsuspendUser(user3.address)).to.be.revertedWith(
      "Not a mod or owner"
    );
  });

  it("prevents suspended users from creating messages", async function () {
    // Suspend user2
    await chatContract.connect(user1).suspendUser(user2.address);
    expect(await chatContract.suspended(user2.address)).to.be.true;

    // Attempt to create a message
    await expect(
      chatContract.connect(user2).createMessage("ar://message1", { value: price })
    ).to.be.revertedWith("You are suspended from posting");

    // Unsuspend user2
    await chatContract.connect(user1).unsuspendUser(user2.address);
    expect(await chatContract.suspended(user2.address)).to.be.false;

    // Attempt to create a message again
    const tx = await chatContract.connect(user2).createMessage("ar://message1", { value: price });
    const block = await ethers.provider.getBlock("latest");
    await expect(tx)
      .to.emit(chatContract, "MessagePosted")
      .withArgs(user2.address, "ar://message1", block.timestamp);
  });

  it("handles pagination correctly when there are no messages", async function () {
    const messages = await chatContract.fetchMainMessages(true, 0, 10);
    expect(messages.length).to.equal(0);
  });

  it("handles pagination correctly when requesting more messages than available", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    await chatContract.connect(user2).createMessage("ar://message1", { value: price });

    const messages = await chatContract.fetchMainMessages(true, 0, 5);
    expect(messages.length).to.equal(2);
  });

  it("prevents deleting a non-existent message", async function () {
    await expect(chatContract.connect(user2).deleteMessage(0)).to.be.revertedWithPanic();
  });

  it("prevents restoring a non-deleted message", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    await expect(chatContract.connect(user1).restoreMessage(0)).to.be.revertedWith(
      "Message is not deleted"
    );
  });

  it("allows owner to delete any message", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    const tx = await chatContract.connect(owner).deleteMessage(0);
    await expect(tx).to.emit(chatContract, "MainMessageDeleted");
  });

  it("handles multiple main messages and replies correctly", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    await chatContract.connect(user2).createMessage("ar://message1", { value: price });
    await chatContract.connect(user3).createReply(0, "ar://reply0", { value: price });
    await chatContract.connect(user3).createReply(1, "ar://reply1", { value: price });

    expect(await chatContract.getMainMessageCount()).to.equal(2n);
    expect(await chatContract.getReplyCount(0)).to.equal(1n);
    expect(await chatContract.getReplyCount(1)).to.equal(1n);

    const messages = await chatContract.fetchMainMessages(true, 0, 10);
    expect(messages.length).to.equal(2);
    expect(messages[0].url).to.equal("ar://message0");
    expect(messages[0].index).to.equal(0n);
    expect(messages[1].url).to.equal("ar://message1");
    expect(messages[1].index).to.equal(1n);

    const replies0 = await chatContract.fetchReplies(true, 0, 0, 10);
    const replies1 = await chatContract.fetchReplies(true, 1, 0, 10);

    expect(replies0.length).to.equal(1);
    expect(replies1.length).to.equal(1);
    expect(replies0[0].url).to.equal("ar://reply0");
    expect(replies0[0].index).to.equal(0n);
    expect(replies1[0].url).to.equal("ar://reply1");
    expect(replies1[0].index).to.equal(0n);
  });

  it("prevents creating a reply to a non-existent main message", async function () {
    await expect(
      chatContract.connect(user3).createReply(0, "ar://reply0", { value: price })
    ).to.be.revertedWithPanic();
  });

  it("prevents deleting a non-existent reply", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    await expect(chatContract.connect(user3).deleteReply(0, 0)).to.be.revertedWithPanic();
  });

  it("prevents restoring a non-deleted reply", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    await chatContract.connect(user3).createReply(0, "ar://reply0", { value: price });
    await expect(chatContract.connect(user1).restoreReply(0, 0)).to.be.revertedWith(
      "Reply is not deleted"
    );
  });

  it("handles suspension and unsuspension for replies", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    await chatContract.connect(user1).suspendUser(user3.address);

    await expect(
      chatContract.connect(user3).createReply(0, "ar://reply0", { value: price })
    ).to.be.revertedWith("You are suspended from posting");

    await chatContract.connect(user1).unsuspendUser(user3.address);
    const tx = await chatContract.connect(user3).createReply(0, "ar://reply0", { value: price });
    await expect(tx).to.emit(chatContract, "MessageReplied");
  });

  it("allows fetching last main messages", async function () {
    for (let i = 0; i < 5; i++) {
      await chatContract.connect(user2).createMessage(`ar://message${i}`, { value: price });
    }

    const messages = await chatContract.fetchLastMainMessages(false, 3);
    expect(messages.length).to.equal(3);
    expect(messages[0].url).to.equal("ar://message2");
    expect(messages[1].url).to.equal("ar://message3");
    expect(messages[2].url).to.equal("ar://message4");
  });

  it("handles fetchLastMainMessages when requesting more messages than available", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    await chatContract.connect(user2).createMessage("ar://message1", { value: price });

    const messages = await chatContract.fetchLastMainMessages(false, 5);
    expect(messages.length).to.equal(2);
    expect(messages[0].url).to.equal("ar://message0");
    expect(messages[1].url).to.equal("ar://message1");
  });

  it("handles fetchLastMainMessages with zero messages", async function () {
    const messages = await chatContract.fetchLastMainMessages(false, 3);
    expect(messages.length).to.equal(0);
  });

  it("allows fetching last replies", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    for (let i = 0; i < 5; i++) {
      await chatContract.connect(user3).createReply(0, `ar://reply${i}`, { value: price });
    }

    const replies = await chatContract.fetchLastReplies(false, 0, 3);
    expect(replies.length).to.equal(3);
    expect(replies[0].url).to.equal("ar://reply2");
    expect(replies[1].url).to.equal("ar://reply3");
    expect(replies[2].url).to.equal("ar://reply4");
  });

  it("handles fetchLastReplies when requesting more replies than available", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    await chatContract.connect(user3).createReply(0, "ar://reply0", { value: price });
    await chatContract.connect(user3).createReply(0, "ar://reply1", { value: price });

    const replies = await chatContract.fetchLastReplies(false, 0, 5);
    expect(replies.length).to.equal(2);
    expect(replies[0].url).to.equal("ar://reply0");
    expect(replies[1].url).to.equal("ar://reply1");
  });

  it("handles fetchLastReplies with zero replies", async function () {
    await chatContract.connect(user2).createMessage("ar://message0", { value: price });
    const replies = await chatContract.fetchLastReplies(false, 0, 3);
    expect(replies.length).to.equal(0);
  });

  it("handles fetchLastReplies for a non-existent main message", async function () {
    const result = await chatContract.fetchLastReplies(false, 999, 3);
    expect(result).to.be.empty;
  });

  it("allows owner to change the price", async function () {
    const newPrice = ethers.parseEther("0.0002");
    await chatContract.connect(owner).setPrice(newPrice);
    expect(await chatContract.price()).to.equal(newPrice);

    // Ensure new price is enforced
    await expect(
      chatContract.connect(user2).createMessage("ar://message1", { value: price })
    ).to.be.revertedWith("Payment is less than the price");

    const tx = await chatContract.connect(user2).createMessage("ar://message1", { value: newPrice });
    await expect(tx).to.emit(chatContract, "MessagePosted");
  });

  it("allows owner to withdraw revenue", async function () {
    // change price to 0.01
    const newPrice = ethers.parseEther("0.01");
    await chatContract.connect(owner).setPrice(newPrice);

    // Create a message to generate revenue
    await chatContract.connect(user2).createMessage("ar://message1", { value: newPrice });

    // Check contract balance
    const contractBalance = await ethers.provider.getBalance(await chatContract.getAddress());
    expect(contractBalance).to.equal(newPrice);

    // Withdraw revenue
    const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
    const tx = await chatContract.connect(owner).withdrawRevenue(owner.address);
    const receipt = await tx.wait();
    calculateGasCosts("withdrawRevenue", receipt);

    // Check final owner balance
    const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
    expect(finalOwnerBalance).to.be.above(initialOwnerBalance);
  });

  it("correctly identifies mods and non-mods", async function () {
    // Check if owner is considered a mod
    expect(await chatContract.isUserMod(owner.address)).to.be.true;

    // Check if user1 (who has a mod token) is considered a mod
    expect(await chatContract.isUserMod(user1.address)).to.be.true;

    // Check if user2 (who doesn't have a mod token) is not considered a mod
    expect(await chatContract.isUserMod(user2.address)).to.be.false;

    // Mint a mod token to user2 and check again
    await modTokenContract.mint(user2.address);
    expect(await chatContract.isUserMod(user2.address)).to.be.true;

    // Change the minimum balance required to be a mod
    await chatContract.connect(owner).setModMinBalance(2);

    // Check if user2 (who now has 1 token) is no longer considered a mod
    expect(await chatContract.isUserMod(user2.address)).to.be.false;

    // Mint another token to user2 and check again
    await modTokenContract.mint(user2.address);
    expect(await chatContract.isUserMod(user2.address)).to.be.true;
  });
});

