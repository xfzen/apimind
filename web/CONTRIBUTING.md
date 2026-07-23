# Contributing

## Scope

Keep this repository frontend-only. Do not add a Node backend, direct browser calls to remote ApiMind/YApi/business APIs, dependencies on neighboring repositories, or PC App build steps. Backend behavior belongs in the ApiMind Go service.

## Development workflow

1. Use Node.js 22 and npm 10 or newer.
2. Install the exact dependency tree with `npm ci`.
3. Run the Go service separately and start Web with `YAPI_API_TARGET=http://127.0.0.1:8888 npm run dev`.
4. Add or update focused tests before changing behavior.
5. Run `npm run lint`, `npm test`, repository-boundary tests, relevant smoke tests, and `npm run build`.

Do not commit `dist/`, dependency directories, local environment files, credentials, or generated test artifacts. Docker packaging requires a prebuilt `dist/` and must not compile the frontend.

## Licensing and vendored assets

Preserve existing author, copyright, and license headers. New vendored code, fonts, images, or archives require a documented source, version, license, and attribution in `THIRD_PARTY_NOTICES.md` when applicable.
