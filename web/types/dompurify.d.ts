declare module 'dompurify' {
  export interface Config {
    USE_PROFILES?: { html?: boolean };
    ADD_ATTR?: string[];
  }

  export interface DOMPurify {
    sanitize(value: string, config?: Config): string;
  }

  const DOMPurify: DOMPurify;
  export default DOMPurify;
}
