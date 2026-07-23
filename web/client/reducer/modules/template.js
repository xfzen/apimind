import axios from 'axios';

const FETCH_TEMPLATE_PROJECTS = 'yapi/template/FETCH_TEMPLATE_PROJECTS';
const FETCH_TEMPLATES = 'yapi/template/FETCH_TEMPLATES';
const GET_TEMPLATE = 'yapi/template/GET_TEMPLATE';
const UPDATE_TEMPLATE = 'yapi/template/UPDATE_TEMPLATE';

const initialState = {
  projects: [],
  list: [],
  current: null
};

export default (state = initialState, action) => {
  switch (action.type) {
    case FETCH_TEMPLATE_PROJECTS:
      return {
        ...state,
        projects: action.payload.data.data || []
      };
    case FETCH_TEMPLATES:
      return {
        ...state,
        list: action.payload.data.data || []
      };
    case GET_TEMPLATE:
      return {
        ...state,
        current: action.payload.data.data || null
      };
    case UPDATE_TEMPLATE: {
      const current = action.payload.data.data || null;
      return {
        ...state,
        current,
        list: current
          ? state.list.map(item => (item.key === current.key ? { ...item, ...current } : item))
          : state.list
      };
    }
    default:
      return state;
  }
};

export function fetchTemplateProjects() {
  return {
    type: FETCH_TEMPLATE_PROJECTS,
    payload: axios.get('/api/templates/projects')
  };
}

export function fetchTemplates(params) {
  return {
    type: FETCH_TEMPLATES,
    payload: axios.get('/api/templates/list', { params })
  };
}

export function searchTemplates(params) {
  return {
    type: FETCH_TEMPLATES,
    payload: axios.get('/api/templates/search', { params })
  };
}

export function getTemplate(key) {
  return {
    type: GET_TEMPLATE,
    payload: axios.get('/api/templates/get', { params: { key } })
  };
}

export function updateTemplate(data) {
  return {
    type: UPDATE_TEMPLATE,
    payload: axios.post('/api/templates/update', data)
  };
}
