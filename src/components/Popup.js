import React from "react";

import './Popup.scss';

class Popup extends React.Component {

  handleClick = event => {
    // Close the window if the user clicked the close button
    if(['close-button'].indexOf(event.target.className) !== -1) {
      this.props.onClose();
    }
  }

  render() {
    return (
      <div className="Popup modal-background" onClick={this.handleClick}>
        <div className="window">
          <div className="window-header">
            <div className="title">{this.props.title}</div>
            <div className="close-button">X</div>
          </div>
          <div className="window-content">
            {this.props.children}
          </div>
        </div>
      </div>
    );
  }

}

Popup.defaultProps = {
  onClose: () => {},
};

export default Popup;