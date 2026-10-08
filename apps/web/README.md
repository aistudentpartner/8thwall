# Browser Studio development preview

A loopback-only Node.js project service for the original 8th Wall scene editor.
This is an in-progress browser migration, not a hosted multi-user platform.

See [繁體中文啟動與驗收說明](../../docs/browser-studio-quickstart.zh-TW.md) for installation, tests, supported features and limitations.

From the repository root, after installing and building the editor:

```sh
npm ci --prefix apps/web
npm start --prefix apps/web
```

Open `http://127.0.0.1:8080/?lang=zh-TW`. The server binds only to loopback.
Projects live in `apps/web/.data/` by default (`STUDIO_DATA_DIR` overrides it).
Do not expose this service through a public proxy: authentication and project authorization are not implemented yet.
