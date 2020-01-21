pragma solidity >=0.4.21 <0.6.0;

contract Pixie {

  address public owner;

  bool public initialized = false;

  bool public active = true;

  bool public requiresAccessChecks = true;

  mapping(address => bool) public allowedAddresses;

  uint16 constant numColumns = 32;
  uint16 constant numRows = 32;
  uint24[numColumns * numRows] public colors;

  event ColorSetEvent(uint16 row, uint16 column, uint24 color);

  constructor() public {
    owner = msg.sender;
    grantAccess(owner);
  }

  modifier onlyOwner() {
    require(msg.sender == owner, "sender must be owner");
    _;
  }

  modifier onlyBeforeInitialization() {
    require(!initialized, "Pixie has already been initialized");
    _;
  }

  modifier onlyAfterInitialization() {
    require(initialized, "Pixie has not been initialized");
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

  function finishInitialization() public onlyOwner {
    initialized = true;
  }

  function pause() public onlyOwner onlyWhenActive {
    active = false;
  }

  function resume() public onlyOwner onlyWhenPaused {
    active = true;
  }

  function enableAccessChecks() public onlyOwner {
    requiresAccessChecks = true;
  }

  function disableAccessChecks() public onlyOwner {
    requiresAccessChecks = false;
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

  function getNumColumns() public pure returns(uint16 _numColumns) {
    return numColumns;
  }

  function getNumRows() public pure returns(uint16 _numRows) {
    return numRows;
  }

  function getAllColors() public view returns (uint24[numColumns * numRows] memory _colors) {
    return colors;
  }

  function getColor(uint8 row, uint8 column) public view returns (uint24 color) {
    return colors[row * numColumns + column];
  }

  function setColor(uint8 row, uint8 column, uint24 color) public onlyWhenActive onlyAfterInitialization {
    if(requiresAccessChecks) {
      require(hasAccess(msg.sender), "Address is not allowed to call setColor");
    }
    colors[row * numColumns + column] = color;

    emit ColorSetEvent(row, column, color);
  }

  function initializeColumn(uint8 column, uint24 color) public onlyOwner onlyBeforeInitialization {
    for(uint16 i = 0; i < numRows; i++) {
      colors[i * numColumns + column] = color;
    }
  }
}