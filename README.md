# NextEFB

NextEFB 是面向 Microsoft Flight Simulator 的 Electron 桌面电子飞行包，提供地图、航路规划、航图管理、地理配准、SimConnect 遥测与局域网访问。

## 技术栈

- Electron + electron-vite + TypeScript
- Vue 3 + Vue Router
- Element Plus
- Leaflet
- better-sqlite3
- node-simconnect
- Vitest + Vue Test Utils

渲染层完全采用 `Electron-Modern-Template` 的 Vue、Element Plus、标题栏、侧边栏与 Tab 路由结构。业务界面使用 Element Plus 默认主题和语义色，不维护自定义颜色或字号体系。

## 页面

- 地图：实时飞机状态、导航数据图层、信息点搜索、底图切换、航路绘制、SimBrief 导入和航图挂载。
- 航图：本地导入、网络链接导入、搜索、元数据编辑、程序绑定、地图/航图双点地理配准和删除。
- 设置：语言、数据来源、底图、航图透明度、导航数据库、航图库路径、SimBrief 与局域网访问。
- 登录：保留模板 Mock 登录，当前不接入真实认证服务。

## 项目结构

```text
src/
  config/
    windowConfig.ts
  main/
    main.ts
    preload/
    ipc/
    services/
  renderer/
    client/
    composables/
    i18n/
    locales/
    utils/
    window/
      main/
        components/
        router/
        views/
  shared/
tests/
```

## 开发

```bash
npm install
npm run dev
```

## 验证

```bash
npm run typecheck
npm test
npm run build:bundle
```

`npm run uat` 会启动带本地 Mock API 的浏览器验收环境，用于在没有 Electron、MSFS、SimConnect 或导航数据库时检查所有页面和交互。

## 打包

```bash
npm run build
```

默认产出 Windows NSIS 安装包。原生依赖更新后可执行 `npm run rebuild-native`。
