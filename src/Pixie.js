import React from 'react';
import PixieAbi from 'abis/Pixie.json';
import {
  getWeb3,
  hasWeb3,
  getViewOnlyWeb3
} from 'utils/getWeb3';
import isMobileOrTablet from 'utils/isMobileOrTablet';
import Board from 'components/Board';
import Palette from 'components/Palette';
import Popup from 'components/Popup';

import './Pixie.scss';

const LoadingStatus = {
  LOADING: "LOADING",
  LOADED: "LOADED",
  ERRORED: "ERRORED",
}

const MessageTypes = {
  ABOUT: "ABOUT",
  WEB3_MISSING: "WEB3_MISSING",
  UNABLE_TO_LOAD_CONTRACT: "UNABLE_TO_LOAD_CONTRACT",
  WALLET_CONNECTION_APPOVAL_PENDING: "WALLET_CONNECTION_APPOVAL_PENDING",
  WALLET_CONNECTION_APPOVAL_REQUIRED: "WALLET_CONNECTION_APPOVAL_REQUIRED",
  TRANSACTION_APPROVAL_PENDING: "TRANSACTION_APPROVAL_PENDING",
  TRANSACTION_APPROVAL_REQUIRED: "TRANSACTION_APPROVAL_REQUIRED",
  TRANSACTION_SUBMITTED: "TRANSACTION_SUBMITTED",
  TRANSACTION_ERROR: "TRANSACTION_ERROR",
  CELL_ALREADY_DESIRED_COLOR: "CELL_ALREADY_DESIRED_COLOR",
};

const CONTRACT_ADDRESS = "0x93f9ABAfbCa869632Ef03F72A53734E41Ff0b8F6"; // Ropsten

const ETHERSCAN_HOSTNAME = "ropsten.etherscan.io";

const NUMBER_COLUMNS = 16;

const PALETTE_COLORS = [
  '#7C7C7C','#0000FC','#0000BC','#4428BC','#940084','#A80020','#A81000','#881400','#503000','#007800','#006800','#005800','#004058','#000000','#BCBCBC','#0078F8','#0058F8','#6844FC','#D800CC','#E40058','#F83800','#E45C10','#AC7C00','#00B800','#00A800','#00A844','#008888','#000000','#F8F8F8','#3CBCFC','#6888FC','#9878F8','#F878F8','#F85898','#F87858','#FCA044','#F8B800','#B8F818','#58D854','#58F898','#00E8D8','#787878','#FCFCFC','#A4E4FC','#B8B8F8','#D8B8F8','#F8B8F8','#F8A4C0','#F0D0B0','#FCE0A8','#F8D878','#D8F878','#B8F8B8','#B8F8D8','#00FCFC','#BCBCBC'
];

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

const updateFavicon = rows => {
  const canvas = document.createElement('canvas');
  drawRowsToCanvas(canvas, rows);
  const favicon = document.getElementById('favicon');
  favicon.href = canvas.toDataURL('image/png');
};

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

class Pixie extends React.Component {

  constructor(props) {
    super(props);
    this.viewOnlyPixieContract = null;
    this.writtablePixieContract = null;
    this.writtableWeb3 = null;
    this.showTransactionApprovalPopups = !isMobileOrTablet();

    // On mobile Metamask the receipt event does not fire and the promise does not resolve when calling setColor,
    // which means clearPendingCells is never called and the "..." would stay in the cell forever without a workaround.
    // When the transactionhash event fires, we store the hash in this look up and then when the ColorSetEvent fires
    // on the viewOnlyPixieContract, we check if it's for the transaction in question and call clearPendingCells.
    this.pendingTransactions = {};

    this.state = {
      loadingStatus: LoadingStatus.LOADING,
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
        loadingStatus: LoadingStatus.ERRORED,
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
      loadingStatus: LoadingStatus.LOADED,
    });
  }

  getWrittablePixieContract = async () => {
    if(this.writtablePixieContract) {
      return this.writtablePixieContract;
    }
    
    if(!hasWeb3()) {
      this.showMessage({ type: MessageTypes.WEB3_MISSING });
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
          this.showMessage({ type: MessageTypes.WALLET_CONNECTION_APPOVAL_PENDING });
        }
      }, 500);

      this.writtableWeb3 = await getWeb3();
      needsToShowWalletConnectionApprovalMessage = false;
      this.hideCurrentMessage();
    } catch (error) {
      if(error && error.code === 4001) {
        this.showMessage({ type: MessageTypes.WALLET_CONNECTION_APPOVAL_REQUIRED });
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
      this.showMessage({ type: MessageTypes.UNABLE_TO_LOAD_CONTRACT });
      return;
    }
  };

  initializeContract = async web3 => {
    const TruffleContract = require("@truffle/contract");
    const pixieTruffleContract = TruffleContract(PixieAbi);
    pixieTruffleContract.setProvider(web3.currentProvider);
    const pixieContract = await pixieTruffleContract.at(CONTRACT_ADDRESS);
    return pixieContract;
  };

  loadColors = async () => {
    const colors = await this.viewOnlyPixieContract.getAllColors();
    const rows = colorArrayToRows(colors);

    updateFavicon(rows);

    this.setState({
      rows,
    });
  };

  openEditor = () => {
    if(!hasWeb3()) {
      this.showMessage({ type: MessageTypes.WEB3_MISSING });
      return;
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

  selectColorByIndex = index => {
    this.setState({
      selectedColorIndex: index,
    });
  };

  paintCell = async (row, column, color) => {
    if(this.state.rows[row][column] === color) {
      this.showMessage({
        type: MessageTypes.CELL_ALREADY_DESIRED_COLOR,
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
      this.showMessage({
        type: MessageTypes.TRANSACTION_SUBMITTED,
        data: {
          hash: hash
        }
      });
    });
    setColorPromise.on('receipt', receipt => {
      this.setCellColor(row, column, color);
      this.clearPendingCell(row, column, setColorPromise);
    });
    setColorPromise.on('error', error => {
      this.clearPendingCell(row, column, setColorPromise);
      if(error.code === 4001 && this.showTransactionApprovalPopups) {
        this.showMessage({ type: MessageTypes.TRANSACTION_APPROVAL_REQUIRED });
      } else {
        console.error(error);
        //this.showMessage({ type: MessageTypes.TRANSACTION_ERROR });
      }
    });

    this.setPendingCell(row, column, setColorPromise);

    if(this.showTransactionApprovalPopups) {
      this.showMessage({ type: MessageTypes.TRANSACTION_APPROVAL_PENDING });
    }

    await setColorPromise;

    this.clearPendingCell(row, column, setColorPromise);
  }

  setCellColor = (row, column, color) => {
    const newRows = [ ...this.state.rows ];
    newRows[row][column] = color;
    this.setState({
      rows: newRows,
    }, () => {
      updateFavicon(this.state.rows);
    });
  };

  /**
   * Updates (row,columns)'s value in this.state.pendingCells to be promise
   */
  setPendingCell = (row, column, promise) => {
    let pendingCells = { ...this.state.pendingCells };
    pendingCells[row + "," + column] = promise;
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

  showMessage = message => {
    this.setState({ 
      currentMessage: message
    });

    // Don't allow the page to be scrolled while the popup is open. It will handle scrolling its own content, and we don't want two scroll bars.
    document.getElementsByTagName("html")[0].style = "overflow:hidden";
  };

  hideCurrentMessage = () => {
    this.setState({ 
      currentMessage: null
    });
    document.getElementsByTagName("html")[0].style = "overflow:auto";
  };

  renderBrowserRequirementsMessage = () => {
    return (
      <React.Fragment>
        <p>To contribute to Pixie, you need to use a Ethereum-enabled browser.</p>
        <p>
          On desktop you can use <a href="https://www.brave.com/" target="_blank" rel="noopener noreferrer">Brave</a> or <a href="https://www.opera.com/" target="_blank" rel="noopener noreferrer">Opera</a>. You can turn Chrome into an Ethereum-enabled browser by installing the <a href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" target="_blank" rel="noopener noreferrer">Metamask</a> plugin.
        </p>
        <p>
          Mobile options include <a href="https://status.im/get/" target="_blank" rel="noopener noreferrer">Status</a>, <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer">Metamask</a>, <a href="https://wallet.coinbase.com/" target="_blank" rel="noopener noreferrer">Coinbase Wallet</a> and the mobile version of <a href="https://www.opera.com/" target="_blank" rel="noopener noreferrer">Opera</a>.
        </p>
      </React.Fragment>
    )
  };

  renderWarning = message => {
    let transactionURL = null;
    if(message.type === MessageTypes.TRANSACTION_SUBMITTED) {
      transactionURL = `https://${ETHERSCAN_HOSTNAME}/tx/${message.data.hash}`;
    }

    const etherscanContractTransactionsURL = `https://${ETHERSCAN_HOSTNAME}/address/${CONTRACT_ADDRESS}`;

    return (
      <React.Fragment>
        { message.type === MessageTypes.ABOUT &&
          <Popup title="About Pixie"
            onClose={this.hideCurrentMessage}>
            <p>Pixie is a collaborative art project that anyone can contribute to!</p>
            <p>Everyone shares a single 16x16 grid and can paint its cells using the colors from the original NES color palette.</p>
            <p>It currently looks like this:</p>
            <p style={{textAlign: 'center'}}>
              <canvas id="about-canvas"/>
            </p>
            <p>
              The pixel data is stored on the Ethereum network. When you color a pixel, that action is encoded in a transaction and processed by the network.
            </p>
            <p>
              You can view the transactions that Pixie users have submitted on <a href={etherscanContractTransactionsURL} target="_blank" rel="noopener noreferrer">Etherscan</a>.
            </p>
            <h3>Browser requirements</h3>
            { this.renderBrowserRequirementsMessage() }
            <h3>Fees</h3>
            <p>
              When submitting a transaction to the Ethereum network, you include a small fee, known as gas, to compensate the owners of the computers that power the network. This fee is paid using a cryptocurrency called "Ether".
            </p>
            <p>
              Pixie is currently deployed to a test version of the Ethereum network where the Ether has no value, making Pixie free to use for the moment. Before contributing to Pixie, you will need to point your browser to the <b>Ropsten Test Network</b> and load your Ethereum account with some Ropsten Ether to cover the gas "costs". You can do this by pasting your account's address into <a href="https://faucet.ropsten.be/" target="_blank" rel="noopener noreferrer">this form</a>.
            </p>
          </Popup>
        }
        { message.type === MessageTypes.WEB3_MISSING &&
          <Popup title="Hold up"
            onClose={this.hideCurrentMessage}>
            { this.renderBrowserRequirementsMessage() }
          </Popup>
        }
        { message.type === MessageTypes.UNABLE_TO_LOAD_CONTRACT &&
          <Popup title=":("
            onClose={this.hideCurrentMessage}>
            <p>Pixie was unable to connect to its back-end on the "Ropsten" test version of the Ethereum network. Confirm that your browser is configured to use the Ropsten network and refresh the page and try again.</p>
          </Popup>
        }
        { message.type === MessageTypes.WALLET_CONNECTION_APPOVAL_PENDING &&
          <Popup title="Please let Pixie view your Ethereum account's address"
            onClose={this.hideCurrentMessage}>
            <p>Pixie has submitted a request to view your Ethereum account's address. In order to paint a pixel, you must approve the request.</p>
            { !isMobileOrTablet() &&
              <p>If you do not see the request, click your wallet's icon next to your address bar.</p>
            }
          </Popup>
        }
        { message.type === MessageTypes.WALLET_CONNECTION_APPOVAL_REQUIRED &&
          <Popup title="Hold up"
            onClose={this.hideCurrentMessage}>
            <p>In order to paint a pixel, Pixie needs to know your Ethereum address. Please click on the pixel you'd like to paint again and allow the connection.</p>
          </Popup>
        }
        { message.type === MessageTypes.TRANSACTION_APPROVAL_PENDING &&
          <Popup title="Awaiting your approval"
            onClose={this.hideCurrentMessage}>
            <p>Pixie has put together a transaction request that, when submitted, will store your pixel's new color to the Ethereum blockchain. Once you approve the request, your pixel is as good as painted!</p>
            { !isMobileOrTablet() &&
              <p>If you don't see the request, click on your wallet's logo next to your address bar.</p>
            }
          </Popup>
        }
        { message.type === MessageTypes.TRANSACTION_APPROVAL_REQUIRED &&
          <Popup title="Hold up"
            onClose={this.hideCurrentMessage}>
            <p>In order to paint that pixel, you must approve the transaction request. If you rejected the request by accident, you can click on the pixel you want to paint again.</p>
          </Popup>
        }
        { message.type === MessageTypes.TRANSACTION_SUBMITTED &&
          <Popup title="Hooray!"
            onClose={this.hideCurrentMessage}>
            <p>Your transaction has been submitted to the Ethereum network! Once it's mined, your pixel will be recolored for all the world to see!</p>
            <p>The amount of time it takes for a transaction to be mined varies based on the amount of other activity currently happening on the Ethereum network. You can view the status of your transaction on <a href={transactionURL} target="_blank" rel="noopener noreferrer">Etherscan</a>.</p>
            <p>Feel free to paint some other pixels while you wait :)</p>
          </Popup>
        }
        { message.type === MessageTypes.TRANSACTION_ERROR &&
          <Popup title=":("
            onClose={this.hideCurrentMessage}>
            <p>There was a problem processing your transaction.</p>
          </Popup>
        }
        { message.type === MessageTypes.CELL_ALREADY_DESIRED_COLOR &&
          <Popup title="Good news!"
            onClose={this.hideCurrentMessage}>
            <div className="cell-already-desired-color">
              <div className="text">That pixel is already</div>
              <div className="color-swatch" style={{
                backgroundColor: MessageTypes.data.color,
              }}/>
            </div>
          </Popup>
        }
      </React.Fragment>
    );
  }

  componentDidUpdate() {
    const {
      rows,
    } = this.state;

    const canvas = document.getElementById('canvas');
    if(canvas) {
      drawRowsToCanvas(canvas, rows, 10);
    }

    const aboutCanvas = document.getElementById('about-canvas');
    if(aboutCanvas) {
      drawRowsToCanvas(aboutCanvas, rows, 10);
    }
  }

  render() {
    const {
      loadingStatus,
      rows,
      pendingCells,
      selectedColorIndex,
      currentMessage,
    } = this.state;

    return (
      <div className="Pixie">
        <header>
          <h1>P I X I E</h1>
          <h2>Collaborative pixel art on Ethereum</h2>
          <p>By <a href="https://michaelvandaniker.com">Michael VanDaniker</a></p>
        </header>
        <div className="content">
          { loadingStatus === LoadingStatus.LOADING &&
            <div className="distractor">Loading...</div>
          }
          { loadingStatus === LoadingStatus.ERRORED  &&
            <div>Unabled to load Pixie :(</div>
          }
          { loadingStatus === LoadingStatus.LOADED  &&
            <React.Fragment>
              { !this.state.editing &&
                <div className="viewer">
                  <canvas id="canvas" onClick={this.openEditor}/>
                  <button onClick={this.openEditor}>Paint!</button>
                  <div>
                    <button className="link-button"
                      onClick={() => this.showMessage({ type: MessageTypes.ABOUT })}>What is this?</button>
                  </div>
                </div>
              }
              { this.state.editing &&
                <div className="editor">
                  <Board rows={rows}
                    pendingCells={pendingCells}
                    onCellClick={(row, column) => this.paintCell(row, column, PALETTE_COLORS[selectedColorIndex])} />
                  <Palette colors={PALETTE_COLORS}
                    selectedColorIndex={selectedColorIndex}
                    onPaletteItemClick={(index) => this.selectColorByIndex(index)}/>
                  <button onClick={this.closeEditor}>Done painting</button>
                  <div>
                    <button className="link-button"
                      onClick={() => this.showMessage({ type: MessageTypes.ABOUT })}>What is this?</button>
                  </div>
                </div>
              }
            </React.Fragment>
          }
        </div>
        { currentMessage && this.renderWarning(currentMessage) }
      </div>
    );
  }

}

export default Pixie;
