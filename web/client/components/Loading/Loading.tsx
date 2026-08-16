import React from 'react';
import PropTypes from 'prop-types';
import './Loading.scss';

interface LoadingProps {
  visible?: boolean;
}

interface LoadingState {
  show?: boolean;
}

export default class Loading extends React.PureComponent<LoadingProps, LoadingState> {
  static defaultProps = {
    visible: false
  };
  static propTypes = {
    visible: PropTypes.bool
  };
  constructor(props: LoadingProps) {
    super(props);
    this.state = { show: props.visible };
  }
  UNSAFE_componentWillReceiveProps(nextProps: LoadingProps) {
    this.setState({ show: nextProps.visible });
  }
  render() {
    return (
      <div className="loading-box" style={{ display: this.state.show ? 'flex' : 'none' }}>
        <div className="loading-box-bg" />
        <div className="loading-box-inner">
          <div />
          <div />
          <div />
          <div />
          <div />
          <div />
          <div />
          <div />
        </div>
      </div>
    );
  }
}
