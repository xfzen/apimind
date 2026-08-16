import React, { PureComponent as Component } from 'react';
import TimeTree from '../../../components/TimeLine/TimeLine';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import type { ComponentType } from 'react';
import type { RootState } from '../../../reducer/modules/reducer';
import { asLegacyClassDecorator } from '../../../types/legacyDecorators';
// import { Button } from 'antd'
interface GroupLogProps {
  uid: string;
  curGroupId: number;
}
const connectGroupLog = asLegacyClassDecorator(connect((state: RootState) => {
  return {
    uid: state.user.uid + '',
    curGroupId: state.group.currGroup._id
  };
}));
@connectGroupLog
class GroupLog extends Component<GroupLogProps> {
  constructor(props: GroupLogProps) {
    super(props);
  }
  static propTypes = {
    uid: PropTypes.string,
    match: PropTypes.object,
    curGroupId: PropTypes.number
  };
  render() {
    return (
      <div className="g-row">
        <section className="news-box m-panel">
          <TimeTree type={'group'} typeid={this.props.curGroupId} />
        </section>
      </div>
    );
  }
}

export default GroupLog as unknown as ComponentType;
