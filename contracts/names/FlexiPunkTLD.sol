// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.17;

import "./interfaces/IFlexiPunkMetadata.sol";
import "./interfaces/IBasePunkTLD.sol";
import "../lib/strings.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";

/// @title Punk Domains TLD contract (Flexi)
/// @author Tempe Techie
/// @notice Dynamically generated NFT contract which represents a top-level domain
contract FlexiPunkTLD is IBasePunkTLD, ERC721, Ownable, ReentrancyGuard {
  using strings for string;

  // Custom errors
  error DomainAlreadyExists();
  error DomainBuyingDisabled();
  error DomainMintingDisabledForever();
  error DomainNameContainsDots();
  error DomainNameContainsSpaces();
  error DomainNameEmpty();
  error DomainNameTooLong();
  error FailedToSendDomainPayment();
  error FailedToSendReferralFee();
  error FailedToSendRoyalty();
  error InsufficientPayment();
  error MetadataFrozen();
  error NotDomainHolder();
  error NotRoyaltyFeeReceiver();
  error NotRoyaltyFeeUpdater();
  error ReferralFeeTooHigh();
  error RoyaltyTooHigh();

  // Domain struct is defined in IBasePunkTLD

  address public immutable factoryAddress; // FlexiPunkTLDFactory address
  address public metadataAddress; // FlexiPunkMetadata address
  address public minter; // address which is allowed to mint domains even if contract is paused
  address public royaltyFeeUpdater; // address which is allowed to change the royalty fee
  address public royaltyFeeReceiver; // address which receives the royalty fee

  bool public buyingEnabled = false; // buying domains enabled
  bool public buyingDisabledForever = false; // buying domains disabled forever
  bool public metadataFrozen = false; // metadata address frozen forever

  uint256 public totalSupply;
  uint256 public idCounter = 1; // up only

  uint256 public override price; // domain price
  uint256 public royalty; // share of each domain purchase (in bips) that goes to Punk Domains
  uint256 public override referral = 1000; // share of each domain purchase (in bips) that goes to the referrer (referral fee)
  uint256 public nameMaxLength = 140; // max length for minting a domain name
  
  mapping (string => Domain) public override domains; // mapping (domain name => Domain struct); Domain struct is defined in IBasePunkTLD
  mapping (uint256 => string) public domainIdsNames; // mapping (tokenId => domain name)
  mapping (address => string) public override defaultNames; // user's default domain

  constructor(
    string memory _name,
    string memory _symbol,
    address _tldOwner,
    uint256 _domainPrice,
    bool _buyingEnabled,
    uint256 _royalty,
    address _factoryAddress,
    address _metadataAddress
  ) ERC721(_name, _symbol) {
    price = _domainPrice;
    buyingEnabled = _buyingEnabled;
    royalty = _royalty;
    metadataAddress = _metadataAddress;

    Ownable factory = Ownable(_factoryAddress);

    factoryAddress = _factoryAddress;
    royaltyFeeUpdater = factory.owner();
    royaltyFeeReceiver = factory.owner();

    transferOwnership(_tldOwner);
  }

  // READ

  // Domain getters - you can also get all Domain data by calling the auto-generated domains(domainName) method
  function getDomainHolder(string calldata _domainName) public override view returns(address) {
    return domains[strings.lower(_domainName)].holder;
  }

  function getDomainData(string calldata _domainName) public override view returns(string memory) {
    return domains[strings.lower(_domainName)].data; // should be a JSON object
  }

  function tokenURI(uint256 _tokenId) public view override returns (string memory) {
    return IFlexiPunkMetadata(metadataAddress).getMetadata(
      address(this),
      domains[domainIdsNames[_tokenId]].name, 
      name(), 
      _tokenId
    );
  }

  // WRITE

  /// @notice Flexi-specific function
  function burn(string calldata _domainName) external {
    string memory dName = strings.lower(_domainName);
    if (domains[dName].holder != _msgSender()) revert NotDomainHolder();
    uint256 tokenId = domains[dName].tokenId;
    delete domainIdsNames[tokenId]; // delete tokenId => domainName mapping
    delete domains[dName]; // delete string => Domain struct mapping

    if (keccak256(bytes(defaultNames[_msgSender()])) == keccak256(bytes(dName))) delete defaultNames[_msgSender()];

    _burn(tokenId); // burn the token
    --totalSupply;
    emit DomainBurned(_msgSender(), dName);
  }

  /// @notice Default domain is the domain name that reverse resolver returns for a given address.
  function editDefaultDomain(string calldata _domainName) external {
    string memory dName = strings.lower(_domainName);
    if (domains[dName].holder != _msgSender()) revert NotDomainHolder();
    defaultNames[_msgSender()] = dName;
    emit DefaultDomainChanged(_msgSender(), dName);
  }

  /// @notice Edit domain custom data. Make sure to not accidentally delete previous data. Fetch previous data first.
  /// @param _domainName Only domain name, no TLD/extension.
  /// @param _data Custom data needs to be in a JSON object format.
  function editData(string calldata _domainName, string calldata _data) external {
    string memory dName = strings.lower(_domainName);
    if (domains[dName].holder != _msgSender()) revert NotDomainHolder();
    domains[dName].data = _data;
    emit DataChanged(_msgSender(), _domainName);
  }

  /// @notice Mint a new domain name as NFT (no dots and spaces allowed).
  /// @param _domainName Enter domain name without TLD and make sure letters are in lowercase form.
  /// @return token ID
  function mint(
    string memory _domainName,
    address _domainHolder,
    address _referrer
  ) external payable override nonReentrant returns(uint256) {
    if (buyingDisabledForever) revert DomainMintingDisabledForever();
    if (!buyingEnabled && _msgSender() != owner() && _msgSender() != minter) revert DomainBuyingDisabled();
    if (msg.value < price) revert InsufficientPayment();

    _sendPayment(msg.value, _referrer);

    return _mintDomain(_domainName, _domainHolder, "");
  }

  function _mintDomain(
    string memory _domainNameRaw, 
    address _domainHolder,
    string memory _data
  ) internal returns(uint256) {
    string memory _domainName = strings.lower(_domainNameRaw);

    if (strings.len(strings.toSlice(_domainName)) == 0) revert DomainNameEmpty();
    if (bytes(_domainName).length >= nameMaxLength) revert DomainNameTooLong();
    if (strings.count(strings.toSlice(_domainName), strings.toSlice(".")) > 0) revert DomainNameContainsDots();
    if (strings.count(strings.toSlice(_domainName), strings.toSlice(" ")) > 0) revert DomainNameContainsSpaces();
    if (domains[_domainName].holder != address(0)) revert DomainAlreadyExists();

    _mint(_domainHolder, idCounter);

    Domain memory newDomain; // Domain struct is defined in IBasePunkTLD
    
    // store data in Domain struct
    newDomain.name = _domainName;
    newDomain.tokenId = idCounter;
    newDomain.holder = _domainHolder;
    newDomain.data = _data;

    // add to both mappings
    domains[_domainName] = newDomain;
    domainIdsNames[idCounter] = _domainName;

    // if default domain name is not set for that holder, set it now
    if (bytes(defaultNames[_domainHolder]).length == 0) defaultNames[_domainHolder] = _domainName;
    
    emit DomainCreated(_msgSender(), _domainHolder, string(abi.encodePacked(_domainName, name())));

    ++idCounter;
    ++totalSupply;

    return idCounter-1;
  }

  function _sendPayment(uint256 _paymentAmount, address _referrer) internal {
    if (royalty > 0 && royalty < 5000) { 
      // send royalty - must be less than 50% (5000 bips)
      (bool sentRoyalty, ) = payable(royaltyFeeReceiver).call{value: ((_paymentAmount * royalty) / 10000)}("");
      if (!sentRoyalty) revert FailedToSendRoyalty();
    }

    if (_referrer != address(0) && referral > 0 && referral < 5000) {
      // send referral fee - must be less than 50% (5000 bips)
      (bool sentReferralFee, ) = payable(_referrer).call{value: ((_paymentAmount * referral) / 10000)}("");
      if (!sentReferralFee) revert FailedToSendReferralFee();
    }

    // send the rest to TLD owner
    (bool sent, ) = payable(owner()).call{value: address(this).balance}("");
    if (!sent) revert FailedToSendDomainPayment();
  }

  ///@dev Hook that is called before any token transfer. This includes minting and burning.
  function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal override {
    super._beforeTokenTransfer(from, to, tokenId, batchSize);

    if (from != address(0)) { // run on every transfer but not on mint
      domains[domainIdsNames[tokenId]].holder = to; // change holder address in Domain struct
      
      if (bytes(defaultNames[to]).length == 0 && to != address(0)) {
        defaultNames[to] = domains[domainIdsNames[tokenId]].name; // if default domain name is not set for that holder, set it now
      }

      if (strings.equals(strings.toSlice(domains[domainIdsNames[tokenId]].name), strings.toSlice(defaultNames[from]))) {
        delete defaultNames[from]; // if previous owner had this domain name as default, unset it as default
      }
    }
    
  }

  // OWNER

  /// @notice Only TLD contract owner can call this function. Flexi-specific function.
  function changeMetadataAddress(address _metadataAddress) external onlyOwner {
    if (metadataFrozen) revert MetadataFrozen();
    address previousAddress = metadataAddress;
    metadataAddress = _metadataAddress;
    emit MetadataAddressChanged(previousAddress, _metadataAddress);
  }

  /// @notice Only TLD contract owner can call this function. Flexi-specific function.
  function changeMinter(address _minter) external onlyOwner {
    address previousMinter = minter;
    minter = _minter;
    emit MinterAddressChanged(previousMinter, _minter);
  }

  /// @notice Only TLD contract owner can call this function.
  function changeNameMaxLength(uint256 _maxLength) external override onlyOwner {
    uint256 previousLength = nameMaxLength;
    nameMaxLength = _maxLength;
    emit NameMaxLengthChanged(_msgSender(), previousLength, _maxLength);
  }

  /// @notice Only TLD contract owner can call this function.
  function changePrice(uint256 _price) external override onlyOwner {
    price = _price;
    emit TldPriceChanged(_msgSender(), _price);
  }

  /// @notice Only TLD contract owner can call this function.
  function changeReferralFee(uint256 _referral) external override onlyOwner {
    if (_referral >= 5000) revert ReferralFeeTooHigh();
    referral = _referral;
    emit ReferralFeeChanged(_msgSender(), _referral);
  }

  /// @notice Only TLD contract owner can call this function. Flexi-specific function.
  function disableBuyingForever() external onlyOwner {
    buyingDisabledForever = true; // this action is irreversible
    emit MintingDisabledForever(_msgSender());
  }

  /// @notice Freeze metadata address. Only TLD contract owner can call this function.
  function freezeMetadata() external onlyOwner {
    metadataFrozen = true; // this action is irreversible
    emit MetadataFreeze(_msgSender());
  }

  /// @notice Only TLD contract owner can call this function.
  function toggleBuyingDomains() external onlyOwner {
    buyingEnabled = !buyingEnabled;
    emit DomainBuyingToggle(_msgSender(), buyingEnabled);
  }
  
  // ROYALTY FEE UPDATER

  /// @notice This changes royalty fee in the wrapper contract. Use basis points (bips) for the value.
  function changeRoyalty(uint256 _royalty) external {
    if (_royalty > 5000) revert RoyaltyTooHigh(); // cannot exceed 50% (5000 basis points or bips)
    if (_msgSender() != royaltyFeeUpdater) revert NotRoyaltyFeeUpdater();
    royalty = _royalty;
    emit TldRoyaltyChanged(_msgSender(), _royalty);
  }

  /// @notice This changes royalty fee receiver address. Flexi-specific function.
  function changeRoyaltyFeeReceiver(address _newReceiver) external {
    if (_msgSender() != royaltyFeeReceiver) revert NotRoyaltyFeeReceiver();
    address previousReceiver = royaltyFeeReceiver;
    royaltyFeeReceiver = _newReceiver;
    emit RoyaltyFeeReceiverChanged(previousReceiver, _newReceiver);
  }

  /// @notice This changes royalty fee updater address. Flexi-specific function.
  function changeRoyaltyFeeUpdater(address _newUpdater) external {
    if (_msgSender() != royaltyFeeUpdater) revert NotRoyaltyFeeUpdater();
    address previousUpdater = royaltyFeeUpdater;
    royaltyFeeUpdater = _newUpdater;
    emit RoyaltyFeeUpdaterChanged(previousUpdater, _newUpdater);
  }
}
