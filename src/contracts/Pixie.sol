pragma solidity >=0.4.21 <0.6.0;

contract Pixie {

  uint constant numColumns = 16;
  uint constant numRows = 16;

  bytes3[256] public colors;

  constructor() public {
    for(uint i = 0; i < numRows; i++) {
      for(uint j = 0; j < numColumns; j++) {
        setColor(i, j, 0xffffff);
      }
    }
  }

  function getAllColors() public view returns (bytes3[256] memory _colors) {
    return colors;
  }

  function getColor(uint row, uint column) public view returns (bytes3 color) {
    return colors[row * numColumns + column];
  }


  function setColor(uint row, uint column, bytes3 color) public {
    colors[row * numColumns + column] = color;
  }
}