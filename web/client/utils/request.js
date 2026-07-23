// Centralized axios instance for fully-separated frontend-backend deployment
// - baseURL comes from Vite's explicit `__YAPI_API_BASE__` define or runtime `window.API_BASE`
// - withCredentials enabled so cross-site cookies are sent when CORS allows it

import realAxios from 'axios';

function getApiBase() {
  // Prefer build-time injection. Avoid browser `process.env`, which can be
  // polluted by polyfills and bypass the dev proxy.
  const envBase = typeof __YAPI_API_BASE__ !== 'undefined' ? __YAPI_API_BASE__ : '';
  if (envBase && String(envBase).trim() !== '') return String(envBase).trim().replace(/\/$/, '');
  // Fallback to runtime window override
  if (typeof window !== 'undefined' && window.API_BASE && String(window.API_BASE).trim() !== '') {
    return String(window.API_BASE).trim().replace(/\/$/, '');
  }
  return '';
}

const baseURL = getApiBase();

const instance = realAxios.create({
  baseURL, // keeps relative '/api/*' paths working against another origin
  withCredentials: true
});

// Preserve axios helpers when needed
instance.CancelToken = realAxios.CancelToken;
instance.isCancel = realAxios.isCancel;
instance.all = realAxios.all;
instance.spread = realAxios.spread;

export default instance;
