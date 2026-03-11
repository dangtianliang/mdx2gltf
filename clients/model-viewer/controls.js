// 控制系统模块 - 封装了所有相机控制和用户输入处理功能

class ControlsSystem {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // 键盘控制变量
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            q: false, // Q键左转
            e: false, // E键右转
            shift: false
        };
        
        // 鼠标选择相关变量
        this.selectedObject = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectableObjects = [];
        
        // 触摸事件相关变量
        this.touchStartDistance = 0;
        
        // 坐标系转换工具
        this.coordinateConverter = new CoordinateConverter();
        
        // 初始化控制系统
        this.init();
    }
    
    // 初始化控制系统
    init() {
        // 添加事件监听器
        this.addEventListeners();
        
        // 初始化可选择对象
        this.initSelectableObjects();
        
        // 设置相机默认位置
        this.setCameraToDefaultPosition();
        
        // 触发控制系统就绪事件
        setTimeout(() => {
            window.dispatchEvent(new Event('controlsSystemReady'));
        }, 100);
    }
    
    // 添加事件监听器
    addEventListeners() {
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
        document.addEventListener('keyup', (event) => this.handleKeyUp(event));
        this.renderer.domElement.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
        window.addEventListener('mousemove', (event) => this.handleMouseMove(event), false);
        window.addEventListener('click', (event) => this.handleMouseClick(event), false);
        window.addEventListener('touchstart', (event) => this.handleTouchStart(event), false);
        window.addEventListener('touchmove', (event) => this.handleTouchMove(event), false);
    }
    
    // 键盘按下事件处理
    handleKeyDown(event) {
        switch (event.code) {
            case 'KeyW':
                this.keys.w = true;
                break;
            case 'KeyA':
                this.keys.a = true;
                break;
            case 'KeyS':
                this.keys.s = true;
                break;
            case 'KeyD':
                this.keys.d = true;
                break;
            case 'KeyQ':
                this.keys.q = true;
                break;
            case 'KeyE':
                this.keys.e = true;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.shift = true;
                break;
            // 方向键控制视角
            case 'ArrowLeft':
                this.camera.rotation.y += 0.05;
                break;
            case 'ArrowRight':
                this.camera.rotation.y -= 0.05;
                break;
            case 'ArrowUp':
                this.camera.rotation.x -= 0.05;
                break;
            case 'ArrowDown':
                this.camera.rotation.x += 0.05;
                break;
            // 空格键重置视角
            case 'Space':
                this.setCameraToDefaultPosition();
                break;
            // R键 - 摄像机向下看（增加俯角）
            case 'KeyR':
                this.adjustCameraPitch(0.05);
                break;
            // T键 - 摄像机向上看（增加仰角）
            case 'KeyT':
                this.adjustCameraPitch(-0.05);
                break;
        }
    }
    
    // 键盘释放事件处理
    handleKeyUp(event) {
        switch (event.code) {
            case 'KeyW':
                this.keys.w = false;
                break;
            case 'KeyA':
                this.keys.a = false;
                break;
            case 'KeyS':
                this.keys.s = false;
                break;
            case 'KeyD':
                this.keys.d = false;
                break;
            case 'KeyQ':
                this.keys.q = false;
                break;
            case 'KeyE':
                this.keys.e = false;
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.keys.shift = false;
                break;
        }
    }
    
    // 触控板双指滑动控制
    handleWheel(event) {
        event.preventDefault();
        
        // 处理水平滑动（左右转向）- 类似Q/E键
        if (event.deltaX !== 0) {
            const quaternion = new THREE.Quaternion();
            // 翻转旋转方向，使向右滑动时相机向右转
            quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), event.deltaX * 0.001);
            this.camera.quaternion.multiplyQuaternions(quaternion, this.camera.quaternion);
        }
        
        // 处理垂直滑动（上下视角）- 类似R/T键
        if (event.deltaY !== 0) {
            // y正向的差值对应R键效果（向下看），y负方向的差值对应T键效果（向上看）
            // 翻转纵向差值，使向上滑动对应T键效果（向上看），向下滑动对应R键效果（向下看）
            const pitchDelta = -event.deltaY * 0.001;
            this.adjustCameraPitch(pitchDelta);
        }
    }
    
    // 调整相机俯仰角度，保持相机位置不变，且相机Y轴与世界Y轴平行
    adjustCameraPitch(pitchDelta) {
        // 保存相机的当前位置
        const position = this.camera.position.clone();
        
        // 获取相机的当前方向
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        // 计算相机的右侧向量（作为俯仰旋转轴）
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(this.camera.quaternion);
        right.normalize();
        
        // 创建围绕右侧向量的旋转
        const quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(right, -pitchDelta);
        
        // 应用旋转到相机的方向
        direction.applyQuaternion(quaternion);
        
        // 计算新的相机旋转，保持位置不变
        this.camera.lookAt(position.clone().add(direction));
        
        // 确保相机的Y轴与世界Y轴平行
        const up = new THREE.Vector3(0, 1, 0);
        this.camera.up.copy(up);
    }
    
    // 触摸开始事件处理
    handleTouchStart(event) {
        if (event.touches.length === 2) {
            // 计算两指之间的距离
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            this.touchStartDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
        }
    }
    
    // 触摸移动事件处理
    handleTouchMove(event) {
        if (event.touches.length === 2) {
            event.preventDefault();
            
            // 计算两指之间的距离
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const touchCurrentDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            // 计算距离变化
            const distanceChange = touchCurrentDistance - this.touchStartDistance;
            
            // 根据距离变化控制前进/后退
            if (Math.abs(distanceChange) > 5) { // 阈值，避免误操作
                const baseSpeed = 0.01;
                const moveDistance = distanceChange * baseSpeed * 0.01;
                
                // 获取相机的前进方向
                const direction = new THREE.Vector3();
                this.camera.getWorldDirection(direction);
                direction.y = 0; // 只在水平方向移动
                direction.normalize();
                
                // 移动相机
                this.camera.position.add(direction.multiplyScalar(moveDistance));
                
                // 确保相机不会低于地面
                if (this.camera.position.y < 1.7) {
                    this.camera.position.y = 1.7;
                }
                
                // 更新起始距离
                this.touchStartDistance = touchCurrentDistance;
            }
        }
    }
    
    // 鼠标移动事件处理
    handleMouseMove(event) {
        // 计算鼠标在屏幕上的位置
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    }
    
    // 鼠标点击事件处理
    handleMouseClick(event) {
        // 计算鼠标在屏幕上的位置
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // 更新射线投射器
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // 检测射线与对象的交点
        var intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
        
        // 取消之前的选择
        if (this.selectedObject) {
            // 移除选中效果
            if (this.selectedObject.material) {
                this.selectedObject.material.emissive.setHex(0x000000);
            }
        }
        
        // 选中新对象
        if (intersects.length > 0) {
            this.selectedObject = intersects[0].object;
            // 添加选中效果
            if (this.selectedObject.material) {
                this.selectedObject.material.emissive.setHex(0x333333);
            }
            console.log(`选中对象: ${this.selectedObject.name || 'Unknown'}`);
        } else {
            this.selectedObject = null;
            console.log('未选中任何对象');
        }
    }
    
    // 初始化可选择对象数组
    initSelectableObjects() {
        // 清空数组
        this.selectableObjects = [];
        
        // 遍历场景中的所有对象
        this.scene.traverse(function(object) {
            // 只添加可选择的对象
            if (object.userData.selectable || object.isMesh) {
                this.selectableObjects.push(object);
            }
        }.bind(this));
    }
    
    // 为对象添加可选择属性
    makeObjectSelectable(object) {
        object.userData.selectable = true;
        if (!this.selectableObjects.includes(object)) {
            this.selectableObjects.push(object);
        }
    }
    
    // 移动相机
    moveCamera() {
        const baseSpeed = this.keys.shift ? 0.5 : 0.15;
        const direction = new THREE.Vector3();
        
        this.camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(direction, new THREE.Vector3(0, 1, 0));
        
        // W - 向前移动
        if (this.keys.w) {
            this.camera.position.add(direction.clone().multiplyScalar(baseSpeed));
        }
        // S - 向后移动
        if (this.keys.s) {
            this.camera.position.add(direction.clone().multiplyScalar(-baseSpeed));
        }
        // A - 向左平移
        if (this.keys.a) {
            this.camera.position.add(right.clone().multiplyScalar(-baseSpeed));
        }
        // D - 向右平移
        if (this.keys.d) {
            this.camera.position.add(right.clone().multiplyScalar(baseSpeed));
        }
        
        // Q - 向左旋转视角（围绕世界坐标系的Y轴）
        if (this.keys.q) {
            const quaternion = new THREE.Quaternion();
            quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.03);
            this.camera.quaternion.multiplyQuaternions(quaternion, this.camera.quaternion);
        }
        // E - 向右旋转视角（围绕世界坐标系的Y轴）
        if (this.keys.e) {
            const quaternion = new THREE.Quaternion();
            quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.03);
            this.camera.quaternion.multiplyQuaternions(quaternion, this.camera.quaternion);
        }
        
        // 确保相机不会低于地面
        if (this.camera.position.y < 1.7) {
            this.camera.position.y = 1.7;
        }
    }
    
    // 使用球坐标设置相机位置
    setCameraPositionBySpherical(radius, theta, phi, target = new THREE.Vector3(0, 0, 0)) {
        // 使用坐标系转换工具计算相机位置
        const cameraPosition = this.coordinateConverter.calculateCameraPosition(target, radius, theta, phi);
        this.camera.position.copy(cameraPosition);
        
        // 计算并设置相机旋转
        const cameraRotation = this.coordinateConverter.calculateCameraRotation(cameraPosition, target);
        this.camera.quaternion.copy(cameraRotation);
        
        console.log(`相机位置已设置为球坐标: r=${radius.toFixed(2)}, θ=${(theta * 180 / Math.PI).toFixed(2)}°, φ=${(phi * 180 / Math.PI).toFixed(2)}°`);
    }
    
    // 重置相机到默认位置
    setCameraToDefaultPosition() {
        // 使用球坐标设置默认相机位置，极角为90度（平视）
        this.setCameraPositionBySpherical(
            5, // 半径
            0, // 方位角（theta）
            Math.PI / 2, // 极角（phi）- 90度，平视
            new THREE.Vector3(0, 0, 0) // 目标点
        );
    }
    
    // 获取当前相机的球坐标
    getCameraSphericalCoordinates(target = new THREE.Vector3(0, 0, 0)) {
        return this.coordinateConverter.calculateSphericalFromCamera(this.camera.position, target);
    }
    
    // 更新控制系统
    update() {
        this.moveCamera();
    }
    
    // 调节相机距离（镜头长度）
    adjustCameraDistance(distance) {
        // 确定相机的目标点（看向的点）
        // 这里我们使用一个固定的目标点，比如原点，或者计算相机当前看向的点
        const target = new THREE.Vector3(0, 0, 0); // 使用原点作为目标点
        
        // 计算相机当前到目标点的方向
        const direction = new THREE.Vector3();
        direction.subVectors(this.camera.position, target).normalize();
        
        // 计算相机当前到目标点的距离
        const currentDistance = this.camera.position.distanceTo(target);
        
        // 计算新的相机位置：沿着方向向量，距离目标点为指定的distance
        const newPosition = new THREE.Vector3();
        newPosition.copy(target).add(direction.multiplyScalar(distance));
        
        // 更新相机位置
        this.camera.position.copy(newPosition);
        
        // 确保相机看向目标点
        this.camera.lookAt(target);
        
        // 确保相机不会低于地面
        if (this.camera.position.y < 1.7) {
            this.camera.position.y = 1.7;
            // 重新看向目标点，确保视角正确
            this.camera.lookAt(target);
        }
    }
    
    // 获取当前相机距离
    getCameraDistance() {
        // 返回相机到目标点（原点）的距离
        const target = new THREE.Vector3(0, 0, 0);
        return this.camera.position.distanceTo(target);
    }
}

// 坐标系转换工具类 - 基于OrbitControls.js的实现
class CoordinateConverter {
    constructor() {
        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        this.offset = new THREE.Vector3();
        this.quat = new THREE.Quaternion();
        this.quatInverse = new THREE.Quaternion();
        this.lastPosition = new THREE.Vector3();
        this.lastQuaternion = new THREE.Quaternion();
    }
    
    // 笛卡尔坐标转球坐标
    cartesianToSpherical(vector) {
        this.spherical.setFromVector3(vector);
        return {
            radius: this.spherical.radius,
            theta: this.spherical.theta, // 方位角（绕Y轴）
            phi: this.spherical.phi // 极角（绕X轴）
        };
    }
    
    // 球坐标转笛卡尔坐标
    sphericalToCartesian(radius, theta, phi) {
        this.spherical.set(radius, phi, theta);
        this.offset.setFromSpherical(this.spherical);
        return this.offset.clone();
    }
    
    // 计算相机位置（基于目标点和球坐标）
    calculateCameraPosition(target, radius, theta, phi, up = new THREE.Vector3(0, 1, 0)) {
        // 设置球坐标
        this.spherical.set(radius, phi, theta);
        
        // 创建偏移向量
        this.offset.setFromSpherical(this.spherical);
        
        // 处理相机向上方向 - 与OrbitControls.js保持一致
        this.quat.setFromUnitVectors(up, new THREE.Vector3(0, 1, 0));
        this.quatInverse.copy(this.quat).inverse();
        
        // 应用旋转到"y-axis-is-up"空间
        this.offset.applyQuaternion(this.quat);
        
        // 从目标点计算相机位置
        const cameraPosition = new THREE.Vector3();
        cameraPosition.copy(target).add(this.offset);
        
        return cameraPosition;
    }
    
    // 计算相机看向目标的旋转
    calculateCameraRotation(cameraPosition, target, up = new THREE.Vector3(0, 1, 0)) {
        const camera = new THREE.Object3D();
        camera.position.copy(cameraPosition);
        camera.up.copy(up);
        camera.lookAt(target);
        return camera.quaternion.clone();
    }
    
    // 限制球坐标范围
    clampSpherical(spherical, minRadius, maxRadius, minPolarAngle, maxPolarAngle, minAzimuthAngle, maxAzimuthAngle) {
        // 限制半径
        spherical.radius = Math.max(minRadius, Math.min(maxRadius, spherical.radius));
        
        // 限制方位角
        spherical.theta = Math.max(minAzimuthAngle, Math.min(maxAzimuthAngle, spherical.theta));
        
        // 限制极角
        spherical.phi = Math.max(minPolarAngle, Math.min(maxPolarAngle, spherical.phi));
        
        // 确保极角在安全范围内
        spherical.makeSafe();
        
        return spherical;
    }
    
    // 从相机位置和目标点计算球坐标
    calculateSphericalFromCamera(cameraPosition, target, up = new THREE.Vector3(0, 1, 0)) {
        // 计算偏移量
        this.offset.copy(cameraPosition).sub(target);
        
        // 处理相机向上方向
        this.quat.setFromUnitVectors(up, new THREE.Vector3(0, 1, 0));
        this.offset.applyQuaternion(this.quat);
        
        // 转换为球坐标
        this.spherical.setFromVector3(this.offset);
        
        return {
            radius: this.spherical.radius,
            theta: this.spherical.theta,
            phi: this.spherical.phi
        };
    }
    
    // 更新相机位置和旋转
    updateCamera(camera, target, spherical, up = new THREE.Vector3(0, 1, 0)) {
        // 计算相机位置
        const cameraPosition = this.calculateCameraPosition(target, spherical.radius, spherical.theta, spherical.phi, up);
        
        // 设置相机位置
        camera.position.copy(cameraPosition);
        
        // 设置相机向上方向
        camera.up.copy(up);
        
        // 看向目标
        camera.lookAt(target);
        
        return camera;
    }
}

// 导出模块
export { ControlsSystem, CoordinateConverter };