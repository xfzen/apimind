import { LoginOutlined } from '@ant-design/icons'
import { Button } from 'antd'

type Props = { navigate?: (path: string) => void }
export function LoginButton({ navigate = (path) => window.location.assign(path) }: Props) {
  return <Button aria-label="登录" type="primary" icon={<LoginOutlined />} onClick={() => navigate('/api/v1/auth/start')}>登录</Button>
}
