/**
 * blackHole.js - 3D商品展示场景渲染器
 * 
 * 主要功能：
 * 1. 创建3D场景展示商品模型
 * 2. 实现商品模型的旋转展示
 * 3. 支持商品点击选择和交互
 * 4. 提供全屏展示功能
 * 5. 集成OrbitControls实现场景控制
 */

// 渲染购物车场景的主函数
function renderBlackHole(options) {
    // 确保options存在，如果不存在则初始化为空对象
    options || (options = {});
    
    // 全局变量声明
    var renderer,           // Three.js渲染器
        camera,             // 透视相机
        scene,              // 3D场景
        texture,            // 背景纹理
        gui,                // GUI控制界面（未使用）
        light,              // 场景光源
        stats,              // 性能统计（未使用）
        controls,           // 轨道控制器
        boxHelper,          // 盒子辅助线
        selected,           // 当前选中的物体
        objArr = [],        // 存储所有加载的3D模型
        meshArr = [],       // 存储所有可点击的网格
        isFullScreen = false, // 全屏状态标志
        // 商品数据源，定义了可加载的商品模型
        objSource = [
            { obj: "bijiben", img: "bijiben", goodsId: 5 },   // 笔记本
            { obj: "bingxiang", img: "bingxiang", goodsId: 1 }, // 冰箱
            { obj: "yinshuiji", img: "yinshuiji", goodsId: 7 }, // 饮水机
            { obj: "dianshi", img: "dianshi", goodsId: 3 },   // 电视
            { obj: "yinxiang", img: "yinxiang", goodsId: 4 },  // 音响
            { obj: "gangqin", img: "gangqin", goodsId: 8 },   // 钢琴
            { obj: "kongtiao", img: "kongtiao", goodsId: 2 }   // 空调
        ];

    /**
     * 初始化渲染器
     * 创建WebGL渲染器并设置画布大小
     */
    function initRender() {
        renderer = new THREE.WebGLRenderer({antialias: true}); // 启用抗锯齿

        // 设置渲染器清除颜色为白色
        renderer.setClearColor(0xffffff);

        // 为canvas元素设置类名
        renderer.domElement.className = 'store-canvas';

        // 根据传入的容器元素设置渲染器大小
        if(options.storeConEle) {
            var ele = options.storeConEle,
                width = ele.offsetWidth,
                height = ele.offsetHeight;
            camera.aspect = width/height; // 调整相机宽高比
            camera.updateProjectionMatrix(); // 更新相机矩阵
            renderer.setSize(width, height); // 设置渲染器大小
            ele.appendChild(renderer.domElement); // 将canvas添加到DOM
        } else {
            // 默认使用窗口大小
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);
        }
    }

    /**
     * 初始化相机
     * 创建透视相机并设置初始位置和视角
     */
    function initCamera() {
        camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 1000);
        // 设置相机位置
        camera.position.set(0, 80, 100);
        // 相机看向原点
        camera.lookAt(new THREE.Vector3(0,0,0));
    }

    /**
     * 初始化场景
     * 创建3D场景并设置背景
     */
    function initScene() {
        scene = new THREE.Scene();
        
        // 加载背景纹理
        texture = new THREE.TextureLoader().load( "images/blackHole5-4.jpg" );
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set( 1, 1 );
        scene.background = texture; // 设置场景背景
        
        // 加载Archnathid.gltf模型到左侧
        loadGLTFModel('model/Archnathid.gltf', -30, 0, 0);
    }
    
    /**
     * 加载GLTF模型
     * 加载glTF格式的3D模型并添加到场景
     * @param {string} url - 模型文件路径
     * @param {number} x - X轴位置
     * @param {number} y - Y轴位置
     * @param {number} z - Z轴位置
     */
    function loadGLTFModel(url, x, y, z) {
        var loader = new THREE.GLTFLoader();
        loader.load(url, function (gltf) {
            var model = gltf.scene;
            model.position.set(x, y, z);
            model.scale.set(0.5, 0.5, 0.5); // 调整缩放
            scene.add(model);
            console.log('成功加载Archnathid.gltf模型');
        }, undefined, function (error) {
            console.error('GLTF模型加载失败:', error);
            // 如果加载失败，创建简单的占位符
            var geometry = new THREE.BoxGeometry(8, 8, 8);
            var material = new THREE.MeshPhongMaterial({ color: 0xff4444 });
            var model = new THREE.Mesh(geometry, material);
            model.position.set(x, y, z);
            scene.add(model);
        });
    }

    /**
     * 初始化光源
     * 创建环境光和点光源
     */
    function initLight() {
        // 添加环境光，提供基础照明
        scene.add(new THREE.AmbientLight(0x444444));
        
        // 添加点光源，提供主要照明
        light = new THREE.PointLight(0xffffff);
        light.position.set(0,100,0);
        light.castShadow = true; // 启用阴影投射
        scene.add(light);
    }

    /**
     * 加载商品模型
     * 根据商品信息加载对应的3D模型
     * @param {string} obj - 模型文件夹名称
     * @param {string} img - 纹理图片文件夹名称
     * @param {number} type1 - 商品类型
     * @param {number} total1 - 总数量
     * @param {number} num1 - 当前序号
     * @param {number} goodsId - 商品ID
     */
    function loadModel(obj, img, type1, total1, num1,goodsId) {
        // 直接使用JSON模型，跳过OBJ加载
        loadJSONModel(obj, img, type1, total1, num1, goodsId);
    }
    
    /**
     * 加载JSON格式模型
     * 从JSON文件加载3D模型
     * @param {string} obj - 模型文件夹名称
     * @param {string} img - 纹理图片文件夹名称
     * @param {number} type - 商品类型
     * @param {number} total - 总数量
     * @param {number} num - 当前序号
     * @param {number} goodsId - 商品ID
     */
    function loadJSONModel(obj, img, type, total, num, goodsId) {
        var textureLoader2 = new THREE.TextureLoader();
        var texture2 = textureLoader2.load( 'model/'+ img +'/model.png' );
        
        var objectLoader = new THREE.ObjectLoader();
        objectLoader.load('model/'+ obj +'/model.json', function (object) {
            // 处理JSON模型
            object.traverse( function ( child ) {
                if ( child instanceof THREE.Mesh ) {
                    child.material.map = texture2;
                }
            } );
            // 将模型缩放并添加到场景当中
            object.scale.set(0.1, 0.1, 0.1);
            setObjectPosition(object, type, total, num);
            setObjectProperties(object, goodsId);
            scene.add(object);
        }, undefined, function (error) {
            // JSON也加载失败，创建一个简单的几何体作为占位符
            console.warn('JSON模型加载失败，创建占位几何体:', error);
            createPlaceholderModel(obj, img, type, total, num, goodsId);
        });
    }
    
    /**
     * 创建占位几何体
     * 当模型加载失败时创建简单的立方体作为占位符
     * @param {string} obj - 模型文件夹名称
     * @param {string} img - 纹理图片文件夹名称
     * @param {number} type - 商品类型
     * @param {number} total - 总数量
     * @param {number} num - 当前序号
     * @param {number} goodsId - 商品ID
     */
    function createPlaceholderModel(obj, img, type, total, num, goodsId) {
        var textureLoader2 = new THREE.TextureLoader();
        var texture2 = textureLoader2.load( 'model/'+ img +'/model.png' );
        
        // 创建一个简单的立方体作为占位符
        var geometry = new THREE.BoxGeometry(5, 5, 5);
        var material = new THREE.MeshPhongMaterial({map: texture2});
        var object = new THREE.Mesh(geometry, material);
        
        object.scale.set(0.1, 0.1, 0.1);
        setObjectPosition(object, type, total, num);
        setObjectProperties(object, goodsId);
        scene.add(object);
    }
    
    /**
     * 设置对象位置
     * 根据商品类型和序号设置模型在场景中的位置
     * @param {THREE.Object3D} object - 3D对象
     * @param {number} type - 商品类型
     * @param {number} total - 总数量
     * @param {number} num - 当前序号
     */
    function setObjectPosition(object, type, total, num) {
        switch (type) {
            case 1:
                object.position.set((0 + 10 * num) * total, 5, (40 - 10 * num) * total);
                break;
            case 2:
                object.position.set(-1 *(0 + 10 * num) * total, 5, (40 - 10 * num) * total);
                break;
            case 3:
                object.position.set(-1 *(0 + 10 * num) * total, 5, -1 *(40 - 10 * num) * total);
                break;
            case 4:
                object.position.set((0 + 10 * num) * total, 5, -1 *(40 - 10 * num) * total);
                break;
        }
        object.rotation.y = Math.random() * 180; // 随机旋转
    }
    
    /**
     * 设置对象属性
     * 为3D对象设置商品ID和辅助框
     * @param {THREE.Object3D} object - 3D对象
     * @param {number} goodsId - 商品ID
     */
    function setObjectProperties(object, goodsId) {
        // 数据挂载到obj中
        object.data = {goodsId:goodsId}
        objArr.push(object);
        if(object.children) {
            meshArr = meshArr.concat(object.children);
        } else {
            meshArr.push(object);
        }

        // 辅助外框
        var boxHelper = new THREE.BoxHelper(object, 0xf1ecec);
        object.border = boxHelper;
        boxHelper.visible = false;
        scene.add(boxHelper);
    }

    /**
     * 初始化轨道控制器
     * 设置相机控制，允许用户旋转、缩放场景
     */
    function initControls() {
        controls = new THREE.OrbitControls( camera, renderer.domElement );
        
        // 启用阻尼效果（惯性）
        controls.enableDamping = true;

        // 设置旋转速度
        controls.rotateSpeed = .3;

        // 启用缩放
        controls.enableZoom = true;

        // 禁用自动旋转
        controls.autoRotate = false;

        // 设置相机距离限制
        controls.minDistance  = 1;
        controls.maxDistance  = 100;

        // 禁用右键拖拽
        controls.enablePan = false;
    }

    /**
     * 渲染场景
     * 将场景渲染到画布上
     */
    function render() {
        renderer.render( scene, camera );
    }

    /**
     * 窗口大小调整处理
     * 当窗口大小变化时调整渲染器大小
     * @param {number} width - 新宽度
     * @param {number} height - 新高度
     * @param {string} string - 调用标识
     */
    function onWindowResize(width, height, string) {
        if(isFullScreen || string == "click") {
            typeof(width) == "number" || (width = window.innerWidth);
            height = 780;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize( width, height );
            render();
        }
    }

    /**
     * 动画循环
     * 持续更新控制器并渲染场景
     */
    function animate() {
        // 更新控制器
        render();
        controls.update();
        requestAnimationFrame(animate);
    }

    /**
     * 绘制场景
     * 初始化所有组件并开始渲染
     */
    function draw() {
        initScene();
        initCamera();
        initRender();
        initLight();
        
        // 绘制所有商品模型
        for(let i = 0; i < objSource.length; i++) {
            var type = Math.ceil(((i + 1) % 16) / 4)
            var total = Math.ceil(((i + 1) / 16))
            var num = i % 4;
            loadModel(objSource[i].obj, objSource[i].img, type, total, num,objSource[i].goodsId);
        }
        
        initControls();
        animate();
        myrender();
    }

    /**
     * 自定义渲染循环
     * 负责场景动画效果和持续渲染
     */
    function myrender() {
        requestAnimationFrame(myrender);
        
        // 背景纹理旋转效果
        texture.center = {x: 0.5, y: 0.5}
        texture.rotation -= 0.001
        
        // 商品自转效果
        objArr.forEach(function (item) {
            item.rotation.y += 0.005 + 0.01 * Math.random();
        })
        
        renderer.render(scene, camera);
    }

    /**
     * 全屏事件处理
     * 处理全屏按钮点击事件
     */
    function fullScreen() {
        if(options.showAllEle) {
            var ele = options.showAllEle;
            ele.onclick = function () {
                isFullScreen = !isFullScreen;
                if(isFullScreen) {
                    options.storeConEle.className = "store-con store-con-fullscreen";
                    onWindowResize(1100, 780, "click");
                } else {
                    options.storeConEle.className = "store-con store-con-style";
                    onWindowResize(510, 780, "click");
                }
            }
        }
    }

    /**
     * 商品选择功能
     * 实现鼠标点击选择商品模型的功能
     * @param {Array} models - 模型数组
     */
    function chooseHoleGood(models) {
        var $canvas = $(".store-canvas");
        $canvas.on("mousedown",function(e){
            e.preventDefault();
            var mouse = {};

            // 将鼠标点击位置的屏幕坐标转换为Three.js标准坐标
            mouse.x = ((e.clientX - $canvas.offset().left) / $canvas.width()) * 2 - 1;
            mouse.y = -((e.clientY - $canvas.offset().top) / $canvas.height()) * 2 + 1;

            // 创建射线用于检测点击
            var vector = new THREE.Vector3(mouse.x, mouse.y,0.5).unproject(camera);
            var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());

            // 检测射线与模型的交点
            var intersects = raycaster.intersectObjects(meshArr);

            // 选中物品
            if (intersects.length > 0) {
                // 取消所有选择框
                objArr.forEach(function (item) {
                    item.border.visible = false;
                })

                // 选中第一个射线相交的物体
                selected = intersects[0].object.parent;
                selected.border.visible = true;
                options.addToScene(selected);

                // 显示添加/删除按钮
                $(".add-to-scene").show();
                $(".remove-from-store").show();
            }
        });
    }

    // 添加商品到场景的按钮事件处理
    $("body").delegate(".add-to-scene", "click", function () {
        if(selected) {
            options.addToScene(selected);
        }
    })

    // 移除购物车商品的按钮事件处理
    $("body").delegate(".remove-from-store", "click", function () {
        if(selected) {
            scene.remove(selected.border)
            scene.remove(selected)
            
            // 取消所有选择框
            $(".add-to-scene").hide();
            $(".remove-from-store").hide();
            objArr.forEach(function (item) {
                item.border.visible = false;
            })
            
            // 从数组中移除
            objArr = $.grep(objArr, function(value) {
                return value.uuid != selected.uuid;
            });
        }
    })

    // 开始执行
    draw();
    fullScreen();
    chooseHoleGood(objArr);
}