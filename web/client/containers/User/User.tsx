import './index.scss';
import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import { Route } from 'react-router-dom';
import List from './List';
import PropTypes from 'prop-types';
import Profile from './Profile';
import { Row } from 'antd';
import type { RouteComponentProps } from 'react-router';
import type { RootState } from '../../reducer/modules/reducer';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

interface UserProps extends RouteComponentProps {
  curUid: number | null;
  userType: string | null;
  role: string | null;
}
const connectUser = asLegacyClassDecorator(connect(
  (state: RootState) => {
    return {
      curUid: state.user.uid,
      userType: state.user.type,
      role: state.user.role
    };
  },
  {}
));
@connectUser
class User extends Component<UserProps> {
  static propTypes = {
    match: PropTypes.object,
    curUid: PropTypes.number,
    userType: PropTypes.string,
    role: PropTypes.string
  };

  constructor(props: UserProps) {
    super(props);
  }

  render() {
    return (
      <div>
        <div className="g-doc">
          <Row className="user-box">
            <Route path={this.props.match.path + '/list'} component={List} />
            <Route path={this.props.match.path + '/profile/:uid'} component={Profile} />
          </Row>
        </div>
      </div>
    );
  }
}

export default User;
