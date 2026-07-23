// Helpers to compute backend origins and URLs for fully separated deployments

function getApiBase() {
  const envBase = typeof __YAPI_API_BASE__ !== 'undefined' ? __YAPI_API_BASE__ : '';
  if (envBase && String(envBase).trim() !== '') return String(envBase).trim().replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.API_BASE && String(window.API_BASE).trim() !== '') {
    return String(window.API_BASE).trim().replace(/\/$/, '');
  }
  return '';
}

function getBackendOrigin() {
  const base = getApiBase();
  if (!base) return (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  try {
    const u = new URL(base, (typeof window !== 'undefined' && window.location ? window.location.href : undefined));
    return u.origin;
  } catch (e) {
    // Basic fallback: assume base already an origin
    return base;
  }
}

function buildMockUrl(projectId, basepath, apiPath) {
  const origin = getBackendOrigin();
  return `${origin}/mock/${projectId}${basepath || ''}${apiPath || ''}`;
}

function buildWsUrl(apiPath) {
  // apiPath should start with '/'
  const origin = getBackendOrigin();
  try {
    const u = new URL(origin);
    const wsProtocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${u.host}${apiPath}`;
  } catch (e) {
    // Fallback to window location if origin parse failed
    if (typeof window !== 'undefined' && window.location) {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${window.location.host}${apiPath}`;
    }
    return apiPath;
  }
}

function buildApiUrl(apiPath) {
  const origin = getBackendOrigin();
  return `${origin}${apiPath}`;
}

export { getBackendOrigin, buildMockUrl, buildWsUrl, buildApiUrl };
