import React from 'react';
import PixieAbi from 'abis/Pixie.json';
import CanvasBoard from 'components/CanvasBoard';
import Palette from 'components/Palette';
import PopupMessage, {
  ABOUT,
  WEB3_MISSING,
  UNABLE_TO_LOAD_CONTRACT,
  WALLET_CONNECTION_APPOVAL_PENDING,
  WALLET_CONNECTION_APPOVAL_REQUIRED,
  ACCOUNT_NOT_WHITELISTED,
  TRANSACTION_APPROVAL_PENDING,
  TRANSACTION_APPROVAL_REQUIRED,
  TRANSACTION_SUBMITTED,
  //TRANSACTION_ERROR,
  CELL_ALREADY_DESIRED_COLOR,
} from 'components/PopupMessage';
import {
  getWeb3,
  hasWeb3,
  getViewOnlyWeb3
} from 'utils/getWeb3';
import isMobileOrTablet from 'utils/isMobileOrTablet';
import { drawCells } from 'utils/PixieCanvasUtils';
import {
  LOADING,
  LOADED,
  ERRORED,
} from 'constants/LoadingStatuses';
import {
  NUMBER_COLUMNS,
  PALETTE_COLORS,
} from 'constants/PixieConstants';

import './Pixie.scss';

const cssHexToInt = cssHex => parseInt(cssHex.replace("#",""), 16);

const intToCSSHex = int => "#" + int.toString(16).padStart(6, "0").toUpperCase();

/**
 * Returns an array of arrays of CSS hex strings that represent the grid of colors to draw on the board.
 * @param {Array} colors - Array of BigNumbers that represent colors
 */
const colorArrayToRows = colors => {
  const rows = [];
  for(let a = 0; a < colors.length; a++) {
    if(a % NUMBER_COLUMNS === 0) {
      rows.push([]);
    }
    const color = intToCSSHex(colors[a].toNumber());
    rows[rows.length - 1].push(color);
  }
  return rows;
};

const resetCanvasAndDrawRows = (canvas, rows, scaleFactor = 1) => {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if(rows && rows.length > 0) {
    canvas.width = rows[0].length * scaleFactor;
    canvas.height = rows.length * scaleFactor;
    drawCells(canvas, rows, scaleFactor);
  }
};

const updateFavicon = rows => {
  const canvas = document.createElement('canvas');
  resetCanvasAndDrawRows(canvas, rows);
  const favicon = document.getElementById('favicon');
  favicon.href = canvas.toDataURL('image/png');
};

class Pixie extends React.Component {

  constructor(props) {
    super(props);
    this.viewOnlyPixieContract = null;
    this.writtablePixieContract = null;
    this.writtableWeb3 = null;
    this.showTransactionApprovalMessages = !isMobileOrTablet();
    this.showTransactionSubmittedMessages = true;

    // On mobile Metamask the receipt event does not fire and the promise does not resolve when calling setColor,
    // which means clearPendingCell is never called and the "..." would stay in the cell forever without a workaround.
    // When the transactionhash event fires, we store the hash in this look up and then when the ColorSetEvent fires
    // on the viewOnlyPixieContract, we check if it's for the transaction in question and call clearPendingCell.
    this.pendingTransactions = {};

    this.state = {
      loadingStatus: LOADING,
      editing: false,
      rows: [[]], // Array of array of hex colors prefixed with #
      selectedColorIndex: 0,
      pendingCells: {}, // Keys are <row number>,<column number> (e.g. 3,2). Value is the promise that is pending. If the key is missing, that cell is not pending
      currentMessage: null,
      mostRecentTransactionHash: null,
    };
  }

  async componentDidMount() {
    try {
      const viewOnlyWeb3 = await getViewOnlyWeb3();
      this.viewOnlyPixieContract = await this.initializeContract(viewOnlyWeb3);
    } catch (e) {
      console.error(e);
      this.setState({
        loadingStatus: ERRORED,
      });
      return;
    }

    this.viewOnlyPixieContract.ColorSetEvent().on('data', event => {
      const row = event.args.row.toNumber();
      const column = event.args.column.toNumber();
      const color = intToCSSHex(event.args.color.toNumber());
      this.setCellColor(row, column, color);

      // If the transaction that triggered this event was one of our pending ones, clear it from pending.
      if(event.transactionHash === this.pendingTransactions[row + "," + column]) {
        this.clearPendingCell(row, column);
      }
    });

    await this.loadColors();

    this.setState({
      loadingStatus: LOADED,
      contractAddress: this.viewOnlyPixieContract.address,
    });
  }

  componentDidUpdate(prevProps, prevState) {
    const {
      rows,
    } = this.state;

    const canvas = document.getElementById('canvas');
    if(canvas) {
      resetCanvasAndDrawRows(canvas, rows, 5);
    }

    const aboutCanvas = document.getElementById('about-canvas');
    if(aboutCanvas) {
      resetCanvasAndDrawRows(aboutCanvas, rows, 5)
    }

    updateFavicon(rows);

    // If we just opened the editor, scroll to it
    if(this.state.editing && !prevState.editing) {
      document.getElementsByClassName("editor")[0].scrollIntoView({ behavior: "smooth" });
    }
  }

  getWrittablePixieContract = async () => {
    if(this.writtablePixieContract) {
      return this.writtablePixieContract;
    }
    
    if(!hasWeb3()) {
      this.showMessage({ type: WEB3_MISSING });
      return;
    }

    // If the user has already given Pixie permission to access the user's Ethereum address, the getWeb3 promise
    // will resolve without action from the user, so to avoid very briefly flashing the WALLET_CONNECTION_APPOVAL_PENDING
    // message while that promise resolves, we show that message on a delay. If the promise resolved before the delay
    // is up, we show the user the message letting them know they need to approve the connection to their wallet.
    let needsToShowWalletConnectionApprovalMessage = true;
    try {
      setTimeout(() => {
        if(needsToShowWalletConnectionApprovalMessage) {
          this.showMessage({ type: WALLET_CONNECTION_APPOVAL_PENDING });
        }
      }, 500);

      this.writtableWeb3 = await getWeb3();
      needsToShowWalletConnectionApprovalMessage = false;
      this.hideCurrentMessage();
    } catch (error) {
      if(error && error.code === 4001) {
        this.showMessage({ type: WALLET_CONNECTION_APPOVAL_REQUIRED });
        return;
      } else {
        console.error(error);
        return;
      }
    }

    try {
      this.writtablePixieContract = await this.initializeContract(this.writtableWeb3);
      return this.writtablePixieContract;
    } catch(error) {
      console.error(error);
      this.showMessage({ type: UNABLE_TO_LOAD_CONTRACT });
      return;
    }
  };

  initializeContract = async web3 => {
    const TruffleContract = require("@truffle/contract");
    const pixieTruffleContract = TruffleContract(PixieAbi);
    pixieTruffleContract.setProvider(web3.currentProvider);
    const pixieContract = await pixieTruffleContract.deployed();
    return pixieContract;
  };

  loadColors = async () => {
    const colors = await this.viewOnlyPixieContract.getAllColors();
    const rows = colorArrayToRows(colors);
    this.setState({
      rows,
    });
  };

  paintCell = async (row, column, color) => {
    this.lastcolor = color;

    if(this.state.rows[row][column] === color) {
      this.showMessage({
        type: CELL_ALREADY_DESIRED_COLOR,
        data: {
          color: color
        }
      });
      return;
    }

    let contract = await this.getWrittablePixieContract();
    if(!contract) {
      return;
    }

    const accounts = await this.writtableWeb3.eth.getAccounts();

    const newColor = cssHexToInt(color);
    const setColorPromise = contract.setColor(row, column, newColor, {
      from: accounts[0]
    });
    setColorPromise.on('transactionHash', hash => {
      this.pendingTransactions[row + "," + column] = hash;

      if(this.showTransactionSubmittedMessages) {
        this.showMessage({
          type: TRANSACTION_SUBMITTED,
          data: {
            hash: hash
          }
        });
      } else {
        this.hideCurrentMessage(); // If we're not showing the transaction submitted message we need to at least hide the "awaiting approval" message
      }
    });
    setColorPromise.on('receipt', receipt => {
      this.setCellColor(row, column, color);
      this.clearPendingCell(row, column);
    });
    setColorPromise.on('error', error => {
      this.clearPendingCell(row, column);
      // Brave populates the error arg with the stack trace rather than an error object, so if error.code is missing we make the assumption
      // that the user rejected the request. For other wallets we can check error.code === 4001 specifically.
      if((typeof error.code === "undefined" || error.code === 4001) && this.showTransactionApprovalMessages) {
        this.showMessage({ type: TRANSACTION_APPROVAL_REQUIRED });
      } else {
        console.error(error);
        //this.showMessage({ type: TRANSACTION_ERROR });
      }
    });

    this.setPendingCell(row, column, color);

    // Status has an unusual behavior where it resets the scroll position of the board to 0,0 when the confirmation window is opened.
    // To work around this we store the board's scroll position for recall later. There is no event when the confirmation window is
    // closed, so we instead reset the board's scroll position continuously until the user interacts with Pixie again (onTouchStart on
    // the top-level div in render).
    if(window.ethereum && window.ethereum.isStatus) {
      this.storeBoardPosition();
      this.boardScrollResetInterval = setInterval(this.resetBoardScrollPosition, 100);
    }

    // Use a one second timeout before attempting to resolve the setColorPromise so the user can see the pixel they selected flash
    // before the confirmation window pops up.
    setTimeout(async () => {
      if(this.showTransactionApprovalMessages) {
        this.showMessage({ type: TRANSACTION_APPROVAL_PENDING });
      }
      try {
        await setColorPromise;
      } catch (error) {
        // Prevent an uncaught promise rejection error in Brave with an empty catch statement.
        // The setColorPromise.on('error') handler will take care of the actual error handling.
      }
    }, 1000);
  };

  /**
   * Updates the.state.rows with a copy of its current value but with the value at [row][column] set to color.
   */
  setCellColor = (row, column, color) => {
    const newRows = [ ...this.state.rows ];
    newRows[row][column] = color;
    this.setState({
      rows: newRows,
    });
  };

  /**
   * Updates (row,columns)'s value in this.state.pendingCells to be color
   */
  setPendingCell = (row, column, color) => {
    let pendingCells = { ...this.state.pendingCells };
    pendingCells[row + "," + column] = color;
    this.setState({
      pendingCells,
    });
  };

  /**
   * Clears (row,columns)'s from this.state.pendingCells. If promise is provided, only clear the entry if the promise matches the entry's value.
   */
  clearPendingCell = (row, column, promise) => {
    if(!promise || this.state.pendingCells[row + "," + column] === promise) {
      const pendingCells = { ...this.state.pendingCells };
      delete pendingCells[row + "," + column];
      this.setState({
        pendingCells,
      });
    }
  };

  selectColorByIndex = index => {
    this.setState({
      selectedColorIndex: index,
    });
  };

  openEditor = async () => {
    if(!hasWeb3()) {
      this.showMessage({ type: WEB3_MISSING });
      return;
    }

    let contract = await this.getWrittablePixieContract();
    if(!contract) {
      return;
    }

    const requiresAccessChecks = await contract.requiresAccessChecks();
    if(requiresAccessChecks) {
      const accounts = await this.writtableWeb3.eth.getAccounts();
      const hasAccess = await contract.hasAccess(accounts[0]);
      if(!hasAccess) {
        this.showMessage({
          type: ACCOUNT_NOT_WHITELISTED,
          data: {
            web3: this.writtableWeb3,
            address: accounts[0]
          }
        });
        return;
      }
    }

    this.setState({
      editing: true,
    });
  };

  closeEditor = () => {
    this.setState({
      editing: false,
    });
  };

  showMessage = message => {
    this.setState({ 
      currentMessage: message
    });

    // Don't allow the page to be scrolled while the popup is open. It will handle scrolling its own content, and we don't want two scroll bars.
    document.getElementsByTagName("html")[0].style = "overflow:hidden";
  };

  hideCurrentMessage = options => {
    if(options && "hideConfirmationMessages" in options) {
      this.showTransactionSubmittedMessages = !options.hideConfirmationMessages;
    }

    this.setState({
      currentMessage: null
    });
    document.getElementsByTagName("html")[0].style = "overflow:auto";
  };

  storeBoardPosition = () => {
    const boardContent = document.querySelector(".CanvasBoard .board-content");
    if(boardContent) {
      this.previousBoardScrollLeft = boardContent.scrollLeft;
      this.previousBoardScrollTop = boardContent.scrollTop;
    }
  };

  resetBoardScrollPosition = () => {
    const boardContent = document.querySelector(".CanvasBoard .board-content");
    if(boardContent) {
      boardContent.scrollLeft = this.previousBoardScrollLeft;
      boardContent.scrollTop = this.previousBoardScrollTop;
    }
  };

  render() {
    const {
      loadingStatus,
      rows,
      pendingCells,
      selectedColorIndex,
      currentMessage,
    } = this.state;

    return (
      <div className="Pixie" onTouchStart={() => clearInterval(this.boardScrollResetInterval)}>
        <header>
          <h1>P I X I E</h1>
          <h2>Collaborative pixel art on Ethereum</h2>
          <p>By <a href="https://sylphdapps.com">Sylph Dapps</a></p>
        </header>
        <div className="content">
          { loadingStatus === LOADING &&
            <div className="distractor">Loading...</div>
          }
          { loadingStatus === ERRORED  &&
            <div>Unabled to load Pixie :(</div>
          }
          { loadingStatus === LOADED  &&
            <React.Fragment>
              { !this.state.editing &&
                <div className="viewer">
                  <canvas id="canvas" onClick={this.openEditor}/>
                  <button onClick={this.openEditor}>Paint!</button>
                  <div>
                    <button className="link-button"
                      onClick={() => this.showMessage({ type: ABOUT })}>What is this?</button>
                  </div>
                </div>
              }
              { this.state.editing &&
                <div className="editor">
                  <CanvasBoard rows={rows}
                    pendingCells={pendingCells}
                    onCellClick={(row, column) => setTimeout(() => this.paintCell(row, column, PALETTE_COLORS[selectedColorIndex]), 1)} />
                  <Palette colors={PALETTE_COLORS}
                    selectedColorIndex={selectedColorIndex}
                    onPaletteItemClick={(index) => this.selectColorByIndex(index)}/>
                  <button className="done-button" onClick={this.closeEditor}>Done painting</button>
                  <div>
                    <button className="link-button"
                      onClick={() => this.showMessage({ type: ABOUT })}>What is this?</button>
                  </div>
                </div>
              }
            </React.Fragment>
          }
        </div>
        { currentMessage &&
          <PopupMessage message={currentMessage}
            contractAddress={this.state.contractAddress}
            onClose={this.hideCurrentMessage} />
        }
      </div>
    );
  }

}

export default Pixie;
