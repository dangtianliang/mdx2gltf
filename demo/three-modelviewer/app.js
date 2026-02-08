// 全局配置 - 关键：为不同组件分配独立的 WebGL 上下文
const WEBGL_CONFIG = {
  // Three.js 专用配置
  three: {
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance"
  },
  // ModelViewer 专用配置
  modelViewer: {
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: false
  }
};

// Three.js 场景管理器
class ThreeSceneManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animationId = null;
    this.isRendering = false;
  }

  // 初始化 Three.js 场景
  init() {
    try {
      console.log('Initializing Three.js scene...');
      
      // 1. 创建独立的渲染器，关键是传递专属的 WebGL 配置
      this.renderer = new THREE.WebGLRenderer({
        ...WEBGL_CONFIG.three,
        // 关键：明确指定不共享上下文
        context: null
      });
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.container.appendChild(this.renderer.domElement);

      // 2. 添加 WebGL 上下文错误监听
      this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
        console.error('WebGL context lost:', e);
        e.preventDefault();
      });

      this.renderer.domElement.addEventListener('webglcontextrestored', () => {
        console.log('WebGL context restored');
      });

      // 3. 创建场景和相机
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x87ceeb); // 天空蓝，便于区分

      this.camera = new THREE.PerspectiveCamera(
        75,
        this.container.clientWidth / this.container.clientHeight,
        0.1,
        1000
      );
      this.camera.position.z = 5;

      // 4. 添加测试内容 - 一个旋转的立方体
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      this.cube = new THREE.Mesh(geometry, material);
      this.scene.add(this.cube);

      // 5. 启动统一的渲染循环
      this.startRenderLoop();

      // 6. 监听窗口大小变化
      window.addEventListener('resize', () => this.onWindowResize());

      console.log('Three.js scene initialized successfully');
      return this;
    } catch (error) {
      console.error('Error initializing Three.js:', error);
      return null;
    }
  }

  // 统一的渲染循环 - 关键：避免多个 requestAnimationFrame 冲突
  startRenderLoop() {
    if (this.isRendering) return;
    
    this.isRendering = true;
    const render = () => {
      try {
        // 更新立方体旋转
        if (this.cube) {
          this.cube.rotation.x += 0.01;
          this.cube.rotation.y += 0.01;
        }
        
        this.renderer.render(this.scene, this.camera);
        this.animationId = requestAnimationFrame(render);
      } catch (error) {
        console.error('Error in Three.js render loop:', error);
        this.stopRenderLoop();
      }
    };
    render();
  }

  // 停止 Three.js 渲染循环
  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isRendering = false;
  }

  // 窗口大小适配
  onWindowResize() {
    if (this.camera && this.renderer) {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  }

  // 销毁 Three.js 资源，释放 WebGL 上下文
  dispose() {
    console.log('Disposing Three.js resources...');
    
    this.stopRenderLoop();
    
    // 清理场景
    if (this.scene) {
      while (this.scene.children.length) {
        const child = this.scene.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
        this.scene.remove(child);
      }
    }

    // 释放渲染器资源
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      if (this.renderer.domElement && this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    
    // 清空引用
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.cube = null;
    
    console.log('Three.js resources disposed');
  }
}

// ModelViewer 管理器
class ModelViewerManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.modelViewer = null;
  }

  // 初始化 ModelViewer
  init(modelUrl) {
    try {
      console.log('Initializing ModelViewer...');
      
      // 1. 创建 model-viewer 元素
      this.modelViewer = document.createElement('model-viewer');
      this.modelViewer.setAttribute('src', modelUrl);
      this.modelViewer.setAttribute('alt', '3D Model');
      this.modelViewer.setAttribute('auto-rotate', 'true');
      this.modelViewer.setAttribute('camera-controls', 'true');
      this.modelViewer.style.width = '100%';
      this.modelViewer.style.height = '100%';
      
      // 2. 关键配置：为 ModelViewer 指定独立的 WebGL 上下文
      this.modelViewer.webglPreferences = {
        ...WEBGL_CONFIG.modelViewer
      };

      // 3. 监听加载事件，避免加载过程中干扰 Three.js
      this.modelViewer.addEventListener('load', () => {
        console.log('Model loaded successfully');
        // 确保 ModelViewer 使用自己的渲染循环
        this.modelViewer.pauseRendering = false;
      });

      // 4. 监听错误
      this.modelViewer.addEventListener('error', (e) => {
        console.error('ModelViewer error:', e);
      });

      this.container.appendChild(this.modelViewer);
      console.log('ModelViewer initialized successfully');
      return this;
    } catch (error) {
      console.error('Error initializing ModelViewer:', error);
      return null;
    }
  }

  // 暂停 ModelViewer 渲染
  pause() {
    if (this.modelViewer) {
      this.modelViewer.pauseRendering = true;
      console.log('ModelViewer rendering paused');
    }
  }

  // 恢复 ModelViewer 渲染
  resume() {
    if (this.modelViewer) {
      this.modelViewer.pauseRendering = false;
      console.log('ModelViewer rendering resumed');
    }
  }

  // 销毁 ModelViewer
  dispose() {
    console.log('Disposing ModelViewer...');
    if (this.modelViewer) {
      this.pause();
      if (this.container) {
        this.container.removeChild(this.modelViewer);
      }
      this.modelViewer = null;
      console.log('ModelViewer disposed');
    }
  }
}

// 页面初始化 - 确保资源加载顺序和上下文隔离
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Page DOM content loaded, initializing application...');
    
    // 1. 先初始化 Three.js 场景
    const threeManager = new ThreeSceneManager('three-container');
    const threeInitialized = threeManager.init();
    
    if (!threeInitialized) {
      console.error('Failed to initialize Three.js');
      return;
    }

    // 2. 延迟初始化 ModelViewer，避免上下文竞争
    setTimeout(async () => {
      console.log('Initializing ModelViewer after delay...');
      const modelViewerManager = new ModelViewerManager('modelviewer-container');
      // 使用一个更可靠的示例模型URL，避免USDZ格式可能的解析问题
      const modelUrl = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF/Avocado.gltf';
      const modelViewerInitialized = modelViewerManager.init(modelUrl);
      
      if (!modelViewerInitialized) {
        console.error('Failed to initialize ModelViewer');
        return;
      }

      // 3. 全局清理（页面卸载时）
      window.addEventListener('beforeunload', () => {
        console.log('Page unload, cleaning up resources...');
        threeManager.dispose();
        modelViewerManager.dispose();
      });
      
    }, 1000);

  } catch (error) {
    console.error('Initialization error:', error);
  }
});

// 添加全局错误监听
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

console.log('Application script loaded');
