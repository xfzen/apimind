import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LoginButton } from '../src/auth/LoginButton'

describe('admin login boundary', () => {
  it('starts login through the same-origin ECP endpoint', async () => {
    const navigate = vi.fn()
    render(<LoginButton navigate={navigate} />)
    await userEvent.click(screen.getByRole('button', { name: '登录' }))
    expect(navigate).toHaveBeenCalledWith('/api/v1/auth/start')
  })
})
