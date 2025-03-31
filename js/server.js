const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 端口配置
const PORT = process.env.PORT || 8080;

// MIME类型映射
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // 解析URL
  let pathname = url.parse(req.url).pathname;
  
  // 处理根路径请求
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // 转换为绝对路径
  // 注意：服务器文件位于js目录，因此需要回到上一级
  const filePath = path.join(__dirname, '..', pathname);
  
  // 获取文件扩展名
  const extname = path.extname(filePath);
  let contentType = mimeTypes[extname] || 'application/octet-stream';
  
  // 读取文件
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在
        console.error(`文件不存在: ${filePath}`);
        fs.readFile(path.join(__dirname, '..', '404.html'), (err, content) => {
          if (err) {
            // 如果404页面也不存在，返回简单的404消息
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - 页面未找到</h1><p>请求的资源不存在。</p>');
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        // 服务器错误
        console.error(`服务器错误: ${error.code}`);
        res.writeHead(500);
        res.end(`服务器错误: ${error.code}`);
      }
    } else {
      // 成功响应
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}/`);
  console.log(`按 Ctrl+C 停止服务器`);
  console.log('-----------------------------------');
});

// 处理服务器关闭
process.on('SIGINT', () => {
  console.log('\n服务器已停止');
  process.exit();
}); 