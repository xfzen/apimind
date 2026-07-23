# Third-Party Notices

This file supplements, and does not replace, the license terms shipped with the repository or its dependencies.

## YApi

ApiMind Web is derived from the YApi project originally developed by the YMFE Team.

- Copyright: 2017 The YMFE Team
- License: Apache License 2.0
- License text: [`LICENSE`](LICENSE)
- Upstream project: <https://github.com/YMFE/yapi>

Existing source-file attribution and license headers are retained. ApiMind Web is independently maintained and is not affiliated with, sponsored by, or endorsed by YMFE or the official YApi project.

## JavaScript dependencies

Runtime and development packages are declared in `package.json` and locked in `package-lock.json`. Each package remains governed by its own license and copyright notices. A distribution process must preserve license files supplied by those packages and should generate a dependency/SBOM report from the exact lockfile used for that distribution.

## Embedded browser assets

The repository contains historical browser-side libraries, icons, and fonts under `common/`, `client/font/`, and `static/iconfont/`. Embedded files that contain their own copyright or license headers retain those notices. No statement in ApiMind documentation relicenses those assets.

If an asset is replaced or newly vendored, contributors must record its source, version, license, and any required attribution before merging it.
