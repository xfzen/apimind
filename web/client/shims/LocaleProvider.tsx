import React from 'react';
import PropTypes from 'prop-types';
import { ConfigProvider } from 'antd';
import type { ConfigProviderProps } from 'antd';
import type { ReactNode } from 'react';

interface LocaleProviderProps {
  locale?: ConfigProviderProps['locale'];
  children?: ReactNode;
}

export default function LocaleProvider({ locale, children }: LocaleProviderProps) {
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
