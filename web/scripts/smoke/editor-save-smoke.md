# Editor Save Smoke

This is the live browser smoke for the interface editor. It must be run after the module-level smoke passes.

## Preconditions

- `make dev` is running for MongoDB and apimind.
- `make web-dev` is running for local YApi Web.
- YApi Web is reachable at `http://127.0.0.1:4001` or the value of `YAPI_WEB_BASE_URL`.
- apimind API is reachable at `http://127.0.0.1:8888` or the value of `APIMIND_API_BASE_URL`.
- Login account is the configured dev account.

## Steps

1. Open YApi Web.
2. Log in.
3. Create a project if no test project exists.
4. Enter the project.
5. Create an interface if no test interface exists.
6. Open the interface edit page.
7. Type a unique marker into the remarks editor, for example `editor-save-smoke-${Date.now()}`.
8. Click save.
9. Confirm the browser console does not show `this.editor.getHtml is not a function` or `this.editor.getHTML is not a function`.
10. Confirm Network contains a successful `/api/interface/up` request with `errcode: 0`.
11. Reopen the interface view and confirm the unique marker is visible in the remarks section.

## Pass Criteria

- Save button triggers `/api/interface/up`.
- Response envelope has `errcode: 0`.
- The saved marker is visible after reload.
- No editor API exception appears in the console.
