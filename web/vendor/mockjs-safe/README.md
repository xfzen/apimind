# @apimind/mockjs-safe

This private package is generated from the official Mock.js 1.1.0 npm artifact:

- Tarball: `https://registry.npmjs.org/mockjs/-/mockjs-1.1.0.tgz`
- Integrity: `sha512-eQsKcWzIaZzEZ07NuEyO4Nw65g0hdWAyurVol1IPl1gahRwY+svqzfgfey8U8dahLwG44d6/RwEzuK52rSa/JQ==`

The generated distribution preserves the upstream API and license. The only
code change is the workaround published for CVE-2023-26158: `Util.extend`
ignores the dangerous `__proto__`, `constructor`, and `prototype` keys.

Regenerate after installing official `mockjs@1.1.0`:

```sh
node scripts/vendor-mockjs-safe.mjs
```
