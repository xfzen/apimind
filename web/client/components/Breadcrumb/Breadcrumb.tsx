import './Breadcrumb.scss';
import { withRouter } from 'react-router-dom';
import { Breadcrumb } from 'antd';
import PropTypes from 'prop-types';
import React, { PureComponent as Component } from 'react';
import type { ComponentType } from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import type { RootState } from '../../reducer/modules/reducer';
import type { BreadcrumbItem } from '../../types/user';
import { asLegacyClassDecorator } from '../../types/legacyDecorators';

const connectBreadcrumb = asLegacyClassDecorator(connect((state: RootState) => {
  return {
    breadcrumb: state.user.breadcrumb
  };
}));
const routeBreadcrumb = asLegacyClassDecorator(withRouter);

interface BreadcrumbNavigationProps {
  breadcrumb: BreadcrumbItem[];
}

@connectBreadcrumb
@routeBreadcrumb
class BreadcrumbNavigation extends Component<BreadcrumbNavigationProps> {
  constructor(props: BreadcrumbNavigationProps) {
    super(props);
  }

  static propTypes = {
    breadcrumb: PropTypes.array
  };

  render() {
    const items = this.props.breadcrumb.map(item => ({
      title: item.href ? <Link to={item.href}>{item.name}</Link> : item.name
    }));
    return (
      <div className="breadcrumb-container">
        <Breadcrumb items={items} />
      </div>
    );
  }
}

export default BreadcrumbNavigation as unknown as ComponentType;
