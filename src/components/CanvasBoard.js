import React from 'react';
import isMobileOrTablet from 'utils/isMobileOrTablet';
import sync from 'utils/css-animation-sync';

import "./CanvasBoard.scss";

const CELL_SIZE = isMobileOrTablet() ? 31 : 25;

const drawRowsToCanvas = (canvas, rows, scaleFactor = 1) => {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if(rows && rows.length > 0) {
    canvas.width = rows.length * scaleFactor;
    canvas.height = rows[0].length * scaleFactor;

    for(let a = 0; a < rows.length; a++) {
      for(let b = 0; b < rows[a].length; b++) {
        ctx.fillStyle = rows[a][b];
        ctx.fillRect(b * scaleFactor, a * scaleFactor, scaleFactor, scaleFactor);
      }
    }
  }
};

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

  handleCellClick = e => {
    this.props.onCellClick(e.target.getAttribute("data-i"), e.target.getAttribute("data-j"));
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
    const scaleFactor = CELL_SIZE;
    drawRowsToCanvas(canvas, rows, scaleFactor);

    // Draw grid
    const ctx = canvas.getContext("2d");
    if(rows && rows.length > 0) {
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;

      ctx.translate(0.5, 0.5);
      for(let a = 0; a < rows.length; a++) {
        ctx.beginPath();
        ctx.moveTo(0, a * scaleFactor);
        ctx.lineTo(canvas.width, a * scaleFactor);
        ctx.stroke();
      }
      
      for(let b = 0; b < rows[0].length; b++) {
        ctx.beginPath();
        ctx.moveTo(b * scaleFactor, 0);
        ctx.lineTo(b * scaleFactor, canvas.height);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(0, canvas.height - 1);
      ctx.lineTo(canvas.width, canvas.height - 1);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(canvas.width - 1, 0);
      ctx.lineTo(canvas.width - 1, canvas.height);
      ctx.stroke();
      ctx.translate(-0.5, -0.5);
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