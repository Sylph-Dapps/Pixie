import React from 'react';
import PixieAbi from 'abis/Pixie.json'
import getWeb3, { getViewOnlyWeb3 } from 'utils/getWeb3'

import './Pixie.scss';

const NUMBER_COLUMNS = 16;

const palette = [
  '#7C7C7C','#0000FC','#0000BC','#4428BC','#940084','#A80020','#A81000','#881400','#503000','#007800','#006800','#005800','#004058','#000000','#BCBCBC','#0078F8','#0058F8','#6844FC','#D800CC','#E40058','#F83800','#E45C10','#AC7C00','#00B800','#00A800','#00A844','#008888','#000000','#F8F8F8','#3CBCFC','#6888FC','#9878F8','#F878F8','#F85898','#F87858','#FCA044','#F8B800','#B8F818','#58D854','#58F898','#00E8D8','#787878','#FCFCFC','#A4E4FC','#B8B8F8','#D8B8F8','#F8B8F8','#F8A4C0','#F0D0B0','#FCE0A8','#F8D878','#D8F878','#B8F8B8','#B8F8D8','#00FCFC','#BCBCBC'
];

const cssHexToInt = cssHex => parseInt(cssHex.replace("#",""), 16);

const intToCSSHex = int => "#" + int.toString(16).padStart(6, "0");

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
    };
  }

  async componentDidMount() {
    const viewOnlyWeb3 = await getViewOnlyWeb3();
    this.viewOnlyPixieContract = await this.initializeContract(viewOnlyWeb3);

    this.viewOnlyPixieContract.ColorSetEvent().on('data', (error, response) => {
      this.loadColors();
    })

    this.loadColors();
  }

  connectWrittableWeb3 = async () => {
    try {
      const web3 = await getWeb3();
      if(window.ethereum && window.ethereum.on) {
        window.ethereum.on('accountsChanged', accounts => {
          this.address = accounts[0];
        });
      }

      const accounts = await web3.eth.getAccounts();
      this.address = accounts[0];

      this.writtablePixieContract = await this.initializeContract(web3);

    } catch (error) {
      if(error.code === 4001) {
        console.log("In order to draw, allow your wallet to connect to Pixie");
      } else {
        alert("Failed to load web3 or accounts. Check console for details.");
        console.log(error);
      }
    }
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

    const rows = [[]];
    for(let a = 0; a < colors.length; a++) {
      const color = intToCSSHex(colors[a].toNumber());
      rows[rows.length - 1].push(color);

      // If we're at the end of any row except for the last one, add a new row
      if(rows[rows.length - 1].length === NUMBER_COLUMNS && a !== colors.length - 1) {
        rows.push([]);
      }
    }
    
    this.setState({
      rows,
      loading: false,
    });
  };

  selectColorByIndex = index => {
    this.setState({
      selectedColorIndex: index,
    });
  };

  paintCell = async (row, column, color) => {
    if(!this.writtablePixieContract) {
      await this.connectWrittableWeb3();
      if(!this.writtablePixieContract) {
        return;
      }
    }

    let pendingCells = { ...this.state.pendingCells };
    pendingCells[row + "," + column] = true;
    this.setState({
      pendingCells,
    });

    const newColor = cssHexToInt(color);
    const setColorPromise = this.writtablePixieContract.setColor(row, column, newColor, {
      from: this.address
    });
    setColorPromise.on('transactionHash', hash => {
      console.log('transactionHash')
      console.log(hash);
    });
    setColorPromise.on('receipt', receipt => {
      console.log("receipt")
      console.log(receipt);
    })
    setColorPromise.on('error', error => {
      this.clearPendingCell(row, column);
      if(error.code === 4001) {
        alert("HEY!");
      }
      console.log("error")
      console.log(error);
    });
    setColorPromise.on('confirmation', (num, receipt) => {
      console.log('confirmation');
      console.log(num, receipt);
    });
    await setColorPromise;
    
    await this.loadColors();

    await this.clearPendingCell(row, column);
  }

  clearPendingCell = (row, column) => {
    const pendingCells = { ...this.state.pendingCells };
    delete pendingCells[row + "," + column] ;
    this.setState({
      pendingCells,
    });
  };

  render() {
    const {
      rows,
      loading,
      selectedColorIndex,
    } = this.state;

    return (
      <div className="Pixie">
        <header>
          <h1>P I X I E</h1>
          <h2>Collaborative pixel art on Ethereum</h2>
          <p>By <a href="https://michaelvandaniker.com">Michael VanDaniker</a></p>
        </header>
        <div className="content">
          { loading && <div className="distractor">Loading...</div> }
          { !loading &&
            <React.Fragment>
              <div className="board">
                { rows.map( (row, i) => {
                    return (
                      <div className="row" key={i}>
                        { row.map( (cellColor, j) => {
                          const style = {
                            backgroundColor: cellColor,
                            color: cellColor === "#000000" ? "white" : "black",
                            position: 'absolute',
                            left: (25 * j) + 'px',
                            top: '0px',
                          };
                          const content = this.state.pendingCells[i + "," + j] ? "..." : "";
                          return (
                            <div className="cell"
                              key={j}
                              onClick={() => this.paintCell(i, j, palette[selectedColorIndex])}
                              style={style}>{content}</div>
                          );
                        }) }
                      </div>
                    )
                  }
                )}
              </div>
              <div className="box palette-box">
                <div className="palette">
                  { palette.map( (paletteColor, i) => {
                    const style = {
                      backgroundColor: paletteColor,
                      border: "1px solid black",
                    };
                    if(i === this.state.selectedColorIndex) {
                      style.border = "3px solid red";
                    }
                    return (
                      <div className="palette-item-container" key={i}>
                        <div className="palette-item"
                          style={style}
                          onClick={() => this.selectColorByIndex(i)}
                        ></div>
                      </div>
                    );
                  }) }
                </div>
              </div>
            </React.Fragment>
          }
        </div>
      </div>
    );
  }

}

export default App;
