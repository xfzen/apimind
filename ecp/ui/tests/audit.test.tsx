import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuditExport } from '../src/audit/AuditExport'

describe('audit export', () => {
  it('requests reauthentication and a reason for high-risk exports', async () => {
    render(<AuditExport prepare={async () => ({ status: 'reauth_required' })} />)
    await userEvent.click(screen.getByRole('button', { name: '导出审计' }))
    await userEvent.type(screen.getByLabelText('导出原因'), '季度合规审计')
    await userEvent.click(screen.getByRole('button', { name: '创建导出' }))
    expect(await screen.findByText('需要重新认证')).toBeTruthy()
    expect(screen.getByLabelText('导出原因')).toBeTruthy()
  })
})
