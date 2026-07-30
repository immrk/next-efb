# Release and automatic update workflow

NextEFB uses Changesets, GitHub Actions, electron-builder, and
electron-updater as one release pipeline.

## Developer workflow

For each pull request that changes the installed application:

1. Run `npm run changeset`.
2. Choose the SemVer impact:
   - `patch` for compatible fixes.
   - `minor` for compatible features.
   - `major` for breaking changes.
3. Commit the generated Markdown file under `.changeset/` with the code.

Documentation, tests, and CI-only changes may omit a changeset.

## What happens on `master`

The `Version and Release` workflow has two mutually exclusive paths:

1. If unreleased changesets exist, `changesets/action` creates or updates the
   `chore: release new version` pull request. That PR updates
   `package.json`, `package-lock.json`, and `CHANGELOG.md`, and consumes the
   pending changesets.
2. After the version pull request is merged, no pending changesets remain.
   The workflow runs type checks and unit tests, builds the Windows NSIS
   installer, and creates `v<package version>` as a GitHub Release.

The release uploads all files required by electron-updater:

- `NextEFB-<version>-Setup.exe`
- `NextEFB-<version>-Setup.exe.blockmap`
- `latest.yml`

`app.getVersion()` reads the version from the packaged `package.json`, so the
version displayed in Settings is the same version used by the installer, Git
tag, and GitHub Release.

## Repository setup

In GitHub repository settings:

- Set Actions workflow permissions to **Read and write permissions**.
- Allow GitHub Actions to create pull requests.
- Keep `master` protected; the workflow writes version changes through a pull
  request instead of pushing directly to it.
- Keep GitHub Releases public. Do not embed a private-repository token in the
  desktop application. A private repository needs an authenticated update
  proxy or a separate public download repository.

The built-in `GITHUB_TOKEN` is enough to create the version pull request and
release. For production, add these optional signing secrets:

- `WINDOWS_CSC_LINK`: the Windows code-signing certificate accepted by
  electron-builder.
- `WINDOWS_CSC_KEY_PASSWORD`: the certificate password.

Unsigned local builds still compile, but production installers should be
signed so Windows can verify publisher identity and updater downloads.

## Desktop update behavior

Installed Windows builds check the latest stable GitHub Release shortly after
startup. When a newer version is available:

- The sidebar shows an upgrade button and download progress.
- Settings shows current/latest versions, release date, release notes, status,
  and manual check controls.
- Clicking **Download and Install** downloads the installer, exits NextEFB,
  starts the installer, and launches the app again after installation.

Development builds and LAN browser sessions report automatic updates as
unsupported. They never receive updater privileges through the renderer.

## Recovery

The workflow is idempotent for a package version: if `v<version>` already
exists, it does not publish a duplicate. If a release step fails after the
version pull request is merged, fix the failure and use **Run workflow** on
`master`; the missing release will be rebuilt.
