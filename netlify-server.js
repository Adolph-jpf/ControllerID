const express = require('express');
const app = express();
const path = require('path');

// 设置静态文件目录
app.use(express.static(__dirname));

// 处理所有路由，返回index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 启动服务器
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}/`);
}); 