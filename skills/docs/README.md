# ApiMind Skills 文档

[English](README.en.md)

## Skill 入口

- [`apimind-project-config`](../skills/apimind-project-config/SKILL.md)：项目映射与仓库指令配置；
- [`apimind-contract`](../skills/apimind-contract/SKILL.md)：显式请求和确认门禁下的契约读取与维护。

## 兼容性与配置

- [Server 兼容性元数据](../compatibility/server.yaml)：`apimind-mcp-v1` 与 `yapi-http-v1`；
- [项目映射示例](../examples/apimind-contract.yaml)；
- [兼容性检查器](../scripts/check-compatibility.mjs)。

## 维护者文档

- [ApiMind Contract Skill 维护提示](apimind-contract-skill-maintenance-prompt.md)：仅供维护者更新和复核 Skill 行为，不是最终用户 Quick Start；
- [贡献指南](../CONTRIBUTING.md)；
- [迁移说明](../MIGRATION.md)。

## 验证、安全与许可

- [包校验脚本](../scripts/package-check.mjs)；
- [完整验证入口](../scripts/verify.sh)；
- [安全策略](../SECURITY.md)；
- [Apache-2.0](../LICENSE)。
