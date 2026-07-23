import './styles/common.scss';
import './styles/theme.less';
import 'antd/dist/reset.css';
import './styles/antd-overrides.scss';
import LocaleProvider from './shims/LocaleProvider';
import './plugin';
import React from 'react';
import App from './Application';
import { Provider } from 'react-redux';
import createStore from './reducer/create';
import { renderInto } from './shims/reactRoot';

// 由于 antd 组件的默认文案是英文，所以需要修改为中文
import zhCN from 'antd/locale/zh_CN';
// Polyfill Node Buffer for browser (sha.js -> safe-buffer)
import { Buffer } from 'buffer';
if (typeof window !== 'undefined') {
  if (!window.Buffer) {
    window.Buffer = Buffer;
  }
  if (!window.global) {
    window.global = window;
  }
}

const store = createStore();

renderInto(
  document.getElementById('yapi'),
  <Provider store={store}>
    <LocaleProvider locale={zhCN}>
      <App />
    </LocaleProvider>
  </Provider>
);
