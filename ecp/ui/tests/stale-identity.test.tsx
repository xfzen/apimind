import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StaleIdentityAlert } from '../src/operations/IdentitySyncStatus'

describe('identity freshness', () => {
  it('fails visibly when identity data is stale', () => {
    render(<StaleIdentityAlert state={{ stale: true, lag_seconds: 601, freshness_deadline: '2026-08-24T01:05:00Z' }} />)
    expect(screen.getByText('身份数据已过期')).toBeTruthy()
    expect(screen.getByText(/601/)).toBeTruthy()
  })
})
