import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IdentitySyncStatus } from '../src/identity-sources/IdentitySyncStatus'

describe('identity sources', () => {
  it('shows provider, freshness deadline, lag, failure and reconciliation state', async () => {
    render(<IdentitySyncStatus sourceId="ldap-main" load={async () => ({ provider: 'LDAP', last_success_at: '2026-08-24T01:00:00Z', freshness_deadline: '2026-08-24T01:05:00Z', lag_seconds: 420, failure: 'bind_timeout', reconciliation_state: 'blocked' })} />)
    expect(await screen.findByText('LDAP')).toBeTruthy()
    expect(screen.getByText('bind_timeout')).toBeTruthy()
    expect(screen.getByText('blocked')).toBeTruthy()
  })
})
