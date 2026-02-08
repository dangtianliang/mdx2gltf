const http = require('http');
const url = require('url');
const { storeLog, clearAllLogs, cleanOldLogs, getLogFiles } = require('./log-handler');

// 服务器配置
const PORT = 8081;

/**
 * 解析请求体
 * @param {http.IncomingMessage} req 请求对象
 * @returns {Promise<Object>} 请求体数据
 */
async function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * 发送响应
 * @param {http.ServerResponse} res 响应对象
 * @param {number} statusCode 状态码
 * @param {Object} data 响应数据
 */
function sendResponse(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // 允许跨域请求
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

/**
 * 处理OPTIONS请求（CORS预检）
 * @param {http.ServerResponse} res 响应对象
 */
function handleOptions(res) {
    res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
}

/**
 * 创建日志服务器
 */
function createLogServer() {
    const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;

        // 处理OPTIONS请求
        if (req.method === 'OPTIONS') {
            handleOptions(res);
            return;
        }

        try {
            // 存储日志
            if (pathname === '/api/log' && req.method === 'POST') {
                const logData = await parseRequestBody(req);
                const result = storeLog(logData);
                sendResponse(res, result.success ? 200 : 400, result);
            }
            // 清空日志
            else if (pathname === '/api/log' && req.method === 'DELETE') {
                const result = clearAllLogs();
                sendResponse(res, result.success ? 200 : 400, result);
            }
            // 获取日志文件列表
            else if (pathname === '/api/log/files' && req.method === 'GET') {
                const result = getLogFiles();
                sendResponse(res, result.success ? 200 : 400, result);
            }
            // 清理旧日志
            else if (pathname === '/api/log/clean' && req.method === 'POST') {
                cleanOldLogs();
                sendResponse(res, 200, { success: true, message: '日志清理成功' });
            }
            // 健康检查
            else if (pathname === '/api/log/health' && req.method === 'GET') {
                sendResponse(res, 200, { success: true, message: '日志服务器运行正常' });
            }
            // 404
            else {
                sendResponse(res, 404, { success: false, message: '接口不存在' });
            }
        } catch (error) {
            console.error('处理请求时出错:', error);
            sendResponse(res, 500, { success: false, message: '服务器内部错误', error: error.message });
        }
    });

    return server;
}

/**
 * 启动日志服务器
 */
function startLogServer() {
    const server = createLogServer();

    server.listen(PORT, () => {
        console.log(`日志服务器已启动，运行在 http://localhost:${PORT}`);
        console.log('可用接口:');
        console.log('  POST   /api/log           - 存储错误日志');
        console.log('  DELETE /api/log           - 清空所有日志');
        console.log('  GET    /api/log/files     - 获取日志文件列表');
        console.log('  POST   /api/log/clean      - 清理旧日志');
        console.log('  GET    /api/log/health    - 健康检查');
        console.log('');
    });

    server.on('error', (error) => {
        console.error('启动日志服务器时出错:', error);
    });

    return server;
}

// 导出启动函数
module.exports = { startLogServer };
