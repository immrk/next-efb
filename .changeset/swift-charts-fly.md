---
"nextefb": minor
---

Improve chart-library performance and reliability for large collections.

- Load airport summaries first and fetch charts only when an airport is expanded, with a virtualized, single-expand sidebar on both the chart and map pages.
- Reconcile deleted managed chart files with the library automatically and synchronize real chart changes across desktop and LAN clients.
- Refine chart-library empty, loading, selection, and background-refresh states so selecting a chart no longer reloads its airport list.
- Keep the live aircraft marker visible above imported route waypoints without changing its appearance.
