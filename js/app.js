// 全局变量
let csvData = []; // 存储解析后的CSV数据
let waferMap = {}; // 存储晶圆映射数据
let currentChart = null; // 当前显示的图表实例
let rawFileContent = null; // 存储原始文件内容
let referenceCoordinates = []; // 存储参考坐标，初始化为空数组
let excelFile = null; // 存储上传的Excel文件
let sbFailureCodes = []; // 存储所有故障代码
let selectedFailureCode = 'all'; // 当前选择的故障代码
let chart = null;
let locationStats = {};
let waferChart = null;

// 性能监控模块
const Performance = {
    marks: {},
    
    start(name) {
        this.marks[name] = {
            startTime: performance.now(),
            endTime: null,
            duration: null
        };
    },
    
    end(name) {
        if (!this.marks[name] || !this.marks[name].startTime) {
            return;
        }
        
        this.marks[name].endTime = performance.now();
        this.marks[name].duration = this.marks[name].endTime - this.marks[name].startTime;
    },
    
    get(name) {
        return this.marks[name] ? this.marks[name].duration : null;
    },
    
    getAll() {
        return this.marks;
    },
    
    measure(name, start, end) {
        const duration = end - start;
        return duration;
    },
    
    async measureAsync(name, func, ...args) {
        this.start(name);
        
        try {
            const result = await func(...args);
            this.end(name);
            return result;
        } catch (error) {
            this.end(name);
            throw error;
        }
    },
    
    measureFunc(name, func, ...args) {
        this.start(name);
        
        try {
            const result = func(...args);
            this.end(name);
            return result;
        } catch (error) {
            this.end(name);
            throw error;
        }
    },
    
    getReport() {
        const measurements = [];
        let totalTime = 0;
        let slowestOperation = { name: '', time: 0 };
        let fastestOperation = { name: '', time: Infinity };
        let operationCount = 0;
        
        for (const [name, data] of Object.entries(this.marks)) {
            if (data.duration !== null) {
                measurements.push({
                    name,
                    time: data.duration
                });
                
                totalTime += data.duration;
                operationCount++;
                
                if (data.duration > slowestOperation.time) {
                    slowestOperation = { name, time: data.duration };
                }
                
                if (data.duration < fastestOperation.time) {
                    fastestOperation = { name, time: data.duration };
                }
            }
        }
        
        return {
            measurements: measurements.sort((a, b) => b.time - a.time),
            summary: {
                totalTime,
                averageTime: operationCount > 0 ? totalTime / operationCount : 0,
                slowestOperation,
                fastestOperation,
                operationCount
            }
        };
    },
    
    logReport() {
        const report = this.getReport();
        // 只保留关键的性能日志
        if (report.summary.operationCount > 0) {
            console.log(`性能报告: ${report.summary.operationCount}个操作, 总时间: ${report.summary.totalTime.toFixed(2)}ms`);
        }
    },
    
    clear() {
        this.marks = {};
    }
};

// 添加缓存系统
const dataCache = {
    waferMaps: new Map(), // 缓存已生成的晶圆映射
    referenceData: new Map(), // 缓存参考数据
    statistics: new Map(), // 缓存统计信息
    
    // 设置缓存项并设置过期时间(默认30分钟)
    set(cacheKey, key, value, expiresIn = 30 * 60 * 1000) {
        if (!this[cacheKey]) {
            console.warn(`缓存键 ${cacheKey} 不存在`);
            return;
        }
        
        this[cacheKey].set(key, {
            value,
            expires: Date.now() + expiresIn
        });
        
        console.log(`缓存已设置: ${cacheKey}.${key}, 过期时间: ${expiresIn}ms`);
    },
    
    // 获取缓存项，如果过期返回null
    get(cacheKey, key) {
        if (!this[cacheKey]) {
            console.warn(`缓存键 ${cacheKey} 不存在`);
            return null;
        }
        
        const item = this[cacheKey].get(key);
        if (!item) return null;
        
        // 检查是否过期
        if (Date.now() > item.expires) {
            this[cacheKey].delete(key);
            console.log(`缓存已过期: ${cacheKey}.${key}`);
            return null;
        }
        
        console.log(`缓存命中: ${cacheKey}.${key}`);
        return item.value;
    },
    
    // 清除特定缓存
    clear(cacheKey) {
        if (!this[cacheKey]) {
            console.warn(`缓存键 ${cacheKey} 不存在`);
            return;
        }
        
        this[cacheKey].clear();
        console.log(`已清除缓存: ${cacheKey}`);
    },
    
    // 清除所有缓存
    clearAll() {
        this.waferMaps.clear();
        this.referenceData.clear();
        this.statistics.clear();
        console.log('已清除所有缓存');
    }
};

// 工具函数库
const Utils = {
    // 简化DOM元素选择
    $(selector) {
        return document.querySelector(selector);
    },
    
    $$(selector) {
        return document.querySelectorAll(selector);
    },
    
    // 创建DOM元素
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        // 设置属性
        for (const key in attributes) {
            if (key === 'style' && typeof attributes[key] === 'object') {
                Object.assign(element.style, attributes[key]);
            } else if (key === 'dataset' && typeof attributes[key] === 'object') {
                for (const dataKey in attributes[key]) {
                    element.dataset[dataKey] = attributes[key][dataKey];
                }
            } else if (key === 'events' && typeof attributes[key] === 'object') {
                for (const event in attributes[key]) {
                    element.addEventListener(event, attributes[key][event]);
                }
            } else {
                element[key] = attributes[key];
            }
        }
        
        // 设置内容
        if (typeof content === 'string') {
            element.innerHTML = content;
        } else if (content instanceof Node) {
            element.appendChild(content);
        } else if (Array.isArray(content)) {
            content.forEach(item => {
                if (typeof item === 'string') {
                    element.innerHTML += item;
                } else if (item instanceof Node) {
                    element.appendChild(item);
                }
            });
        }
        
        return element;
    },
    
    // 格式化数字
    formatNumber(number, decimals = 2) {
        return Number(number).toFixed(decimals);
    },
    
    // 格式化百分比
    formatPercent(number, decimals = 2) {
        return (number * 100).toFixed(decimals) + '%';
    },
    
    // 防抖函数
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // 节流函数
    throttle(func, limit = 300) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };
    },
    
    // 添加事件监听
    addEvent(element, eventType, handler, options = {}) {
        if (typeof element === 'string') {
            element = this.$(element);
        }
        if (element) {
            element.addEventListener(eventType, handler, options);
        }
        return element;
    },
    
    // 日志函数
    log(message, type = 'info') {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const prefix = `[${timestamp}]`;
        
        switch (type) {
            case 'info':
                console.log(`${prefix} ${message}`);
                break;
            case 'warn':
                console.warn(`${prefix} ${message}`);
                break;
            case 'error':
                console.error(`${prefix} ${message}`);
                break;
            case 'success':
                console.log(`${prefix} %c${message}`, 'color: green');
                break;
            default:
                console.log(`${prefix} ${message}`);
        }
    },
    
    // 获取URL参数
    getUrlParam(name, url = window.location.href) {
        name = name.replace(/[[\]]/g, '\\$&');
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        const results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }
};

// 状态消息显示函数
function showStatusMessage(message, type = 'info') {
    const messageContainer = document.getElementById('statusMessages') || createStatusMessageContainer();
    const messageElement = document.createElement('div');
    messageElement.className = `status-message ${type}`;
    messageElement.innerHTML = message;
    
    // 添加消息到容器
    messageContainer.appendChild(messageElement);
    
    // 自动移除消息
    setTimeout(() => {
        messageElement.classList.add('fade-out');
        setTimeout(() => {
            if (messageContainer.contains(messageElement)) {
                messageContainer.removeChild(messageElement);
            }
        }, 500);
    }, 5000);
}

// 创建状态消息容器
function createStatusMessageContainer() {
    const container = document.createElement('div');
    container.id = 'statusMessages';
    container.className = 'status-messages-container';
    document.body.appendChild(container);
    return container;
}

// 设置故障代码函数
function setFailureCode(code) {
    // 从下拉列表中选择相应的故障代码
    const failureSelect = document.getElementById('failureCodeSelect');
    if (failureSelect) {
        // 查找与代码匹配的选项
        for (let i = 0; i < failureSelect.options.length; i++) {
            if (failureSelect.options[i].value === code) {
                failureSelect.selectedIndex = i;
                break;
            }
        }
        
        // 触发change事件以更新显示
        const event = new Event('change');
        failureSelect.dispatchEvent(event);
        
        showStatusMessage(`已设置故障代码: ${code}`, 'info');
    } else {
        console.error('找不到故障代码选择器元素');
    }
}

// DOM元素变量声明
let csvFileInput;
let uploadBtn;
let filePreviewBtn; // 之前是previewBtn，现在改为filePreviewBtn
let fileInfoDiv;
let filePreviewContainer;
let filePreviewDiv;
let predefinedCoordinatesSelect;
let loadPredefinedBtn;
let referenceFileUpload;
let uploadReferenceFileBtn;
let referenceSheetSelect;
let loadReferenceBtn;
let referenceInfoDiv;
let referencePreviewContainer;
let referencePreviewDiv;
let asicSelect;
let waferSelect;
let generateMapBtn;
let generateAllMapBtn;
let generateByAsicBtn;
let exportExcelBtn;
let exportImageBtn;
let statsDiv;
let pointSizeSlider;
let pointSizeValue;
let failureCodeSelect;
let updateDisplayBtn;

// 添加GPU加速样式函数，在文档加载时就应用
function addOptimizedStyles() {
    // 检查是否已添加
    if (document.getElementById('optimized-styles')) {
        return;
    }
    
    // 创建样式元素
    const style = document.createElement('style');
    style.id = 'optimized-styles';
    style.textContent = `
        /* 全局性能优化样式 */
        .wafer-grid-container {
            will-change: transform;
            backface-visibility: hidden;
            transform: translateZ(0);
            transform-style: preserve-3d;
            -webkit-font-smoothing: antialiased;
        }
        
        /* 网格单元格优化 */
        .wafer-cell {
            will-change: transform;
            backface-visibility: hidden;
            transform: translateZ(0);
            transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* 坐标轴优化 */
        [class*='-axis-container'] {
            will-change: transform;
            backface-visibility: hidden;
            transform: translateZ(0);
        }
        
        /* 缩放和平移的包装容器优化 */
        .grid-and-axes-wrapper {
            will-change: transform;
            backface-visibility: hidden;
            transform: translateZ(0);
            transform-style: preserve-3d;
            transition: transform 0.05s linear;
        }
        
        /* 鼠标交互状态 */
        .wafer-cell:hover {
            transform: scale(1.1) translateZ(0);
            z-index: 1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
    `;
    
    // 添加到文档头部
    document.head.appendChild(style);
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('晶圆映射工具初始化中...');
    
    // 添加性能优化样式
    addOptimizedStyles();
    
    // 初始化界面元素
    initElements();
    
    // 检查文件上传组件状态
    checkUploadComponentsStatus();
    
    // 桥接reference-coordinates.js中的函数
    if (typeof loadLocalReferenceFile === 'function') {
        // 把loadLocalReferenceFile函数暴露到全局
        window.loadLocalReferenceFile = loadLocalReferenceFile;
        console.log('成功连接参考坐标文件加载函数');
    } else {
        console.warn('未找到loadLocalReferenceFile函数，可能影响参考坐标的加载');
    }
    
    // 监听ASIC选择变化
    asicSelect.addEventListener('change', updateWaferOptions);
    
    // 监听失败代码选择变化
    failureCodeSelect.addEventListener('change', function() {
        selectedFailureCode = failureCodeSelect.value;
        if (waferChart) {
            generateWaferMap();
        }
    });
    
    // 初始化参考坐标系选择器
    initReferenceCoordinatesSelector();
    
    // 添加样式以支持状态消息
    addStatusMessageStyles();
    
    // 显示欢迎信息
    showStatusMessage('晶圆映射工具已准备就绪', 'info');
    
    console.log('晶圆映射工具初始化完成');
});

// 添加状态消息样式
function addStatusMessageStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .status-messages-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            max-width: 300px;
            z-index: 9999;
        }
        .status-message {
            margin-top: 10px;
            padding: 10px 15px;
            border-radius: 4px;
            color: white;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: opacity 0.5s;
        }
        .status-message.info {
            background-color: #2196F3;
        }
        .status-message.success {
            background-color: #4CAF50;
        }
        .status-message.warning {
            background-color: #FF9800;
        }
        .status-message.error {
            background-color: #F44336;
        }
        .status-message.fade-out {
            opacity: 0;
        }
    `;
    document.head.appendChild(style);
}

// 检查上传组件状态
function checkUploadComponentsStatus() {
    console.log('=== 文件上传组件状态检查 ===');
    console.log('csvFileInput:', csvFileInput ? '存在' : '不存在', csvFileInput);
    console.log('uploadBtn:', uploadBtn ? '存在' : '不存在', uploadBtn);
    console.log('filePreviewBtn:', filePreviewBtn ? '存在' : '不存在', filePreviewBtn);
    
    // 检查事件绑定
    if (uploadBtn) {
        console.log('上传按钮已在DOM中:', uploadBtn);
        console.log('上传按钮是否已禁用:', uploadBtn.disabled ? '是' : '否');
    }
    
    if (filePreviewBtn) {
        console.log('预览按钮已在DOM中:', filePreviewBtn);
        console.log('预览按钮是否已禁用:', filePreviewBtn.disabled ? '是' : '否');
    }
    
    // 检查HTML元素
    const uploadBtnHTML = document.getElementById('upload-btn');
    const previewBtnHTML = document.getElementById('preview-btn');
    console.log('通过ID查找 upload-btn:', uploadBtnHTML ? '找到' : '未找到');
    console.log('通过ID查找 preview-btn:', previewBtnHTML ? '找到' : '未找到');
    
    // 验证按钮和引用是否一致
    console.log('上传按钮引用是否与DOM元素一致:', uploadBtn === uploadBtnHTML ? '是' : '否');
    console.log('预览按钮引用是否与DOM元素一致:', filePreviewBtn === previewBtnHTML ? '是' : '否');
    
    console.log('=== 文件上传组件检查完成 ===');
}

// 初始化元素
function initElements() {
    // 获取DOM元素
    csvFileInput = document.getElementById('csv-file');
    fileInfoDiv = document.getElementById('file-info');
    uploadBtn = document.getElementById('upload-btn');
    filePreviewBtn = document.getElementById('preview-btn');
    filePreviewContainer = document.getElementById('file-preview-container');
    filePreviewDiv = document.getElementById('file-preview');
    
    // 获取晶圆选择器和生成按钮
    asicSelect = document.getElementById('asic-select');
    waferSelect = document.getElementById('wafer-select');
    generateMapBtn = document.getElementById('generate-map-btn');
    generateAllMapBtn = document.getElementById('generate-all-map-btn');
    generateByAsicBtn = document.getElementById('generate-by-asic-btn');
    
    // 故障代码选择器
    failureCodeSelect = document.getElementById('failure-code-select');
    
    // 参考坐标相关元素
    predefinedCoordinatesSelect = document.getElementById('predefined-coordinates');
    loadPredefinedBtn = document.getElementById('load-predefined-btn');
    referenceFileUpload = document.getElementById('reference-file-upload');
    uploadReferenceFileBtn = document.getElementById('upload-reference-file-btn');
    referenceSheetSelect = document.getElementById('reference-sheet');
    loadReferenceBtn = document.getElementById('load-reference-btn');
    referenceInfoDiv = document.getElementById('reference-info');
    referencePreviewContainer = document.getElementById('reference-preview-container');
    referencePreviewDiv = document.getElementById('reference-preview');
    
    // 去除点大小调整相关元素
    
    // 禁用生成映射和导出按钮，直到数据加载完成
    generateMapBtn.disabled = true;
    generateAllMapBtn.disabled = true;
    generateByAsicBtn.disabled = true;
    filePreviewBtn.disabled = true;
    loadReferenceBtn.disabled = true;
    
    // 添加事件监听器
    uploadBtn.addEventListener('click', handleFileUpload);
    filePreviewBtn.addEventListener('click', previewCSVFile);
    
    // 参考坐标系相关事件
    loadPredefinedBtn.addEventListener('click', loadPredefinedCoordinates);
    
    referenceFileUpload.addEventListener('change', function() {
        const file = referenceFileUpload.files[0];
        if (file) {
            excelFile = file;
            uploadReferenceFileBtn.disabled = false;
        } else {
            uploadReferenceFileBtn.disabled = true;
        }
    });
    
    uploadReferenceFileBtn.addEventListener('click', handleReferenceFileUpload);
    loadReferenceBtn.addEventListener('click', loadReferenceCoordinates);
    
    // 晶圆选择和映射生成
    waferSelect.addEventListener('change', function() {
        // 当选择了ASIC和晶圆时启用生成按钮
        generateMapBtn.disabled = !(asicSelect.value && waferSelect.value);
    });
    
    generateMapBtn.addEventListener('click', generateWaferMap);
    generateAllMapBtn.addEventListener('click', function() {
        // 显示确认对话框
        if (confirm('合并Mapping将不区分ASIC和Wafer，合并所有数据进行处理，可能需要较长时间。是否继续？')) {
            generateMergedMap();
        }
    });
    generateByAsicBtn.addEventListener('click', showAsicBatchDialog);
    
    // 将setFailureCode暴露为全局函数
    window.setFailureCode = setFailureCode;
    
    // 添加按钮事件监听
    csvFileInput.addEventListener('change', function() {
        if (csvFileInput.files.length > 0) {
            uploadBtn.disabled = false;
            filePreviewBtn.disabled = false;
            fileInfoDiv.textContent = '已选择文件：' + csvFileInput.files[0].name;
        } else {
            uploadBtn.disabled = true;
            filePreviewBtn.disabled = true;
            fileInfoDiv.textContent = '请选择CSV文件';
        }
    });
    
    // 默认禁用生成按钮
    generateMapBtn.disabled = true;
    generateAllMapBtn.disabled = true;
    generateByAsicBtn.disabled = true;
    
    // 初始化参考坐标系选择器
    initReferenceCoordinatesSelector();
    
    // 显示欢迎信息
    showStatusMessage('晶圆映射工具已准备就绪', 'info');
    
    console.log('晶圆映射工具初始化完成');
    
    // 添加键盘快捷键支持
    document.addEventListener('keydown', function(event) {
        // 只有在没有输入框获得焦点时才处理键盘事件
        if (document.activeElement.tagName !== 'INPUT' && 
            document.activeElement.tagName !== 'TEXTAREA' && 
            document.activeElement.tagName !== 'SELECT') {
            
            // 按M键生成合并映射
            if (event.key === 'm' && !event.ctrlKey && !event.altKey) {
                if (!generateAllMapBtn.disabled) {
                    if (confirm('合并Mapping将不区分ASIC和Wafer，合并所有数据进行处理，可能需要较长时间。是否继续？')) {
                        generateMergedMap();
                    }
                }
            }
            
            // 按G键生成单个映射
            else if (event.key === 'g' && !event.ctrlKey && !event.altKey) {
                if (!generateMapBtn.disabled) {
                    generateWaferMap();
                }
            }
            
            // 按A键打开ASIC批次选择对话框
            else if (event.key === 'a' && !event.ctrlKey && !event.altKey) {
                if (!generateByAsicBtn.disabled) {
                    showAsicBatchDialog();
                }
            }
            
            // 按U键打开上传文件对话框
            else if (event.key === 'u' && !event.ctrlKey && !event.altKey) {
                csvFileInput.click();
            }
            
            // 按?键显示快捷键帮助
            else if (event.key === '?' || (event.key === 'h' && !event.ctrlKey && !event.altKey)) {
                showKeyboardShortcutsHelp();
            }
        }
    });
    
    // 添加帮助按钮
    const helpButton = document.createElement('button');
    helpButton.textContent = '帮助';
    helpButton.className = 'btn btn-info btn-sm';
    helpButton.style.position = 'fixed';
    helpButton.style.top = '10px';
    helpButton.style.right = '10px';
    helpButton.style.zIndex = '1000';
    helpButton.onclick = showHelpGuide;
    document.body.appendChild(helpButton);
}

// 初始化参考坐标系选择器
function initReferenceCoordinatesSelector() {
    console.log('正在初始化参考坐标系选择器...');
    
    try {
        // 确保DOM元素存在
        if (!predefinedCoordinatesSelect) {
            console.error('找不到预定义坐标下拉选择器');
            return;
        }
        
        // 清空现有选项
        predefinedCoordinatesSelect.innerHTML = '<option value="">选择预定义坐标</option>';
        
        // 添加预定义坐标选项
        for (const key in predefinedCoordinates) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = predefinedCoordinates[key].description;
            predefinedCoordinatesSelect.appendChild(option);
        }
        
        console.log(`已加载 ${Object.keys(predefinedCoordinates).length} 个预定义坐标集`);
        
        // 添加提示
        showStatusMessage('参考坐标系功能已启用，请选择或上传参考坐标', 'info');
    } catch (error) {
        console.error('初始化参考坐标系选择器时出错:', error);
        showStatusMessage('初始化参考坐标系失败', 'error');
    }
}

// 加载参考文件列表
function loadReferenceFileList() {
    // 清空现有选项
    while (referenceSelect.options.length > 1) {
        referenceSelect.remove(1);
    }
    
    // 在本地环境中，直接使用模拟数据
    const files = [
        { name: 'INANDM_controller.xlsx', path: './reference/INANDM_controller.xlsx' },
        { name: 'INAND_WaferMap_Template.xlsx', path: './reference/INAND_WaferMap_Template.xlsx' },
        { name: 'INAND_WaferMap_2023.xlsx', path: './reference/INAND_WaferMap_2023.xlsx' },
        { name: 'INAND_WaferMap_2024.xlsx', path: './reference/INAND_WaferMap_2024.xlsx' }
    ];
    
    referenceFiles = files;
    
    // 添加到下拉列表
    files.forEach(file => {
        const option = document.createElement('option');
        option.value = file.path;
        option.textContent = file.name;
        referenceSelect.appendChild(option);
    });
    
    // 更新提示信息
    referenceInfoDiv.innerHTML = `本地模式：请确保您的参考文件位于 <code>reference</code> 文件夹中，并且文件名以 <code>INAND</code> 开头`;
}

// 处理参考文件选择
function handleReferenceFileSelect() {
    const selectedFilePath = referenceSelect.value;
    
    // 清空工作表选择
    while (referenceSheetSelect.options.length > 1) {
        referenceSheetSelect.remove(1);
    }
    
    if (!selectedFilePath) {
        referenceSheetSelect.disabled = true;
        return;
    }
    
    referenceInfoDiv.textContent = `已选择文件: ${selectedFilePath}`;
    
    // 在本地环境中，直接使用模拟数据
    // 添加更多可能的工作表名称，以适应不同的Excel文件
    const sheets = [
        'Sheet1', 'Sheet2', 'Sheet3', 
        'WaferMap', 'Coordinates', 'Data', 
        '坐标', '数据', '晶圆图', 
        'XY坐标', 'XY Coordinates',
        'Controller', 'ControllerID'
    ];
    
    sheets.forEach(sheet => {
        const option = document.createElement('option');
        option.value = sheet;
        option.textContent = sheet;
        referenceSheetSelect.appendChild(option);
    });
    
    referenceSheetSelect.disabled = false;
    referenceInfoDiv.textContent = `请选择包含坐标数据的工作表`;
}

// 加载预定义坐标
async function loadPredefinedCoordinates() {
    const selectedCoordinateSet = predefinedCoordinatesSelect.value;
    
    if (!selectedCoordinateSet) {
        alert('请选择参考坐标');
        return;
    }
    
    // 检查全局变量是否存在
    if (typeof predefinedCoordinates === 'undefined') {
        console.error('找不到预定义坐标变量');
        alert('预定义坐标数据未加载，请检查reference-coordinates.js是否正确加载');
        return;
    }
    
    // 检查是否存在选定的预定义坐标集
    if (!predefinedCoordinates[selectedCoordinateSet]) {
        alert(`找不到预定义坐标集: ${selectedCoordinateSet}`);
        return;
    }
    
    const coordinatesData = predefinedCoordinates[selectedCoordinateSet];
    
    // 显示加载状态
    referenceInfoDiv.textContent = `正在加载坐标数据...`;
    
    try {
        // 检查是否为本地文件
        if (coordinatesData.isLocalFile) {
            // 尝试加载本地文件
            const coordinates = await window.loadLocalReferenceFile(selectedCoordinateSet);
            
            if (!coordinates || !Array.isArray(coordinates)) {
                throw new Error(`无法加载本地坐标文件: ${selectedCoordinateSet}`);
            }
            
            // 保存坐标数据
            referenceCoordinates = coordinates;
            
            // 显示成功消息
            referenceInfoDiv.innerHTML = `已加载本地坐标文件: ${coordinatesData.description || selectedCoordinateSet}<br>
            <small>共 ${referenceCoordinates.length} 个坐标点</small>`;
            
            // 显示预览
            showReferencePreview(referenceCoordinates);
            
            // 如果已经生成了映射图，更新显示
            if (waferChart) {
                generateWaferMap();
            }
            
            showStatusMessage(`已加载 ${referenceCoordinates.length} 个本地坐标点`, 'success');
            return;
        }
        
        // 检查是否有坐标数据
        if (!coordinatesData.coordinates || !Array.isArray(coordinatesData.coordinates)) {
            throw new Error(`坐标数据格式无效: ${selectedCoordinateSet}`);
        }
        
        // 保存坐标数据
        referenceCoordinates = coordinatesData.coordinates;
        
        // 显示成功消息
        referenceInfoDiv.innerHTML = `已加载预定义坐标: ${coordinatesData.description}<br>
        <small>共 ${referenceCoordinates.length} 个坐标点</small>`;
        
        // 显示预览
        showReferencePreview(referenceCoordinates);
        
        // 如果已经生成了映射图，更新显示
        if (waferChart) {
            generateWaferMap();
        }
        
        showStatusMessage(`已加载 ${referenceCoordinates.length} 个预定义坐标点`, 'success');
    } catch (error) {
        console.error('加载坐标数据时出错:', error);
        referenceInfoDiv.innerHTML = `加载坐标数据时出错: ${error.message}`;
        showStatusMessage(`加载坐标失败: ${error.message}`, 'error');
    }
}

// 处理参考文件上传
function handleReferenceFileUpload() {
    const file = referenceFileUpload.files[0];
    if (!file) {
        alert('请先选择参考文件');
        return;
    }
    
    excelFile = file;
    referenceInfoDiv.textContent = `正在解析文件: ${file.name}`;
    
    // 检查文件类型
    const fileType = file.name.split('.').pop().toLowerCase();
    
    if (fileType === 'xlsx' || fileType === 'xls') {
        // 读取Excel文件
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                // 使用SheetJS库解析Excel文件
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                // 获取工作表名称列表
                const sheetNames = workbook.SheetNames;
                
                // 更新工作表选择器
                referenceSheetSelect.innerHTML = '<option value="">选择工作表</option>';
                sheetNames.forEach(name => {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    referenceSheetSelect.appendChild(option);
                });
                
                referenceSheetSelect.disabled = false;
                loadReferenceBtn.disabled = false;
                
                // 显示成功消息
                referenceInfoDiv.innerHTML = `文件 ${file.name} 已上传，请选择工作表`;
                
            } catch (error) {
                console.error('解析Excel文件时出错:', error);
                referenceInfoDiv.textContent = `解析Excel文件时出错: ${error.message}`;
                showStatusMessage(`解析参考文件失败: ${error.message}`, 'error');
            }
        };
        
        reader.onerror = function() {
            referenceInfoDiv.textContent = '读取文件时出错';
            showStatusMessage('读取参考文件失败', 'error');
        };
        
        reader.readAsArrayBuffer(file);
    } else if (fileType === 'csv') {
        // 读取CSV文件
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const csvData = e.target.result;
                
                // 分析CSV
                Papa.parse(csvData, {
                    header: true,
                    complete: function(results) {
                        if (results.errors.length > 0) {
                            referenceInfoDiv.textContent = `解析CSV文件时出错: ${results.errors[0].message}`;
                            return;
                        }
                        
                        // 直接处理坐标数据
                        processCoordinatesData(results.data, 'CSV');
                    }
                });
                
            } catch (error) {
                console.error('解析CSV文件时出错:', error);
                referenceInfoDiv.textContent = `解析CSV文件时出错: ${error.message}`;
            }
        };
        
        reader.onerror = function() {
            referenceInfoDiv.textContent = '读取文件时出错';
        };
        
        reader.readAsText(file);
    } else {
        referenceInfoDiv.textContent = `不支持的文件类型: ${fileType}`;
    }
}

// 加载参考坐标
function loadReferenceCoordinates() {
    if (!excelFile) {
        alert('请先上传参考文件');
        return;
    }
    
    const selectedSheet = referenceSheetSelect.value;
    if (!selectedSheet) {
        alert('请选择工作表');
        return;
    }
    
    referenceInfoDiv.textContent = `正在加载参考坐标...`;
    
    // 检查文件类型
    const fileType = excelFile.name.split('.').pop().toLowerCase();
    
    if (fileType === 'xlsx' || fileType === 'xls') {
        // 读取Excel文件
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                // 使用SheetJS库解析Excel文件
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                // 获取选定的工作表
                const worksheet = workbook.Sheets[selectedSheet];
                
                // 将工作表转换为JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                // 处理坐标数据
                processCoordinatesData(jsonData, 'Excel');
                
            } catch (error) {
                console.error('解析Excel文件时出错:', error);
                referenceInfoDiv.textContent = `解析Excel文件时出错: ${error.message}`;
                showStatusMessage(`加载参考坐标失败: ${error.message}`, 'error');
            }
        };
        
        reader.onerror = function() {
            referenceInfoDiv.textContent = '读取文件时出错';
            showStatusMessage('读取参考文件失败', 'error');
        };
        
        reader.readAsArrayBuffer(excelFile);
    } else {
        referenceInfoDiv.textContent = `不支持的文件类型: ${fileType}，仅支持Excel文件从工作表中加载数据`;
    }
}

// 处理坐标数据
function processCoordinatesData(data, sourceType) {
    // 寻找X和Y列
    const firstRow = data[0];
    const keys = Object.keys(firstRow);
    
    let xColumn = null;
    let yColumn = null;
    
    // 尝试查找X和Y列（忽略大小写）
    for (const key of keys) {
        const keyLower = key.toLowerCase();
        if (keyLower === 'x' || keyLower === 'x坐标' || keyLower.includes('x') && keyLower.includes('coord')) {
            xColumn = key;
        } else if (keyLower === 'y' || keyLower === 'y坐标' || keyLower.includes('y') && keyLower.includes('coord')) {
            yColumn = key;
        }
    }
    
    if (!xColumn || !yColumn) {
        referenceInfoDiv.innerHTML = `无法识别X和Y坐标列。请确保文件包含名为X和Y的列，或包含"坐标"字样的列。<br>
        找到的列: ${keys.join(', ')}`;
        return;
    }
    
    // 提取坐标
    const coordinates = [];
    
    for (const row of data) {
        const x = parseFloat(row[xColumn]);
        const y = parseFloat(row[yColumn]);
        
        if (!isNaN(x) && !isNaN(y)) {
            coordinates.push({ x, y });
        }
    }
    
    if (coordinates.length === 0) {
        referenceInfoDiv.textContent = `未找到有效的X和Y坐标`;
        return;
    }
    
    // 保存坐标
    referenceCoordinates = coordinates;
    
    // 显示预览
    showReferencePreview(coordinates);
    
    // 显示成功消息
    referenceInfoDiv.innerHTML = `成功加载 ${coordinates.length} 个参考坐标点`;
    showStatusMessage(`已加载 ${coordinates.length} 个参考坐标点`, 'success');
    
    // 如果已经生成了映射图，更新显示
    if (waferChart) {
        generateWaferMap();
    }
}

// 显示参考坐标预览
function showReferencePreview(data) {
    if (!data || data.length === 0) {
        return;
    }
    
    // 创建预览表格
    let previewHTML = `<div class="reference-preview-container">
        <div class="reference-table">
            <h4>参考坐标数据（前20个点）</h4>
            <table style="width:100%; border-collapse: collapse;">
                <tr style="background-color: #f2f2f2;">
                    <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">X</th>
                    <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Y</th>
                </tr>`;
    
    // 显示前20个坐标点
    const previewData = data.slice(0, 20);
    previewData.forEach(point => {
        // 确保使用一致的属性名（x/y或X/Y）
        const x = point.x !== undefined ? point.x : point.X;
        const y = point.y !== undefined ? point.y : point.Y;
        
        previewHTML += `<tr>
            <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${x}</td>
            <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${y}</td>
        </tr>`;
    });
    
    previewHTML += `</table>`;
    if (data.length > 20) {
        previewHTML += `<p style="margin-top: 10px; font-style: italic;">显示前20个坐标点，共${data.length}个点</p>`;
    }
    
    // 添加简单的散点图预览
    previewHTML += `<div class="reference-graph">
        <h4>参考坐标位置图</h4>
        <div id="reference-preview-chart" style="width: fit-content; margin: 0 auto; background-color: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 4px;"></div>
    </div></div>`;
    
    referencePreviewDiv.innerHTML = previewHTML;
    referencePreviewContainer.style.display = 'block';
    
    // 绘制简单的散点图
    drawReferencePreviewChart(data);
}

// 绘制参考坐标预览图
function drawReferencePreviewChart(data) {
    const container = document.getElementById('reference-preview-chart');
    if (!container || !data || data.length === 0) return;

    // 清除旧的canvas
    container.innerHTML = '';

    // 规范化坐标数据
    const normalizedData = data.map(point => ({
        x: point.x !== undefined ? point.x : point.X,
        y: point.y !== undefined ? point.y : point.Y
    }));

    // 获取X和Y的范围
    const xValues = normalizedData.map(point => point.x);
    const yValues = normalizedData.map(point => point.y);
    
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    // 创建网格容器
    const gridContainer = document.createElement('div');
    gridContainer.style.display = 'grid';
    gridContainer.style.gap = '1px';
    gridContainer.style.backgroundColor = '#f0f0f0';
    gridContainer.style.padding = '1px';
    gridContainer.style.width = 'fit-content';
    gridContainer.style.margin = '0 auto';

    // 设置网格大小
    const cellSize = 4; // 固定单元格大小为4像素
    const xRange = xMax - xMin + 1;
    const yRange = yMax - yMin + 1;

    // 设置网格模板
    gridContainer.style.gridTemplateColumns = `repeat(${xRange}, ${cellSize}px)`;
    gridContainer.style.gridTemplateRows = `repeat(${yRange}, ${cellSize}px)`;

    // 创建坐标点映射
    const coordMap = new Map();
    normalizedData.forEach(point => {
        coordMap.set(`${point.x},${point.y}`, true);
    });

    // 创建网格单元格
    for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
            const cell = document.createElement('div');
            cell.style.width = `${cellSize}px`;
            cell.style.height = `${cellSize}px`;
            
            // 如果是参考坐标点，设置为蓝色，否则为浅灰色
            if (coordMap.has(`${x},${y}`)) {
                cell.style.backgroundColor = 'rgba(54, 162, 235, 0.7)';
                cell.title = `坐标: (${x}, ${y})`;
            } else {
                cell.style.backgroundColor = '#f8f8f8';
            }

            gridContainer.appendChild(cell);
        }
    }

    // 将网格容器添加到预览区域
    container.appendChild(gridContainer);
}

// 预览CSV文件
function previewCSVFile() {
    const file = csvFileInput.files[0];
    if (!file) {
        alert('请先选择CSV文件');
        return;
    }
    
    filePreviewContainer.style.display = 'block';
    filePreviewDiv.innerHTML = '<p>正在加载文件预览...</p>';
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const csvData = e.target.result;
            const lines = csvData.split(/\r?\n/);
            
            // 检测分隔符
            const firstLine = lines[0];
            const possibleDelimiters = [',', ';', '\t', '|'];
            let delimiter = ',';
            let maxCount = 0;
            
            for (const d of possibleDelimiters) {
                const count = (firstLine.match(new RegExp(d === '\t' ? '\t' : d, 'g')) || []).length;
                if (count > maxCount) {
                    maxCount = count;
                    delimiter = d;
                }
            }
            
            // 解析CSV表头
            const headers = firstLine.split(delimiter);
            
            // 创建表格HTML
            let tableHTML = '<table class="preview-table">';
            
            // 添加表头
            tableHTML += '<tr>';
            headers.forEach(header => {
                tableHTML += `<th>${header.trim()}</th>`;
            });
            tableHTML += '</tr>';
            
            // 添加最多20行数据
            const maxRows = Math.min(20, lines.length - 1);
            for (let i = 1; i <= maxRows; i++) {
                if (lines[i].trim() === '') continue;
                
                tableHTML += '<tr>';
                const cells = lines[i].split(delimiter);
                
                // 确保单元格数量与表头一致
                for (let j = 0; j < headers.length; j++) {
                    const cellValue = j < cells.length ? cells[j] : '';
                    tableHTML += `<td>${cellValue.trim()}</td>`;
                }
                
                tableHTML += '</tr>';
            }
            
            tableHTML += '</table>';
            
            // 显示文件信息和预览
            filePreviewDiv.innerHTML = `
                <div class="preview-info">
                    <p><strong>文件名:</strong> ${file.name}</p>
                    <p><strong>大小:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
                    <p><strong>检测到的分隔符:</strong> ${delimiter === '\t' ? 'Tab' : delimiter}</p>
                    <p><strong>总行数:</strong> ${lines.length}</p>
                    <p><strong>列数:</strong> ${headers.length}</p>
                </div>
                <div class="preview-table-container">
                    <h3>数据预览 (最多20行)</h3>
                    ${tableHTML}
                </div>
            `;
            
            showStatusMessage('文件预览已加载', 'success');
        } catch (error) {
            console.error('预览文件时出错:', error);
            filePreviewDiv.innerHTML = `<p class="error">预览文件时出错: ${error.message}</p>`;
            showStatusMessage('预览文件失败', 'error');
        }
    };
    
    reader.onerror = function() {
        filePreviewDiv.innerHTML = '<p class="error">读取文件时出错</p>';
        showStatusMessage('读取文件失败', 'error');
    };
    
    reader.readAsText(file);
}

// 创建Web Worker进行CSV解析，提高性能
function createParseWorker(file, delimiter, callback) {
    // 添加调试
    console.log(`开始解析文件: ${file.name}, 大小: ${file.size} 字节`);
    
    try {
        // 创建Blob URL
        const workerCode = `
            self.addEventListener('message', function(e) {
                const { file, delimiter } = e.data;
                
                // 使用FileReader读取文件
                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const csvData = event.target.result;
                        console.log("Worker: 文件读取成功，大小: " + csvData.length + " 字节");
                        
                        // 简单检测分隔符（如果没有指定）
                        let actualDelimiter = delimiter || ',';
                        if (!delimiter) {
                            const firstLine = csvData.split('\\n')[0];
                            const possibleDelimiters = [',', ';', '\\t', '|'];
                            let maxCount = 0;
                            
                            for (const d of possibleDelimiters) {
                                const count = (firstLine.match(new RegExp(d, 'g')) || []).length;
                                if (count > maxCount) {
                                    maxCount = count;
                                    actualDelimiter = d;
                                }
                            }
                            console.log("Worker: 自动检测到分隔符: " + (actualDelimiter === '\\t' ? 'Tab' : actualDelimiter));
                        }
                        
                        // 解析CSV
                        const lines = csvData.split(/\\r?\\n/);
                        console.log("Worker: 文件共有 " + lines.length + " 行");
                        
                        if (lines.length === 0) {
                            self.postMessage({ error: '文件为空或格式无效' });
                            return;
                        }
                        
                        // 修复这里：正确分割列名
                        const headers = lines[0].split(actualDelimiter).map(h => h.trim());
                        console.log("Worker: 检测到列名: " + headers.join(', '));
                        
                        const results = [];
                        let processedLines = 0;
                        
                        for (let i = 1; i < lines.length; i++) {
                            if (lines[i].trim() === '') continue;
                            
                            const values = lines[i].split(actualDelimiter);
                            
                            // 跳过列数不匹配的行
                            if (values.length !== headers.length) {
                                console.log("Worker: 跳过第 " + i + " 行，列数不匹配： " + values.length + " vs " + headers.length);
                                continue;
                            }
                            
                            processedLines++;
                            const row = {};
                            
                            for (let j = 0; j < headers.length; j++) {
                                let value = values[j].trim();
                                
                                // 尝试动态类型转换
                                if (!isNaN(value) && value !== '') {
                                    if (value.includes('.')) {
                                        value = parseFloat(value);
                                    } else {
                                        value = parseInt(value);
                                    }
                                }
                                
                                // 确保列名去除多余空格
                                row[headers[j]] = value;
                            }
                            
                            results.push(row);
                        }
                        
                        console.log("Worker: 成功处理 " + processedLines + " 行数据");
                        
                        self.postMessage({
                            data: results,
                            meta: {
                                delimiter: actualDelimiter,
                                fields: headers,
                                totalLines: lines.length,
                                processedLines: processedLines
                            }
                        });
                    } catch (err) {
                        console.error("Worker: 处理文件时出错", err);
                        self.postMessage({ 
                            error: '解析文件时出错: ' + err.message,
                            details: err.stack
                        });
                    }
                };
                
                reader.onerror = function(err) {
                    console.error("Worker: 读取文件时出错", err);
                    self.postMessage({ 
                        error: '读取文件时出错: ' + (err.message || '未知错误') 
                    });
                };
                
                reader.readAsText(file);
            });
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const blobURL = URL.createObjectURL(blob);
        
        // 创建Worker
        const worker = new Worker(blobURL);
        
        // 设置消息处理函数
        worker.onmessage = function(e) {
            console.log(`收到Worker处理结果: ${e.data.error ? '错误' : '成功'}`);
            if (e.data.error) {
                console.error('Worker错误:', e.data.error, e.data.details || '');
            } else if (e.data.data) {
                console.log(`处理了 ${e.data.data.length} 条记录，使用分隔符: ${e.data.meta.delimiter === '\t' ? 'Tab' : e.data.meta.delimiter}`);
            }
            
            callback(e.data);
            // 清理Blob URL
            URL.revokeObjectURL(blobURL);
            worker.terminate();
        };
        
        // 发送文件给Worker
        worker.postMessage({ file, delimiter });
        console.log('已启动Web Worker处理文件');
        
        return worker;
    } catch (err) {
        console.error('创建Web Worker时出错:', err);
        callback({ 
            error: '创建解析器时出错: ' + err.message,
            details: err.stack
        });
        return null;
    }
}

// 显示加载指示器
function showLoadingIndicator(container, text = '处理中...') {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.style.position = 'absolute';
    loadingDiv.style.top = '0';
    loadingDiv.style.left = '0';
    loadingDiv.style.width = '100%';
    loadingDiv.style.height = '100%';
    loadingDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    loadingDiv.style.display = 'flex';
    loadingDiv.style.justifyContent = 'center';
    loadingDiv.style.alignItems = 'center';
    loadingDiv.style.flexDirection = 'column';
    loadingDiv.style.zIndex = '1000';
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.style.width = '40px';
    spinner.style.height = '40px';
    spinner.style.margin = '10px auto';
    spinner.style.borderRadius = '50%';
    spinner.style.border = '4px solid #f3f3f3';
    spinner.style.borderTop = '4px solid #4285F4';
    spinner.style.animation = 'spin 1s linear infinite';
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    const textElem = document.createElement('div');
    textElem.innerText = text;
    textElem.style.marginTop = '10px';
    textElem.style.fontWeight = '500';
    
    loadingDiv.appendChild(spinner);
    loadingDiv.appendChild(textElem);
    
    // 添加到容器
    container.style.position = 'relative';
    container.appendChild(loadingDiv);
    
    return loadingDiv;
}

// 隐藏加载指示器
function hideLoadingIndicator() {
    const loadingDiv = document.getElementById('loading-indicator');
    if (loadingDiv) {
        loadingDiv.parentNode.removeChild(loadingDiv);
    }
}

// 处理文件上传 - 优化版本
function handleFileUpload() {
    console.log('开始处理文件上传...');
    console.log('csvFileInput对象:', csvFileInput);
    
    const userFile = csvFileInput.files[0];
    if (!userFile) {
        alert('请选择一个文件');
        return;
    }
    
    // 设置按钮状态
    uploadBtn.disabled = true;
    filePreviewBtn.disabled = true;
    generateMapBtn.disabled = true;
    generateAllMapBtn.disabled = true;
    generateByAsicBtn.disabled = true;
    
    console.log(`选择的文件: ${userFile.name}, 大小: ${userFile.size} 字节, 类型: ${userFile.type}`);
    
    // 显示加载指示器
    const loadingIndicator = showLoadingIndicator(document.querySelector('.file-upload'), '正在解析文件...');
    fileInfoDiv.textContent = `正在处理文件: ${userFile.name}`;
    
    try {
        // 使用Web Worker解析文件
        console.log('准备创建Web Worker解析文件...');
        const worker = createParseWorker(userFile, null, function(result) {
            console.log('Worker处理完成，收到结果:', result.error ? '出错' : '成功');
            
            // 隐藏加载指示器
            hideLoadingIndicator();
            
            if (result.error) {
                console.error('解析出错:', result.error);
                fileInfoDiv.textContent = `解析出错: ${result.error}`;
                showStatusMessage(`解析出错: ${result.error}`, 'error');
                return;
            }
            
            const processedData = result.data;
            const meta = result.meta;
            
            console.log(`解析成功，处理了 ${processedData.length} 条记录，字段:`, meta.fields);
            
            // 检查文件的首行是否包含逗号，表明可能是字段被组合在一起
            const firstRowKeys = Object.keys(processedData[0] || {});
            console.log('首行数据的键:', firstRowKeys);
            
            // 特殊情况：如果只有一个字段，且包含逗号，可能是需要进一步分割
            if (firstRowKeys.length === 1 && firstRowKeys[0].includes(',')) {
                console.log('检测到可能是单字段文件，需要进一步处理');
                const singleField = firstRowKeys[0];
                const possibleHeaders = singleField.split(',').map(h => h.trim());
                
                console.log('尝试分割为多个字段:', possibleHeaders);
                
                // 重新处理数据
                const newProcessedData = [];
                for (const row of processedData) {
                    const rowValues = String(row[singleField]).split(',').map(v => v.trim());
                    const newRow = {};
                    
                    // 确保值的数量与标题一致
                    for (let i = 0; i < possibleHeaders.length; i++) {
                        newRow[possibleHeaders[i]] = i < rowValues.length ? rowValues[i] : '';
                    }
                    
                    newProcessedData.push(newRow);
                }
                
                // 更新处理后的数据和元数据
                console.log(`重新处理后得到 ${newProcessedData.length} 条记录，字段:`, possibleHeaders);
                processedData.length = 0;
                Array.prototype.push.apply(processedData, newProcessedData);
                meta.fields = possibleHeaders;
            }
            
            // 检查是否有预期的列
            const requiredColumns = ['stlot', 'teststep', 'asic', 'wafer', 'X', 'Y', 'HB', 'SB', 'ASICID'];
            const missingColumns = requiredColumns.filter(col => 
                !meta.fields.includes(col) && 
                !meta.fields.includes(col.toLowerCase()) &&
                !meta.fields.includes(col.toUpperCase())
            );
            
            if (missingColumns.length > 0) {
                console.error('缺少必要的列:', missingColumns);
                console.log('发现的列:', meta.fields);
                
                fileInfoDiv.innerHTML = `文件缺少必要的列: ${missingColumns.join(', ')}<br>
                找到的列: ${meta.fields.join(', ')}<br>
                请确保CSV文件包含所有必要的列。`;
                hideLoadingIndicator();
                return;
            }
            
            // 确保处理后的数据中的键与预期一致 (处理可能的大小写不匹配)
            const normalizedData = processedData.map(row => {
                const normalizedRow = {};
                for (const requiredCol of requiredColumns) {
                    // 寻找匹配的列，不区分大小写
                    const matchingKey = Object.keys(row).find(key => 
                        key.toLowerCase() === requiredCol.toLowerCase()
                    );
                    
                    if (matchingKey) {
                        normalizedRow[requiredCol] = row[matchingKey];
                    } else {
                        normalizedRow[requiredCol] = '';
                    }
                }
                // 保留其他列
                for (const key in row) {
                    if (!requiredColumns.some(col => col.toLowerCase() === key.toLowerCase())) {
                        normalizedRow[key] = row[key];
                    }
                }
                return normalizedRow;
            });
            
            // 保存解析后的数据
            csvData = normalizedData;
            fileInfoDiv.textContent = `成功加载 ${csvData.length} 条记录，使用分隔符: "${meta.delimiter === '\t' ? 'Tab' : meta.delimiter}"`;
            
            // 处理故障代码
            console.log('扫描SB列值...');
            const sbValues = new Set();
            const nonZeroOneSbValues = new Set();
            
            normalizedData.forEach(row => {
                if (row.SB !== undefined && row.SB !== null) {
                    const sbVal = String(row.SB);
                    sbValues.add(sbVal);
                    if (sbVal !== '0' && sbVal !== '1') {
                        nonZeroOneSbValues.add(sbVal);
                    }
                }
            });
            
            console.log(`SB列中共有 ${sbValues.size} 种不同的值:`, Array.from(sbValues));
            console.log(`SB列中共有 ${nonZeroOneSbValues.size} 种非0/1的值:`, Array.from(nonZeroOneSbValues));
            
            // 特别重要：直接硬编码一些故障代码用于测试
            if (nonZeroOneSbValues.size === 0) {
                console.log('警告: 未找到非0/1的故障代码，添加测试故障代码');
                nonZeroOneSbValues.add('C012');
                nonZeroOneSbValues.add('E001');
                nonZeroOneSbValues.add('F123');
            }
            
            // 更新故障代码全局变量
            sbFailureCodes = Array.from(nonZeroOneSbValues).sort();
            
            // 更新故障代码选择器
            updateFailureCodeSelector();
            
            // 提取唯一的ASIC批次
            const asicBatches = [...new Set(csvData.map(row => row.asic))].filter(Boolean);
            
            // 更新ASIC选择下拉框
            asicSelect.innerHTML = '';
            asicBatches.forEach(asic => {
                const option = document.createElement('option');
                option.value = asic;
                option.textContent = asic;
                asicSelect.appendChild(option);
            });
            
            // 触发ASIC变更事件，更新晶圆选项
            updateWaferOptions();
            
            // 启用生成映射按钮
            generateMapBtn.disabled = false;
            generateAllMapBtn.disabled = false;
            generateByAsicBtn.disabled = false;
            
            showStatusMessage(`文件已成功加载，检测到 ${sbFailureCodes.length} 种故障代码`, 'success');
        });
    } catch (error) {
        hideLoadingIndicator();
        console.error('处理文件时出错:', error);
        fileInfoDiv.textContent = `处理文件时出错: ${error.message}`;
        showStatusMessage(`处理文件出错: ${error.message}`, 'error');
    }
}

// 更新晶圆选项
function updateWaferOptions() {
    const selectedAsic = asicSelect.value;
    
    // 获取选定ASIC批次的所有晶圆
    const wafers = [...new Set(csvData
        .filter(row => row.asic === selectedAsic)
        .map(row => String(row.wafer)))]  // 确保wafer是字符串类型
        .filter(Boolean)
        .sort((a, b) => {
            // 尝试使用数值排序，如果失败则使用字符串排序
            const numA = Number(a);
            const numB = Number(b);
            return !isNaN(numA) && !isNaN(numB) ? numA - numB : a.localeCompare(b);
        });
    
    // 更新晶圆选择下拉框
    waferSelect.innerHTML = '';
    wafers.forEach(wafer => {
        const option = document.createElement('option');
        option.value = wafer;
        option.textContent = wafer;
        waferSelect.appendChild(option);
    });
}

// 确保晶圆映射容器存在
function ensureWaferMapContainer() {
    let waferMapContainer = document.getElementById('wafer-map-container');
    
    // 如果容器不存在，创建一个
    if (!waferMapContainer) {
        console.log('创建晶圆映射容器');
        
        // 创建容器
        waferMapContainer = document.createElement('div');
        waferMapContainer.id = 'wafer-map-container';
        waferMapContainer.style.width = '100%';
        waferMapContainer.style.height = '600px';
        waferMapContainer.style.position = 'relative';
        waferMapContainer.style.marginTop = '20px';
        waferMapContainer.style.border = '1px solid #ddd';
        waferMapContainer.style.borderRadius = '4px';
        waferMapContainer.style.padding = '10px';
        
        // 查找映射区域容器
        const mappingSection = document.querySelector('.wafer-mapping-section') || 
                             document.querySelector('.content') || 
                             document.body;
        
        // 添加到页面
        mappingSection.appendChild(waferMapContainer);
        console.log('晶圆映射容器已创建并添加到页面');
    }
    
    return waferMapContainer;
}

// 生成单个晶圆的映射图
function generateWaferMap() {
    console.log('开始生成晶圆映射图...');
    Performance.start('generateWaferMap');
    
    const selectedAsic = asicSelect.value;
    const selectedWafer = waferSelect.value;
    
    if (!csvData || csvData.length === 0) {
        alert('请先加载CSV文件');
        Performance.end('generateWaferMap');
        return;
    }
    
    if (!selectedAsic || !selectedWafer) {
        alert('请选择ASIC批次和晶圆编号');
        Performance.end('generateWaferMap');
        return;
    }
    
    // 创建缓存键
    const cacheKey = `${selectedAsic}_${selectedWafer}_${selectedFailureCode}`;
    
    // 检查缓存
    const cachedWaferMap = dataCache.get('waferMaps', cacheKey);
    if (cachedWaferMap) {
        console.log('使用缓存的晶圆映射数据');
        Performance.measure('缓存检索', Performance.start('缓存检索'));
        
        // 使用缓存数据
        waferMap = cachedWaferMap;
        
        // 清除旧的映射图，并确保容器存在
        const waferMapContainer = ensureWaferMapContainer();
        waferMapContainer.innerHTML = '';
        
        // 创建新的画布
        const canvas = document.createElement('canvas');
        canvas.id = 'wafer-map';
        canvas.width = 800;  
        canvas.height = 800;
        waferMapContainer.appendChild(canvas);
        
        // 绘制映射图
        Performance.start('drawWaferMap_cached');
        drawWaferMap(waferMap, `晶圆映射 - ASIC: ${selectedAsic}, Wafer: ${selectedWafer}`);
        Performance.end('drawWaferMap_cached');
        
        // 显示统计信息
        Performance.start('displayStats_cached');
        displayStats(waferMap);
        Performance.end('displayStats_cached');
        
        // 启用导出按钮
        if (exportExcelBtn) exportExcelBtn.disabled = false;
        if (exportImageBtn) exportImageBtn.disabled = false;
        
        showStatusMessage('晶圆映射图生成完成 (使用缓存)', 'success');
        
        // 记录总体性能
        Performance.end('generateWaferMap');
        // 输出性能报告
        setTimeout(() => Performance.logReport(), 100);
        
        return;
    }
    
    // 确保晶圆映射容器存在
    const waferMapContainer = ensureWaferMapContainer();
    
    // 显示加载指示器
    showStatusMessage(`正在生成晶圆映射图，ASIC: ${selectedAsic}, 晶圆: ${selectedWafer}`, 'info');
    showLoadingIndicator(waferMapContainer, '正在计算统计信息...');
    
    // 为了提高性能，我们使用更高效的方式过滤和处理数据
    // 延迟计算，避免UI阻塞
    setTimeout(() => {
        try {
            // 过滤选定ASIC和晶圆的数据 - 一次性过滤
            Performance.start('数据过滤');
            const filteredData = csvData.filter(row => {
                return row.asic === selectedAsic && row.wafer === selectedWafer;
            });
            Performance.end('数据过滤');
            
            if (filteredData.length === 0) {
                hideLoadingIndicator();
                alert(`所选ASIC (${selectedAsic}) 和晶圆 (${selectedWafer}) 组合无数据`);
                Performance.end('generateWaferMap');
                return;
            }
            
            console.log(`共找到 ${filteredData.length} 条数据点`);
            
            // 使用Map加速唯一坐标的查找
            Performance.start('坐标分组');
            const coordMap = new Map();
            
            // 首次遍历数据，收集所有唯一坐标
            filteredData.forEach(row => {
                const x = typeof row.X === 'number' ? row.X : parseFloat(row.X);
                const y = typeof row.Y === 'number' ? row.Y : parseFloat(row.Y);
                
                if (!isNaN(x) && !isNaN(y)) {
                    const key = `${x},${y}`;
                    if (!coordMap.has(key)) {
                        coordMap.set(key, { x, y, rows: [] });
                    }
                    coordMap.get(key).rows.push(row);
                }
            });
            Performance.end('坐标分组');
            
            console.log(`共找到 ${coordMap.size} 个唯一坐标`);
            
            // 清空当前映射数据
            waferMap = {};
            
            // 为每个坐标计算统计信息
            Performance.start('计算统计信息');
            for (const [key, coord] of coordMap.entries()) {
                const mapKey = `${selectedAsic}_${selectedWafer}_${coord.x}_${coord.y}`;
                waferMap[mapKey] = calculateLocationStats(coord.rows, coord.x, coord.y);
            }
            Performance.end('计算统计信息');
            
            // 将结果存入缓存
            dataCache.set('waferMaps', cacheKey, waferMap);
            
            // 处理完毕，更新UI
            hideLoadingIndicator();
            
            // 清除旧的映射图，并确保容器存在
            const waferMapContainer = ensureWaferMapContainer();
            waferMapContainer.innerHTML = '';
            
            // 创建新的画布
            const canvas = document.createElement('canvas');
            canvas.id = 'wafer-map';
            canvas.width = 800;  
            canvas.height = 800;
            waferMapContainer.appendChild(canvas);
            
            // 绘制映射图
            Performance.start('drawWaferMap');
            drawWaferMap(waferMap, `晶圆映射 - ASIC: ${selectedAsic}, Wafer: ${selectedWafer}`);
            Performance.end('drawWaferMap');
            
            // 显示统计信息
            Performance.start('displayStats');
            displayStats(waferMap);
            Performance.end('displayStats');
            
            // 启用导出按钮
            if (exportExcelBtn) exportExcelBtn.disabled = false;
            if (exportImageBtn) exportImageBtn.disabled = false;
            
            showStatusMessage('晶圆映射图生成完成', 'success');
            
            // 记录总体性能
            Performance.end('generateWaferMap');
            // 输出性能报告
            setTimeout(() => Performance.logReport(), 100);
            
        } catch (error) {
            console.error('生成晶圆映射时出错:', error);
            hideLoadingIndicator();
            showStatusMessage(`生成晶圆映射出错: ${error.message}`, 'error');
        }
    }, 10); // 短延迟，让UI有机会更新
}

// 生成所有晶圆映射图
function generateAllWaferMaps() {
    // 此函数已被合并映射功能(generateMergedMap)取代，保留函数名以避免潜在引用错误
}

// 更新故障代码选择器
function updateFailureCodeSelector() {
    console.log('更新故障代码选择器...');
    console.log('可用故障代码:', sbFailureCodes);
    
    // 先清空当前选项
    failureCodeSelect.innerHTML = '';
    
    // 添加全部选项
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = '所有故障代码';
    failureCodeSelect.appendChild(allOption);
    
    // 添加通过选项
    const passOption = document.createElement('option');
    passOption.value = 'pass';
    passOption.textContent = '仅显示通过';
    failureCodeSelect.appendChild(passOption);
    
    // 添加失败选项
    const failOption = document.createElement('option');
    failOption.value = 'fail';
    failOption.textContent = '仅显示失败';
    failureCodeSelect.appendChild(failOption);
    
    // 添加每一种故障代码
    sbFailureCodes.forEach(code => {
        if (code === '0' || code === '1') return; // 跳过0和1
        
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `故障代码: ${code}`;
        failureCodeSelect.appendChild(option);
    });
    
    // 设置默认选择为"所有"
    failureCodeSelect.value = 'all';
    selectedFailureCode = 'all';
    
    console.log(`故障代码选择器已更新，共 ${failureCodeSelect.options.length} 个选项`);
}

// 计算给定位置的统计信息
function calculateLocationStats(diesAtLocation, x, y) {
    if (!diesAtLocation || diesAtLocation.length === 0) {
        return {
            X: x,
            Y: y,
            locationTotal: 0,
            failureTotal: 0,
            rate: 0,
            sbCounts: {},
            failureDies: {}
        };
    }
    
    // 统计此位置的总DIE数
    const locationTotal = diesAtLocation.length;
    
    // 统计每种故障代码的数量
    const sbCounts = {};
    const failureDies = {};
    let failureTotal = 0;
    
    // 单次遍历计算所有统计信息
    for (const die of diesAtLocation) {
        const sbValue = String(die.SB || '0');
        
        // 计数
        if (!sbCounts[sbValue]) {
            sbCounts[sbValue] = 0;
            failureDies[sbValue] = [];
        }
        sbCounts[sbValue]++;
        
        // 修改判断逻辑：如果不是0或1，则视为故障
        if (sbValue !== '0' && sbValue !== '1') {
            failureDies[sbValue].push(die);
            failureTotal++;
        }
    }
    
    // 计算故障率
    const rate = locationTotal > 0 ? failureTotal / locationTotal : 0;
    
    return {
        X: x,
        Y: y,
        locationTotal,
        failureTotal,
        rate,
        sbCounts,
        failureDies
    };
}

// 计算基于特定故障代码的故障率
function calculateFailureRateByCode(waferMap, failureCode) {
    console.log(`计算故障率，故障代码: ${failureCode}`);
    
    const updatedStats = {};
    
    // 对每个位置进行计算
    for (const key in waferMap) {
        const location = waferMap[key];
        const locX = location.X;
        const locY = location.Y;
        
        // 克隆基本数据
        updatedStats[key] = {
            X: locX,
            Y: locY,
            locationTotal: location.locationTotal,
            failureTotal: 0,
            rate: 0,
            failureDies: {}
        };
        
        if (failureCode === 'all') {
            // 显示所有故障
            updatedStats[key].failureTotal = location.failureTotal;
            updatedStats[key].rate = location.rate;
            updatedStats[key].failureDies = location.failureDies;
        } else if (failureCode === 'pass') {
            // 只关注通过的 - 修改为包括SB=0和SB=1的情况
            const passCount = (location.sbCounts['0'] || 0) + (location.sbCounts['1'] || 0);
            updatedStats[key].passTotal = passCount;
            updatedStats[key].failureTotal = location.locationTotal - passCount;
            updatedStats[key].rate = location.locationTotal > 0 ? updatedStats[key].failureTotal / location.locationTotal : 0;
        } else if (failureCode === 'fail') {
            // 只关注失败的（任何故障代码）
            updatedStats[key].failureTotal = location.failureTotal;
            updatedStats[key].rate = location.rate;
            // 包含所有非"0"和非"1"的故障
            for (const code in location.failureDies) {
                if (code !== '0' && code !== '1') {
                    updatedStats[key].failureDies[code] = location.failureDies[code];
                }
            }
        } else {
            // 特定故障代码
            const codeCount = location.sbCounts[failureCode] || 0;
            updatedStats[key].failureTotal = codeCount;
            updatedStats[key].rate = location.locationTotal > 0 ? codeCount / location.locationTotal : 0;
            
            // 只包含指定代码的失败
            if (location.failureDies[failureCode]) {
                updatedStats[key].failureDies[failureCode] = location.failureDies[failureCode];
            }
        }
    }
    
    return updatedStats;
}

// 绘制晶圆映射图
function drawWaferMap(locationStats, title = '晶圆映射') {
    console.log(`绘制晶圆映射图: ${title}`);
    
    // 获取画布容器
    const waferMapContainer = document.getElementById('wafer-map-container');
    if (!waferMapContainer) {
        console.error('找不到晶圆映射容器');
        return;
    }
    
    // 清空容器
    waferMapContainer.innerHTML = '';
    
    // 如果已存在Chart实例，销毁它
    if (waferChart) {
        waferChart.destroy();
        waferChart = null;
    }
    
    // 添加标题
    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.style.textAlign = 'center';
    titleElement.style.margin = '10px 0';
    waferMapContainer.appendChild(titleElement);
    
    // 添加控制按钮说明
    const helpText = document.createElement('small');
    helpText.style.display = 'block';
    helpText.style.textAlign = 'center';
    helpText.style.margin = '10px 0';
    helpText.style.color = '#666';
    helpText.textContent = '提示: 使用鼠标滚轮可缩放，按住鼠标左键可拖动，按R键可重置视图';
    waferMapContainer.appendChild(helpText);
    
    // 从locationStats提取坐标范围
    const locations = Object.values(locationStats);
    
    // 如果没有位置数据，显示错误并返回
    if (locations.length === 0) {
        const errorMsg = document.createElement('div');
        errorMsg.textContent = '无晶圆数据可显示';
        errorMsg.style.color = 'red';
        errorMsg.style.textAlign = 'center';
        errorMsg.style.fontSize = '20px';
        errorMsg.style.padding = '50px';
        waferMapContainer.appendChild(errorMsg);
        return;
    }
    
    // 创建坐标系和映射矩阵
    const coordMap = new Map();
    
    // 如果有参考坐标，则严格使用参考坐标构建映射矩阵
    if (referenceCoordinates.length > 0) {
        console.log(`使用参考坐标创建映射矩阵 (${referenceCoordinates.length}个坐标点)`);
        console.log('参考坐标样例:', JSON.stringify(referenceCoordinates[0]));
        
        // 使用参考坐标创建映射矩阵
        referenceCoordinates.forEach(coord => {
            // 处理不同属性名称的情况 (x/X, y/Y)
            const x = coord.x !== undefined ? coord.x : coord.X;
            const y = coord.y !== undefined ? coord.y : coord.Y;
            
            if (x !== undefined && y !== undefined) {
                const key = `${x},${y}`;
                coordMap.set(key, {
                    x: Number(x),
                    y: Number(y),
                    isEmpty: true, // 默认标记为空白坐标
                    isReference: true // 标记为参考坐标
                });
            }
        });
        
        console.log(`基于参考坐标创建了 ${coordMap.size} 个坐标点的映射矩阵`);
    } 
    else {
        console.log(`没有参考坐标，使用测试数据范围创建映射矩阵`);
        
        // 查找X和Y坐标的最小值和最大值
        const xValues = locations.map(loc => loc.X);
        const yValues = locations.map(loc => loc.Y);
        
        const xMin = Math.min(...xValues);
        const xMax = Math.max(...xValues);
        const yMin = Math.min(...yValues);
        const yMax = Math.max(...yValues);
        
        console.log(`数据范围: X(${xMin}-${xMax}), Y(${yMin}-${yMax})`);
        
        // 从测试数据范围创建映射矩阵
        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                const key = `${x},${y}`;
                coordMap.set(key, {
                    x: x,
                    y: y,
                    isEmpty: true, // 标记为空白坐标
                    isReference: false
                });
            }
        }
        
        console.log(`基于数据范围创建了 ${coordMap.size} 个坐标点的映射矩阵`);
    }
    
    // 标记有数据的坐标
    let dataPointCount = 0;
    locations.forEach(loc => {
        const key = `${loc.X},${loc.Y}`;
        if (coordMap.has(key)) {
            dataPointCount++;
            const coordData = coordMap.get(key);
            coordData.isEmpty = false;
            coordData.locationTotal = loc.locationTotal;
            coordData.failureTotal = loc.failureTotal;
            coordData.rate = loc.rate;
            coordData.failureDies = loc.failureDies;
        }
    });
    
    console.log(`填充了 ${dataPointCount} 个有数据的坐标点，占总映射点的 ${(dataPointCount / coordMap.size * 100).toFixed(1)}%`);
    
    // 查找数据集中最大故障率，用于归一化颜色
    let maxFailureRate = 0;
    for (const [key, coord] of coordMap.entries()) {
        if (!coord.isEmpty && coord.rate > maxFailureRate) {
            maxFailureRate = coord.rate;
        }
    }
    
    // 确保最小的最大故障率为10%，以便于颜色对比
    maxFailureRate = Math.max(0.1, maxFailureRate);
    console.log(`最大故障率: ${(maxFailureRate * 100).toFixed(2)}%`);
    
    // 获取并计算坐标范围
    const coords = Array.from(coordMap.values());
    const xValues = coords.map(c => c.x);
    const yValues = coords.map(c => c.y);
    
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    
    const xRange = xMax - xMin + 1;
    const yRange = yMax - yMin + 1;
    
    console.log(`坐标范围: X(${xMin}-${xMax}), Y(${yMin}-${yMax}), 范围: ${xRange}x${yRange}`);
    
    // 根据坐标范围大小动态调整单元格大小
    let baseCellSize = Math.min(25, Math.max(6, Math.floor(600 / Math.max(xRange, yRange))));
    let cellSize = baseCellSize;
    
    // 对于大坐标范围，进一步减小单元格大小
    if (xRange <= 40 && yRange <= 40) {
        // 小范围，保持默认大小
        cellSize = baseCellSize;
    } else if (xRange <= 60 && yRange <= 80) {
        // 中等范围，稍微减小
        cellSize = Math.min(baseCellSize * 1.0, 12);
    } else {
        // 处理最大情况 (约160×70或更大)
        cellSize = Math.min(baseCellSize * 0.8, 8);
    }
    
    // 确保单元格大小在合理范围内，针对更大范围调整最小值
    cellSize = Math.max(6, Math.min(cellSize, 25));
    
    // 计算最终网格尺寸
    const gridWidth = xRange * cellSize;
    const gridHeight = yRange * cellSize;
    
    // 计算padding，确保网格居中显示，对大坐标系使用较小padding
    const padding = xRange > 100 ? 
        Math.max(20, Math.min(30, Math.floor(cellSize * 0.6))) : 
        Math.max(30, Math.min(50, Math.floor(cellSize * 0.8)));
    
    // 创建映射容器
    const mapDiv = document.createElement('div');
    mapDiv.className = 'wafer-grid-container';
    mapDiv.style.position = 'relative';
    mapDiv.style.width = '100%';
    mapDiv.style.height = '700px'; // 增加高度以适应大型映射
    mapDiv.style.margin = '0 auto';
    mapDiv.style.marginBottom = `50px`; 
    mapDiv.style.backgroundColor = '#f8f8f8';
    mapDiv.style.border = '1px solid #ddd';
    mapDiv.style.overflow = 'hidden';
    mapDiv.style.maxWidth = '100%';
    
    // 创建内部容器用于实际网格
    const gridContainer = document.createElement('div');
    gridContainer.style.position = 'relative';
    gridContainer.style.margin = '0 auto'; // 改为0 auto以居中
    gridContainer.style.display = 'flex'; // 使用flex布局
    gridContainer.style.justifyContent = 'center'; // 水平居中
    gridContainer.style.alignItems = 'center'; // 垂直居中
    gridContainer.style.width = '100%'; // 使用100%宽度充满容器
    gridContainer.style.height = '100%'; // 使用100%高度充满容器
    gridContainer.style.transformOrigin = 'center center';
    gridContainer.style.transition = 'none';
    gridContainer.style.cursor = 'grab';
    
    // 应用硬件加速以提高性能
    gridContainer.style.willChange = 'transform';
    gridContainer.style.backfaceVisibility = 'hidden';
    gridContainer.style.transformStyle = 'preserve-3d';
    
    // ==========================================
    // ========== 重构坐标轴和网格系统 ==========
    // ==========================================
    
    // 确保渲染整个坐标系统
    const completeGridWidth = (xMax - xMin + 1) * cellSize;
    const completeGridHeight = (yMax - yMin + 1) * cellSize;
    
    // 创建内部包装容器 - 用于同时缩放网格和坐标轴
    const gridAndAxesWrapper = document.createElement('div');
    gridAndAxesWrapper.style.position = 'relative';
    gridAndAxesWrapper.style.width = `${completeGridWidth}px`;
    gridAndAxesWrapper.style.height = `${completeGridHeight}px`;
    gridAndAxesWrapper.style.margin = '0 auto';
    
    // 创建网格元素
    let grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${xRange}, ${cellSize}px)`;
    grid.style.gridTemplateRows = `repeat(${yRange}, ${cellSize}px)`;
    grid.style.gap = '1px';
    grid.style.position = 'absolute';
    grid.style.top = '0';
    grid.style.left = '0';
    grid.style.width = `${completeGridWidth}px`;
    grid.style.height = `${completeGridHeight}px`;
    grid.style.backgroundColor = '#f8f8f8';
    
    console.log(`网格定义: 列数=${xRange}, 行数=${yRange}, 单元格大小=${cellSize}px`);
    console.log(`网格尺寸: 宽度=${completeGridWidth}px, 高度=${completeGridHeight}px`);
    
    // 使用优化的createWaferGrid函数创建晶圆单元格
    createWaferGrid(grid, xMin, xMax, yMin, yMax, cellSize, coordMap, referenceCoordinates, maxFailureRate);
    
    // 将网格添加到wrapper
    gridAndAxesWrapper.appendChild(grid);
    
    // === 创建Y轴系统 ===
    const yAxisContainer = document.createElement('div');
    yAxisContainer.style.position = 'absolute';
    yAxisContainer.style.left = '-40px'; // 增加左侧距离，确保标签有足够空间
    yAxisContainer.style.top = '0';
    yAxisContainer.style.width = '40px';
    yAxisContainer.style.height = `${completeGridHeight}px`; 
    yAxisContainer.style.zIndex = '5';
    
    // 创建Y轴标签容器
    const yAxis = document.createElement('div');
    yAxis.style.position = 'relative';
    yAxis.style.width = '100%';
    yAxis.style.height = '100%';
    yAxis.style.fontSize = '10px';
    yAxis.style.fontFamily = 'Arial, sans-serif';
    yAxis.style.color = '#333';
    
    // 计算更合适的标签间隔
    const calculateAxisStep = (range) => {
        if (range <= 10) return 1;
        if (range <= 20) return 2;
        if (range <= 50) return 5;
        if (range <= 100) return 10;
        if (range <= 200) return 20;
        return Math.ceil(range / 10);
    };
    
    const yAxisStep = calculateAxisStep(yRange);
    
    // 考虑间隙影响的定位计算
    const getGridPosition = (index, size, gap = 1) => {
        return (index * (size + gap)) + (size / 2);
    };
    
    // 创建所有Y轴标签 - 确保精确覆盖从yMin到yMax的每个坐标
    for (let y = yMin; y <= yMax; y++) {
        const yIndex = y - yMin;
        const yPos = getGridPosition(yIndex, cellSize);
        
        // 只在特定间隔显示标签文本
        if (y % yAxisStep === 0 || y === yMin || y === yMax) {
            const label = document.createElement('div');
            label.textContent = y;
            label.style.position = 'absolute';
            label.style.right = '5px';
            label.style.top = `${yPos}px`;
            label.style.transform = 'translateY(-50%)';
            label.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            label.style.padding = '2px 4px';
            label.style.borderRadius = '2px';
            label.style.boxShadow = '0 0 2px rgba(0, 0, 0, 0.2)';
            label.style.zIndex = '10';
            
            // 给首尾标签特殊样式
            if (y === yMin || y === yMax) {
                label.style.fontWeight = 'bold';
                label.style.backgroundColor = 'rgba(240, 240, 240, 0.95)';
                label.style.border = '1px solid #ddd';
            }
            
            yAxis.appendChild(label);
        }
        
        // 为每个坐标添加刻度线
        const tick = document.createElement('div');
        tick.style.position = 'absolute';
        tick.style.right = '0';
        tick.style.top = `${yPos}px`;
        tick.style.width = y % yAxisStep === 0 ? '6px' : '3px';
        tick.style.height = '1px';
        tick.style.backgroundColor = y % yAxisStep === 0 ? '#666' : '#ccc';
        tick.style.transform = 'translateY(-50%)';
        yAxis.appendChild(tick);
    }
    
    // 添加Y轴主线
    const yAxisLine = document.createElement('div');
    yAxisLine.style.position = 'absolute';
    yAxisLine.style.top = '0';
    yAxisLine.style.right = '0';
    yAxisLine.style.width = '1px';
    yAxisLine.style.height = '100%';
    yAxisLine.style.backgroundColor = '#999';
    yAxis.appendChild(yAxisLine);
    
    yAxisContainer.appendChild(yAxis);
    gridAndAxesWrapper.appendChild(yAxisContainer);
    
    // === 创建X轴系统 ===
    const xAxisContainer = document.createElement('div');
    xAxisContainer.style.position = 'absolute';
    xAxisContainer.style.left = '0'; 
    
    // 当使用最小网格单元格(6像素)时，将X轴往下移动64个像素
    const xAxisTopOffset = cellSize <= 6 ? 64 : 5;
    xAxisContainer.style.top = `${completeGridHeight + xAxisTopOffset}px`; 
    console.log(`X轴位置: 网格高度=${completeGridHeight}px, 偏移=${xAxisTopOffset}px, 总位置=${completeGridHeight + xAxisTopOffset}px`);
    
    xAxisContainer.style.width = `${completeGridWidth}px`; 
    xAxisContainer.style.height = '40px'; 
    xAxisContainer.style.zIndex = '5';
    
    // 创建X轴标签容器
    const xAxis = document.createElement('div');
    xAxis.style.position = 'relative';
    xAxis.style.width = '100%';
    xAxis.style.height = '100%';
    xAxis.style.fontSize = '10px';
    xAxis.style.fontFamily = 'Arial, sans-serif';
    xAxis.style.color = '#333';
    
    const xAxisStep = calculateAxisStep(xRange);
    
    // 创建所有X轴标签 - 确保精确覆盖从xMin到xMax的每个坐标
    for (let x = xMin; x <= xMax; x++) {
        const xIndex = x - xMin;
        const xPos = getGridPosition(xIndex, cellSize);
        
        // 只在特定间隔显示标签文本
        if (x % xAxisStep === 0 || x === xMin || x === xMax) {
            const label = document.createElement('div');
            label.textContent = x;
            label.style.position = 'absolute';
            label.style.left = `${xPos}px`;
            label.style.top = '5px';
            label.style.transform = 'translateX(-50%)';
            label.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            label.style.padding = '2px 4px';
            label.style.borderRadius = '2px';
            label.style.boxShadow = '0 0 2px rgba(0, 0, 0, 0.2)';
            label.style.zIndex = '10';
            
            // 给首尾标签特殊样式
            if (x === xMin || x === xMax) {
                label.style.fontWeight = 'bold';
                label.style.backgroundColor = 'rgba(240, 240, 240, 0.95)';
                label.style.border = '1px solid #ddd';
            }
            
            xAxis.appendChild(label);
        }
        
        // 为每个坐标添加刻度线
        const tick = document.createElement('div');
        tick.style.position = 'absolute';
        tick.style.left = `${xPos}px`;
        tick.style.top = '0';
        tick.style.width = '1px';
        tick.style.height = x % xAxisStep === 0 ? '6px' : '3px';
        tick.style.backgroundColor = x % xAxisStep === 0 ? '#666' : '#ccc';
        tick.style.transform = 'translateX(-50%)';
        xAxis.appendChild(tick);
    }
    
    // 添加X轴主线
    const xAxisLine = document.createElement('div');
    xAxisLine.style.position = 'absolute';
    xAxisLine.style.top = '0';
    xAxisLine.style.left = '0';
    xAxisLine.style.width = '100%';
    xAxisLine.style.height = '1px';
    xAxisLine.style.backgroundColor = '#999';
    xAxis.appendChild(xAxisLine);
    
    xAxisContainer.appendChild(xAxis);
    gridAndAxesWrapper.appendChild(xAxisContainer);
    
    // 将整个wrapper添加到gridContainer
    gridContainer.appendChild(gridAndAxesWrapper);
    
    // 重新定位wrapper，确保在gridContainer中居中
    gridAndAxesWrapper.style.position = 'absolute';
    gridAndAxesWrapper.style.left = '50%';
    gridAndAxesWrapper.style.top = '50%';
    gridAndAxesWrapper.style.transform = 'translate(-50%, -50%)';
    gridAndAxesWrapper.style.transformOrigin = 'center center'; // 确保从中心点缩放
    
    // 不再需要为gridContainer添加padding，因为我们使用绝对定位和transform来居中
    // gridContainer.style.padding = `${padding}px`;
    
    // === 添加缩放和拖拽功能 ===
    // 创建缩放比例显示元素
    let zoomIndicator = document.createElement('div');
    zoomIndicator.style.position = 'absolute';
    zoomIndicator.style.bottom = '20px';
    zoomIndicator.style.left = '50%';
    zoomIndicator.style.transform = 'translateX(-50%)';
    zoomIndicator.style.padding = '5px 10px';
    zoomIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    zoomIndicator.style.color = 'white';
    zoomIndicator.style.borderRadius = '4px';
    zoomIndicator.style.fontSize = '14px';
    zoomIndicator.style.fontWeight = 'bold';
    zoomIndicator.style.zIndex = '1000';
    zoomIndicator.style.opacity = '0';
    zoomIndicator.style.transition = 'opacity 0.3s ease';
    zoomIndicator.textContent = '缩放: 100%';
    mapDiv.appendChild(zoomIndicator);
    
    // 设置缩放和拖拽变量
    let currentScale = 1;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let translateX = 0;
    let translateY = 0;
    const scaleStep = 0.1;
    const maxScale = 3;
    const minScale = 0.3;
    let zoomIndicatorTimeout;
    
    // 节流函数
    const throttle = (func, limit = 16) => {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= limit) {
                lastCall = now;
                func.apply(this, args);
            }
        };
    };
    
    // 显示缩放级别
    const showZoomLevel = (scale) => {
        // 更新缩放比例文本
        const zoomPercent = Math.round(scale * 100);
        zoomIndicator.textContent = `缩放: ${zoomPercent}%`;
        
        // 显示缩放指示器
        zoomIndicator.style.opacity = '1';
        
        // 清除之前的计时器
        if (zoomIndicatorTimeout) {
            clearTimeout(zoomIndicatorTimeout);
        }
        
        // 设置新的计时器，2秒后隐藏
        zoomIndicatorTimeout = setTimeout(() => {
            zoomIndicator.style.opacity = '0';
        }, 2000);
    };
    
    // 应用变换
    const applyTransform = () => {
        gridAndAxesWrapper.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
        showZoomLevel(currentScale);
    };
    
    // 处理缩放
    const handleZoom = (delta) => {
        requestAnimationFrame(() => {
            const newScale = Math.max(minScale, Math.min(maxScale, currentScale + delta));
            if (newScale !== currentScale) {
                currentScale = newScale;
                applyTransform();
            }
        });
    };
    
    // 鼠标滚轮事件
    const throttledWheel = throttle((e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? scaleStep : -scaleStep;
        handleZoom(delta);
    }, 16);
    
    waferMapContainer.addEventListener('wheel', throttledWheel, { passive: false });
    
    // 鼠标拖拽事件
    waferMapContainer.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // 左键
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
            gridContainer.style.cursor = 'grabbing';
            waferMapContainer.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });
    
    // 鼠标移动处理
    const throttledMouseMove = throttle((e) => {
        if (isDragging) {
            const dx = (e.clientX - startX) / currentScale;
            const dy = (e.clientY - startY) / currentScale;
            translateX += dx;
            translateY += dy;
            startX = e.clientX;
            startY = e.clientY;
            
            requestAnimationFrame(() => {
                applyTransform();
            });
        }
    }, 16);
    
    document.addEventListener('mousemove', throttledMouseMove);
    
    // 鼠标松开停止拖拽
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            gridContainer.style.cursor = 'grab';
            waferMapContainer.style.cursor = 'auto';
        }
    });
    
    // 鼠标离开停止拖拽
    waferMapContainer.addEventListener('mouseleave', () => {
        if (isDragging) {
            isDragging = false;
            gridContainer.style.cursor = 'grab';
            waferMapContainer.style.cursor = 'auto';
        }
    });
    
    // 自动调整初始缩放
    const autoAdjustInitialScale = () => {
        // 计算当前容器的可见区域
        const containerWidth = waferMapContainer.clientWidth;
        const containerHeight = waferMapContainer.clientHeight - 100;
        
        // 计算实际Mapping的尺寸
        const totalWidth = completeGridWidth + 60;
        const totalHeight = completeGridHeight + 60;
        
        // 确定缩放比例
        const scaleX = containerWidth / totalWidth;
        const scaleY = containerHeight / totalHeight;
        
        // 使用较小的缩放比例，确保完整显示
        let autoScale = Math.min(scaleX, scaleY) * 0.9;
        autoScale = Math.max(0.1, Math.min(maxScale, autoScale));
        
        // 计算居中位置
        // 计算缩放后的宽高
        const scaledWidth = totalWidth * autoScale;
        const scaledHeight = totalHeight * autoScale;
        
        // 计算居中所需的偏移量
        const offsetX = (containerWidth - scaledWidth) / 2 / autoScale;
        const offsetY = (containerHeight - scaledHeight) / 2 / autoScale;
        
        console.log(`初始居中计算: 容器尺寸=${containerWidth}x${containerHeight}, 内容尺寸=${totalWidth}x${totalHeight}, 缩放=${autoScale}, 偏移=${offsetX},${offsetY}`);
        
        // 应用缩放和居中位置
        currentScale = autoScale;
        translateX = 0; // 不需要额外偏移，因为gridAndAxesWrapper已经通过transform:translate(-50%, -50%)居中
        translateY = 0;
        
        applyTransform();
        
        // 显示提示
        zoomIndicator.textContent = `初始缩放: ${(autoScale * 100).toFixed(0)}%`;
        zoomIndicator.style.opacity = '1';
        setTimeout(() => {
            zoomIndicator.style.opacity = '0';
        }, 3000);
    };
    
    // 将gridContainer添加到mapDiv
    mapDiv.appendChild(gridContainer);
    
    // 添加颜色图例
    addColorScaleLegend(maxFailureRate);
    
    // 显示统计信息
    displayStats(locationStats);
    
    // 清空并添加新的映射图
    const container = document.getElementById('wafer-map-container');
    container.innerHTML = '';
    container.appendChild(mapDiv);
    
    // 添加键盘快捷键支持 - 只保留重置功能
    waferMapContainer.tabIndex = 0; // 使容器可获得焦点
    waferMapContainer.focus();
    
    waferMapContainer.addEventListener('keydown', function(event) {
        // 重置 (r)
        if (event.key === 'r' || event.key === 'R') {
            event.preventDefault();
            // 重置视图
            autoAdjustInitialScale();
            
            // 显示提示
            zoomIndicator.textContent = '视图已重置';
            zoomIndicator.style.opacity = '1';
            setTimeout(() => {
                zoomIndicator.style.opacity = '0';
            }, 2000);
        }
    });
    
    // 确保mapDiv容器有足够的下边距以显示移动后的X轴标签
    mapDiv.style.marginBottom = `${cellSize * 4}px`;
    
    // 自动调整初始缩放
    setTimeout(autoAdjustInitialScale, 100);
    
    // 页面大小调整时重新计算缩放
    const resizeHandler = () => {
        setTimeout(autoAdjustInitialScale, 200);
    };
    
    // 添加窗口大小调整监听
    window.addEventListener('resize', resizeHandler);
    
    // 返回清理函数（如果需要）
    return function cleanup() {
        window.removeEventListener('resize', resizeHandler);
        waferMapContainer.removeEventListener('wheel', throttledWheel);
        document.removeEventListener('mousemove', throttledMouseMove);
        document.removeEventListener('mouseup', () => {});
    };
}

// 添加颜色刻度图例
function addColorScaleLegend(maxFailureRate) {
    // 创建或获取图例容器
    let legendContainer = document.getElementById('custom-legend');
    if (!legendContainer) {
        legendContainer = document.createElement('div');
        legendContainer.id = 'custom-legend';
        legendContainer.className = 'custom-legend';
        legendContainer.style.position = 'absolute';
        legendContainer.style.top = '10px';
        legendContainer.style.right = '10px';
        legendContainer.style.background = 'rgba(255, 255, 255, 0.9)';
        legendContainer.style.padding = '10px';
        legendContainer.style.borderRadius = '4px';
        legendContainer.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        legendContainer.style.zIndex = '1000';
        legendContainer.style.maxWidth = '180px'; // 减小最大宽度
        legendContainer.style.fontSize = '11px'; // 减小字体大小
        
        // 添加到映射容器
        const mapContainer = document.getElementById('wafer-map-container');
        if (mapContainer) {
            mapContainer.appendChild(legendContainer);
        }
    }
    
    // 清空现有内容
    legendContainer.innerHTML = '';
    
    // 添加图例标题
    const legendTitle = document.createElement('div');
    legendTitle.className = 'legend-title';
    legendTitle.textContent = '故障率颜色图例';
    legendTitle.style.fontWeight = 'bold';
    legendTitle.style.marginBottom = '4px'; 
    legendTitle.style.fontSize = '12px';
    legendContainer.appendChild(legendTitle);
    
    // 添加最大故障率信息
    const maxRateInfo = document.createElement('div');
    maxRateInfo.style.fontSize = '11px';
    maxRateInfo.style.marginBottom = '6px';
    maxRateInfo.textContent = `最大故障率: ${(maxFailureRate * 100).toFixed(2)}%`;
    legendContainer.appendChild(maxRateInfo);
    
    // 创建颜色刻度条
    const colorScale = document.createElement('div');
    colorScale.style.width = '100%';
    colorScale.style.height = '16px'; 
    colorScale.style.position = 'relative';
    colorScale.style.marginBottom = '3px';
    colorScale.style.border = '1px solid #999';
    colorScale.style.background = 'linear-gradient(to right, hsl(60, 100%, 45%, 0.6), hsl(30, 100%, 45%, 0.8), hsl(0, 100%, 45%, 1))';
    legendContainer.appendChild(colorScale);
    
    // 创建刻度标签容器
    const scaleLabels = document.createElement('div');
    scaleLabels.style.display = 'flex';
    scaleLabels.style.justifyContent = 'space-between';
    scaleLabels.style.marginBottom = '8px';
    
    // 添加刻度标签
    const minLabel = document.createElement('div');
    minLabel.textContent = '0%';
    minLabel.style.fontSize = '10px';
    
    const midLabel = document.createElement('div');
    midLabel.textContent = `${((maxFailureRate / 2) * 100).toFixed(0)}%`;
    midLabel.style.fontSize = '10px';
    
    const maxLabel = document.createElement('div');
    maxLabel.textContent = `${(maxFailureRate * 100).toFixed(0)}%`;
    maxLabel.style.fontSize = '10px';
    
    scaleLabels.appendChild(minLabel);
    scaleLabels.appendChild(midLabel);
    scaleLabels.appendChild(maxLabel);
    legendContainer.appendChild(scaleLabels);
    
    // 创建详细颜色说明
    const colorDescTitle = document.createElement('div');
    colorDescTitle.textContent = '颜色说明';
    colorDescTitle.style.fontWeight = 'bold';
    colorDescTitle.style.marginBottom = '3px';
    colorDescTitle.style.fontSize = '11px';
    legendContainer.appendChild(colorDescTitle);
    
    // 颜色说明项目
    const legendItems = [];
    
    // 基本颜色说明
    legendItems.push({ color: 'rgba(240, 240, 240, 0.8)', label: '通过 (SB=0或SB=1)' });
    legendItems.push({ color: 'rgba(240, 240, 240, 0.3)', label: '无数据坐标' });
    
    // 根据当前模式添加特定说明
    if (selectedFailureCode !== 'all' && selectedFailureCode !== 'pass' && selectedFailureCode !== 'fail') {
        legendItems.push({ color: 'hsl(0, 100%, 45%, 0.9)', label: `${selectedFailureCode} 故障代码` });
    }
    
    // 创建图例项
    legendItems.forEach(item => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.style.display = 'flex';
        legendItem.style.alignItems = 'center';
        legendItem.style.marginBottom = '3px';
        
        const colorBox = document.createElement('span');
        colorBox.className = 'color-box';
        colorBox.style.display = 'inline-block';
        colorBox.style.width = '12px';
        colorBox.style.height = '12px';
        colorBox.style.backgroundColor = item.color;
        colorBox.style.marginRight = '5px';
        colorBox.style.border = '1px solid #999';
        
        const label = document.createElement('span');
        label.textContent = item.label;
        label.style.fontSize = '10px';
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContainer.appendChild(legendItem);
    });
}

// 显示统计信息
function displayStats(waferMap) {
    console.log('显示统计信息');
    
    // 找到所有位置
    const locations = Object.values(waferMap);
    
    if (locations.length === 0) {
        console.warn('无统计数据可显示');
        return;
    }
    
    // 汇总统计
    const totalDies = locations.reduce((sum, loc) => sum + loc.locationTotal, 0);
    const totalFailures = locations.reduce((sum, loc) => sum + loc.failureTotal, 0);
    const failureRate = totalDies > 0 ? (totalFailures / totalDies) * 100 : 0;
    
    // 获取故障代码分布
    const codeCounts = {};
    locations.forEach(loc => {
        for (const code in loc.sbCounts) {
            if (!codeCounts[code]) {
                codeCounts[code] = 0;
            }
            codeCounts[code] += loc.sbCounts[code];
        }
    });
    
    // 查找或创建统计信息容器
    let statsContainer = document.getElementById('stats-container');
    if (!statsContainer) {
        // 先找到晶圆映射容器
        const waferMapContainer = ensureWaferMapContainer();
        
        // 创建统计信息容器
        statsContainer = document.createElement('div');
        statsContainer.id = 'stats-container';
        statsContainer.style.marginTop = '20px';
        statsContainer.style.padding = '15px';
        statsContainer.style.backgroundColor = '#f9f9f9';
        statsContainer.style.border = '1px solid #ddd';
        statsContainer.style.borderRadius = '4px';
        
        // 添加到页面（在晶圆映射容器之后）
        waferMapContainer.parentNode.insertBefore(statsContainer, waferMapContainer.nextSibling);
    }
    
    // 构建HTML内容
    let statsHTML = `
        <h3>晶圆统计信息</h3>
        <div class="stats-grid">
            <div class="stats-item">
                <div class="stats-value">${totalDies}</div>
                <div class="stats-label">总DIE数</div>
            </div>
            <div class="stats-item">
                <div class="stats-value">${totalFailures}</div>
                <div class="stats-label">故障DIE数</div>
            </div>
            <div class="stats-item">
                <div class="stats-value">${failureRate.toFixed(2)}%</div>
                <div class="stats-label">故障率</div>
            </div>
            <div class="stats-item">
                <div class="stats-value">${locations.length}</div>
                <div class="stats-label">测试位置数</div>
            </div>
        </div>
    `;
    
    // 添加故障代码分布
    if (Object.keys(codeCounts).length > 0) {
        statsHTML += '<h3>故障代码分布</h3><div class="code-distribution">';
        
        for (const code in codeCounts) {
            // 跳过通过代码
            if (code === '0') continue;
            
            const count = codeCounts[code];
            const percent = totalDies > 0 ? (count / totalDies) * 100 : 0;
            
            statsHTML += `
                <div class="code-item">
                    <div class="code-name">${code}</div>
                    <div class="code-count">${count} (${percent.toFixed(2)}%)</div>
                    <div class="code-bar" style="width: ${Math.min(percent * 3, 100)}%"></div>
                </div>
            `;
        }
        
        statsHTML += '</div>';
    }
    
    // 添加统计样式
    const styleElement = document.getElementById('stats-style');
    if (!styleElement) {
        const style = document.createElement('style');
        style.id = 'stats-style';
        style.textContent = `
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }
            .stats-item {
                text-align: center;
                padding: 10px;
                background-color: #fff;
                border-radius: 4px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .stats-value {
                font-size: 24px;
                font-weight: bold;
                color: #2196F3;
            }
            .stats-label {
                font-size: 14px;
                color: #666;
                margin-top: 5px;
            }
            .code-distribution {
                margin-top: 10px;
            }
            .code-item {
                margin-bottom: 8px;
            }
            .code-name {
                font-weight: bold;
                margin-bottom: 2px;
            }
            .code-count {
                font-size: 14px;
                color: #666;
                margin-bottom: 4px;
            }
            .code-bar {
                height: 8px;
                background-color: #F44336;
                border-radius: 4px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 设置HTML内容
    statsContainer.innerHTML = statsHTML;
    
    console.log('统计信息已更新');
}

// 生成合并的映射图（所有数据合并在一起）
function generateMergedMap() {
    console.log('开始生成合并映射图...');
    
    if (!csvData || csvData.length === 0) {
        alert('请先加载CSV文件');
        return;
    }
    
    // 确保晶圆映射容器存在
    const waferMapContainer = ensureWaferMapContainer();
    
    // 显示加载指示器和进度条
    showStatusMessage('正在生成合并映射图，请稍候...', 'info');
    showLoadingIndicator(waferMapContainer, '正在准备数据...');
    
    // 添加进度显示区域
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.style.margin = '10px 0';
    progressContainer.style.backgroundColor = '#f0f0f0';
    progressContainer.style.borderRadius = '4px';
    progressContainer.style.overflow = 'hidden';
    progressContainer.style.height = '20px';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.width = '0%';
    progressBar.style.height = '100%';
    progressBar.style.backgroundColor = '#4CAF50';
    progressBar.style.transition = 'width 0.3s ease';
    
    progressContainer.appendChild(progressBar);
    
    const progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressText.style.textAlign = 'center';
    progressText.style.marginTop = '5px';
    progressText.textContent = '准备中...';
    
    waferMapContainer.appendChild(progressContainer);
    waferMapContainer.appendChild(progressText);
    
    // 延迟执行主要计算，避免UI阻塞
    setTimeout(() => {
        try {
            console.log('开始合并所有数据并为参考坐标计算统计信息...');
            
            // 创建一个Map来存储每个坐标点的数据
            const coordMap = new Map();
            const totalDataPoints = csvData.length;
            let processedDataPoints = 0;
            
            // 首先检查是否有参考坐标
            if (referenceCoordinates.length === 0) {
                // 如果没有参考坐标，显示错误消息
                waferMapContainer.removeChild(progressContainer);
                waferMapContainer.removeChild(progressText);
                hideLoadingIndicator();
                showStatusMessage('没有参考坐标数据，请先加载参考坐标', 'error');
                return;
            }
            
            // 为参考坐标系中的每个坐标点创建容器
            referenceCoordinates.forEach(coord => {
                // 处理不同属性名称的情况 (x/X, y/Y)
                const x = coord.x !== undefined ? coord.x : coord.X;
                const y = coord.y !== undefined ? coord.y : coord.Y;
                
                if (!isNaN(x) && !isNaN(y)) {
                    const coordKey = `${x},${y}`;
                    
                    if (!coordMap.has(coordKey)) {
                        coordMap.set(coordKey, { x, y, rows: [] });
                    }
                }
            });
            
            console.log(`为 ${coordMap.size} 个参考坐标点准备了数据容器`);
            
            // 遍历所有CSV数据，将每个数据点分配到对应的参考坐标
            csvData.forEach((row, index) => {
                const x = typeof row.X === 'number' ? row.X : parseFloat(row.X);
                const y = typeof row.Y === 'number' ? row.Y : parseFloat(row.Y);
                
                if (!isNaN(x) && !isNaN(y)) {
                    const coordKey = `${x},${y}`;
                    
                    // 只处理参考坐标系中存在的坐标点
                    if (coordMap.has(coordKey)) {
                    coordMap.get(coordKey).rows.push(row);
                    }
                }
                
                // 更新进度条
                processedDataPoints++;
                if (index % 100 === 0 || index === totalDataPoints - 1) {
                    const progress = (processedDataPoints / totalDataPoints) * 50; // 前50%用于数据收集
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `正在收集数据 ${processedDataPoints}/${totalDataPoints} (${Math.round(progress)}%)`;
                }
            });
            
            console.log('数据收集完成，开始计算每个坐标点的统计信息');
            
            // 清空当前映射数据
            waferMap = {};
            
            // 计算各坐标点的统计信息
            let processedCoords = 0;
            const totalCoords = coordMap.size;
            
            // 遍历所有参考坐标点，计算统计信息
            for (const [key, coord] of coordMap.entries()) {
                // 使用统一的mapKey格式
                const mapKey = `merged_${coord.x}_${coord.y}`;
                
                // 使用与其他函数相同的计算逻辑
                waferMap[mapKey] = calculateLocationStats(coord.rows, coord.x, coord.y);
                
                // 更新进度
                processedCoords++;
                const progress = 50 + ((processedCoords / totalCoords) * 50); // 后50%用于统计计算
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `正在计算统计信息 ${processedCoords}/${totalCoords} (${Math.round(progress)}%)`;
            }
            
            console.log(`统计计算完成，共 ${Object.keys(waferMap).length} 个坐标点`);
            
                    // 清除进度条和加载指示器
                    waferMapContainer.removeChild(progressContainer);
                    waferMapContainer.removeChild(progressText);
                    hideLoadingIndicator();
                    
                    // 清除旧的映射图，并确保容器存在
                    waferMapContainer.innerHTML = '';
                    
                    // 创建新的映射图容器
                    const mapDiv = document.createElement('div');
                    mapDiv.id = 'wafer-map-container';
                    mapDiv.style.width = '100%';
                    mapDiv.style.height = '600px';
                    mapDiv.style.position = 'relative';
                    mapDiv.style.overflow = 'hidden';
                    mapDiv.style.border = '1px solid #ddd';
                    mapDiv.style.borderRadius = '4px';
                    mapDiv.style.backgroundColor = '#f9f9f9';
                    waferMapContainer.appendChild(mapDiv);
                    
                    // 绘制合并的映射图
                    drawWaferMap(waferMap, `合并映射图 - 共 ${Object.keys(waferMap).length} 个坐标`);
                    
                    // 显示统计信息
                    displayStats(waferMap);
                    
                    // 启用导出按钮
                    if (exportExcelBtn) exportExcelBtn.disabled = false;
                    if (exportImageBtn) exportImageBtn.disabled = false;
                    
                    showStatusMessage(`已完成合并映射图的生成，共 ${Object.keys(waferMap).length} 个坐标`, 'success');
            
        } catch (error) {
            console.error('生成合并映射时出错:', error);
            hideLoadingIndicator();
            showStatusMessage(`生成合并映射出错: ${error.message}`, 'error');
        }
    }, 50);
}

// 显示ASIC批次选择对话框
function showAsicBatchDialog() {
    if (!csvData || csvData.length === 0) {
        alert('请先加载CSV文件');
        return;
    }
    
    // 获取所有ASIC批次
    const asicBatches = [...new Set(csvData.map(row => row.asic))].filter(Boolean);
    
    if (asicBatches.length === 0) {
        alert('没有找到有效的ASIC批次数据');
        return;
    }
    
    // 创建对话框
    const dialogOverlay = document.createElement('div');
    dialogOverlay.style.position = 'fixed';
    dialogOverlay.style.top = '0';
    dialogOverlay.style.left = '0';
    dialogOverlay.style.width = '100%';
    dialogOverlay.style.height = '100%';
    dialogOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    dialogOverlay.style.display = 'flex';
    dialogOverlay.style.justifyContent = 'center';
    dialogOverlay.style.alignItems = 'center';
    dialogOverlay.style.zIndex = '1000';
    
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'white';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '5px';
    dialog.style.maxWidth = '500px';
    dialog.style.width = '90%';
    dialog.style.maxHeight = '80%';
    dialog.style.overflow = 'auto';
    dialog.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    
    // 添加标题
    const title = document.createElement('h4');
    title.textContent = '选择要生成映射的ASIC批次';
    title.style.marginBottom = '15px';
    
    // 添加说明
    const description = document.createElement('p');
    description.textContent = '为选定的ASIC批次生成映射，将合并该批次下的所有晶圆数据。';
    description.style.marginBottom = '15px';
    
    dialog.appendChild(title);
    dialog.appendChild(description);
    
    // 添加ASIC选择列表
    const asicList = document.createElement('div');
    asicList.style.maxHeight = '300px';
    asicList.style.overflowY = 'auto';
    asicList.style.border = '1px solid #ddd';
    asicList.style.padding = '10px';
    asicList.style.marginBottom = '15px';
    
    asicBatches.forEach(asic => {
        const asicItem = document.createElement('div');
        asicItem.style.marginBottom = '10px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `asic-${asic}`;
        checkbox.value = asic;
        checkbox.style.marginRight = '10px';
        
        const label = document.createElement('label');
        label.htmlFor = `asic-${asic}`;
        label.textContent = `ASIC: ${asic}`;
        
        asicItem.appendChild(checkbox);
        asicItem.appendChild(label);
        asicList.appendChild(asicItem);
    });
    
    dialog.appendChild(asicList);
    
    // 添加全选/取消全选按钮
    const selectAllContainer = document.createElement('div');
    selectAllContainer.style.marginBottom = '15px';
    
    const selectAllButton = document.createElement('button');
    selectAllButton.textContent = '全选';
    selectAllButton.className = 'btn btn-sm btn-outline-primary';
    selectAllButton.style.marginRight = '10px';
    selectAllButton.onclick = () => {
        asicList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    };
    
    const deselectAllButton = document.createElement('button');
    deselectAllButton.textContent = '取消全选';
    deselectAllButton.className = 'btn btn-sm btn-outline-secondary';
    deselectAllButton.onclick = () => {
        asicList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    };
    
    selectAllContainer.appendChild(selectAllButton);
    selectAllContainer.appendChild(deselectAllButton);
    dialog.appendChild(selectAllContainer);
    
    // 添加按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.marginTop = '15px';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.className = 'btn btn-secondary';
    cancelButton.style.marginRight = '10px';
    cancelButton.onclick = () => {
        document.body.removeChild(dialogOverlay);
    };
    
    const confirmButton = document.createElement('button');
    confirmButton.textContent = '生成';
    confirmButton.className = 'btn btn-primary';
    confirmButton.onclick = () => {
        // 获取选中的ASIC批次
        const selectedAsics = [];
        asicList.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            selectedAsics.push(cb.value);
        });
        
        if (selectedAsics.length === 0) {
            alert('请至少选择一个ASIC批次');
            return;
        }
        
        // 关闭对话框
        document.body.removeChild(dialogOverlay);
        
        // 开始生成
        generateMapsByAsic(selectedAsics);
    };
    
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    dialog.appendChild(buttonContainer);
    
    dialogOverlay.appendChild(dialog);
    document.body.appendChild(dialogOverlay);
}

// 按ASIC批次生成映射图
function generateMapsByAsic(asicBatches) {
    console.log(`开始按ASIC批次生成映射图: ${asicBatches.join(', ')}`);
    
    if (!csvData || csvData.length === 0) {
        alert('请先加载CSV文件');
        return;
    }
    
    if (!asicBatches || asicBatches.length === 0) {
        alert('请选择至少一个ASIC批次');
        return;
    }
    
    // 确保晶圆映射容器存在
    const waferMapContainer = ensureWaferMapContainer();
    
    // 显示加载指示器
    showStatusMessage(`正在为 ${asicBatches.length} 个ASIC批次生成映射图`, 'info');
    showLoadingIndicator(waferMapContainer, '正在准备数据...');
    
    // 添加进度显示区域
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.style.margin = '10px 0';
    progressContainer.style.backgroundColor = '#f0f0f0';
    progressContainer.style.borderRadius = '4px';
    progressContainer.style.overflow = 'hidden';
    progressContainer.style.height = '20px';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.width = '0%';
    progressBar.style.height = '100%';
    progressBar.style.backgroundColor = '#4CAF50';
    progressBar.style.transition = 'width 0.3s ease';
    
    progressContainer.appendChild(progressBar);
    
    const progressText = document.createElement('div');
    progressText.className = 'progress-text';
    progressText.style.textAlign = 'center';
    progressText.style.marginTop = '5px';
    progressText.textContent = '准备中...';
    
    waferMapContainer.appendChild(progressContainer);
    waferMapContainer.appendChild(progressText);
    
    // 延迟执行主要计算，避免UI阻塞
    setTimeout(() => {
        try {
            // 为每个ASIC批次创建单独的映射
            const asicMaps = {};
            let processedAsics = 0;
            
            // 按批次处理ASIC
            const processAsicBatch = (startIndex) => {
                const endIndex = Math.min(startIndex + 1, asicBatches.length);
                
                for (let i = startIndex; i < endIndex; i++) {
                    const asic = asicBatches[i];
                    const asicData = csvData.filter(row => row.asic === asic);
                    
                    if (asicData.length === 0) {
                        console.warn(`没有找到ASIC批次 ${asic} 的数据`);
                        processedAsics++;
                        continue;
                    }
                    
                    progressBar.style.width = `${(processedAsics / asicBatches.length) * 100}%`;
                    progressText.textContent = `正在处理 ASIC ${asic}，${processedAsics+1}/${asicBatches.length}`;
                    
                    // 创建坐标Map
                    const coordMap = new Map();
                    
                    // 收集这个ASIC的所有坐标点
                    asicData.forEach(row => {
                        const x = typeof row.X === 'number' ? row.X : parseFloat(row.X);
                        const y = typeof row.Y === 'number' ? row.Y : parseFloat(row.Y);
                        
                        if (!isNaN(x) && !isNaN(y)) {
                            const coordKey = `${x},${y}`;
                            
                            if (!coordMap.has(coordKey)) {
                                coordMap.set(coordKey, { x, y, rows: [] });
                            }
                            
                            coordMap.get(coordKey).rows.push(row);
                        }
                    });
                    
                    // 创建这个ASIC的映射
                    asicMaps[asic] = {};
                    
                    // 计算每个坐标的统计信息
                    for (const [coordKey, coordData] of coordMap.entries()) {
                        const mapKey = `${asic}_${coordData.x}_${coordData.y}`;
                        asicMaps[asic][mapKey] = calculateLocationStats(coordData.rows, coordData.x, coordData.y);
                    }
                    
                    processedAsics++;
                }
                
                // 更新进度
                progressBar.style.width = `${(processedAsics / asicBatches.length) * 100}%`;
                progressText.textContent = `已处理 ${processedAsics}/${asicBatches.length} 个ASIC批次`;
                
                // 继续处理下一批，或完成
                if (endIndex < asicBatches.length) {
                    setTimeout(() => processAsicBatch(endIndex), 10);
                } else {
                    // 所有ASIC都处理完毕
                    finishProcessing();
                }
            };
            
            // 结束处理，更新UI
            const finishProcessing = () => {
                progressBar.style.width = '100%';
                progressText.textContent = '处理完成! 正在生成映射图...';
                
                setTimeout(() => {
                    // 清除进度条和加载指示器
                    waferMapContainer.removeChild(progressContainer);
                    waferMapContainer.removeChild(progressText);
                    hideLoadingIndicator();
                    
                    // 清除旧的映射图
                    waferMapContainer.innerHTML = '';
                    
                    // 如果有多个ASIC，创建选择器
                    if (Object.keys(asicMaps).length > 1) {
                        const asicSelector = document.createElement('div');
                        asicSelector.style.marginBottom = '15px';
                        
                        const label = document.createElement('label');
                        label.textContent = '选择ASIC批次: ';
                        label.style.marginRight = '10px';
                        
                        const select = document.createElement('select');
                        select.className = 'form-control';
                        select.style.display = 'inline-block';
                        select.style.width = 'auto';
                        
                        Object.keys(asicMaps).forEach(asic => {
                            const option = document.createElement('option');
                            option.value = asic;
                            option.textContent = `ASIC: ${asic} - ${Object.keys(asicMaps[asic]).length} 个坐标`;
                            select.appendChild(option);
                        });
                        
                        asicSelector.appendChild(label);
                        asicSelector.appendChild(select);
                        waferMapContainer.appendChild(asicSelector);
                        
                        // 添加变化事件
                        select.addEventListener('change', () => {
                            const selectedAsic = select.value;
                            showAsicMap(selectedAsic);
                        });
                        
                        // 显示第一个ASIC的映射
                        const firstAsic = Object.keys(asicMaps)[0];
                        showAsicMap(firstAsic);
                    } else if (Object.keys(asicMaps).length === 1) {
                        // 只有一个ASIC，直接显示
                        const asic = Object.keys(asicMaps)[0];
                        showAsicMap(asic);
                    } else {
                        showStatusMessage('没有有效的ASIC批次数据', 'error');
                    }
                    
                    showStatusMessage(`已完成 ${Object.keys(asicMaps).length} 个ASIC批次的映射图生成`, 'success');
                }, 500);
            };
            
            // 显示指定ASIC的映射
            const showAsicMap = (asic) => {
                // 清除现有的映射图
                const existingMapDiv = document.getElementById('wafer-map-container');
                if (existingMapDiv && existingMapDiv.parentNode === waferMapContainer) {
                    waferMapContainer.removeChild(existingMapDiv);
                } else {
                    // 如果不是直接子节点，直接清空容器内容
                    waferMapContainer.innerHTML = '';
                }
                
                // 创建新的映射图容器
                const mapDiv = document.createElement('div');
                mapDiv.id = 'wafer-map-container';
                mapDiv.style.width = '100%';
                mapDiv.style.height = '600px';
                mapDiv.style.position = 'relative';
                mapDiv.style.overflow = 'hidden';
                mapDiv.style.border = '1px solid #ddd';
                mapDiv.style.borderRadius = '4px';
                mapDiv.style.backgroundColor = '#f9f9f9';
                waferMapContainer.appendChild(mapDiv);
                
                // 绘制映射图
                drawWaferMap(asicMaps[asic], `ASIC批次 ${asic} 映射图 - 共 ${Object.keys(asicMaps[asic]).length} 个坐标`);
                
                // 显示统计信息
                displayStats(asicMaps[asic]);
                
                // 启用导出按钮
                if (exportExcelBtn) exportExcelBtn.disabled = false;
                if (exportImageBtn) exportImageBtn.disabled = false;
            };
            
            // 开始处理ASIC批次
            processAsicBatch(0);
            
        } catch (error) {
            console.error('按ASIC批次生成映射时出错:', error);
            hideLoadingIndicator();
            showStatusMessage(`生成映射出错: ${error.message}`, 'error');
        }
    }, 50);
}

// 处理文件上传完成后的逻辑
function onFileParseComplete(results) {
    // ... existing code ...
    
    // 更新UI状态
    updateWaferOptions();
    
    // 重新启用界面按钮
    uploadBtn.disabled = false;
    filePreviewBtn.disabled = false;
    generateMapBtn.disabled = false;
    generateAllMapBtn.disabled = false;
    generateByAsicBtn.disabled = false;
    
    // ... existing code ...
}

// 显示键盘快捷键帮助
function showKeyboardShortcutsHelp() {
    // 创建对话框
    const dialogOverlay = document.createElement('div');
    dialogOverlay.style.position = 'fixed';
    dialogOverlay.style.top = '0';
    dialogOverlay.style.left = '0';
    dialogOverlay.style.width = '100%';
    dialogOverlay.style.height = '100%';
    dialogOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    dialogOverlay.style.display = 'flex';
    dialogOverlay.style.justifyContent = 'center';
    dialogOverlay.style.alignItems = 'center';
    dialogOverlay.style.zIndex = '1000';
    
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'white';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '5px';
    dialog.style.maxWidth = '500px';
    dialog.style.width = '90%';
    dialog.style.maxHeight = '80%';
    dialog.style.overflow = 'auto';
    dialog.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    
    // 添加标题
    const title = document.createElement('h4');
    title.textContent = '键盘快捷键';
    title.style.marginBottom = '15px';
    dialog.appendChild(title);
    
    // 添加快捷键列表
    const shortcuts = [
        { key: 'M', description: '生成合并映射' },
        { key: 'G', description: '生成单个晶圆映射' },
        { key: 'A', description: '按ASIC批次生成映射' },
        { key: 'U', description: '上传CSV文件' },
        { key: '? 或 H', description: '显示此帮助' }
    ];
    
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    
    shortcuts.forEach(shortcut => {
        const row = document.createElement('tr');
        
        const keyCell = document.createElement('td');
        keyCell.textContent = shortcut.key;
        keyCell.style.padding = '8px';
        keyCell.style.border = '1px solid #ddd';
        keyCell.style.fontWeight = 'bold';
        keyCell.style.width = '100px';
        
        const descCell = document.createElement('td');
        descCell.textContent = shortcut.description;
        descCell.style.padding = '8px';
        descCell.style.border = '1px solid #ddd';
        
        row.appendChild(keyCell);
        row.appendChild(descCell);
        table.appendChild(row);
    });
    
    dialog.appendChild(table);
    
    // 添加关闭按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.textAlign = 'right';
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.className = 'btn btn-primary';
    closeButton.onclick = () => document.body.removeChild(dialogOverlay);
    
    buttonContainer.appendChild(closeButton);
    dialog.appendChild(buttonContainer);
    
    dialogOverlay.appendChild(dialog);
    document.body.appendChild(dialogOverlay);
    
    // 按ESC键关闭对话框
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(dialogOverlay);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// 显示应用程序使用指南
function showHelpGuide() {
    // 创建对话框
    const dialogOverlay = document.createElement('div');
    dialogOverlay.style.position = 'fixed';
    dialogOverlay.style.top = '0';
    dialogOverlay.style.left = '0';
    dialogOverlay.style.width = '100%';
    dialogOverlay.style.height = '100%';
    dialogOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    dialogOverlay.style.display = 'flex';
    dialogOverlay.style.justifyContent = 'center';
    dialogOverlay.style.alignItems = 'center';
    dialogOverlay.style.zIndex = '1000';
    
    const dialog = document.createElement('div');
    dialog.style.backgroundColor = 'white';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '5px';
    dialog.style.maxWidth = '600px';
    dialog.style.width = '90%';
    dialog.style.maxHeight = '80%';
    dialog.style.overflow = 'auto';
    dialog.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    
    // 添加标题
    const title = document.createElement('h3');
    title.textContent = '晶圆映射工具使用指南';
    title.style.marginBottom = '15px';
    title.style.borderBottom = '1px solid #ddd';
    title.style.paddingBottom = '10px';
    dialog.appendChild(title);
    
    // 添加使用指南内容
    const content = document.createElement('div');
    content.innerHTML = `
        <h4>基本操作流程</h4>
        <ol>
            <li><strong>加载参考坐标</strong>：首先从预定义坐标中选择或上传参考坐标文件</li>
            <li><strong>上传CSV数据</strong>：点击"选择文件"按钮，上传包含晶圆测试数据的CSV文件</li>
            <li><strong>选择映射方式</strong>：可以生成单个晶圆映射，按ASIC批次生成映射，或生成合并映射</li>
            <li><strong>分析结果</strong>：查看生成的映射图和统计信息，可以通过故障代码选择器筛选查看不同故障类型</li>
        </ol>
        
        <h4>功能说明</h4>
        <table style="width:100%; border-collapse:collapse; margin-bottom:15px;">
            <tr style="background-color:#f5f5f5;">
                <th style="padding:8px; border:1px solid #ddd; text-align:left;">功能</th>
                <th style="padding:8px; border:1px solid #ddd; text-align:left;">说明</th>
            </tr>
            <tr>
                <td style="padding:8px; border:1px solid #ddd;"><strong>生成映射</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">生成选定ASIC批次和晶圆的映射图</td>
            </tr>
            <tr>
                <td style="padding:8px; border:1px solid #ddd;"><strong>合并映射</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">不区分ASIC和晶圆，生成所有数据的合并映射图</td>
            </tr>
            <tr>
                <td style="padding:8px; border:1px solid #ddd;"><strong>按ASIC批次</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">选择特定的ASIC批次进行映射</td>
            </tr>
            <tr>
                <td style="padding:8px; border:1px solid #ddd;"><strong>故障代码筛选</strong></td>
                <td style="padding:8px; border:1px solid #ddd;">选择特定故障代码查看对应的映射情况</td>
            </tr>
        </table>
        
        <h4>映射图操作</h4>
        <ul>
            <li><strong>缩放</strong>：使用鼠标滚轮或右下角的缩放按钮放大/缩小映射图</li>
            <li><strong>移动</strong>：按住鼠标左键可拖动映射图</li>
            <li><strong>重置视图</strong>：点击右下角的重置按钮恢复初始视图</li>
        </ul>
        
        <h4>键盘快捷键</h4>
        <table style="width:100%; border-collapse:collapse;">
            <tr style="background-color:#f5f5f5;">
                <th style="padding:8px; border:1px solid #ddd; text-align:left;">快捷键</th>
                <th style="padding:8px; border:1px solid #ddd; text-align:left;">功能</th>
            </tr>
            <tr>
                <td style="padding:8px; border:1px solid #ddd;"><kbd>M</kbd></td>
                <td style="padding:8px; border:1px solid #ddd;">生成合并映射</td>
            </tr>
            <tr>
                <td style="padding:8px; border:1px solid #ddd;"><kbd>G</kbd></td>
                <td style="padding:8px; border:1px solid #ddd;">生成单个晶圆映射</td>
            </tr>
            <tr>
                <td style="padding:8px; border:1px solid #ddd;"><kbd>A</kbd></td>
                <td style="padding:8px; border:1px solid #ddd;">按ASIC批次生成映射</td>
            </tr>
            <tr>
                <td style="padding:8px; border:1px solid #ddd;"><kbd>U</kbd></td>
                <td style="padding:8px; border:1px solid #ddd;">上传CSV文件</td>
            </tr>
            <tr>
                <td style="padding:8px; border:1px solid #ddd;"><kbd>?</kbd> 或 <kbd>H</kbd></td>
                <td style="padding:8px; border:1px solid #ddd;">显示快捷键帮助</td>
            </tr>
        </table>
    `;
    dialog.appendChild(content);
    
    // 添加关闭按钮
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.textAlign = 'right';
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.className = 'btn btn-primary';
    closeButton.onclick = () => document.body.removeChild(dialogOverlay);
    
    buttonContainer.appendChild(closeButton);
    dialog.appendChild(buttonContainer);
    
    dialogOverlay.appendChild(dialog);
    document.body.appendChild(dialogOverlay);
    
    // 按ESC键关闭对话框
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(dialogOverlay);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

// 创建晶圆映射格子
function createWaferGrid(grid, xMin, xMax, yMin, yMax, cellSize, coordMap, referenceCoordinates, maxFailureRate) {
    // 使用DocumentFragment批量处理DOM操作
    const fragment = document.createDocumentFragment();
    
    // 预先计算所需的单元格
    const xCount = xMax - xMin + 1;
    const yCount = yMax - yMin + 1;
    const totalCells = xCount * yCount;
    const batchSize = 1000; // 每批次处理的单元格数量
    let processedCells = 0;
    
    // 标记函数启动时间
    const startTime = performance.now();
    
    // 高效处理单元格创建 - 分批次处理避免长时间占用主线程
    function processBatch(startX, startY) {
        const currentBatchFragment = document.createDocumentFragment();
        let batchCount = 0;
        
        // 当前批次的循环
        for (let y = startY; y <= yMax; y++) {
            for (let x = (y === startY ? startX : xMin); x <= xMax; x++) {
                // 检查是否是参考坐标点
                const isReferencePoint = referenceCoordinates.some(coord => {
                    const refX = coord.x !== undefined ? coord.x : coord.X;
                    const refY = coord.y !== undefined ? coord.y : coord.Y;
                    return refX === x && refY === y;
                });
                
                // 修正坐标映射
                const coord = coordMap.get(`${x},${y}`);
                
                // 如果不是参考坐标且没有数据，跳过
                if (!isReferencePoint && (coord === undefined || coord.isEmpty)) {
                    processedCells++;
                    continue;
                }
                
                // 创建单元格
                const cell = document.createElement('div');
                cell.style.width = `${cellSize}px`;
                cell.style.height = `${cellSize}px`;
                cell.style.backgroundColor = '#fff';
                cell.style.border = '1px solid #ddd';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
                cell.style.fontSize = '10px';
                cell.style.cursor = 'pointer';
                cell.style.position = 'relative';
                
                // 确保网格位置精确对应坐标
                const gridX = x - xMin + 1; 
                const gridY = y - yMin + 1;
                
                cell.style.gridColumn = `${gridX}`;
                cell.style.gridRow = `${gridY}`;
                
                // 添加自定义属性，方便调试
                cell.dataset.coordX = x;
                cell.dataset.coordY = y;
                
                if (coord && !coord.isEmpty) {
                    // 根据选择的故障代码设置颜色
                    let color;
                    if (selectedFailureCode === 'all') {
                        // 显示所有故障
                        color = getRelativeColor(coord, coord.rate, maxFailureRate);
                    } else if (selectedFailureCode === 'pass') {
                        // 只显示通过的
                        const passCount = (coord.sbCounts['0'] || 0) + (coord.sbCounts['1'] || 0);
                        const passRate = passCount / coord.locationTotal;
                        color = getRelativeColor(coord, 1 - passRate, maxFailureRate);
                    } else if (selectedFailureCode === 'fail') {
                        // 显示所有失败的
                        color = getRelativeColor(coord, coord.rate, maxFailureRate);
                    } else {
                        // 显示特定故障代码
                        color = getCodeSpecificColor(coord, selectedFailureCode, maxFailureRate);
                    }
                    
                    cell.style.backgroundColor = color;
                    
                    // 添加坐标信息到单元格
                    let title = `坐标: (${x},${y})`;
                    if (selectedFailureCode === 'all') {
                        title += `\n故障率: ${(coord.rate * 100).toFixed(2)}%`;
                    } else if (selectedFailureCode === 'pass') {
                        const passCount = (coord.sbCounts['0'] || 0) + (coord.sbCounts['1'] || 0);
                        title += `\n通过率: ${((passCount / coord.locationTotal) * 100).toFixed(2)}%`;
                    } else if (selectedFailureCode === 'fail') {
                        title += `\n故障率: ${(coord.rate * 100).toFixed(2)}%`;
                    } else {
                        const codeCount = coord.failureDies[selectedFailureCode]?.length || 0;
                        title += `\n${selectedFailureCode}故障数: ${codeCount}`;
                    }
                    cell.title = title;
                    
                    // 鼠标悬停效果的事件委托 - 减少事件监听器数量
                    cell.classList.add('wafer-cell');
                } else if (isReferencePoint) {
                    // 如果是参考坐标点但无数据，使用特殊样式
                    cell.style.backgroundColor = '#f8f8f8';
                    cell.style.border = '1px dashed #999';
                    cell.title = `参考坐标: (${x},${y})\n无数据`;
                }
                
                currentBatchFragment.appendChild(cell);
                
                processedCells++;
                batchCount++;
                
                // 如果当前批次已满或已处理所有单元格，添加到总fragment并检查是否需要继续
                if (batchCount >= batchSize || processedCells >= totalCells) {
                    fragment.appendChild(currentBatchFragment);
                    
                    // 如果处理完成，添加到DOM
                    if (processedCells >= totalCells) {
                        grid.appendChild(fragment);
                        
                        // 性能测量结束
                        const endTime = performance.now();
                        const duration = endTime - startTime;
                        if (duration > 1000) {
                            console.warn(`渲染警告: 网格渲染耗时 ${duration.toFixed(2)}ms`);
                        }
                        
                        // 添加全局事件委托处理鼠标悬停效果
                        addMouseHoverDelegation(grid);
                        
                        return;
                    }
                    
                    // 如果还有下一批，使用requestAnimationFrame调度下一批处理
                    const nextX = (x + 1 > xMax) ? xMin : x + 1;
                    const nextY = (x + 1 > xMax) ? y + 1 : y;
                    
                    requestAnimationFrame(() => processBatch(nextX, nextY));
                    return;
                }
            }
        }
        
        // 最后一批次，添加到DOM
        fragment.appendChild(currentBatchFragment);
        grid.appendChild(fragment);
        
        // 性能测量结束
        const endTime = performance.now();
        const duration = endTime - startTime;
        if (duration > 1000) {
            console.warn(`渲染警告: 网格渲染耗时 ${duration.toFixed(2)}ms`);
        }
        
        // 添加全局事件委托处理鼠标悬停效果
        addMouseHoverDelegation(grid);
    }
    
    // 使用事件委托处理鼠标悬停效果，减少事件监听器数量
    function addMouseHoverDelegation(gridElement) {
        // 移除可能存在的旧监听器
        gridElement.removeEventListener('mouseover', handleMouseOver);
        gridElement.removeEventListener('mouseout', handleMouseOut);
        
        // 添加新的事件委托监听器
        gridElement.addEventListener('mouseover', handleMouseOver);
        gridElement.addEventListener('mouseout', handleMouseOut);
        
        function handleMouseOver(e) {
            if (e.target.classList.contains('wafer-cell')) {
                e.target.style.transform = 'scale(1.1) translateZ(0)';
                e.target.style.zIndex = '1';
                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
            }
        }
        
        function handleMouseOut(e) {
            if (e.target.classList.contains('wafer-cell')) {
                e.target.style.transform = 'translateZ(0)';
                e.target.style.zIndex = '0';
                e.target.style.boxShadow = 'none';
            }
        }
    }
    
    // 启动第一批次处理
    processBatch(xMin, yMin);
    
    return grid;
}

// 定义颜色生成函数 - 根据相对故障率生成颜色
function getRelativeColor(coord, rate, maxFailureRate = 0.1) {
    if (rate === 0) return 'rgba(240, 240, 240, 0.8)'; // 无故障为浅灰色
    
    // 计算相对故障率（0-1之间）
    const relativeRate = Math.min(1, rate / maxFailureRate);
    
    // 使用相对率生成颜色
    // 最小红色强度为0.6，确保即使是低故障率也能明显看出红色
    const intensity = 0.6 + (relativeRate * 0.4);
    
    // 使用HSL颜色空间，从黄色过渡到红色
    // 60度是黄色，0度是红色
    const hue = Math.max(0, 60 - relativeRate * 60);
    
    return `hsl(${hue}, 100%, ${45}%, ${intensity.toFixed(2)})`;
}

// 定义特定故障代码颜色
function getCodeSpecificColor(coord, code, maxFailureRate = 0.1) {
    if (!coord.failureDies || !coord.failureDies[code] || coord.failureDies[code].length === 0) {
        return 'rgba(240, 240, 240, 0.8)'; // 无此故障代码为浅灰色
    }
    
    // 计算此特定代码的故障率
    const codeFailures = coord.failureDies[code].length;
    const codeRate = codeFailures / coord.locationTotal;
    
    // 使用相对率生成颜色
    // 为特定代码使用更深的基础颜色
    const relativeRate = Math.min(1, codeRate / maxFailureRate);
    const intensity = 0.7 + (relativeRate * 0.3);
    
    // 使用HSL颜色空间，从黄色过渡到红色
    const hue = Math.max(0, 50 - relativeRate * 50);
    
    return `hsl(${hue}, 100%, ${45}%, ${intensity.toFixed(2)})`;
}

// 计算标签间隔的辅助函数
function calculateLabelStep(range) {
    if (range <= 30) return 1;  // 小于30个坐标点时，每个点都显示标签
    if (range <= 60) return 2;  // 30-60个坐标点时，每隔1个显示标签
    if (range <= 100) return 5; // 60-100个坐标点时，每隔4个显示标签
    if (range <= 150) return 10; // 100-150个坐标点时，每隔9个显示标签
    return 20; // 150以上，每隔19个显示标签
}