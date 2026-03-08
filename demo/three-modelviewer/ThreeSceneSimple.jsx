import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import DebugPanel from './DebugPanel.jsx';
import { NDCTransformer } from '../utils/NDCTransformer.js';

/**
 * 简化版Three.js场景组件
 * 确保基本功能正常工作
 */
const ThreeSceneSimple = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const ndcTransformerRef = useRef(null);
  
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [rayInfo, setRayInfo] = useState(null);
  const [rayPoints, setRayPoints] = useState(null);
  const [showDebug, setShowDebug] = useState(true);
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0, z: 0 });
  
  useEffect(() => {
    console.log('🚀 初始化简化版Three.js场景...');
    
    try {
      // 创建场景
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87CEEB);
      sceneRef.current = scene;
      
      // 创建渲染器
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      if (mountRef.current) {
        mountRef.current.appendChild(renderer.domElement);
      }
      rendererRef.current = renderer;
      
      // 创建相机
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
      
      // 添加基础元素
      addBasicElements(scene);
      
      // 添加光照
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 5);
      directionalLight.castShadow = true;
      scene.add(directionalLight);
      
      // 设置事件监听
      setupEventListeners(renderer, camera, ndcTransformer);
      
      // 启动渲染循环
      startRenderLoop(renderer, scene, camera);
      
      console.log('✅ 简化版场景初始化完成');
      
    } catch (error) {
      console.error('❌ 场景初始化失败:', error);
    }
    
    return () => {
      console.log('🧹 清理资源...');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mountRef.current && rendererRef.current?.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, []);
  
  const animationFrameRef = useRef(null);
  
  const addBasicElements = (scene) => {
    // 添加网格
    const gridHelper = new THREE.GridHelper(100, 100, 0x444444, 0x444444);
    scene.add(gridHelper);
    
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
    
    // 添加一些立方体
    for (let i = 0; i < 5; i++) {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5)
      });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(
        (Math.random() - 0.5) * 20,
        0.5,
        (Math.random() - 0.5) * 20
      );
      cube.castShadow = true;
      cube.userData.selectable = true;
      scene.add(cube);
    }
    
    // 创建鼠标射线可视化
    const mouseRayLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 2, 5),
        new THREE.Vector3(0, 2, -100)
      ]),
      new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
    );
    mouseRayLine.renderOrder = 9999;
    mouseRayLine.visible = true;
    mouseRayLine.name = 'mouseRay';
    scene.add(mouseRayLine);
  };
  
  const setupEventListeners = (renderer, camera, ndcTransformer) => {
    // 鼠标移动
    const handleMouseMove = (event) => {
      const canvas = renderer.domElement;
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      setMousePosition({ x: mouseX, y: mouseY });
      
      // 获取射线信息
      const rayInfo = ndcTransformer.getRayInfo(mouseX, mouseY);
      const rayPoints = ndcTransformer.getRayPoints(mouseX, mouseY, [1, 5, 10, 20]);
      
      setRayInfo(rayInfo);
      setRayPoints(rayPoints);
      
      // 更新射线可视化
      const rayLine = sceneRef.current.getObjectByName('mouseRay');
      if (rayLine) {
        const eyePosition = camera.position.clone();
        eyePosition.y -= 0.1;
        rayLine.geometry.setFromPoints([eyePosition, rayPoints[rayPoints.length - 1]]);
      }
      
      // 更新相机位置状态
      setCameraPosition({
        x: Number(camera.position.x.toFixed(3)),
        y: Number(camera.position.y.toFixed(3)),
        z: Number(camera.position.z.toFixed(3))
      });
    };
    
    // F1键切换调试面板
    const handleF1Key = (event) => {
      if (event.code === 'F1') {
        event.preventDefault();
        setShowDebug(prev => !prev);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleF1Key);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleF1Key);
    };
  };
  
  const startRenderLoop = (renderer, scene, camera) => {
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();
  };
  
  return (
    <div
      ref={mountRef}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        cursor: 'default',
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
      
      {/* 调试信息面板 */}
      {showDebug && rayInfo && ndcTransformerRef.current && (
        <DebugPanel
          ndcTransformer={ndcTransformerRef.current}
          mouseX={mousePosition.x}
          mouseY={mousePosition.y}
          rayInfo={rayInfo}
          rayPoints={rayPoints}
          cameraPosition={cameraPosition}
        />
      )}
    </div>
  );
};

export default ThreeSceneSimple;