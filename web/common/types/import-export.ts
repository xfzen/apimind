export type Identifier = string | number;

export interface ImportCategory extends Record<string, unknown> {
  name: string;
  desc?: string;
  id?: Identifier;
}

export interface ImportApi extends Record<string, unknown> {
  path: string;
  catname?: string;
  catid?: Identifier;
  project_id?: Identifier;
  dataSync?: string;
  token?: string;
}

export interface ImportPayload {
  cats?: ImportCategory[];
  apis: ImportApi[];
  basePath?: string;
}

export interface ExistingCategory {
  _id: Identifier;
  name: string;
}

export interface ImportLoadingState {
  showLoading: boolean;
}

export type MessageCallback = (message: string) => void;
export type ImportStateCallback = (state: ImportLoadingState) => void;
