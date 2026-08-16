import React, { PureComponent as Component } from 'react';
import type { ComponentType, Key, ChangeEvent } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {
  fetchInterfaceListMenu, fetchInterfaceList, fetchInterfaceCatList, fetchInterfaceData, deleteInterfaceData, deleteInterfaceCatData, initInterface
} from '../../../../reducer/modules/interface';
import { getProject } from '../../../../reducer/modules/project';
import { Input, Button, Modal, message, Tree, Tooltip } from 'antd';
import Icon from 'client/shims/antdIcon';
import AddInterfaceForm from './AddInterfaceForm';
import AddInterfaceCatForm from './AddInterfaceCatForm';
import axios from 'axios';
import { Link, withRouter } from 'react-router-dom';
import produce from 'immer';
import { arrayChangeIndex } from '../../../../common';
import type { RouteComponentProps } from 'react-router-dom';
import type { ApiResponse } from '../../../../types/api';
import type { RootState } from '../../../../reducer/modules/reducer';
import type { UnknownRecord } from '../../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../../types/legacyDecorators';
import type { AddInterfaceValues } from './AddInterfaceForm';

import './interfaceMenu.scss';

const confirm = Modal.confirm;
const headHeight = 240; // menu顶部到网页顶部部分的高度

interface MenuRouteParams { id: string; actionId: string }
interface MenuInterface extends UnknownRecord {
  _id: string | number;
  catid: string | number;
  title: string;
  path: string;
  method?: string;
}
interface MenuCategory extends UnknownRecord {
  _id: string | number;
  name: string;
  desc?: string;
  list: MenuInterface[];
}
interface MenuProject extends UnknownRecord { cat: MenuCategory[] }
interface ActionResult<T> { payload: { data: ApiResponse<T> } }
interface InterfaceMenuProps extends RouteComponentProps<MenuRouteParams> {
  inter: Partial<MenuInterface>;
  projectId: string;
  list: MenuCategory[];
  curProject: MenuProject;
  expands: string[];
  router?: { params: MenuRouteParams };
  fetchInterfaceListMenu: (id: string | number) => Promise<ActionResult<MenuCategory[]>>;
  fetchInterfaceData: (id: string | number) => Promise<ActionResult<MenuInterface>>;
  deleteInterfaceCatData: (catid: string | number, projectId: string | number) => Promise<unknown>;
  deleteInterfaceData: (id: string | number, projectId: string | number) => Promise<unknown>;
  initInterface: () => unknown;
  getProject: (id: string | number) => Promise<unknown>;
  fetchInterfaceCatList: (params: UnknownRecord) => Promise<unknown>;
  fetchInterfaceList: (params: UnknownRecord) => Promise<unknown>;
}
interface InterfaceMenuState {
  curKey: Key | null;
  visible: boolean;
  delIcon: Key | null;
  curCatid: number | null;
  add_cat_modal_visible: boolean;
  change_cat_modal_visible: boolean;
  del_cat_modal_visible: boolean;
  curCatdata: Partial<MenuCategory>;
  expands: string[] | null;
  list: MenuCategory[];
  filter: string;
}
interface LegacyTreeNode { props: { pos: string; eventKey: string } }
interface LegacyDropEvent { node: LegacyTreeNode; dragNode: LegacyTreeNode }
const connectInterfaceMenu = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      list: state.inter.list,
      inter: state.inter.curdata,
      curProject: state.project.currProject,
      expands: []
    };
  },
  {
    fetchInterfaceListMenu,
    fetchInterfaceData,
    deleteInterfaceCatData,
    deleteInterfaceData,
    initInterface,
    getProject,
    fetchInterfaceCatList,
    fetchInterfaceList
  }
));
@connectInterfaceMenu
class InterfaceMenu extends Component<InterfaceMenuProps, InterfaceMenuState> {
  static propTypes = {
    match: PropTypes.object,
    inter: PropTypes.object,
    projectId: PropTypes.string,
    list: PropTypes.array,
    fetchInterfaceListMenu: PropTypes.func,
    curProject: PropTypes.object,
    fetchInterfaceData: PropTypes.func,
    addInterfaceData: PropTypes.func,
    deleteInterfaceData: PropTypes.func,
    initInterface: PropTypes.func,
    history: PropTypes.object,
    router: PropTypes.object,
    getProject: PropTypes.func,
    fetchInterfaceCatList: PropTypes.func,
    fetchInterfaceList: PropTypes.func
  };

  /**
   * @param {String} key
   */
  changeModal = <K extends keyof InterfaceMenuState>(key: K, status: InterfaceMenuState[K]) => {
    //visible add_cat_modal_visible change_cat_modal_visible del_cat_modal_visible
    let newState = {} as Pick<InterfaceMenuState, K>;
    newState[key] = status;
    this.setState(newState);
  };

  handleCancel = () => {
    this.setState({
      visible: false
    });
  };

  constructor(props: InterfaceMenuProps) {
    super(props);
    this.state = {
      curKey: null,
      visible: false,
      delIcon: null,
      curCatid: null,
      add_cat_modal_visible: false,
      change_cat_modal_visible: false,
      del_cat_modal_visible: false,
      curCatdata: {},
      expands: null,
      list: [],
      filter: ''
    };
  }

  handleRequest() {
    this.props.initInterface();
    this.getList();
  }

  async getList() {
    let r = await this.props.fetchInterfaceListMenu(this.props.projectId);
    this.setState({
      list: r.payload.data.data || []
    });
  }

  componentWillMount() {
    this.handleRequest();
  }

  componentWillReceiveProps(nextProps: InterfaceMenuProps) {
    if (this.props.list !== nextProps.list) {
      // console.log('next', nextProps.list)
      this.setState({
        list: nextProps.list
      });
    }
  }

  onSelect = (selectedKeys: Key[]) => {
    const { history, match } = this.props;
    let curkey = selectedKeys[0];

    if (!curkey || !selectedKeys) {
      return false;
    }
    let basepath = '/project/' + match.params.id + '/interface/api';
    if (curkey === 'root') {
      history.push(basepath);
      this.setState({
        expands: null
      });
    } else if (String(curkey).indexOf('cat_') === 0) {
      this.toggleCatExpanded(String(curkey));
      history.push(basepath + '/' + curkey);
    } else {
      history.push(basepath + '/' + curkey);
      this.setState({
        expands: null
      });
    }
  };

  changeExpands = () => {
    this.setState({
      expands: null
    });
  };

  handleAddInterface = (data: AddInterfaceValues, cb: () => void) => {
    data.project_id = this.props.projectId;
    axios.post('/api/interface/add', data).then(res => {
      if (res.data.errcode !== 0) {
        return message.error(res.data.errmsg);
      }
      message.success('接口添加成功');
      let interfaceId = res.data.data._id;
      this.props.history.push('/project/' + this.props.projectId + '/interface/api/' + interfaceId);
      this.getList();
      this.setState({
        visible: false
      });
      if (cb) {
        cb();
      }
    });
  };

  handleAddInterfaceCat = (data: { name: string; desc?: string; project_id?: string }) => {
    data.project_id = this.props.projectId;
    axios.post('/api/interface/add_cat', data).then(res => {
      if (res.data.errcode !== 0) {
        return message.error(res.data.errmsg);
      }
      message.success('接口分类添加成功');
      this.getList();
      this.props.getProject(this.props.projectId);
      this.setState({
        add_cat_modal_visible: false
      });
    });
  };

  handleChangeInterfaceCat = (data: { name: string; desc?: string; project_id?: string }) => {
    data.project_id = this.props.projectId;

    let params = {
      catid: this.state.curCatdata._id,
      name: data.name,
      desc: data.desc
    };

    axios.post('/api/interface/up_cat', params).then(res => {
      if (res.data.errcode !== 0) {
        return message.error(res.data.errmsg);
      }
      message.success('接口分类更新成功');
      this.getList();
      this.props.getProject(this.props.projectId);
      this.setState({
        change_cat_modal_visible: false
      });
    });
  };

  showConfirm = (data: MenuInterface) => {
    let that = this;
    let id = data._id;
    let catid = data.catid;
    const ref = confirm({
      title: '您确认删除此接口????',
      content: '温馨提示：接口删除后，无法恢复',
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        await that.props.deleteInterfaceData(id, that.props.projectId);
        await that.getList();
        await that.props.fetchInterfaceCatList({ catid });
        ref.destroy();
        that.props.history.push(
          '/project/' + that.props.match.params.id + '/interface/api/cat_' + catid
        );
      },
      onCancel() {
        ref.destroy();
      }
    });
  };

  showDelCatConfirm = (catid: string | number) => {
    let that = this;
    const ref = confirm({
      title: '确定删除此接口分类吗？',
      content: '温馨提示：该操作会删除该分类下所有接口，接口删除后无法恢复',
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        await that.props.deleteInterfaceCatData(catid, that.props.projectId);
        await that.getList();
        // await that.props.getProject(that.props.projectId)
        await that.props.fetchInterfaceList({ project_id: that.props.projectId });
        that.props.history.push('/project/' + that.props.match.params.id + '/interface/api');
        ref.destroy();
      },
      onCancel() {}
    });
  };

  copyInterface = async (id: string | number) => {
    let interfaceData = await this.props.fetchInterfaceData(id);
    // let data = JSON.parse(JSON.stringify(interfaceData.payload.data.data));
    // data.title = data.title + '_copy';
    // data.path = data.path + '_' + Date.now();
    let data = interfaceData.payload.data.data;
    if (!data) return;
    let newData = produce(data, draftData => {
      draftData.title = draftData.title + '_copy';
      draftData.path = draftData.path + '_' + Date.now();
    });

    axios.post('/api/interface/add', newData).then(async res => {
      if (res.data.errcode !== 0) {
        return message.error(res.data.errmsg);
      }
      message.success('接口添加成功');
      let interfaceId = res.data.data._id;
      await this.getList();
      this.props.history.push('/project/' + this.props.projectId + '/interface/api/' + interfaceId);
      this.setState({
        visible: false
      });
    });
  };

  enterItem = (id: Key) => {
    this.setState({ delIcon: id });
  };

  leaveItem = () => {
    this.setState({ delIcon: null });
  };

  onFilter = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      filter: e.target.value,
      list: JSON.parse(JSON.stringify(this.props.list))
    });
  };

  onExpand = (e: Key[]) => {
    this.setState({
      expands: e.map(String)
    });
  };

  currentCatExpandedKeys = () => {
    const { router, inter, list } = this.props;
    if (this.state.expands) {
      return this.state.expands;
    }
    if (!list || list.length === 0) {
      return [];
    }
    if (router) {
      if (!isNaN(Number(router.params.actionId))) {
        if (!inter || !inter._id) {
          return [];
        }
        return ['cat_' + inter.catid];
      }
      return ['cat_' + router.params.actionId.substr(4)];
    }
    return ['cat_' + list[0]._id];
  };

  toggleCatExpanded = (key: string) => {
    const currentKeys = this.currentCatExpandedKeys();
    this.setState({
      expands: currentKeys.indexOf(key) > -1
        ? currentKeys.filter((item: string) => item !== key)
        : currentKeys.concat(key)
    });
  };

  onDrop = async (e: LegacyDropEvent) => {
    const dropCatIndex = Number(e.node.props.pos.split('-')[1]) - 1;
    const dragCatIndex = Number(e.dragNode.props.pos.split('-')[1]) - 1;
    if (dropCatIndex < 0 || dragCatIndex < 0) {
      return;
    }
    const { list } = this.props;
    const dropCatId = this.props.list[dropCatIndex]._id;
    const id = e.dragNode.props.eventKey;
    const dragCatId = this.props.list[dragCatIndex]._id;

    const dropPos = e.node.props.pos.split('-');
    const dropIndex = Number(dropPos[dropPos.length - 1]);
    const dragPos = e.dragNode.props.pos.split('-');
    const dragIndex = Number(dragPos[dragPos.length - 1]);

    if (id.indexOf('cat') === -1) {
      if (dropCatId === dragCatId) {
        // 同一个分类下的接口交换顺序
        let colList = list[dropCatIndex].list;
        let changes = arrayChangeIndex(colList, dragIndex, dropIndex);
        axios.post('/api/interface/up_index', changes).then();
      } else {
        await axios.post('/api/interface/up', { id, catid: dropCatId });
      }
      const { projectId, router } = this.props;
      this.props.fetchInterfaceListMenu(projectId);
      this.props.fetchInterfaceList({ project_id: projectId });
      if (router && isNaN(Number(router.params.actionId))) {
        // 更新分类list下的数据
        let catid = router.params.actionId.substr(4);
        this.props.fetchInterfaceCatList({ catid });
      }
    } else {
      // 分类之间拖动
      let changes = arrayChangeIndex(list, dragIndex - 1, dropIndex - 1);
      axios.post('/api/interface/up_cat_index', changes).then();
      this.props.fetchInterfaceListMenu(this.props.projectId);
    }
  };
  // 数据过滤
  filterList = (list: MenuCategory[]) => {
    let that = this;
    let arr: string[] = [];
    let menuList = produce(list, draftList => {
      draftList.filter((item: MenuCategory) => {
        let interfaceFilter = false;
        // arr = [];
        if (item.name.indexOf(that.state.filter) === -1) {
          item.list = item.list.filter((inter: MenuInterface) => {
            if (
              inter.title.indexOf(that.state.filter) === -1 &&
              inter.path.indexOf(that.state.filter) === -1
            ) {
              return false;
            }
            //arr.push('cat_' + inter.catid)
            interfaceFilter = true;
            return true;
          });
          arr.push('cat_' + item._id);
          return interfaceFilter as boolean;
        }
        arr.push('cat_' + item._id);
        return true;
      });
    });

    return { menuList, arr };
  };

  render() {
    const matchParams = this.props.match.params;
    // let menuList = this.state.list;
    const searchBox = (
      <div className="interface-filter">
        <Input onChange={this.onFilter} value={this.state.filter} placeholder="搜索接口" />
        <Button
          type="primary"
          onClick={() => this.changeModal('add_cat_modal_visible', true)}
          className="btn-filter"
        >
          添加分类
        </Button>
        {this.state.visible ? (
          <Modal
            title="添加接口"
            open={this.state.visible}
            onCancel={() => this.changeModal('visible', false)}
            footer={null}
            className="addcatmodal"
          >
            <AddInterfaceForm
              catdata={this.props.curProject.cat}
              catid={this.state.curCatid ?? undefined}
              onCancel={() => this.changeModal('visible', false)}
              onSubmit={this.handleAddInterface}
            />
          </Modal>
        ) : (
          ''
        )}

        {this.state.add_cat_modal_visible ? (
          <Modal
            title="添加分类"
            open={this.state.add_cat_modal_visible}
            onCancel={() => this.changeModal('add_cat_modal_visible', false)}
            footer={null}
            className="addcatmodal"
          >
            <AddInterfaceCatForm
              onCancel={() => this.changeModal('add_cat_modal_visible', false)}
              onSubmit={this.handleAddInterfaceCat}
            />
          </Modal>
        ) : (
          ''
        )}

        {this.state.change_cat_modal_visible ? (
          <Modal
            title="修改分类"
            open={this.state.change_cat_modal_visible}
            onCancel={() => this.changeModal('change_cat_modal_visible', false)}
            footer={null}
            className="addcatmodal"
          >
            <AddInterfaceCatForm
              catdata={this.state.curCatdata}
              onCancel={() => this.changeModal('change_cat_modal_visible', false)}
              onSubmit={this.handleChangeInterfaceCat}
            />
          </Modal>
        ) : (
          ''
        )}
      </div>
    );
    const defaultExpandedKeys = () => {
      const { router, inter, list } = this.props,
        rNull = { expands: [], selects: [] };
      if (list.length === 0) {
        return rNull;
      }
      if (router) {
        if (!isNaN(Number(router.params.actionId))) {
          if (!inter || !inter._id) {
            return rNull;
          }
          return {
            expands: this.currentCatExpandedKeys(),
            selects: [inter._id + '']
          };
        } else {
          let catid = router.params.actionId.substr(4);
          return {
            expands: this.currentCatExpandedKeys(),
            selects: ['cat_' + catid]
          };
        }
      } else {
        return {
          expands: this.currentCatExpandedKeys(),
          selects: ['root']
        };
      }
    };

    const itemInterfaceCreate = (item: MenuInterface) => {
      return {
        title:
            <div
              className="container-title"
              onMouseEnter={() => this.enterItem(item._id)}
              onMouseLeave={this.leaveItem}
            >
              <Link
                className="interface-item"
                onClick={e => e.stopPropagation()}
                to={'/project/' + matchParams.id + '/interface/api/' + item._id}
              >
                {item.title}
              </Link>
              <div className="btns">
                <Tooltip title="删除接口">
                  <Icon
                    type="delete"
                    className="interface-delete-icon"
                    onClick={e => {
                      e.stopPropagation();
                      this.showConfirm(item);
                    }}
                    style={{ display: this.state.delIcon == item._id ? 'block' : 'none' }}
                  />
                </Tooltip>
                <Tooltip title="复制接口">
                  <Icon
                    type="copy"
                    className="interface-delete-icon"
                    onClick={e => {
                      e.stopPropagation();
                      this.copyInterface(item._id);
                    }}
                    style={{ display: this.state.delIcon == item._id ? 'block' : 'none' }}
                  />
                </Tooltip>
              </div>
              {/*<Dropdown overlay={menu(item)} trigger={['click']} onClick={e => e.stopPropagation()}>
            <Icon type='ellipsis' className="interface-delete-icon" style={{ opacity: this.state.delIcon == item._id ? 1 : 0 }}/>
          </Dropdown>*/}
            </div>,
        key: '' + item._id
      };
    };

    let currentKes = defaultExpandedKeys();
    let menuList;
    if (this.state.filter) {
      let res = this.filterList(this.state.list);
      menuList = res.menuList;
      currentKes.expands = res.arr;
    } else {
      menuList = this.state.list;
    }

    const treeData = [
      {
        className: 'item-all-interface',
        title: (
          <Link
            onClick={e => {
              e.stopPropagation();
              this.changeExpands();
            }}
            to={'/project/' + matchParams.id + '/interface/api'}
          >
            <Icon type="folder" style={{ marginRight: 5 }} />
            全部接口
          </Link>
        ),
        key: 'root'
      },
      ...menuList.map(item => ({
        title: (
          <div
            className="container-title"
            onMouseEnter={() => this.enterItem(item._id)}
            onMouseLeave={this.leaveItem}
          >
            <Link
              className="interface-item"
              onClick={e => {
                e.stopPropagation();
                this.toggleCatExpanded('cat_' + item._id);
              }}
              to={'/project/' + matchParams.id + '/interface/api/cat_' + item._id}
            >
              <Icon type="folder-open" style={{ marginRight: 5 }} />
              {item.name}
            </Link>
            <div className="btns">
              <Tooltip title="删除分类">
                <Icon
                  type="delete"
                  className="interface-delete-icon"
                  onClick={e => {
                    e.stopPropagation();
                    this.showDelCatConfirm(item._id);
                  }}
                  style={{ display: this.state.delIcon == item._id ? 'block' : 'none' }}
                />
              </Tooltip>
              <Tooltip title="修改分类">
                <Icon
                  type="edit"
                  className="interface-delete-icon"
                  style={{ display: this.state.delIcon == item._id ? 'block' : 'none' }}
                  onClick={e => {
                    e.stopPropagation();
                    this.changeModal('change_cat_modal_visible', true);
                    this.setState({
                      curCatdata: item
                    });
                  }}
                />
              </Tooltip>
              <Tooltip title="添加接口">
                <Icon
                  type="plus"
                  className="interface-delete-icon"
                  style={{ display: this.state.delIcon == item._id ? 'block' : 'none' }}
                  onClick={e => {
                    e.stopPropagation();
                    this.changeModal('visible', true);
                    this.setState({
                      curCatid: Number(item._id)
                    });
                  }}
                />
              </Tooltip>
            </div>
          </div>
        ),
        key: 'cat_' + item._id,
        className: `interface-item-nav ${item.list.length ? '' : 'cat_switch_hidden'}`,
        children: item.list.map(itemInterfaceCreate)
      }))
    ];

    return (
      <div>
        {searchBox}
        {menuList.length > 0 ? (
          <div
            className="tree-wrappper"
            style={{ maxHeight: document.body.clientHeight - headHeight + 'px' }}
          >
            <Tree
              className="interface-list"
              defaultExpandedKeys={currentKes.expands}
              defaultSelectedKeys={currentKes.selects}
              expandedKeys={currentKes.expands}
              selectedKeys={currentKes.selects}
              onSelect={this.onSelect}
              onExpand={this.onExpand}
              draggable
              onDrop={this.onDrop as unknown as NonNullable<React.ComponentProps<typeof Tree>['onDrop']>}
              treeData={treeData}
            />
          </div>
        ) : null}
      </div>
    );
  }
}

export default withRouter(InterfaceMenu as unknown as ComponentType<InterfaceMenuProps>);
