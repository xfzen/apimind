import { Alert, Button, Input, List, Select, Spin } from 'antd'
import { useCallback, useEffect, useState } from 'react'

import { searchResources, type Resource, type ResourceSearch } from '../api/access'

export function ResourcePicker({ instanceId, resourceTypes = [], search = searchResources, onSelect }: { instanceId: string; resourceTypes?: string[]; search?: (instanceId: string, resourceType: string, query: string) => Promise<ResourceSearch>; onSelect?: (resource: Resource) => void }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ResourceSearch>()
  const [loading, setLoading] = useState(true)
  const [manualType, setManualType] = useState(resourceTypes[0] ?? '')
  const [manualId, setManualId] = useState('')
  const run = useCallback(async () => { setLoading(true); try { setResult(await search(instanceId, manualType, query)) } catch { setResult({ reason: 'resource_not_visible', resources: [] }) } finally { setLoading(false) } }, [instanceId, manualType, query, search])
  useEffect(() => { void run() }, [run])
  return <div className="grid gap-3">
    <Input.Search aria-label="搜索资源" value={query} onChange={(event) => setQuery(event.target.value)} onSearch={() => void run()} />
    {loading ? <Spin /> : result?.reason === 'resource_not_visible' ? <Alert type="warning" title="当前没有可管理的资源；首次绑定可输入根资源 ID" /> : <List bordered dataSource={result?.resources ?? []} renderItem={(resource) => <List.Item onClick={() => onSelect?.(resource)}>{resource.name}</List.Item>} />}
    {resourceTypes.length > 0 && <div className="flex gap-2">
      <Select aria-label="资源类型" className="min-w-36" value={manualType} options={resourceTypes.map((type) => ({ value: type, label: type }))} onChange={setManualType} />
      <Input aria-label="资源 ID" value={manualId} onChange={(event) => setManualId(event.target.value)} />
      <Button disabled={!manualType || !manualId.trim()} onClick={() => onSelect?.({ id: manualId.trim(), name: manualId.trim(), type: manualType })}>使用资源 ID</Button>
    </div>}
  </div>
}
