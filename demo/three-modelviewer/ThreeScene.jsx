import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { NDCTransformer } from '../utils/NDCTransformer.js';
import DebugPanel from './DebugPanel.jsx';

const ThreeScene = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const keysRef = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    q: false, // Q键左转
    e: false, // E键右转
    shift: false
  });
  const mouseRef = useRef({
    lastTouchX: null,
    lastTouchY: null
  });
  const ndcTransformerRef = useRef(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [rayInfo, setRayInfo] = useState(null);
  const [rayPoints, setRayPoints] = useState(null);
  const [showDebug, setShowDebug] = useState(true);
  const [ndcTransformerForDebug, setNdcTransformerForDebug] = useState(null);
  const [, setCameraPosition] = useState({ x: 0, y: 0, z: 0 });

  // F1键切换调试面板显示
  useEffect(() => {
    const handleKeyDownDebug = (event) => {
      if (event.code === 'F1') {
        event.preventDefault();
        setShowDebug(prev => !prev);
      }
    };
    
    document.addEventListener('keydown', handleKeyDownDebug);
    return () => document.removeEventListener('keydown', handleKeyDownDebug);
  }, []);

  useEffect(() => {
    // 初始化场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 天空蓝色
    sceneRef.current = scene;

    // 初始化渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    // 添加地面网格
    const gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x444444);
    scene.add(gridHelper);

    // 初始化射线检测相关变量
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const selectableObjects = [];
    let selectedObject = null;
    
    // 添加测试用的全局鼠标位置追踪
    const GLOBAL_MOUSE_INFO = {
      screenX: 0,
      screenY: 0,
      ndcX: 0,
      ndcY: 0,
      nearClipPos: null,
      validationPos: null
    };
    
    // 创建鼠标位置标识（十字准星）- 基于Three.js计算
    const mouseMarkerGroup = new THREE.Group();
    
    // 十字准星横线 - 增大尺寸和线宽
    const horizontalLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-2, 0, 0),
        new THREE.Vector3(2, 0, 0)
      ]),
      new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 5 })
    );
    
    // 十字准星竖线 - 增大尺寸和线宽
    const verticalLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -2, 0),
        new THREE.Vector3(0, 2, 0)
      ]),
      new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 5 })
    );
    
    // 中心点 - 增大尺寸
    const centerDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    
    mouseMarkerGroup.add(horizontalLine);
    mouseMarkerGroup.add(verticalLine);
    mouseMarkerGroup.add(centerDot);
    mouseMarkerGroup.visible = false; // 初始隐藏
    scene.add(mouseMarkerGroup);

    // 创建近裁剪面可视化
    const nearClipPlaneGroup = new THREE.Group();
    const nearDistance = 5.0; // 增加到5.0，更容易观察和调试
    
    // 近裁剪面边框 - 显著增大尺寸
    const planeGeometry = new THREE.PlaneGeometry(20, 15); // 显著增大尺寸便于观察
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3, // 增加不透明度
      side: THREE.DoubleSide
    });
    const nearClipPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    nearClipPlane.position.z = -nearDistance;
    nearClipPlaneGroup.add(nearClipPlane);
    
    // 近裁剪面边框线
    const planeEdges = new THREE.EdgesGeometry(planeGeometry);
    const planeLines = new THREE.LineSegments(
      planeEdges,
      new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 }) // 增加线宽
    );
    planeLines.position.z = -nearDistance;
    nearClipPlaneGroup.add(planeLines);
    
    nearClipPlaneGroup.visible = false;
    scene.add(nearClipPlaneGroup);

    // 创建可见的鼠标射线 - 使用最显眼的方式，延伸到很远的距离
    const eyePosition = new THREE.Vector3(0, 2, 5);  // 观察者眼睛位置
    const farMousePosition = new THREE.Vector3(0, 2, -1000); // 延伸到1000单位远
    
    const mouseRayLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        eyePosition,
        farMousePosition
      ]),
      new THREE.LineBasicMaterial({
        color: 0xff0000, // 鲜红色，最容易看到
        linewidth: 10    // 最粗的线条
      })
    );
    mouseRayLine.renderOrder = 9999; // 最高渲染优先级
    mouseRayLine.visible = true; // 始终可见，便于调试
    scene.add(mouseRayLine);
    
    // 射线创建完成（静默）

    // 创建验证标记 - 基于屏幕坐标直接转换（无Three.js计算）
    const validationMarker = new THREE.Group();
    
    // 验证标记使用不同颜色（蓝色）- 增大尺寸
    const valHorizontalLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-1.5, 0, 0),
        new THREE.Vector3(1.5, 0, 0)
      ]),
      new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 4 })
    );
    
    const valVerticalLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -1.5, 0),
        new THREE.Vector3(0, 1.5, 0)
      ]),
      new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 4 })
    );
    
    const valCenterDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ffff })
    );
    
    validationMarker.add(valHorizontalLine);
    validationMarker.add(valVerticalLine);
    validationMarker.add(valCenterDot);
    validationMarker.visible = false;
    scene.add(validationMarker);

    // 添加地面
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: 0x90EE90,
      transparent: true,
      opacity: 0.3
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.selectable = true;
    scene.add(ground);
    selectableObjects.push(ground);

    // 添加一些立方体作为参考物
    for (let i = 0; i < 15; i++) {
      const geometry = new THREE.BoxGeometry(
        0.5 + Math.random() * 1.5,
        0.5 + Math.random() * 1.5,
        0.5 + Math.random() * 1.5
      );
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5)
      });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(
        (Math.random() - 0.5) * 40,
        0.25,
        (Math.random() - 0.5) * 40
      );
      cube.castShadow = true;
      cube.userData.selectable = true;
      scene.add(cube);
      selectableObjects.push(cube);
    }

    // 添加一些柱子作为更高的参考物
    for (let i = 0; i < 8; i++) {
      const geometry = new THREE.CylinderGeometry(0.3, 0.3, 3 + Math.random() * 4);
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.5, 0.6)
      });
      const cylinder = new THREE.Mesh(geometry, material);
      cylinder.position.set(
        (Math.random() - 0.5) * 30,
        (3 + Math.random() * 4) / 2,
        (Math.random() - 0.5) * 30
      );
      cylinder.castShadow = true;
      cylinder.userData.selectable = true;
      scene.add(cylinder);
      selectableObjects.push(cylinder);
    }

    // 添加光照
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 键盘事件处理 - 移动和视角控制
    const handleKeyDownMove = (event) => {
      switch (event.code) {
        case 'KeyW':
          keysRef.current.w = true;
          break;
        case 'KeyA':
          keysRef.current.a = true;
          break;
        case 'KeyS':
          keysRef.current.s = true;
          break;
        case 'KeyD':
          keysRef.current.d = true;
          break;
        case 'KeyQ':
          keysRef.current.q = true;
          break;
        case 'KeyE':
          keysRef.current.e = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keysRef.current.shift = true;
          break;
      }
    };

    const handleKeyUpMove = (event) => {
      switch (event.code) {
        case 'KeyW':
          keysRef.current.w = false;
          break;
        case 'KeyA':
          keysRef.current.a = false;
          break;
        case 'KeyS':
          keysRef.current.s = false;
          break;
        case 'KeyD':
          keysRef.current.d = false;
          break;
        case 'KeyQ':
          keysRef.current.q = false;
          break;
        case 'KeyE':
          keysRef.current.e = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keysRef.current.shift = false;
          break;
      }
    };

    // 鼠标移动事件处理 - 射线检测（使用NDCTransformer）
    const onMouseMove = (event) => {
      // 获取canvas的实际位置和尺寸
      const canvas = renderer.domElement;
      const canvasRect = canvas.getBoundingClientRect();
      
      // 计算相对于canvas的鼠标位置
      const mouseXRelative = event.clientX - canvasRect.left;
      const mouseYRelative = event.clientY - canvasRect.top;
      
      // 更新状态用于调试面板
      setMousePosition({ x: mouseXRelative, y: mouseYRelative });
      
      // 使用NDCTransformer进行坐标转换
      const screenPos = { x: mouseXRelative, y: mouseYRelative };
      const ndcPos = ndcTransformerRef.current.screenToNDC(screenPos);
      
      // 静默处理 - 移除控制台输出

      // 使用正确的坐标进行射线检测
      mouse.x = ndcPos.x;
      mouse.y = ndcPos.y;

      // 更新射线投射器：从相机位置向鼠标方向发射射线
      raycaster.setFromCamera(mouse, cameraRef.current);

      // 获取射线信息
      const rayInfo = ndcTransformerRef.current.getRayInfo(mouseXRelative, mouseYRelative);
      setRayInfo(rayInfo);
      
      // 获取多个距离上的射线点
      const rayPoints = ndcTransformerRef.current.getRayPoints(mouseXRelative, mouseYRelative, [5, 20, 50]);
      setRayPoints(rayPoints);
      
      // 显示近裁剪面
      nearClipPlaneGroup.visible = true;

      // 使用NDCTransformer计算验证位置（调试用，暂时保留但不使用）
      // const nearClipWorldPos = ndcTransformerRef.current.screenToWorld(screenPos, -1); // z=-1表示近裁剪面
      
      // 获取坐标转换信息（调试用，暂时保留但不使用）
      // const worldToScreen = ndcTransformerRef.current.worldToScreen(rayInfo.origin);
      // const conversionRatio = ndcTransformerRef.current.getConversionRatio(100, 10, 10);
      
      // 更新标识位置（使用精确的世界坐标）
      mouseMarkerGroup.position.copy(rayPoints[0]); // 起点（相机位置）
      mouseMarkerGroup.visible = true;
      
      validationMarker.position.copy(rayPoints[1]); // 5单位距离点
      validationMarker.visible = true;
      
      // 创建可见的鼠标射线：使用NDCTransformer获取的精确点
      const eyePosition = cameraRef.current.position.clone();
      eyePosition.y -= 0.1; // 观察者眼睛位置，比相机低10cm
      
      // 使用NDCTransformer获取的50单位距离点
      const farMousePosition = rayPoints[3]; // 50单位距离点
      
      // 更新可见的鼠标射线
      const rayLinePoints = [eyePosition, farMousePosition];
      mouseRayLine.geometry.setFromPoints(rayLinePoints);
      mouseRayLine.visible = true;
      
      // 使用射线原点作为标识位置（正确反映射线原点）
      mouseMarkerGroup.position.copy(rayPoints[0]); // rayPoints[0] 是射线原点（相机位置）
      validationMarker.position.copy(rayPoints[1]); // 使用NDCTransformer计算的5单位点
      
      // 让标识始终面向相机
      mouseMarkerGroup.lookAt(cameraRef.current.position);
      validationMarker.lookAt(cameraRef.current.position);
      
      // 确保标识不会被场景中的物体遮挡
      mouseMarkerGroup.renderOrder = 999;
      validationMarker.renderOrder = 998;
      
      // 静默处理 - 移除控制台输出

      // 检测射线与可选中物体的相交
      const intersects = raycaster.intersectObjects(selectableObjects, true);
      
      // 静默处理 - 移除控制台输出

      if (intersects.length > 0) {
        // 获取第一个命中的物体
        let hitObject = intersects[0].object;
        while (hitObject.parent && !hitObject.userData.selectable) {
          hitObject = hitObject.parent;
        }

        // 如果选中的物体变化，更新高亮
        if (hitObject !== selectedObject) {
          selectedObject = hitObject;
          
          // 将鼠标标识移动到实际相交点
          mouseMarkerGroup.position.copy(intersects[0].point);
          mouseMarkerGroup.scale.set(1, 1, 1);
        }
      } else {
        // 静默处理
        if (selectedObject) {
          selectedObject = null;
        }
        // 没有相交时保持原来的3D位置标识
        mouseMarkerGroup.scale.set(0.5, 0.5, 0.5);
      }
    };

    // 触控板双指滑动控制
    const handleWheel = (event) => {
      event.preventDefault();
      cameraRef.current.rotation.y -= event.deltaX * 0.01;
      cameraRef.current.rotation.x -= event.deltaY * 0.01;
      cameraRef.current.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRef.current.rotation.x));
    };
    
    // 键盘视角控制（方向键）
    const handleKeyDownLook = (event) => {
      switch (event.code) {
        case 'ArrowLeft':
          cameraRef.current.rotation.y += 0.05;
          break;
        case 'ArrowRight':
          cameraRef.current.rotation.y -= 0.05;
          break;
        case 'ArrowUp':
          cameraRef.current.rotation.x -= 0.05;
          break;
        case 'ArrowDown':
          cameraRef.current.rotation.x += 0.05;
          break;
      }
    };

    // 触摸事件处理
    const handleTouchStart = (event) => {
      event.preventDefault();
    };

    const handleTouchMove = (event) => {
      event.preventDefault();
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        const deltaX = touch.clientX - (mouseRef.current.lastTouchX || touch.clientX);
        const deltaY = touch.clientY - (mouseRef.current.lastTouchY || touch.clientY);
        
        cameraRef.current.rotation.y -= deltaX * 0.005;
        cameraRef.current.rotation.x -= deltaY * 0.005;
        cameraRef.current.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRef.current.rotation.x));
        
        mouseRef.current.lastTouchX = touch.clientX;
        mouseRef.current.lastTouchY = touch.clientY;
      }
    };

    const handleTouchEnd = () => {
      mouseRef.current.lastTouchX = null;
      mouseRef.current.lastTouchY = null;
    };

    // 初始化相机
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 2, 5);
    cameraRef.current = camera;

    // 初始化NDC转换器
    const ndcTransformer = new NDCTransformer(camera, window.innerWidth, window.innerHeight);
    ndcTransformerRef.current = ndcTransformer;
    // 使用setTimeout避免同步setState警告
    setTimeout(() => setNdcTransformerForDebug(ndcTransformer), 0);
    // 初始化相机位置（延迟执行避免同步setState警告）
    setTimeout(() => {
      setCameraPosition({ x: camera.position.x, y: camera.position.y, z: camera.position.z });
    }, 0);

    // 添加事件监听器
    document.addEventListener('keydown', handleKeyDownMove);
    document.addEventListener('keyup', handleKeyUpMove);
    document.addEventListener('keydown', handleKeyDownLook);
    document.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', handleTouchEnd);

    // 相机移动和旋转函数
    const moveCamera = () => {
      const baseSpeed = keysRef.current.shift ? 0.5 : 0.15;
      const direction = new THREE.Vector3();
      
      cameraRef.current.getWorldDirection(direction);
      direction.y = 0;
      direction.normalize();
      
      const right = new THREE.Vector3();
      right.crossVectors(direction, new THREE.Vector3(0, 1, 0));
      
      if (keysRef.current.w) {
        cameraRef.current.position.add(direction.clone().multiplyScalar(baseSpeed));
      }
      if (keysRef.current.s) {
        cameraRef.current.position.add(direction.clone().multiplyScalar(-baseSpeed));
      }
      if (keysRef.current.a) {
        cameraRef.current.position.add(right.clone().multiplyScalar(-baseSpeed));
      }
      if (keysRef.current.d) {
        cameraRef.current.position.add(right.clone().multiplyScalar(baseSpeed));
      }
      
      if (keysRef.current.q) {
        cameraRef.current.rotation.y += 0.03;
      }
      if (keysRef.current.e) {
        cameraRef.current.rotation.y -= 0.03;
      }
      
      if (cameraRef.current.position.y < 1.7) {
        cameraRef.current.position.y = 1.7;
      }
    };

    // 使用 requestAnimationFrame 的动画循环 - 浏览器优化，切后台自动暂停，限制60fps
    let lastTime = 0;
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;
    
    // 渲染函数 - 包含射线更新和场景渲染
    const render = () => {
      moveCamera();
      renderer.render(scene, cameraRef.current);
    };
    
    const animate = (currentTime) => {
      requestAnimationFrame(animate);
      
      // 限制帧率为60fps
      const deltaTime = currentTime - lastTime;
      if (deltaTime >= frameInterval) {
        lastTime = currentTime - (deltaTime % frameInterval);
        render();
      }
    };


    // 窗口大小调整
    const handleResize = () => {
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      
      // 更新NDCTransformer的尺寸
      if (ndcTransformerRef.current) {
        ndcTransformerRef.current.updateCanvasSize(window.innerWidth, window.innerHeight);
      }
      
      // 更新鼠标跟随元素
      const mouseFollower = document.getElementById('mouse-follower');
      if (mouseFollower && mousePosition.x && mousePosition.y) {
        mouseFollower.style.left = mousePosition.x + 'px';
        mouseFollower.style.top = mousePosition.y + 'px';
      }
    };

    window.addEventListener('resize', handleResize);
    
    // 开始动画
    animate(0);

    // 清理函数
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      renderer.domElement.removeEventListener('touchmove', handleTouchMove);
      renderer.domElement.removeEventListener('touchend', handleTouchEnd);
      
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        cursor: 'default', // 显示默认鼠标指针
        position: 'relative'
      }}
    >
      {/* 屏幕中心十字准星 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 1000
      }}>
        <div style={{
          position: 'absolute',
          width: '20px',
          height: '2px',
          backgroundColor: '#ff0000',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }} />
        <div style={{
          position: 'absolute',
          width: '2px',
          height: '20px',
          backgroundColor: '#ff0000',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }} />
        <div style={{
          position: 'absolute',
          width: '4px',
          height: '4px',
          backgroundColor: '#ffff00',
          borderRadius: '50%',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)'
        }} />
      </div>
      
      {/* 跟随鼠标的屏幕标识 */}
      <div style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 999
      }}>
        <div id="mouse-follower" style={{
          position: 'absolute',
          width: '12px',
          height: '12px',
          border: '2px solid #00ff00',
          borderRadius: '50%',
          pointerEvents: 'none',
          transform: 'translate(-50%, -50%)'
        }} />
      </div>
      
      {/* 调试信息面板 */}
      {showDebug && rayInfo && ndcTransformerForDebug && (
        <DebugPanel
          ndcTransformer={ndcTransformerForDebug}
          mouseX={mousePosition.x}
          mouseY={mousePosition.y}
          rayInfo={rayInfo}
          rayPoints={rayPoints}
        />
      )}
    </div>
  );
};

export default ThreeScene;