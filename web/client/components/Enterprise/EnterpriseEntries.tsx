import React, { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import Alert from 'antd/es/alert';

import {
  getEnterpriseCapabilities,
  loadingEnterpriseCapabilities,
  type EnterpriseCapabilities
} from '../../services/enterpriseCapabilities';

export interface EnterpriseCapabilityProps {
  enterpriseCapabilities: EnterpriseCapabilities;
}

export function withEnterpriseCapabilities<P extends EnterpriseCapabilityProps>(
  Wrapped: ComponentType<P>
): ComponentType<Omit<P, keyof EnterpriseCapabilityProps>> {
  return function EnterpriseCapabilityContainer(props: Omit<P, keyof EnterpriseCapabilityProps>) {
    const [capabilities, setCapabilities] = useState<EnterpriseCapabilities>(
      loadingEnterpriseCapabilities
    );
    useEffect(() => {
      let active = true;
      void getEnterpriseCapabilities().then(value => {
        if (active) setCapabilities(value);
      });
      return () => {
        active = false;
      };
    }, []);
    return <Wrapped {...(props as P)} enterpriseCapabilities={capabilities} />;
  };
}

export function EnterpriseAdminLink() {
  const [capabilities, setCapabilities] = useState<EnterpriseCapabilities>(
    loadingEnterpriseCapabilities
  );
  useEffect(() => {
    void getEnterpriseCapabilities().then(setCapabilities);
  }, []);
  if (capabilities.status !== 'enterprise') return null;
  return (
    <a href={capabilities.adminUrl} target="_blank" rel="noopener noreferrer">
      企业管理
    </a>
  );
}

export function EnterpriseMemberNotice({ capabilities }: { capabilities: EnterpriseCapabilities }) {
  if (capabilities.status === 'unavailable') {
    return (
      <Alert
        type="warning"
        showIcon
        message="暂时无法确认企业权限，成员编辑已停用"
      />
    );
  }
  if (capabilities.status !== 'enterprise') return null;
  return (
    <Alert
      type="info"
      showIcon
      message="企业成员与权限由企业管理中心统一维护"
      action={
        <a href={capabilities.adminUrl} target="_blank" rel="noopener noreferrer">
          前往企业管理中心
        </a>
      }
    />
  );
}
