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