import './Activity.scss';
import React, { PureComponent as Component } from 'react';
import TimeTree from '../../../components/TimeLine/TimeLine';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Button } from 'antd';
import { buildMockUrl, buildApiUrl } from '../../../utils/backend';
import type { ComponentType } from 'react';
import type { RouteComponentProps } from 'react-router';
import type { RootState } from '../../../reducer/modules/reducer';
import { asLegacyClassDecorator } from '../../../types/legacyDecorators';
interface ActivityProps extends RouteComponentProps<{ id: string }> {
  uid: string;
  currProject: { _id: string | number; basepath?: string };
}
const connectActivity = asLegacyClassDecorator(connect((state: RootState) => {
  return {
    uid: state.user.uid + '',
    curdata: state.inter.curdata,
    currProject: state.project.currProject
  };
}));
@connectActivity
class Activity extends Component<ActivityProps> {
  constructor(props: ActivityProps) {
    super(props);
  }
  static propTypes = {
    uid: PropTypes.string,
    getMockUrl: PropTypes.func,
    match: PropTypes.object,
    curdata: PropTypes.object,
    currProject: PropTypes.object
  };
  render() {
    let { currProject } = this.props;
    return (
      <div className="g-row">
        <section className="news-box m-panel">
          <div style={{ display: 'none' }} className="logHead">
            {/*<Breadcrumb />*/}
            <div className="projectDes">
              <p>高效、易用、可部署的API管理平台</p>
            </div>
            <div className="Mockurl">
              <span>Mock地址：</span>
              <p>{buildMockUrl(currProject._id, currProject.basepath, '/yourPath')}</p>
              <Button type="primary">
                <a href={buildApiUrl(`/api/project/download?project_id=${this.props.match.params.id}`)}>
                  下载Mock数据
                </a>
              </Button>
            </div>
          </div>
          <TimeTree type={'project'} typeid={+this.props.match.params.id} />
        </section>
      </div>
    );
  }
}

export default Activity as unknown as ComponentType<RouteComponentProps<{ id: string }>>;
