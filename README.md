# Controller ID 分析工具

这是一个用于分析Controller ID数据的Web应用程序，提供直观的数据可视化和分析功能。

## 更新日志

### 2024-03-31
- 初始化项目
- 添加基本功能
- 配置GitHub仓库
- 准备Netlify部署
- 优化项目结构
- 修复Excel文件处理问题

## 功能特点

1. 数据导入
   - 支持CSV和Excel文件格式
   - 支持本地文件上传
   - 实时文件预览功能

2. 参考坐标系
   - 支持预定义坐标系统
   - 支持自定义参考文件上传
   - 多工作表选择

3. 数据可视化
   - 晶圆映射图表
   - 故障分布分析
   - 数据统计信息

4. 分析功能
   - 按ASIC批次分析
   - 按晶圆编号分析
   - 按故障代码筛选
   - 支持批量生成映射

## 使用方法

1. 数据导入
   - 点击"选择文件"按钮
   - 选择CSV或Excel格式的数据文件
   - 点击"上传并分析"按钮

2. 参考坐标系设置
   - 选择预定义坐标系统
   - 或上传自定义参考文件
   - 选择工作表（如果适用）

3. 数据分析
   - 选择ASIC批次
   - 选择晶圆编号
   - 选择故障代码筛选条件
   - 点击相应的生成按钮

4. 结果查看
   - 查看生成的晶圆映射图
   - 查看统计信息
   - 导出分析结果

## 技术栈

- HTML5
- CSS3
- JavaScript (ES6+)
- Chart.js (数据可视化)
- PapaParse (CSV解析)
- SheetJS (Excel处理)

## 部署说明

1. 本地运行
   - 直接打开`index.html`文件
   - 或使用简单的HTTP服务器

2. Netlify部署
   - 连接GitHub仓库
   - 自动部署更新

## 注意事项

1. 文件格式要求
   - CSV文件：UTF-8编码
   - Excel文件：.xlsx或.xls格式

2. 数据格式要求
   - 必须包含必要的列（ASIC、晶圆编号等）
   - 数据格式必须符合预定义规范

3. 浏览器支持
   - 推荐使用Chrome、Firefox、Edge等现代浏览器
   - 需要启用JavaScript

## 开发计划

- [ ] 添加完整Wafer参考坐标
- [ ] 添加数据导出功能
- [ ] 优化图表交互
- [ ] 添加批量处理功能
- [ ] 支持更多文件格式

## 贡献指南

欢迎提交Issue和Pull Request来帮助改进这个项目。

## 许可证

MIT License 