# MDX 动画数据结构分析

## 关键发现

### 1. Sequence (动画序列)
```json
{
  "Name": "Stand",
  "Interval": [333, 1833],  // 起始帧, 结束帧
  "MoveSpeed": 0,
  "NonLooping": false,
  "Rarity": 0,
  "BoundsRadius": 117.289,
  "MinimumExtent": {...},
  "MaximumExtent": {...}
}
```

### 2. Bone (骨骼)
```json
{
  "Name": "Object06",
  "ObjectId": 22,
  "Parent": 55,
  "Flags": 256,
  "PivotPoint": { "0": x, "1": y, "2": z }
}
```

### 3. Animation Key (关键帧) - 关键！
```json
{
  "Translation": {
    "Keys": [
      {
        "Frame": 333,           // 帧号
        "Vector": {             // 值
          "0": 0, "1": 0, "2": 0  // x, y, z (Translation) 或 x, y, z, w (Rotation)
        },
        "InTan": {              // 入切线 (Hermite/Bezier 插值用)
          "0": 0, "1": 0, "2": 0
        },
        "OutTan": {             // 出切线 (Hermite/Bezier 插值用)
          "0": 0, "1": 0, "2": 0
        }
      }
    ],
    "LineType": 2,              // 插值类型: 0=None, 1=Linear, 2=Hermite, 3=Bezier
    "GlobalSeqId": null         // 全局序列ID
  }
}
```

## 插值类型 (LineType)
- `0`: DontInterp (不插值)
- `1`: Linear (线性)
- `2`: Hermite (三次样条，需要 InTan/OutTan)
- `3`: Bezier (贝塞尔，需要 InTan/OutTan)

## 帧号范围
- Stand: 333-1833 (50秒 @ 30fps)
- Walk: 2333-3133 (26.67秒 @ 30fps)
- Attack: 3667-4667
- Death: 10000-13000
- 等等...

## 转换策略
1. 每个 Sequence 转换为 GLTF 的一个 Animation
2. 根据 Interval 过滤关键帧
3. Frame 转换为时间: time = (frame - startFrame) / 30
4. Hermite 插值的关键帧需要采样为 Linear (GLTF 不支持 Hermite 直接)
5. Rotation 四元数直接使用 (x, y, z, w)
6. Translation 向量 (x, y, z)
7. Scaling 向量 (x, y, z)
