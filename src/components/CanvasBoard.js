import React from 'react';
import isMobileOrTablet from 'utils/isMobileOrTablet';
import {
  drawCells,
  drawGrid
} from 'utils/PixieCanvasUtils';
import sync from 'utils/css-animation-sync';

import "./CanvasBoard.scss";

const CELL_SIZE = isMobileOrTablet() ? 31 : 25;

class CanvasBoard extends React.Component {

  constructor(props) {
    super(props);
    sync('pulse');
  }

  handelClick = e => {
    var rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const row = Math.floor(y/CELL_SIZE);
    const column = Math.floor(x/CELL_SIZE);
    this.props.onCellClick(row, column);
  };

  componentDidMount() {
    this.redraw();
  }

  componentDidUpdate() {
    this.redraw();
  }

  redraw = () => {
    const {
      rows,
    } = this.props;

    const canvas = document.getElementById('board-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(rows && rows.length > 0) {
      canvas.width = rows[0].length * CELL_SIZE;
      canvas.height = rows.length * CELL_SIZE;
      drawCells(canvas, rows, CELL_SIZE);
      drawGrid(canvas, rows, CELL_SIZE);
    }
  }

  render() {
    const {
      rows,
      pendingCells,
    } = this.props;

    return (
      <div className="CanvasBoard">
        <div className="board-content">
          <canvas id="board-canvas" onClick={this.handelClick}/>
          { Object.keys(pendingCells).map(key => {
              const row = parseInt(key.split(",")[0]);
              const column = parseInt(key.split(",")[1]);
              const x = column * CELL_SIZE;
              const y = row * CELL_SIZE;
              const style = {
                position: 'absolute',
                top: y + 1,
                left: x + 1,
                width: column === rows.length - 1 ? CELL_SIZE - 2 : CELL_SIZE - 1,
                height: row === rows[0].length - 1 ? CELL_SIZE - 2 : CELL_SIZE - 1,
              }

              return (
                <div className="cell"
                  key={key}
                  style={style}>
                  <div className="pending-indicator" style={{
                    backgroundColor: pendingCells[key],
                  }}/>
                </div>
              );
            })
          }
        </div>
      </div>
    );
  }

}

CanvasBoard.defaultProps = {
  rows: [[]],
  pendingCells: 0,
  onCellClick: ()  => {},
};

export default CanvasBoard;