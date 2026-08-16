import React, { PureComponent as Component } from 'react';
import Card from 'antd/es/card';
import Col from 'antd/es/grid/col';
import Row from 'antd/es/grid/row';

import LogoSVG from '../../components/LogoSVG';
import Login from './LoginWrap';

class LoginContainer extends Component {
  render() {
    return (
      <div className="g-body login-body">
        <div className="m-bg">
          <div className="m-bg-mask m-bg-mask0" />
          <div className="m-bg-mask m-bg-mask1" />
          <div className="m-bg-mask m-bg-mask2" />
          <div className="m-bg-mask m-bg-mask3" />
        </div>
        <div className="main-one login-container">
          <div className="container">
            <Row type="flex" justify="center">
              <Col xs={20} sm={16} md={12} lg={8} className="container-login">
                <Card className="card-login">
                  <h2 className="login-title">YAPI</h2>
                  <div className="login-logo">
                    <LogoSVG length="100px" />
                  </div>
                  <Login />
                </Card>
              </Col>
            </Row>
          </div>
        </div>
      </div>
    );
  }
}

export default LoginContainer;
