# ApiMind Skills Plugin

[English](README.en.md)

## 项目介绍

ApiMind Skills 是一个独立的 Codex 插件包，用于为仓库配置 ApiMind 项目映射，并通过 MCP 安全地读取或维护 API 契约。插件不包含 Server、Web、应用、数据库访问或业务代码。

## 包含的 Skills

- [`apimind-project-config`](skills/apimind-project-config/SKILL.md)：管理仓库内的 `AGENTS.md`、可选 `CLAUDE.md` 和 `apimind-contract.yaml` 绑定；
- [`apimind-contract`](skills/apimind-contract/SKILL.md)：读取 ApiMind 契约；只有用户明确提出写入意图并经过 Skill 要求的确认后，才允许创建或更新接口分组与接口。

任何写入都必须来自用户的明确请求并遵循 Skill 确认步骤。插件不直接访问数据库，也不删除 ApiMind 资源。

## Quick Start

将仓库克隆或复制到 Codex 插件目录，并保持 `.codex-plugin/plugin.json` 与 `skills/` 目录位于同一包中：

```sh
sh tests/install-smoke.sh
```

为项目配置映射时，以 [`examples/apimind-contract.yaml`](examples/apimind-contract.yaml) 为模板，使用已经确认的工作区和项目名称替换占位符。

## 兼容性

[`compatibility/server.yaml`](compatibility/server.yaml) 声明当前支持的 Server 契约：

- Server 包版本 `0.1.0`；
- HTTP API 契约 `yapi-http-v1`；
- MCP 契约 `apimind-mcp-v1`。

```sh
node scripts/check-compatibility.mjs --mcp-tools tests/fixtures/mcp-tools.json
```

## 验证

校验使用 Node.js 22，不安装依赖、不访问远端 ApiMind，也不需要数据库或 Docker：

```sh
sh scripts/verify.sh
```

## 文档列表

从[中文文档索引](docs/README.md)进入 Skill 入口、兼容性、配置示例、维护资料和安全说明；英文读者参见 [Documentation](docs/README.en.md)。

## 安全

请阅读 [SECURITY.md](SECURITY.md)。不要提交令牌、凭据、私有地址或机器本地路径。

## 许可证

本仓库按 [Apache-2.0](LICENSE) 提供。
