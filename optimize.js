const fs = require('fs'); const filePath = 'js/app.js'; let content = fs.readFileSync(filePath, 'utf8'); const regex = /console\.log\([^;]*\);/g; const newContent = content.replace(regex, ''); fs.writeFileSync('js/app.optimized.js', newContent); console.log('已创建优化版JS文件: js/app.optimized.js');
