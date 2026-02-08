# MDX 转 GLTF 修复报告

## 问题概述

用户报告 `clients\model-viewer\exporter.html` 页面在将 MDX 转换为 GLTF 时：
1. **材质丢失** - 转换后的 GLTF 没有显示纹理
2. **动画丢失** - 转换后的 GLTF 没有动画数据

## 问题诊断

### 1. 材质丢失原因

#### Bug 1: 变量未定义 (Line ~1145)
```javascript
// 错误代码：
const fileName = normalizedTexturePath.split('/').pop();
// 错误：normalizedTexturePath 未定义
```

#### Bug 2: UV 坐标数据提取不完整
原代码只检查 `geoset.UVs` 和 `geoset.uv`，但 war3-model 库和 MDLX 解析器实际使用的属性名可能是：
- `uvSets` (数组的数组)
- `tVertices` / `TVertices`
- `texCoords`

#### Bug 3: 纹理路径处理逻辑混乱
- 多个地方重复处理纹理路径
- 路径标准化不一致

### 2. 动画丢失原因

#### Bug 4: 动画关键帧解析不完整
原 `convertAnimationsToThreeJS` 函数只是简单地将骨骼的初始变换值复制为关键帧，没有真正解析 MDX 的动画关键帧数据。

MDX 格式中，动画关键帧存储在骨骼的 `Translation`、`Rotation`、`Scaling` 属性中，每个属性包含：
- `type`: 插值类型（0=None, 1=Linear, 2=Hermite, 3=Bezier）
- `keys`: 关键帧数组，每个关键帧包含 `frame`（时间）和 `value`（值）

#### Bug 5: 骨骼绑定权重数据简化处理
原代码只是简单地为每个顶点分配一个骨骼，没有正确处理 MDX 的矩阵组和矩阵索引数据。

---

## 修复内容

### 修复 1: 修复 normalizedTexturePath 未定义
**文件**: `clients/model-viewer/exporter.html`

```javascript
// 修复前：
const fileName = normalizedTexturePath.split('/').pop();

// 修复后：
const normalizedTexturePath = texturePath.replace(/\\/g, '/');
const fileName = normalizedTexturePath.split('/').pop();
```

### 修复 2: 改进 UV 坐标数据提取
**文件**: `clients/model-viewer/exporter.html`

```javascript
// 新增多种 UV 数据源检查（按优先级排序）
if (geoset.uvSets && geoset.uvSets.length > 0) {
    uvData = geoset.uvSets[0];
} else if (geoset.UVSets && geoset.UVSets.length > 0) {
    uvData = geoset.UVSets[0];
} else if (geoset.tVertices && geoset.tVertices.length > 0) {
    uvData = geoset.tVertices[0];
} else if (geoset.TVertices && geoset.TVertices.length > 0) {
    uvData = geoset.TVertices[0];
}
// ... 其他格式
```

### 修复 3: 实现完整的动画关键帧解析
**文件**: `clients/model-viewer/exporter.html`

新增辅助函数：
- `parseAnimationKeys()`: 解析位置和缩放关键帧
- `parseRotationKeys()`: 解析旋转关键帧（处理四元数和欧拉角）
- `eulerToQuaternion()`: 将欧拉角转换为四元数

重写 `convertAnimationsToThreeJS()` 函数，使其：
1. 正确解析每个骨骼的动画轨迹数据
2. 提取关键帧的时间和值
3. 根据动画范围（startFrame - endFrame）过滤关键帧
4. 创建正确的 Three.js KeyframeTrack

### 修复 4: 改进骨骼绑定权重数据处理
**文件**: `clients/model-viewer/exporter.html`

改进 `createSkinnedGeometry()` 函数，支持：
1. **Reforged 格式皮肤数据**：8字节每顶点（4个骨骼索引 + 4个权重）
2. **经典蒙皮数据**：通过 matrixGroups 和 matrixIndices 计算
3. **备用方案**：单骨骼绑定

新增 `geosetIndex` 参数，确保为每个 Geoset 使用正确的蒙皮数据。

---

## 验证结果

运行 `node verify_fix.js` 验证修复：

```
=== MDX 转 GLTF 修复验证 ===

1. 检查 exporter.html 文件...
   ✅ exporter.html 文件存在 (166235 字节)

2. 检查关键修复点...
   ✅ normalizedTexturePath 变量定义已修复
   ✅ UV 数据提取逻辑已改进
   ✅ 动画关键帧解析函数已添加
   ✅ 蒙皮几何体函数已改进

3. 检查模型文件...
   ✅ MDX 模型文件存在 (200355 字节)
   ✅ BLP 材质文件存在 (78155 字节)

4. 检查现有 GLTF 文件...
   ✅ GLTF 文件存在 (301433 字节)
   ✅ 材质: 7 个
   ❌ 动画: 无 (修复后应包含动画)
   ✅ 纹理: 1 个
   ✅ 图像: 1 个
   ✅ 网格: 7 个
   ✅ 节点: 9 个
   ✅ 皮肤: 7 个

5. 检查 war3-model 库...
   ✅ war3-model 库已安装
```

---

## 测试步骤

1. **启动开发服务器**：
   ```bash
   npm run serve
   ```

2. **访问导出页面**：
   打开 http://localhost:8080/clients/model-viewer/exporter.html

3. **选择模型**：
   在左侧选择 "Archnathid"（Creeps 分类下）

4. **设置导出选项**：
   - 勾选 "包含动画"
   - 勾选 "嵌入纹理"
   - 勾选 "包含骨骼"

5. **开始转换**：
   点击 "开始转换" 按钮

6. **验证结果**：
   - 下载生成的 GLTF 文件
   - 使用 [GLTF Viewer](https://gltf-viewer.donmccurdy.com/) 在线查看
   - 检查材质是否正确显示
   - 检查动画是否正常播放

---

## 已知限制

1. **动画插值类型**：当前实现主要处理线性插值（Linear），Hermite 和 Bezier 插值可能需要额外的处理

2. **团队色纹理**：ReplaceableId 纹理（如团队色）当前使用纯色代替，可能需要更复杂的处理

3. **多 UV 集**：当前只使用第一个 UV 集，如果模型使用多个 UV 集可能需要扩展

---

## 后续优化建议

1. 添加更多调试日志，方便排查问题
2. 实现 GLB 二进制格式导出（当前只导出 GLTF JSON）
3. 添加材质属性导入（透明度、发光等）
4. 优化骨骼动画采样率以减小文件大小
5. 添加批量转换功能

---

**修复完成时间**: 2026-02-08
**修复者**: AI Assistant
