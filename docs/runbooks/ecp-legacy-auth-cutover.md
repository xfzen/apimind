# ECP 旧认证切换运行手册

## 目标

ApiMind 社区模式继续使用原有本地账号。企业模式默认只接受 ECP Product Session，不会在 ECP 不可用时退回旧认证。旧认证兼容仅用于受控迁移，并且必须设置不超过 30 天的 RFC3339 截止时间。

## 三种状态

| 状态 | 配置 | 行为 |
| --- | --- | --- |
| 社区模式 | `Enterprise.Enabled: false` | 原登录、注册和 LDAP 行为不变，不调用 ECP |
| 迁移兼容期 | `Enabled: true`、`LegacyAuthCompat: true`、未来的 `LegacyAuthDeadline` | 企业登录为主；旧登录带弃用提示；旧 Cookie 必须映射到 ECP 主体并仍由 ECP 授权 |
| 永久切断 | `Enabled: true`、`LegacyAuthCompat: false`、`LegacyAuthCutoff: true` | 旧登录端点稳定返回 `legacy_auth_disabled`，旧 Cookie 不再建立主体 |

Product Cookie 与 `_yapi_token`、`_yapi_uid` 使用不同名称。兼容期同时出现两类 Cookie 时，两者必须映射到同一 ECP Principal；否则 Product Session 会被撤销，浏览器 Cookie 被清除，请求返回 `dual_session_conflict`。

## 建立身份映射

不要直接修改 ECP 或 ApiMind 数据库。管理员通过 ECP Admin UI 的用户详情页选择“映射旧产品账号”，或调用：

```text
POST /api/v1/applications/{application_id}/legacy-identities
{
  "enterprise_id": "<enterprise_id>",
  "legacy_source": "yapi_user_id",
  "legacy_subject": "<原 ApiMind 用户数字 ID>",
  "principal_id": "<ECP principal ID>"
}
```

映射只允许幂等重放，不允许把同一个旧身份改绑到另一 Principal。ApiMind Connector 仅能通过具有 `identity.legacy.resolve` scope 的机器凭据解析映射。

Product Session 不复用旧密码或旧 Cookie。已有用户通过上述显式映射继续使用原数值 User ID；首次进入 ApiMind、且不存在旧映射的企业 Principal 会在 ApiMind 数据库生成一个 `type=enterprise` 的本地业务投影，用于兼容现有作者、成员和文档字段。投影与 Principal 通过独立的 `ecp_product_user_links` 集合绑定，邮箱只作为展示和冲突检测字段，绝不用于自动合并或授权。若邮箱已被旧账号占用，系统返回 `enterprise_identity_mapping_required`，管理员必须先建立显式旧身份映射。

## 启用兼容期

1. 完成 ECP、Casdoor、ApiMind Connector 和 Delegation KeySet 配置。
2. 盘点所有仍活跃的 ApiMind 用户并建立映射；不迁移密码、Cookie 或原始凭据。
3. 设置 `LegacyAuthCompat: true` 与未来且不超过 30 天的 `LegacyAuthDeadline`。
4. 重启 ApiMind。确认企业登录成功，旧登录响应包含 `Deprecation: true` 与 `Sunset`。
5. 在 ECP 审计中持续检查 `legacy_auth.use`；无法写入审计 Outbox 时兼容请求失败关闭。

## 永久切断前置条件

只有同时满足以下条件才能设置 `LegacyAuthCutoff: true`：

- 所有活跃旧用户均已映射；
- 身份冲突为零；
- 连续 14 天没有成功的 `legacy_auth.use`；
- 旧认证、双 Cookie、ECP 不可用和企业登录回归测试全部通过；
- 已完成 ApiMind MongoDB、ECP 数据库与 Casdoor 数据库的同一恢复点备份。

切断时设置 `LegacyAuthCompat: false`、`LegacyAuthCutoff: true`，随后重启并验证旧端点返回 `legacy_auth_disabled`。历史 YApi 用户文档继续保留，用于作者信息和历史追溯。

## 回滚

永久切断前，可以恢复上一份 ApiMind 配置和登录 UI；既有身份映射与审计记录必须保留。永久切断后禁止重新打开已过期的兼容开关；回滚必须使用切断前的发布包与协调备份恢复，并重新执行完整迁移评估。
