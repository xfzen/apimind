import React, { PureComponent as Component } from 'react';
import type { ComponentType, ChangeEvent, Key } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import PropTypes from 'prop-types';
import { fetchInterfaceColList, setColData, fetchCaseList, fetchCaseData } from '../../../../reducer/modules/interfaceCol';
import { fetchProjectList } from '../../../../reducer/modules/project';
import axios from 'axios';
import ImportInterface from './ImportInterface';
import { Input, Button, Modal, message, Tooltip, Tree, Form } from 'antd';
import Icon from 'client/shims/antdIcon';
import { arrayChangeIndex } from '../../../../common';
import _ from 'underscore'
import type { FormInstance } from 'antd';
import type { RouteComponentProps } from 'react-router';
import type { ApiResponse } from '../../../../types/api';
import type { RootState } from '../../../../reducer/modules/reducer';
import type { UnknownRecord } from '../../../../reducer/types/runtime';
import type { InterfaceCollection } from '../../../../reducer/modules/interfaceCol';
import { asLegacyClassDecorator } from '../../../../types/legacyDecorators';

const FormItem = Form.Item;
const confirm = Modal.confirm;
const headHeight = 240; // menu顶部到网页顶部部分的高度

import './InterfaceColMenu.scss';

interface ColFormValues { colName?: string; colDesc?: string }
interface ColModalProps { visible: boolean; onCancel: () => void; onCreate: () => void; title?: string; type?: string }
const ColModalForm = React.forwardRef<FormInstance<ColFormValues>, ColModalProps>((props, ref) => {
  const { visible, onCancel, onCreate, title } = props;
  const [form] = Form.useForm();
  React.useImperativeHandle(ref, () => form);
  return (
    <Modal open={visible} title={title} onCancel={onCancel} onOk={onCreate}>
      <Form form={form} layout="vertical">
        <FormItem label="集合名" name="colName" rules={[{ required: true, message: '请输入集合命名！' }]}>
          <Input />
        </FormItem>
        <FormItem label="简介" name="colDesc">
          <Input type="textarea" />
        </FormItem>
      </Form>
    </Modal>
  );
});

interface InterfaceCase extends UnknownRecord { _id: number; col_id?: number; project_id?: number; casename: string; path: string }
interface Collection extends UnknownRecord {
  _id: number; name: string; uid: number; project_id: number; desc: string; add_time: number; up_time: number;
  caseList: InterfaceCase[];
}
interface CaseData extends UnknownRecord { _id?: number; col_id?: number; project_id?: number; casename?: string }
interface MenuProject extends UnknownRecord { group_id: string | number }
interface ActionResult<T> { payload: { data: ApiResponse<T> } }
interface ColRouteParams { id: string; action?: string; actionId?: string }
interface InterfaceColMenuProps extends RouteComponentProps<ColRouteParams> {
  interfaceColList: Collection[]; currCase: CaseData; isRander?: boolean; currCaseId: number;
  curProject: MenuProject; router?: { params: ColRouteParams };
  fetchInterfaceColList: (id: string | number) => Promise<ActionResult<Collection[]>>;
  fetchCaseData: (id: string | number) => Promise<ActionResult<CaseData>>;
  fetchCaseList: (...args: unknown[]) => Promise<unknown>;
  setColData: (data: UnknownRecord) => unknown;
  fetchProjectList: (...args: unknown[]) => Promise<unknown>;
}
interface InterfaceColMenuState {
  colModalType: string; colModalVisible: boolean; editColId: number; filterValue: string;
  importInterVisible: boolean; importInterIds: Key[]; importColId: number; expands: Key[] | null;
  list: Collection[]; delIcon: Key | null; selectedProject: string | null;
  visible: boolean;
}
interface LegacyTreeNode { props: { pos: string; eventKey: string } }
interface LegacyDropEvent { node: LegacyTreeNode; dragNode: LegacyTreeNode }
const connectInterfaceColMenu = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      interfaceColList: state.interfaceCol.interfaceColList,
      currCase: state.interfaceCol.currCase,
      isRander: state.interfaceCol.isRender,
      currCaseId: state.interfaceCol.currCaseId,
      // list: state.inter.list,
      // 当前项目的信息
      curProject: state.project.currProject
      // projectList: state.project.projectList
    };
  },
  {
    fetchInterfaceColList,
    fetchCaseData,
    // fetchInterfaceListMenu,
    fetchCaseList,
    setColData,
    fetchProjectList
  }
));
const routeInterfaceColMenu = asLegacyClassDecorator(withRouter);
@connectInterfaceColMenu
@routeInterfaceColMenu
class InterfaceColMenu extends Component<InterfaceColMenuProps, InterfaceColMenuState> {
  form: FormInstance<ColFormValues> | null = null;
  _copyInterfaceSign = false;
  static propTypes = {
    match: PropTypes.object,
    interfaceColList: PropTypes.array,
    fetchInterfaceColList: PropTypes.func,
    
    // fetchInterfaceListMenu: PropTypes.func,
    fetchCaseList: PropTypes.func,
    fetchCaseData: PropTypes.func,
    setColData: PropTypes.func,
    currCaseId: PropTypes.number,
    history: PropTypes.object,
    isRander: PropTypes.bool,
    // list: PropTypes.array,
    router: PropTypes.object,
    currCase: PropTypes.object,
    curProject: PropTypes.object,
    fetchProjectList: PropTypes.func
    // projectList: PropTypes.array
  };

  state: InterfaceColMenuState = {
    colModalType: '',
    colModalVisible: false,
    editColId: 0,
    filterValue: '',
    importInterVisible: false,
    importInterIds: [],
    importColId: 0,
    expands: null,
    list: [],
    delIcon: null,
    selectedProject: null
    ,visible: false
  };

  constructor(props: InterfaceColMenuProps) {
    super(props);
  }

  componentWillMount() {
    this.getList();
  }

  componentWillReceiveProps(nextProps: InterfaceColMenuProps) {
    if (this.props.interfaceColList !== nextProps.interfaceColList) {
      this.setState({
        list: nextProps.interfaceColList
      });
    }
  }

  async getList() {
    let r = await this.props.fetchInterfaceColList(this.props.match.params.id);
    this.setState({
      list: r.payload.data.data || []
    });
    return r;
  }

  addorEditCol = async () => {
    const { colName: name, colDesc: desc } = this.form?.getFieldsValue() || {};
    const { colModalType, editColId: col_id } = this.state;
    const project_id = this.props.match.params.id;
    let res;
    if (colModalType === 'add') {
      res = await axios.post('/api/col/add_col', { name, desc, project_id });
    } else if (colModalType === 'edit') {
      res = await axios.post('/api/col/up_col', { name, desc, col_id });
    }
    if (res && !res.data.errcode) {
      this.setState({
        colModalVisible: false
      });
      message.success(colModalType === 'edit' ? '修改集合成功' : '添加集合成功');
      // await this.props.fetchInterfaceColList(project_id);
      this.getList();
    } else if (res) {
      message.error(res.data.errmsg);
    }
  };

  onExpand = (keys: Key[]) => {
    this.setState({ expands: keys });
  };

  onSelect = _.debounce((keys: Key[]) => {
    if (keys.length) {
      const type = String(keys[0]).split('_')[0];
      const id = String(keys[0]).split('_')[1];
      const project_id = this.props.match.params.id;
      if (type === 'col') {
        this.props.setColData({
          isRander: false
        });
        this.props.history.push('/project/' + project_id + '/interface/col/' + id);
      } else {
        this.props.setColData({
          isRander: false
        });
        this.props.history.push('/project/' + project_id + '/interface/case/' + id);
      }
    }
    this.setState({
      expands: null
    });
  }, 500);

  showDelColConfirm = (colId: string | number) => {
    let that = this;
    const params = this.props.match.params;
    confirm({
      title: '您确认删除此测试集合',
      content: '温馨提示：该操作会删除该集合下所有测试用例，用例删除后无法恢复',
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        const res = await axios.get('/api/col/del_col?col_id=' + colId);
        if (!res.data.errcode) {
          message.success('删除集合成功');
          const result = await that.getList();
          const nextColId = result.payload.data.data?.[0]._id;

          that.props.history.push('/project/' + params.id + '/interface/col/' + nextColId);
        } else {
          message.error(res.data.errmsg);
        }
      }
    });
  };

  // 复制测试集合
  copyInterface = async (item: Collection) => {
    if (this._copyInterfaceSign === true) {
      return;
    }
    this._copyInterfaceSign = true;
    const { desc, project_id, _id: col_id } = item;
    let { name } = item;
    name = `${name} copy`;

    // 添加集合
    const add_col_res = await axios.post('/api/col/add_col', { name, desc, project_id });

    if (add_col_res.data.errcode) {
      message.error(add_col_res.data.errmsg);
      return;
    }

    const new_col_id = add_col_res.data.data._id;

    // 克隆集合
    const add_case_list_res = await axios.post('/api/col/clone_case_list', {
      new_col_id,
      col_id,
      project_id
    });
    this._copyInterfaceSign = false;

    if (add_case_list_res.data.errcode) {
      message.error(add_case_list_res.data.errmsg);
      return;
    }

    // 刷新接口列表
    // await this.props.fetchInterfaceColList(project_id);
    this.getList();
    this.props.setColData({ isRander: true });
    message.success('克隆测试集成功');
  };

  showNoDelColConfirm = () => {
    confirm({
      title: '此测试集合为最后一个集合',
      content: '温馨提示：建议不要删除'
    });
  };
  caseCopy = async (caseId: string | number) => {
    let that = this;
    let caseData = await that.props.fetchCaseData(caseId);
    let data = caseData.payload.data.data;
    if (!data) return;
    const cloned = JSON.parse(JSON.stringify(data)) as CaseData;
    cloned.casename = `${cloned.casename}_copy`;
    delete cloned._id;
    const res = await axios.post('/api/col/add_case', cloned);
    if (!res.data.errcode) {
      message.success('克隆用例成功');
      let colId = res.data.data.col_id;
      let projectId = res.data.data.project_id;
      await this.getList();
      this.props.history.push('/project/' + projectId + '/interface/col/' + colId);
      this.setState({
        visible: false
      });
    } else {
      message.error(res.data.errmsg);
    }
  };
  showDelCaseConfirm = (caseId: string | number) => {
    let that = this;
    const params = this.props.match.params;
    confirm({
      title: '您确认删除此测试用例',
      content: '温馨提示：用例删除后无法恢复',
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        const res = await axios.get('/api/col/del_case?caseid=' + caseId);
        if (!res.data.errcode) {
          message.success('删除用例成功');
          that.getList();
          // 如果删除当前选中 case，切换路由到集合
          if (+caseId === +that.props.currCaseId) {
            that.props.history.push('/project/' + params.id + '/interface/col/');
          } else {
            // that.props.fetchInterfaceColList(that.props.match.params.id);
            that.props.setColData({ isRander: true });
          }
        } else {
          message.error(res.data.errmsg);
        }
      }
    });
  };
  showColModal = (type: string, col?: Collection) => {
    const editCol =
      type === 'edit' && col ? { colName: col.name, colDesc: col.desc } : { colName: '', colDesc: '' };
    this.setState({
      colModalVisible: true,
      colModalType: type || 'add',
      editColId: col ? col._id : 0
    });
    this.form?.setFieldsValue(editCol);
  };
  saveFormRef = (form: FormInstance<ColFormValues> | null) => {
    this.form = form;
  };

  selectInterface = (importInterIds: Key[], selectedProject: string) => {
    this.setState({ importInterIds, selectedProject });
  };

  showImportInterfaceModal = async (colId: number) => {
    // const projectId = this.props.match.params.id;
    // console.log('project', this.props.curProject)
    const groupId = this.props.curProject.group_id;
    await this.props.fetchProjectList(groupId);
    // await this.props.fetchInterfaceListMenu(projectId)
    this.setState({ importInterVisible: true, importColId: colId });
  };

  handleImportOk = async () => {
    const project_id = this.state.selectedProject || this.props.match.params.id;
    const { importColId, importInterIds } = this.state;
    const res = await axios.post('/api/col/add_case_list', {
      interface_list: importInterIds,
      col_id: importColId,
      project_id
    });
    if (!res.data.errcode) {
      this.setState({ importInterVisible: false });
      message.success('导入集合成功');
      // await this.props.fetchInterfaceColList(project_id);
      this.getList();

      this.props.setColData({ isRander: true });
    } else {
      message.error(res.data.errmsg);
    }
  };
  handleImportCancel = () => {
    this.setState({ importInterVisible: false });
  };

  filterCol = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // console.log('list', this.props.interfaceColList);
    // const newList = produce(this.props.interfaceColList, draftList => {})
    // console.log('newList',newList);
    this.setState({
      filterValue: value,
      list: JSON.parse(JSON.stringify(this.props.interfaceColList))
      // list: newList
    });
  };

  onDrop = async (e: LegacyDropEvent) => {
    // const projectId = this.props.match.params.id;
    const { interfaceColList } = this.props;
    const dropColIndex = Number(e.node.props.pos.split('-')[1]);
    const dropColId = interfaceColList[dropColIndex]._id;
    const id = e.dragNode.props.eventKey;
    const dragColIndex = Number(e.dragNode.props.pos.split('-')[1]);
    const dragColId = interfaceColList[dragColIndex]._id;

    const dropPos = e.node.props.pos.split('-');
    const dropIndex = Number(dropPos[dropPos.length - 1]);
    const dragPos = e.dragNode.props.pos.split('-');
    const dragIndex = Number(dragPos[dragPos.length - 1]);

    if (id.indexOf('col') === -1) {
      if (dropColId === dragColId) {
        // 同一个测试集合下的接口交换顺序
        let caseList = interfaceColList[dropColIndex].caseList;
        let changes = arrayChangeIndex(caseList, dragIndex, dropIndex);
        axios.post('/api/col/up_case_index', changes).then();
      }
      await axios.post('/api/col/up_case', { id: id.split('_')[1], col_id: dropColId });
      // this.props.fetchInterfaceColList(projectId);
      this.getList();
      this.props.setColData({ isRander: true });
    } else {
      let changes = arrayChangeIndex(interfaceColList, dragIndex, dropIndex);
      axios.post('/api/col/up_col_index', changes).then();
      this.getList();
    }
  };

  enterItem = (id: Key) => {
    this.setState({ delIcon: id });
  };

  leaveItem = () => {
    this.setState({ delIcon: null });
  };

  render() {
    // const { currColId, currCaseId, isShowCol } = this.props;
    const { colModalType, colModalVisible, importInterVisible } = this.state;
    const currProjectId = this.props.match.params.id;
    // const menu = (col) => {
    //   return (
    //     <Menu>
    //       <Menu.Item>
    //         <span onClick={() => this.showColModal('edit', col)}>修改集合</span>
    //       </Menu.Item>
    //       <Menu.Item>
    //         <span onClick={() => {
    //           this.showDelColConfirm(col._id)
    //         }}>删除集合</span>
    //       </Menu.Item>
    //       <Menu.Item>
    //         <span onClick={() => this.showImportInterface(col._id)}>导入接口</span>
    //       </Menu.Item>
    //     </Menu>
    //   )
    // };

    const defaultExpandedKeys = () => {
      const { router, currCase, interfaceColList } = this.props,
        rNull = { expands: [], selects: [] };
      if (interfaceColList.length === 0) {
        return rNull;
      }
      if (router) {
        if (router.params.action === 'case') {
          if (!currCase || !currCase._id) {
            return rNull;
          }
          return {
            expands: this.state.expands ? this.state.expands : ['col_' + currCase.col_id],
            selects: ['case_' + currCase._id + '']
          };
        } else {
          let col_id = router.params.actionId;
          return {
            expands: this.state.expands ? this.state.expands : ['col_' + col_id],
            selects: ['col_' + col_id]
          };
        }
      } else {
        return {
          expands: this.state.expands ? this.state.expands : ['col_' + interfaceColList[0]._id],
          selects: ['col_' + interfaceColList[0]._id]
        };
      }
    };

    const itemInterfaceColCreate = (interfaceCase: InterfaceCase) => {
      return {
        style: { width: '100%' },
        key: 'case_' + interfaceCase._id,
        title:
            <div
              className="menu-title"
              onMouseEnter={() => this.enterItem(interfaceCase._id)}
              onMouseLeave={this.leaveItem}
              title={interfaceCase.casename}
            >
              <span className="casename">{interfaceCase.casename}</span>
              <div className="btns">
                <Tooltip title="删除用例">
                  <Icon
                    type="delete"
                    className="interface-delete-icon"
                    onClick={e => {
                      e.stopPropagation();
                      this.showDelCaseConfirm(interfaceCase._id);
                    }}
                    style={{ display: this.state.delIcon == interfaceCase._id ? 'block' : 'none' }}
                  />
                </Tooltip>
                <Tooltip title="克隆用例">
                  <Icon
                    type="copy"
                    className="interface-delete-icon"
                    onClick={e => {
                      e.stopPropagation();
                      this.caseCopy(interfaceCase._id);
                    }}
                    style={{ display: this.state.delIcon == interfaceCase._id ? 'block' : 'none' }}
                  />
                </Tooltip>
              </div>
            </div>
      };
    };

    let currentKes = defaultExpandedKeys();
    // console.log('currentKey', currentKes)

    let list = this.state.list;

    if (this.state.filterValue) {
      let arr: string[] = [];
      list = list.filter((item: Collection) => {

        item.caseList = item.caseList.filter((inter: InterfaceCase) => {
          if (inter.casename.indexOf(this.state.filterValue) === -1 
          && inter.path.indexOf(this.state.filterValue) === -1
          ) {
            return false;
          }
          return true;
        });

        arr.push('col_' + item._id);
        return true;
      });
      // console.log('arr', arr);
      if (arr.length > 0) {
        currentKes.expands = arr;
      }
    }

    // console.log('list', list);
    // console.log('currentKey', currentKes)

    const treeData = list.map((col: Collection) => ({
      key: 'col_' + col._id,
      title: (
        <div className="menu-title">
          <span>
            <Icon type="folder-open" style={{ marginRight: 5 }} />
            <span>{col.name}</span>
          </span>
          <div className="btns">
            <Tooltip title="删除集合">
              <Icon
                type="delete"
                style={{ display: list.length > 1 ? '' : 'none' }}
                className="interface-delete-icon"
                onClick={() => {
                  this.showDelColConfirm(col._id);
                }}
              />
            </Tooltip>
            <Tooltip title="编辑集合">
              <Icon
                type="edit"
                className="interface-delete-icon"
                onClick={e => {
                  e.stopPropagation();
                  this.showColModal('edit', col);
                }}
              />
            </Tooltip>
            <Tooltip title="导入接口">
              <Icon
                type="plus"
                className="interface-delete-icon"
                onClick={e => {
                  e.stopPropagation();
                  this.showImportInterfaceModal(col._id);
                }}
              />
            </Tooltip>
            <Tooltip title="克隆集合">
              <Icon
                type="copy"
                className="interface-delete-icon"
                onClick={e => {
                  e.stopPropagation();
                  this.copyInterface(col);
                }}
              />
            </Tooltip>
          </div>
        </div>
      ),
      children: col.caseList.map(itemInterfaceColCreate)
    }));

    return (
      <div>
        <div className="interface-filter">
          <Input placeholder="搜索测试集合" onChange={this.filterCol} />
          <Tooltip placement="bottom" title="添加集合">
            <Button
              type="primary"
              style={{ marginLeft: '16px' }}
              onClick={() => this.showColModal('add')}
              className="btn-filter"
            >
              添加集合
            </Button>
          </Tooltip>
        </div>
        <div className="tree-wrapper" style={{ maxHeight: document.body.clientHeight - headHeight + 'px'}}>
          <Tree
            className="col-list-tree"
            defaultExpandedKeys={currentKes.expands}
            defaultSelectedKeys={currentKes.selects}
            expandedKeys={currentKes.expands}
            selectedKeys={currentKes.selects}
            onSelect={this.onSelect}
            autoExpandParent
            draggable
            onExpand={this.onExpand}
            onDrop={this.onDrop as unknown as NonNullable<React.ComponentProps<typeof Tree>['onDrop']>}
            treeData={treeData}
          />
        </div>
        <ColModalForm
          ref={this.saveFormRef}
          type={colModalType}
          visible={colModalVisible}
          onCancel={() => {
            this.setState({ colModalVisible: false });
          }}
          onCreate={this.addorEditCol}
        />

        <Modal
          title="导入接口到集合"
          open={importInterVisible}
          onOk={this.handleImportOk}
          onCancel={this.handleImportCancel}
          className="import-case-modal"
          width={800}
        >
          <ImportInterface currProjectId={currProjectId} selectInterface={this.selectInterface} />
        </Modal>
      </div>
    );
  }
}

export default InterfaceColMenu as unknown as ComponentType<RouteComponentProps<ColRouteParams>>;
