import { autobind } from 'core-decorators';
import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { connect, Provider } from 'react-redux';
import type { RouteComponentProps } from 'react-router';
import { BrowserRouter, withRouter } from 'react-router-dom';
import { createStore } from 'redux';

import { asLegacyClassDecorator } from '../../client/types/legacyDecorators';

interface CanaryRootState {
  label: string;
}

interface CanaryProps extends Partial<RouteComponentProps> {
  label?: string;
}

interface CanaryState {
  count: number;
}

const connectCanary = asLegacyClassDecorator(
  connect((state: CanaryRootState) => ({ label: state.label }))
);
const routeCanary = asLegacyClassDecorator(withRouter);

@connectCanary
@routeCanary
class DecoratorCanary extends Component<CanaryProps, CanaryState> {
  state: CanaryState = { count: 0 };

  @autobind
  increment() {
    this.setState(({ count }) => ({ count: count + 1 }));
  }

  render() {
    const callback = this.increment;
    return (
      <>
        <div data-testid="decorator-value">
          {this.props.label}:{this.state.count}
        </div>
        <button data-testid="decorator-increment" onClick={callback} type="button">
          Increment
        </button>
      </>
    );
  }
}

const store = createStore((state: CanaryRootState = { label: 'connected' }) => state);
const container = document.getElementById('canary');

if (!container) {
  throw new Error('Missing #canary container');
}

createRoot(container).render(
  <Provider store={store}>
    <BrowserRouter>
      <DecoratorCanary />
    </BrowserRouter>
  </Provider>
);
