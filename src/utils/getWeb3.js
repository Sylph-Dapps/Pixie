import Web3 from "web3";

const USE_INJECTED_GANACHE = false;

const hasWeb3 = () => {
  return window.ethereum || window.web3 || USE_INJECTED_GANACHE;
}

const getWeb3 = () => {
  const promise = new Promise(async (resolve, reject) => {
    // Modern dapp browsers...
    if (window.ethereum) {
      const web3 = new Web3(window.ethereum);
      try {
        // Request account access if needed
        await window.ethereum.enable();
        // Acccounts now exposed
        resolve(web3);
      } catch (error) {
        reject(error);
      }
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      // Use Mist/MetaMask's provider.
      const web3 = window.web3;
      resolve(web3);
    }
    else if (USE_INJECTED_GANACHE) {
      // Fallback to localhost; use dev console port by default...
      const provider = new Web3.providers.HttpProvider(
        "http://localhost:7545"
      );
      const web3 = new Web3(provider);
      console.log("No web3 instance injected, using Local web3.");
      resolve(web3);
    }
    else {
      reject({});
    }
  });
  return promise;
};

const getViewOnlyWeb3 = async () => {
  let provider;
  if(USE_INJECTED_GANACHE) {
    provider = new Web3.providers.HttpProvider("http://localhost:7545");
  } else {
    provider = new Web3.providers.WebsocketProvider("wss://ropsten.infura.io/ws/v3/786ade30f36244469480aa5c2bf0743b") // From https://github.com/floating/eth-provider
  }
  const web3 = new Web3(provider);
  return await web3;
};

export { 
  getWeb3,
  hasWeb3,
  getViewOnlyWeb3
};
export default getWeb3;