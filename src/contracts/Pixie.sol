pragma solidity >=0.4.21 <0.6.0;

contract Pixie {

  address public owner;

  bool public active = true;

  mapping(address => bool) public allowedAddresses;

  uint8 constant numColumns = 16;
  uint8 constant numRows = 16;
  uint24[numColumns * numRows] public colors;

  event ColorSetEvent(uint8 row, uint8 column, uint24 color);

  constructor() public {
    owner = msg.sender;
    grantAccess(owner);

    // Set the initial colors for each pixel
    for(uint8 i = 0; i < numRows; i++) {
      for(uint8 j = 0; j < numColumns; j++) {
        // Do an inline assignment of the colors rather than calling setColor so we don't emit events during initialization
        colors[i * numColumns + j] = 0xfcfcfc;
      }
    }
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "sender must be owner");
    _;
  }

  modifier onlyWhenActive() {
    require(active, "Pixie is not active");
    _;
  }

  modifier onlyWhenPaused() {
    require(!active, "Pixie is not paused");
    _;
  }

  function pause() public onlyOwner onlyWhenActive {
    active = false;
  }

  function resume() public onlyOwner onlyWhenPaused {
    active = true;
  }

  function grantAccess(address account) public onlyOwner {
    allowedAddresses[account] = true;
  }

  function revokeAccess(address account) public onlyOwner {
    require(account != owner, "The owner's access cannot be revoked");
    delete allowedAddresses[account];
  }

  function hasAccess(address account) public view returns (bool allowed) {
    return allowedAddresses[account] == true;
  }

  function getAllColors() public view returns (uint24[numColumns * numRows] memory _colors) {
    return colors;
  }

  function getColor(uint8 row, uint8 column) public view returns (uint24 color) {
    return colors[row * numColumns + column];
  }

  function setColor(uint8 row, uint8 column, uint24 color) public onlyWhenActive {
    require(hasAccess(msg.sender), "Address is not allowed to call setColor");
    colors[row * numColumns + column] = color;

    emit ColorSetEvent(row, column, color);
  }
}