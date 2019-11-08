import React from 'react';
import PixieAbi from 'abis/Pixie.json'
import getWeb3 from 'utils/getWeb3'

import './Pixie.scss';

let web3;

const NUMBER_COLUMNS = 16;

const palette = [
  "#000000","#fcfcfc","#f8f8f8","#bcbcbc","#7c7c7c","#a4e4fc","#3cbcfc","#0078f8","#0000fc","#b8b8f8","#6888fc","#0058f8","#0000bc","#d8b8f8","#9878f8","#6844fc","#4428bc","#f8b8f8","#f878f8","#d800cc","#940084","#f8a4c0","#f85898","#e40058","#a80020","#f0d0b0","#f87858","#f83800","#a81000","#fce0a8","#fca044","#e45c10","#881400","#f8d878","#f8b800","#ac7c00","#503000","#d8f878","#b8f818","#00b800","#007800","#b8f8b8","#58d854","#00a800","#006800","#b8f8d8","#58f898","#00a844","#005800","#00fcfc","#00e8d8","#008888","#004058","#f8d8f8","#787878"
];

class App extends React.Component {

  constructor(props) {
    super(props);
    this.simpleStorage = null;
    this.state = {
      loading: true,
      colors: [],
      selectedColor: palette[0],
      pendingCells: {},
    };
  }

  componentDidMount() {
     this.connectWeb3();
  }

  connectWeb3 = async () => {
    try {
      web3 = await getWeb3();
      if(window.ethereum && window.ethereum.on) {
        window.ethereum.on('accountsChanged', accounts => {
          this.setState({
            address: accounts[0]
          });
        });
      }

      const accounts = await web3.eth.getAccounts();
      this.setState({
        address: accounts[0]
      });

    } catch (error) {
      alert("Failed to load web3 or accounts. Check console for details.");
      console.log(error);
    }

    await this.initializeContract();
  };

  initializeContract = async () => {
    const TruffleContract = require("@truffle/contract");
    const pixieTruffleContract = TruffleContract(PixieAbi);
    pixieTruffleContract.setProvider(web3.currentProvider);
    this.pixieContract = await pixieTruffleContract.deployed();
    this.loadColors();
  };

  loadColors = async (poll = true) => {
    const colors = await this.pixieContract.getAllColors();
    this.setState({
      colors,
      loading: false,
    });

    if(poll) {
      setTimeout(this.loadColors, 1000);
    }
  };

  selectColor = color => {
    this.setState({
      selectedColor: color,
    });
  };

  paintCell = async (row, column, color) => {
    let pendingCells = { ...this.state.pendingCells };
    pendingCells[row + " " + column] = true;
    this.setState({
      pendingCells,
    });

    const newColor = color.replace("#","0x");
    await this.pixieContract.setColor(row, column, newColor, {from: this.state.address});

    await this.loadColors(false);

    pendingCells = { ...this.state.pendingCells };
    delete pendingCells[row + " " + column] ;
    this.setState({
      pendingCells,
    });
  }

  render() {
    const {
      colors,
      loading,
    } = this.state;

    const rows = [[]];
    for(var a = 0; a < colors.length; a++) {
      rows[rows.length - 1].push(colors[a].replace("0x","#"));
      if(rows[rows.length - 1].length === NUMBER_COLUMNS && a !== colors.length - 1) {
        rows.push([]);
      }
    }

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
                        { row.map( (color, j) => {
                          const style = {
                            color: color === "#000000" ? "white" : "black",
                            backgroundColor: color,
                          };
                          const content = this.state.pendingCells[i + " " + j] ? "..." : "";
                          return (
                            <div className="cell"
                              key={j}
                              onClick={() => this.paintCell(i, j, this.state.selectedColor)}
                              style={style}>{content}</div>
                          );
                        }) }
                      </div>
                    )
                  }
                )}
              </div>
              <div className="box">
                <div className="palette">
                  { palette.map( (paletteColor, i) => {
                    const style = {
                      backgroundColor: paletteColor,
                      border: "1px solid black",
                    };
                    if(this.state.selectedColor === paletteColor) {
                      style.border = "3px solid red";
                    }
                    return (
                      <div className="palette-item-container" key={i}>
                        <div className="palette-item"
                          style={style}
                          onClick={() => this.selectColor(paletteColor)}
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
