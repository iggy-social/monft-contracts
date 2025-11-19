// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

interface IMONFTMinter is IERC20 {
  function mint(address to, uint256 amount) external;
}

interface IBasePunkTLD {
  function domains(string calldata _domainName) external view returns(string memory, uint256, address, string memory);
  function getDomainHolder(string calldata _domainName) external view returns(address);
}

/**
@title Chat Token Claim For Domain Holders
@notice Airdrop for domain holders
*/
contract MONFTClaimDomains is Ownable {
  address public immutable monftMinter;
  address public immutable domainAddress; // address of the punk domain smart contract

  bool public paused = false;

  uint256 public chatReward; // how many tokens a domain gets (in wei)
  uint256 public maxIdEligible; // max domain ID eligible for claiming (aka snapshot)
  
  mapping(string => bool) public hasClaimed; // domain names that have already claimed

  // CONSTRUCTOR
  constructor(
    address _monftMinter, 
    address _domainAddress, 
    uint256 _chatReward, 
    uint256 _maxIdEligible
  ) {
    require(_chatReward > 0, "MONFTClaimDomains: chatReward must be greater than 0");
    require(_monftMinter != address(0), "MONFTClaimDomains: monftMinter cannot be zero address");
    require(_domainAddress != address(0), "MONFTClaimDomains: domain contract cannot be zero address");

    monftMinter = _monftMinter;
    domainAddress = _domainAddress;
    chatReward = _chatReward;
    maxIdEligible = _maxIdEligible;
  }

  // WRITE

  /**
  @notice Claim chat tokens for a domain name. Anyone can claim for any domain name, but only holder gets the tokens.
  */
  function claim(string calldata _domainName) external {
    require(!paused, "MONFTClaimDomains: claiming is paused");
    require(!hasClaimed[_domainName], "MONFTClaimDomains: domain already claimed");

    (, uint256 _domainId, , ) = IBasePunkTLD(domainAddress).domains(_domainName); // check if domain exists
    require(_domainId <= maxIdEligible, "MONFTClaimDomains: domain ID not eligible for claiming");

    address _domainHolder = IBasePunkTLD(domainAddress).getDomainHolder(_domainName);
    require(_domainHolder != address(0), "MONFTClaimDomains: domain not registered");

    hasClaimed[_domainName] = true; // mark as claimed
    IMONFTMinter(monftMinter).mint(_domainHolder, chatReward);
  }

  // OWNER

  function changeChatReward(uint256 _chatReward) external onlyOwner {
    require(_chatReward > 0, "MONFTClaimDomains: chatReward must be greater than 0");
    chatReward = _chatReward;
  }

  function changeMaxIdEligible(uint256 _maxIdEligible) external onlyOwner {
    maxIdEligible = _maxIdEligible;
  }

  function togglePaused() external onlyOwner {
    paused = !paused;
  }
}