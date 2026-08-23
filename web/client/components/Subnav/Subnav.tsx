import './Subnav.scss';
import React, { PureComponent as Component } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';

interface SubnavItem {
  name: string;
  path: string;
}

interface SubnavProps {
  data: SubnavItem[];
  default: string;
}

class Subnav extends Component<SubnavProps> {
  handleClick?: MenuProps['onClick'];

  constructor(props: SubnavProps) {
    super(props);
  }

  static propTypes = {
    data: PropTypes.array,
    default: PropTypes.string
  };

  render() {
    const items: MenuProps['items'] = this.props.data.map(item => {
      const name = item.name.length === 2 ? item.name[0] + ' ' + item.name[1] : item.name;
      return {
        className: 'item',
        key: name.replace(' ', ''),
        label: <Link to={item.path}>{name}</Link>
      };
    });

    return (
      <div className="m-subnav">
        <Menu
          onClick={this.handleClick}
          selectedKeys={[this.props.default]}
          mode="horizontal"
          className="g-row m-subnav-menu"
          items={items}
        />
      </div>
    );
  }
}

export default Subnav;
