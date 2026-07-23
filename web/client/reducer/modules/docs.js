import axios from 'axios';

const FETCH_DOCS = 'yapi/docs/FETCH_DOCS';
const FETCH_DOC = 'yapi/docs/FETCH_DOC';
const CREATE_DOC = 'yapi/docs/CREATE_DOC';
const UPDATE_DOC = 'yapi/docs/UPDATE_DOC';
const MOVE_DOC = 'yapi/docs/MOVE_DOC';
const DELETE_DOC = 'yapi/docs/DELETE_DOC';
const WORKSPACE_DOCS_PROJECT = 'yapi/docs/WORKSPACE_DOCS_PROJECT';

const initialState = {
  list: [],
  current: null
};

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case FETCH_DOCS:
      return Object.assign({}, state, { list: action.payload.data.data || [] });
    case FETCH_DOC:
    case CREATE_DOC:
    case UPDATE_DOC:
    case MOVE_DOC:
      return Object.assign({}, state, { current: action.payload.data.data || null });
    case DELETE_DOC:
      return Object.assign({}, state, { current: null });
    default:
      return state;
  }
}

export function fetchDocs(workspaceId, projectId = 0) {
  return {
    type: FETCH_DOCS,
    payload: axios.get('/api/docs/list', {
      params: { workspace_id: workspaceId, project_id: projectId }
    })
  };
}

export function ensureWorkspaceDocsProject(workspaceId) {
  return {
    type: WORKSPACE_DOCS_PROJECT,
    payload: axios.get('/api/docs/workspace_project', {
      params: { workspace_id: workspaceId }
    })
  };
}

export function fetchDoc(id) {
  return {
    type: FETCH_DOC,
    payload: axios.get('/api/docs/get', { params: { id } })
  };
}

export function createDoc(payload) {
  return {
    type: CREATE_DOC,
    payload: axios.post('/api/docs/create', payload)
  };
}

export function updateDoc(payload) {
  return {
    type: UPDATE_DOC,
    payload: axios.post('/api/docs/update', payload)
  };
}

export function moveDoc(payload) {
  return {
    type: MOVE_DOC,
    payload: axios.post('/api/docs/move', payload)
  };
}

export function deleteDoc(id) {
  return {
    type: DELETE_DOC,
    payload: axios.post('/api/docs/delete', { id })
  };
}
