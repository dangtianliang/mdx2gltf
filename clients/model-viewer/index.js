// 导入ModelViewer
import * as ModelViewer from '../../src/';

// 导入setupCamera函数和SimpleOrbitCamera
import { setupCamera, SimpleOrbitCamera } from '../../clients/shared/camera.js';

const handlers = ModelViewer.viewer.handlers;

// 全局变量
let viewer;
let scene;
let currentModel;
let currentInstance;
let modelData = [];

// 初始化函数
function init() {
    console.log('开始初始化...');
    
    // 创建画布
    const canvas = document.getElementById('canvas');
    console.log('获取画布元素:', canvas);
    
    if (!canvas) {
        console.error('画布元素不存在！');
        return;
    }
    
    canvas.width = 800;
    canvas.height = 600;
    
    // 创建查看器
    console.log('创建ModelViewer...');
    viewer = new ModelViewer.viewer.ModelViewer(canvas);
    console.log('ModelViewer创建成功:', viewer);
    
    // 创建场景
    console.log('创建场景...');
    scene = viewer.addScene();
    console.log('场景创建成功:', scene);
    
    // 使用SimpleOrbitCamera设置相机控制
    console.log('设置相机控制...');
    console.log('setupCamera函数:', setupCamera);
    var camera = setupCamera(scene, {
        moveSpeed: 2,
        rotationSpeed: Math.PI / 180,
        zoomFactor: 0.1,
        horizontalAngle: Math.PI / 2,
        verticalAngle: Math.PI / 4,
        distance: 500
    });
    console.log('相机控制设置成功:', camera);
    
    // 初始化相机位置
    console.log('初始化相机位置...');
    scene.camera.move([0, 0, 500]);
    scene.camera.setRotation([0, 0, 0, 1]);
    console.log('相机位置初始化完成');
    
    // 测试相机控制
    console.log('测试相机控制...');
    console.log('相机对象:', scene.camera);
    console.log('相机位置:', scene.camera.position);
    console.log('相机旋转:', scene.camera.rotation);
    
    // 添加事件监听
    viewer.on('loadstart', (e) => console.log('加载开始:', e));
    viewer.on('load', (e) => console.log('加载完成:', e));
    viewer.on('loadend', (e) => console.log('加载结束:', e));
    viewer.on('error', (e) => console.error('加载错误:', e));
    
    // 添加MDX和BLP处理器
    console.log('添加MDX处理器');
    // 为MDX处理器添加路径解析器
    viewer.addHandler(handlers.mdx, function mdxPathSolver(src) {
        console.log('MDX处理器路径解析器 - 尝试加载资源:', src);
        
        // 检查是否是不需要加载的路径
        if (src.includes('ReplaceableTextures') || src.includes('Splats')) {
            // ReplaceableTextures和Splats文件在当前项目中不存在，返回空字符串
            console.log('MDX处理器路径解析器 - 处理不需要加载的路径:', src);
            console.log('MDX处理器路径解析器 - 文件在当前项目中不存在，跳过加载');
            return '';
        }
        
        // 提取文件名（无论路径结构如何）
        const fileName = src.split('\\').pop().split('/').pop();
        
        // 构建从src/model开始的路径
        // 注意：这里需要根据实际的目录结构构建路径
        // 例如，如果模型在../../src/model/Creeps/Archnathid/Archnathid.mdx
        // 那么纹理应该在../../src/model/Creeps/Archnathid/Archnathid.blp
        
        // 简化处理：直接返回文件名，让浏览器从当前路径解析
        // 或者构建一个相对路径
        console.log('MDX处理器路径解析器 - 处理纹理路径:', src);
        console.log('MDX处理器路径解析器 - 提取文件名:', fileName);
        
        // 对于纹理，我们需要返回一个路径，让浏览器能够找到它
        // 由于模型和纹理在同一个目录中，我们可以直接返回文件名
        return fileName;
    });
    console.log('添加BLP处理器');
    viewer.addHandler(handlers.blp);
    console.log('处理器添加完成');
    
    // 检查处理器是否正确添加
    console.log('当前处理器:', viewer.handlers);
    
    // 初始化模型数据
    initModelData();
    
    // 初始化UI事件
    initUIEvents();
    
    // 开始渲染循环
    startRenderLoop();
}

// 初始化模型数据
function initModelData() {
    // 模型数据 - 按种族分类
    modelData = [
        {
            race: 'Creeps',
            models: [
                { name: 'Archnathid', path: '../../src/model/Creeps/Archnathid/Archnathid.mdx' },
                { name: 'BansheeRanger', path: '../../src/model/Creeps/BansheeRanger/BansheeRanger.mdx' },
                { name: 'Beastmaster', path: '../../src/model/Creeps/Beastmaster/Beastmaster.mdx' },
                { name: 'DireWolf', path: '../../src/model/Creeps/DireWolf/DireWolf.mdx' },
                { name: 'FacelessOne', path: '../../src/model/Creeps/FacelessOne/FacelessOne.mdx' },
                { name: 'ForgottenOne', path: '../../src/model/Creeps/ForgottenOne/ForgottenOne.mdx' },
                { name: 'GrizzlyBear', path: '../../src/model/Creeps/GrizzlyBear/GrizzlyBear.mdx' },
                { name: 'HumanMage', path: '../../src/model/Creeps/HumanMage/HumanMage.mdx' },
                { name: 'Hydra', path: '../../src/model/Creeps/Hydra/Hydra.mdx' },
                { name: 'JungleBeast', path: '../../src/model/Creeps/JungleBeast/JungleBeast.mdx' },
                { name: 'Magnataur', path: '../../src/model/Creeps/Magnataur/Magnataur.mdx' },
                { name: 'Mammoth', path: '../../src/model/Creeps/Mammoth/Mammoth.mdx' },
                { name: 'OrcWarlock', path: '../../src/model/Creeps/OrcWarlock/OrcWarlock.mdx' },
                { name: 'PolarBear', path: '../../src/model/Creeps/PolarBear/PolarBear.mdx' },
                { name: 'QuillBeast', path: '../../src/model/Creeps/QuillBeast/QuillBeast.mdx' },
                { name: 'SeaElemental', path: '../../src/model/Creeps/SeaElemental/SeaElemental.mdx' },
                { name: 'SeaGiant', path: '../../src/model/Creeps/SeaGiant/SeaGiant.mdx' },
                { name: 'SkeletonOrc', path: '../../src/model/Creeps/SkeletonOrc/SkeletonOrc.mdx' },
                { name: 'TimberWolf', path: '../../src/model/Creeps/TimberWolf/TimberWolf.mdx' },
                { name: 'VoidWalker', path: '../../src/model/Creeps/VoidWalker/VoidWalker.mdx' },
                { name: 'WarEagle', path: '../../src/model/Creeps/WarEagle/WarEagle.mdx' },
                { name: 'WhiteWolf', path: '../../src/model/Creeps/WhiteWolf/WhiteWolf.mdx' },
                { name: 'tuskar', path: '../../src/model/Creeps/tuskar/tuskar.mdx' }
            ]
        },
        {
            race: 'Critters',
            models: [
                { name: 'Albatross', path: '../../src/model/Critters/Albatross/Albatross.mdx' },
                { name: 'DuneWorm', path: '../../src/model/Critters/DuneWorm/DuneWorm.mdx' },
                { name: 'Felboar', path: '../../src/model/Critters/Felboar/Felboar.mdx' },
                { name: 'Frog', path: '../../src/model/Critters/Frog/Frog.mdx' },
                { name: 'HermitCrab', path: '../../src/model/Critters/HermitCrab/HermitCrab.mdx' },
                { name: 'PackHorse', path: '../../src/model/Critters/PackHorse/PackHorse.mdx' },
                { name: 'Penguin', path: '../../src/model/Critters/Penguin/Penguin.mdx' },
                { name: 'Sheep', path: '../../src/model/Critters/Sheep/Sheep.mdx' },
                { name: 'Skink', path: '../../src/model/Critters/Skink/Skink.mdx' },
                { name: 'SnowOwl', path: '../../src/model/Critters/SnowOwl/SnowOwl.mdx' },
                { name: 'SpiderCrab', path: '../../src/model/Critters/SpiderCrab/SpiderCrab.mdx' }
            ]
        },
        {
            race: 'Demon',
            models: [
                { name: 'Demoness', path: '../../src/model/Demon/Demoness/Demoness.mdx' },
                { name: 'DemonessBlue', path: '../../src/model/Demon/DemonessBlue/DemonessBlue.mdx' },
                { name: 'EredarWarlock', path: '../../src/model/Demon/EredarWarlock/EredarWarlock.mdx' },
                { name: 'Felgaurd', path: '../../src/model/Demon/Felgaurd/Felgaurd.mdx' },
                { name: 'FelgaurdBlue', path: '../../src/model/Demon/FelgaurdBlue/FelgaurdBlue.mdx' },
                { name: 'HeroPitLord', path: '../../src/model/Demon/HeroPitLord/HeroPitLord.mdx' },
                { name: 'Kiljaeden', path: '../../src/model/Demon/Kiljaeden/Kiljaeden.mdx' },
                { name: 'felhound', path: '../../src/model/Demon/felhound/felhound_V1.mdx' }
            ]
        },
        {
            race: 'Human',
            models: [
                { name: 'Gyrocopter', path: '../../src/model/Human/Gyrocopter/Gyrocopter_V1.mdx' },
                { name: 'HeroBloodElf', path: '../../src/model/Human/HeroBloodElf/HeroBloodElf.mdx' },
                { name: 'Kael', path: '../../src/model/Human/Kael/Kael.mdx' },
                { name: 'Phoenix', path: '../../src/model/Human/Phoenix/Phoenix.mdx' },
                { name: 'Priest', path: '../../src/model/Human/Priest/Priest_V1.mdx' },
                { name: 'Sorceress', path: '../../src/model/Human/Sorceress/Sorceress_V1.mdx' },
                { name: 'WarWagon', path: '../../src/model/Human/WarWagon/WarWagon_V1.mdx' }
            ]
        },
        {
            race: 'Naga',
            models: [
                { name: 'LadyVashj', path: '../../src/model/Naga/LadyVashj/LadyVashj.mdx' },
                { name: 'NagaMyrmidon', path: '../../src/model/Naga/NagaMyrmidon/NagaMyrmidon.mdx' },
                { name: 'NagaRoyalGuard', path: '../../src/model/Naga/NagaRoyalGuard/NagaRoyalGuard.mdx' },
                { name: 'NagaSiren', path: '../../src/model/Naga/NagaSiren/NagaSiren.mdx' },
                { name: 'NagaSummoner', path: '../../src/model/Naga/NagaSummoner/NagaSummoner.mdx' },
                { name: 'SnapDragon', path: '../../src/model/Naga/SnapDragon/SnapDragon.mdx' },
                { name: 'WindSerpent', path: '../../src/model/Naga/WindSerpent/WindSerpent.mdx' }
            ]
        },
        {
            race: 'NightElf',
            models: [
                { name: 'Archer', path: '../../src/model/NightElf/Archer/Archer_Portrait.mdx' },
                { name: 'Ballista', path: '../../src/model/NightElf/Ballista/Ballista_V1.mdx' },
                { name: 'Dryad', path: '../../src/model/NightElf/Dryad/Dryad.mdx' },
                { name: 'EvilIllidan', path: '../../src/model/NightElf/EvilIllidan/IllidanEvil.mdx' },
                { name: 'FaerieDragon', path: '../../src/model/NightElf/FaerieDragon/FaerieDragon.mdx' },
                { name: 'HeroWarden', path: '../../src/model/NightElf/HeroWarden/HeroWarden.mdx' },
                { name: 'Maiev', path: '../../src/model/NightElf/Maiev/Maiev.mdx' },
                { name: 'MalFurion', path: '../../src/model/NightElf/MalFurion/MalFurion.mdx' },
                { name: 'MountainGiant', path: '../../src/model/NightElf/MountainGiant/MountainGiant.mdx' },
                { name: 'Owl', path: '../../src/model/NightElf/Owl/Owl.mdx' },
                { name: 'OwlScout', path: '../../src/model/NightElf/OwlScout/OwlScout.mdx' },
                { name: 'Runner', path: '../../src/model/NightElf/Runner/Runner.mdx' }
            ]
        },
        {
            race: 'Orc',
            models: [
                { name: 'BatTroll', path: '../../src/model/Orc/BatTroll/BatTroll.mdx' },
                { name: 'HeadHunter', path: '../../src/model/Orc/HeadHunter/Headhunter_V1.mdx' },
                { name: 'SpiritWalker', path: '../../src/model/Orc/SpiritWalker/SpiritWalker.mdx' },
                { name: 'SpiritWyvern', path: '../../src/model/Orc/SpiritWyvern/SpiritWyvern.mdx' },
                { name: 'Spiritwolf', path: '../../src/model/Orc/Spiritwolf/Spiritwolf.mdx' },
                { name: 'WatcherWard', path: '../../src/model/Orc/WatcherWard/WatcherWard.mdx' },
                { name: 'catapult', path: '../../src/model/Orc/catapult/catapult_V1.mdx' }
            ]
        },
        {
            race: 'Undead',
            models: [
                { name: 'Anubarak', path: '../../src/model/Undead/Anubarak/Anubarak.mdx' },
                { name: 'CryptFiend', path: '../../src/model/Undead/CryptFiend/CryptFiend.mdx' },
                { name: 'EvilSylvanas', path: '../../src/model/Undead/EvilSylvanas/EvilSylvanas.mdx' },
                { name: 'Gargoyle', path: '../../src/model/Undead/Gargoyle/Gargoyle.mdx' },
                { name: 'HeroCryptLord', path: '../../src/model/Undead/HeroCryptLord/HeroCryptLord.mdx' },
                { name: 'HeroLich', path: '../../src/model/Undead/HeroLich/HeroLich_V1.mdx' },
                { name: 'Locust', path: '../../src/model/Undead/Locust/locust.mdx' },
                { name: 'ObsidianStatue', path: '../../src/model/Undead/ObsidianStatue/ObsidianStatue.mdx' },
                { name: 'Scarab', path: '../../src/model/Undead/Scarab/Scarab.mdx' },
                { name: 'SkeletonMage', path: '../../src/model/Undead/SkeletonMage/SkeletonMage.mdx' },
                { name: 'UndeadAirBarge', path: '../../src/model/Undead/UndeadAirBarge/UndeadAirBarge.mdx' }
            ]
        },
        {
            race: 'Other',
            models: [
                { name: 'BloodElfWagon', path: '../../src/model/Other/BloodElfWagon/BloodElfWagon.mdx' },
                { name: 'DalaranMutant', path: '../../src/model/Other/DalaranMutant/DalaranMutant.mdx' },
                { name: 'DalaranReject', path: '../../src/model/Other/DalaranReject/DalaranReject.mdx' },
                { name: 'Dranai', path: '../../src/model/Other/Dranai/Dranai.mdx' },
                { name: 'DranaiAkama', path: '../../src/model/Other/DranaiAkama/DranaiAkama.mdx' },
                { name: 'DranaiMage', path: '../../src/model/Other/DranaiMage/DranaiMage.mdx' },
                { name: 'DranaiWhite', path: '../../src/model/Other/DranaiWhite/DranaiWhite.mdx' },
                { name: 'FleshGolem', path: '../../src/model/Other/FleshGolem/FleshGolem.mdx' },
                { name: 'IllidanWagon', path: '../../src/model/Other/IllidanWagon/IllidanWagon.mdx' },
                { name: 'Proudmoore', path: '../../src/model/Other/Proudmoore/Proudmoore.mdx' },
                { name: 'Rexxar', path: '../../src/model/Other/Rexxar/Rexxar.mdx' },
                { name: 'TNTBarrel', path: '../../src/model/Other/TNTBarrel/TNTBarrel.mdx' }
            ]
        }
    ];
    
    // 过滤掉非.mdx文件路径
    modelData = modelData.map(raceData => ({
        ...raceData,
        models: raceData.models.filter(model => model.path.endsWith('.mdx'))
    }));
    
    // 生成模型列表
    generateModelList();
    
    // 自动选中第一个模型
    setTimeout(() => {
        if (modelData.length > 0 && modelData[0].models.length > 0) {
            const firstModel = modelData[0].models[0];
            console.log('自动选中第一个模型:', firstModel.name, firstModel.path);
            selectModel(firstModel);
        }
    }, 100);
}

// 生成模型列表
function generateModelList() {
    const raceCategoriesContainer = document.querySelector('.race-categories');
    raceCategoriesContainer.innerHTML = '';
    
    modelData.forEach(raceData => {
        const raceCategory = document.createElement('div');
        raceCategory.className = 'race-category';
        
        const raceHeader = document.createElement('div');
        raceHeader.className = 'race-header';
        raceHeader.innerHTML = `
            <h3>${raceData.race}</h3>
            <span class="toggle">▶</span>
        `;
        
        const modelItems = document.createElement('div');
        modelItems.className = 'model-items';
        
        raceData.models.forEach(model => {
            const modelItem = document.createElement('div');
            modelItem.className = 'model-item';
            modelItem.innerHTML = `
                <div class="model-name">${model.name}</div>
                <div class="model-path">${model.path}</div>
            `;
            
            modelItem.addEventListener('click', () => {
                selectModel(model);
            });
            
            modelItems.appendChild(modelItem);
        });
        
        raceHeader.addEventListener('click', () => {
            raceHeader.classList.toggle('collapsed');
            raceCategory.classList.toggle('collapsed');
        });
        
        raceCategory.appendChild(raceHeader);
        raceCategory.appendChild(modelItems);
        raceCategoriesContainer.appendChild(raceCategory);
    });
}

// 选择模型
function selectModel(model) {
    // 移除之前的选中状态
    document.querySelectorAll('.model-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 添加选中状态
    const modelItems = document.querySelectorAll('.model-item');
    modelItems.forEach(item => {
        if (item.querySelector('.model-path').textContent === model.path) {
            item.classList.add('selected');
        }
    });
    
    // 更新模型信息
    document.getElementById('model-name').textContent = model.name;
    document.getElementById('model-details').textContent = `路径: ${model.path}`;
    
    // 加载模型
    loadModel(model);
}

// 加载模型
function loadModel(model) {
    // 更彻底的清理：重新初始化整个ModelViewer实例
    // 这样可以确保每次加载模型时都是一个干净的环境，避免模型叠加
    console.log('开始重新初始化ModelViewer...');
    
    // 清理之前的实例
    if (viewer) {
        // 卸载所有模型
        if (currentModel) {
            viewer.unload(currentModel);
            currentModel = null;
            currentInstance = null;
        }
        
        // 移除所有场景
        viewer.removeScene(scene);
    }
    
    // 重新创建画布（确保大小正确）
    const canvas = document.getElementById('canvas');
    canvas.width = 800;
    canvas.height = 600;
    
    // 重新创建ModelViewer实例
    viewer = new ModelViewer.viewer.ModelViewer(canvas);
    
    // 重新创建场景
    scene = viewer.addScene();
    
    // 重新设置相机控制
    var camera = setupCamera(scene, {
        moveSpeed: 2,
        rotationSpeed: Math.PI / 180,
        zoomFactor: 0.1,
        horizontalAngle: Math.PI / 2,
        verticalAngle: Math.PI / 4,
        distance: 500
    });
    
    // 初始化相机位置
    scene.camera.move([0, 0, 500]);
    scene.camera.setRotation([0, 0, 0, 1]);
    
    // 重新添加事件监听
    viewer.on('loadstart', (e) => console.log('加载开始:', e));
    viewer.on('load', (e) => console.log('加载完成:', e));
    viewer.on('loadend', (e) => console.log('加载结束:', e));
    viewer.on('error', (e) => console.error('加载错误:', e));
    
    // 重新添加MDX和BLP处理器
    console.log('重新添加MDX处理器');
    viewer.addHandler(handlers.mdx);
    console.log('重新添加BLP处理器');
    viewer.addHandler(handlers.blp);
    console.log('处理器添加完成');
    
    console.log('ModelViewer重新初始化完成，准备加载新模型:', model.name);
    
    // 显示加载动画
    const canvasContainer = document.querySelector('.canvas-container');
    const loadingElement = document.createElement('div');
    loadingElement.className = 'loading';
    loadingElement.textContent = '加载中...';
    canvasContainer.appendChild(loadingElement);
    
    // 路径解析器 - 最终版（最健壮的实现）
    function pathSolver(src) {
        console.log('尝试加载资源:', src);
        
        // 检查src是否已经是完整路径
        if (src.startsWith('http://') || src.startsWith('https://')) {
            console.log('使用完整URL:', src);
            return src;
        }
        
        // 处理模型路径
        if (src.endsWith('.mdx')) {
            console.log('加载模型:', src);
            return src;
        }
        
        // 处理纹理路径和其他资源路径
        else {
            // 对于纹理和其他资源，使用模型所在的目录作为基础路径
            // 同时处理正斜杠和反斜杠
            const lastSlashIndex = Math.max(model.path.lastIndexOf('/'), model.path.lastIndexOf('\\'));
            const modelDir = model.path.substring(0, lastSlashIndex);
            
            // 检查是否是不需要加载的路径
            if (src.includes('ReplaceableTextures') || src.includes('Splats')) {
                // ReplaceableTextures和Splats文件在当前项目中不存在，返回空字符串
                console.log('处理不需要加载的路径:', src);
                console.log('文件在当前项目中不存在，跳过加载');
                return '';
            }
            
            // 提取文件名（无论路径结构如何）
            const fileName = src.split('\\').pop().split('/').pop();
            
            // 构建从模型目录开始的路径
            const fullPath = modelDir + '/' + fileName;
            console.log('处理纹理路径:', src);
            console.log('提取文件名:', fileName);
            console.log('构建正确路径:', fullPath);
            
            // 测试路径是否存在
            console.log('测试路径是否存在 - 模型目录:', modelDir);
            console.log('测试路径是否存在 - 文件名:', fileName);
            console.log('测试路径是否存在 - 完整路径:', fullPath);
            
            return fullPath;
        }
    }
    
    // 测试路径解析器
    console.log('路径解析器测试 - 模型目录:', model.path.substring(0, model.path.lastIndexOf('/')));
    console.log('路径解析器测试 - 处理MDX引用路径:', pathSolver('units\\Orc\\Spiritwolf\\FeralSpirit.blp'));
    console.log('路径解析器测试 - 处理直接文件名:', pathSolver('FeralSpirit.blp'));
    
    // 检查路径解析器
    console.log('路径解析器创建完成');
    console.log('测试路径解析:', pathSolver('test.blp'));
    
    // 加载模型
    console.log('开始加载模型:', model.name, '路径:', model.path);
    console.log('模型目录:', model.path.substring(0, model.path.lastIndexOf('/')));
    
    // 尝试直接加载纹理文件，验证纹理文件是否存在
    const textureFileName = model.path.substring(model.path.lastIndexOf('/') + 1, model.path.lastIndexOf('.')) + '.blp';
    const texturePath = model.path.substring(0, model.path.lastIndexOf('/')) + '/' + textureFileName;
    console.log('尝试加载的纹理文件:', texturePath);
    
    // 加载模型
    console.log('开始使用路径解析器加载模型:', model.path);
    console.log('路径解析器函数:', pathSolver.toString());
    
    // 测试路径解析器
    const testPath = 'units/Creeps/Archnathid/Arachnathid.blp';
    console.log('测试路径解析器 - 输入:', testPath);
    console.log('测试路径解析器 - 输出:', pathSolver(testPath));
    
    const modelPromise = viewer.load(model.path, pathSolver);
    
    modelPromise.then((loadedModel) => {
        // 移除加载动画
        if (loadingElement) {
            loadingElement.remove();
        }
        
        if (loadedModel) {
            currentModel = loadedModel;
            
            // 创建模型实例
            currentInstance = currentModel.addInstance();
            currentInstance.setScene(scene);
            
            // 设置默认动画
            currentInstance.setSequence(0);
            currentInstance.setSequenceLoopMode(2);
            
            // 更新动画选择
            updateAnimationSelect();
            
            // 检查模型的纹理信息
            console.log('模型加载成功:', model.name);
            console.log('模型纹理数量:', currentModel.textures ? currentModel.textures.length : 0);
            if (currentModel.textures) {
                currentModel.textures.forEach((texture, index) => {
                    console.log(`纹理 ${index}:`, texture.name, texture.path);
                });
            }
            
            document.getElementById('model-details').textContent = `路径: ${model.path}\n加载成功: ${model.name}\n纹理数量: ${currentModel.textures ? currentModel.textures.length : 0}`;
        } else {
            console.error('模型加载失败:', model.name);
            document.getElementById('model-details').textContent = '模型加载失败，请检查控制台错误信息';
            
            // 显示错误提示
            showError('模型加载失败', '无法加载模型文件，请检查文件路径是否正确。');
        }
    }).catch(error => {
        // 移除加载动画
        if (loadingElement) {
            loadingElement.remove();
        }
        
        console.error('模型加载错误:', error);
        document.getElementById('model-details').textContent = `模型加载错误: ${error.message}`;
        
        // 显示错误提示
        showError('模型加载错误', error.message);
    });
}

// 更新动画选择
function updateAnimationSelect() {
    const animationSelect = document.getElementById('animation-select');
    animationSelect.innerHTML = '<option value="-1">无动画</option>';
    
    if (currentModel && currentModel.sequences) {
        currentModel.sequences.forEach((sequence, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = sequence.name || `动画 ${index}`;
            animationSelect.appendChild(option);
        });
    }
}

// 初始化UI事件
function initUIEvents() {
    // 动画选择
    document.getElementById('animation-select').addEventListener('change', (e) => {
        if (currentInstance) {
            const sequenceIndex = parseInt(e.target.value);
            currentInstance.setSequence(sequenceIndex);
        }
    });
    
    // 放大
    document.getElementById('zoom-in').addEventListener('click', () => {
        if (scene) {
            scene.camera.move([0, 0, -50]);
        }
    });
    
    // 缩小
    document.getElementById('zoom-out').addEventListener('click', () => {
        if (scene) {
            scene.camera.move([0, 0, 50]);
        }
    });
    
    // 重置视角
    document.getElementById('reset-view').addEventListener('click', () => {
        if (scene) {
            setupCamera(scene);
        }
    });
    
    // 鼠标交互已经由SimpleOrbitCamera处理
    // 它提供了以下功能：
    // - 左键拖动：旋转视角
    // - 右键拖动：平移相机
    // - 滚轮：缩放视角
    // - 自动处理相机的旋转、平移和缩放
    console.log('鼠标交互功能已启用：');
    console.log('- 左键拖动：旋转视角');
    console.log('- 右键拖动：平移相机');
    console.log('- 滚轮：缩放视角');
}

// 开始渲染循环
function startRenderLoop() {
    function render() {
        requestAnimationFrame(render);
        
        if (viewer) {
            // 相机控制在事件触发时自动更新，不需要在渲染循环中更新
            viewer.updateAndRender();
        }
    }
    
    render();
}

// 显示错误提示
function showError(title, message) {
    // 创建错误提示元素
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.innerHTML = `
        <div class="error-header">${title}</div>
        <div class="error-body">${message}</div>
        <button class="error-close">关闭</button>
    `;
    
    // 添加样式
    errorElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        padding: 15px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        z-index: 1000;
        max-width: 400px;
        font-family: Arial, sans-serif;
    `;
    
    // 添加关闭按钮事件
    const closeButton = errorElement.querySelector('.error-close');
    closeButton.style.cssText = `
        margin-top: 10px;
        padding: 5px 10px;
        background-color: #dc3545;
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
    `;
    closeButton.addEventListener('click', () => {
        errorElement.remove();
    });
    
    // 添加到页面
    document.body.appendChild(errorElement);
    
    // 3秒后自动关闭
    setTimeout(() => {
        if (errorElement.parentNode) {
            errorElement.remove();
        }
    }, 5000);
}

// 初始化
window.addEventListener('DOMContentLoaded', init);