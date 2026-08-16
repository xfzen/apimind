import React, { Component } from 'react';
import PropTypes from 'prop-types';
import type { ChangeEvent } from 'react';
import { Row, Input } from 'antd';
import constants from '../../constants/variable.js';
const wordList = constants.MOCK_SOURCE;
const Search = Input.Search;

type MockItem = (typeof wordList)[number];
interface MockListProps {
  click: (value: string) => void;
  clickValue?: string;
}
interface MockListState {
  filter: string;
  list: MockItem[];
}

class MockList extends Component<MockListProps, MockListState> {
  static propTypes = {
    click: PropTypes.func,
    clickValue: PropTypes.string
  };

  constructor(props: MockListProps) {
    super(props);
    this.state = {
      filter: '',
      list: []
    };
  }

  componentDidMount() {
    this.setState({
      list: wordList
    });
  }

  onFilter = (e: ChangeEvent<HTMLInputElement>) => {
    const list = wordList.filter(item => {
      return item.mock.indexOf(e.target.value) !== -1;
    });
    this.setState({
      filter: e.target.value,
      list: list
    });
  };

  render() {
    const { list, filter } = this.state;
    const { click, clickValue } = this.props;
    return (
      <div className="modal-postman-form-mock">
        <Search
          onChange={this.onFilter}
          value={filter}
          placeholder="搜索mock数据"
          className="mock-search"
        />
        {list.map((item, index) => {
          return (
            <Row
              key={index}
              type="flex"
              align="middle"
              className={'row ' + (item.mock === clickValue ? 'checked' : '')}
              onClick={() => click(item.mock)}
            >
              <span>{item.mock}</span>
            </Row>
          );
        })}
      </div>
    );
  }
}

export default MockList;
