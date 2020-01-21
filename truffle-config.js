require('babel-register');
require('babel-polyfill');

const fs = require('fs');
const path = require('path');

const HDWalletProvider = require("truffle-hdwallet-provider");
const MNEMONIC = fs.readFileSync(path.resolve(__dirname, 'mnemonic.txt'), 'utf8');

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*", // Match any network id
      gas: 8000000,
      websockets: true,
    },
    ropsten: {
      provider: function() {
        return new HDWalletProvider(MNEMONIC, "https://ropsten.infura.io/v3/786ade30f36244469480aa5c2bf0743b")
      },
      network_id: 3,
      gas: 4000000  //make sure this gas allocation isn't over 4M, which is the max
    }
  },
  contracts_directory: './src/contracts/',
  contracts_build_directory: './src/abis/',
  compilers: {
    solc: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
}
