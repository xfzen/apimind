import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LoginButton } from '../src/auth/LoginButton'

describe('admin login boundary', () => {
  it('starts login through the same-origin ECP endpoint', async () => {
    const navigate = vi.fn()
    const startLogin = vi.fn().mockResolvedValue('https://idp.example.com/login?state=state-1')
    render(<LoginButton navigate={navigate} startLogin={startLogin} />)
    await userEvent.click(screen.getByRole('button', { name: '登录' }))
    expect(startLogin).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith('https://idp.example.com/login?state=state-1')
  })
})
