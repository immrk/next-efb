# 渲染层局域网远程访问技术方案

## 1. 目标

为当前 `Electron + Vue 3 + TypeScript` 项目的渲染层提供局域网远程访问能力，使同一局域网内的平板、笔记本、第二屏设备可以访问地图、航图和状态页面，同时继续保留 Electron 本机作为：

- 飞行数据采集端
- 本地 SQLite / 文件存储端
- 图库导入与本地管理端
- 局域网服务宿主

本方案的重点不是“远程控制 Electron 窗口”，而是把现有渲染层升级为可同时运行在：

- Electron 本地窗口
- 局域网浏览器

的双宿主前端。

## 2. 当前项目现状评估

结合现有代码，项目具备以下特征：

- 主进程负责 `SimConnect` 数据接入、设置持久化、图库存储和 IPC 分发
- 渲染层通过 `window.msfsApi` 读取数据，当前只适用于 Electron preload 注入
- 航图资源来自本地文件系统，当前通过 IPC 直接返回 `base64`
- 地图底图依赖公网 `OpenStreetMap` 瓦片
- 图库导入使用系统文件选择器，只适合本机操作
- 飞机状态更新采用 IPC 推送，本质上已经接近事件流模型

这说明：

1. 数据源和存储层已经在主进程集中管理，适合扩展为局域网服务端。
2. 最大障碍不在数据采集，而在渲染层对 Electron IPC 的强绑定。
3. 静态资源和航图文件不能继续全部走 `base64 IPC`，否则远程访问性能和内存占用会迅速恶化。

## 3. 推荐总体方案

推荐采用“**Electron 主进程内嵌 LAN Web 服务 + 渲染层双适配 + WebSocket 实时推送 + HTTP 静态资源分发**”方案。

### 3.1 总体架构

```text
MSFS / Mock
   |
   v
SimConnectService
   |
   +--> FlightStateStore
   +--> SettingsStore
   +--> ChartRepository / StorageService
   |
   +--> Electron IPC Adapter --------------> Electron Renderer
   |
   +--> LAN HTTP API + WebSocket Server ---> Browser Renderer (LAN)
```

### 3.2 为什么推荐这条路线

- 不需要把 Electron 窗口做远控，稳定性和安全性更好
- 主进程已经是天然的数据聚合点，改造成本低
- Web 端和桌面端共用 Vue 页面和组合式状态模型
- 便于后续扩展到“只读副屏模式”“教员观察模式”“移动端查看模式”
- 后续若要做外网访问，也可在该层继续演进

## 4. 目标能力边界

建议把局域网远程访问划分成两个等级。

### 4.1 第一阶段：只读远程访问

允许远端设备查看：

- 地图页
- 飞机位置和连接状态
- 航图列表
- 航图详情与叠加效果
- 设置只读摘要

不允许远端执行：

- 导入文件
- 删除航图
- 修改设置
- 保存配准点

这是最适合先落地的版本，风险最低。

### 4.2 第二阶段：受控写操作

在确认安全模型和冲突控制后，再开放：

- 远端修改部分设置
- 远端选择叠加航图
- 远端保存航图元数据

仍然不建议远端开放：

- 系统文件选择器
- 本地目录变更
- 任意文件读写

## 5. 关键设计

## 5.1 渲染层解耦

当前渲染层直接调用 `window.msfsApi.*`。需要抽象出统一的前端数据访问层，例如：

```ts
interface AppClient {
  getSnapshot(): Promise<...>
  getSettings(): Promise<...>
  listCharts(): Promise<...>
  getChart(id: string): Promise<...>
  getChartAssetUrl(id: string): string
  subscribeAircraft(listener: ...): () => void
  subscribeConnection(listener: ...): () => void
}
```

提供两个实现：

- `ElectronAppClient`
  - 继续通过 `window.msfsApi`
- `WebLanAppClient`
  - 通过 `fetch + WebSocket`

渲染层页面、hooks、store 只依赖 `AppClient`，不再直接依赖 preload API。

### 需要调整的现有位置

- `src/renderer/hooks/useDesktopData.ts`
- `src/renderer/hooks/useChartLibraryData.ts`
- `src/renderer/hooks/useChartDetailData.ts`
- `src/renderer/hooks/useMapOverlayChart.ts`
- 任何直接使用 `window.msfsApi` 的组件或 hook

## 5.2 局域网服务端

在 Electron 主进程新增一个 LAN 服务模块，例如：

```text
src/main/services/lan/
  LanServer.ts
  LanHttpRouter.ts
  LanWsHub.ts
  LanAuth.ts
```

### 职责

- 提供 HTTP API
- 托管 Web 静态资源
- 提供 WebSocket 实时状态流
- 控制认证、访问范围、CORS、局域网绑定地址

### 推荐监听配置

- 默认关闭
- 用户在设置页显式开启
- 默认监听 `0.0.0.0:31831`
- 设置页展示访问地址，例如：
  - `http://192.168.1.15:31831`

## 5.3 API 设计

建议采用“快照 + 事件流”模式。

### HTTP 只读接口

- `GET /api/health`
- `GET /api/snapshot`
- `GET /api/settings`
- `GET /api/charts`
- `GET /api/charts/:id`
- `GET /api/charts/:id/reference-points`
- `GET /api/charts/:id/asset`
- `GET /api/storage-summary`

### WebSocket 事件

- `aircraft:update`
- `connection:update`
- `chart:changed`
- `settings:changed`

### 远程写接口

仅在第二阶段开放，并默认关闭：

- `PATCH /api/settings`
- `PATCH /api/charts/:id`
- `PUT /api/charts/:id/reference-points`

## 5.4 航图与静态资源策略

这是本项目最需要重点处理的部分。

当前航图资源通过 IPC 返回 `base64`，这在局域网模式下不适合作为主通道。建议改为：

- 元数据仍走 JSON API
- 大文件资源走 HTTP 文件流

### 推荐资源访问模式

- `GET /assets/charts/:chartId/preview`
- `GET /assets/charts/:chartId/source`

返回：

- `Content-Type`
- `Content-Length`
- `ETag`
- `Cache-Control`

### 原因

- 降低主进程内存峰值
- 浏览器可直接缓存图片
- 便于 PDF/图片分离处理
- 后续可支持 Range 请求

### 对 PDF 的建议

当前系统已在导入 PDF 时生成单页预览图，这非常适合局域网模式：

- 地图叠加和图预览优先使用 `preview`
- 原始 PDF 仅在详情页按需打开

这样能显著减少移动设备解码压力。

## 5.5 地图底图策略

当前前端直接使用公网 OSM 瓦片：

- `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

对于局域网远程访问，这一块需要单独规划。

### 推荐策略

第一阶段：

- 保持现有 OSM 方案
- 在设置中加入“地图瓦片源 URL”配置

第二阶段：

- 支持自定义瓦片源
- 支持局域网本地瓦片代理或缓存

第三阶段：

- 可选自建/内网瓦片服务，避免多个终端直接访问公网 OSM

### 原因

如果同时有多个局域网终端打开地图页，公网瓦片访问量会放大，可能触发限流或体验不稳定。

## 5.6 认证与安全

虽然是局域网，也不要默认裸奔开放。

### 最低要求

- 服务默认关闭
- 首次开启时生成随机访问令牌
- 请求需带 `Authorization: Bearer <token>` 或 URL 配对码
- 设置页支持重新生成令牌
- 只监听局域网网卡，不开放端口转发说明外的外网访问

### 推荐附加措施

- 可配置“只读模式”
- 可配置允许的网段，例如仅 `192.168.0.0/16`
- WebSocket 握手校验 token
- 请求日志记录最近访问设备 IP 和时间

### 不建议做的事

- 不建议默认无密码访问
- 不建议直接暴露本地任意文件路径
- 不建议把 Electron 全量 IPC 能力映射成远程接口

## 5.7 本机端与远端权限划分

建议明确角色：

### 本机 Electron

- 完整权限
- 文件导入
- 数据删除
- 设置修改
- 图库维护

### 局域网浏览器

- 默认只读
- 查看地图、航图、飞机状态
- 后续可开放少量低风险写操作

这会让架构长期更稳定，避免把桌面端做成“可从浏览器完全接管的后台”。

## 6. 推荐实施路径

## 6.1 阶段 A：前端适配层改造

目标：让现有 Vue 页面同时支持 Electron 和 Web。

### 工作项

1. 新增 `AppClient` 抽象层
2. 新增 `ElectronAppClient`
3. 新增 `WebLanAppClient`
4. 将所有 `window.msfsApi` 直接调用迁移到 client 层
5. 为渲染层加入运行宿主识别

### 验收标准

- Electron 模式功能不回退
- hooks 不再直接依赖 `window.msfsApi`

## 6.2 阶段 B：主进程 LAN 服务

目标：在主进程提供只读 HTTP + WebSocket 能力。

### 工作项

1. 新增 `LanServer`
2. 暴露快照、图库、资源流接口
3. 将飞行状态和连接状态同步到 WebSocket
4. 提供开关、端口、令牌配置

### 验收标准

- 浏览器可访问 `health`
- 可获取飞行快照和图库列表
- 飞机移动时浏览器端实时刷新

## 6.3 阶段 C：Web 端入口

目标：构建浏览器可访问的渲染层产物。

### 工作项

1. 在 `electron.vite.config.ts` 基础上新增 LAN Web 构建入口
2. 产出一套供主进程托管的 web 资源目录
3. 增加浏览器环境的启动参数注入

### 推荐方式

- 继续共用 Vite/Vue 工程
- 区分 `electron renderer build` 和 `lan web build`

### 验收标准

- 通过浏览器打开局域网地址后可正常进入 Vue 页面
- 样式、i18n、PDF 预览资源均可正常加载

## 6.4 阶段 D：安全与运维增强

目标：让方案真正可长期使用。

### 工作项

1. token 鉴权
2. 设置页 LAN 开关与地址展示
3. 访问日志
4. 错误处理与连接断线提示
5. 可选只读锁

## 7. 目录与模块建议

建议新增如下结构：

```text
src/
  main/
    services/
      lan/
        LanServer.ts
        LanHttpRouter.ts
        LanWsHub.ts
        LanAuth.ts
  renderer/
    client/
      AppClient.ts
      ElectronAppClient.ts
      WebLanAppClient.ts
      AppClient.ts
    web/
      main.ts
```

## 8. 关键实现建议

## 8.1 飞行状态同步

保留主进程中的单一状态源：

- `FlightStateStore`
- `SimConnectService`

Electron IPC 和 LAN WebSocket 都只从这一状态源取数据，不要各自重复维护一套缓存逻辑。

## 8.2 图库同步

当前已有 `chartSync` 的前端刷新机制。LAN 版本里建议：

- 主进程在图库变化后发送 `chart:changed`
- 浏览器端收到事件后调用 `GET /api/charts`
- 避免把完整大对象频繁通过 WebSocket 广播

## 8.3 资源 URL 化

当前 `useChartRasterAsset` 依赖 `base64` 转 Blob。建议调整为双模式：

- Electron 模式继续支持 `base64`
- LAN Web 模式优先使用直接 URL

最终建议把接口收敛为：

```ts
type ChartRenderableAsset =
  | { mode: 'inline'; base64: string; mimeType: string; fileFormat: ... }
  | { mode: 'url'; url: string; mimeType: string; fileFormat: ... }
```

这样前端不需要知道自己运行在哪种宿主。

## 8.4 文件上传策略

不建议在第一阶段支持远端上传本地文件。原因：

- 浏览器上传会引入新的权限和安全边界
- PDF 转预览图逻辑需要重新设计到服务端
- 本机和远端同时管理图库容易引入冲突

建议先把“远端访问”定义为观察和辅助查看能力。

## 9. 可执行开发顺序

建议按下面顺序推进，能最快看到可用结果：

1. 抽离 `AppClient`
2. 让 Electron 端继续跑通
3. 在主进程加只读 HTTP `health/snapshot/charts`
4. 新增 WebSocket 推送飞机状态
5. 为航图提供 `/assets/charts/:id/preview`
6. 输出一份 web 构建并在浏览器打开地图页
7. 接入 token 和 LAN 设置页
8. 再评估是否开放远端写能力

## 10. 验收清单

完成后，至少应满足以下验收项：

- 同一局域网设备可通过浏览器打开项目页面
- 页面可显示飞机实时位置和连接状态
- 页面可浏览图库并查看航图详情
- 已配准航图可在地图页叠加显示
- 远端访问不依赖 Electron preload
- 资源访问不再全部依赖 `base64 IPC`
- 服务可关闭、可改端口、可重置 token
- 默认只读且未暴露本机任意文件能力

## 11. 对本项目的最终建议

基于当前代码基础，最合适的落地方案是：

- **保留 Electron 主进程作为唯一数据与存储中心**
- **把 Vue 渲染层保持为 Electron/Web 双宿主**
- **在主进程内新增只读局域网 Web 服务**
- **将航图等大资源从 IPC base64 改为 HTTP 资源流**
- **默认只开放只读远程访问，写操作后置**

这条路线改动量可控、风险最低，而且与当前项目已有的主进程集中式架构高度吻合。

如果要继续实施，建议下一步直接进入“阶段 A + 阶段 B”的代码改造，而不是先做远程桌面或窗口投屏类方案。
