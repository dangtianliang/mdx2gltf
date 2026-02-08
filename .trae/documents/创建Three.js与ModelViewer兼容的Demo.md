# 创建Three.js与ModelViewer兼容的Demo

## 目标
按照兼容.md中的攻略，创建一个新的demo来解决Three.js加载WebGL模型时的黑屏问题。

## 实现步骤

### 1. 创建Demo目录结构
- 在项目根目录创建 `demo/three-modelviewer` 文件夹
- 该目录将包含完整的演示代码

### 2. 创建HTML文件 (`index.html`)
- 实现分屏布局，左侧为Three.js场景，右侧为ModelViewer
- 引入必要的库文件（Three.js和ModelViewer）
- 添加基础样式和容器结构

### 3. 创建JavaScript文件 (`app.js`)
- 实现 `WEBGL_CONFIG` 配置，为Three.js和ModelViewer分配独立的WebGL上下文
- 创建 `ThreeSceneManager` 类，管理Three.js场景的初始化、渲染和销毁
- 创建 `ModelViewerManager` 类，管理ModelViewer的初始化、渲染和销毁
- 实现页面初始化逻辑，控制加载顺序和资源管理

### 4. 实现核心功能
- 独立的WebGL上下文配置，避免上下文冲突
- 统一的渲染循环管理，避免多个requestAnimationFrame冲突
- 完整的资源生命周期管理，包括dispose方法和上下文释放
- 延迟初始化ModelViewer，避免初始化时的资源竞争

### 5. 测试和调试
- 启动开发服务器，访问demo页面
- 验证Three.js场景和ModelViewer是否同时正常运行
- 检查是否存在黑屏问题
- 使用Chrome DevTools的WebGL Inspector查看上下文状态

## 技术要点

- **独立WebGL上下文**：为Three.js和ModelViewer配置不同的WebGL参数
- **统一渲染循环**：使用封装的管理器类分别控制渲染状态
- **资源生命周期**：实现完整的dispose方法，避免内存泄漏
- **错误处理**：添加WebGL上下文丢失监听，捕获潜在错误

## 预期结果
创建一个稳定运行的demo，其中Three.js和ModelViewer能够和谐共存，不存在黑屏问题，验证兼容.md中的解决方案的有效性。