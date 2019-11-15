pragma solidity >=0.4.21 <0.6.0;

contract Pixie {

  uint8 constant numColumns = 16;
  uint8 constant numRows = 16;

  uint24[numColumns * numRows] public colors;

  event ColorSetEvent(uint8 row, uint8 column, uint24 color);

  constructor() public {
    for(uint8 i = 0; i < numRows; i++) {
      for(uint8 j = 0; j < numColumns; j++) {
        setColor(i, j, 0xffffff);
      }
    }
  }

  function getAllColors() public view returns (uint24[numColumns * numRows] memory _colors) {
    return colors;
  }

  function getColor(uint8 row, uint8 column) public view returns (uint24 color) {
    return colors[row * numColumns + column];
  }


  function setColor(uint8 row, uint8 column, uint24 color) public {
    colors[row * numColumns + column] = color;

    emit ColorSetEvent(row, column, color);
  }
}