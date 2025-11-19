// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

interface IMONFTMinter is IERC20 {
  function mint(address to, uint256 amount) external;
}

interface IActivityPoints {
  function getTotalWeiSpent(address _address) external view returns (uint256);
}

/**
@title Chat Token Claim For Activity Points
@notice Smart contract for claiming chat tokens earned via activity points.
*/
contract MONFTClaimActivityPoints is Ownable {
  address public immutable monftMinter;
  address public immutable apAddress; // activity points smart contract address

  bool public paused = false;

  uint256 public immutable chatEthRatio; // for example, 1000: 1 ETH = 1,000 CHAT
  
  mapping(address => bool) public hasClaimed; // addresses that have already claimed

  // CONSTRUCTOR
  constructor(
    address _monftMinter, 
    address _apAddress, 
    uint256 _chatEthRatio 
  ) {
    require(_chatEthRatio > 0, "MONFTClaimActivityPoints: chatEthRatio must be greater than 0");
    require(_monftMinter != address(0), "MONFTClaimActivityPoints: monftMinter cannot be zero address");
    require(_apAddress != address(0), "MONFTClaimActivityPoints: apAddress cannot be zero address");

    monftMinter = _monftMinter;
    apAddress = _apAddress;
    chatEthRatio = _chatEthRatio;
  }

  // READ

  function claimPreview(address _address) public view returns (uint256) {
    if (hasClaimed[_address]) return 0; // already claimed

    uint256 _mintedWei = IActivityPoints(apAddress).getTotalWeiSpent(_address);
    return _mintedWei * chatEthRatio;
  }

  // WRITE

  function claim() external {
    require(!paused, "MONFTClaimActivityPoints: claiming is paused");
    require(!hasClaimed[msg.sender], "MONFTClaimActivityPoints: user already claimed");

    uint256 _claimAmount = claimPreview(msg.sender);
    require(_claimAmount > 0, "MONFTClaimActivityPoints: no tokens to claim");

    hasClaimed[msg.sender] = true; // mark as claimed
    IMONFTMinter(monftMinter).mint(msg.sender, _claimAmount);
  }

  // OWNER

  function togglePaused() external onlyOwner {
    paused = !paused;
  }
}