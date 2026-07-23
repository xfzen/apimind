# ApiMind Licensing

ApiMind is a multi-license repository.

| Path | License |
| --- | --- |
| Root integration files and documentation | Apache License 2.0 |
| `web/` | Apache License 2.0 |
| `skills/` | Apache License 2.0 |
| `server/` submodule | BUSL-1.1, Apache-2.0 exceptions, and applicable third-party licenses |

The root [`LICENSE`](LICENSE) covers original files maintained directly in
this repository, including `web/`, `skills/`, root documentation, integration
scripts, and deployment definitions. The same Apache-2.0 text is also included
in [`web/LICENSE`](web/LICENSE) and [`skills/LICENSE`](skills/LICENSE).

The root license does **not** apply to the [`server/`](server/) Git submodule.
ApiMind Server is maintained and versioned independently at
<https://github.com/xfzen/apimind-server>. Its licensing boundary is defined by
the legal files committed in that repository, including `LICENSE`,
`LICENSING.md`, `LICENSES/`, and third-party notices.

Files carrying an explicit license or third-party notice remain governed by
that notice. Distributions that bundle multiple components must include all
applicable licenses and notices.

---

# ApiMind 授权说明

ApiMind 是一个多许可证仓库：

- 根目录集成文件、文档、`web/` 和 `skills/` 使用 Apache-2.0；
- `server/` 是独立版本化的 Git submodule，根目录 Apache-2.0 不覆盖它；
- ApiMind Server 使用 BUSL-1.1，并包含独立采用 Apache-2.0 的公共契约文件和适用的第三方材料；
- 文件自身携带的明确许可证或第三方声明优先适用；
- 同时分发多个组件时，必须一并提供所有适用的许可证和声明。
