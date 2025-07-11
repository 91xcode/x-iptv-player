# X-IPTV Player

一个基于 Electron + Vue 3 的现代化 IPTV 播放器，支持 M3U/M3U8 播放列表，具有优雅的 Apple 风格界面设计。

## ✨ 主要功能

- 🎥 **多格式支持**: 支持 M3U/M3U8 播放列表格式
- 📺 **高质量播放**: 基于 HLS.js 和 mpegts.js 的专业视频播放
- 🎨 **现代化界面**: Apple 风格的优雅用户界面
- 📱 **响应式设计**: 适配不同屏幕尺寸
- 🔍 **智能搜索**: 支持播放列表和频道搜索
- 📋 **播放列表管理**: 添加、编辑、删除播放源
- 🎯 **虚拟滚动**: 高性能频道列表展示
- 🔧 **开发者工具**: 内置日志查看和调试功能

## 🚀 快速开始

### 环境要求

- Node.js v22.10.0 或更高版本
- npm 或 yarn 包管理器

### 安装依赖

```bash
# 使用指定的 Node.js 版本
nvm use v22.10.0

# 安装项目依赖
npm install

# 安装开发依赖
npm install electron --save-dev
npm install cross-env --save-dev
```

### 开发模式

```bash
# 启动开发服务器
npm run electron:dev

# 或者指定端口启动
npm run dev:port -- --port 3005
```




### 生产构建

```bash
# 构建 Web 应用
npm run build

# 打包 Electron 应用
npm run dist

# 平台特定打包
npm run electron:build:mac    # macOS
npm run electron:build:win    # Windows
npm run electron:build:linux  # Linux
```

### 清理构建

```bash
# 清理之前的构建
rm -rf dist
rm -rf release

# 重新安装依赖
npm install

# 构建和打包
npm run dist
```

## 📁 项目结构

```
x-iptv-player/
├── src/                          # 源代码目录
│   ├── App.vue                   # 主应用组件
│   ├── main.js                   # Vue 应用入口
│   ├── assets/                   # 静态资源
│   │   ├── electron.icns         # macOS 应用图标
│   │   ├── iptv.png             # 应用图标 PNG 格式
│   │   └── iptv-1.png           # 备用图标
│   └── components/               # Vue 组件
│       ├── AddPlaylistDialog.vue # 添加播放列表对话框
│       ├── EditPlaylistDialog.vue# 编辑播放列表对话框
│       └── Toast.vue            # 消息提示组件
├── scripts/                      # 构建脚本
│   └── dev.js                   # 开发服务器启动脚本
├── main.js                      # Electron 主进程
├── preload.js                   # Electron 预加载脚本
├── vite.config.js              # Vite 配置文件
├── package.json                # 项目配置和依赖
├── M3U8-Format-Guide.md        # M3U8 格式指南
├── PORT_USAGE.md               # 端口使用说明
└── README.md                   # 项目说明文档
```

## 🎯 使用说明

### 添加播放源

1. **在线播放列表**: 输入 M3U/M3U8 播放列表的 URL
2. **本地文件**: 选择本地的 M3U/M3U8 文件
3. **单个频道**: 直接输入单个 M3U8 流地址

### 播放控制

- 点击频道列表中的频道开始播放
- 使用搜索框快速查找频道
- 支持频道列表的显示/隐藏切换
- 频道按序号顺序排列，便于查找

### 播放列表管理

- **编辑**: 修改播放列表名称和地址
- **删除**: 移除不需要的播放列表
- **重复检测**: 自动检测并清理重复的播放源

## 🔧 开发者功能

### 调试工具

- **开发者工具**: 可通过设置菜单开启/关闭
- **日志查看**: 实时查看应用运行日志
- **详细日志**: 可选择显示详细的加载日志

### 技术栈

- **前端框架**: Vue 3 + Composition API
- **构建工具**: Vite
- **桌面框架**: Electron
- **视频播放**: HLS.js + mpegts.js
- **状态管理**: electron-store
- **样式设计**: Apple 风格 CSS

## ⚠️ 注意事项

### 图标文件
- `.icns` 文件必须是有效的 macOS 图标格式
- 图标文件需要包含多个尺寸（16x16, 32x32, 128x128, 256x256, 512x512 等）
- 可以使用 IconSet Creator 或 Image2icon 等工具将 PNG 转换为 .icns

### 播放源兼容性
- 支持标准的 M3U/M3U8 格式播放列表
- 推荐使用 HTTPS 协议的播放源以确保安全性
- 某些播放源可能需要特定的 User-Agent 或 Referer 头部

### 网络和性能
- 首次加载播放列表可能需要一些时间，请耐心等待
- 建议在稳定的网络环境下使用
- 大型播放列表（>1000个频道）会自动启用虚拟滚动优化性能

### 开发和调试
- 开发模式下默认关闭开发者工具，可通过设置菜单开启
- 生产环境构建前请确保清理 `dist` 和 `release` 目录
- 如遇到播放问题，可开启详细日志查看具体错误信息

## 🐛 常见问题

### 播放失败
1. 检查播放源地址是否有效
2. 确认网络连接正常
3. 查看日志面板获取详细错误信息

### 应用无法启动
1. 确认 Node.js 版本符合要求
2. 重新安装依赖：`rm -rf node_modules && npm install`
3. 检查端口是否被占用

### 图标不显示
1. 确认 `src/assets/electron.icns` 文件存在
2. 检查 `package.json` 中的图标路径配置
3. 重新构建应用

## 📄 许可证

本项目采用 MIT 许可证，详情请查看 LICENSE 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 📞 支持

如果您在使用过程中遇到问题，请：

1. 查看本文档的常见问题部分
2. 在 GitHub 上提交 Issue
3. 查看项目的 Wiki 页面获取更多信息