import axios from 'axios'

let csrfToken = ''
let enterpriseID = ''

export const apiClient = axios.create({ baseURL: '/api/v1', withCredentials: true })

apiClient.interceptors.request.use((request) => {
  const method = request.method?.toUpperCase() ?? 'GET'
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (enterpriseID) request.params = { ...request.params as object, enterprise_id: enterpriseID }
  } else {
    const operationID = globalThis.crypto.randomUUID()
    request.headers.set('Operation-ID', `op-${operationID}`)
    request.headers.set('Idempotency-Key', `idem-${operationID}`)
    if (csrfToken) request.headers.set('X-CSRF-Token', csrfToken)
    if (enterpriseID && request.data && typeof request.data === 'object' && !Array.isArray(request.data)) request.data = { ...request.data as object, enterprise_id: enterpriseID }
  }
  return request
})

export function setSessionScope(nextEnterpriseID: string, nextCSRFToken: string) {
  enterpriseID = nextEnterpriseID
  csrfToken = nextCSRFToken
}
