# ApiMind Skills Plugin

[English](README.en.md)

## 项目介绍

ApiMind Skills 是一个独立的 Codex 插件包，用于为仓库配置 ApiMind 项目映射，并通过 MCP 安全地读取或维护 API 契约。插件不包含 Server、Web、应用、数据库访问或业务代码。

## 包含的 Skills

| Skill | 支持的功能 | 典型使用方式 |
| --- | --- | --- |
| [`apimind-project-config`](skills/apimind-project-config/SKILL.md) | 初始化或检查仓库内的 `AGENTS.md`、可选 `CLAUDE.md` 和根目录 `apimind-contract.yaml`；绑定 ApiMind 工作区与项目；维护可选的接口分组路由提示 | “使用 ApiMind 配置这个仓库，工作区是 `my-team`，项目是 `my-api`” |
| [`apimind-contract`](skills/apimind-contract/SKILL.md) | 通过 ApiMind MCP 查询工作区、项目、接口分组和接口；评审 API 契约；在用户明确要求并确认后创建或更新接口分组与接口 | “评审当前接口与 ApiMind 文档是否一致”或“将这个接口更新到 ApiMind” |

任何写入都必须来自用户的明确请求并遵循 Skill 确认步骤。插件不直接访问数据库，也不删除 ApiMind 资源。

## Quick Start

### 在 Codex App 中安装

ApiMind 以 Codex 插件形式分发。大致安装流程如下：

1. 在 Codex App 中打开 **Plugins**；
2. 添加或选择 `xfzen/apimind` 提供的 ApiMind marketplace；
3. 在该 marketplace 中安装 **ApiMind**；
4. 安装或升级后重启 Codex App，并在一个新任务中使用 Skills。

也可以先在终端把 GitHub 仓库注册为 Codex marketplace，再回到 Codex App 的
**Plugins** 页面完成安装：

```sh
codex plugin marketplace add xfzen/apimind
```

仓库根目录的 `.agents/plugins/marketplace.json` 会把 `skills/` 注册为
ApiMind 插件。若使用尚未发布到默认分支的版本，可在
marketplace 命令中通过 `--ref <branch-or-tag>` 固定分支或标签。

### 配置 ApiMind MCP

Skills 通过 ApiMind Server 的 MCP 地址访问契约数据。统一仓库执行 `make dev`
后，本地开发地址为 `http://127.0.0.1:18889/mcp`，开发配置关闭 MCP
认证。可在 Codex App 的 MCP 设置中添加该 URL，或在项目的
`.codex/config.toml` 中配置：

```toml
[mcp_servers.apimind_mcp]
url = "http://127.0.0.1:18889/mcp"
enabled = true
```

连接启用认证的远程 Server 时，不要把令牌写入仓库。先在本机设置环境变量，
再让 Codex 从该变量读取 bearer token：

```toml
[mcp_servers.apimind_mcp]
url = "https://apimind.example.com/mcp"
bearer_token_env_var = "APIMIND_MCP_TOKEN"
enabled = true
```

安装或修改 MCP 配置后，重启 Codex App。远程 Server 的地址、MCP 开关和令牌
由该 Server 的管理员提供。

### 绑定当前项目

在需要维护 API 文档的代码仓库中调用 `apimind-project-config`，或以
[`examples/apimind-contract.yaml`](examples/apimind-contract.yaml) 为模板，
在仓库根目录创建：

```yaml
apimind:
  workspace: "my-team"
  project: "my-api"
```

`workspace` 和 `project` 使用 ApiMind 中的名称，不保存数据库 ID。MCP token
只负责认证；实际目标由这个本地映射确定。

## 如何使用

Codex 可以根据任务描述自动选择 Skill，也可以在提示词中通过 `$` 或
`/skills` 显式选择。

| 目标 | 建议提示词 | 是否写入远端 |
| --- | --- | --- |
| 初始化项目配置 | “使用 `$apimind-project-config` 配置当前仓库，工作区为 `my-team`，项目为 `my-api`” | 否，仅修改本地配置 |
| 检查项目绑定 | “检查当前仓库的 ApiMind 配置是否完整” | 否 |
| 查询或评审契约 | “使用 `$apimind-contract` 评审 `/api/users` 的 ApiMind 接口文档” | 否，默认只读 |
| 创建或更新接口 | “将 `/api/users` 的最新契约同步到 ApiMind” | 是，Skill 会先确认目标与变更 |

代码发生变化不会自动触发 ApiMind 写入。只有“提交、更新、同步、创建或写入
ApiMind 接口文档”等明确请求才会进入写流程。

## 兼容性

[`compatibility/server.yaml`](compatibility/server.yaml) 声明当前支持的 Server 契约：

- Server 包版本 `0.1.0`；
- HTTP API 契约 `yapi-http-v1`；
- MCP 契约 `apimind-mcp-v1`。

```sh
node scripts/check-compatibility.mjs --mcp-tools tests/fixtures/mcp-tools.json
```

## 验证

以下命令面向插件维护者，不是安装步骤。校验使用 Node.js 22，不安装依赖、
不访问远端 ApiMind，也不需要数据库或 Docker：

```sh
sh scripts/verify.sh
```

## 文档列表

从[中文文档索引](docs/README.md)进入 Skill 入口、兼容性、配置示例、维护资料和安全说明；英文读者参见 [Documentation](docs/README.en.md)。

## 安全

请阅读 [SECURITY.md](SECURITY.md)。不要提交令牌、凭据、私有地址或机器本地路径。

## 许可证

本仓库按 [Apache-2.0](LICENSE) 提供。
