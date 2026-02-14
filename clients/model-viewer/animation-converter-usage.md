# MDX到GLTF动画转换器使用指南

## 概述

新的MDX动画转换器完全重构了原有的动画处理逻辑，支持：

- **完整的动画数据源**：Bones、Helpers、Attachments、ParticleEmitters2
- **正确的Hermite/Bezier插值**：不再是简单的线性采样
- **层级动画传递**：父子节点动画继承机制
- **几何体透明度动画**：GeosetAnims支持
- **粒子系统动画**：粒子发射器的位置和可见性动画

## 快速开始

### 1. 引入转换器

```html
<script src="mdx-animation-converter.js"></script>
```

### 2. 基本使用

```javascript
// 假设你已经加载了MDX数据
const mdxData = loadMdxData(); // 你的MDX数据

// 使用新的转换器
const gltfAnimations = convertMdxToGltfAnimations(mdxData);

// 转换为Three.js AnimationClip
const threeAnimations = gltfAnimations.map(gltfAnim => {
    const tracks = [];
    
    gltfAnim.tracks.forEach(track => {
        const { name, type, times, values } = track;
        
        if (type === 'VEC3') {
            if (name.includes('.translation')) {
                tracks.push(new THREE.VectorKeyframeTrack(name, times, values));
            } else if (name.includes('.scale')) {
                tracks.push(new THREE.VectorKeyframeTrack(name, times, values));
            }
        } else if (type === 'VEC4' && name.includes('.rotation')) {
            tracks.push(new THREE.QuaternionKeyframeTrack(name, times, values));
        } else if (type === 'SCALAR') {
            tracks.push(new THREE.NumberKeyframeTrack(name, times, values));
        }
    });
    
    return new THREE.AnimationClip(gltfAnim.name, gltfAnim.duration, tracks);
});
```

### 3. 高级用法

#### 单独使用各个组件

```javascript
// 创建动画提取器
const extractor = new MdxAnimationExtractor(mdxData);

// 获取特定序列的动画节点
const sequence = mdxData.Sequences[0];
const animatedNodes = extractor.getAnimatedNodesForSequence(sequence);

// 创建关键帧解析器
const parser = new MdxKeyframeParser();

// 解析特定动画数据
const translationData = parser.parseKeyframes(
    bone.Translation, 
    startFrame, 
    endFrame, 
    3  // 向量大小
);

// 创建插值计算器
const interpolator = new MdxInterpolationCalculator();

// 处理Hermite插值
if (translationData.interpolationType === 2) {
    const interpolated = interpolator.interpolateHermite(
        translationData.keyframes, 
        3
    );
}

// 创建GLTF动画生成器
const generator = new GltfAnimationGenerator();

// 生成GLTF动画
const gltfAnimation = generator.convertAnimation(
    sequence, 
    animatedNodes, 
    extractor
);
```

## 数据格式说明

### GLTF动画格式

```javascript
{
    name: "Stand",           // 动画名称
    duration: 50.0,          // 持续时间（秒）
    tracks: [                // 动画轨道数组
        {
            name: "Bone_0.translation",    // 轨道名称
            type: "VEC3",                   // 数据类型
            times: [0, 0.5, 1.0, ...],      // 时间数组
            values: [x1, y1, z1, x2, y2, z2, ...]  // 值数组
        },
        {
            name: "Bone_0.rotation", 
            type: "VEC4",                    // 四元数
            times: [0, 0.5, 1.0, ...],
            values: [x1, y1, z1, w1, x2, y2, z2, w2, ...]
        }
    ]
}
```

### 支持的动画类型

1. **位置动画** (VEC3)
   - Bones.Translation
   - Helpers.Translation
   - ParticleEmitters2.Translation

2. **旋转动画** (VEC4 - 四元数)
   - Bones.Rotation
   - Helpers.Rotation

3. **缩放动画** (VEC3)
   - Bones.Scaling
   - Helpers.Scaling

4. **可见性动画** (SCALAR)
   - Attachments.Visibility
   - ParticleEmitters2.Visibility

5. **透明度动画** (SCALAR)
   - GeosetAnims.Alpha

## 测试工具

我们提供了一个测试工具 `test-animation-converter.html`，可以：

- 加载MDX测试数据
- 测试动画转换功能
- 验证插值算法
- 预览转换结果

使用方法：

1. 在浏览器中打开 `test-animation-converter.html`
2. 点击"加载测试数据"按钮
3. 点击"测试动画转换"按钮
4. 查看转换结果和统计信息

## 性能优化建议

1. **缓存转换结果**：对于相同的MDX数据，缓存转换后的动画
2. **按需转换**：只转换需要的动画序列，而不是全部
3. **并行处理**：对于大量动画，可以考虑使用Web Workers
4. **压缩数据**：传输前压缩GLTF动画数据

## 错误处理

新的转换器包含了完善的错误处理机制：

```javascript
try {
    const gltfAnimations = convertMdxToGltfAnimations(mdxData);
    // 处理转换结果
} catch (error) {
    console.error('动画转换失败:', error);
    // 回退到旧转换器或其他处理
}
```

## 与旧版本对比

| 功能 | 旧转换器 | 新转换器 |
|------|----------|----------|
| Bones动画 | ✓ | ✓ |
| Helpers动画 | ✗ | ✓ |
| Attachments动画 | ✗ | ✓ |
| ParticleEmitters2动画 | ✗ | ✓ |
| GeosetAnims透明度 | ✗ | ✓ |
| Hermite插值 | 简化线性 | 正确实现 |
| Bezier插值 | 简化线性 | 正确实现 |
| 层级动画传递 | 部分支持 | 完整支持 |
| 错误处理 | 基础 | 完善 |

## 集成到现有项目

要将新的转换器集成到现有的 `exporter.html` 中，我们已经做了以下修改：

1. 添加了脚本引用
2. 替换了动画转换逻辑
3. 添加了回退机制
4. 增加了详细的日志记录

新的集成会自动处理动画转换，无需修改其他代码。

## 后续改进计划

1. **性能优化**：进一步优化插值计算性能
2. **更多插值类型**：支持更多MDX插值类型
3. **动画压缩**：添加动画数据压缩功能
4. **Web Workers**：支持后台转换
5. **可视化调试**：添加动画可视化调试工具

## 技术支持

如遇到问题，请检查：

1. MDX数据格式是否正确
2. 浏览器控制台是否有错误信息
3. 测试工具是否能正常工作
4. 是否使用了支持的动画类型

可以通过测试工具逐步调试，定位问题所在。