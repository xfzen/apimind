# Quick Start

[English](quick-start.en.md)

## 目标

从统一仓库启动官方 MongoDB 7.0.37、固定版本的 ApiMind Server 和 ApiMind Web，并通过浏览器完成最小业务流。PostgreSQL 仍是 Roadmap。

## 环境

- Go 1.25.12；
- Node.js 22；
- npm 10+；
- Docker；
- 可用端口：Server `127.0.0.1:18889`、Web `127.0.0.1:4000`。MongoDB 仅在 Compose 网络中访问。

所有软件、工具链、依赖和容器镜像必须来自官方上游或发布者维护的 Registry。

## 1. 克隆并初始化

```bash
git clone --recurse-submodules https://github.com/xfzen/apimind.git
cd apimind
cp .env.example .env
make bootstrap
```

如果普通克隆时没有初始化 submodule，`make bootstrap` 会检出根仓库固定的 Server 提交。

`.env.example` 中的本地开发账号是：

| 配置项 | 默认示例值 |
| --- | --- |
| 用户名 | `admin@example.invalid` |
| 密码 | `change-me-local-only` |

请在首次启动前修改 `.env` 中的值；`.env` 已被 Git 忽略，不要提交真实凭据。

## 2. 启动开发环境

```bash
make dev
```

Server 与 Web 在宿主机使用官方 Go 和 npm 工具链编译，不在 Docker 中编译；Docker 只运行 MongoDB，并将宿主机构建产物装入最小运行时镜像。

Compose 项目名固定为 `apimind-public`，不会自动复用旧工作区或旧 YApi
安装的 MongoDB 数据卷。已有数据必须按 MongoDB 官方跨版本升级流程迁移，
不要把旧卷直接挂载到 MongoDB 7.0.37。

验证 Server：

```bash
curl http://127.0.0.1:18889/api/ping
```

查看组件版本与固定提交：

```bash
make status
```

## 3. 浏览器验证

访问 `http://127.0.0.1:4000`，使用 `.env` 中的预置账号登录，或注册新账号，然后：

1. 创建一个工作区；
2. 创建一个项目；
3. 新建一个接口；
4. 重新打开接口并确认名称、路径和请求方法正确显示。

查看日志和停止环境：

```bash
make logs
make down
```

只有明确需要删除本地 MongoDB 数据时才运行 `make reset-integration`。
