import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Input, AutoComplete } from 'antd';
import Icon from 'client/shims/antdIcon';
import './Search.scss';
import { withRouter } from 'react-router';
import type { RouteComponentProps } from 'react-router';
import axios from 'axios';
import { setCurrGroup, fetchGroupMsg } from '../../../reducer/modules/group';
import { changeMenuItem } from '../../../reducer/modules/menu';

import { fetchInterfaceListMenu } from '../../../reducer/modules/interface';
import type { ApiResponse } from '../../../types/api';
import type { RootState } from '../../../reducer/modules/reducer';
import type { UnknownRecord } from '../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../types/legacyDecorators';

interface SearchOption {
  key: string;
  type: '分组' | '项目' | '接口';
  value: string;
  id: string;
  groupId?: string;
  projectId?: string;
  label: string;
}

interface SearchResults {
  group: Array<{ _id: string | number; groupName: string }>;
  project: Array<{ _id: string | number; name: string; groupId: string | number }>;
  interface: Array<{ _id: string | number; title: string; projectId: string | number }>;
}

interface SearchProps extends RouteComponentProps {
  groupList: UnknownRecord[];
  projectList: UnknownRecord[];
  setCurrGroup: (group: { _id: number; group_name: string }) => unknown;
  changeMenuItem: (key: string) => unknown;
  fetchGroupMsg: (id: string | number) => Promise<unknown>;
  fetchInterfaceListMenu: (id: string | number) => Promise<unknown>;
}

interface SearchState {
  dataSource: SearchOption[];
}

const connectSearch = asLegacyClassDecorator(connect(
  (state: RootState) => ({
    groupList: state.group.groupList,
    projectList: state.project.projectList
  }),
  {
    setCurrGroup,
    changeMenuItem,
    fetchGroupMsg,
    fetchInterfaceListMenu
  }
));
const routeSearch = asLegacyClassDecorator(withRouter);
@connectSearch
@routeSearch
class Srch extends Component<SearchProps, SearchState> {
  constructor(props: SearchProps) {
    super(props);
    this.state = {
      dataSource: []
    };
  }

  static propTypes = {
    groupList: PropTypes.array,
    projectList: PropTypes.array,
    router: PropTypes.object,
    history: PropTypes.object,
    location: PropTypes.object,
    setCurrGroup: PropTypes.func,
    changeMenuItem: PropTypes.func,
    fetchInterfaceListMenu: PropTypes.func,
    fetchGroupMsg: PropTypes.func
  };

  onSelect = async (value: string, option: SearchOption) => {
    if (option.type === '分组') {
      this.props.changeMenuItem('/group');
      this.props.history.push('/group/' + option.id);
      this.props.setCurrGroup({ group_name: value, _id: Number(option.id) });
    } else if (option.type === '项目') {
      if (!option.groupId) return;
      await this.props.fetchGroupMsg(option.groupId);
      this.props.history.push('/project/' + option.id);
    } else if (option.type === '接口') {
      if (!option.projectId) return;
      await this.props.fetchInterfaceListMenu(option.projectId);
      this.props.history.push(
        '/project/' + option.projectId + '/interface/api/' + option.id
      );
    }
  };

  handleSearch = (value: string) => {
    axios
      .get<ApiResponse<SearchResults>>('/api/project/search?q=' + value)
      .then(res => {
        if (res.data && res.data.errcode === 0) {
          const dataSource: SearchOption[] = [];
          const results = res.data.data;
          if (!results) return;
          for (const title of Object.keys(results) as Array<keyof SearchResults>) {
            results[title].forEach(item => {
              switch (title) {
                case 'group':
                  const groupItem = item as SearchResults['group'][number];
                  dataSource.push({
                    key: `分组${groupItem._id}`,
                    type: '分组',
                    value: `${groupItem.groupName}`,
                    id: `${groupItem._id}`,
                    label: `分组: ${groupItem.groupName}`
                  });
                  break;
                case 'project':
                  const projectItem = item as SearchResults['project'][number];
                  dataSource.push({
                    key: `项目${projectItem._id}`,
                    type: '项目',
                    value: `${projectItem.name}`,
                    id: `${projectItem._id}`,
                    groupId: `${projectItem.groupId}`,
                    label: `项目: ${projectItem.name}`
                  });
                  break;
                case 'interface':
                  const interfaceItem = item as SearchResults['interface'][number];
                  dataSource.push({
                    key: `接口${interfaceItem._id}`,
                    type: '接口',
                    value: `${interfaceItem.title}`,
                    id: `${interfaceItem._id}`,
                    projectId: `${interfaceItem.projectId}`,
                    label: `接口: ${interfaceItem.title}`
                  });
                  break;
                default:
                  break;
              }
            });
          }
          this.setState({
            dataSource: dataSource
          });
        } else {
          console.log('查询项目或分组失败');
        }
      })
      .catch(err => {
        console.log(err);
      });
  };

  // getDataSource(groupList){
  //   const groupArr =[];
  //   groupList.forEach(item =>{
  //     groupArr.push("group: "+ item["group_name"]);
  //   })
  //   return groupArr;
  // }

  render() {
    const { dataSource } = this.state;

    return (
      <div className="search-wrapper">
        <AutoComplete
          className="search-dropdown"
          options={dataSource}
          style={{ width: '100%' }}
          defaultActiveFirstOption={false}
          onSelect={this.onSelect}
          onSearch={this.handleSearch}
          // filterOption={(inputValue, option) =>
          //   option.props.children.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
          // }
        >
          <Input
            prefix={<Icon type="search" className="srch-icon" />}
            placeholder="搜索分组/项目/接口"
            className="search-input"
          />
        </AutoComplete>
      </div>
    );
  }
}

export default Srch as unknown as ComponentType;
