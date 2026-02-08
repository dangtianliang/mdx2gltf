const { exec } = require('child_process');
const os = require('os');
const { startLogServer } = require('./server/log-server');
const { clearAllLogs, cleanOldLogs } = require('./server/log-handler');

console.log('启动MDX-M3 Viewer开发环境...');
console.log('这将启动webpack开发服务器和日志服务器');
console.log('');

// 清理旧日志
console.log('清理旧日志...');
try {
  clearAllLogs();
  cleanOldLogs();
  console.log('日志清理完成');
} catch (error) {
  console.error('清理日志时出错:', error);
}
console.log('');

// 启动日志服务器
console.log('启动日志服务器...');
const logServer = startLogServer();

// 执行npm run serve命令
console.log('启动webpack开发服务器...');
const serveProcess = exec('npm run serve', {
  cwd: __dirname,
  stdio: 'inherit' // 继承标准输入输出，这样可以看到命令的输出
});

// 监听进程退出事件
serveProcess.on('exit', (code) => {
  console.log(`\nwebpack开发服务器已退出，退出码: ${code}`);
  // 关闭日志服务器
  try {
    logServer.close(() => {
      console.log('日志服务器已关闭');
    });
  } catch (error) {
    console.error('关闭日志服务器时出错:', error);
  }
});

// 监听进程错误事件
serveProcess.on('error', (error) => {
  console.error('启动开发服务器时出错:', error);
  // 关闭日志服务器
  try {
    logServer.close();
  } catch (e) {
    // 忽略错误
  }
});

// 延迟一段时间后自动打开浏览器
setTimeout(() => {
  console.log('\n自动打开浏览器访问模型查看器...');
  
  // 根据操作系统选择不同的命令打开浏览器
  let openCommand;
  switch (os.platform()) {
    case 'win32':
      openCommand = 'start';
      break;
    case 'darwin':
      openCommand = 'open';
      break;
    case 'linux':
      openCommand = 'xdg-open';
      break;
    default:
      openCommand = 'start';
  }
  
  // 执行打开浏览器的命令，直接访问模型查看器页面
  const modelViewerUrl = 'http://localhost:8080/clients/model-viewer/';
  exec(`${openCommand} ${modelViewerUrl}`, {
    cwd: __dirname
  }, (error) => {
    if (error) {
      console.error('打开浏览器时出错:', error);
      console.log(`请手动访问 ${modelViewerUrl} 查看模型查看器`);
    } else {
      console.log(`浏览器已打开，正在访问 ${modelViewerUrl}`);
    }
  });
}, 3000); // 延迟3秒，确保服务器有足够的时间启动

console.log('开发环境启动中...');
console.log('3秒后将自动打开浏览器访问 http://localhost:8080/clients/model-viewer/');
console.log('这是模型查看器的首页，可以查看和操作所有模型');
console.log('');
console.log('日志服务器运行在 http://localhost:8081');
console.log('');
console.log('按 Ctrl+C 停止服务器');

// 监听SIGINT信号（Ctrl+C）
process.on('SIGINT', () => {
  console.log('\n正在停止服务器...');
  
  // 终止webpack开发服务器
  serveProcess.kill();
  
  // 关闭日志服务器
  try {
    logServer.close(() => {
      console.log('日志服务器已关闭');
      process.exit(0);
    });
  } catch (error) {
    console.error('关闭日志服务器时出错:', error);
    process.exit(1);
  }
});

