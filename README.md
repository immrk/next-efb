# NextEFB

NextEFB 是基于 Electron Modern Template 迁移的桌面 EFB。项目保留了原有的 MSFS SimConnect、航路规划、导航数据、航图管理、地理配准、地图叠加与局域网访问能力，并统一使用 Electron Forge、Vite、tsup、React、Tailwind CSS v4 和 shadcn/ui。

## 技术栈

- Electron 36 + Electron Forge
- React 19 + TypeScript
- Vite 6 + tsup
- Tailwind CSS v4 + shadcn/ui + Lucide
- React Router（HashRouter）
- Zustand + i18next
- Leaflet + React Leaflet
- better-sqlite3 + node-simconnect

## 项目结构

```text
src/
├─ config/                 # 模板窗口、菜单与 i18n 配置
├─ main/
│  ├─ ipc/                 # 模板 IPC 与 NextEFB IPC
│  ├─ preload/             # 多窗口 preload API
│  ├─ services/            # SimConnect、导航、存储、LAN 服务
│  ├─ main.ts              # 主进程入口
│  └─ windowManager.ts     # 模板窗口管理器
├─ renderer/
│  ├─ components/ui/       # shadcn/ui 组件
│  ├─ pages/               # 地图、航图、设置与航图编辑页面
│  ├─ styles/              # 模板主题
│  └─ window/
│     ├─ main/             # 主窗口
│     ├─ setting/          # 设置窗口
│     └─ login/            # 模板登录窗口
└─ shared/                 # 主进程、preload、renderer 共享类型
```

## 安装

```bash
npm install
npm run rebuild-native
```

## 开发

开发方式与 Electron Modern Template 一致：

1. 运行 `npm run dev`，启动 main、setting、login 三个 Vite 窗口。
2. 在 VS Code 中启动 `Electron TS Development` 调试配置。
3. 如需持续重编译主进程，可另开终端运行 `npm run watch`。

也可以只启动指定窗口：

```bash
npm run dev -- --only=main,setting
```

## 检查与构建

```bash
npm run typecheck
npm run build
npm run start
```

生成当前平台安装包：

```bash
npm run make
```

构建输出位于 `dist/`，Electron Forge 输出位于 `out/`。

## 页面与交互

- 主窗口保持模板的无边框 TitleBar、固定 64px 左侧导航栏、HashRouter 与主题布局。
- 通用按钮、输入框、选择器、标签页、提示、滑块和开关均使用 shadcn/ui。
- 自定义 CSS 只用于地图、Leaflet 图层、航图画布、地理配准和业务抽屉等专用布局，颜色与字体均来自模板主题 token。
- 桌面端设置按钮打开独立设置窗口；LAN 网页端仍在主窗口内打开设置页。
