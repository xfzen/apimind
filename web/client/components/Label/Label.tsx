import React, { Component } from 'react';
import { Input, Tooltip } from 'antd';
import Icon from 'client/shims/antdIcon';
import PropTypes from 'prop-types';
import type { ChangeEvent } from 'react';
import './Label.scss';

interface LabelProps {
  onChange: (value: string) => void;
  desc?: string;
  cat_name?: string;
}

interface LabelState {
  inputShow: boolean;
  inputValue: string;
}

export default class Label extends Component<LabelProps, LabelState> {
  constructor(props: LabelProps) {
    super(props);
    this.state = {
      inputShow: false,
      inputValue: ''
    };
  }
  static propTypes = {
    onChange: PropTypes.func,
    desc: PropTypes.string,
    cat_name: PropTypes.string
  };
  toggle = () => {
    this.setState({ inputShow: !this.state.inputShow });
  };
  handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ inputValue: event.target.value });
  };
  componentWillReceiveProps(nextProps: LabelProps) {
    if (this.props.desc === nextProps.desc) {
      this.setState({
        inputShow: false
      });
    }
  }
  render() {
    return (
      <div>
        {this.props.desc && (
          <div className="component-label">
            {!this.state.inputShow ? (
              <div>
                <p>
                  {this.props.desc} &nbsp;&nbsp;
                  <Tooltip title="编辑简介">
                    <Icon onClick={this.toggle} className="interface-delete-icon" type="edit" />
                  </Tooltip>
                </p>
              </div>
            ) : (
              <div className="label-input-wrapper">
                <Input onChange={this.handleChange} defaultValue={this.props.desc} size="small" />
                <Icon
                  className="interface-delete-icon"
                  onClick={() => {
                    this.props.onChange(this.state.inputValue);
                    this.toggle();
                  }}
                  type="check"
                />
                <Icon className="interface-delete-icon" onClick={this.toggle} type="close" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}
