# ApiMind Web 文档

[English](README.en.md)

## Quick Start 与配置

- [根 README](../README.md)：环境、启动、配置和验证入口；
- [开发运维索引](devops/index.md)：继承的部署与 LDAP 资料，使用前须结合当前配置复核。

## 当前开发与验证

- [详细修改与改进](changes-from-yapi.md)；
- [修改说明](../MODIFICATIONS.md)；
- [历史代码边界](../HISTORICAL_CODE.md)；
- [仓库边界检查](../scripts/check-repository-boundary.mjs)；
- [验证脚本](../scripts/verify.sh)；
- [安全策略](../SECURITY.md)。

## 来源与许可

- [迁移说明](../MIGRATION.md)；
- [Apache-2.0](../LICENSE)；
- [NOTICE](../NOTICE)；
- [第三方声明](../THIRD_PARTY_NOTICES.md)。

## YApi 来源文档

[`docs/documents/`](documents/index.md) 是从 YApi 继承的历史产品和插件文档，其中部分内容可能与当前 ApiMind 行为不一致，不是当前实现的权威说明。当前行为应以 Web 源码、根 README 和 Server 契约为准。

## 历史设计资料

- [Markdown 编辑器设计（2026-05-27）](history/2026-05-27-docs-workspace-raw-markdown-editor-design.md)；
- [Markdown 编辑器实施计划（2026-05-27）](history/2026-05-27-docs-workspace-raw-markdown-editor-plan.md)；
- [`docs/superpowers/`](superpowers/) 保存已完成工作的设计与计划证据，不作为当前用户指南。
