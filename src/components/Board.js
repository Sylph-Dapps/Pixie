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

  render() {
    const {
      rows,
      pendingCells,
      onCellClick,
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
                      key={j}
                      onClick={() => onCellClick(i, j)}
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