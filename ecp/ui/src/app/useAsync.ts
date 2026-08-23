import { useEffect, useState, type DependencyList } from 'react'

export function useAsync<T>(load: () => Promise<T>, dependencies: DependencyList = [load]) {
  const [state, setState] = useState<{ loading: boolean; data?: T; error?: boolean }>({ loading: true })
  useEffect(() => {
    let active = true
    setState({ loading: true })
    void load().then((data) => active && setState({ loading: false, data })).catch(() => active && setState({ loading: false, error: true }))
    return () => { active = false }
  }, dependencies)
  return state
}
