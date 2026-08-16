import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Row, Col, Input } from 'antd';
import Icon from 'client/shims/antdIcon';
import './ProjectTag.scss';

export interface ProjectTagItem { name: string; desc: string }
interface ProjectTagProps { tagMsg?: ProjectTagItem[]; tagSubmit?: (tags: ProjectTagItem[]) => void }
export interface ProjectTagState { tag: ProjectTagItem[] }
type TagField = keyof ProjectTagItem;

export class ProjectTag extends Component<ProjectTagProps, ProjectTagState> {
  static propTypes = {
    tagMsg: PropTypes.array,
    tagSubmit: PropTypes.func
  };
  constructor(props: ProjectTagProps) {
    super(props);
    this.state = {
      tag: [{ name: '', desc: '' }]
    };
  }

  initState(curdata?: ProjectTagItem[]): ProjectTagState {
    let tag = [
      {
        name: '',
        desc: ''
      }
    ];
    if (curdata && curdata.length !== 0) {
      curdata.forEach((item: ProjectTagItem) => {
        tag.unshift(item);
      });
    }

    return { tag };
  }
  componentDidMount() {
    this.handleInit(this.props.tagMsg);
  }

  handleInit(data?: ProjectTagItem[]) {
    let newValue = this.initState(data);
    this.setState({ ...newValue });
  }

  addHeader = (val: string, index: number, name: 'tag', label: TagField) => {
    let newValue: ProjectTagState = { tag: this.state.tag.slice() };
    newValue[name][index][label] = val;
    let nextData = this.state[name][index + 1];
    if (!(nextData && typeof nextData === 'object')) {
      let data = { name: '', desc: '' };
      newValue[name] = this.state[name].concat(data);
    }
    this.setState(newValue);
  };

  delHeader = (key: number, name: 'tag') => {
    let curValue = this.state[name];
    let newValue: ProjectTagState = { tag: [] };
    newValue[name] = curValue.filter((_val: ProjectTagItem, index: number) => {
      return index !== key;
    });
    this.setState(newValue);
  };

  handleChange = (val: string, index: number, name: 'tag', label: TagField) => {
    let newValue = this.state;
    newValue[name][index][label] = val;
    this.setState(newValue);
  };

  render() {
    const commonTpl = (item: ProjectTagItem, index: number, name: 'tag') => {
      const length = this.state[name].length - 1;
      return (
        <Row key={index} className="tag-item">
          <Col span={6} className="item-name">
            <Input
              placeholder={`请输入 ${name} 名称`}
              // style={{ width: '200px' }}
              value={item.name || ''}
              onChange={e => this.addHeader(e.target.value, index, name, 'name')}
            />
          </Col>
          <Col span={12}>
            <Input
              placeholder="请输入tag 描述信息"
              style={{ width: '90%', marginRight: 8 }}
              onChange={e => this.handleChange(e.target.value, index, name, 'desc')}
              value={item.desc || ''}
            />
          </Col>
          <Col span={2} className={index === length ? ' tag-last-row' : undefined}>
            {/* 新增的项中，只有最后一项没有有删除按钮 */}
            <Icon
              className="dynamic-delete-button delete"
              type="delete"
              onClick={e => {
                e.stopPropagation();
                this.delHeader(index, name);
              }}
            />
          </Col>
        </Row>
      );
    };

    return (
      <div className="project-tag">
        {this.state.tag.map((item, index) => {
          return commonTpl(item, index, 'tag');
        })}
      </div>
    );
  }
}

export default ProjectTag;
