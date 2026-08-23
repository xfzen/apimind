import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BackupStatus } from '../src/operations/BackupStatus'

describe('backup status', () => {
  it.each([
    ['verified', '最近一次备份已通过空环境恢复验证'],
    ['failed', '最近一次备份或恢复验证失败'],
    ['in_progress', '备份正在进行'],
    ['never_run', '尚未执行受支持的备份'],
  ] as const)('renders %s only from the operation record', async (state, message) => {
    render(<BackupStatus load={async () => ({ state })} />)
    expect(await screen.findByText(message)).toBeTruthy()
  })
})
