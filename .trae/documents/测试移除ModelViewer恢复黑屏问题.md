## 测试计划

### 问题分析
用户反馈战场页面出现黑屏崩溃，怀疑是ModelViewer导致的问题。需要测试移除ModelViewer后页面是否能恢复正常显示。

### 测试步骤

1. **修改战场页面**：
   - 添加60秒定时器，在页面加载1分钟后移除ModelViewer
   - 添加强制恢复Three.js场景的功能
   - 添加详细的状态监控和日志记录

2. **监控机制**：
   - 记录定时器执行前的页面状态
   - 记录移除ModelViewer的过程
   - 监控Three.js场景的恢复情况
   - 记录WebGL上下文状态

3. **验证步骤**：
   - 打开战场页面，等待60秒
   - 观察页面是否从黑屏恢复为正常的Three.js场景
   - 检查控制台是否有相关日志
   - 验证Three.js场景的交互功能是否正常

### 实现代码

1. **添加定时器**：
   ```javascript
   // 60秒后移除ModelViewer测试
   setTimeout(() => {
       try {
           logError('开始移除ModelViewer测试...', 'info');
           
           // 移除ModelViewer实例
           if (modelViewer) {
               // 停止ModelViewer的渲染
               modelViewer = null;
               logError('ModelViewer实例已移除', 'info');
           }
           
           // 强制清理相关资源
           if (modelCanvas) {
               modelCanvas.remove();
               modelCanvas = null;
               logError('ModelViewer Canvas已移除', 'info');
           }
           
           // 强制恢复Three.js场景
           if (scene && camera && renderer) {
               scene.background = new THREE.Color(0x87ceeb);
               renderer.setClearColor(0x87ceeb, 1);
               logError('Three.js场景已强制恢复', 'info');
           }
           
           logError('ModelViewer移除测试完成，等待页面响应...', 'info');
       } catch (e) {
           logError('移除ModelViewer时出错', 'error', e.stack);
       }
   }, 60000); // 60秒后执行
   ```

2. **添加状态监控**：
   - 记录WebGL上下文状态
   - 监控内存使用变化
   - 检查渲染循环状态

### 预期结果

- **成功场景**：页面从黑屏恢复为显示Three.js场景，说明ModelViewer是导致崩溃的原因
- **失败场景**：页面仍然黑屏，说明问题可能在其他地方

### 后续处理

根据测试结果，确定是否需要完全移除ModelViewer或进一步优化其集成方式。