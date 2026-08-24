import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Health } from '../src/operations/Health'

describe('health status', () => {
  it('shows unavailable dependency details explicitly when the public health contract omits them', async () => {
    render(<Health load={async () => ({ status: 'ok', version: '0.1.0' })} />)
    expect(await screen.findByText('0.1.0')).toBeTruthy()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})
