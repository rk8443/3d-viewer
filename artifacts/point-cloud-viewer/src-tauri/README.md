# 3D Viewer — Desktop (Tauri)

This folder turns the Vite web app into a native Windows desktop app
packaged as an MSI (and NSIS .exe) installer with a Start Menu entry
and desktop shortcut.

## How it works

- Tauri wraps the existing `artifacts/point-cloud-viewer` Vite build
  (output: `../dist/public`) in a small Rust shell.
- On Windows it uses the OS's WebView2 (built into Windows 10/11), so
  the installer stays around **5–10 MB**.
- The MSI is built by **GitHub Actions** on a Windows runner — see
  `.github/workflows/desktop-msi.yml`.

## Building locally (Windows only)

You need:

1. Node 20+ and pnpm
2. Rust (`rustup-init`, default `stable-msvc` toolchain)
3. Visual Studio "Build Tools" with the **Desktop development with C++** workload
4. WebView2 runtime (already on Windows 11; on Windows 10 it auto-installs)

Then from the repo root:

```bash
pnpm install
pnpm --filter @workspace/point-cloud-viewer run tauri build
```

The MSI lands in
`artifacts/point-cloud-viewer/src-tauri/target/release/bundle/msi/`.

For a hot-reload dev window: `pnpm --filter @workspace/point-cloud-viewer run tauri dev`.

## Building in the cloud (no Windows machine needed)

Push a tag like `v0.1.0`:

```bash
git tag v0.1.0
git push --tags
```

GitHub Actions will build the MSI on a Windows runner and attach it as
a GitHub Release asset. You can also trigger a manual build from the
**Actions** tab → "Build Windows MSI" → "Run workflow".

## Customizing

- **App name / installer name:** `productName` in `tauri.conf.json`
- **App identifier (used in registry):** `identifier` in `tauri.conf.json`
- **Window default size:** `app.windows[0]` in `tauri.conf.json`
- **Icon:** replace files in `icons/` (must keep the same filenames).
  Generate from a single 512×512 PNG with:
  `pnpm --filter @workspace/point-cloud-viewer exec tauri icon path/to/icon.png`
