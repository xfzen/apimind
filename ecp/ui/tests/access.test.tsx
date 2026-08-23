import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ResourcePicker } from '../src/access/ResourcePicker'
import { GroupDetail } from '../src/groups/GroupDetail'

describe('access visibility', () => {
  it('does not render unauthorized resource names returned as denied', async () => {
    render(<ResourcePicker instanceId="apimind-prod" search={async () => ({ reason: 'resource_not_visible', resources: [{ id: 'secret', name: 'secret-project', type: 'project' }] })} />)
    expect(await screen.findByText('无权查看该资源')).toBeTruthy()
    expect(screen.queryByText('secret-project')).toBeNull()
  })

  it('renders directory-managed groups as read-only', async () => {
    render(<GroupDetail groupId="group-1" load={async () => ({ id: 'group-1', name: '研发组', source: 'directory_managed', members: [] })} />)
    const button = await screen.findByRole('button', { name: '添加成员' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('由外部目录管理')).toBeTruthy()
  })
})
