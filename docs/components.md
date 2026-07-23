# 组件

[English](components.en.md)

## ApiMind Server

[`server/`](../server/) 是固定到公开提交的 Git submodule，其上游仓库是 [xfzen/apimind-server](https://github.com/xfzen/apimind-server)。它是 Headless/API-first Runtime Core，负责 YApi 兼容 HTTP、HTTP Mock、测试集合执行、MCP HTTP、OpenAPI 3.0.3 和 MongoDB。技术细节以其[文档索引](https://github.com/xfzen/apimind-server/blob/dev/docs/README.md)为准。

## ApiMind Web

[`web/`](../web/) 是本仓库直接维护的 YApi 兼容浏览器体验，只通过 Go 服务访问认证、存储和业务 API。技术细节以其[文档索引](../web/docs/README.md)为准。

## ApiMind Skills

[`skills/`](../skills/) 由本仓库直接维护，提供 Codex/MCP 项目配置与显式确认门禁下的契约维护。技术细节以其[文档索引](../skills/docs/README.md)为准。

统一版本组合及固定提交见 [`COMPATIBILITY.md`](../COMPATIBILITY.md)，许可证边界见 [`LICENSING.md`](../LICENSING.md)。
