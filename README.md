
## Pixie
Pixie is a collaborative pixel art project built on Ethereum. Users share a single grid and can choose to color its individual cells using the colors from the original NES color palette. All pixel data is stored in a smart contract on the Ethereum blockchain.

### Install dependencies
`yarn`

### Start ganache-cli (with a 10 second block time)
`ganache-cli -h 0.0.0.0 -p 7545 -b 10`

### Build and deploy contracts to ganache-cli
`truffle compile`
`truffle migrate`

### Run dev server
`yarn start` and visit [http://localhost:3000/](http://localhost:3000/)

### Create production build
`yarn build`
  
This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app)
