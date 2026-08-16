import React, { PureComponent as Component } from 'react';
import './Follows.scss';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Row, Col } from 'antd';
import { getFollowList } from '../../reducer/modules/follow';
import { setBreadcrumb } from '../../reducer/modules/user';
import ProjectCard from '../../components/ProjectCard/ProjectCard';
import ErrMsg from '../../components/ErrMsg/ErrMsg';
import type { ProjectData } from '../../components/ProjectCard/ProjectCard';
import type { ApiResponse } from '../../types/api';
import type { BreadcrumbItem } from '../../types/user';
import type { RootState } from '../../reducer/modules/reducer';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

interface FollowProject extends ProjectData {
  up_time: number;
}
type FollowResponse = {
  payload: { data: ApiResponse<FollowProject[] | { list: FollowProject[] }> };
};
interface FollowsProps {
  data: FollowProject[];
  uid: number;
  getFollowList: (uid: number) => Promise<FollowResponse>;
  setBreadcrumb: (data: BreadcrumbItem[]) => unknown;
}
interface FollowsState { data: FollowProject[] }

const getFollowItems = (res: FollowResponse): FollowProject[] => {
  const data = res && res.payload && res.payload.data && res.payload.data.data;
  if (Array.isArray(data)) {
    return data;
  }
  if (data && !Array.isArray(data) && Array.isArray(data.list)) {
    return data.list;
  }
  return [];
};

const connectFollows = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      data: state.follow.data,
      uid: state.user.uid
    };
  },
  {
    getFollowList,
    setBreadcrumb
  }
));
@connectFollows
class Follows extends Component<FollowsProps, FollowsState> {
  constructor(props: FollowsProps) {
    super(props);
    this.state = {
      data: []
    };
  }
  static propTypes = {
    getFollowList: PropTypes.func,
    setBreadcrumb: PropTypes.func,
    uid: PropTypes.number
  };

  receiveRes = () => {
    this.props.getFollowList(this.props.uid).then(res => {
      if (res.payload.data.errcode === 0) {
        this.setState({
          data: getFollowItems(res)
        });
      }
    });
  };

  async componentWillMount() {
    this.props.setBreadcrumb([{ name: '我的关注' }]);
    this.props.getFollowList(this.props.uid).then(res => {
      if (res.payload.data.errcode === 0) {
        this.setState({
          data: getFollowItems(res)
        });
      }
    });
  }

  render() {
    let data = Array.isArray(this.state.data) ? this.state.data : [];
    data = data.sort((a, b) => {
      return b.up_time - a.up_time;
    });
    return (
      <div>
        <div className="g-row" style={{ paddingLeft: '32px', paddingRight: '32px' }}>
          <Row gutter={16} className="follow-box pannel-without-tab">
            {data.length ? (
              data.map((item, index) => {
                return (
                  <Col xs={6} md={4} xl={3} key={index}>
                    <ProjectCard
                      projectData={item}
                      inFollowPage={true}
                      callbackResult={this.receiveRes}
                    />
                  </Col>
                );
              })
            ) : (
              <ErrMsg type="noFollow" />
            )}
          </Row>
        </div>
      </div>
    );
  }
}

export default Follows;
