import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ResourcePicker } from '../src/access/ResourcePicker'
import { GroupDetail } from '../src/groups/GroupDetail'

describe('access visibility', () => {
  it('does not render unauthorized resource names returned as denied', async () => {
    render(<ResourcePicker instanceId="apimind-prod" search={async () => ({ reason: 'resource_not_visible', resources: [{ id: 'secret', name: 'secret-project', type: 'project' }] })} />)
    expect(await screen.findByText('当前没有可管理的资源；首次绑定可输入根资源 ID')).toBeTruthy()
    expect(screen.queryByText('secret-project')).toBeNull()
  })

  it('allows an explicit resource id for the initial binding', async () => {
  const user = userEvent.setup()
  let selected: { id: string; name: string; type: string } | undefined
  render(<ResourcePicker instanceId="apimind-prod" resourceTypes={['workspace']} search={async () => ({ reason: 'resource_not_visible', resources: [] })} onSelect={(value) => { selected = value }} />)
  await user.type(await screen.findByLabelText('资源 ID'), '261')
  await user.click(screen.getByRole('button', { name: '使用资源 ID' }))
  expect(selected).toEqual({ id: '261', name: '261', type: 'workspace' })
  })

  it('searches the selected resource type instead of relying on the backend default', async () => {
    const calls: string[] = []
    render(<ResourcePicker instanceId="apimind-prod" resourceTypes={['workspace']} search={async (_instance, resourceType) => { calls.push(resourceType); return { resources: [] } }} />)
    await waitFor(() => expect(calls).toEqual(['workspace']))
  })

  it('renders directory-managed groups as read-only', async () => {
    render(<GroupDetail groupId="group-1" load={async () => ({ id: 'group-1', name: '研发组', source: 'directory_managed', members: [] })} />)
    const button = await screen.findByRole('button', { name: '添加成员' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('由外部目录管理')).toBeTruthy()
  })
})
