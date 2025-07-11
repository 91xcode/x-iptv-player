# 端口配置使用说明

## 🚀 多种启动方式

现在你可以通过以下多种方式指定开发服务器的端口号：

### 方式 1: 通过 npm 脚本（推荐）

#### 使用默认端口 (3000)
```bash
npm run electron:dev
```

#### 指定自定义端口
```bash
# 方法1: 使用 npm config 方式（推荐）
npm run electron:dev --port=3005
npm run dev:port --port=3005

# 方法2: 使用环境变量
npm config set port 3005 && npm run electron:dev
```

### 方式 2: 直接执行 Node.js 脚本
```bash
# 使用默认端口 3000
node scripts/dev.js

# 指定自定义端口
node scripts/dev.js --port 3005
node scripts/dev.js --port 8080
node scripts/dev.js --port 5173
```

### 方式 3: 作为可执行脚本（Unix/Linux/macOS）
```bash
# 首次需要添加执行权限
chmod +x scripts/dev.js

# 使用默认端口
./scripts/dev.js

# 指定自定义端口
./scripts/dev.js --port 3005
./scripts/dev.js --port 8080
```

### 方式 4: 从项目根目录直接执行
```bash
# 使用默认端口
scripts/dev.js

# 指定自定义端口
scripts/dev.js --port 3005
scripts/dev.js --port 8080
```

## 🎯 推荐使用方式

### **最简单的方式**：
```bash
# 直接执行脚本
node scripts/dev.js --port 3005

# 或者使用 npm 脚本
npm run dev:port --port 3005
```

### **团队协作推荐**：
```bash
# 统一使用 npm 脚本，便于团队成员理解
npm run electron:dev --port 3005
```

## 🔧 技术实现

### 修改的文件：

1. **package.json**
   - 修改了 `electron:dev` 脚本，现在使用自定义的 `scripts/dev.js`
   - 添加了 `dev:port` 脚本作为独立的端口配置选项

2. **scripts/dev.js** (新文件)
   - 解析命令行参数中的 `--port` 选项
   - 设置环境变量 `VITE_PORT`
   - 按顺序启动 Vite 和 Electron
   - 自动切换到项目根目录，支持从任何位置执行
   - 智能进程管理和错误处理

3. **vite.config.js**
   - 支持从环境变量 `VITE_PORT` 读取端口号
   - 设置 `strictPort: false` 允许端口自动递增

4. **main.js**
   - Electron 主进程现在从环境变量读取端口号
   - 动态构建 `http://localhost:${port}` URL

## 🎯 使用场景

- **端口冲突**: 当默认端口 3000 被占用时
- **多实例开发**: 同时运行多个不同端口的实例
- **团队协作**: 统一使用特定端口号
- **CI/CD**: 在自动化环境中指定端口

## ⚠️ 注意事项

1. **端口号要求**: 端口号必须是有效的数字 (1-65535)
2. **端口占用**: 确保指定的端口没有被其他应用占用
3. **自动递增**: 如果指定的端口被占用，Vite 会自动尝试下一个可用端口
4. **执行目录**: 脚本会自动切换到项目根目录，可以从任何位置执行
5. **依赖要求**: 确保已运行 `npm install` 安装了所有依赖
6. **Node.js 环境**: 确保系统已安装 Node.js

## 🔍 故障排除

如果遇到问题，请检查：
- 端口号是否为有效数字
- 端口是否被其他应用占用
- 防火墙是否阻止了端口访问
- 是否在项目根目录或已正确安装依赖
- Node.js 版本是否兼容

## 📝 完整示例

### npm 脚本方式
```bash
# 默认端口 3000
npm run electron:dev

# 指定端口 3005（推荐方式）
npm run electron:dev --port=3005
npm run dev:port --port=3005

# 指定端口 8080
npm run electron:dev --port=8080
npm run dev:port --port=8080
```

### 直接执行脚本方式
```bash
# 默认端口 3000
node scripts/dev.js

# 指定端口 3005
node scripts/dev.js --port 3005

# 指定端口 8080
node scripts/dev.js --port 8080
```

### 可执行脚本方式（Unix/Linux/macOS）
```bash
# 添加执行权限（仅需一次）
chmod +x scripts/dev.js

# 默认端口 3000
./scripts/dev.js

# 指定端口 3005
./scripts/dev.js --port 3005

# 指定端口 8080
./scripts/dev.js --port 8080
```

## 🚀 快速开始

选择你喜欢的方式：

1. **简单快速**: `node scripts/dev.js --port 3005`
2. **标准方式**: `npm run electron:dev --port=3005`
3. **独立脚本**: `npm run dev:port --port=3005`

## 🔧 参数传递说明

### npm 脚本参数传递的正确方式：

1. **使用等号**: `npm run electron:dev --port=3005` ✅
2. **直接传递**: `npm run electron:dev 3005` ❌ (不推荐)
3. **空格分隔**: `npm run electron:dev --port 3005` ❌ (npm 不支持)

### 直接执行脚本支持所有格式：

1. `node scripts/dev.js --port 3005` ✅
2. `node scripts/dev.js --port=3005` ✅
3. `node scripts/dev.js 3005` ✅
