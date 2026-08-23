import { App as AntApp, ConfigProvider } from 'antd'

import { RequireSession } from '../auth/RequireSession'
import { ecpTheme } from '../styles/theme'
import { AppRoutes } from './routes'

export function App() {
  return <ConfigProvider theme={ecpTheme}><AntApp><RequireSession><AppRoutes /></RequireSession></AntApp></ConfigProvider>
}
