declare global {
  const __YAPI_API_BASE__: string;

  interface Window {
    API_BASE?: string;
    Buffer?: typeof import('buffer').Buffer;
    global?: Window;
  }
}

export {};
