import axios from 'axios'

let csrfToken = ''

export const apiClient = axios.create({ baseURL: '/api/v1', withCredentials: true })

apiClient.interceptors.request.use((request) => {
  const method = request.method?.toUpperCase() ?? 'GET'
  if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) request.headers.set('X-CSRF-Token', csrfToken)
  return request
})

export function setCSRFToken(value: string) {
  csrfToken = value
}
