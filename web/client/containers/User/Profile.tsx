import React, { PureComponent as Component } from 'react';
import type { ChangeEvent, ComponentType, ReactNode } from 'react';
import { Row, Col, Input, Button, Select, message, Upload, Tooltip } from 'antd';
import type { UploadChangeParam, UploadFile } from 'antd/es/upload/interface';
import type { RcFile } from 'antd/es/upload';
import axios from 'axios';
import { formatTime } from '../../common';
import PropTypes from 'prop-types';
import { setBreadcrumb, setImageUrl } from '../../reducer/modules/user';
import { connect } from 'react-redux';
import { buildApiUrl } from '../../utils/backend';
import Icon from 'client/shims/antdIcon';
import type { RouteComponentProps } from 'react-router';
import type { ApiResponse } from '../../types/api';
import type { BreadcrumbItem, UserInfo } from '../../types/user';
import type { RootState } from '../../reducer/modules/reducer';
import type { UnknownRecord } from '../../reducer/types/runtime';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

interface EditButtonProps {
  isAdmin: boolean;
  isOwner: boolean;
  onClick: (name: EditKey, value: boolean) => void;
  name: EditKey;
  admin?: boolean;
  userType?: boolean;
}
const EditButton = (props: EditButtonProps) => {
  const { isAdmin, isOwner, onClick, name, admin } = props;
  if (isOwner) {
    // 本人
    if (admin) {
      return null;
    }
    return (
      <Button
        icon={<Icon type="edit" />}
        onClick={() => {
          onClick(name, true);
        }}
      >
        修改
      </Button>
    );
  } else if (isAdmin) {
    // 管理员
    return (
      <Button
        icon={<Icon type="edit" />}
        onClick={() => {
          onClick(name, true);
        }}
      >
        修改
      </Button>
    );
  } else {
    return null;
  }
};
EditButton.propTypes = {
  isAdmin: PropTypes.bool,
  isOwner: PropTypes.bool,
  onClick: PropTypes.func,
  name: PropTypes.string,
  admin: PropTypes.bool
};

type EditKey = 'usernameEdit' | 'emailEdit' | 'secureEdit' | 'roleEdit';
type UserField = 'username' | 'email' | 'role';
type ProfileUser = Partial<UserInfo> & { uid?: number; role?: string; type?: string };
interface ProfileProps extends RouteComponentProps<{ uid?: string }> {
  curUid: number | null;
  userType: string | null;
  setBreadcrumb: (data: BreadcrumbItem[]) => unknown;
  curRole: string | null;
  upload?: boolean;
}
interface ProfileState {
  usernameEdit: boolean;
  emailEdit: boolean;
  secureEdit: boolean;
  roleEdit: boolean;
  userinfo: ProfileUser;
  _userinfo: ProfileUser;
}
const connectProfile = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      curUid: state.user.uid,
      userType: state.user.type,
      curRole: state.user.role
    };
  },
  {
    setBreadcrumb
  }
));
@connectProfile
class Profile extends Component<ProfileProps, ProfileState> {
  _uid: string | undefined;
  static propTypes = {
    match: PropTypes.object,
    curUid: PropTypes.number,
    userType: PropTypes.string,
    setBreadcrumb: PropTypes.func,
    curRole: PropTypes.string,
    upload: PropTypes.bool
  };

  constructor(props: ProfileProps) {
    super(props);
    this.state = {
      usernameEdit: false,
      emailEdit: false,
      secureEdit: false,
      roleEdit: false,
      userinfo: {},
      _userinfo: {}
    };
  }

  componentDidMount() {
    this._uid = this.props.match.params.uid;
    this.handleUserinfo(this.props);
  }

  componentWillReceiveProps(nextProps: ProfileProps) {
    if (!nextProps.match.params.uid) {
      return;
    }
    if (this._uid !== nextProps.match.params.uid) {
      this.handleUserinfo(nextProps);
    }
  }

  handleUserinfo(props: ProfileProps) {
    const uid = props.match.params.uid;
    if (uid) this.getUserInfo(uid);
  }

  handleEdit = (key: EditKey, val: boolean) => {
    this.setState({ [key]: val } as Pick<ProfileState, EditKey>);
  };

  getUserInfo = (id: string) => {
    var _this = this;
    const { curUid } = this.props;

    axios.get<ApiResponse<ProfileUser>>('/api/user/find?id=' + id).then(res => {
      const user = res.data.data || {};
      _this.setState({
        userinfo: user,
        _userinfo: user
      });
      if (curUid === +id) {
        this.props.setBreadcrumb([{ name: user.username || '' }]);
      } else {
        this.props.setBreadcrumb([{ name: '管理: ' + (user.username || '') }]);
      }
    });
  };

  updateUserinfo = (name: UserField) => {
    var state = this.state;
    let value = this.state._userinfo[name];
    const params: UnknownRecord = { uid: state.userinfo.uid };
    params[name] = value;

    axios.post<ApiResponse<null>>('/api/user/update', params).then(
      res => {
        let data = res.data;
        if (data.errcode === 0) {
          let userinfo = this.state.userinfo;
          userinfo[name] = value;
          this.setState({
            userinfo: userinfo
          });

          const editKey: Record<UserField, EditKey> = {
            username: 'usernameEdit',
            email: 'emailEdit',
            role: 'roleEdit'
          };
          this.handleEdit(editKey[name], false);
          message.success('更新用户信息成功');
        } else {
          message.error(data.errmsg);
        }
      },
      err => {
        message.error(err.message);
      }
    );
  };

  changeUserinfo = (e: ChangeEvent<HTMLInputElement>) => {
    let dom = e.target;
    let name = dom.getAttribute('name');
    let value = dom.value;
    if (!name) return;

    this.setState({
      _userinfo: {
        ...this.state._userinfo,
        [name]: value
      }
    });
  };

  changeRole = (val: string) => {
    let userinfo = this.state.userinfo;
    userinfo.role = val;
    this.setState({
      _userinfo: userinfo
    });
    this.updateUserinfo('role');
  };

  updatePassword = () => {
    const old_password = (document.getElementById('old_password') as HTMLInputElement | null)?.value || '';
    const password = (document.getElementById('password') as HTMLInputElement | null)?.value || '';
    const verify_pass = (document.getElementById('verify_pass') as HTMLInputElement | null)?.value || '';
    if (password != verify_pass) {
      return message.error('两次输入的密码不一样');
    }
    let params = {
      uid: this.state.userinfo.uid,
      password: password,
      old_password: old_password
    };

    axios.post<ApiResponse<null>>('/api/user/change_password', params).then(
      res => {
        let data = res.data;
        if (data.errcode === 0) {
          this.handleEdit('secureEdit', false);
          message.success('修改密码成功');
          if (this.props.curUid === this.state.userinfo.uid) {
            location.reload();
          }
        } else {
          message.error(data.errmsg);
        }
      },
      err => {
        message.error(err.message);
      }
    );
  };

  render() {
    let ButtonGroup = Button.Group;
    let userNameEditHtml, emailEditHtml, secureEditHtml, roleEditHtml;
    const Option = Select.Option;
    let userinfo = this.state.userinfo;
    let _userinfo = this.state._userinfo;
    const roles: Record<string, string> = { admin: '管理员', member: '会员' };
    let userType: boolean;
    if (this.props.userType === 'third') {
      userType = false;
    } else if (this.props.userType === 'site') {
      userType = true;
    } else {
      userType = false;
    }

    // 用户名信息修改
    if (this.state.usernameEdit === false) {
      userNameEditHtml = (
        <div>
          <span className="text">{userinfo.username}</span>&nbsp;&nbsp;
          {/*<span className="text-button"  onClick={() => { this.handleEdit('usernameEdit', true) }}><Icon type="edit" />修改</span>*/}
          {/* {btn} */}
          {/* 站点登陆才能编辑 */}
          {userType && (
            <EditButton
              userType={userType}
              isOwner={userinfo.uid === this.props.curUid}
              isAdmin={this.props.curRole === 'admin'}
              onClick={this.handleEdit}
              name="usernameEdit"
            />
          )}
        </div>
      );
    } else {
      userNameEditHtml = (
        <div>
          <Input
            value={_userinfo.username}
            name="username"
            onChange={this.changeUserinfo}
            placeholder="用户名"
          />
          <ButtonGroup className="edit-buttons">
            <Button
              className="edit-button"
              onClick={() => {
                this.handleEdit('usernameEdit', false);
              }}
            >
              取消
            </Button>
            <Button
              className="edit-button"
              onClick={() => {
                this.updateUserinfo('username');
              }}
              type="primary"
            >
              确定
            </Button>
          </ButtonGroup>
        </div>
      );
    }
    // 邮箱信息修改
    if (this.state.emailEdit === false) {
      emailEditHtml = (
        <div>
          <span className="text">{userinfo.email}</span>&nbsp;&nbsp;
          {/*<span className="text-button" onClick={() => { this.handleEdit('emailEdit', true) }} ><Icon type="edit" />修改</span>*/}
          {/* {btn} */}
          {/* 站点登陆才能编辑 */}
          {userType && (
            <EditButton
              admin={userinfo.role === 'admin'}
              isOwner={userinfo.uid === this.props.curUid}
              isAdmin={this.props.curRole === 'admin'}
              onClick={this.handleEdit}
              name="emailEdit"
            />
          )}
        </div>
      );
    } else {
      emailEditHtml = (
        <div>
          <Input
            placeholder="Email"
            value={_userinfo.email}
            name="email"
            onChange={this.changeUserinfo}
          />
          <ButtonGroup className="edit-buttons">
            <Button
              className="edit-button"
              onClick={() => {
                this.handleEdit('emailEdit', false);
              }}
            >
              取消
            </Button>
            <Button
              className="edit-button"
              type="primary"
              onClick={() => {
                this.updateUserinfo('email');
              }}
            >
              确定
            </Button>
          </ButtonGroup>
        </div>
      );
    }

    if (this.state.roleEdit === false) {
      roleEditHtml = (
        <div>
          <span className="text">{roles[userinfo.role || '']}</span>&nbsp;&nbsp;
        </div>
      );
    } else {
      roleEditHtml = (
        <Select defaultValue={_userinfo.role} onChange={this.changeRole} style={{ width: 150 }}>
          <Option value="admin">管理员</Option>
          <Option value="member">会员</Option>
        </Select>
      );
    }

    if (this.state.secureEdit === false) {
      let btn: ReactNode = '';
      if (userType) {
        btn = (
          <Button
            icon={<Icon type="edit" />}
            onClick={() => {
              this.handleEdit('secureEdit', true);
            }}
          >
            修改
          </Button>
        );
      }
      secureEditHtml = btn;
    } else {
      secureEditHtml = (
        <div>
          <Input
            style={{
              display: this.props.curRole === 'admin' && userinfo.role != 'admin' ? 'none' : ''
            }}
            placeholder="旧的密码"
            type="password"
            name="old_password"
            id="old_password"
          />
          <Input placeholder="新的密码" type="password" name="password" id="password" />
          <Input placeholder="确认密码" type="password" name="verify_pass" id="verify_pass" />
          <ButtonGroup className="edit-buttons">
            <Button
              className="edit-button"
              onClick={() => {
                this.handleEdit('secureEdit', false);
              }}
            >
              取消
            </Button>
            <Button className="edit-button" onClick={this.updatePassword} type="primary">
              确定
            </Button>
          </ButtonGroup>
        </div>
      );
    }
    return (
      <div className="user-profile">
        <div className="user-item-body">
          {userinfo.uid === this.props.curUid ? (
            <h3>个人设置</h3>
          ) : (
            <h3>{userinfo.username} 资料设置</h3>
          )}

          <Row className="avatarCon" type="flex" justify="start">
            <Col span={24}>
              {userinfo.uid === this.props.curUid ? (
                <AvatarUpload uid={userinfo.uid}>点击上传头像</AvatarUpload>
              ) : (
                <div className="avatarImg">
                  <img src={`/api/user/avatar?uid=${userinfo.uid}`} />
                </div>
              )}
            </Col>
          </Row>
          <Row className="user-item" type="flex" justify="start">
            <div className="maoboli" />
            <Col span={4}>用户id</Col>
            <Col span={12}>{userinfo.uid}</Col>
          </Row>
          <Row className="user-item" type="flex" justify="start">
            <div className="maoboli" />
            <Col span={4}>用户名</Col>
            <Col span={12}>{userNameEditHtml}</Col>
          </Row>
          <Row className="user-item" type="flex" justify="start">
            <div className="maoboli" />
            <Col span={4}>Email</Col>
            <Col span={12}>{emailEditHtml}</Col>
          </Row>
          <Row
            className="user-item"
            style={{ display: this.props.curRole === 'admin' ? '' : 'none' }}
            type="flex"
            justify="start"
          >
            <div className="maoboli" />
            <Col span={4}>角色</Col>
            <Col span={12}>{roleEditHtml}</Col>
          </Row>
          <Row
            className="user-item"
            style={{ display: this.props.curRole === 'admin' ? '' : 'none' }}
            type="flex"
            justify="start"
          >
            <div className="maoboli" />
            <Col span={4}>登陆方式</Col>
            <Col span={12}>{userinfo.type === 'site' ? '站点登陆' : '第三方登陆'}</Col>
          </Row>
          <Row className="user-item" type="flex" justify="start">
            <div className="maoboli" />
            <Col span={4}>创建账号时间</Col>
            <Col span={12}>{formatTime(Number(userinfo.add_time || 0))}</Col>
          </Row>
          <Row className="user-item" type="flex" justify="start">
            <div className="maoboli" />
            <Col span={4}>更新账号时间</Col>
            <Col span={12}>{formatTime(Number(userinfo.up_time || 0))}</Col>
          </Row>

          {userType ? (
            <Row className="user-item" type="flex" justify="start">
              <div className="maoboli" />
              <Col span={4}>密码</Col>
              <Col span={12}>{secureEditHtml}</Col>
            </Row>
          ) : (
            ''
          )}
        </div>
      </div>
    );
  }
}

interface AvatarUploadProps {
  uid?: number;
  url?: string;
  setImageUrl?: (url: string) => unknown;
  children?: ReactNode;
}
const connectAvatar = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      url: state.user.imageUrl
    };
  },
  {
    setImageUrl
  }
));
@connectAvatar
class AvatarUpload extends Component<AvatarUploadProps> {
  constructor(props: AvatarUploadProps) {
    super(props);
  }
  static propTypes = {
    uid: PropTypes.number,
    setImageUrl: PropTypes.func,
    url: PropTypes.string
  };
  uploadAvatar(basecode: string) {
    axios
      .post('/api/user/upload_avatar', { basecode: basecode })
      .then(() => {
        // this.setState({ imageUrl: basecode });
        this.props.setImageUrl?.(basecode);
      })
      .catch(e => {
        console.log(e);
      });
  }
  handleChange(info: UploadChangeParam<UploadFile>) {
    if (info.file.status === 'done') {
      // Get this url from response in real world.
      if (info.file.originFileObj) {
        getBase64(info.file.originFileObj, basecode => {
          this.uploadAvatar(basecode);
        });
      }
    }
  }
  render() {
    const { url } = this.props;
    let imageUrl = url ? url : buildApiUrl(`/api/user/avatar?uid=${this.props.uid}`);
    // let imageUrl = this.state.imageUrl ? this.state.imageUrl : `/api/user/avatar?uid=${this.props.uid}`;
    // console.log(this.props.uid);
    return (
      <div className="avatar-box">
        <Tooltip
          placement="right"
          title={<div>点击头像更换 (只支持jpg、png格式且大小不超过200kb的图片)</div>}
        >
          <div>
            {(() => {
              return (
                <Upload
              className="avatar-uploader"
              name="basecode"
              showUploadList={false}
              action={buildApiUrl('/api/user/upload_avatar')}
              beforeUpload={beforeUpload}
              onChange={this.handleChange.bind(this)}
            >
              {/*<Avatar size="large" src={imageUrl}  />*/}
              <div style={{ width: 100, height: 100 }}>
                <img className="avatar" src={imageUrl} />
              </div>
            </Upload>
              );
            })()}
          </div>
        </Tooltip>
        <span className="avatarChange" />
      </div>
    );
  }
}

function beforeUpload(file: RcFile) {
  const isJPG = file.type === 'image/jpeg';
  const isPNG = file.type === 'image/png';
  if (!isJPG && !isPNG) {
    message.error('图片的格式只能为 jpg、png！');
  }
  const isLt2M = file.size / 1024 / 1024 < 0.2;
  if (!isLt2M) {
    message.error('图片必须小于 200kb!');
  }

  return (isPNG || isJPG) && isLt2M;
}

function getBase64(img: Blob, callback: (value: string) => void) {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    if (typeof reader.result === 'string') callback(reader.result);
  });
  reader.readAsDataURL(img);
}

export default Profile as unknown as ComponentType<RouteComponentProps<{ uid?: string }>>;
