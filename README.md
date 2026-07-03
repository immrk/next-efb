# NextEFB

NextEFB 是面向 Microsoft Flight Simulator 的 Electron 桌面电子飞行包，提供地图、航路规划、航图管理、地理配准、SimConnect 遥测与局域网访问。

## 技术栈

- Electron Forge + Vite 多窗口 + tsup + TypeScript
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

`npm run dev` 与模板一致：读取 `src/config/windowConfig.ts`，为 `main`、`setting`、`login` 分别启动 Vite 服务。另开终端执行 `npm run watch`，由 nodemon 监听主进程并通过 tsup 持续重建。

在 VS Code 中先执行 `renderer-dev` 任务，再启动 `Electron TS Development` 调试配置即可进入模板同款调试流程。单独调试窗口可使用 `npm run dev:main`、`npm run dev:setting` 或 `npm run dev:login`。

## 验证

```bash
npm run typecheck
npm test
npm run build
```

`npm run uat` 会启动带本地 Mock API 的浏览器验收环境，用于在没有 Electron、MSFS、SimConnect 或导航数据库时检查所有页面和交互。

## 打包

```bash
npm run package
npm run make
```

项目使用与模板一致的 Electron Forge 打包链路：`package` 生成未安装应用，`make` 生成当前平台安装产物。原生依赖更新后可执行 `npm run rebuild-native`。
