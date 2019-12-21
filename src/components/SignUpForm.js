import React from "react";
import validateEmail from 'utils/validateEmail';

import './SignUpForm.scss';

const AWAITING_SUBMISSION = "awaitingSubmission";
const ERRORED = "errored";
const SUBMITTED = "submitted";

class SignUpForm extends React.Component {

  constructor(props) {
    super(props);
    this.emailInput = React.createRef();
    this.state = {
      emailAddressValidationFailed: false,
      whitelistingState: AWAITING_SUBMISSION,
    };
  }

  handleRequestAccessClick = async () => {
    const {
      address,
      web3,
    } = this.props;

    this.setState({
      userRejectedSignatureRequest: false,
      whitelistingState: AWAITING_SUBMISSION,
    });

    const emailAddress = this.emailInput.current.value;
    if(!validateEmail(emailAddress)) {
      this.setState({
        emailAddressValidationFailed: true,
      });
      return;
    }

    this.setState({
      emailAddressValidationFailed: false,
    });

    const messageToSign = `My email address is ${emailAddress}, and I would like to join the illustrious group of Pixie testers!`;
    let signature;
    try {
      signature = await web3.eth.personal.sign(messageToSign, address);
    } catch(error) {
      this.setState({
        userRejectedSignatureRequest: true,
      });
      return;
    }

    try {
      let params = [];
      params.push(encodeURIComponent("address") + "=" + encodeURIComponent(address));
      params.push(encodeURIComponent("message") + "=" + encodeURIComponent(messageToSign));
      params.push(encodeURIComponent("signature") + "=" + encodeURIComponent(signature));
      params = params.join("&");

      await fetch("https://sylphdapps.com/pixie/apply-to-be-a-tester.php?" + params, {
        method: "GET",
        mode: "no-cors",
      });

      /*
      if (response.status !== 200) {
        throw new Error('Not a 200');
      }
      */

      this.setState({
        whitelistingState: SUBMITTED,
      })
    } catch (error) {
      console.log(error);
      this.setState({
        whitelistingState: ERRORED,
      });
    }
  }

  render() {
    const inputClassName = this.state.emailAddressValidationFailed ? 'error' : '';
    const instructionsClassName = this.state.userRejectedSignatureRequest ? 'instructions-error' : '';

    return (
      <div className="SignUpForm">
        { this.state.whitelistingState === AWAITING_SUBMISSION &&
          <React.Fragment>
            <p>At the moment, Pixie is only available to a limited group of testers. To join, enter your email address below and click "Request access".</p>
            <div className="email-input-container">
              <input ref={this.emailInput}
                className={inputClassName}
                placeholder="Email address" />
              <button onClick={this.handleRequestAccessClick}>Request access</button>
            </div>
            <p>You'll be notified at this email address once your tester access is approved.</p>
            <p className={instructionsClassName}>When you click "Request access", your Ethereum-enabled browser will prompt you to sign a message, proving that you own the Ethereum address you're using to request access.</p>
          </React.Fragment>
        }
        { this.state.whitelistingState === ERRORED &&
          <p>Gah! There was a problem submitting your application. Please try again later :(</p>
        }
        { this.state.whitelistingState === SUBMITTED &&
          <p>Thank you for your request! You'll receive an email once your tester access is approved :)</p>
        }
      </div>
    );
  }
}

export default SignUpForm;