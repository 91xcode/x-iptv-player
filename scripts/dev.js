#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// 确保在项目根目录执行
process.chdir(path.dirname(__dirname));

// 解析命令行参数
const args = process.argv.slice(2);
let port = 3000;

console.log('接收到的参数:', args);

// 多种参数格式支持
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  // 格式1: --port 3005
  if (arg === '--port' && args[i + 1]) {
    port = parseInt(args[i + 1]);
    break;
  }

  // 格式2: --port=3005
  if (arg.startsWith('--port=')) {
    port = parseInt(arg.split('=')[1]);
    break;
  }

  // 格式3: 直接的数字（npm 传递方式）
  if (/^\d+$/.test(arg)) {
    port = parseInt(arg);
    break;
  }
}

// 检查环境变量（npm config 方式）
if (process.env.npm_config_port) {
  port = parseInt(process.env.npm_config_port);
}

if (isNaN(port) || port < 1 || port > 65535) {
  console.error('错误: 端口号必须是 1-65535 之间的数字');
  console.error('当前解析到的端口:', port);
  process.exit(1);
}

console.log(`🚀 启动开发服务器，端口: ${port}`);

// 设置环境变量
const env = {
  ...process.env,
  NODE_ENV: 'development',
  VITE_PORT: port.toString()
};

// 启动 Vite 开发服务器
const viteProcess = spawn('npx', ['vite', '--port', port.toString()], {
  stdio: 'inherit',
  env,
  shell: true
});

// 等待一段时间后启动 Electron
setTimeout(() => {
  console.log('🖥️  启动 Electron...');
  const electronProcess = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    env,
    shell: true
  });

  // 处理进程退出
  electronProcess.on('close', (code) => {
    console.log(`Electron 进程退出，代码: ${code}`);
    viteProcess.kill();
    process.exit(code);
  });
}, 2000);

// 处理 Vite 进程退出
viteProcess.on('close', (code) => {
  console.log(`Vite 进程退出，代码: ${code}`);
  process.exit(code);
});

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n正在关闭开发服务器...');
  viteProcess.kill();
  process.exit(0);
});
