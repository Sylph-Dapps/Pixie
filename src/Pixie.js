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

const Warnings = {
  WEB3_MISSING: "WEB3_MISSING",
  WALLET_CONNECTION_APPOVAL_PENDING: "WALLET_CONNECTION_APPOVAL_PENDING",
  WALLET_CONNECTION_APPOVAL_REQUIRED: "WALLET_CONNECTION_APPOVAL_REQUIRED",
  TRANSACTION_APPROVAL_PENDING: "TRANSACTION_APPROVAL_PENDING",
  TRANSACTION_APPROVAL_REQUIRED: "TRANSACTION_APPROVAL_REQUIRED",
  TRANSACTION_SUBMITTED: "TRANSACTION_SUBMITTED",
  TRANSACTION_ERROR: "TRANSACTION_ERROR",
};

const CONTRACT_ADDRESS = "0x93f9ABAfbCa869632Ef03F72A53734E41Ff0b8F6"; // Ropsten

const ETHERSCAN_HOSTNAME = "ropsten.etherscan.io";

const NUMBER_COLUMNS = 16;

const PALETTE_COLORS = [
  '#7C7C7C','#0000FC','#0000BC','#4428BC','#940084','#A80020','#A81000','#881400','#503000','#007800','#006800','#005800','#004058','#000000','#BCBCBC','#0078F8','#0058F8','#6844FC','#D800CC','#E40058','#F83800','#E45C10','#AC7C00','#00B800','#00A800','#00A844','#008888','#000000','#F8F8F8','#3CBCFC','#6888FC','#9878F8','#F878F8','#F85898','#F87858','#FCA044','#F8B800','#B8F818','#58D854','#58F898','#00E8D8','#787878','#FCFCFC','#A4E4FC','#B8B8F8','#D8B8F8','#F8B8F8','#F8A4C0','#F0D0B0','#FCE0A8','#F8D878','#D8F878','#B8F8B8','#B8F8D8','#00FCFC','#BCBCBC'
];

const cssHexToInt = cssHex => parseInt(cssHex.replace("#",""), 16);

const intToCSSHex = int => "#" + int.toString(16).padStart(6, "0");

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
  const favicon = document.getElementById('favicon');

  const faviconSize = NUMBER_COLUMNS;

  const canvas = document.createElement('canvas');
  canvas.width = faviconSize;
  canvas.height = faviconSize;

  const ctx = canvas.getContext('2d');

  for(let a = 0; a < rows.length; a++) {
    for(let b = 0; b < rows[a].length; b++) {
      ctx.fillStyle = rows[a][b];
      ctx.fillRect(b, a, 1, 1);
    }
  }

  favicon.href = canvas.toDataURL('image/png');
};

class App extends React.Component {

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
      rows: [[]], // Array of array of hex colors prefixed with #
      selectedColorIndex: 0,
      pendingCells: {}, // Keys are <row number>,<column number> (e.g. 3,2). Value is the promise that is pending. If the key is missing, that cell is not pending
      currentWarning: null,
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
      this.showWarning(Warnings.WEB3_MISSING);
      return;
    }

    try {
      this.showWarning(Warnings.WALLET_CONNECTION_APPOVAL_PENDING);
      this.writtableWeb3 = await getWeb3();
      this.hideCurrentWarning();
    } catch (error) {
      if(error && error.code === 4001) {
        this.showWarning(Warnings.WALLET_CONNECTION_APPOVAL_REQUIRED);
        return;
      } else {
        console.error(error);
        return;
      }
    }

    this.writtablePixieContract = await this.initializeContract(this.writtableWeb3);
    return this.writtablePixieContract;
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

  selectColorByIndex = index => {
    this.setState({
      selectedColorIndex: index,
    });
  };

  paintCell = async (row, column, color) => {
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
      this.setState({
        mostRecentTransactionHash: hash,
      }, () => {
        this.showWarning(Warnings.TRANSACTION_SUBMITTED)
      });
    });
    setColorPromise.on('receipt', receipt => {
      this.setCellColor(row, column, color);
      this.clearPendingCell(row, column, setColorPromise);
    });
    setColorPromise.on('error', error => {
      this.clearPendingCell(row, column, setColorPromise);
      if(error.code === 4001 && this.showTransactionApprovalPopups) {
        this.showWarning(Warnings.TRANSACTION_APPROVAL_REQUIRED);
      } else {
        console.error(error);
        this.showWarning(Warnings.TRANSACTION_ERROR);
      }
    });

    this.setPendingCell(row, column, setColorPromise);

    if(this.showTransactionApprovalPopups) {
      this.showWarning(Warnings.TRANSACTION_APPROVAL_PENDING);
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

  showWarning = warning => {
    this.setState({ 
      currentWarning: warning
    });

    // Don't allow the page to be scrolled while the popup is open. It will handle scrolling its own content, and we don't want two scroll bars.
    document.getElementsByTagName("html")[0].style = "overflow:hidden";
  }

  hideCurrentWarning = () => {
    this.setState({ 
      currentWarning: null
    });
    document.getElementsByTagName("html")[0].style = "overflow:auto";
  }

  renderWarning = currentWarning => {
    let transactionUrl = null;
    if(currentWarning === Warnings.TRANSACTION_SUBMITTED) {
      transactionUrl = `https://${ETHERSCAN_HOSTNAME}/tx/${this.state.mostRecentTransactionHash}`;
    }

    return (
      <React.Fragment>
        { currentWarning === Warnings.WEB3_MISSING &&
          <Popup title="Hold up"
            onClose={this.hideCurrentWarning}>
            <p>To paint on Pixie, you need to use a Ethereum-enabled browser.</p>
            <p>
              On desktop you can use <a href="https://www.brave.com/" target="_blank" rel="noopener noreferrer">Brave</a> or <a href="https://www.opera.com/" target="_blank" rel="noopener noreferrer">Opera</a>, or if you want to use Chrome, you can install the <a href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" target="_blank" rel="noopener noreferrer">Metamask</a> plugin to turn Chrome into an Ethereum-enabled browser.
            </p>
            <p>
              Mobile options include <a href="https://status.im/get/" target="_blank" rel="noopener noreferrer">Status</a> and <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer">Metamask</a>, <a href="https://wallet.coinbase.com/" target="_blank" rel="noopener noreferrer">Coinbase Wallet</a> and the mobile version of <a href="https://www.opera.com/" target="_blank" rel="noopener noreferrer">Opera</a>.
            </p>
          </Popup>
        }
        { currentWarning === Warnings.WALLET_CONNECTION_APPOVAL_PENDING &&
          <Popup title="Please let Pixie view your Ethereum account's address"
            onClose={this.hideCurrentWarning}>
            <p>Pixie has submitted a request to view your Ethereum account's address. In order to paint a pixel, you must approve the request.</p>
            { !isMobileOrTablet() &&
              <p>If you do not see the request, click your wallet's icon next to your address bar.</p>
            }
          </Popup>
        }
        { currentWarning === Warnings.WALLET_CONNECTION_APPOVAL_REQUIRED &&
          <Popup title="Hold up"
            onClose={this.hideCurrentWarning}>
            <p>In order to paint a pixel, Pixie needs to know your Ethereum address. Please click on the pixel you'd like to paint again and allow the connection.</p>
          </Popup>
        }
        { currentWarning === Warnings.TRANSACTION_APPROVAL_PENDING &&
          <Popup title="Awaiting your approval"
            onClose={this.hideCurrentWarning}>
            <p>Pixie has put together a transaction request that, when submitted, will store your pixel's new color to the Ethereum blockchain. Once you approve the request, your pixel is as good as painted!</p>
            { !isMobileOrTablet() &&
              <p>If you don't see the request, click on your wallet's logo next to your address bar.</p>
            }
          </Popup>
        }
        { currentWarning === Warnings.TRANSACTION_APPROVAL_REQUIRED &&
          <Popup title="Hold up"
            onClose={this.hideCurrentWarning}>
            <p>In order to paint that pixel, you must approve the transaction request. If you rejected the request by accident, you can click on the pixel you want to paint again.</p>
          </Popup>
        }
        { currentWarning === Warnings.TRANSACTION_SUBMITTED &&
          <Popup title="Hooray!"
            onClose={this.hideCurrentWarning}>
            <p>Your transaction has been submitted to the Ethereum network! Once it's mined, your pixel will be recolored for all the world to see!</p>
            <p>The amount of time it takes for a transaction to be mined varies based on the amount of other activity currently happening on the Ethereum network. You can view the status of your transaction on <a href={transactionUrl} target="_blank" rel="noopener noreferrer">Etherscan</a>.</p>
            <p>Feel free to paint some other pixels while you wait :)</p>
          </Popup>
        }
        { currentWarning === Warnings.TRANSACTION_ERROR &&
          <Popup title=":("
            onClose={this.hideCurrentWarning}>
            <p>There was a problem processing your transaction.</p>
          </Popup>
        }
      </React.Fragment>
    );
  }

  render() {
    const {
      loadingStatus,
      rows,
      pendingCells,
      selectedColorIndex,
      currentWarning,
    } = this.state;

    const contractUrl = `https://${ETHERSCAN_HOSTNAME}/address/${CONTRACT_ADDRESS}`;

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
              <Board rows={rows}
                pendingCells={pendingCells}
                onCellClick={(row, column) => this.paintCell(row, column, PALETTE_COLORS[selectedColorIndex])}/>
              <Palette colors={PALETTE_COLORS}
                selectedColorIndex={selectedColorIndex}
                onPaletteItemClick={(index) => this.selectColorByIndex(index)}/>
              <p><a href={contractUrl} target="_blank" rel="noopener noreferrer">View contract on Etherscan</a></p>
            </React.Fragment>
          }
        </div>
        { currentWarning && this.renderWarning(currentWarning) }
      </div>
    );
  }

}

export default App;
