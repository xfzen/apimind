import React from 'react';
import type { ComponentType } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import type { RouteComponentProps } from 'react-router';
import { changeMenuItem } from '../reducer/modules/menu';
import type { RootState } from '../reducer/modules/reducer';
import { asLegacyClassDecorator } from '../types/legacyDecorators';

interface AuthenticationProps extends RouteComponentProps {
  isAuthenticated: boolean;
  changeMenuItem: (key: string) => unknown;
}

export function requireAuthentication<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  class AuthenticatedComponent extends React.PureComponent<P & AuthenticationProps> {
    constructor(props: P & AuthenticationProps) {
      super(props);
    }
    static propTypes = {
      isAuthenticated: PropTypes.bool,
      location: PropTypes.object,
      dispatch: PropTypes.func,
      history: PropTypes.object,
      changeMenuItem: PropTypes.func
    };
    UNSAFE_componentWillMount() {
      this.checkAuth();
    }
    UNSAFE_componentWillReceiveProps() {
      this.checkAuth();
    }
    checkAuth() {
      if (!this.props.isAuthenticated) {
        this.props.history.push('/');
        this.props.changeMenuItem('/');
      }
    }
    render() {
      return <div>{this.props.isAuthenticated ? <Component {...this.props} /> : null}</div>;
    }
  }

  const connectAuthentication = asLegacyClassDecorator(connect(
    (state: RootState) => ({ isAuthenticated: state.user.isLogin }),
    { changeMenuItem }
  ));
  const Connected = connectAuthentication(AuthenticatedComponent) || AuthenticatedComponent;
  return Connected as unknown as ComponentType<P>;
}
