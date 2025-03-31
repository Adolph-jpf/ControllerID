# Controller ID 分析工具

这是一个用于分析Controller ID数据的Web应用程序，提供直观的数据可视化和分析功能。

## 更新日志

### 2024-03-21
- 初始化项目
- 添加基本功能
- 配置GitHub仓库
- 准备Netlify部署

## 功能特点

### 1. 数据导入
- 支持CSV文件导入
- 自动识别文件编码（支持UTF-8、GBK等）
- 支持大文件处理
- 实时数据验证和错误提示

### 2. 数据可视化
- 晶圆映射图（Wafer Map）
  - 支持动态大小调整
  - 颜色编码显示故障分布
  - 交互式提示信息
  - 自适应布局
  - 支持缩放和拖拽
- 故障统计图表
  - 故障类型分布
  - 故障率趋势
  - 坐标分布统计

### 3. 数据分析
- 故障率计算
- 坐标分布分析
- 故障类型统计
- 实时数据更新
- 性能优化的大数据处理

### 4. 用户界面
- 响应式设计
- 直观的操作流程
- 实时反馈
- 错误提示
- 键盘快捷键支持

## 技术栈

- 前端：
  - HTML5
  - CSS3
  - JavaScript (ES6+)
  - Chart.js (数据可视化)
  - Papa Parse (CSV解析)
- 后端：
  - Node.js (HTTP服务器)
  - Python (可选HTTP服务器)

## 使用说明

### 启动服务器

#### 方法1: 使用Node.js（推荐）
```bash
# 进入js目录
cd js
# 启动服务器
node server.js
```
服务器默认在 http://localhost:8080 运行

#### 方法2: 使用Python
```bash
python -m http.server 8000
```
服务器在 http://localhost:8000 运行

#### 方法3: 使用批处理文件启动（Windows）
创建一个名为`start-server.bat`的文件，内容如下：
```batch
@echo off
cd js
node server.js
pause
```
双击此批处理文件即可启动服务器。

#### 方法4: 创建桌面快捷方式（Windows）
1. 右键桌面，选择"新建" > "快捷方式"
2. 在位置栏输入：`cmd.exe /k "cd /d 项目路径\js && node server.js"`
3. 点击"下一步"，输入名称（例如"启动Controller ID分析工具"）
4. 点击"完成"

### 访问应用

启动服务器后，打开浏览器访问：
- Node.js方式：http://localhost:8080
- Python方式：http://localhost:8000

### 导入和分析数据

1. 导入数据
   - 点击"选择文件"按钮
   - 选择CSV格式的数据文件
   - 等待数据加载完成

2. 查看分析结果
   - 晶圆映射图显示故障分布
   - 统计图表展示各类数据
   - 鼠标悬停查看详细信息
   - 使用鼠标滚轮缩放、拖拽查看详细区域
   - 按"R"键重置视图

## 数据格式要求

CSV文件应包含以下列：
- Controller ID
- Location (坐标信息)
- Failure Code (故障代码)
- 其他相关数据

## 注意事项

- 建议使用现代浏览器（Chrome、Firefox、Edge等）
- 大文件处理可能需要较长时间
- 确保数据格式正确，避免解析错误
- 如果遇到端口冲突，可以修改js/server.js中的端口号

## 开发说明

### 项目结构
```
ControllerID/
├── index.html         # 主页面
├── css/               # 样式文件
│   └── styles.css
├── js/                # JavaScript文件
│   ├── app.js         # 主应用逻辑
│   └── server.js      # Node.js服务器
└── README.md          # 项目文档
```

### 主要功能模块
1. 数据导入模块
2. 数据解析模块
3. 可视化模块
4. 统计分析模块

## 维护说明

- 定期检查数据格式兼容性
- 监控性能问题
- 更新依赖包版本

## 许可证

MIT License 