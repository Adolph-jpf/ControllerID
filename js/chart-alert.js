// 智能检测Chart.js库是否可用，尝试自动加载库文件
document.addEventListener("DOMContentLoaded", function() {
    // 检测本地库文件是否已加载成功
    function checkChartLibraries() {
        // 检查Chart对象是否存在且是否为函数类型
        const chartLoaded = (typeof Chart === 'function');
        
        // 检查Chart.controllers是否存在Matrix控制器
        const matrixPluginLoaded = chartLoaded && 
                                  Chart.controllers && 
                                  (typeof Chart.controllers.matrix === 'function' || 
                                   Object.keys(Chart.controllers).some(k => k.toLowerCase().includes('matrix')));
        
        return {
            chartLoaded: chartLoaded,
            matrixPluginLoaded: matrixPluginLoaded,
            allLoaded: chartLoaded && matrixPluginLoaded
        };
    }
    
    // 延迟一小段时间检查库是否已加载
    setTimeout(function() {
        // 检查库加载状态
        const libraries = checkChartLibraries();
        
        // 如果所有库已加载成功，直接返回
        if (libraries.allLoaded) {
            console.log("所有图表库已正确加载");
            return;
        }
        
        console.warn("图表库未完全加载，正在尝试自动加载...");
        
        // 创建一个函数用于动态加载JavaScript文件
        function loadScript(url, callback) {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            script.onload = callback;
            script.onerror = function() {
                console.error("加载脚本失败: " + url);
                loadError = true;
            };
            document.head.appendChild(script);
        }
        
        // 标记加载错误
        let loadError = false;
        
        // 如果Chart.js未加载，尝试从CDN加载
        if (!libraries.chartLoaded) {
            console.log("尝试从CDN加载Chart.js");
            loadScript("https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js", function() {
                console.log("已从CDN加载Chart.js");
                
                // 检查Matrix插件是否需要加载
                if (!checkChartLibraries().matrixPluginLoaded) {
                    loadScript("https://cdn.jsdelivr.net/npm/chartjs-chart-matrix@2.0.1/dist/chartjs-chart-matrix.min.js", function() {
                        console.log("已从CDN加载ChartJs-Matrix插件");
                        showSuccessMessage();
                    });
                } else {
                    showSuccessMessage();
                }
            });
        } 
        // 如果只有Matrix插件未加载
        else if (!libraries.matrixPluginLoaded) {
            console.log("Chart.js已加载，尝试从CDN加载Matrix插件");
            loadScript("https://cdn.jsdelivr.net/npm/chartjs-chart-matrix@2.0.1/dist/chartjs-chart-matrix.min.js", function() {
                console.log("已从CDN加载ChartJs-Matrix插件");
                showSuccessMessage();
            });
        }
        
        // 显示成功消息
        function showSuccessMessage() {
            // 检查是否全部加载成功
            if (checkChartLibraries().allLoaded) {
                console.log("所有图表库已成功加载");
                
                // 添加提示
                const alertDiv = document.createElement('div');
                alertDiv.style.position = 'fixed';
                alertDiv.style.top = '10px';
                alertDiv.style.left = '50%';
                alertDiv.style.transform = 'translateX(-50%)';
                alertDiv.style.backgroundColor = '#4CAF50';
                alertDiv.style.color = 'white';
                alertDiv.style.padding = '10px 20px';
                alertDiv.style.borderRadius = '5px';
                alertDiv.style.zIndex = '9999';
                alertDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                alertDiv.innerHTML = '图表库已从CDN自动加载。首次加载后将缓存在浏览器中。';
                
                // 3秒后自动消失
                document.body.appendChild(alertDiv);
                setTimeout(function() {
                    alertDiv.style.opacity = '0';
                    alertDiv.style.transition = 'opacity 0.5s';
                    setTimeout(function() {
                        if (alertDiv.parentNode) {
                            document.body.removeChild(alertDiv);
                        }
                    }, 500);
                }, 3000);
            }
        }
        
        // 设置超时，如果库加载失败，显示提示
        setTimeout(function() {
            if (!checkChartLibraries().allLoaded || loadError) {
                console.error("自动加载图表库失败");
                // 显示更友好的错误信息
                alert("无法自动加载图表库。\n\n如需使用晶圆映射功能，请下载并保存以下文件到js/lib目录:\n1. Chart.js: https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js\n2. ChartJs-Matrix: https://cdn.jsdelivr.net/npm/chartjs-chart-matrix@2.0.1/dist/chartjs-chart-matrix.min.js");
            }
        }, 5000); // 给予5秒时间加载
    }, 1000); // 延迟1秒，确保其他脚本有时间加载
});
