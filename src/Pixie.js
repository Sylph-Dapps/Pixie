import React from 'react';
import PixieAbi from 'abis/Pixie.json';
import {
  getWeb3,
  hasWeb3,
  getViewOnlyWeb3
} from 'utils/getWeb3';
import Board from 'components/Board';
import Palette from 'components/Palette';
import Popup from 'components/Popup';

import './Pixie.scss';

const Warnings = {
  WEB3_MISSING: "WEB3_MISSING",
  WALLET_CONNECTION_APPOVAL_PENDING: "WALLET_CONNECTION_APPOVAL_PENDING",
  WALLET_CONNECTION_APPOVAL_REQUIRED: "WALLET_CONNECTION_APPOVAL_REQUIRED",
  TRANSACTION_APPROVAL_PENDING: "TRANSACTION_APPROVAL_PENDING",
  TRANSACTION_APPROVAL_REQUIRED: "TRANSACTION_APPROVAL_REQUIRED",
  TRANSACTION_SUBMITTED: "TRANSACTION_SUBMITTED",
};

const NUMBER_COLUMNS = 16;

const palette = [
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

let writtableWeb3;

class App extends React.Component {

  constructor(props) {
    super(props);
    this.viewOnlyPixieContract = null;
    this.writtablePixieContract = null;
    this.state = {
      loading: true,
      rows: [[]], // Array of array of hex colors prefixed with #
      selectedColorIndex: 0,
      pendingCells: {}, // Keys are <row number>,<column number> (e.g. 3,2). Value is always true. If the key is missing, that cell is not pending
      currentWarning: null,
    };
  }

  async componentDidMount() {
    const viewOnlyWeb3 = await getViewOnlyWeb3();
    this.viewOnlyPixieContract = await this.initializeContract(viewOnlyWeb3);

    this.viewOnlyPixieContract.ColorSetEvent().on('data', event => {
      const row = event.args.row.toNumber();
      const column = event.args.column.toNumber();
      const color = intToCSSHex(event.args.color.toNumber());
      this.setCellColor(row, column, color);
    })

    await this.loadColors();
    this.setState({
      loading: false,
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
      writtableWeb3 = await getWeb3();
      this.hideCurrentWarning();
    } catch (error) {
      if(error && error.code === 4001) {
        this.showWarning(Warnings.WALLET_CONNECTION_APPOVAL_REQUIRED);
        return;
      } else {
        alert("Failed to load web3 or accounts. Check console for details.");
        console.log(error);
        return;
      }
    }

    this.writtablePixieContract = await this.initializeContract(writtableWeb3);
    return this.writtablePixieContract;
  };

  initializeContract = async web3 => {
    const TruffleContract = require("@truffle/contract");
    const pixieTruffleContract = TruffleContract(PixieAbi);
    pixieTruffleContract.setProvider(web3.currentProvider);
    const pixieContract = await pixieTruffleContract.at("0x93f9ABAfbCa869632Ef03F72A53734E41Ff0b8F6"); // Ropsten
    return pixieContract;
  };

  loadColors = async () => {
    const colors = await this.viewOnlyPixieContract.getAllColors();
    const rows = colorArrayToRows(colors);
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

    this.setPendingCell(row, column);

    const accounts = await writtableWeb3.eth.getAccounts();

    const newColor = cssHexToInt(color);
    const setColorPromise = contract.setColor(row, column, newColor, {
      from: accounts[0]
    });
    setColorPromise.on('transactionHash', hash => {
      this.mostRecentTransactionHash = hash;
      this.showWarning(Warnings.TRANSACTION_SUBMITTED);
    });
    setColorPromise.on('receipt', receipt => {
      console.log("receipt")
      this.setCellColor(row, column, color);
      this.clearPendingCell(row, column);
    })
    setColorPromise.on('error', error => {
      this.clearPendingCell(row, column);
      if(error.code === 4001) {
        this.showWarning(Warnings.TRANSACTION_APPROVAL_REQUIRED);
      }
      console.log("error")
      console.log(error);
    });

    //this.showWarning(Warnings.TRANSACTION_APPROVAL_PENDING);
    await setColorPromise;

    console.log("promise resolved")
  }

  setCellColor = (row, column, color) => {
    const newRows = [ ...this.state.rows ];
    newRows[row][column] = color;
    this.setState({
      rows: newRows,
    });
  };

  setPendingCell = (row, column) => {
    let pendingCells = { ...this.state.pendingCells };
    pendingCells[row + "," + column] = true;
    this.setState({
      pendingCells,
    });
  };

  clearPendingCell = (row, column) => {
    const pendingCells = { ...this.state.pendingCells };
    delete pendingCells[row + "," + column];
    this.setState({
      pendingCells,
    });
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

  render() {
    const {
      rows,
      loading,
      pendingCells,
      selectedColorIndex,
      currentWarning,
    } = this.state;

    let etherscanURL = null;
    if(currentWarning === Warnings.TRANSACTION_SUBMITTED) {
      etherscanURL = `https://ropsten.etherscan.io/tx/${this.mostRecentTransactionHash}`;
    }

    return (
      <div className="Pixie">
        <header>
          <h1>P I X I E</h1>
          <h2>Collaborative pixel art on Ethereum</h2>
          <p>By <a href="https://michaelvandaniker.com">Michael VanDaniker</a></p>
        </header>
        <div className="content">
          { loading &&
            <div className="distractor">Loading...</div>
          }
          { !loading &&
            <React.Fragment>
              <Board rows={rows}
                pendingCells={pendingCells}
                onCellClick={(row, column) => this.paintCell(row, column, palette[selectedColorIndex])}/>
              <Palette colors={palette}
                selectedColorIndex={selectedColorIndex}
                onPaletteItemClick={(index) => this.selectColorByIndex(index)}/>
            </React.Fragment>
          }
        </div>
        { currentWarning &&
          <Popup title=""
            onClose={this.hideCurrentWarning}>
            { currentWarning === Warnings.WEB3_MISSING &&
              <div>
                <p>
                  To paint on Pixie, you need to use a Ethereum-enabled browser, like <a href="https://www.opera.com/" target="_blank" rel="noopener noreferrer">Opera</a>.
                  If you're using Chrome, you can install the <a href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" target="_blank" rel="noopener noreferrer">Metamask</a> plugin to turn Chrome into an Ethereum-enabled browser.
                </p>
                <p>
                  Mobile options include <a href="https://status.im/get/" target="_blank" rel="noopener noreferrer">Status</a>, <a href="https://wallet.coinbase.com/" target="_blank" rel="noopener noreferrer">Coinbase Wallet</a> and the mobile version of <a href="https://www.opera.com/" target="_blank" rel="noopener noreferrer">Opera</a>.
                </p>
              </div>
            }
            { currentWarning === Warnings.WALLET_CONNECTION_APPOVAL_PENDING &&
              <p>Pixie has submitted a connection request to your wallet. Please approve the request. If you're using Metamask and you don't see the request, click the Metamask button next to your address bar.</p>
            }
            { currentWarning === Warnings.WALLET_CONNECTION_APPOVAL_REQUIRED &&
              <p>In order to paint, you need to allow your wallet to connect to Pixie. Please try again and allow the connection.</p>
            }
            { currentWarning === Warnings.TRANSACTION_APPROVAL_PENDING &&
              <p>Please sign the transaction in your wallet. If you're using Metamask and you don't see the approval request, click the Metamask button next to your address bar.</p>
            }
            { currentWarning === Warnings.TRANSACTION_APPROVAL_REQUIRED &&
              <p>In order to paint, you must sign the transaction. If you rejected the signature request by accident, you can try again by clicking on the pixel you want to paint.</p>
            }
            { currentWarning === Warnings.TRANSACTION_SUBMITTED &&
              <div>
                <p>Your transaction has been submitted! Once it's mined, your pixel will be updated with the color you selected.</p>
                <p>You can view the status of your transaction on <a href={etherscanURL} target="_blank" rel="noopener noreferrer">Etherescan</a>.</p>
              </div>
            }
          </Popup>
        }
      </div>
    );
  }

}

export default App;
