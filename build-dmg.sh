#!/bin/bash

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的信息
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必要的工具
check_requirements() {
    info "检查环境要求..."
    
    # 检查 Node.js
    if ! command -v node >/dev/null 2>&1; then
        error "未找到 Node.js，请先安装 Node.js"
        exit 1
    fi
    
    # 检查 npm
    if ! command -v npm >/dev/null 2>&1; then
        error "未找到 npm，请先安装 npm"
        exit 1
    fi
}

# 清理旧的构建文件
cleanup() {
    info "清理旧的构建文件..."
    rm -rf dist dist_electron
}

# 安装依赖
install_dependencies() {
    info "安装项目依赖..."
    npm install
    
    if [ $? -ne 0 ]; then
        error "依赖安装失败"
        exit 1
    fi
}

# 构建应用
build_app() {
    info "开始构建应用..."
    
    # 设置环境变量
    export NODE_ENV=production
    
    # 执行构建
    npm run build
    
    if [ $? -ne 0 ]; then
        error "应用构建失败"
        exit 1
    fi
}

# 打包 DMG
package_dmg() {
    info "开始打包 DMG..."
    
    # 执行 electron-builder 打包
    npm run electron:build -- --mac dmg
    
    if [ $? -ne 0 ]; then
        error "DMG 打包失败"
        exit 1
    fi
}

# 主函数
main() {
    echo "================================================"
    info "开始打包 IPTV Player DMG"
    echo "================================================"
    
    # 检查运行环境
    check_requirements
    
    # 执行构建步骤
    cleanup
    install_dependencies
    build_app
    package_dmg
    
    # 检查最终的 DMG 文件
    if [ -d "release" ] && ls release/*.dmg 1> /dev/null 2>&1; then
        info "DMG 打包成功！"
        info "DMG 文件位置: $(ls release/*.dmg)"
        echo "================================================"
    else
        error "未找到生成的 DMG 文件，打包可能失败"
        echo "================================================"
        exit 1
    fi
}

# 执行主函数
main 