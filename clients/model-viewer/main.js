// 日志发送函数 - 发送关键日志到服务器
function sendLog(type, message, data = {}) {
    const logData = {
        type: type,
        message: message,
        data: data,
        url: window.location.href,
        userAgent: navigator.userAgent
    };
    
    fetch('http://localhost:8081/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
    }).catch(err => {
        // 静默失败，不影响正常功能
        console.warn('日志发送失败:', err);
    });
}

// 全局变量
let selectedModel = null;
let scene, camera, renderer, controls;
let modelMesh = null;

// GLTF 预览相关变量
let gltfScene, gltfCamera, gltfRenderer, gltfControls;
let gltfModel = null;
let gltfAnimations = [];
let gltfMixer = null;
let currentAnimationAction = null;
let isGltfPlaying = false;

// 当前模型的材质文件路径
let currentMaterialPath = null;

// Warcraft 3 队伍颜色常量
const TEAM_COLORS = {
    0: null, // 默认 (无队伍颜色)
    1: 0xFF0000, // 红色
    2: 0x0000FF, // 蓝色
    3: 0x00FFFF, // 青色
    4: 0xFF00FF, // 紫色
    5: 0xFFFF00, // 黄色
    6: 0xFF8000, // 橙色
    7: 0x00FF00, // 绿色
    8: 0xFF8080  // 粉色
};

// 初始化函数
function init() {
    // 初始化3D预览场景
    initPreviewScene();
    
    // 初始化GLTF预览场景
    initGltfPreviewScene();
    
    // 加载模型列表
    loadModelList();
    
    // 绑定事件
    bindEvents();
    
    // 绑定动画控制事件
    bindAnimationControls();
}

// 初始化预览场景
function initPreviewScene() {
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // 创建相机
    camera = new THREE.PerspectiveCamera(
        75,
        document.getElementById('preview-canvas').clientWidth / 
        document.getElementById('preview-canvas').clientHeight,
        0.1,
        1000
    );
    camera.position.z = 5;
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById('preview-canvas'),
        antialias: true 
    });
    renderer.setSize(
        document.getElementById('preview-canvas').clientWidth,
        document.getElementById('preview-canvas').clientHeight
    );
    
    // 添加轨道控制器
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // 添加光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    // 渲染循环
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        
        // 如果有模型，自动旋转
        if (modelMesh) {
            modelMesh.rotation.y += 0.005;
        }
        
        renderer.render(scene, camera);
    }
    
    animate();
}

// 初始化 GLTF 预览场景
function initGltfPreviewScene() {
    // 创建场景
    gltfScene = new THREE.Scene();
    gltfScene.background = new THREE.Color(0xe8f4f8);
    
    // 创建相机
    const canvas = document.getElementById('gltf-preview-canvas');
    gltfCamera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    gltfCamera.position.set(0, 0, 5);
    
    // 创建渲染器
    gltfRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    gltfRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    gltfRenderer.outputEncoding = THREE.sRGBEncoding;
    
    // 添加轨道控制器
    gltfControls = new THREE.OrbitControls(gltfCamera, canvas);
    gltfControls.enableDamping = true;
    gltfControls.dampingFactor = 0.05;
    
    // 添加光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    gltfScene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    gltfScene.add(directionalLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(-5, 0, -5);
    gltfScene.add(backLight);
    
    // 添加网格辅助
    const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
    gridHelper.position.y = -2;
    gltfScene.add(gridHelper);
    
    // 渲染循环
    const clock = new THREE.Clock();
    function animateGltf() {
        requestAnimationFrame(animateGltf);
        
        const delta = clock.getDelta();
        
        // 更新动画混合器 - 只要有 mixer 就更新，不管播放状态
        // 因为 mixer 需要持续更新来推进动画时间
        if (gltfMixer) {
            gltfMixer.update(delta);
        }
        
        gltfControls.update();
        gltfRenderer.render(gltfScene, gltfCamera);
    }
    
    animateGltf();
}

// 加载模型列表
function loadModelList() {
    // 模型数据，基于实际目录结构
    const modelData = [
        {
            race: "Creeps",
            models: [
                { name: "Archnathid", path: "../../src/model/Creeps/Archnathid/Archnathid.mdx" },
                { name: "BansheeRanger", path: "../../src/model/Creeps/BansheeRanger/BansheeRanger.mdx" },
                { name: "Beastmaster", path: "../../src/model/Creeps/Beastmaster/Beastmaster.mdx" },
                { name: "DireWolf", path: "../../src/model/Creeps/DireWolf/DireWolf.mdx" },
                { name: "FacelessOne", path: "../../src/model/Creeps/FacelessOne/FacelessOne.mdx" },
                { name: "ForgottenOne", path: "../../src/model/Creeps/ForgottenOne/ForgottenOne.mdx" },
                { name: "GrizzlyBear", path: "../../src/model/Creeps/GrizzlyBear/GrizzlyBear.mdx" },
                { name: "HumanMage", path: "../../src/model/Creeps/HumanMage/HumanMage.mdx" },
                { name: "Hydra", path: "../../src/model/Creeps/Hydra/Hydra.mdx" },
                { name: "JungleBeast", path: "../../src/model/Creeps/JungleBeast/JungleBeast.mdx" },
                { name: "Lobstrokkblue", path: "../../src/model/Creeps/Lobstrokkblue/Lobstrokkblue.mdx" },
                { name: "Lobstrokkred", path: "../../src/model/Creeps/Lobstrokkred/Lobstrokkred.mdx" },
                { name: "LordGarithos", path: "../../src/model/Creeps/LordGarithos/LordGarithos.mdx" },
                { name: "Magnataur", path: "../../src/model/Creeps/Magnataur/Magnataur.mdx" },
                { name: "MagnataurBlue", path: "../../src/model/Creeps/MagnataurBlue/MagnataurBlue.mdx" },
                { name: "Mammoth", path: "../../src/model/Creeps/Mammoth/Mammoth.mdx" },
                { name: "MammothBlack", path: "../../src/model/Creeps/MammothBlack/MammothBlack.mdx" },
                { name: "MonsterLure", path: "../../src/model/Creeps/MonsterLure/MonsterLure.mdx" },
                { name: "MurgulReaver", path: "../../src/model/Creeps/MurgulReaver/MurgulReaver.mdx" },
                { name: "MurgulSlave", path: "../../src/model/Creeps/MurgulSlave/MurgulSlave.mdx" },
                { name: "Murloc", path: "../../src/model/Creeps/Murloc/Murloc_V1.mdx" },
                { name: "MurlocMutant", path: "../../src/model/Creeps/MurlocMutant/MurlocMutant_V1.mdx" },
                { name: "NetherDragon", path: "../../src/model/Creeps/NetherDragon/NetherDragon.mdx" },
                { name: "OgreOneHeaded", path: "../../src/model/Creeps/OgreOneHeaded/OgreOneHeaded.mdx" },
                { name: "OrcWarlock", path: "../../src/model/Creeps/OrcWarlock/OrcWarlock.mdx" },
                { name: "OrcWarlockRed", path: "../../src/model/Creeps/OrcWarlockRed/OrcWarlockRed.mdx" },
                { name: "PolarBear", path: "../../src/model/Creeps/PolarBear/PolarBear.mdx" },
                { name: "PolarFurbolg", path: "../../src/model/Creeps/PolarFurbolg/PolarFurbolg.mdx" },
                { name: "QuillBeast", path: "../../src/model/Creeps/QuillBeast/QuillBeast.mdx" },
                { name: "SeaElemental", path: "../../src/model/Creeps/SeaElemental/SeaElemental.mdx" },
                { name: "SeaGiant", path: "../../src/model/Creeps/SeaGiant/SeaGiant.mdx" },
                { name: "SeaGiantGreen", path: "../../src/model/Creeps/SeaGiantGreen/SeaGiantGreen.mdx" },
                { name: "SeaTurtle", path: "../../src/model/Creeps/SeaTurtle/SeaTurtle.mdx" },
                { name: "SkeletonOrc", path: "../../src/model/Creeps/SkeletonOrc/SkeletonOrc.mdx" },
                { name: "TimberWolf", path: "../../src/model/Creeps/TimberWolf/TimberWolf.mdx" },
                { name: "Unbroken", path: "../../src/model/Creeps/Unbroken/Unbroken.mdx" },
                { name: "VoidWalker", path: "../../src/model/Creeps/VoidWalker/VoidWalker.mdx" },
                { name: "WarEagle", path: "../../src/model/Creeps/WarEagle/WarEagle.mdx" },
                { name: "WhiteWolf", path: "../../src/model/Creeps/WhiteWolf/WhiteWolf.mdx" },
                { name: "tuskar", path: "../../src/model/Creeps/tuskar/tuskar.mdx" },
                { name: "tuskarLord", path: "../../src/model/Creeps/tuskarLord/tuskarLord.mdx" },
                { name: "tuskarRanged", path: "../../src/model/Creeps/tuskarRanged/tuskarRanged.mdx" }
            ]
        },
        {
            race: "Critters",
            models: [
                { name: "Albatross", path: "../../src/model/Critters/Albatross/Albatross.mdx" },
                { name: "DuneWorm", path: "../../src/model/Critters/DuneWorm/DuneWorm.mdx" },
                { name: "Felboar", path: "../../src/model/Critters/Felboar/Felboar.mdx" },
                { name: "Frog", path: "../../src/model/Critters/Frog/Frog.mdx" },
                { name: "HermitCrab", path: "../../src/model/Critters/HermitCrab/HermitCrab.mdx" },
                { name: "PackHorse", path: "../../src/model/Critters/PackHorse/PackHorse.mdx" },
                { name: "Penguin", path: "../../src/model/Critters/Penguin/Penguin.mdx" },
                { name: "Sheep", path: "../../src/model/Critters/Sheep/Sheep.mdx" },
                { name: "Skink", path: "../../src/model/Critters/Skink/Skink.mdx" },
                { name: "SnowOwl", path: "../../src/model/Critters/SnowOwl/SnowOwl.mdx" },
                { name: "SpiderCrab", path: "../../src/model/Critters/SpiderCrab/SpiderCrab.mdx" }
            ]
        },
        {
            race: "Demon",
            models: [
                { name: "Demoness", path: "../../src/model/Demon/Demoness/Demoness.mdx" },
                { name: "DemonessBlue", path: "../../src/model/Demon/DemonessBlue/DemonessBlue.mdx" },
                { name: "EredarWarlock", path: "../../src/model/Demon/EredarWarlock/EredarWarlock.mdx" },
                { name: "Felgaurd", path: "../../src/model/Demon/Felgaurd/Felgaurd.mdx" },
                { name: "FelgaurdBlue", path: "../../src/model/Demon/FelgaurdBlue/FelgaurdBlue.mdx" },
                { name: "HeroPitLord", path: "../../src/model/Demon/HeroPitLord/HeroPitLord.mdx" },
                { name: "Kiljaeden", path: "../../src/model/Demon/Kiljaeden/Kiljaeden.mdx" },
                { name: "felhound", path: "../../src/model/Demon/felhound/felhound_V1.mdx" }
            ]
        },
        {
            race: "Human",
            models: [
                { name: "Gyrocopter", path: "../../src/model/Human/Gyrocopter/Gyrocopter_V1.mdx" },
                { name: "HeroBloodElf", path: "../../src/model/Human/HeroBloodElf/HeroBloodElf.mdx" },
                { name: "Kael", path: "../../src/model/Human/Kael/Kael.mdx" },
                { name: "Phoenix", path: "../../src/model/Human/Phoenix/Phoenix.mdx" },
                { name: "PhoenixEgg", path: "../../src/model/Human/Phoenix/PhoenixEgg.mdx" },
                { name: "Priest", path: "../../src/model/Human/Priest/Priest_V1.mdx" },
                { name: "Sorceress", path: "../../src/model/Human/Sorceress/Sorceress_V1.mdx" },
                { name: "WarWagon", path: "../../src/model/Human/WarWagon/WarWagon_V1.mdx" }
            ]
        },
        {
            race: "Naga",
            models: [
                { name: "LadyVashj", path: "../../src/model/Naga/LadyVashj/LadyVashj.mdx" },
                { name: "NagaMyrmidon", path: "../../src/model/Naga/NagaMyrmidon/NagaMyrmidon.mdx" },
                { name: "NagaRoyalGuard", path: "../../src/model/Naga/NagaRoyalGuard/NagaRoyalGuard.mdx" },
                { name: "NagaSiren", path: "../../src/model/Naga/NagaSiren/NagaSiren.mdx" },
                { name: "NagaSummoner", path: "../../src/model/Naga/NagaSummoner/NagaSummoner.mdx" },
                { name: "SnapDragon", path: "../../src/model/Naga/SnapDragon/SnapDragon.mdx" },
                { name: "WindSerpent", path: "../../src/model/Naga/WindSerpent/WindSerpent.mdx" }
            ]
        },
        {
            race: "NightElf",
            models: [
                { name: "Dryad", path: "../../src/model/NightElf/Dryad/Dryad.mdx" },
                { name: "EvilIllidan", path: "../../src/model/NightElf/EvilIllidan/IllidanEvil.mdx" },
                { name: "FaerieDragon", path: "../../src/model/NightElf/FaerieDragon/FaerieDragon.mdx" },
                { name: "HeroWarden", path: "../../src/model/NightElf/HeroWarden/HeroWarden.mdx" },
                { name: "Maiev", path: "../../src/model/NightElf/Maiev/Maiev.mdx" },
                { name: "MalFurion", path: "../../src/model/NightElf/MalFurion/MalFurion.mdx" },
                { name: "Owl", path: "../../src/model/NightElf/Owl/Owl.mdx" },
                { name: "OwlScout", path: "../../src/model/NightElf/OwlScout/OwlScout.mdx" },
                { name: "Runner", path: "../../src/model/NightElf/Runner/Runner.mdx" },
                { name: "Vengeance", path: "../../src/model/NightElf/Vengeance/Vengeance.mdx" }
            ]
        },
        {
            race: "Orc",
            models: [
                { name: "BatTroll", path: "../../src/model/Orc/BatTroll/BatTroll.mdx" },
                { name: "HeadHunter", path: "../../src/model/Orc/HeadHunter/Headhunter_V1.mdx" },
                { name: "SerpentWard", path: "../../src/model/Orc/SerpentWard/SerpentWard.mdx" },
                { name: "SpiritWalker", path: "../../src/model/Orc/SpiritWalker/SpiritWalker.mdx" },
                { name: "SpiritWyvern", path: "../../src/model/Orc/SpiritWyvern/SpiritWyvern.mdx" },
                { name: "Spiritwolf", path: "../../src/model/Orc/Spiritwolf/Spiritwolf.mdx" },
                { name: "WatcherWard", path: "../../src/model/Orc/WatcherWard/WatcherWard.mdx" },
                { name: "catapult", path: "../../src/model/Orc/catapult/catapult_V1.mdx" }
            ]
        },
        {
            race: "Other",
            models: [
                { name: "BloodElfWagon", path: "../../src/model/Other/BloodElfWagon/BloodElfWagon.mdx" },
                { name: "DalaranMutant", path: "../../src/model/Other/DalaranMutant/DalaranMutant.mdx" },
                { name: "DalaranReject", path: "../../src/model/Other/DalaranReject/DalaranReject.mdx" },
                { name: "Dranai", path: "../../src/model/Other/Dranai/Dranai.mdx" },
                { name: "DranaiAkama", path: "../../src/model/Other/DranaiAkama/DranaiAkama.mdx" },
                { name: "DranaiMage", path: "../../src/model/Other/DranaiMage/DranaiMage.mdx" },
                { name: "DranaiWhite", path: "../../src/model/Other/DranaiWhite/DranaiWhite.mdx" },
                { name: "FleshGolem", path: "../../src/model/Other/FleshGolem/FleshGolem.mdx" },
                { name: "IllidanWagon", path: "../../src/model/Other/IllidanWagon/IllidanWagon.mdx" },
                { name: "Proudmoore", path: "../../src/model/Other/Proudmoore/Proudmoore.mdx" },
                { name: "Rexxar", path: "../../src/model/Other/Rexxar/Rexxar.mdx" },
                { name: "TNTBarrel", path: "../../src/model/Other/TNTBarrel/TNTBarrel.mdx" }
            ]
        },
        {
            race: "Undead",
            models: [
                { name: "Anubarak", path: "../../src/model/Undead/Anubarak/Anubarak.mdx" },
                { name: "CryptFiend", path: "../../src/model/Undead/CryptFiend/CryptFiend.mdx" },
                { name: "EvilSylvanas", path: "../../src/model/Undead/EvilSylvanas/EvilSylvanas.mdx" },
                { name: "Gargoyle", path: "../../src/model/Undead/Gargoyle/Gargoyle.mdx" },
                { name: "HeroCryptLord", path: "../../src/model/Undead/HeroCryptLord/HeroCryptLord.mdx" },
                { name: "HeroLich", path: "../../src/model/Undead/HeroLich/HeroLich_V1.mdx" },
                { name: "HeroLichCIN", path: "../../src/model/Undead/HeroLichCIN/HeroLichCIN_V1.mdx" },
                { name: "Locust", path: "../../src/model/Undead/Locust/locust.mdx" },
                { name: "Scarab", path: "../../src/model/Undead/Scarab/Scarab.mdx" },
                { name: "SkeletonMage", path: "../../src/model/Undead/SkeletonMage/SkeletonMage.mdx" }
            ]
        }
    ];
    
    const categoriesContainer = document.getElementById('race-categories');
    
    modelData.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'race-category';
        categoryDiv.innerHTML = `<h3>${category.race}</h3>`;
        
        const modelList = document.createElement('ul');
        modelList.className = 'model-list';
        
        category.models.forEach(model => {
            const modelItem = document.createElement('li');
            modelItem.className = 'model-item';
            modelItem.textContent = model.name;
            modelItem.dataset.path = model.path;
            modelItem.dataset.name = model.name;
            
            modelItem.addEventListener('click', () => {
                selectModel(modelItem);
            });
            
            modelList.appendChild(modelItem);
        });
        
        categoryDiv.appendChild(modelList);
        categoriesContainer.appendChild(categoryDiv);
    });
}

// 选择模型
function selectModel(modelItem) {
    // 移除其他选中项
    document.querySelectorAll('.model-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 添加选中状态
    modelItem.classList.add('selected');
    
    // 更新选中信息
    selectedModel = {
        name: modelItem.dataset.name,
        path: modelItem.dataset.path
    };
    
    document.getElementById('selected-model-name').textContent = selectedModel.name;
    document.getElementById('selected-model-path').textContent = selectedModel.path;
    
    // 计算对应的材质文件路径（glb文件）
    // 规则：将mdx文件路径中的.mdx替换为.glb，得到对应的材质文件路径
    const mdxPath = selectedModel.path;
    currentMaterialPath = mdxPath.replace(/\.mdx$/i, '.glb');
    console.log('计算得到的材质文件路径:', currentMaterialPath);
    
    // 清空之前的结果
    clearResults();
}

// 绑定事件
function bindEvents() {
    // 转换按钮
    document.getElementById('convert-btn').addEventListener('click', startConversion);
    
    // 预览按钮
    document.getElementById('preview-btn').addEventListener('click', previewModel);
    
    // 清空按钮
    document.getElementById('clear-btn').addEventListener('click', clearAll);
    
    // 窗口大小变化
    window.addEventListener('resize', onWindowResize);
}

// 窗口大小变化处理
function onWindowResize() {
    if (camera && renderer) {
        const canvas = document.getElementById('preview-canvas');
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    }
    
    // GLTF 预览窗口调整
    if (gltfCamera && gltfRenderer) {
        const canvas = document.getElementById('gltf-preview-canvas');
        gltfCamera.aspect = canvas.clientWidth / canvas.clientHeight;
        gltfCamera.updateProjectionMatrix();
        gltfRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    }
}

// 预览模型
function previewModel() {
    if (!selectedModel) {
        showStatus('请先选择一个模型', 'error');
        return;
    }
    
    showStatus('正在加载模型...', 'info', true);
    
    // 清空之前的模型
    if (modelMesh) {
        scene.remove(modelMesh);
        modelMesh = null;
    }
    
    // 使用war3-model库加载模型
    fetch(selectedModel.path)
        .then(response => {
            if (!response.ok) {
                throw new Error('模型文件加载失败');
            }
            
            // 添加进度显示
            const contentLength = response.headers.get('content-length');
            const total = parseInt(contentLength, 10);
            let loaded = 0;
            
            const reader = response.body.getReader();
            const chunks = [];
            
            return new Promise((resolve, reject) => {
                function read() {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            // 在浏览器环境中使用正确的方法处理二进制数据
                            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                            const result = new Uint8Array(totalLength);
                            let offset = 0;
                            for (const chunk of chunks) {
                                result.set(chunk, offset);
                                offset += chunk.length;
                            }
                            resolve(result.buffer);
                            return;
                        }
                        
                        chunks.push(value);
                        loaded += value.length;
                        
                        // 更新进度
                        if (total) {
                            const progress = Math.round((loaded / total) * 100);
                            showStatus(`正在加载模型... ${progress}%`, 'info', true);
                        }
                        
                        read();
                    }).catch(reject);
                }
                
                read();
            });
        })
        .then(buffer => {
            try {
                // 解析MDX模型
                // 使用war3-model库的正确导出方式
                console.log('开始解析MDX模型...');
                const model = window.war3model.parseMDX(buffer);
                console.log('MDX模型解析成功');
                try { sendLog('mdx_parsed', 'MDX parsed successfully', { modelName: selectedModel ? selectedModel.name : null }); } catch (e) { console.warn('sendLog failed', e); }
                console.log('模型对象的所有属性:', Object.keys(model));
                
                // 添加详细的调试信息
                console.log('解析后的模型数据:', model);
                console.log('模型对象的所有属性:', Object.keys(model));
                
                // 分析 MDX 动画数据结构
                const animationAnalysis = analyzeMdxAnimations(model);
                
                // 保存分析结果到全局，方便调试
                window.mdxAnimationAnalysis = animationAnalysis;
                
                // 将分析结果保存为 JSON 文件
                try {
                    const analysisBlob = new Blob([JSON.stringify(animationAnalysis, null, 2)], { type: 'application/json' });
                    const analysisUrl = URL.createObjectURL(analysisBlob);
                    const analysisLink = document.createElement('a');
                    analysisLink.href = analysisUrl;
                    analysisLink.download = `${selectedModel.name}_animation_analysis.json`;
                    // 自动下载分析结果
                    setTimeout(() => analysisLink.click(), 1000);
                    console.log('✅ 动画分析结果已保存到文件');
                } catch (e) {
                    console.warn('保存分析结果失败:', e);
                }
                console.log('模型是否有vertices属性:', 'vertices' in model);
                console.log('模型是否有faces属性:', 'faces' in model);
                console.log('模型是否有bones属性:', 'bones' in model);
                console.log('模型是否有materials属性:', 'materials' in model);
                console.log('模型是否有Geosets属性:', 'Geosets' in model);
                console.log('模型是否有Nodes属性:', 'Nodes' in model);
                console.log('模型是否有Bones属性:', 'Bones' in model);
                console.log('模型是否有Materials属性:', 'Materials' in model);
                console.log('模型是否有Textures属性:', 'Textures' in model);
                console.log('模型是否有Animations属性:', 'Animations' in model);
                console.log('模型是否有Sequence属性:', 'Sequence' in model);
                console.log('模型是否有Sequences属性:', 'Sequences' in model);
                
                // 声明变量
                let bonesData = [];
                let animationsData = [];
                let materialsData = [];
                let texturesData = [];
                
                
                
                if (model.Bones) {
                    bonesData = model.Bones;
                    console.log('提取到骨骼数据:', bonesData.length, '个骨骼');
                } else if (model.bones) {
                    bonesData = model.bones;
                    console.log('提取到骨骼数据:', bonesData.length, '个骨骼');
                } else if (model.Nodes) {
                    // 从Nodes中提取骨骼
                    const nodes = Object.values(model.Nodes);
                    bonesData = nodes.filter(node => node.Flags & 256); // 256是Bone类型的标志
                    console.log('从Nodes中提取到骨骼数据:', bonesData.length, '个骨骼');
                }
                
                console.log('骨骼数据示例:', bonesData.length > 0 ? bonesData[0] : '无');
                console.log('动画数据示例:', animationsData.length > 0 ? animationsData[0] : '无');
                console.log('模型是否有Textures属性:', 'Textures' in model);
                console.log('模型是否有Animations属性:', 'Animations' in model);
                console.log('模型是否有Sequence属性:', 'Sequence' in model);
                console.log('模型是否有Sequences属性:', 'Sequences' in model);
                
                
                
                if (model.Materials) {
                    materialsData = model.Materials;
                    console.log('提取到材质数据:', materialsData.length, '个材质');
                } else if (model.materials) {
                    materialsData = model.materials;
                    console.log('提取到材质数据:', materialsData.length, '个材质');
                }
                
                if (model.Textures) {
                    texturesData = model.Textures;
                    console.log('提取到纹理数据:', texturesData.length, '个纹理');
                } else if (model.textures) {
                    texturesData = model.textures;
                    console.log('提取到纹理数据:', texturesData.length, '个纹理');
                }
                
                
                
                if (model.Animations) {
                    animationsData = model.Animations;
                    console.log('提取到动画数据:', animationsData.length, '个动画');
                } else if (model.animations) {
                    animationsData = model.animations;
                    console.log('提取到动画数据:', animationsData.length, '个动画');
                } else if (model.Sequences) {
                    animationsData = model.Sequences;
                    console.log('提取到序列数据:', animationsData.length, '个序列');
                } else if (model.Sequence) {
                    animationsData = [model.Sequence];
                    console.log('提取到序列数据:', animationsData.length, '个序列');
                }
                
                // 提取骨骼数据
                if (model.Bones) {
                    bonesData = model.Bones;
                    console.log('提取到骨骼数据:', bonesData.length, '个骨骼');
                } else if (model.bones) {
                    bonesData = model.bones;
                    console.log('提取到骨骼数据:', bonesData.length, '个骨骼');
                } else if (model.Nodes) {
                    // 从Nodes中提取骨骼
                    const nodes = Object.values(model.Nodes);
                    bonesData = nodes.filter(node => node.Flags & 256); // 256是Bone类型的标志
                    console.log('从Nodes中提取到骨骼数据:', bonesData.length, '个骨骼');
                }
                
                // 提取骨骼数据
                if (model.Bones) {
                    bonesData = model.Bones;
                    console.log('提取到骨骼数据:', bonesData.length, '个骨骼');
                } else if (model.bones) {
                    bonesData = model.bones;
                    console.log('提取到骨骼数据:', bonesData.length, '个骨骼');
                } else if (model.Nodes) {
                    // 从Nodes中提取骨骼
                    const nodes = Object.values(model.Nodes);
                    bonesData = nodes.filter(node => node.Flags & 256); // 256是Bone类型的标志
                    console.log('从Nodes中提取到骨骼数据:', bonesData.length, '个骨骼');
                }
                
                // 提取骨骼数据
                
                console.log('骨骼数据示例:', bonesData.length > 0 ? bonesData[0] : '无');
                console.log('动画数据示例:', animationsData.length > 0 ? animationsData[0] : '无');
                
                // 更新模型信息（根据实际数据结构调整）
                let verticesCount = 0;
                let facesCount = 0;
                let bonesCount = 0;
                let materialsCount = 0;
                
                // 检查不同可能的数据结构
                if (model.vertices) {
                    verticesCount = model.vertices.length;
                } else if (model.Geosets && model.Geosets.length > 0) {
                    // 尝试从Geosets中获取顶点数
                    for (const geoset of model.Geosets) {
                        if (geoset.Vertices) {
                            verticesCount += geoset.Vertices.length / 3; // 假设每个顶点有3个坐标
                        }
                        if (geoset.Faces) {
                            facesCount += geoset.Faces.length / 3; // 假设每个面有3个顶点
                        }
                    }
                }
                
                if (model.faces) {
                    facesCount = model.faces.length;
                }
                
                if (model.bones) {
                    bonesCount = model.bones.length;
                } else if (model.Bones) {
                    bonesCount = model.Bones.length;
                } else if (model.Nodes) {
                    // 尝试从Nodes中获取骨骼数
                    bonesCount = Object.values(model.Nodes).filter(node => node.Flags & 256).length; // 256是Bone类型的标志
                }
                
                if (model.materials) {
                    materialsCount = model.materials.length;
                } else if (model.Materials) {
                    materialsCount = model.Materials.length;
                }
                
                document.getElementById('model-vertices').textContent = verticesCount;
                document.getElementById('model-faces').textContent = facesCount;
                document.getElementById('model-bones').textContent = bonesCount;
                document.getElementById('model-materials').textContent = materialsCount;
                
                // 根据MDX模型数据创建真实的几何体
                let geometry, material;
                let hasGeometryData = false;
                
                // 尝试处理不同可能的数据结构
                if (model.vertices && model.faces) {
                    // 小写属性名结构
                    hasGeometryData = true;
                    // 创建BufferGeometry
                    geometry = new THREE.BufferGeometry();
                    
                    // 处理顶点数据
                    const vertices = [];
                    for (let i = 0; i < model.vertices.length; i += 3) {
                        vertices.push(model.vertices[i], model.vertices[i + 1], model.vertices[i + 2]);
                    }
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    
                    // 处理面数据
                    const indices = [];
                    for (let i = 0; i < model.faces.length; i += 3) {
                        indices.push(model.faces[i], model.faces[i + 1], model.faces[i + 2]);
                    }
                    geometry.setIndex(indices);
                    
                    // 计算法线
                    geometry.computeVertexNormals();
                } else if (model.Geosets && model.Geosets.length > 0) {
                    // 大写属性名结构（Geosets）
                    hasGeometryData = true;
                    // 创建BufferGeometry
                    geometry = new THREE.BufferGeometry();
                    
                    // 处理顶点数据（合并所有Geosets的顶点）
                    const vertices = [];
                    const indices = [];
                    const uvs = [];
                    let vertexOffset = 0;
                    let geosetIndex = 0;
                    
                    for (const geoset of model.Geosets) {
                        if (geoset.Vertices) {
                            // 添加顶点
                            for (let i = 0; i < geoset.Vertices.length; i += 3) {
                                vertices.push(geoset.Vertices[i], geoset.Vertices[i + 1], geoset.Vertices[i + 2]);
                            }
                            
                            // 添加面（需要调整索引）
                            if (geoset.Faces) {
                                for (let i = 0; i < geoset.Faces.length; i += 3) {
                                    indices.push(
                                        geoset.Faces[i] + vertexOffset,
                                        geoset.Faces[i + 1] + vertexOffset,
                                        geoset.Faces[i + 2] + vertexOffset
                                    );
                                }
                            }
                            
                            // 添加UV坐标（如果有）
                            // 尝试多种可能的UV数据属性名
                            let uvData = null;
                            let uvSource = '';
                            
                            // 检查各种可能的UV数据源（按优先级排序）
                            if (geoset.uvSets && geoset.uvSets.length > 0) {
                                // 标准MDLX解析器格式 - 第一个UV集
                                uvData = geoset.uvSets[0];
                                uvSource = 'uvSets[0]';
                            } else if (geoset.UVSets && geoset.UVSets.length > 0) {
                                // 大写格式
                                uvData = geoset.UVSets[0];
                                uvSource = 'UVSets[0]';
                            } else if (geoset.tVertices && geoset.tVertices.length > 0) {
                                // 小写tVertices格式
                                uvData = geoset.tVertices[0];
                                uvSource = 'tVertices[0]';
                            } else if (geoset.TVertices && geoset.TVertices.length > 0) {
                                // 大写TVertices格式
                                uvData = geoset.TVertices[0];
                                uvSource = 'TVertices[0]';
                            } else if (geoset.UVs) {
                                // 直接的UVs属性
                                uvData = geoset.UVs;
                                uvSource = 'UVs';
                            } else if (geoset.uv) {
                                // 小写uv属性
                                uvData = geoset.uv;
                                uvSource = 'uv';
                            } else if (geoset.texCoords) {
                                // texCoords属性
                                uvData = geoset.texCoords;
                                uvSource = 'texCoords';
                            }
                            
                            if (uvData && uvData.length > 0) {
                                console.log(`Geoset ${geosetIndex} 从 ${uvSource} 提取UV坐标:`, uvData.length / 2, '个UV');
                                for (let i = 0; i < uvData.length; i += 2) {
                                    // War3纹理需要翻转Y轴
                                    const u = uvData[i];
                                    const v = 1.0 - uvData[i + 1];
                                    uvs.push(u, v);
                                }
                            } else {
                                // 如果没有UV坐标，生成默认UV
                                console.log(`Geoset ${geosetIndex} 缺少UV坐标，生成默认UV`);
                                const vertexCount = geoset.Vertices.length / 3;
                                for (let i = 0; i < vertexCount; i++) {
                                    // 生成简单的平面UV
                                    const u = (i % 16) / 15;
                                    const v = Math.floor(i / 16) / 15;
                                    uvs.push(u, v);
                                }
                            }
                            
                            // 更新顶点偏移
                            vertexOffset += geoset.Vertices.length / 3;
                            geosetIndex++;
                        }
                    }
                    
                    // 设置顶点和面数据
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    geometry.setIndex(indices);
                    
                    // 添加UV坐标
                    if (uvs.length > 0) {
                        console.log('成功添加UV坐标，顶点数:', uvs.length / 2);
                        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                    } else {
                        console.warn('没有UV坐标数据，纹理可能无法正确显示');
                        // 生成默认UV
                        const defaultUvs = [];
                        const vertexCount = vertices.length / 3;
                        for (let i = 0; i < vertexCount; i++) {
                            const u = (i % 16) / 15;
                            const v = Math.floor(i / 16) / 15;
                            defaultUvs.push(u, v);
                        }
                        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(defaultUvs, 2));
                        console.log('生成默认UV坐标，顶点数:', defaultUvs.length / 2);
                    }
                    
                    // 计算法线
                    geometry.computeVertexNormals();
                }
                
                // 创建材质
                if (hasGeometryData) {
                    // 尝试创建带纹理的材质
                    if (materialsData.length > 0 && texturesData.length > 0) {
                        // 处理所有纹理路径
                        let texturePaths = [];
                        texturesData.forEach((texture, index) => {
                            let texturePath = '';
                            
                            // 提取纹理路径
                            if (texture.FileName) {
                                texturePath = texture.FileName;
                            } else if (texture.fileName) {
                                texturePath = texture.fileName;
                            }
                            
                            if (texturePath) {
                                // 构建纹理的完整路径
                                const modelDir = selectedModel.path.substring(0, selectedModel.path.lastIndexOf('/'));
                                
                                // 处理不同的路径格式
                                let fullTexturePath = '';
                                if (texturePath.startsWith('..')) {
                                    // 相对路径
                                    fullTexturePath = texturePath;
                                } else if (texturePath.includes('/')) {
                                    // 绝对路径或包含目录的路径
                                    fullTexturePath = modelDir + '/' + texturePath;
                                } else {
                                    // 只文件名
                                    // 尝试多种可能的路径
                                    fullTexturePath = modelDir + '/' + texturePath;
                                }
                                
                                console.log(`纹理 ${index}: ${texturePath} -> ${fullTexturePath}`);
                                texturePaths.push(fullTexturePath);
                                
                                // 添加额外的路径尝试
                                const normalizedTexturePath = texturePath.replace(/\\/g, '/');
                                const fileName = normalizedTexturePath.split('/').pop();
                                if (fileName) {
                                    // 同目录下的文件
                                    const sameDirPath = modelDir + '/' + fileName;
                                    if (!texturePaths.includes(sameDirPath)) {
                                        console.log(`纹理 ${index} 备用路径: ${sameDirPath}`);
                                        texturePaths.push(sameDirPath);
                                    }
                                }
                            }
                        });
                        
                        // 尝试加载第一个纹理
                        if (texturePaths.length > 0) {
                            const firstTexturePath = texturePaths[0];
                            console.log('尝试加载纹理:', firstTexturePath);
                        
                            // 创建纹理加载器
                            const textureLoader = new THREE.TextureLoader();
                        
                            // 尝试加载纹理
                            textureLoader.load(
                                firstTexturePath,
                                (texture) => {
                                    console.log('纹理加载成功:', firstTexturePath);
                                    // 创建带纹理的材质
                                    material = new THREE.MeshStandardMaterial({ 
                                        map: texture,
                                        wireframe: false,
                                        side: THREE.DoubleSide
                                    });
                                    
                                    // 创建模型网格并添加到场景
                                    if (!modelMesh) {
                                        modelMesh = new THREE.Mesh(geometry, material);
                                        scene.add(modelMesh);
                                    } else {
                                        // 更新模型材质
                                        modelMesh.material = material;
                                    }
                                    
                                    // 添加鼠标滚轮缩放功能
                                    const previewContainer = document.querySelector('.preview-container');
                                    if (previewContainer) {
                                        previewContainer.addEventListener('wheel', (event) => {
                                            event.preventDefault();
                                            
                                            // 计算缩放因子
                                            const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
                                            
                                            // 限制缩放范围
                                            const currentScale = modelMesh.scale.x;
                                            const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
                                            
                                            // 应用缩放
                                            modelMesh.scale.set(newScale, newScale, newScale);
                                        });
                                    }
                                    
                                    showStatus('模型预览成功', 'success');
                                },
                                undefined,
                                (error) => {
                                    console.error('纹理加载失败:', error);
                                    // 如果纹理加载失败，使用默认材质
                                    material = new THREE.MeshStandardMaterial({ 
                                        color: 0x2196f3,
                                        wireframe: false,
                                        side: THREE.DoubleSide
                                    });
                                    
                                    // 创建模型网格并添加到场景
                                    modelMesh = new THREE.Mesh(geometry, material);
                                    scene.add(modelMesh);
                                    
                                    // 添加鼠标滚轮缩放功能
                                    const previewContainer = document.querySelector('.preview-container');
                                    if (previewContainer) {
                                        previewContainer.addEventListener('wheel', (event) => {
                                            event.preventDefault();
                                            
                                            // 计算缩放因子
                                            const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
                                            
                                            // 限制缩放范围
                                            const currentScale = modelMesh.scale.x;
                                            const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
                                            
                                            // 应用缩放
                                            modelMesh.scale.set(newScale, newScale, newScale);
                                        });
                                    }
                                    
                                    showStatus('模型预览成功（纹理加载失败，使用默认材质）', 'warning');
                                }
                            );
                            
                            // 等待纹理加载完成，不在这里创建模型
                            return;
                        }
                    }
                }
                
                // 如果没有纹理数据或纹理路径，使用默认材质创建模型
                if (!material) {
                    if (hasGeometryData) {
                        material = new THREE.MeshStandardMaterial({ 
                            color: 0x2196f3,
                            wireframe: false,
                            side: THREE.DoubleSide
                        });
                    } else {
                        // 如果没有模型数据，使用立方体作为占位符
                        geometry = new THREE.BoxGeometry(1, 1, 1);
                        material = new THREE.MeshStandardMaterial({ 
                            color: 0x2196f3,
                            wireframe: false 
                        });
                    }
                }
                
                // 创建模型网格并添加到场景
                modelMesh = new THREE.Mesh(geometry, material);
                scene.add(modelMesh);
                
                // 添加鼠标滚轮缩放功能
                const previewContainer = document.querySelector('.preview-container');
                if (previewContainer) {
                    previewContainer.addEventListener('wheel', (event) => {
                        event.preventDefault();
                        
                        // 计算缩放因子
                        const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
                        
                        // 限制缩放范围
                        const currentScale = modelMesh.scale.x;
                        const newScale = Math.max(0.1, Math.min(10, currentScale * scaleFactor));
                        
                        // 应用缩放
                        modelMesh.scale.set(newScale, newScale, newScale);
                    });
                }
                
            } catch (error) {
                console.error('模型解析错误:', error);
                try { sendLog('mdx_parse_error', 'MDX parse error', { message: error && error.message ? error.message : String(error), modelPath: selectedModel ? selectedModel.path : null }); } catch (e) { console.warn('sendLog failed', e); }
                showStatus(`模型解析失败: ${error.message}`, 'error');
            }
        })
        .catch(error => {
            console.error('加载错误:', error);
            showStatus(`加载失败: ${error.message}`, 'error');
        });
}

// 开始转换
function startConversion() {
    console.log('=== 开始转换模型 ===');
    if (!selectedModel) {
        console.log('错误: 请先选择一个模型');
        showStatus('请先选择一个模型', 'error');
        return;
    }
    
    // 清除之前加载的纹理缓存
    // window.loadedTexture = null;
    // console.log('已清除纹理缓存');
    
    console.log('选择的模型:', selectedModel.name);
    console.log('模型路径:', selectedModel.path);
    showStatus('正在转换模型...', 'info', true);
    
    // 获取转换选项
    const outputFormat = document.getElementById('output-format').value;
    const embedTextures = document.getElementById('embed-textures').checked;
    const includeAnimations = document.getElementById('include-animations').checked;
    const textureFormat = document.getElementById('texture-format').value;
    const teamColorIndex = parseInt(document.getElementById('team-color').value);
    const teamColor = TEAM_COLORS[teamColorIndex];
    
    console.log('输出格式:', outputFormat);
    console.log('嵌入纹理:', embedTextures);
    console.log('包含动画:', includeAnimations);
    console.log('纹理格式:', textureFormat);
    console.log('队伍颜色:', teamColorIndex, teamColor ? `0x${teamColor.toString(16).toUpperCase()}` : '默认');
    
    // 加载并转换模型
    fetch(selectedModel.path)
        .then(response => {
            if (!response.ok) {
                throw new Error('模型文件加载失败');
            }
            return response.arrayBuffer();
        })
        .then(buffer => {
            try {
                // 解析MDX模型
                // 使用war3-model库的正确导出方式
                console.log('开始解析MDX模型...');
                const model = window.war3model.parseMDX(buffer);
                console.log('MDX模型解析成功');
                console.log('模型对象的所有属性:', Object.keys(model));
                
                // 添加详细的调试信息
                console.log('解析后的模型数据:', model);
                console.log('模型对象的所有属性:', Object.keys(model));
                console.log('模型是否有vertices属性:', 'vertices' in model);
                console.log('模型是否有faces属性:', 'faces' in model);
                console.log('模型是否有bones属性:', 'bones' in model);
                console.log('模型是否有materials属性:', 'materials' in model);
                console.log('模型是否有Geosets属性:', 'Geosets' in model);
                console.log('模型是否有Nodes属性:', 'Nodes' in model);
                console.log('模型是否有Bones属性:', 'Bones' in model);
                console.log('模型是否有Materials属性:', 'Materials' in model);
                console.log('模型是否有Textures属性:', 'Textures' in model);
                console.log('模型是否有Animations属性:', 'Animations' in model);
                console.log('模型是否有Sequence属性:', 'Sequence' in model);
                
                // 提取材质和纹理数据
                let materialsData = [];
                let texturesData = [];
                let bonesData = [];
                let sequencesData = [];
                
                if (model.Materials) {
                    materialsData = model.Materials;
                    console.log('提取到材质数据:', materialsData.length, '个材质');
                } else if (model.materials) {
                    materialsData = model.materials;
                    console.log('提取到材质数据:', materialsData.length, '个材质');
                }
                
                if (model.Textures) {
                    texturesData = model.Textures;
                    console.log('提取到纹理数据:', texturesData.length, '个纹理');
                } else if (model.textures) {
                    texturesData = model.textures;
                    console.log('提取到纹理数据:', texturesData.length, '个纹理');
                }
                
                if (model.Bones) {
                    bonesData = model.Bones;
                    console.log('提取到骨骼数据:', bonesData.length, '个骨骼');
                } else if (model.bones) {
                    bonesData = model.bones;
                    console.log('提取到骨骼数据:', bonesData.length, '个骨骼');
                } else if (model.Nodes) {
                    // 从Nodes中提取骨骼
                    const nodes = Object.values(model.Nodes);
                    bonesData = nodes.filter(node => node.Flags & 256); // 256是Bone类型的标志
                    console.log('从Nodes中提取到骨骼数据:', bonesData.length, '个骨骼');
                }
                
                if (model.Sequences) {
                    sequencesData = model.Sequences;
                    console.log('提取到序列数据:', sequencesData.length, '个序列');
                } else if (model.sequences) {
                    sequencesData = model.sequences;
                    console.log('提取到序列数据:', sequencesData.length, '个序列');
                } else if (model.Animations) {
                    sequencesData = model.Animations;
                    console.log('提取到动画数据:', sequencesData.length, '个动画');
                } else if (model.animations) {
                    sequencesData = model.animations;
                    console.log('提取到动画数据:', sequencesData.length, '个动画');
                } else if (model.Sequence) {
                    sequencesData = [model.Sequence];
                    console.log('提取到序列数据:', sequencesData.length, '个序列');
                }
                
                // 发送详细的模型数据信息日志
                sendLog('model_data_details', '模型数据详细信息', {
                    hasMaterials: materialsData.length > 0,
                    hasTextures: texturesData.length > 0,
                    hasBones: bonesData.length > 0,
                    hasSequences: sequencesData.length > 0,
                    materialCount: materialsData.length,
                    textureCount: texturesData.length,
                    boneCount: bonesData.length,
                    sequenceCount: sequencesData.length
                });
                
                // 根据MDX模型数据创建真实的几何体
                let geometry, material;
                let hasGeometryData = false;
                
                // 尝试处理不同可能的数据结构
                if (model.vertices && model.faces) {
                    // 小写属性名结构
                    hasGeometryData = true;
                    // 创建BufferGeometry
                    geometry = new THREE.BufferGeometry();
                    
                    // 处理顶点数据
                    const vertices = [];
                    for (let i = 0; i < model.vertices.length; i += 3) {
                        vertices.push(model.vertices[i], model.vertices[i + 1], model.vertices[i + 2]);
                    }
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    
                    // 处理面数据
                    const indices = [];
                    for (let i = 0; i < model.faces.length; i += 3) {
                        indices.push(model.faces[i], model.faces[i + 1], model.faces[i + 2]);
                    }
                    geometry.setIndex(indices);
                    
                    // 计算法线
                    geometry.computeVertexNormals();
                } else if (model.Geosets && model.Geosets.length > 0) {
                    // 大写属性名结构（Geosets）
                    hasGeometryData = true;
                    // 创建BufferGeometry
                    geometry = new THREE.BufferGeometry();
                    
                    // 处理顶点数据（合并所有Geosets的顶点）
                    const vertices = [];
                    const indices = [];
                    const uvs = [];
                    let vertexOffset = 0;
                    let geosetIndex = 0;
                    
                    for (const geoset of model.Geosets) {
                        if (geoset.Vertices) {
                            // 添加顶点
                            for (let i = 0; i < geoset.Vertices.length; i += 3) {
                                vertices.push(geoset.Vertices[i], geoset.Vertices[i + 1], geoset.Vertices[i + 2]);
                            }
                            
                            // 添加面（需要调整索引）
                            if (geoset.Faces) {
                                for (let i = 0; i < geoset.Faces.length; i += 3) {
                                    indices.push(
                                        geoset.Faces[i] + vertexOffset,
                                        geoset.Faces[i + 1] + vertexOffset,
                                        geoset.Faces[i + 2] + vertexOffset
                                    );
                                }
                            }
                            
                            // 添加UV坐标（如果有）
                            // 尝试多种可能的UV数据属性名
                            let uvData = null;
                            let uvSource = '';
                            
                            // 检查各种可能的UV数据源（按优先级排序）
                            if (geoset.uvSets && geoset.uvSets.length > 0) {
                                // 标准MDLX解析器格式 - 第一个UV集
                                uvData = geoset.uvSets[0];
                                uvSource = 'uvSets[0]';
                            } else if (geoset.UVSets && geoset.UVSets.length > 0) {
                                // 大写格式
                                uvData = geoset.UVSets[0];
                                uvSource = 'UVSets[0]';
                            } else if (geoset.tVertices && geoset.tVertices.length > 0) {
                                // 小写tVertices格式
                                uvData = geoset.tVertices[0];
                                uvSource = 'tVertices[0]';
                            } else if (geoset.TVertices && geoset.TVertices.length > 0) {
                                // 大写TVertices格式
                                uvData = geoset.TVertices[0];
                                uvSource = 'TVertices[0]';
                            } else if (geoset.UVs) {
                                // 直接的UVs属性
                                uvData = geoset.UVs;
                                uvSource = 'UVs';
                            } else if (geoset.uv) {
                                // 小写uv属性
                                uvData = geoset.uv;
                                uvSource = 'uv';
                            } else if (geoset.texCoords) {
                                // texCoords属性
                                uvData = geoset.texCoords;
                                uvSource = 'texCoords';
                            }
                            
                            if (uvData && uvData.length > 0) {
                                console.log(`Geoset ${geosetIndex} 从 ${uvSource} 提取UV坐标:`, uvData.length / 2, '个UV');
                                for (let i = 0; i < uvData.length; i += 2) {
                                    // War3纹理需要翻转Y轴
                                    const u = uvData[i];
                                    const v = 1.0 - uvData[i + 1];
                                    uvs.push(u, v);
                                }
                            } else {
                                // 如果没有UV坐标，生成默认UV
                                console.log(`Geoset ${geosetIndex} 缺少UV坐标，生成默认UV`);
                                const vertexCount = geoset.Vertices.length / 3;
                                for (let i = 0; i < vertexCount; i++) {
                                    // 生成简单的平面UV
                                    const u = (i % 16) / 15;
                                    const v = Math.floor(i / 16) / 15;
                                    uvs.push(u, v);
                                }
                            }
                            
                            // 更新顶点偏移
                            vertexOffset += geoset.Vertices.length / 3;
                            geosetIndex++;
                        }
                    }
                    
                    // 设置顶点和面数据
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    geometry.setIndex(indices);
                    
                    // 添加UV坐标
                    if (uvs.length > 0) {
                        console.log('成功添加UV坐标，顶点数:', uvs.length / 2);
                        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                    } else {
                        console.warn('没有UV坐标数据，纹理可能无法正确显示');
                        // 生成默认UV
                        const defaultUvs = [];
                        const vertexCount = vertices.length / 3;
                        for (let i = 0; i < vertexCount; i++) {
                            const u = (i % 16) / 15;
                            const v = Math.floor(i / 16) / 15;
                            defaultUvs.push(u, v);
                        }
                        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(defaultUvs, 2));
                        console.log('生成默认UV坐标，顶点数:', defaultUvs.length / 2);
                    }
                    
                    // 计算法线
                    geometry.computeVertexNormals();
                }
                
                // 创建材质
                if (hasGeometryData) {
                    // 尝试创建带纹理的材质
                    if (materialsData.length > 0 && texturesData.length > 0) {
                        // 处理所有纹理路径
                        let texturePaths = [];
                        texturesData.forEach((texture, index) => {
                            let texturePath = '';
                            
                            // 提取纹理路径
                            if (texture.FileName) {
                                texturePath = texture.FileName;
                            } else if (texture.fileName) {
                                texturePath = texture.fileName;
                            }
                            
                            if (texturePath) {
                                // 构建纹理的完整路径
                                const modelDir = selectedModel.path.substring(0, selectedModel.path.lastIndexOf('/'));
                                
                                // 处理不同的路径格式
                                let fullTexturePath = '';
                                if (texturePath.startsWith('..')) {
                                    // 相对路径
                                    fullTexturePath = texturePath;
                                } else if (texturePath.includes('/')) {
                                    // 绝对路径或包含目录的路径
                                    fullTexturePath = modelDir + '/' + texturePath;
                                } else {
                                    // 只文件名
                                    // 尝试多种可能的路径
                                    fullTexturePath = modelDir + '/' + texturePath;
                                }
                                
                                console.log(`纹理 ${index}: ${texturePath} -> ${fullTexturePath}`);
                                texturePaths.push(fullTexturePath);
                                
                                // 添加额外的路径尝试
                                const normalizedTexturePath = texturePath.replace(/\\/g, '/');
                                const fileName = normalizedTexturePath.split('/').pop();
                                if (fileName) {
                                    // 同目录下的文件
                                    const sameDirPath = modelDir + '/' + fileName;
                                    if (!texturePaths.includes(sameDirPath)) {
                                        console.log(`纹理 ${index} 备用路径: ${sameDirPath}`);
                                        texturePaths.push(sameDirPath);
                                    }
                                }
                            }
                        });
                        
                        // 尝试加载第一个纹理
                        if (texturePaths.length > 0) {
                            const firstTexturePath = texturePaths[0];
                            console.log('尝试加载纹理:', firstTexturePath);
                        
                            // 创建纹理加载器
                            const textureLoader = new THREE.TextureLoader();
                        
                            // 尝试加载纹理
                            textureLoader.load(
                                firstTexturePath,
                                (texture) => {
                                    console.log('纹理加载成功:', firstTexturePath);
                                    // 创建带纹理的材质
                                    material = new THREE.MeshStandardMaterial({ 
                                        map: texture,
                                        wireframe: false,
                                        side: THREE.DoubleSide
                                    });
                                    
                                    // 更新模型材质
                                    if (modelMesh) {
                                        modelMesh.material = material;
                                    }
                                },
                                undefined,
                                (error) => {
                                    console.error('纹理加载失败:', error);
                                    // 如果纹理加载失败，使用默认材质
                                    material = new THREE.MeshStandardMaterial({ 
                                        color: 0x2196f3,
                                        wireframe: false,
                                        side: THREE.DoubleSide
                                    });
                                }
                            );
                        }
                    }
                    
                    // 如果材质未创建（纹理加载异步），使用默认材质
                    if (!material) {
                        material = new THREE.MeshStandardMaterial({ 
                            color: 0x2196f3,
                            wireframe: false,
                            side: THREE.DoubleSide
                        });
                    }
                } else {
                    // 如果没有模型数据，使用立方体作为占位符
                    geometry = new THREE.BoxGeometry(1, 1, 1);
                    material = new THREE.MeshStandardMaterial({ 
                        color: 0x2196f3,
                        wireframe: false 
                    });
                }
                
                // 创建网格
                const mesh = new THREE.Mesh(geometry, material);
                
                // 转换动画
                let animations = [];
                if (includeAnimations && sequencesData.length > 0) {
                    console.log('开始转换动画...');
                    animations = convertAnimationsToThreeJS(sequencesData, bonesData);
                    console.log(`动画转换完成: ${animations.length} 个动画`);
                }
                
                // 创建场景
                const exportScene = new THREE.Scene();
                exportScene.add(mesh);
                
                // 使用 GLTFExporter 导出
                const exporter = new THREE.GLTFExporter();
                
                const exportOptions = {
                    trs: true,
                    onlyVisible: true,
                    binary: false,
                    maxTextureSize: 4096
                };
                
                console.log('开始导出GLTF...');
                exporter.parse(
                    exportScene,
                    (gltf) => {
                        console.log('GLTF导出成功!');
                        console.log('导出结果类型:', typeof gltf);
                        
                        // 检查导出结果
                        if (typeof gltf === 'object') {
                            console.log('GLTF对象结构:', {
                                hasAsset: !!gltf.asset,
                                hasScenes: !!gltf.scenes,
                                hasNodes: !!gltf.nodes,
                                hasMeshes: !!gltf.meshes,
                                hasAnimations: !!gltf.animations
                            });
                        }
                        
                        // 处理导出结果
                        if (typeof gltf === 'string') {
                            // 字符串格式的GLTF
                            console.log('GLTF导出为字符串，长度:', gltf.length);
                            
                            // 创建下载链接
                            const blob = new Blob([gltf], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `${selectedModel.name}.gltf`;
                            link.click();
                            
                            // 释放URL
                            setTimeout(() => URL.revokeObjectURL(url), 100);
                            
                        } else if (typeof gltf === 'object') {
                            // 对象格式的GLTF
                            const json = JSON.stringify(gltf);
                            console.log('GLTF导出为对象，JSON长度:', json.length);
                            
                            // 创建下载链接
                            const blob = new Blob([json], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `${selectedModel.name}.gltf`;
                            link.click();
                            
                            // 释放URL
                            setTimeout(() => URL.revokeObjectURL(url), 100);
                        }
                        
                        // 加载到预览场景
                        loadGltfPreview(gltf);
                        
                        // 更新状态
                        showStatus('转换成功完成！', 'success');
                        
                    },
                    (error) => {
                        console.error('GLTF导出失败:', error);
                        showStatus(`导出失败: ${error.message}`, 'error');
                    },
                    exportOptions
                );
                
            } catch (error) {
                console.error('转换过程错误:', error);
                showStatus(`转换失败: ${error.message}`, 'error');
            }
        })
        .catch(error => {
            console.error('加载错误:', error);
            showStatus(`加载失败: ${error.message}`, 'error');
        });
}

// 清空结果信息
function clearResults() {
    document.getElementById('model-vertices').textContent = '-';
    document.getElementById('model-faces').textContent = '-';
    document.getElementById('model-bones').textContent = '-';
    document.getElementById('model-materials').textContent = '-';
    document.getElementById('download-button').disabled = true;
    document.getElementById('threejs-preview-btn').disabled = true;
    document.getElementById('status-message').textContent = '';
    document.getElementById('status-message').className = '';
}

// 清空所有
function clearAll() {
    // 清空选中状态
    document.querySelectorAll('.model-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 重置变量
    selectedModel = null;
    
    // 清空UI
    document.getElementById('selected-model-name').textContent = '未选择';
    document.getElementById('selected-model-path').textContent = '-';
    clearResults();
    
    // 清空预览场景
    if (modelMesh) {
        scene.remove(modelMesh);
        modelMesh = null;
    }
    
    // 清空GLTF预览场景
    if (gltfModel) {
        gltfScene.remove(gltfModel);
        gltfModel = null;
    }
    
    // 重置动画
    gltfAnimations = [];
    gltfMixer = null;
    currentAnimationAction = null;
    isGltfPlaying = false;
    
    // 隐藏动画控制
    document.getElementById('animation-controls').style.display = 'none';
    document.getElementById('anim-info').textContent = '无动画';
    
    showStatus('已清空所有内容', 'info');
}

// 显示状态消息
function showStatus(message, type = 'info', isLoading = false) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type} ${isLoading ? 'loading' : ''}`;
    
    // 3秒后自动清除非错误消息
    if (type !== 'error' && !isLoading) {
        setTimeout(() => {
            if (statusEl.textContent === message) {
                statusEl.textContent = '';
                statusEl.className = 'status-message';
            }
        }, 3000);
    }
}

// 页面加载完成后初始化
window.addEventListener('load', init);