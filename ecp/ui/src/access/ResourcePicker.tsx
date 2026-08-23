import { Alert, Input, List, Spin } from 'antd'
import { useCallback, useEffect, useState } from 'react'

import { searchResources, type Resource, type ResourceSearch } from '../api/access'

export function ResourcePicker({ instanceId, search = searchResources, onSelect }: { instanceId: string; search?: (instanceId: string, query: string) => Promise<ResourceSearch>; onSelect?: (resource: Resource) => void }) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ResourceSearch>()
  const [loading, setLoading] = useState(true)
  const run = useCallback(async () => { setLoading(true); try { setResult(await search(instanceId, query)) } finally { setLoading(false) } }, [instanceId, query, search])
  useEffect(() => { void run() }, [run])
  if (loading) return <Spin />
  if (result?.reason === 'resource_not_visible') return <Alert type="warning" message="无权查看该资源" />
  return <div className="grid gap-3"><Input.Search aria-label="搜索资源" value={query} onChange={(event) => setQuery(event.target.value)} onSearch={() => void run()} /><List bordered dataSource={result?.resources ?? []} renderItem={(resource) => <List.Item onClick={() => onSelect?.(resource)}>{resource.name}</List.Item>} /></div>
}
