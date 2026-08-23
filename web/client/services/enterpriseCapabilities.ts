import request from '../utils/request';
import type { ApiResponse } from '../types/api';

interface CapabilityPayload {
  enterprise_enabled?: boolean;
  enterprise_admin_url?: string;
  enterprise_auth_start_path?: string;
  enterprise_legacy_auth_compat?: boolean;
  enterprise_legacy_auth_deadline?: string;
}

export type EnterpriseCapabilities =
  | { status: 'loading' | 'unavailable'; adminUrl: ''; authStartPath: '' }
  | { status: 'community'; adminUrl: ''; authStartPath: '' }
  | {
      status: 'enterprise';
      adminUrl: string;
      authStartPath: string;
      legacyAuthCompat?: boolean;
      legacyAuthDeadline?: string;
    };

export const loadingEnterpriseCapabilities: EnterpriseCapabilities = {
  status: 'loading',
  adminUrl: '',
  authStartPath: ''
};

const unavailableEnterpriseCapabilities: EnterpriseCapabilities = {
  status: 'unavailable',
  adminUrl: '',
  authStartPath: ''
};

function isSafeAuthStartPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/api/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !value.includes('?') &&
    !value.includes('#')
  );
}

function isSafeAdminUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol === 'https:') return true;
    return (
      parsed.protocol === 'http:' &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')
    );
  } catch {
    return false;
  }
}

export function parseEnterpriseCapabilities(
  response: ApiResponse<CapabilityPayload>
): EnterpriseCapabilities {
  if (response.errcode !== 0 || response.data === null) {
    return unavailableEnterpriseCapabilities;
  }
  if (response.data.enterprise_enabled !== true) {
    return { status: 'community', adminUrl: '', authStartPath: '' };
  }
  if (
    !isSafeAdminUrl(response.data.enterprise_admin_url) ||
    !isSafeAuthStartPath(response.data.enterprise_auth_start_path)
  ) {
    return unavailableEnterpriseCapabilities;
  }
  const legacyDeadline = response.data.enterprise_legacy_auth_deadline;
  const legacyAuthCompat =
    response.data.enterprise_legacy_auth_compat === true &&
    typeof legacyDeadline === 'string' &&
    Number.isFinite(Date.parse(legacyDeadline));
  return {
    status: 'enterprise',
    adminUrl: response.data.enterprise_admin_url,
    authStartPath: response.data.enterprise_auth_start_path,
    legacyAuthCompat,
    legacyAuthDeadline: legacyAuthCompat ? legacyDeadline : undefined
  };
}

export async function fetchEnterpriseCapabilities(): Promise<EnterpriseCapabilities> {
  try {
    const response = await request.get<ApiResponse<CapabilityPayload>>('/api/meta/capabilities');
    return parseEnterpriseCapabilities(response.data);
  } catch {
    return unavailableEnterpriseCapabilities;
  }
}

let capabilityRequest: Promise<EnterpriseCapabilities> | undefined;

export function getEnterpriseCapabilities(): Promise<EnterpriseCapabilities> {
  capabilityRequest ||= fetchEnterpriseCapabilities();
  return capabilityRequest;
}

export function areEnterpriseMembersReadOnly(capabilities: EnterpriseCapabilities): boolean {
  return capabilities.status !== 'community';
}

export function getSessionMode(
  capabilities: EnterpriseCapabilities
): 'community' | 'enterprise' | 'blocked' {
  if (capabilities.status === 'community') return 'community';
  if (capabilities.status === 'enterprise') return 'enterprise';
  return 'blocked';
}
