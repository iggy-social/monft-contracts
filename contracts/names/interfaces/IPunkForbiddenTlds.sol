// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.17;

interface IPunkForbiddenTlds {

  function isTldForbidden(string memory _name) external view returns (bool);

  function addForbiddenTld(string memory _name) external;

}
