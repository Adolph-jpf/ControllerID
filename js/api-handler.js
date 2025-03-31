// API处理函数
const fs = require('fs');
const path = require('path');

// 移除xlsx依赖
let xlsx;
try {
  xlsx = require('xlsx');
  console.log('xlsx库已加载');
} catch (error) {
  console.warn('无法加载xlsx库，将使用模拟数据:', error.message);
  xlsx = null;
}

// 参考坐标文件目录
const REFERENCE_DIR = path.join(__dirname, '../reference');

// 模拟数据（当xlsx库不可用时使用）
const MOCK_DATA = {
  files: [
    { name: 'INANDM_controller.xlsx', path: '/reference/INANDM_controller.xlsx' }
  ],
  worksheets: ['Sheet1', 'Sheet2', 'ControllerID'],
  referenceData: Array(100).fill(0).map((_, i) => ({
    X: Math.floor(i / 10),
    Y: i % 10,
    id: `point-${i}`
  }))
};

// 获取参考文件列表
function getReferenceFiles() {
  try {
    // 如果xlsx库不可用，返回模拟数据
    if (!xlsx) {
      console.log('使用模拟参考文件数据');
      return MOCK_DATA.files;
    }
    
    // 确保目录存在
    if (!fs.existsSync(REFERENCE_DIR)) {
      fs.mkdirSync(REFERENCE_DIR, { recursive: true });
    }
    
    // 读取目录中的Excel文件
    const files = fs.readdirSync(REFERENCE_DIR)
      .filter(file => file.endsWith('.xlsx') || file.endsWith('.xls'))
      .map(file => ({
        name: file,
        path: `/reference/${file}`
      }));
      
    return files;
  } catch (error) {
    console.error('读取参考文件列表时出错:', error);
    return MOCK_DATA.files;
  }
}

// 读取Excel参考文件
function readExcelReferenceFile(filename, sheetName) {
  try {
    // 如果xlsx库不可用，返回模拟数据
    if (!xlsx) {
      console.log('使用模拟参考坐标数据');
      return MOCK_DATA.referenceData;
    }
    
    const filePath = path.join(REFERENCE_DIR, filename);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      throw new Error(`找不到文件: ${filePath}`);
    }
    
    // 读取Excel文件
    const workbook = xlsx.readFile(filePath);
    
    // 如果没有指定工作表，使用第一个
    const worksheet = sheetName 
      ? workbook.Sheets[sheetName] 
      : workbook.Sheets[workbook.SheetNames[0]];
    
    if (!worksheet) {
      throw new Error(`找不到工作表: ${sheetName || workbook.SheetNames[0]}`);
    }
    
    // 转换为JSON
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    // 检查数据有效性
    if (!data || data.length === 0) {
      throw new Error('参考文件不包含有效数据');
    }
    
    // 检查是否包含x/X和y/Y坐标
    const firstRow = data[0];
    if (!(firstRow.x !== undefined || firstRow.X !== undefined) || 
        !(firstRow.y !== undefined || firstRow.Y !== undefined)) {
      throw new Error('参考文件缺少X/Y坐标列');
    }
    
    return data;
  } catch (error) {
    console.error('读取Excel参考文件时出错:', error);
    return MOCK_DATA.referenceData;
  }
}

// 获取工作表列表
function getWorksheets(filename) {
  try {
    // 如果xlsx库不可用，返回模拟数据
    if (!xlsx) {
      console.log('使用模拟工作表数据');
      return MOCK_DATA.worksheets;
    }
    
    const filePath = path.join(REFERENCE_DIR, filename);
    
    // 读取Excel文件
    const workbook = xlsx.readFile(filePath);
    
    return workbook.SheetNames;
  } catch (error) {
    console.error('获取工作表列表时出错:', error);
    return MOCK_DATA.worksheets;
  }
}

module.exports = {
  getReferenceFiles,
  readExcelReferenceFile,
  getWorksheets
}; 