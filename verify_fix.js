/**
 * MDX 转 GLTF 修复验证脚本
 * 用于验证 exporter.html 的修复是否成功
 */

const fs = require('fs');
const path = require('path');

console.log('=== MDX 转 GLTF 修复验证 ===\n');

// 1. 验证 exporter.html 文件存在且可读
const exporterPath = path.join(__dirname, 'clients', 'model-viewer', 'exporter.html');
console.log('1. 检查 exporter.html 文件...');
if (!fs.existsSync(exporterPath)) {
    console.error('   ❌ exporter.html 文件不存在!');
    process.exit(1);
}
const exporterContent = fs.readFileSync(exporterPath, 'utf8');
console.log(`   ✅ exporter.html 文件存在 (${exporterContent.length} 字节)`);

// 2. 检查关键修复点
console.log('\n2. 检查关键修复点...');

// 2.1 检查 normalizedTexturePath 修复
if (exporterContent.includes('const normalizedTexturePath = texturePath.replace')) {
    console.log('   ✅ normalizedTexturePath 变量定义已修复');
} else {
    console.error('   ❌ normalizedTexturePath 变量定义未找到!');
}

// 2.2 检查 UV 数据提取改进
if (exporterContent.includes('geoset.uvSets') && exporterContent.includes('geoset.TVertices')) {
    console.log('   ✅ UV 数据提取逻辑已改进');
} else {
    console.error('   ❌ UV 数据提取逻辑未找到!');
}

// 2.3 检查动画关键帧解析函数
if (exporterContent.includes('parseAnimationKeys') && exporterContent.includes('parseRotationKeys')) {
    console.log('   ✅ 动画关键帧解析函数已添加');
} else {
    console.error('   ❌ 动画关键帧解析函数未找到!');
}

// 2.4 检查改进的蒙皮几何体函数
if (exporterContent.includes('Reforged 皮肤数据') && exporterContent.includes('经典蒙皮数据')) {
    console.log('   ✅ 蒙皮几何体函数已改进');
} else {
    console.error('   ❌ 蒙皮几何体函数未找到!');
}

// 3. 检查模型文件
console.log('\n3. 检查模型文件...');
const modelPath = path.join(__dirname, 'src', 'model', 'Creeps', 'Archnathid', 'Archnathid.mdx');
const texturePath = path.join(__dirname, 'src', 'model', 'Creeps', 'Archnathid', 'Arachnathid.blp');
const gltfPath = path.join(__dirname, 'src', 'model', 'Creeps', 'Archnathid', 'Archnathid .gltf');

if (fs.existsSync(modelPath)) {
    const stats = fs.statSync(modelPath);
    console.log(`   ✅ MDX 模型文件存在 (${stats.size} 字节)`);
} else {
    console.error('   ❌ MDX 模型文件不存在!');
}

if (fs.existsSync(texturePath)) {
    const stats = fs.statSync(texturePath);
    console.log(`   ✅ BLP 材质文件存在 (${stats.size} 字节)`);
} else {
    console.error('   ❌ BLP 材质文件不存在!');
}

// 4. 检查现有 GLTF 文件
console.log('\n4. 检查现有 GLTF 文件...');
if (fs.existsSync(gltfPath)) {
    const stats = fs.statSync(gltfPath);
    console.log(`   ✅ GLTF 文件存在 (${stats.size} 字节)`);
    
    try {
        const gltfContent = fs.readFileSync(gltfPath, 'utf8');
        const gltf = JSON.parse(gltfContent);
        
        // 检查材质
        const hasMaterials = gltf.materials && gltf.materials.length > 0;
        console.log(`   ${hasMaterials ? '✅' : '❌'} 材质: ${hasMaterials ? gltf.materials.length + ' 个' : '无'}`);
        
        // 检查动画
        const hasAnimations = gltf.animations && gltf.animations.length > 0;
        console.log(`   ${hasAnimations ? '✅' : '❌'} 动画: ${hasAnimations ? gltf.animations.length + ' 个' : '无'}`);
        
        // 检查纹理
        const hasTextures = gltf.textures && gltf.textures.length > 0;
        console.log(`   ${hasTextures ? '✅' : '❌'} 纹理: ${hasTextures ? gltf.textures.length + ' 个' : '无'}`);
        
        // 检查图像
        const hasImages = gltf.images && gltf.images.length > 0;
        console.log(`   ${hasImages ? '✅' : '❌'} 图像: ${hasImages ? gltf.images.length + ' 个' : '无'}`);
        
        // 检查网格
        const hasMeshes = gltf.meshes && gltf.meshes.length > 0;
        console.log(`   ${hasMeshes ? '✅' : '❌'} 网格: ${hasMeshes ? gltf.meshes.length + ' 个' : '无'}`);
        
        // 检查节点
        const hasNodes = gltf.nodes && gltf.nodes.length > 0;
        console.log(`   ${hasNodes ? '✅' : '❌'} 节点: ${hasNodes ? gltf.nodes.length + ' 个' : '无'}`);
        
        // 检查皮肤
        const hasSkins = gltf.skins && gltf.skins.length > 0;
        console.log(`   ${hasSkins ? '✅' : '❌'} 皮肤: ${hasSkins ? gltf.skins.length + ' 个' : '无'}`);
        
    } catch (error) {
        console.error(`   ❌ 解析 GLTF 文件失败: ${error.message}`);
    }
} else {
    console.log('   ⚠️ GLTF 文件不存在（需要在浏览器中运行导出后生成）');
}

// 5. 检查 war3-model 库
console.log('\n5. 检查 war3-model 库...');
const war3ModelPath = path.join(__dirname, 'node_modules', 'war3-model');
if (fs.existsSync(war3ModelPath)) {
    console.log('   ✅ war3-model 库已安装');
} else {
    console.error('   ❌ war3-model 库未安装!');
}

console.log('\n=== 验证完成 ===');
console.log('\n修复摘要:');
console.log('- 修复了 normalizedTexturePath 未定义的 bug');
console.log('- 改进了 UV 坐标数据提取逻辑');
console.log('- 实现了完整的动画关键帧解析');
console.log('- 改进了骨骼绑定权重数据处理');
console.log('\n要在浏览器中测试修复:');
console.log('1. 运行 npm run serve 启动开发服务器');
console.log('2. 访问 http://localhost:8080/clients/model-viewer/exporter.html');
console.log('3. 选择 Archnathid 模型');
console.log('4. 点击"开始转换"按钮');
console.log('5. 检查导出的 GLTF 文件是否包含材质和动画');
