# MSFS Desktop Tracker MVP 2.0

## 1. Product goal

Build a private desktop chart management product for Microsoft Flight Simulator users.

Compared with MVP 1.0, MVP 2.0 expands from "show aircraft on a map" into:

- map-based aircraft tracking
- private chart library management
- local chart file storage
- chart metadata configuration
- chart georeferencing with a two-point binding workflow
- chart viewing with aircraft position display

## 2. Core product capabilities

### 2.1 Map page

- show current aircraft position
- show base map
- allow choosing a chart overlay
- allow entering chart georeference mode
- support selecting 2 control points on map
- apply chart overlay after registration

### 2.2 Chart management page

- import chart PDF/image files
- store imported files locally
- edit chart metadata
- show chart file type, status, airport code, and tags
- open georeference workflow

### 2.3 Chart viewer page

- view one chart independently
- display aircraft position on chart when chart has been georeferenced
- support zoom / pan
- show registration status

### 2.4 Settings page

- language
- aircraft data provider
- map behavior
- storage paths
- future backup/export options

## 3. Data storage strategy

All app data remains local.

### 3.1 SQLite

Use local SQLite for metadata and bindings:

- chart records
- file records
- georeference point records
- chart-to-map binding transforms
- user settings

Recommended database file:

- `data/app.db`

### 3.2 Local file storage

Store uploaded chart source files locally under an app-managed folder.

Recommended structure:

```text
data/
  app.db
  charts/
    <chart-id>/
      source.pdf
      preview.png
      meta.json
```

The database stores file paths and metadata. The UI loads files using SQLite metadata and local storage paths.

## 4. Two-point georeference workflow

### 4.1 User flow

1. User imports a chart
2. User opens georeference mode
3. User selects point A and point B on the world map
4. User selects corresponding point A and point B on the chart
5. App computes transform parameters
6. Chart is marked as georeferenced
7. Chart can be shown on map or in the chart viewer

### 4.2 MVP 2.0 transform model

Use a simple two-point registration model for the first implementation:

- translation
- rotation
- scale

This is enough for many airport diagram / approach chart use cases where local distortion is limited.

Future versions can add:

- 3-point affine transform
- full projective transform
- rubber-sheet correction

## 5. Pages

### 5.1 Route structure

- `/map`
- `/charts`
- `/charts/:id`
- `/settings`

### 5.2 Main navigation

- Map
- Charts
- Settings

## 6. Domain model

### 6.1 Chart

```ts
interface ChartRecord {
  id: string
  title: string
  airportCode: string | null
  chartType: 'airport' | 'sid' | 'star' | 'approach' | 'general'
  sourceFilePath: string
  previewImagePath: string | null
  fileFormat: 'pdf' | 'png' | 'jpg' | 'jpeg'
  width: number | null
  height: number | null
  isGeoreferenced: boolean
  createdAt: number
  updatedAt: number
}
```

### 6.2 Registration points

```ts
interface GeoReferencePoint {
  id: string
  chartId: string
  index: 1 | 2
  mapLat: number
  mapLon: number
  chartX: number
  chartY: number
}
```

### 6.3 Registration result

```ts
interface ChartRegistration {
  chartId: string
  scale: number
  rotationDeg: number
  translateX: number
  translateY: number
  originLat: number
  originLon: number
  updatedAt: number
}
```

## 7. SQLite schema proposal

### 7.1 `charts`

- `id TEXT PRIMARY KEY`
- `title TEXT NOT NULL`
- `airport_code TEXT`
- `chart_type TEXT NOT NULL`
- `source_file_path TEXT NOT NULL`
- `preview_image_path TEXT`
- `file_format TEXT NOT NULL`
- `width INTEGER`
- `height INTEGER`
- `is_georeferenced INTEGER NOT NULL DEFAULT 0`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`

### 7.2 `chart_reference_points`

- `id TEXT PRIMARY KEY`
- `chart_id TEXT NOT NULL`
- `point_index INTEGER NOT NULL`
- `map_lat REAL NOT NULL`
- `map_lon REAL NOT NULL`
- `chart_x REAL NOT NULL`
- `chart_y REAL NOT NULL`
- `created_at INTEGER NOT NULL`

### 7.3 `chart_registrations`

- `chart_id TEXT PRIMARY KEY`
- `scale REAL NOT NULL`
- `rotation_deg REAL NOT NULL`
- `translate_x REAL NOT NULL`
- `translate_y REAL NOT NULL`
- `origin_lat REAL NOT NULL`
- `origin_lon REAL NOT NULL`
- `updated_at INTEGER NOT NULL`

### 7.4 `app_settings`

- `key TEXT PRIMARY KEY`
- `value TEXT NOT NULL`

## 8. Main process services

- `AircraftService`
- `ChartRepository`
- `ChartFileService`
- `ChartRegistrationService`
- `SettingsRepository`

## 9. Renderer modules

- `MapPage`
- `ChartsPage`
- `ChartDetailPage`
- `SettingsPage`
- `NavigationShell`
- `ChartLibraryStore`
- `RegistrationEditor`

## 10. MVP 2.0 implementation order

1. Upgrade app shell to multi-page layout
2. Add chart domain types
3. Add empty-state chart library page
4. Add local repository/service interfaces
5. Add SQLite repository implementation
6. Add file import pipeline
7. Add chart detail viewer
8. Add two-point registration UI
9. Add chart overlay rendering on map

## 11. Acceptance criteria

- app has separate map, charts, and settings pages
- chart management flow has a clear UI and local data model
- chart metadata is designed around SQLite persistence
- local file storage layout is defined
- georeference workflow is defined and ready for implementation
