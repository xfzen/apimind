import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SecurityPolicy } from '../src/security/SecurityPolicy'

describe('security policy', () => {
  it('renders only the controlled public-sharing, export and secret policy schema', async () => {
    render(<SecurityPolicy load={async () => ({ public_sharing: false, export_allowed: true, secret_policy: 'redact' })} />)
    expect(await screen.findByText('公开分享')).toBeTruthy()
    expect(screen.getByText('导出策略')).toBeTruthy()
    expect(screen.getByText('密钥策略')).toBeTruthy()
    expect(screen.queryByText('任意产品配置')).toBeNull()
  })
})
