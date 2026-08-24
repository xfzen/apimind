import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InstanceDetail } from '../src/applications/InstanceDetail'

describe('instance detail', () => {
  it('renders registered instance metadata before a product manifest is accepted', async () => {
    render(<InstanceDetail instanceId="ecp-admin" load={async () => ({ id: 'ecp-admin', application_id: 'ecp-control', name: 'admin-ui', base_url: 'https://ecp-admin.local', state: 'active' })} />)
    expect(await screen.findByText('admin-ui')).toBeTruthy()
    expect(screen.getByText('尚未声明产品 Manifest')).toBeTruthy()
  })
})
