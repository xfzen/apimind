import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ServiceAccountList } from '../src/credentials/ServiceAccountList'

describe('service account list', () => {
  it('exposes credential rotation for active service accounts', async () => {
    render(<ServiceAccountList applicationId="apimind" instanceId="apimind-local" load={async () => [{
      id: 'credential-1',
      name: 'ApiMind Connector',
      scopes: ['workspace:14:document.read'],
      state: 'active',
    }]} />)

    expect(await screen.findByText('ApiMind Connector')).toBeTruthy()
    expect(screen.getByRole('button', { name: '创建服务账号' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '轮换凭据' })).toBeTruthy()
  })
})
