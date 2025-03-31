/**
 * 晶圆映射工具性能测试脚本
 * 此脚本用于测试应用程序的各个组件性能
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('性能测试初始化中...');
    
    // 创建测试控制面板
    createTestPanel();
    
    // 注册事件处理程序
    document.getElementById('run-perf-test').addEventListener('click', runPerformanceTests);
});

// 创建测试控制面板
function createTestPanel() {
    const panel = document.createElement('div');
    panel.className = 'performance-test-panel';
    panel.innerHTML = `
        <h3>性能测试面板</h3>
        <button id="run-perf-test" class="btn btn-warning">运行性能测试</button>
        <div id="perf-results" class="perf-results"></div>
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .performance-test-panel {
            position: fixed;
            top: 10px;
            right: 80px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid #ddd;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            max-width: 300px;
        }
        .perf-results {
            margin-top: 10px;
            max-height: 300px;
            overflow-y: auto;
            font-size: 12px;
        }
        .perf-result-item {
            margin-bottom: 5px;
            padding: 5px;
            border-bottom: 1px solid #eee;
        }
        .perf-result-good {
            color: green;
        }
        .perf-result-warning {
            color: orange;
        }
        .perf-result-bad {
            color: red;
        }
    `;
    document.head.appendChild(style);
    
    // 添加到页面
    document.body.appendChild(panel);
}

// 运行性能测试
async function runPerformanceTests() {
    console.log('开始运行性能测试...');
    
    // 重置性能监控
    Performance.clear();
    
    // 清空结果显示
    const resultsContainer = document.getElementById('perf-results');
    resultsContainer.innerHTML = '<p>测试进行中...</p>';
    
    // 测试场景
    const testScenarios = [
        { name: 'DOM操作性能', func: testDOMOperations },
        { name: '数据处理性能', func: testDataProcessing },
        { name: '渲染性能', func: testRenderingPerformance },
        { name: '缓存系统性能', func: testCacheSystem }
    ];
    
    // 创建结果表
    const resultTable = document.createElement('table');
    resultTable.style.width = '100%';
    resultTable.style.borderCollapse = 'collapse';
    resultTable.innerHTML = `
        <thead>
            <tr>
                <th style="text-align:left; padding:5px; border-bottom:1px solid #ddd;">测试名称</th>
                <th style="text-align:right; padding:5px; border-bottom:1px solid #ddd;">耗时(ms)</th>
                <th style="text-align:center; padding:5px; border-bottom:1px solid #ddd;">状态</th>
            </tr>
        </thead>
        <tbody id="perf-results-body">
        </tbody>
    `;
    
    // 执行测试
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(resultTable);
    const resultsBody = document.getElementById('perf-results-body');
    
    for (const scenario of testScenarios) {
        try {
            const startTime = performance.now();
            await scenario.func();
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // 评估性能
            let status = '';
            let statusClass = '';
            if (duration < 100) {
                status = '优秀';
                statusClass = 'perf-result-good';
            } else if (duration < 500) {
                status = '良好';
                statusClass = 'perf-result-good';
            } else if (duration < 1000) {
                status = '一般';
                statusClass = 'perf-result-warning';
            } else {
                status = '较慢';
                statusClass = 'perf-result-bad';
            }
            
            // 添加结果行
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="text-align:left; padding:5px; border-bottom:1px solid #eee;">${scenario.name}</td>
                <td style="text-align:right; padding:5px; border-bottom:1px solid #eee;">${duration.toFixed(2)}</td>
                <td style="text-align:center; padding:5px; border-bottom:1px solid #eee;" class="${statusClass}">${status}</td>
            `;
            resultsBody.appendChild(row);
        } catch (error) {
            console.error(`测试 "${scenario.name}" 失败:`, error);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="text-align:left; padding:5px; border-bottom:1px solid #eee;">${scenario.name}</td>
                <td style="text-align:right; padding:5px; border-bottom:1px solid #eee;">N/A</td>
                <td style="text-align:center; padding:5px; border-bottom:1px solid #eee;" class="perf-result-bad">失败</td>
            `;
            resultsBody.appendChild(row);
        }
    }
    
    // 添加性能报告摘要
    const report = Performance.getReport();
    const summaryRow = document.createElement('tr');
    summaryRow.style.fontWeight = 'bold';
    summaryRow.style.backgroundColor = '#f5f5f5';
    summaryRow.innerHTML = `
        <td style="text-align:left; padding:5px; border-bottom:1px solid #ddd;">总计</td>
        <td style="text-align:right; padding:5px; border-bottom:1px solid #ddd;">${report.summary.totalTime.toFixed(2)}</td>
        <td style="text-align:center; padding:5px; border-bottom:1px solid #ddd;">${report.summary.operationCount}项操作</td>
    `;
    resultsBody.appendChild(summaryRow);
    
    console.log('性能测试完成');
}

// DOM操作性能测试
async function testDOMOperations() {
    Performance.start('DOM操作');
    
    // 测试创建元素
    Performance.start('创建元素');
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);
    
    for (let i = 0; i < 1000; i++) {
        const el = Utils.createElement('div', {
            className: 'test-item',
            style: {
                width: '10px',
                height: '10px',
                margin: '1px',
                display: 'inline-block'
            },
            dataset: {
                id: `item-${i}`,
                value: Math.random()
            }
        }, `${i}`);
        
        container.appendChild(el);
    }
    Performance.end('创建元素');
    
    // 测试DOM查询
    Performance.start('DOM查询');
    for (let i = 0; i < 100; i++) {
        const elements = Utils.$$('.test-item');
        const randomIndex = Math.floor(Math.random() * elements.length);
        elements[randomIndex].classList.add('test-selected');
    }
    Performance.end('DOM查询');
    
    // 测试样式修改
    Performance.start('样式修改');
    const elements = Utils.$$('.test-item');
    for (let i = 0; i < elements.length; i++) {
        if (i % 3 === 0) {
            elements[i].style.backgroundColor = 'red';
        } else if (i % 3 === 1) {
            elements[i].style.backgroundColor = 'green';
        } else {
            elements[i].style.backgroundColor = 'blue';
        }
    }
    Performance.end('样式修改');
    
    // 清理
    document.body.removeChild(container);
    
    Performance.end('DOM操作');
}

// 数据处理性能测试
async function testDataProcessing() {
    Performance.start('数据处理');
    
    // 生成测试数据
    Performance.start('数据生成');
    const testData = [];
    for (let i = 0; i < 10000; i++) {
        testData.push({
            id: i,
            asic: `ASIC-${Math.floor(i / 100)}`,
            wafer: `WAFER-${Math.floor(i / 1000)}`,
            X: Math.floor(Math.random() * 100),
            Y: Math.floor(Math.random() * 100),
            SB: Math.random() > 0.9 ? Math.floor(Math.random() * 10) : 0
        });
    }
    Performance.end('数据生成');
    
    // 数据过滤
    Performance.start('数据过滤');
    const filteredData = testData.filter(row => row.asic === 'ASIC-5' && row.wafer === 'WAFER-0');
    Performance.end('数据过滤');
    
    // 数据分组
    Performance.start('数据分组');
    const groupedData = {};
    testData.forEach(row => {
        const key = `${row.asic}_${row.wafer}`;
        if (!groupedData[key]) {
            groupedData[key] = [];
        }
        groupedData[key].push(row);
    });
    Performance.end('数据分组');
    
    // 数据统计
    Performance.start('数据统计');
    const stats = {};
    Object.keys(groupedData).forEach(key => {
        const group = groupedData[key];
        stats[key] = {
            total: group.length,
            failureCount: group.filter(row => row.SB !== 0).length,
            failureRate: group.filter(row => row.SB !== 0).length / group.length
        };
    });
    Performance.end('数据统计');
    
    Performance.end('数据处理');
}

// 渲染性能测试
async function testRenderingPerformance() {
    Performance.start('渲染性能');
    
    // 准备测试容器
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '800px';
    container.style.height = '800px';
    container.style.overflow = 'hidden';
    document.body.appendChild(container);
    
    // 测试渲染大量卡片
    Performance.start('渲染卡片');
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(20, 1fr)';
    grid.style.gap = '1px';
    container.appendChild(grid);
    
    // 渲染200个卡片
    for (let i = 0; i < 200; i++) {
        const card = document.createElement('div');
        card.className = 'test-card';
        card.style.width = '100%';
        card.style.height = '30px';
        card.style.backgroundColor = i % 2 === 0 ? '#f0f0f0' : '#e0e0e0';
        card.style.display = 'flex';
        card.style.alignItems = 'center';
        card.style.justifyContent = 'center';
        card.textContent = i;
        grid.appendChild(card);
    }
    Performance.end('渲染卡片');
    
    // 测试动画性能
    Performance.start('动画性能');
    const cards = container.querySelectorAll('.test-card');
    const animations = [];
    
    // 应用并测量动画
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const animation = card.animate([
            { transform: 'scale(1)', backgroundColor: '#e0e0e0' },
            { transform: 'scale(1.1)', backgroundColor: '#ff9900' },
            { transform: 'scale(1)', backgroundColor: '#e0e0e0' }
        ], {
            duration: 1000,
            iterations: 1
        });
        animations.push(animation);
    }
    
    // 等待最后一个动画完成
    await new Promise(resolve => {
        animations[animations.length - 1].onfinish = resolve;
    });
    Performance.end('动画性能');
    
    // 清理
    document.body.removeChild(container);
    
    Performance.end('渲染性能');
}

// 缓存系统性能测试
async function testCacheSystem() {
    Performance.start('缓存系统');
    
    // 测试缓存写入
    Performance.start('缓存写入');
    for (let i = 0; i < 100; i++) {
        const key = `test-key-${i}`;
        const value = {
            id: i,
            data: Array(1000).fill(0).map(() => Math.random()),
            metadata: {
                timestamp: Date.now(),
                type: i % 3 === 0 ? 'A' : (i % 3 === 1 ? 'B' : 'C')
            }
        };
        dataCache.set('statistics', key, value);
    }
    Performance.end('缓存写入');
    
    // 测试缓存读取
    Performance.start('缓存读取-顺序');
    for (let i = 0; i < 100; i++) {
        const key = `test-key-${i}`;
        const value = dataCache.get('statistics', key);
    }
    Performance.end('缓存读取-顺序');
    
    // 测试随机读取
    Performance.start('缓存读取-随机');
    for (let i = 0; i < 100; i++) {
        const index = Math.floor(Math.random() * 100);
        const key = `test-key-${index}`;
        const value = dataCache.get('statistics', key);
    }
    Performance.end('缓存读取-随机');
    
    // 测试缓存清理
    Performance.start('缓存清理');
    dataCache.clear('statistics');
    Performance.end('缓存清理');
    
    Performance.end('缓存系统');
} 