import * as fs from 'fs';
import * as path from 'path';
import { convertMDX2GLTF } from './src/convert/mdx2gltf';

async function batchConvert() {
    console.log('🚀 开始批量转换 MDX 到 GLTF...');
    
    const inputDir = 'src/model';
    const outputDir = 'exports';
    
    // 创建导出目录
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`📁 创建导出目录: ${outputDir}`);
    }
    
    // 递归遍历目录，找到所有 MDX 文件
    const mdxFiles: string[] = [];
    
    function findMDXFiles(dir: string) {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            
            if (file.isDirectory()) {
                findMDXFiles(fullPath);
            } else if (file.isFile() && file.name.toLowerCase().endsWith('.mdx')) {
                mdxFiles.push(fullPath);
            }
        }
    }
    
    findMDXFiles(inputDir);
    console.log(`📦 找到 ${mdxFiles.length} 个 MDX 文件`);
    
    if (mdxFiles.length === 0) {
        console.log('❌ 未找到 MDX 文件');
        return;
    }
    
    // 转换每个 MDX 文件
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < mdxFiles.length; i++) {
        const mdxPath = mdxFiles[i];
        const relativePath = path.relative(inputDir, mdxPath);
        const outputPath = path.join(outputDir, relativePath.replace('.mdx', '.glb').replace(/\\/g, '/'));
        
        console.log(`\n🔄 转换 ${i + 1}/${mdxFiles.length}: ${relativePath}`);
        
        try {
            // 创建输出文件的目录
            const outputFileDir = path.dirname(outputPath);
            if (!fs.existsSync(outputFileDir)) {
                fs.mkdirSync(outputFileDir, { recursive: true });
            }
            
            // 调用转换函数
            await convertMDX2GLTF(mdxPath, outputPath, {
                blpBaseDir: inputDir,
                embedTextures: true,
                exportAnimations: true
            });
            
            console.log(`✅ 转换成功: ${outputPath}`);
            successCount++;
            
        } catch (error) {
            console.error(`❌ 转换失败: ${mdxPath}`);
            console.error(`   错误: ${(error as Error).message}`);
            errorCount++;
        }
    }
    
    console.log(`\n📊 转换完成:`);
    console.log(`   成功: ${successCount}`);
    console.log(`   失败: ${errorCount}`);
    console.log(`   总计: ${mdxFiles.length}`);
    
    if (successCount > 0) {
        console.log(`\n🎉 批量转换完成！导出文件位于: ${outputDir}`);
    }
}

batchConvert().catch((error) => {
    console.error('❌ 批量转换失败:', error);
});
