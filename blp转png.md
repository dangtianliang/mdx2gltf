 好的，以下是**纯 Node.js 版本的 BLP 转 PNG 工具**，已经针对你的 War3 模型处理场景优化：

```javascript
#!/usr/bin/env node
/**
 * BLP 转 PNG 转换器 (Node.js 纯命令行版)
 * 用途: 批量转换 Warcraft 3 模型纹理
 * 
 * 安装依赖:
 * npm install canvas war3-model glob
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, ImageData } = require('canvas');
const glob = require('glob');

// 尝试加载 war3-model 库
let war3model;
try {
    war3model = require('war3-model');
} catch (e) {
    console.error('❌ 请先安装 war3-model: npm install war3-model');
    process.exit(1);
}

class BlpToPngConverter {
    constructor(options = {}) {
        this.options = {
            quality: 0.95,           // PNG 压缩质量 (0-1)
            overwrite: false,        // 是否覆盖已存在的 PNG
            preserveStructure: true, // 是否保持目录结构
            verbose: true,           // 是否打印详细日志
            ...options
        };
        
        this.stats = {
            success: 0,
            failed: 0,
            skipped: 0,
            total: 0
        };
    }

    /**
     * 核心转换: BLP Buffer -> PNG Buffer
     */
    convertBuffer(blpBuffer) {
        // 1. 解码 BLP
        const blpTexture = war3model.decodeBLP(blpBuffer);
        
        if (!blpTexture || !blpTexture.width || !blpTexture.height) {
            throw new Error('BLP 解码失败: 无效的纹理数据');
        }

        // 补全 size 属性 (war3-model 库的 hack)
        if (!blpTexture.size) {
            blpTexture.size = blpTexture.width * blpTexture.height * 4;
        }

        // 2. 获取 RGBA 像素数据
        const rawData = war3model.getBLPImageData(blpTexture, 0); // mipmap 0
        
        if (!rawData || rawData.length === 0) {
            throw new Error('获取图像数据失败');
        }

        // 3. 创建 Canvas 并写入像素
        const canvas = createCanvas(blpTexture.width, blpTexture.height);
        const ctx = canvas.getContext('2d');

        // 处理数据格式 (可能是数组或 ImageData-like 对象)
        const pixelArray = rawData.data || rawData;
        
        // 创建 ImageData (需要 Uint8ClampedArray)
        const imageData = new ImageData(
            new Uint8ClampedArray(pixelArray),
            blpTexture.width,
            blpTexture.height
        );

        ctx.putImageData(imageData, 0, 0);

        // 4. 导出 PNG Buffer
        return canvas.toBuffer('image/png', {
            compressionLevel: 6,  // PNG 压缩级别 (0-9)
            filters: canvas.PNG_ALL_FILTERS
        });
    }

    /**
     * 转换单个文件
     */
    convertFile(inputPath, outputPath = null) {
        const startTime = Date.now();
        this.stats.total++;

        try {
            // 确定输出路径
            if (!outputPath) {
                outputPath = inputPath.replace(/\.blp$/i, '.png');
            }

            // 检查是否已存在
            if (!this.options.overwrite && fs.existsSync(outputPath)) {
                this.stats.skipped++;
                if (this.options.verbose) {
                    console.log(`⏭️  跳过 (已存在): ${path.basename(outputPath)}`);
                }
                return { success: true, skipped: true, outputPath };
            }

            // 读取 BLP
            const blpBuffer = fs.readFileSync(inputPath);
            if (blpBuffer.length === 0) {
                throw new Error('BLP 文件为空');
            }

            // 转换
            const pngBuffer = this.convertBuffer(blpBuffer);

            // 确保输出目录存在
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // 写入 PNG
            fs.writeFileSync(outputPath, pngBuffer);

            const duration = Date.now() - startTime;
            this.stats.success++;

            if (this.options.verbose) {
                const sizeInfo = `${(blpBuffer.length/1024).toFixed(1)}KB -> ${(pngBuffer.length/1024).toFixed(1)}KB`;
                console.log(`✅ ${path.basename(inputPath)} -> ${path.basename(outputPath)} (${sizeInfo}, ${duration}ms)`);
            }

            return { 
                success: true, 
                outputPath, 
                inputSize: blpBuffer.length,
                outputSize: pngBuffer.length,
                duration 
            };

        } catch (error) {
            this.stats.failed++;
            console.error(`❌ 失败: ${path.basename(inputPath)} - ${error.message}`);
            return { success: false, error: error.message, inputPath };
        }
    }

    /**
     * 批量转换目录
     */
    convertDirectory(inputDir, outputDir = null, pattern = '**/*.blp') {
        console.log(`\n🔍 扫描目录: ${inputDir}`);
        
        // 查找所有 BLP 文件
        const blpFiles = glob.sync(pattern, {
            cwd: inputDir,
            absolute: true,
            nocase: true  // 忽略大小写 (War3 有时是 .BLP)
        });

        if (blpFiles.length === 0) {
            console.log('⚠️  未找到 BLP 文件');
            return [];
        }

        console.log(`📦 找到 ${blpFiles.length} 个 BLP 文件\n`);

        const results = [];
        
        for (const [index, blpPath] of blpFiles.entries()) {
            // 计算输出路径
            let outPath;
            if (outputDir) {
                if (this.options.preserveStructure) {
                    // 保持相对目录结构
                    const relativePath = path.relative(inputDir, blpPath);
                    outPath = path.join(outputDir, relativePath.replace(/\.blp$/i, '.png'));
                } else {
                    // 平铺到输出目录
                    outPath = path.join(outputDir, path.basename(blpPath, '.blp') + '.png');
                }
            } else {
                // 同目录输出
                outPath = null;
            }

            // 显示进度
            if (this.options.verbose) {
                process.stdout.write(`[${index + 1}/${blpFiles.length}] `);
            }

            const result = this.convertFile(blpPath, outPath);
            results.push(result);
        }

        this.printSummary();
        return results;
    }

    /**
     * 转换 War3 模型目录 (自动查找模型同目录下的 BLP)
     */
    convertModelDirectory(modelDir) {
        console.log(`\n🎮 处理 War3 模型目录: ${modelDir}`);
        
        // War3 模型目录结构: ModelName/ModelName.mdx + textures/*.blp
        const results = [];

        // 1. 转换模型目录下的所有 BLP (包括子目录)
        const dirResult = this.convertDirectory(modelDir, null, '**/*.blp');
        results.push(...dirResult);

        // 2. 如果没有任何纹理，尝试查找引用
        if (this.stats.total === 0) {
            console.log('⚠️  未找到 BLP 文件，尝试解析 MDX 查找纹理引用...');
            // 这里可以扩展: 解析 MDX 获取纹理路径，然后下载/转换
        }

        return results;
    }

    /**
     * 打印统计摘要
     */
    printSummary() {
        console.log(`\n═══════════════════════════════════════`);
        console.log('📊 转换完成统计');
        console.log(`═══════════════════════════════════════`);
        console.log(`   成功: ${this.stats.success}`);
        console.log(`   失败: ${this.stats.failed}`);
        console.log(`   跳过: ${this.stats.skipped}`);
        console.log(`   总计: ${this.stats.total}`);
        console.log(`═══════════════════════════════════════`);
    }

    /**
     * 重置统计
     */
    resetStats() {
        this.stats = { success: 0, failed: 0, skipped: 0, total: 0 };
    }
}

// ==================== CLI 命令行接口 ====================

function printUsage() {
    console.log(`
用法: node blp-converter.js <命令> [选项]

命令:
  convert <input.blp> [output.png]     转换单个文件
  batch <input-dir> [output-dir]       批量转换目录
  model <model-directory>              转换 War3 模型目录

选项:
  --overwrite      覆盖已存在的 PNG 文件
  --flat           平铺输出 (不保持目录结构)
  --quiet          静默模式 (减少输出)

示例:
  # 转换单个文件
  node blp-converter.js convert ./Archnathid.blp ./Archnathid.png

  # 批量转换 (保持目录结构)
  node blp-converter.js batch ./Creeps ./output/Creeps

  # 批量转换 (平铺到同一目录)
  node blp-converter.js batch ./Creeps ./output --flat

  # 转换整个模型目录
  node blp-converter.js model ./src/model/Creeps/Archnathid
`);
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        printUsage();
        process.exit(0);
    }

    const command = args[0];
    const options = {
        overwrite: args.includes('--overwrite'),
        preserveStructure: !args.includes('--flat'),
        verbose: !args.includes('--quiet')
    };

    const converter = new BlpToPngConverter(options);

    switch (command) {
        case 'convert': {
            const inputFile = args[1];
            const outputFile = args[2] || null;
            
            if (!inputFile) {
                console.error('❌ 请指定输入文件');
                process.exit(1);
            }
            
            if (!fs.existsSync(inputFile)) {
                console.error(`❌ 文件不存在: ${inputFile}`);
                process.exit(1);
            }

            const result = converter.convertFile(inputFile, outputFile);
            process.exit(result.success ? 0 : 1);
            break;
        }

        case 'batch': {
            const inputDir = args[1];
            const outputDir = args[2] || null;

            if (!inputDir) {
                console.error('❌ 请指定输入目录');
                process.exit(1);
            }

            if (!fs.existsSync(inputDir)) {
                console.error(`❌ 目录不存在: ${inputDir}`);
                process.exit(1);
            }

            converter.convertDirectory(inputDir, outputDir);
            break;
        }

        case 'model': {
            const modelDir = args[1];
            
            if (!modelDir) {
                console.error('❌ 请指定模型目录');
                process.exit(1);
            }

            converter.convertModelDirectory(modelDir);
            break;
        }

        default:
            console.error(`❌ 未知命令: ${command}`);
            printUsage();
            process.exit(1);
    }
}

// 如果是直接运行此文件
if (require.main === module) {
    main();
}

// 导出类供其他模块使用
module.exports = { BlpToPngConverter };
```

---

## 快速开始

```bash
# 1. 安装依赖
npm install canvas war3-model glob

# 2. 转换单个 BLP 文件
node blp-converter.js convert ./Archnathid.blp ./Archnathid.png

# 3. 批量转换整个种族目录 (保持结构)
node blp-converter.js batch ./src/model/Creeps ./output/Creeps

# 4. 批量转换 (平铺输出，不保持子目录)
node blp-converter.js batch ./src/model/Creeps ./output --flat

# 5. 转换特定模型目录
node blp-converter.js model ./src/model/Creeps/Archnathid
```

---

## 作为模块导入使用

```javascript
const { BlpToPngConverter } = require('./blp-converter');

// 初始化
const converter = new BlpToPngConverter({
    overwrite: false,      // 不覆盖已存在文件
    preserveStructure: true, // 保持目录结构
    verbose: true          // 打印详细日志
});

// 1. 转换单个文件
const result = converter.convertFile(
    './src/model/Creeps/Archnathid/Archnathid.blp',
    './output/Archnathid.png'
);

// 2. 批量转换目录
const results = converter.convertDirectory(
    './src/model/Creeps',
    './output/Creeps'
);

// 3. 直接转换 Buffer (内存操作，不读写文件)
const blpBuffer = fs.readFileSync('./texture.blp');
const pngBuffer = converter.convertBuffer(blpBuffer);
fs.writeFileSync('./texture.png', pngBuffer);
```

---

## 输出示例

```
🔍 扫描目录: ./src/model/Creeps
📦 找到 42 个 BLP 文件

[1/42] ✅ Archnathid.blp -> Archnathid.png (45.2KB -> 128.5KB, 23ms)
[2/42] ✅ Archnathid_Range.blp -> Archnathid_Range.png (32.1KB -> 89.3KB, 19ms)
[3/42] ⏭️  跳过 (已存在): BansheeRanger.png
...
[42/42] ✅ WhiteWolf.blp -> WhiteWolf.png (28.7KB -> 76.1KB, 21ms)

═══════════════════════════════════════
📊 转换完成统计
═══════════════════════════════════════
   成功: 40
   失败: 0
   跳过: 2
   总计: 42
═══════════════════════════════════════
```

需要我添加 **MDX 纹理引用解析** (自动从 MDX 文件里找出引用了哪些 BLP) 的功能吗？这样可以直接输入 MDX 文件，自动转换它依赖的所有纹理。