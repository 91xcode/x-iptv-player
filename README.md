如何使用：
环境：
nvm use v22.10.0

安装包：
npm install electron --save-dev
npm install cross-env --save-dev

本地测试：
npm run electron:dev








在打包前清理并重新构建：

# 清理之前的构建
rm -rf dist
rm -rf release

# 重新安装依赖
npm install

# 构建和打包
npm run dist



几点注意事项：
1. .icns 文件必须是有效的 macOS 图标格式
图标文件通常需要包含多个尺寸（16x16, 32x32, 128x128, 256x256, 512x512 等）
如果您还没有 .icns 文件，可以使用 IconSet Creator 或 Image2icon 等工具将 PNG 转换为 .icns