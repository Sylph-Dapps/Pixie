import React from 'react';
import isMobileOrTablet from 'utils/isMobileOrTablet';
import sync from 'utils/css-animation-sync';

import "./Board.scss";

const CELL_SIZE = isMobileOrTablet() ? 31 : 25;
const BORDER_SIZE = 1;

class Board extends React.Component {

  constructor(props) {
    super(props);
    sync('pulse');
  }

  handleCellClick = e => {
    this.props.onCellClick(e.target.getAttribute("data-i"), e.target.getAttribute("data-j"));
  }

  render() {
    const {
      rows,
      pendingCells,
    } = this.props;

    const boardContentStyle = {
      height: (CELL_SIZE + BORDER_SIZE) * rows[0].length + 1
    };

    const rowStyle = {
      width: (CELL_SIZE * rows[0].length) + (BORDER_SIZE * 2),
      height: CELL_SIZE + BORDER_SIZE,
    };

    return (
      <div className="Board">
        <div className="board-content" style={boardContentStyle}>
          { rows.map( (row, i) => {
            return (
              <div className="row"
                key={i}
                style={rowStyle}>
                { row.map( (cellColor, j) => {
                  const style = {
                    backgroundColor: cellColor,
                    border: BORDER_SIZE + 'px solid black',
                    width: CELL_SIZE + 'px',
                    height: CELL_SIZE + 'px',
                  };

                  const nextColor = pendingCells[i + ',' + j];

                  return (
                    <div className="cell"
                      data-i={i}
                      data-j={j}
                      key={j}
                      onClick={this.handleCellClick}
                      style={style}>
                      { nextColor &&
                        <div className="pending-indicator" style={{
                          backgroundColor: nextColor,
                        }}/>
                      }
                    </div>
                  );
                }) }
              </div>
              );
            }
          )}
        </div>
      </div>
    );
  }

}

Board.defaultProps = {
  rows: [[]],
  pendingCells: 0,
  onCellClick: ()  => {},
};

export default Board;