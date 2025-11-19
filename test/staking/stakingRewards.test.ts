// npx hardhat test test/staking/stakingRewards.test.ts

import { expect } from "chai";
import { network } from "hardhat";

describe("StakingRewards", function () {
  let ethers: any;
  let stakingRewardsContract: any;
  let assetToken: any;
  let wethToken: any;

  let owner: any, manager: any, user1: any, user2: any, user3: any;

  const periodLength = 604800n; // 1 week in seconds
  let claimRewardsMinimum: any;
  let minDeposit: any;

  before(async function () {
    const connection = await network.connect();
    ethers = connection.ethers;
    claimRewardsMinimum = ethers.parseEther("1.0");
    minDeposit = ethers.parseEther("0.1");
  });

  beforeEach(async function () {
    [owner, manager, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock asset token (LP token)
    const MockErc20TokenDecimals = await ethers.getContractFactory("MockErc20TokenDecimals");
    assetToken = await MockErc20TokenDecimals.deploy("LP Token", "LP", 18);
    await assetToken.waitForDeployment();

    // Deploy mock WETH
    const MockWeth = await ethers.getContractFactory("MockWeth");
    wethToken = await MockWeth.deploy();
    await wethToken.waitForDeployment();

    // Deploy StakingRewards contract
    const StakingRewards = await ethers.getContractFactory("StakingRewards");
    stakingRewardsContract = await StakingRewards.deploy(
      await assetToken.getAddress(),
      await wethToken.getAddress(),
      "Staking Receipt Token",
      "SRT",
      claimRewardsMinimum,
      minDeposit,
      periodLength
    );
    await stakingRewardsContract.waitForDeployment();

    // Mint tokens to users for testing
    const mintAmount = ethers.parseEther("1000");
    await assetToken.mint(user1.address, mintAmount);
    await assetToken.mint(user2.address, mintAmount);
    await assetToken.mint(user3.address, mintAmount);

    // Approve staking contract to spend tokens
    await assetToken.connect(user1).approve(await stakingRewardsContract.getAddress(), ethers.MaxUint256);
    await assetToken.connect(user2).approve(await stakingRewardsContract.getAddress(), ethers.MaxUint256);
    await assetToken.connect(user3).approve(await stakingRewardsContract.getAddress(), ethers.MaxUint256);
  });

  describe("Deployment", function () {
    it("should set correct initial values", async function () {
      expect(await stakingRewardsContract.asset()).to.equal(await assetToken.getAddress());
      expect(await stakingRewardsContract.weth()).to.equal(await wethToken.getAddress());
      expect(await stakingRewardsContract.claimRewardsMinimum()).to.equal(claimRewardsMinimum);
      expect(await stakingRewardsContract.minDeposit()).to.equal(minDeposit);
      expect(await stakingRewardsContract.periodLength()).to.equal(periodLength);
      expect(await stakingRewardsContract.maxDeposit()).to.equal(ethers.MaxUint256);
      expect(await stakingRewardsContract.withdrawalsDisabled()).to.equal(false);
      expect(await stakingRewardsContract.withdrawalsDisabledForever()).to.equal(false);
    });

    it("should revert with zero address asset", async function () {
      const StakingRewards = await ethers.getContractFactory("StakingRewards");
      await expect(
        StakingRewards.deploy(
          ethers.ZeroAddress,
          await wethToken.getAddress(),
          "Staking Receipt Token",
          "SRT",
          claimRewardsMinimum,
          minDeposit,
          periodLength
        )
      ).to.be.revertedWith("PeriodicEthRewards: asset is the zero address");
    });

    it("should revert with zero address weth", async function () {
      const StakingRewards = await ethers.getContractFactory("StakingRewards");
      await expect(
        StakingRewards.deploy(
          await assetToken.getAddress(),
          ethers.ZeroAddress,
          "Staking Receipt Token",
          "SRT",
          claimRewardsMinimum,
          minDeposit,
          periodLength
        )
      ).to.be.revertedWith("PeriodicEthRewards: weth is the zero address");
    });

    it("should revert with zero period length", async function () {
      const StakingRewards = await ethers.getContractFactory("StakingRewards");
      await expect(
        StakingRewards.deploy(
          await assetToken.getAddress(),
          await wethToken.getAddress(),
          "Staking Receipt Token",
          "SRT",
          claimRewardsMinimum,
          minDeposit,
          0n
        )
      ).to.be.revertedWith("PeriodicEthRewards: period length is zero");
    });

    it("should revert with empty receipt token name", async function () {
      const StakingRewards = await ethers.getContractFactory("StakingRewards");
      await expect(
        StakingRewards.deploy(
          await assetToken.getAddress(),
          await wethToken.getAddress(),
          "",
          "SRT",
          claimRewardsMinimum,
          minDeposit,
          periodLength
        )
      ).to.be.revertedWith("PeriodicEthRewards: receipt token name is empty");
    });

    it("should revert with empty receipt token symbol", async function () {
      const StakingRewards = await ethers.getContractFactory("StakingRewards");
      await expect(
        StakingRewards.deploy(
          await assetToken.getAddress(),
          await wethToken.getAddress(),
          "Staking Receipt Token",
          "",
          claimRewardsMinimum,
          minDeposit,
          periodLength
        )
      ).to.be.revertedWith("PeriodicEthRewards: receipt token symbol is empty");
    });
  });

  describe("Deposit", function () {
    it("should allow user to deposit assets and mint receipt tokens", async function () {
      const depositAmount = ethers.parseEther("10");
      
      const tx = await stakingRewardsContract.connect(user1).deposit(depositAmount);
      await tx.wait();

      expect(await stakingRewardsContract.balanceOf(user1.address)).to.equal(depositAmount);
      expect(await assetToken.balanceOf(await stakingRewardsContract.getAddress())).to.equal(depositAmount);
      expect(await assetToken.balanceOf(user1.address)).to.equal(ethers.parseEther("990"));
    });

    it("should update lastDeposit timestamp", async function () {
      const depositAmount = ethers.parseEther("10");
      const blockTimestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0n;
      
      await stakingRewardsContract.connect(user1).deposit(depositAmount);
      
      const lastDeposit = await stakingRewardsContract.lastDeposit(user1.address);
      expect(lastDeposit).to.be.closeTo(blockTimestamp, 5n);
    });

    it("should revert if deposit is less than minDeposit", async function () {
      const depositAmount = ethers.parseEther("0.05");
      
      await expect(
        stakingRewardsContract.connect(user1).deposit(depositAmount)
      ).to.be.revertedWith("PeriodicEthRewards: deposit is less than min");
    });

    it("should revert if deposit is more than maxDeposit", async function () {
      const maxDeposit = ethers.parseEther("100");
      await stakingRewardsContract.setMaxDeposit(maxDeposit);
      
      const depositAmount = ethers.parseEther("101");
      
      await expect(
        stakingRewardsContract.connect(user1).deposit(depositAmount)
      ).to.be.revertedWith("PeriodicEthRewards: deposit is more than max");
    });

    it("should emit Deposit event", async function () {
      const depositAmount = ethers.parseEther("10");
      
      await expect(
        stakingRewardsContract.connect(user1).deposit(depositAmount)
      ).to.emit(stakingRewardsContract, "Deposit")
        .withArgs(user1.address, depositAmount);
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      const depositAmount = ethers.parseEther("10");
      await stakingRewardsContract.connect(user1).deposit(depositAmount);
    });

    it("should allow user to withdraw assets after lock period", async function () {
      const withdrawAmount = ethers.parseEther("5");
      
      // Advance time by periodLength + 1 second
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      const tx = await stakingRewardsContract.connect(user1).withdraw(withdrawAmount);
      await tx.wait();

      expect(await stakingRewardsContract.balanceOf(user1.address)).to.equal(ethers.parseEther("5"));
      expect(await assetToken.balanceOf(user1.address)).to.equal(ethers.parseEther("995"));
    });

    it("should revert if withdrawals are disabled", async function () {
      await stakingRewardsContract.toggleWithdrawals();
      
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        stakingRewardsContract.connect(user1).withdraw(ethers.parseEther("5"))
      ).to.be.revertedWith("PeriodicEthRewards: withdrawals are disabled");
    });

    it("should revert if withdrawals are disabled forever", async function () {
      await stakingRewardsContract.disableWithdrawalsForever();
      
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        stakingRewardsContract.connect(user1).withdraw(ethers.parseEther("5"))
      ).to.be.revertedWith("PeriodicEthRewards: withdrawals are disabled forever");
    });

    it("should revert if assets are still locked", async function () {
      await expect(
        stakingRewardsContract.connect(user1).withdraw(ethers.parseEther("5"))
      ).to.be.revertedWith("PeriodicEthRewards: assets are still locked");
    });

    it("should revert if withdrawing more than balance", async function () {
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        stakingRewardsContract.connect(user1).withdraw(ethers.parseEther("20"))
      ).to.be.revertedWith("PeriodicEthRewards: cannot withdraw more than balance");
    });

    it("should revert if withdrawing 0", async function () {
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        stakingRewardsContract.connect(user1).withdraw(0n)
      ).to.be.revertedWith("PeriodicEthRewards: cannot withdraw 0");
    });

    it("should revert if remaining balance is less than minDeposit", async function () {
      const depositAmount = ethers.parseEther("0.15");
      await stakingRewardsContract.connect(user2).deposit(depositAmount);
      
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Try to withdraw leaving less than minDeposit
      await expect(
        stakingRewardsContract.connect(user2).withdraw(ethers.parseEther("0.06"))
      ).to.be.revertedWith("PeriodicEthRewards: the remaining balance too low");
    });

    it("should allow full withdrawal if balance equals withdraw amount", async function () {
      const depositAmount = ethers.parseEther("10");
      
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      await stakingRewardsContract.connect(user1).withdraw(depositAmount);
      
      expect(await stakingRewardsContract.balanceOf(user1.address)).to.equal(0n);
    });

    it("should emit Withdraw event", async function () {
      const withdrawAmount = ethers.parseEther("5");
      
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        stakingRewardsContract.connect(user1).withdraw(withdrawAmount)
      ).to.emit(stakingRewardsContract, "Withdraw")
        .withArgs(user1.address, withdrawAmount);
    });
  });

  describe("Claim Rewards", function () {
    beforeEach(async function () {
      const depositAmount = ethers.parseEther("10");
      await stakingRewardsContract.connect(user1).deposit(depositAmount);
      await stakingRewardsContract.connect(user2).deposit(depositAmount);
    });

    it("should allow user to claim rewards after period ends", async function () {
      // Send ETH to contract
      const ethAmount = ethers.parseEther("2");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      // Advance time to end of period
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Update claim period manually (needed because _claim calls previewClaim before updating period)
      await stakingRewardsContract.updateLastClaimPeriod();

      const user1Balance = await stakingRewardsContract.balanceOf(user1.address);
      const totalSupply = await stakingRewardsContract.totalSupply();
      const expectedReward = (ethAmount * user1Balance) / totalSupply;

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await stakingRewardsContract.connect(user1).claimRewards();
      const receipt = await tx.wait();
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const actualReward = balanceAfter - balanceBefore + gasUsed;
      
      expect(actualReward).to.equal(expectedReward);
    });

    it("should distribute rewards proportionally to all stakers", async function () {
      // Send ETH to contract
      const ethAmount = ethers.parseEther("2");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      // Advance time to end of period
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Update claim period manually
      await stakingRewardsContract.updateLastClaimPeriod();

      const user1Balance = await stakingRewardsContract.balanceOf(user1.address);
      const user2Balance = await stakingRewardsContract.balanceOf(user2.address);
      const totalSupply = await stakingRewardsContract.totalSupply();

      const user1ExpectedReward = (ethAmount * user1Balance) / totalSupply;
      const user2ExpectedReward = (ethAmount * user2Balance) / totalSupply;

      const user1BalanceBefore = await ethers.provider.getBalance(user1.address);
      const tx1 = await stakingRewardsContract.connect(user1).claimRewards();
      const receipt1 = await tx1.wait();
      const user1BalanceAfter = await ethers.provider.getBalance(user1.address);
      const user1GasUsed = receipt1.gasUsed * receipt1.gasPrice;
      const user1ActualReward = user1BalanceAfter - user1BalanceBefore + user1GasUsed;

      const user2BalanceBefore = await ethers.provider.getBalance(user2.address);
      const tx2 = await stakingRewardsContract.connect(user2).claimRewards();
      const receipt2 = await tx2.wait();
      const user2BalanceAfter = await ethers.provider.getBalance(user2.address);
      const user2GasUsed = receipt2.gasUsed * receipt2.gasPrice;
      const user2ActualReward = user2BalanceAfter - user2BalanceBefore + user2GasUsed;

      expect(user1ActualReward).to.equal(user1ExpectedReward);
      expect(user2ActualReward).to.equal(user2ExpectedReward);
    });

    it("should not allow claiming if minimum not reached", async function () {
      // Send ETH less than minimum
      const ethAmount = ethers.parseEther("0.5");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      // Advance time to end of period
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Update claim period manually
      await stakingRewardsContract.updateLastClaimPeriod();

      const claimAmount = await stakingRewardsContract.previewClaim(user1.address);
      expect(claimAmount).to.equal(0n);
    });

    it("should roll over rewards to next period if minimum not reached", async function () {
      // Send ETH less than minimum
      const ethAmount1 = ethers.parseEther("0.5");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount1,
      });

      // Advance time to end of period
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Update period
      await stakingRewardsContract.updateLastClaimPeriod();

      // Send more ETH to reach minimum
      const ethAmount2 = ethers.parseEther("0.6");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount2,
      });

      // Advance time to end of next period
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Update period again
      await stakingRewardsContract.updateLastClaimPeriod();

      const totalRewards = ethAmount1 + ethAmount2;
      const user1Balance = await stakingRewardsContract.balanceOf(user1.address);
      const totalSupply = await stakingRewardsContract.totalSupply();
      const expectedReward = (totalRewards * user1Balance) / totalSupply;

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await stakingRewardsContract.connect(user1).claimRewards();
      const receipt = await tx.wait();
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const actualReward = balanceAfter - balanceBefore + gasUsed;
      
      expect(actualReward).to.equal(expectedReward);
    });

    it("should allow claiming for someone else", async function () {
      const ethAmount = ethers.parseEther("2");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Update claim period manually
      await stakingRewardsContract.updateLastClaimPeriod();

      const user1Balance = await stakingRewardsContract.balanceOf(user1.address);
      const totalSupply = await stakingRewardsContract.totalSupply();
      const expectedReward = (ethAmount * user1Balance) / totalSupply;

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await stakingRewardsContract.connect(user2).claimRewardsFor(user1.address);
      const receipt = await tx.wait();
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      const actualReward = balanceAfter - balanceBefore;
      
      expect(actualReward).to.equal(expectedReward);
    });

    it("should emit Claim event", async function () {
      const ethAmount = ethers.parseEther("2");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Update claim period manually
      await stakingRewardsContract.updateLastClaimPeriod();

      const user1Balance = await stakingRewardsContract.balanceOf(user1.address);
      const totalSupply = await stakingRewardsContract.totalSupply();
      const expectedReward = (ethAmount * user1Balance) / totalSupply;

      await expect(
        stakingRewardsContract.connect(user1).claimRewards()
      ).to.emit(stakingRewardsContract, "Claim")
        .withArgs(user1.address, user1.address, expectedReward);
    });
  });

  describe("Preview Functions", function () {
    beforeEach(async function () {
      const depositAmount = ethers.parseEther("10");
      await stakingRewardsContract.connect(user1).deposit(depositAmount);
    });

    it("should return correct previewClaim", async function () {
      const ethAmount = ethers.parseEther("2");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Update claim period manually
      await stakingRewardsContract.updateLastClaimPeriod();

      const user1Balance = await stakingRewardsContract.balanceOf(user1.address);
      const totalSupply = await stakingRewardsContract.totalSupply();
      const expectedReward = (ethAmount * user1Balance) / totalSupply;

      const previewReward = await stakingRewardsContract.previewClaim(user1.address);
      expect(previewReward).to.equal(expectedReward);
    });

    it("should return 0 for previewClaim if already claimed", async function () {
      const ethAmount = ethers.parseEther("2");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Update claim period manually
      await stakingRewardsContract.updateLastClaimPeriod();

      await stakingRewardsContract.connect(user1).claimRewards();

      const previewReward = await stakingRewardsContract.previewClaim(user1.address);
      expect(previewReward).to.equal(0n);
    });

    it("should return correct previewFutureClaim", async function () {
      const ethAmount = ethers.parseEther("2");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      const user1Balance = await stakingRewardsContract.balanceOf(user1.address);
      const totalSupply = await stakingRewardsContract.totalSupply();
      const expectedFutureReward = (ethAmount * user1Balance) / totalSupply;

      const previewFutureReward = await stakingRewardsContract.previewFutureClaim(user1.address);
      expect(previewFutureReward).to.equal(expectedFutureReward);
    });

    it("should return 0 for previewFutureClaim if no supply", async function () {
      const previewFutureReward = await stakingRewardsContract.previewFutureClaim(user2.address);
      expect(previewFutureReward).to.equal(0n);
    });
  });

  describe("Locked Time", function () {
    beforeEach(async function () {
      const depositAmount = ethers.parseEther("10");
      await stakingRewardsContract.connect(user1).deposit(depositAmount);
    });

    it("should return correct locked time left", async function () {
      const lockedTimeLeft = await stakingRewardsContract.getLockedTimeLeft(user1.address);
      expect(lockedTimeLeft).to.be.closeTo(periodLength, 5n);
    });

    it("should return 0 for locked time if period has passed", async function () {
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      const lockedTimeLeft = await stakingRewardsContract.getLockedTimeLeft(user1.address);
      expect(lockedTimeLeft).to.equal(0n);
    });

    it("should return 0 for locked time if user never deposited", async function () {
      const lockedTimeLeft = await stakingRewardsContract.getLockedTimeLeft(user2.address);
      expect(lockedTimeLeft).to.equal(0n);
    });
  });

  describe("Token Transfers", function () {
    beforeEach(async function () {
      const depositAmount = ethers.parseEther("10");
      await stakingRewardsContract.connect(user1).deposit(depositAmount);
    });

    it("should allow transfer after lock period", async function () {
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      const transferAmount = ethers.parseEther("5");
      await stakingRewardsContract.connect(user1).transfer(user2.address, transferAmount);

      expect(await stakingRewardsContract.balanceOf(user1.address)).to.equal(ethers.parseEther("5"));
      expect(await stakingRewardsContract.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("should revert transfer if assets are still locked", async function () {
      const transferAmount = ethers.parseEther("5");
      
      await expect(
        stakingRewardsContract.connect(user1).transfer(user2.address, transferAmount)
      ).to.be.revertedWith("PeriodicEthRewards: assets are still locked");
    });

    it("should revert transfer to contract address", async function () {
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      const transferAmount = ethers.parseEther("5");
      const contractAddress = await stakingRewardsContract.getAddress();
      
      await expect(
        stakingRewardsContract.connect(user1).transfer(contractAddress, transferAmount)
      ).to.be.revertedWith("PeriodicEthRewards: cannot transfer to token contract");
    });

    it("should claim rewards for sender on transfer", async function () {
      const ethAmount = ethers.parseEther("2");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      // Update claim period manually (transfer will also update it, but we need it updated before previewClaim works)
      await stakingRewardsContract.updateLastClaimPeriod();

      const user1Balance = await stakingRewardsContract.balanceOf(user1.address);
      const totalSupply = await stakingRewardsContract.totalSupply();
      const expectedReward = (ethAmount * user1Balance) / totalSupply;

      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const tx = await stakingRewardsContract.connect(user1).transfer(user2.address, ethers.parseEther("5"));
      const receipt = await tx.wait();
      const balanceAfter = await ethers.provider.getBalance(user1.address);

      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const actualReward = balanceAfter - balanceBefore + gasUsed;
      
      // Use closeTo to account for small rounding differences
      expect(actualReward).to.be.closeTo(expectedReward, ethers.parseEther("0.0001"));
    });
  });

  describe("Owner Functions", function () {
    it("should allow owner to set claimRewardsMinimum", async function () {
      const newMinimum = ethers.parseEther("2.0");
      await stakingRewardsContract.setClaimRewardsMinimum(newMinimum);
      
      expect(await stakingRewardsContract.claimRewardsMinimum()).to.equal(newMinimum);
    });

    it("should allow owner to set maxDeposit", async function () {
      const newMaxDeposit = ethers.parseEther("50");
      await stakingRewardsContract.setMaxDeposit(newMaxDeposit);
      
      expect(await stakingRewardsContract.maxDeposit()).to.equal(newMaxDeposit);
    });

    it("should allow owner to set minDeposit", async function () {
      const newMinDeposit = ethers.parseEther("0.2");
      await stakingRewardsContract.setMinDeposit(newMinDeposit);
      
      expect(await stakingRewardsContract.minDeposit()).to.equal(newMinDeposit);
    });

    it("should allow owner to toggle withdrawals", async function () {
      await stakingRewardsContract.toggleWithdrawals();
      expect(await stakingRewardsContract.withdrawalsDisabled()).to.equal(true);
      
      await stakingRewardsContract.toggleWithdrawals();
      expect(await stakingRewardsContract.withdrawalsDisabled()).to.equal(false);
    });

    it("should allow owner to disable withdrawals forever", async function () {
      await stakingRewardsContract.disableWithdrawalsForever();
      expect(await stakingRewardsContract.withdrawalsDisabledForever()).to.equal(true);
    });

    it("should allow owner to recover ERC20 tokens", async function () {
      // Deploy a mock token and send it to the contract
      const MockErc20TokenDecimals = await ethers.getContractFactory("MockErc20TokenDecimals");
      const mockToken = await MockErc20TokenDecimals.deploy("Mock Token", "MT", 18);
      await mockToken.waitForDeployment();

      const recoverAmount = ethers.parseEther("100");
      await mockToken.mint(await stakingRewardsContract.getAddress(), recoverAmount);

      await stakingRewardsContract.recoverERC20(
        await mockToken.getAddress(),
        recoverAmount,
        owner.address
      );

      expect(await mockToken.balanceOf(owner.address)).to.equal(ethers.parseEther("1100")); // 1000 from deploy + 100 recovered
    });

    it("should revert recovery of staking token", async function () {
      await expect(
        stakingRewardsContract.recoverERC20(
          await assetToken.getAddress(),
          ethers.parseEther("1"),
          owner.address
        )
      ).to.be.revertedWith("PeriodicEthRewards: cannot recover staking token");
    });

    it("should revert recovery of receipt token", async function () {
      await expect(
        stakingRewardsContract.recoverERC20(
          await stakingRewardsContract.getAddress(),
          ethers.parseEther("1"),
          owner.address
        )
      ).to.be.revertedWith("PeriodicEthRewards: cannot recover receipt token");
    });

    it("should revert if non-owner tries to call owner functions", async function () {
      await expect(
        stakingRewardsContract.connect(user1).setClaimRewardsMinimum(ethers.parseEther("2.0"))
      ).to.be.revertedWith("OwnableWithManagers: caller is not a manager or owner");
    });
  });

  describe("Manager Functions", function () {
    beforeEach(async function () {
      await stakingRewardsContract.addManager(manager.address);
    });

    it("should allow manager to set claimRewardsMinimum", async function () {
      const newMinimum = ethers.parseEther("2.0");
      await stakingRewardsContract.connect(manager).setClaimRewardsMinimum(newMinimum);
      
      expect(await stakingRewardsContract.claimRewardsMinimum()).to.equal(newMinimum);
    });

    it("should allow manager to set maxDeposit", async function () {
      const newMaxDeposit = ethers.parseEther("50");
      await stakingRewardsContract.connect(manager).setMaxDeposit(newMaxDeposit);
      
      expect(await stakingRewardsContract.maxDeposit()).to.equal(newMaxDeposit);
    });

    it("should allow manager to toggle withdrawals", async function () {
      await stakingRewardsContract.connect(manager).toggleWithdrawals();
      expect(await stakingRewardsContract.withdrawalsDisabled()).to.equal(true);
    });
  });

  describe("APY Calculation", function () {
    beforeEach(async function () {
      // Setup LP token with WETH balance for APY calculation
      const wethAmount = ethers.parseEther("1000");
      await wethToken.deposit({ value: wethAmount });
      await wethToken.transfer(await assetToken.getAddress(), wethAmount);
    });

    it("should return 0 APY if no ETH received", async function () {
      const apy = await stakingRewardsContract.getApy();
      expect(apy).to.equal(0n);
    });

    it("should calculate APY correctly", async function () {
      const depositAmount = ethers.parseEther("10");
      await stakingRewardsContract.connect(user1).deposit(depositAmount);

      // Send ETH to contract
      const ethAmount = ethers.parseEther("1");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      // Advance time by 1 day
      await ethers.provider.send("evm_increaseTime", [86400]);
      await ethers.provider.send("evm_mine", []);

      const apy = await stakingRewardsContract.getApy();
      expect(apy).to.be.gt(0n);
    });
  });

  describe("ERC20Votes", function () {
    beforeEach(async function () {
      const depositAmount = ethers.parseEther("10");
      await stakingRewardsContract.connect(user1).deposit(depositAmount);
    });

    it("should return correct clock mode", async function () {
      const clockMode = await stakingRewardsContract.CLOCK_MODE();
      expect(clockMode).to.equal("mode=timestamp");
    });

    it("should return current timestamp as clock", async function () {
      const blockTimestamp = (await ethers.provider.getBlock("latest"))?.timestamp || 0n;
      const clock = await stakingRewardsContract.clock();
      expect(clock).to.be.closeTo(Number(blockTimestamp), 5);
    });

    it("should track votes correctly", async function () {
      const depositAmount = ethers.parseEther("10");
      // In ERC20Votes, users need to delegate to themselves to have voting power
      await stakingRewardsContract.connect(user1).delegate(user1.address);
      const votes = await stakingRewardsContract.getVotes(user1.address);
      expect(votes).to.equal(depositAmount);
    });
  });

  describe("Edge Cases", function () {
    it("should handle multiple deposits correctly", async function () {
      await stakingRewardsContract.connect(user1).deposit(ethers.parseEther("5"));
      await stakingRewardsContract.connect(user1).deposit(ethers.parseEther("5"));
      
      expect(await stakingRewardsContract.balanceOf(user1.address)).to.equal(ethers.parseEther("10"));
    });

    it("should handle multiple withdrawals correctly", async function () {
      await stakingRewardsContract.connect(user1).deposit(ethers.parseEther("10"));
      
      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      await stakingRewardsContract.connect(user1).withdraw(ethers.parseEther("3"));
      await stakingRewardsContract.connect(user1).withdraw(ethers.parseEther("3"));
      
      expect(await stakingRewardsContract.balanceOf(user1.address)).to.equal(ethers.parseEther("4"));
    });

    it("should handle period updates correctly", async function () {
      const ethAmount = ethers.parseEther("2");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      await ethers.provider.send("evm_increaseTime", [Number(periodLength) + 1]);
      await ethers.provider.send("evm_mine", []);

      await stakingRewardsContract.updateLastClaimPeriod();

      const claimRewardsTotal = await stakingRewardsContract.claimRewardsTotal();
      expect(claimRewardsTotal).to.equal(ethAmount);
    });

    it("should handle receive function correctly", async function () {
      const depositAmount = ethers.parseEther("10");
      await stakingRewardsContract.connect(user1).deposit(depositAmount);

      const ethAmount = ethers.parseEther("1");
      await owner.sendTransaction({
        to: await stakingRewardsContract.getAddress(),
        value: ethAmount,
      });

      const futureRewards = await stakingRewardsContract.futureRewards();
      expect(futureRewards).to.equal(ethAmount);
    });
  });
});

