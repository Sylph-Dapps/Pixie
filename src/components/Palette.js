import React from 'react';

import "./Palette.scss";

const COLORS_PER_ROW = 14;

class Palette extends React.Component {

  colorArrayToGrid = colors => {
    const grid = [];
    for(var a = 0; a < colors.length; a++) {
      if(a % COLORS_PER_ROW === 0) {
        grid.push([]);
      }
      grid[grid.length - 1].push(colors[a]);
    }
    return grid;
  }

  render() {
    const {
      colors,
      selectedColorIndex,
      onPaletteItemClick,
    } = this.props;

    const colorGrid = this.colorArrayToGrid(colors);

    return (
      <div className="Palette">
        { colorGrid.map( (row, i) => {
          return (
            <div className="row" key={i}>
              { row.map( (paletteColor, j) => {
                const style = {
                  backgroundColor: paletteColor,
                  border: "1px solid black",
                };
                if(i * COLORS_PER_ROW + j === selectedColorIndex) {
                  style.border = "3px solid red";
                }
                return (
                  <div className="palette-item-container" key={j}>
                    <div className="palette-item"
                      style={style}
                      onClick={() => onPaletteItemClick(i * COLORS_PER_ROW + j)} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

}

Palette.defaultProps = {
  colors: [],
  selectedColorIndex: 0,
  onPaletteItemClick: ()  => {},
};

export default Palette;