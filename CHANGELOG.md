# nextefb

## 0.4.0

### Minor Changes

- [#8](https://github.com/immrk/next-efb/pull/8) [`a530dcc`](https://github.com/immrk/next-efb/commit/a530dcc7ac0b1bfaf46f16583eec586e54dc6b14) Thanks [@immrk](https://github.com/immrk)! - Improve chart-library performance and reliability for large collections.

  - Load airport summaries first and fetch charts only when an airport is expanded, with a virtualized, single-expand sidebar on both the chart and map pages.
  - Reconcile deleted managed chart files with the library automatically and synchronize real chart changes across desktop and LAN clients.
  - Refine chart-library empty, loading, selection, and background-refresh states so selecting a chart no longer reloads its airport list.
  - Keep the live aircraft marker visible above imported route waypoints without changing its appearance.

## 0.3.0

### Minor Changes

- [#6](https://github.com/immrk/next-efb/pull/6) [`3b3ba0d`](https://github.com/immrk/next-efb/commit/3b3ba0dac218fd1c654ca964f7c6c2bdf101458f) Thanks [@immrk](https://github.com/immrk)! - Add system-locale detection and English-fallback translations for Simplified Chinese, Traditional Chinese, Japanese, and Korean, with synchronized desktop and LAN language switching, refreshed project documentation, and an MIT open-source license.

### Patch Changes

- [#6](https://github.com/immrk/next-efb/pull/6) [`3b3ba0d`](https://github.com/immrk/next-efb/commit/3b3ba0dac218fd1c654ca964f7c6c2bdf101458f) Thanks [@immrk](https://github.com/immrk)! - Render georeferenced chart overlays below imported flight-plan routes so route lines, highlights, and interaction targets remain visible.

## 0.2.0

### Minor Changes

- [#1](https://github.com/immrk/next-efb/pull/1) [`c5160e0`](https://github.com/immrk/next-efb/commit/c5160e0ca14780693457db382256eb920f28ac9f) Thanks [@immrk](https://github.com/immrk)! - Add automated GitHub Release packaging, Changesets versioning, and in-app update checks with one-click download and installation.
