import React from "react";
import Popup from "components/Popup";
import SignUpForm from "components/SignUpForm";
import isMobileOrTablet from 'utils/isMobileOrTablet';

import './PopupMessage.scss';

export const ABOUT = "ABOUT";
export const WEB3_MISSING = "WEB3_MISSING";
export const UNABLE_TO_LOAD_CONTRACT = "UNABLE_TO_LOAD_CONTRACT";
export const WALLET_CONNECTION_APPOVAL_PENDING = "WALLET_CONNECTION_APPOVAL_PENDING";
export const WALLET_CONNECTION_APPOVAL_REQUIRED = "WALLET_CONNECTION_APPOVAL_REQUIRED";
export const ACCOUNT_NOT_WHITELISTED = "ACCOUNT_NOT_WHITELISTED";
export const TRANSACTION_APPROVAL_PENDING = "TRANSACTION_APPROVAL_PENDING";
export const TRANSACTION_APPROVAL_REQUIRED = "TRANSACTION_APPROVAL_REQUIRED";
export const TRANSACTION_SUBMITTED = "TRANSACTION_SUBMITTED";
export const TRANSACTION_ERROR = "TRANSACTION_ERROR";
export const CELL_ALREADY_DESIRED_COLOR = "CELL_ALREADY_DESIRED_COLOR";

const ETHERSCAN_HOSTNAME = "ropsten.etherscan.io";

class PopupMessage extends React.Component {

  constructor(props) {
    super(props);
    this.hideConfirmationMessagesCheckbox = React.createRef();
  }

  handleClose = () => {
    let options = null;
    if(this.hideConfirmationMessagesCheckbox.current) {
      options = {
        hideConfirmationMessages: this.hideConfirmationMessagesCheckbox.current.checked
      }
    }
    this.props.onClose(options);
  };

  renderBrowserRequirementsMessage = () => {
    return (
      <React.Fragment>
        <p>To paint on Pixie, you need to use a Ethereum-enabled browser.</p>
        <p>
          You can turn Chrome into an Ethereum-enabled browser by installing the <a href="https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" target="_blank" rel="noopener noreferrer">Metamask</a> plugin, or you can use <a href="https://www.brave.com/" target="_blank" rel="noopener noreferrer">Brave</a> or <a href="https://www.opera.com/" target="_blank" rel="noopener noreferrer">Opera</a>. 
        </p>
        <p>
          Mobile options include <a href="https://status.im/get/" target="_blank" rel="noopener noreferrer">Status</a> and the mobile version of <a href="https://www.opera.com/" target="_blank" rel="noopener noreferrer">Opera</a>.
        </p>
      </React.Fragment>
    )
  };

  render() {
    const {
      message,
      contractAddress,
    } = this.props;

    let toReturn = null;

    switch(message.type) {
      case ABOUT:
        const etherscanContractTransactionsURL = `https://${ETHERSCAN_HOSTNAME}/address/${contractAddress}`;
        toReturn = (
          <Popup title="About Pixie"
            onClose={this.handleClose}>
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
              Pixie is currently deployed to a test version of the Ethereum network where the Ether has no value, making Pixie free to use for the moment. Before contributing to Pixie, you will need to point your browser to the <b>Ropsten Test Network</b> and load your Ethereum account with some Ropsten Ether to cover the gas "costs". You can get some Ropsten Ether by pasting your account's address into <a href="https://faucet.ropsten.be/" target="_blank" rel="noopener noreferrer">this form</a>.
            </p>
          </Popup>
        );
        break;
      case WEB3_MISSING:
        toReturn = (
          <Popup title="Hold up"
            onClose={this.handleClose}>
            { this.renderBrowserRequirementsMessage() }
          </Popup>
        );
        break;
      case UNABLE_TO_LOAD_CONTRACT:
        toReturn = (
          <Popup title=":("
            onClose={this.handleClose}>
            <p>Pixie was unable to connect to its back-end on the "Ropsten" test version of the Ethereum network. Confirm that your browser is configured to use the Ropsten network and refresh the page and try again.</p>
          </Popup>
          );
        break;
      case WALLET_CONNECTION_APPOVAL_PENDING:
        toReturn = (
          <Popup title="Please let Pixie view your Ethereum account's address"
            onClose={this.handleClose}>
            <p>Pixie has submitted a request to view your Ethereum account's address. In order to paint a pixel, you must approve the request.</p>
            { !isMobileOrTablet() &&
              <p>If you do not see the request, click your wallet's icon next to your address bar.</p>
            }
          </Popup>
        );
        break;
      case WALLET_CONNECTION_APPOVAL_REQUIRED:
        toReturn = (
          <Popup title="Hold up"
            onClose={this.handleClose}>
            <p>In order to paint a pixel, Pixie needs to know your Ethereum address. Please click on the pixel you'd like to paint again and allow the connection.</p>
          </Popup>
        );
        break;
      case ACCOUNT_NOT_WHITELISTED:
        toReturn = (
          <Popup onClose={this.handleClose}>
            <SignUpForm address={message.data.address}
              web3={message.data.web3} />
          </Popup>
        );
        break;
      case TRANSACTION_APPROVAL_PENDING:
        toReturn = (
          <Popup title="Awaiting your approval"
            onClose={this.handleClose}>
            <p>Pixie has put together a transaction request that, when submitted, will store your pixel's new color to the Ethereum blockchain. Once you approve the request, your pixel is as good as painted!</p>
            { !isMobileOrTablet() &&
              <p>If you don't see the request, click on your wallet's logo next to your address bar.</p>
            }
          </Popup>
        );
        break;
      case TRANSACTION_APPROVAL_REQUIRED:
        toReturn = (
          <Popup title="Hold up"
            onClose={this.handleClose}>
            <p>In order to paint that pixel, you must approve the transaction request. If you rejected the request by accident, you can click on the pixel you want to paint again.</p>
          </Popup>
        );
        break;
      case TRANSACTION_SUBMITTED:
        const transactionURL = `https://${ETHERSCAN_HOSTNAME}/tx/${message.data.hash}`;
        toReturn = (
          <Popup title="Hooray!"
            onClose={this.handleClose}>
            <p>Your transaction has been submitted to the Ethereum network! Once it's mined, your pixel will be recolored for all the world to see!</p>
            <p>The amount of time it takes for a transaction to be mined varies based on the amount of other activity currently happening on the Ethereum network. You can view the status of your transaction on <a href={transactionURL} target="_blank" rel="noopener noreferrer">Etherscan</a>.</p>
            <p>Feel free to paint some other pixels while you wait :)</p>
            <div>
              <input ref={this.hideConfirmationMessagesCheckbox}
                id="hideConfirmationMessagesCheckbox"
                type="checkbox" />
              <label htmlFor="hideConfirmationMessagesCheckbox">Don't show this message again until I reload Pixie</label>
            </div>
          </Popup>
        );
        break;
      case TRANSACTION_ERROR:
        toReturn = (
          <Popup title=":("
            onClose={this.handleClose}>
            <p>There was a problem processing your transaction.</p>
          </Popup>
        );
        break;
      case CELL_ALREADY_DESIRED_COLOR:
        toReturn = (
          <Popup title="Good news!"
            onClose={this.handleClose}>
            <div className="cell-already-desired-color">
              <div className="text">That pixel is already</div>
              <div className="color-swatch" style={{
                backgroundColor: message.data.color,
              }}/>
            </div>
          </Popup>
        );
        break;
      default:
        break;
    }
    return toReturn;
  }

}

export default PopupMessage;