const fs = require('fs');
const path = require('path');

// 日志目录路径
const LOG_DIR = path.join(__dirname, '..', 'logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * 生成日志文件名
 * @returns {string} 日志文件名
 */
function generateLogFileName() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
    return `error_log_${timestamp}.json`;
}

/**
 * 清理旧日志文件
 * @param {number} keepDays 保留天数
 */
function cleanOldLogs(keepDays = 7) {
    try {
        const files = fs.readdirSync(LOG_DIR);
        const now = Date.now();
        const keepTime = keepDays * 24 * 60 * 60 * 1000;
        
        files.forEach(file => {
            if (file.startsWith('error_log_')) {
                const filePath = path.join(LOG_DIR, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtime.getTime() > keepTime) {
                    fs.unlinkSync(filePath);
                    console.log(`清理旧日志文件: ${file}`);
                }
            }
        });
    } catch (error) {
        console.error('清理旧日志时出错:', error);
    }
}

/**
 * 存储错误日志
 * @param {Object} logData 日志数据
 */
function storeLog(logData) {
    try {
        // 确保日志数据格式正确
        const logEntry = {
            timestamp: new Date().toISOString(),
            ...logData,
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
        
        // 获取当前日志文件
        const logFiles = fs.readdirSync(LOG_DIR)
            .filter(file => file.startsWith('error_log_'))
            .sort((a, b) => {
                return fs.statSync(path.join(LOG_DIR, b)).mtime.getTime() - 
                       fs.statSync(path.join(LOG_DIR, a)).mtime.getTime();
            });
        
        let logFile;
        if (logFiles.length > 0) {
            // 使用最近的日志文件
            logFile = path.join(LOG_DIR, logFiles[0]);
        } else {
            // 创建新的日志文件
            logFile = path.join(LOG_DIR, generateLogFileName());
            // 初始化日志文件
            fs.writeFileSync(logFile, JSON.stringify([], null, 2));
        }
        
        // 读取现有日志
        const existingLogs = JSON.parse(fs.readFileSync(logFile, 'utf8') || '[]');
        
        // 添加新日志
        existingLogs.push(logEntry);
        
        // 限制日志文件大小（最多1000条日志）
        if (existingLogs.length > 1000) {
            existingLogs.splice(0, existingLogs.length - 1000);
        }
        
        // 写回日志文件
        fs.writeFileSync(logFile, JSON.stringify(existingLogs, null, 2));
        
        console.log(`日志已存储到: ${path.basename(logFile)}`);
        return { success: true, message: '日志存储成功', logFile: path.basename(logFile) };
        
    } catch (error) {
        console.error('存储日志时出错:', error);
        return { success: false, message: '日志存储失败', error: error.message };
    }
}

/**
 * 清空所有日志
 */
function clearAllLogs() {
    try {
        const files = fs.readdirSync(LOG_DIR);
        files.forEach(file => {
            if (file.startsWith('error_log_')) {
                fs.unlinkSync(path.join(LOG_DIR, file));
            }
        });
        console.log('所有日志已清空');
        return { success: true, message: '日志清空成功' };
    } catch (error) {
        console.error('清空日志时出错:', error);
        return { success: false, message: '日志清空失败', error: error.message };
    }
}

/**
 * 获取日志文件列表
 * @returns {Array} 日志文件列表
 */
function getLogFiles() {
    try {
        const files = fs.readdirSync(LOG_DIR)
            .filter(file => file.startsWith('error_log_'))
            .map(file => {
                const stats = fs.statSync(path.join(LOG_DIR, file));
                return {
                    name: file,
                    size: stats.size,
                    mtime: stats.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
        
        return { success: true, files };
    } catch (error) {
        console.error('获取日志文件列表时出错:', error);
        return { success: false, message: '获取日志文件列表失败', error: error.message };
    }
}

// 导出函数
module.exports = {
    storeLog,
    clearAllLogs,
    cleanOldLogs,
    getLogFiles
};
