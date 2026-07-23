import React from 'react';
import PropTypes from 'prop-types';
import { ConfigProvider } from 'antd';

export default function LocaleProvider({ locale, children }) {
  return (
    <ConfigProvider locale={locale} warning={{ strict: false }}>
      {children}
    </ConfigProvider>
  );
}

LocaleProvider.propTypes = {
  locale: PropTypes.object,
  children: PropTypes.node
};
