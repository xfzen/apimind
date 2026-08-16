import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import InterfaceEditForm from './InterfaceEditForm';
import {
  updateInterfaceData,
  fetchInterfaceListMenu,
  fetchInterfaceData
} from '../../../../reducer/modules/interface';
import { getProject } from '../../../../reducer/modules/project';
import axios from 'axios';
import { buildMockUrl, buildWsUrl } from '../../../../utils/backend';
import { message, Modal } from 'antd';
import './Edit.scss';
import { withRouter, Link } from 'react-router-dom';
import ProjectTag, { type ProjectTagItem } from '../../Setting/ProjectMessage/ProjectTag';
import type { RouteComponentProps } from 'react-router-dom';
import type { RootState } from '../../../../reducer/modules/reducer';
import type { UnknownRecord } from '../../../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../../../types/legacyDecorators';
import { createInterfaceUpdateRequest, createProjectTagUpdateRequest } from './requestContracts';

interface EditRouteParams { actionId: string }
interface EditableInterface extends UnknownRecord { path?: string; uid?: string | number; username?: string }
interface EditProject extends UnknownRecord {
  _id: string | number;
  basepath?: string;
  cat?: Array<UnknownRecord & { _id: string | number; name: string }>;
  switch_notice?: boolean;
  tag?: ProjectTagItem[];
}
interface InterfaceEditProps extends RouteComponentProps<EditRouteParams> {
  curdata: EditableInterface;
  currProject: EditProject;
  updateInterfaceData: (data: UnknownRecord) => unknown;
  fetchInterfaceListMenu: (id: string | number) => Promise<unknown>;
  fetchInterfaceData: (id: string | number) => Promise<unknown>;
  switchToView: () => void;
  getProject: (id: string | number) => Promise<unknown>;
}
interface InterfaceEditState { mockUrl: string; curdata: EditableInterface; status: number; visible: boolean }
const connectInterfaceEdit = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      curdata: state.inter.curdata,
      currProject: state.project.currProject
    };
  },
  {
    updateInterfaceData,
    fetchInterfaceListMenu,
    fetchInterfaceData,
    getProject
  }
));
@connectInterfaceEdit
class InterfaceEdit extends Component<InterfaceEditProps, InterfaceEditState> {
  WebSocket?: WebSocket;
  tag: ProjectTag | null = null;
  static propTypes = {
    curdata: PropTypes.object,
    currProject: PropTypes.object,
    updateInterfaceData: PropTypes.func,
    fetchInterfaceListMenu: PropTypes.func,
    fetchInterfaceData: PropTypes.func,
    match: PropTypes.object,
    switchToView: PropTypes.func,
    getProject: PropTypes.func
  };

  constructor(props: InterfaceEditProps) {
    super(props);
    const { curdata, currProject } = this.props;
    this.state = {
      mockUrl: buildMockUrl(currProject._id, currProject.basepath, curdata.path),
      curdata: {},
      status: 0,
      visible: false
      // tag: []
    };
  }

  onSubmit = async (params: UnknownRecord) => {
    const request = createInterfaceUpdateRequest(params, this.props.match.params.actionId);
    let result = await axios.post(request.url, request.body);
    this.props.fetchInterfaceListMenu(this.props.currProject._id).then();
    this.props.fetchInterfaceData(request.body.id as string | number).then();
    if (result.data.errcode === 0) {
      this.props.updateInterfaceData(request.body);
      message.success('保存成功');
    } else {
      message.error(result.data.errmsg);
    }
  };

  componentWillUnmount() {
    try {
      if (this.state.status === 1) {
        this.WebSocket?.close();
      }
    } catch (e) {
      return;
    }
  }

  componentDidMount() {
    // compute websocket url based on backend origin (supports cross-origin)
    let s: WebSocket,
      initData = false;

    setTimeout(() => {
      if (initData === false) {
        this.setState({
          curdata: this.props.curdata,
          status: 1
        });
        initData = true;
      }
    }, 3000);

    try {
      s = new WebSocket(
        buildWsUrl('/api/interface/solve_conflict?id=' + this.props.match.params.actionId)
      );
      s.onopen = () => {
        this.WebSocket = s;
      };

      s.onmessage = e => {
        initData = true;
        let result = JSON.parse(String(e.data)) as { errno: number; data: EditableInterface };
        if (result.errno === 0) {
          this.setState({
            curdata: result.data,
            status: 1
          });
        } else {
          this.setState({
            curdata: result.data,
            status: 2
          });
        }
      };

      s.onerror = () => {
        this.setState({
          curdata: this.props.curdata,
          status: 1
        });
        console.warn('websocket 连接失败，将导致多人编辑同一个接口冲突。');
      };
    } catch (e) {
      this.setState({
        curdata: this.props.curdata,
        status: 1
      });
      console.error('websocket 连接失败，将导致多人编辑同一个接口冲突。');
    }
  }

  onTagClick = () => {
    this.setState({
      visible: true
    });
  };

  handleOk = async () => {
    let tag = (this.tag?.state.tag || []).filter((val: ProjectTagItem) => {
      return val.name !== '';
    });

    let id = this.props.currProject._id;
    const request = createProjectTagUpdateRequest(id, tag);
    let result = await axios.post(request.url, request.body);

    if (result.data.errcode === 0) {
      await this.props.getProject(id);
      message.success('保存成功');
    } else {
      message.error(result.data.errmsg);
    }

    this.setState({
      visible: false
    });
  };

  handleCancel = () => {
    this.setState({
      visible: false
    });
  };

  tagSubmit = (tagRef: ProjectTag | null) => {
    this.tag = tagRef;

    // this.setState({tag})
  };

  render() {
    const { cat, basepath, switch_notice, tag } = this.props.currProject;
    return (
      <div className="interface-edit">
        {this.state.status === 1 ? (
          <InterfaceEditForm
            cat={cat || []}
            mockUrl={this.state.mockUrl}
            basepath={basepath || ''}
            noticed={switch_notice}
            onSubmit={this.onSubmit}
            curdata={this.state.curdata}
            onTagClick={this.onTagClick}
          />
        ) : null}
        {this.state.status === 2 ? (
          <div style={{ textAlign: 'center', fontSize: '14px', paddingTop: '10px' }}>
            <Link to={'/user/profile/' + this.state.curdata.uid}>
              <b>{this.state.curdata.username}</b>
            </Link>
            <span>正在编辑该接口，请稍后再试...</span>
          </div>
        ) : null}
        {this.state.status === 0 && '正在加载，请耐心等待...'}

        <Modal
          title="Tag 设置"
          width={680}
          open={this.state.visible}
          onOk={this.handleOk}
          onCancel={this.handleCancel}
          okText="保存"
        >
          <div className="tag-modal-center">
            <ProjectTag tagMsg={tag} ref={this.tagSubmit} />
          </div>
        </Modal>
      </div>
    );
  }
}

export default withRouter(InterfaceEdit as unknown as ComponentType<InterfaceEditProps>);
