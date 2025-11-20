// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

import "@rari-capital/solmate/src/tokens/ERC20.sol";

// Mock token contract for testing purposes only (not audited, DO NOT USE IN PRODUCTION!)
contract MockWeth is ERC20 {
  
  // WETH-specific events
  event Deposit(address indexed dst, uint wad);
  event Withdrawal(address indexed src, uint wad);
  
  constructor() ERC20("Wrapped Ether", "WETH", 18) {}

  // Fallback function - automatically deposit when ETH is sent
  fallback() external payable {
    deposit();
  }

  // Receive function - handle direct ETH transfers
  receive() external payable {
    deposit();
  }

  function deposit() public payable {
    _mint(msg.sender, msg.value);
    emit Deposit(msg.sender, msg.value);
  }

  function withdraw(uint amount) public {
    _burn(msg.sender, amount);
    payable(msg.sender).transfer(amount);
    emit Withdrawal(msg.sender, amount);
  }
}
