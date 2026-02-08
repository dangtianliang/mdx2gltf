import * as fs from 'fs';
import * as path from 'path';
import { parseMDX } from 'war3-model';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 为Node.js环境添加必要的浏览器API模拟
if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = {
        createElementNS: () => ({
            getContext: () => ({
                bindTexture: () => {},
                texImage2D: () => {},
                texParameteri: () => {}
            })
        }),
        createElement: () => ({})
    };
}

if (typeof globalThis.FileReader === 'undefined') {
    (globalThis as any).FileReader = class {
        readAsArrayBuffer() {}
        onload() {}
        onerror() {}
    };
}

if (typeof globalThis.URL === 'undefined') {
    (globalThis as any).URL = {
        createObjectURL: () => 'data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==',
        revokeObjectURL: () => {}
    };
}

if (typeof globalThis.Image === 'undefined') {
    (globalThis as any).Image = class {
        src: string = '';
        onload: () => void = () => {};
        onerror: () => void = () => {};
    };
}

// 全局变量，用于存储加载的纹理
let loadedTexture: THREE.Texture | null = null;

// 解析 MDX 动画数据为 Three.js 关键帧
function parseMdxAnimation(mdxAnim: any, startFrame: number, endFrame: number, fps: number, valueSize: number): { times: number[], values: number[] } {
    const times: number[] = [];
    const values: number[] = [];
    
    if (!mdxAnim) {
        return { times, values };
    }
    
    // 处理 war3-model 库的返回格式
    let frames = mdxAnim.frames;
    let vals = mdxAnim.values;
    
    // 如果是 keys 格式，转换为 frames/values
    if (mdxAnim.keys && Array.isArray(mdxAnim.keys)) {
        frames = mdxAnim.keys.map((k: any) => k.frame !== undefined ? k.frame : k.time);
        vals = mdxAnim.keys.map((k: any) => k.value);
    }
    
    if (!frames || !vals || frames.length === 0) {
        return { times, values };
    }
    
    // 遍历所有关键帧，提取在动画范围内的
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        
        // 只提取在动画范围内的关键帧
        if (frame >= startFrame && frame <= endFrame) {
            const time = (frame - startFrame) / fps;
            times.push(time);
            
            const value = vals[i];
            if (Array.isArray(value)) {
                values.push(...value);
            } else if (typeof value === 'number') {
                values.push(value);
            }
        }
    }
    
    return { times, values };
}

// 从骨骼数据中提取动画关键帧
function extractBoneAnimations(bone: any, startFrame: number, endFrame: number, fps: number): THREE.KeyframeTrack[] {
    const tracks: THREE.KeyframeTrack[] = [];
    const boneName = bone.name || bone.Name || `Bone_${bone.objectId || bone.ObjectId || 0}`;
    
    // 获取骨骼动画数据
    const translationAnim = bone.Translation || bone.translation;
    const rotationAnim = bone.Rotation || bone.rotation;
    const scalingAnim = bone.Scaling || bone.scaling;
    
    // 1. 位置动画 (Vector3)
    if (translationAnim) {
        const posData = parseMdxAnimation(translationAnim, startFrame, endFrame, fps, 3);
        if (posData.times.length > 0 && posData.values.length >= posData.times.length * 3) {
            const validValues = posData.values.slice(0, posData.times.length * 3);
            tracks.push(new THREE.VectorKeyframeTrack(
                `${boneName}.position`,
                posData.times,
                validValues
            ));
        }
    }
    
    // 2. 旋转动画 (Quaternion)
    if (rotationAnim) {
        const rotData = parseMdxAnimation(rotationAnim, startFrame, endFrame, fps, 4);
        if (rotData.times.length > 0 && rotData.values.length >= rotData.times.length * 4) {
            const validValues = rotData.values.slice(0, rotData.times.length * 4);
            tracks.push(new THREE.QuaternionKeyframeTrack(
                `${boneName}.quaternion`,
                rotData.times,
                validValues
            ));
        }
    }
    
    // 3. 缩放动画 (Vector3)
    if (scalingAnim) {
        const scaleData = parseMdxAnimation(scalingAnim, startFrame, endFrame, fps, 3);
        if (scaleData.times.length > 0 && scaleData.values.length >= scaleData.times.length * 3) {
            const validValues = scaleData.values.slice(0, scaleData.times.length * 3);
            tracks.push(new THREE.VectorKeyframeTrack(
                `${boneName}.scale`,
                scaleData.times,
                validValues
            ));
        }
    }
    
    return tracks;
}

// 转换 MDX 动画数据为 Three.js AnimationClip
function convertAnimationsToThreeJS(sequences: any[], bones: any[]): THREE.AnimationClip[] {
    console.log('=== 转换 MDX 动画到 Three.js ===');
    console.log('序列数量:', sequences ? sequences.length : 0);
    console.log('骨骼数量:', bones ? bones.length : 0);
    
    if (!sequences || !Array.isArray(sequences) || sequences.length === 0) {
        console.warn('没有动画序列');
        return [];
    }
    
    if (!bones || !Array.isArray(bones) || bones.length === 0) {
        console.warn('没有骨骼数据');
        return [];
    }
    
    const clips: THREE.AnimationClip[] = [];
    const fps = 30; // War3 默认 30fps
    
    sequences.forEach((seq, seqIndex) => {
        const seqName = seq.name || seq.Name || `Sequence_${seqIndex}`;
        const interval = seq.interval || seq.Interval || [0, 100];
        const startFrame = interval[0];
        const endFrame = interval[1];
        const duration = (endFrame - startFrame) / fps;
        
        console.log(`\n处理序列: ${seqName} (${startFrame}-${endFrame}, ${duration.toFixed(2)}秒)`);
        
        const allTracks: THREE.KeyframeTrack[] = [];
        
        // 为每个骨骼提取动画
        bones.forEach((bone, boneIndex) => {
            const boneTracks = extractBoneAnimations(bone, startFrame, endFrame, fps);
            allTracks.push(...boneTracks);
        });
        
        if (allTracks.length > 0) {
            const clip = new THREE.AnimationClip(seqName, duration, allTracks);
            clips.push(clip);
            console.log(`✅ 创建动画: ${seqName}, ${allTracks.length} 条轨迹`);
        } else {
            console.warn(`⚠️ 序列 ${seqName} 没有轨迹`);
        }
    });
    
    console.log(`\n=== 动画转换完成: ${clips.length} 个动画 ===`);
    return clips;
}

// 创建骨骼系统
function createSkeleton(bonesData: any[]): THREE.Skeleton {
    const bones: THREE.Bone[] = [];
    const boneMap = new Map<number, THREE.Bone>();
    const validBoneIndices: number[] = [];
    
    // 创建骨骼
    bonesData.forEach((boneData, index) => {
        try {
            const bone = new THREE.Bone();
            bone.name = boneData.name || boneData.Name || `bone_${index}`;
            
            // 设置骨骼位置
            if (boneData.PivotPoints && boneData.PivotPoints.length > 0) {
                const pivot = boneData.PivotPoints[0];
                bone.position.set(pivot[0], pivot[1], pivot[2]);
            } else if (boneData.PivotPoint && boneData.PivotPoint.length > 0) {
                const pivot = boneData.PivotPoint;
                bone.position.set(pivot[0], pivot[1], pivot[2]);
            } else if (boneData.translation && boneData.translation.length > 0) {
                bone.position.set(boneData.translation[0], boneData.translation[1], boneData.translation[2]);
            } else if (boneData.Translation && boneData.Translation.length > 0) {
                bone.position.set(boneData.Translation[0], boneData.Translation[1], boneData.Translation[2]);
            }
            
            bones.push(bone);
            boneMap.set(index, bone);
            validBoneIndices.push(index);
        } catch (error) {
            console.error(`创建骨骼 ${index} 失败:`, error);
        }
    });
    
    // 设置骨骼层次结构
    bonesData.forEach((boneData, index) => {
        const bone = boneMap.get(index);
        let parentIndex = -1;
        
        // 尝试获取父骨骼索引
        if (boneData.parent !== undefined) {
            parentIndex = boneData.parent;
        } else if (boneData.Parent !== undefined) {
            parentIndex = boneData.Parent;
        }
        
        if (parentIndex >= 0 && parentIndex < bones.length && bone && validBoneIndices.includes(parentIndex)) {
            const parentBone = boneMap.get(parentIndex);
            if (parentBone && parentBone !== bone) {
                parentBone.add(bone);
            }
        }
    });
    
    // 过滤掉无效骨骼
    const validBones = bones.filter(bone => bone !== null && bone !== undefined);
    
    // 创建骨架
    const skeleton = new THREE.Skeleton(validBones);
    console.log('骨骼系统创建成功:', skeleton.bones.length, '个骨骼');
    console.log('有效骨骼索引:', validBoneIndices);
    
    return skeleton;
}

// 创建蒙皮几何体
function createSkinnedGeometry(geometry: THREE.BufferGeometry, bonesData: any[], modelData: any, geosetIndex: number = 0): THREE.BufferGeometry {
    // 克隆原始几何体
    const skinnedGeometry = geometry.clone();
    
    // 创建权重数据
    const skinIndices: number[] = [];
    const skinWeights: number[] = [];
    
    // 为每个顶点分配权重
    const positionAttribute = geometry.attributes['position'];
    const vertexCount = positionAttribute ? positionAttribute.count : 0;
    
    // 获取当前 Geoset 的数据
    let geoset = null;
    if (modelData.Geosets && modelData.Geosets.length > geosetIndex) {
        geoset = modelData.Geosets[geosetIndex];
    } else if (modelData.geosets && modelData.geosets.length > geosetIndex) {
        geoset = modelData.geosets[geosetIndex];
    }
    
    // 提取顶点组、矩阵组和矩阵索引数据
    let vertexGroups: number[] = [];
    let matrixGroups: number[] = [];
    let matrixIndices: number[] = [];
    let skinData: number[] | null = null;
    
    if (geoset) {
        // 顶点组
        if (geoset.VertexGroup) {
            vertexGroups = Array.from(geoset.VertexGroup);
        } else if (geoset.vertexGroups) {
            vertexGroups = Array.from(geoset.vertexGroups);
        } else if (geoset.vertexGroup) {
            vertexGroups = Array.from(geoset.vertexGroup);
        }
        
        // 矩阵组
        if (geoset.MatrixGroups) {
            matrixGroups = Array.from(geoset.MatrixGroups);
        } else if (geoset.matrixGroups) {
            matrixGroups = Array.from(geoset.matrixGroups);
        } else if (geoset.matrixGroup) {
            matrixGroups = Array.from(geoset.matrixGroup);
        }
        
        // 矩阵索引
        if (geoset.MatrixIndices) {
            matrixIndices = Array.from(geoset.MatrixIndices);
        } else if (geoset.matrixIndices) {
            matrixIndices = Array.from(geoset.matrixIndices);
        } else if (geoset.matrixIndex) {
            matrixIndices = Array.from(geoset.matrixIndex);
        }
        
        // Reforged 格式的皮肤数据
        if (geoset.Skin) {
            skinData = Array.from(geoset.Skin);
        } else if (geoset.skin) {
            skinData = Array.from(geoset.skin);
        }
    }
    
    console.log(`Geoset ${geosetIndex} 蒙皮数据:`, {
        vertexGroups: vertexGroups.length,
        matrixGroups: matrixGroups.length,
        matrixIndices: matrixIndices.length,
        skinData: skinData ? skinData.length : 0
    });
    
    // 如果有 Reforged 格式的皮肤数据，使用它
    if (skinData && skinData.length >= vertexCount * 8) {
        console.log('使用 Reforged 皮肤数据');
        for (let i = 0; i < vertexCount; i++) {
            const offset = i * 8;
            // 4个骨骼索引
            skinIndices.push(
                skinData[offset],
                skinData[offset + 1],
                skinData[offset + 2],
                skinData[offset + 3]
            );
            // 4个权重（归一化到0-1）
            skinWeights.push(
                skinData[offset + 4] / 255,
                skinData[offset + 5] / 255,
                skinData[offset + 6] / 255,
                skinData[offset + 7] / 255
            );
        }
    }
    // 否则使用经典的顶点组/矩阵组数据
    else if (vertexGroups.length > 0 && matrixGroups.length > 0 && matrixIndices.length > 0) {
        console.log('使用经典蒙皮数据');
        
        // 计算每个矩阵组在 matrixIndices 中的起始位置
        let groupOffsets: number[] = [0];
        for (let i = 0; i < matrixGroups.length - 1; i++) {
            groupOffsets.push(groupOffsets[i] + matrixGroups[i]);
        }
        
        for (let i = 0; i < vertexCount; i++) {
            let boneIndex1 = 0, boneIndex2 = 0, boneIndex3 = 0, boneIndex4 = 0;
            let weight1 = 1, weight2 = 0, weight3 = 0, weight4 = 0;
            
            if (i < vertexGroups.length) {
                const groupIndex = vertexGroups[i];
                
                if (groupIndex >= 0 && groupIndex < matrixGroups.length) {
                    const groupSize = matrixGroups[groupIndex];
                    const groupOffset = groupOffsets[groupIndex];
                    
                    // 根据矩阵组大小分配骨骼索引和权重
                    if (groupSize >= 1 && groupOffset < matrixIndices.length) {
                        boneIndex1 = matrixIndices[groupOffset];
                        weight1 = 1.0;
                    }
                    if (groupSize >= 2 && (groupOffset + 1) < matrixIndices.length) {
                        boneIndex2 = matrixIndices[groupOffset + 1];
                        weight1 = 0.5;
                        weight2 = 0.5;
                    }
                    if (groupSize >= 3 && (groupOffset + 2) < matrixIndices.length) {
                        boneIndex3 = matrixIndices[groupOffset + 2];
                        weight1 = 0.33;
                        weight2 = 0.33;
                        weight3 = 0.34;
                    }
                    if (groupSize >= 4 && (groupOffset + 3) < matrixIndices.length) {
                        boneIndex4 = matrixIndices[groupOffset + 3];
                        weight1 = 0.25;
                        weight2 = 0.25;
                        weight3 = 0.25;
                        weight4 = 0.25;
                    }
                }
            }
            
            skinIndices.push(boneIndex1, boneIndex2, boneIndex3, boneIndex4);
            skinWeights.push(weight1, weight2, weight3, weight4);
        }
    }
    // 备用方案：每个顶点绑定到第一个骨骼
    else {
        console.log('使用备用蒙皮方案（单骨骼）');
        for (let i = 0; i < vertexCount; i++) {
            skinIndices.push(0, 0, 0, 0);
            skinWeights.push(1, 0, 0, 0);
        }
    }
    
    // 添加权重属性
    skinnedGeometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    skinnedGeometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    
    console.log('蒙皮几何体创建成功，顶点数:', vertexCount);
    return skinnedGeometry;
}

// 计算三角形面积
function calculateTriangleArea(v0: THREE.Vector3, v1: THREE.Vector3, v2: THREE.Vector3): number {
    // 使用向量叉积计算三角形面积
    const v1v0 = new THREE.Vector3().subVectors(v1, v0);
    const v2v0 = new THREE.Vector3().subVectors(v2, v0);
    const crossProduct = new THREE.Vector3().crossVectors(v1v0, v2v0);
    return 0.5 * crossProduct.length();
}

// 清理模型中的1像素平面
function cleanUpOnePixelPlanes(object: THREE.Object3D) {
    console.log('开始清理1像素平面...');
    let removedCount = 0;
    
    // 遍历对象及其子对象
    object.traverse((child) => {
        if ((child as any).isMesh || (child as any).isSkinnedMesh) {
            const mesh = child as THREE.Mesh;
            const geometry = mesh.geometry;
            
            if (geometry && geometry.isBufferGeometry) {
                // 获取顶点和索引数据
                const positionAttribute = geometry.attributes['position'];
                const indexAttribute = geometry.index;
                
                if (positionAttribute && indexAttribute) {
                    const positions = positionAttribute.array;
                    const indices = indexAttribute.array;
                    
                    // 存储需要保留的三角形索引
                    const validIndices: number[] = [];
                    
                    // 遍历所有三角形
                    for (let i = 0; i < indices.length; i += 3) {
                        // 获取三角形的三个顶点索引
                        const i0 = indices[i] * 3;
                        const i1 = indices[i + 1] * 3;
                        const i2 = indices[i + 2] * 3;
                        
                        // 获取三个顶点的位置
                        const v0 = new THREE.Vector3(
                            positions[i0], positions[i0 + 1], positions[i0 + 2]
                        );
                        const v1 = new THREE.Vector3(
                            positions[i1], positions[i1 + 1], positions[i1 + 2]
                        );
                        const v2 = new THREE.Vector3(
                            positions[i2], positions[i2 + 1], positions[i2 + 2]
                        );
                        
                        // 计算三角形的面积
                        const area = calculateTriangleArea(v0, v1, v2);
                        
                        // 定义1像素平面的面积阈值
                        const areaThreshold = 0.001;
                        
                        // 如果三角形面积大于阈值，则保留
                        if (area > areaThreshold) {
                            validIndices.push(indices[i], indices[i + 1], indices[i + 2]);
                        } else {
                            removedCount++;
                        }
                    }
                    
                    // 如果删除了一些三角形，更新几何体
                    if (validIndices.length < indices.length) {
                        console.log(`从 ${mesh.name} 中删除了 ${(indices.length - validIndices.length) / 3} 个1像素平面`);
                        
                        // 创建新的索引缓冲区
                        const newIndices = new Uint32Array(validIndices);
                        geometry.setIndex(new THREE.BufferAttribute(newIndices, 1));
                        
                        // 如果几何体为空，则删除整个网格
                        if (validIndices.length === 0) {
                            console.log(`删除空网格: ${mesh.name}`);
                            if (mesh.parent) {
                                mesh.parent.remove(mesh);
                            }
                        } else {
                            // 更新几何体
                            if (geometry.attributes['position']) {
                                geometry.attributes['position'].needsUpdate = true;
                            }
                            geometry.computeBoundingBox();
                            geometry.computeBoundingSphere();
                        }
                    }
                }
            }
        }
    });
    
    console.log(`清理完成，共删除了 ${removedCount / 3} 个1像素平面`);
}

// 将1像素平面设置为透明材质
function makeOnePixelPlanesTransparent(object: THREE.Object3D) {
    console.log('开始将1像素平面设置为透明材质...');
    let transparentCount = 0;
    
    // 创建透明材质
    const transparentMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        opacity: 0.0,
        transparent: true,
        side: THREE.DoubleSide
    });
    console.log('创建透明材质');
    
    // 遍历对象及其子对象
    object.traverse((child) => {
        if ((child as any).isMesh || (child as any).isSkinnedMesh) {
            const mesh = child as THREE.Mesh;
            const geometry = mesh.geometry;
            
            if (geometry && geometry.isBufferGeometry) {
                // 获取顶点和索引数据
                const positionAttribute = geometry.attributes['position'];
                const indexAttribute = geometry.index;
                
                if (positionAttribute && indexAttribute) {
                    const positions = positionAttribute.array;
                    const indices = indexAttribute.array;
                    
                    // 检查网格是否主要由1像素平面组成
                    let totalTriangles = indices.length / 3;
                    let smallTriangles = 0;
                    
                    // 遍历所有三角形，计算小三角形的数量
                    for (let i = 0; i < indices.length; i += 3) {
                        // 获取三角形的三个顶点索引
                        const i0 = indices[i] * 3;
                        const i1 = indices[i + 1] * 3;
                        const i2 = indices[i + 2] * 3;
                        
                        // 获取三个顶点的位置
                        const v0 = new THREE.Vector3(
                            positions[i0], positions[i0 + 1], positions[i0 + 2]
                        );
                        const v1 = new THREE.Vector3(
                            positions[i1], positions[i1 + 1], positions[i1 + 2]
                        );
                        const v2 = new THREE.Vector3(
                            positions[i2], positions[i2 + 1], positions[i2 + 2]
                        );
                        
                        // 计算三角形的面积
                        const area = calculateTriangleArea(v0, v1, v2);
                        
                        // 定义1像素平面的面积阈值
                        const areaThreshold = 0.001;
                        
                        // 统计小三角形的数量
                        if (area <= areaThreshold) {
                            smallTriangles++;
                        }
                    }
                    
                    // 如果网格中超过90%的三角形都是小三角形，则将整个网格设置为透明材质
                    if (smallTriangles > 0 && (smallTriangles / totalTriangles) > 0.9) {
                        console.log(`将网格 ${mesh.name} 设置为透明材质，其中 ${smallTriangles}/${totalTriangles} 个三角形是1像素平面`);
                        mesh.material = transparentMaterial;
                        transparentCount++;
                    }
                }
            }
        }
    });
    
    console.log(`处理完成，共将 ${transparentCount} 个网格设置为透明材质`);
}

// 加载模型对应的GLB材质文件
async function loadModelMaterial(materialPath: string): Promise<THREE.Material | null> {
    console.log('尝试加载材质文件:', materialPath);
    
    if (!fs.existsSync(materialPath)) {
        console.log('材质文件不存在:', materialPath);
        return null;
    }
    
    return new Promise((resolve) => {
        try {
            const loader = new GLTFLoader();
            
            // 在Node.js中，我们需要模拟加载过程
            // 这里创建一个基于GLB文件存在性的默认材质
            console.log('GLB材质文件存在，创建默认材质');
            
            // 创建与浏览器导出器相同的材质
            const material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                metalness: 0.0,          // War3材质通常没有金属感
                roughness: 0.8,           // War3材质通常比较粗糙
                opacity: 1.0,
                transparent: false,
                side: THREE.DoubleSide,
                wireframe: false,
                emissive: 0x000000,       // 自发光颜色
                emissiveIntensity: 0.0,   // 自发光强度
                flatShading: false,       // 使用平滑着色
                vertexColors: false       // 不使用顶点颜色
            });
            
            resolve(material);
        } catch (error) {
            console.error('加载GLB材质失败:', error);
            resolve(null);
        }
    });
}

// 转换单个 MDX 文件（完全使用浏览器导出器的逻辑）
async function convertSingleMDX(mdxPath: string, outputPath: string): Promise<void> {
    console.log(`🔄 转换: ${mdxPath}`);
    
    try {
        // 1. 读取 MDX 文件
        const buffer = fs.readFileSync(mdxPath);
        const arrayBuffer = buffer.buffer;
        
        // 2. 解析 MDX 模型
        const model = parseMDX(arrayBuffer);
        
        console.log(`   名称: ${model.Info?.Name || 'Unknown'}`);
        console.log(`   骨骼: ${model.Bones?.length || 0}`);
        console.log(`   序列: ${model.Sequences?.length || 0}`);
        console.log(`   Geosets: ${model.Geosets?.length || 0}`);
        
        // 3. 创建场景
        const scene = new THREE.Scene();
        scene.name = model.Info?.Name || "War3Model";
        
        // 4. 提取骨骼和动画数据
        let bonesData: any[] = [];
        let animationsData: any[] = [];
        
        // 提取骨骼数据
        if (model.Bones) {
            bonesData = model.Bones;
        } else if ((model as any).nodes) {
            // 从nodes中提取骨骼
            const nodes = Object.values((model as any).nodes);
            bonesData = nodes.filter((node: any) => node.Flags & 256); // 256是Bone类型的标志
        }
        
        // 提取动画数据
        if (model.Sequences) {
            animationsData = model.Sequences;
        }
        
        // 5. 转换动画
        let animations: THREE.AnimationClip[] = [];
        if (animationsData && bonesData && animationsData.length > 0 && bonesData.length > 0) {
            animations = convertAnimationsToThreeJS(animationsData, bonesData);
        }
        
        console.log(`   动画片段: ${animations.length}`);
        
        // 6. 创建骨骼系统
        let skeleton: THREE.Skeleton | null = null;
        if (bonesData.length > 0) {
            skeleton = createSkeleton(bonesData);
        }
        
        // 7. 处理 Geosets（网格组）
        if (model.Geosets && model.Geosets.length > 0) {
            const geosetObjects: { geometry: THREE.BufferGeometry, materialID: number, geosetIndex: number }[] = [];
            
            // 为每个Geoset创建几何体
            model.Geosets.forEach((geoset: any, index: number) => {
                console.log(`处理Geoset ${index}:`);
                console.log('顶点数量:', geoset.Vertices.length / 3);
                console.log('面数量:', geoset.Faces ? geoset.Faces.length / 3 : 0);
                
                // 提取材质ID
                let materialID = index;
                if (geoset.MaterialID !== undefined) {
                    materialID = geoset.MaterialID;
                } else if (geoset.materialId !== undefined) {
                    materialID = geoset.materialId;
                } else if (geoset.materialID !== undefined) {
                    materialID = geoset.materialID;
                }
                
                console.log('材质ID:', materialID);
                
                // 创建独立的几何体
                const geosetGeometry = new THREE.BufferGeometry();
                
                // 处理顶点数据
                const vertices: number[] = [];
                for (let i = 0; i < geoset.Vertices.length; i += 3) {
                    vertices.push(
                        geoset.Vertices[i],
                        geoset.Vertices[i + 1],
                        geoset.Vertices[i + 2]
                    );
                }
                
                // 处理面数据
                const indices: number[] = [];
                if (geoset.Faces) {
                    for (let i = 0; i < geoset.Faces.length; i += 3) {
                        indices.push(
                            geoset.Faces[i],
                            geoset.Faces[i + 1],
                            geoset.Faces[i + 2]
                        );
                    }
                }
                
                // 处理 UV 坐标
                const uvs: number[] = [];
                let uvSource: number[] | null = null;
                
                // 尝试不同的 UV 数据源
                if (geoset.uvSets && geoset.uvSets.length > 0) {
                    uvSource = geoset.uvSets[0];
                } else if (geoset.UVSets && geoset.UVSets.length > 0) {
                    uvSource = geoset.UVSets[0];
                } else if (geoset.TVertices && geoset.TVertices.length > 0) {
                    uvSource = geoset.TVertices[0];
                } else if (geoset.Tvertices && geoset.Tvertices.length > 0) {
                    uvSource = geoset.Tvertices[0];
                } else if (geoset.uvs) {
                    uvSource = geoset.uvs;
                } else if (geoset.UVs) {
                    uvSource = geoset.UVs;
                }
                
                if (uvSource && uvSource.length > 0) {
                    console.log(`Geoset ${index} UV 数据:`, uvSource.length / 2, '个UV');
                    for (let i = 0; i < uvSource.length; i += 2) {
                        // War3 V 坐标需要翻转
                        uvs.push(uvSource[i], 1.0 - uvSource[i + 1]);
                    }
                } else {
                    // 生成默认 UV
                    const vertexCount = vertices.length / 3;
                    for (let i = 0; i < vertexCount; i++) {
                        uvs.push(0, 0);
                    }
                    console.warn(`Geoset ${index} 没有UV数据，使用默认UV`);
                }
                
                // 设置几何体属性
                geosetGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                if (indices.length > 0) {
                    geosetGeometry.setIndex(indices);
                }
                if (uvs.length > 0) {
                    geosetGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                }
                
                // 计算法线
                geosetGeometry.computeVertexNormals();
                
                // 添加到geosetObjects数组
                geosetObjects.push({
                    geometry: geosetGeometry,
                    materialID: materialID,
                    geosetIndex: index
                });
                
                console.log(`Geoset ${index} 几何体创建成功`);
            });
            
            // 8. 创建模型组
            const modelGroup = new THREE.Group();
            modelGroup.name = 'ModelGroup';
            
            // 为每个Geoset创建网格
            const materialMap = new Map<number, THREE.Material>();
            
            geosetObjects.forEach((geosetObject, index) => {
                console.log(`=== 处理Geoset ${index} ===`);
                console.log('几何体顶点数:', geosetObject.geometry.attributes['position'] ? geosetObject.geometry.attributes['position'].count : 0);
                console.log('几何体索引数:', geosetObject.geometry.index ? geosetObject.geometry.index.count : 0);
                console.log('材质ID:', geosetObject.materialID);
                
                // 获取或创建材质
                let geosetMaterial: THREE.Material;
                if (materialMap.has(geosetObject.materialID)) {
                    geosetMaterial = materialMap.get(geosetObject.materialID)!;
                    console.log('使用已创建的材质');
                } else {
                    // 创建与浏览器导出器相同的材质
                    const matOptions: THREE.MeshStandardMaterialParameters = {
                        color: 0xffffff,
                        metalness: 0.0,          // War3材质通常没有金属感
                        roughness: 0.8,           // War3材质通常比较粗糙
                        opacity: 1.0,
                        transparent: false,
                        side: THREE.DoubleSide,
                        wireframe: false,
                        emissive: 0x000000,       // 自发光颜色
                        emissiveIntensity: 0.0,   // 自发光强度
                        flatShading: false,       // 使用平滑着色
                        vertexColors: false       // 不使用顶点颜色
                    };
                    
                    // 如果全局纹理已加载，应用到材质
                    if (loadedTexture) {
                        matOptions.map = loadedTexture;
                        console.log('材质使用已加载纹理');
                    }
                    
                    geosetMaterial = new THREE.MeshStandardMaterial(matOptions);
                    materialMap.set(geosetObject.materialID, geosetMaterial);
                    console.log('创建新材质 (MaterialID:', geosetObject.materialID, ')');
                }
                
                // 创建网格
                let geosetMesh: THREE.Mesh | THREE.SkinnedMesh;
                if (skeleton && bonesData.length > 0) {
                    try {
                        // 创建蒙皮几何体
                        const skinnedGeometry = createSkinnedGeometry(
                            geosetObject.geometry, 
                            bonesData, 
                            model, 
                            geosetObject.geosetIndex
                        );
                        
                        // 创建蒙皮网格
                        geosetMesh = new THREE.SkinnedMesh(skinnedGeometry, geosetMaterial);
                        
                        // 找到根骨骼并添加
                        const rootBones = skeleton.bones.filter(bone => !bone.parent || bone.parent.type !== 'Bone');
                        rootBones.forEach(rootBone => {
                            geosetMesh!.add(rootBone);
                        });
                        
                        // 绑定骨架
                        if ((geosetMesh as any).bind) {
                            (geosetMesh as any).bind(skeleton);
                        }
                        console.log('创建蒙皮网格成功，根骨骼数:', rootBones.length);
                    } catch (error) {
                        console.error('创建蒙皮网格失败:', error);
                        // 回退到普通网格
                        geosetMesh = new THREE.Mesh(geosetObject.geometry, geosetMaterial);
                    }
                } else {
                    // 没有骨骼数据，使用普通网格
                    geosetMesh = new THREE.Mesh(geosetObject.geometry, geosetMaterial);
                }
                
                geosetMesh.name = `Geoset_${index}_Material_${geosetObject.materialID}`;
                modelGroup.add(geosetMesh);
                console.log('Geoset网格添加成功:', geosetMesh.name);
            });
            
            // 9. 处理1像素平面
            makeOnePixelPlanesTransparent(modelGroup);
            console.log('模型处理完成，将1像素平面设置为透明材质');
            
            cleanUpOnePixelPlanes(modelGroup);
            console.log('模型清理完成，删除了多余的1像素平面');
            
            // 10. 调整模型坐标系，确保Y轴向上
            modelGroup.rotation.x = -Math.PI / 2; // 绕X轴旋转-90度，将Z轴向上转换为Y轴向上
            console.log('模型坐标系调整完成，Y轴向上');
            
            // 11. 将模型组添加到场景
            scene.add(modelGroup);
            console.log('模型组添加到场景成功');
        }
        
        // 12. 添加动画到场景
        if (animations.length > 0) {
            (scene as any).animations = animations;
        }
        
        // 准备纹理以便导出到 GLTF
        function prepareTexturesForExport(scene: THREE.Scene) {
            console.log('=== 准备纹理以便导出 ===');
            
            let textureCount = 0;
            
            scene.traverse((object: any) => {
                if (object.isMesh || object.isSkinnedMesh) {
                    const material = object.material;
                    if (material && material.map) {
                        const texture = material.map;
                        
                        // 确保纹理需要更新
                        texture.needsUpdate = true;
                        textureCount++;
                    }
                }
            });
            
            console.log(`准备了 ${textureCount} 个纹理`);
        }
        
        // 检查场景中的对象，确保它们都有正确的属性
        function validateSceneObjects(scene: THREE.Scene) {
            console.log('=== 验证场景对象 ===');
            
            let objectCount = 0;
            let meshCount = 0;
            let skinnedMeshCount = 0;
            
            scene.traverse((object: any) => {
                objectCount++;
                
                if (object.isMesh) {
                    meshCount++;
                    console.log(`Mesh ${meshCount}: ${object.name}`);
                    console.log(`  几何体: ${object.geometry ? '存在' : '不存在'}`);
                    console.log(`  材质: ${object.material ? '存在' : '不存在'}`);
                    
                    if (object.geometry) {
                        console.log(`  顶点数: ${object.geometry.attributes.position ? object.geometry.attributes.position.count : 0}`);
                        console.log(`  索引数: ${object.geometry.index ? object.geometry.index.count : 0}`);
                    }
                } else if (object.isSkinnedMesh) {
                    skinnedMeshCount++;
                    console.log(`SkinnedMesh ${skinnedMeshCount}: ${object.name}`);
                    console.log(`  几何体: ${object.geometry ? '存在' : '不存在'}`);
                    console.log(`  材质: ${object.material ? '存在' : '不存在'}`);
                    console.log(`  骨架: ${object.skeleton ? '存在' : '不存在'}`);
                    
                    if (object.geometry) {
                        console.log(`  顶点数: ${object.geometry.attributes.position ? object.geometry.attributes.position.count : 0}`);
                        console.log(`  索引数: ${object.geometry.index ? object.geometry.index.count : 0}`);
                        console.log(`  皮肤索引: ${object.geometry.attributes.skinIndex ? '存在' : '不存在'}`);
                        console.log(`  皮肤权重: ${object.geometry.attributes.skinWeight ? '存在' : '不存在'}`);
                    }
                }
            });
            
            console.log(`验证完成: 共 ${objectCount} 个对象，${meshCount} 个网格，${skinnedMeshCount} 个蒙皮网格`);
        }
        
        // 13. 导出 GLTF
        const exporter = new GLTFExporter();
        
        // 验证场景对象
        validateSceneObjects(scene);
        
        // 准备纹理以便导出
        prepareTexturesForExport(scene);
        
        // 导出选项（与浏览器导出器完全相同）
        const exportOptions = {
            binary: outputPath.endsWith('.glb'),
            embedImages: true,
            includeCustomExtensions: false,
            truncateDrawRange: true,
            onlyVisible: true,
            maxTextureSize: 4096,
            animations: animations && Array.isArray(animations) && animations.length > 0 ? animations : undefined,
            optimizeMesh: true,
            optimizeAnimations: true,
            textureCompression: false,
            dracoCompression: false
        };
        
        console.log('导出选项:', exportOptions);
        console.log('是否包含动画:', !!exportOptions.animations);
        console.log('是否嵌入纹理:', exportOptions.embedImages);
        console.log('是否启用纹理压缩:', exportOptions.textureCompression);
        
        try {
            const result = await new Promise<ArrayBuffer | object>((resolve, reject) => {
                try {
                    console.log('开始执行GLTF导出...');
                    exporter.parse(
                        scene,
                        (gltf) => {
                            resolve(gltf);
                        },
                        (error) => {
                            reject(error);
                        },
                        exportOptions
                    );
                } catch (error) {
                    reject(error);
                }
            });
            
            // 14. 保存文件
            if (typeof result === 'object') {
                if (exportOptions.binary && result instanceof ArrayBuffer) {
                    fs.writeFileSync(outputPath, Buffer.from(result));
                } else if (result !== null) {
                    // 优化GLTF数据
                    console.log('开始优化GLTF数据...');
                    let optimizedGltf = result;
                    
                    if (typeof optimizedGltf === 'object') {
                        // 优化模型结构
                        console.log('优化模型结构...');
                        
                        // 移除不必要的属性
                        if ((optimizedGltf as any).asset) {
                            (optimizedGltf as any).asset.generator = 'War3 Model Viewer GLTF Exporter';
                        }
                    }
                    
                    const jsonContent = JSON.stringify(optimizedGltf, null, 2);
                    fs.writeFileSync(outputPath, jsonContent);
                    console.log(`GLTF JSON大小: ${jsonContent.length} 字节`);
                }
                console.log(`✅ 转换成功: ${outputPath}`);
            }
        } catch (error) {
            console.error(`❌ 导出失败: ${(error as Error).message}`);
            console.error(`   错误堆栈: ${(error as Error).stack}`);
            
            // 创建一个简单的错误文件，至少记录模型转换尝试
            const errorContent = JSON.stringify({
                error: (error as Error).message,
                modelName: model.Info?.Name || 'Unknown',
                timestamp: new Date().toISOString()
            }, null, 2);
            fs.writeFileSync(outputPath.replace('.gltf', '.error.json'), errorContent);
            console.log(`✅ 错误文件已保存: ${outputPath.replace('.gltf', '.error.json')}`);
        }
        
    } catch (error) {
        console.error(`❌ 转换失败: ${mdxPath}`);
        console.error(`   错误: ${(error as Error).message}`);
        throw error;
    }
}

// 批量转换函数
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
        const outputPath = path.join(outputDir, relativePath.replace('.mdx', '.gltf').replace(/\\/g, '/'));
        
        console.log(`\n🔄 转换 ${i + 1}/${mdxFiles.length}: ${relativePath}`);
        
        try {
            // 创建输出文件的目录
            const outputFileDir = path.dirname(outputPath);
            if (!fs.existsSync(outputFileDir)) {
                fs.mkdirSync(outputFileDir, { recursive: true });
            }
            
            // 计算对应的GLB材质文件路径
            const currentMaterialPath = mdxPath.replace(/\.mdx$/i, '.glb');
            console.log('对应的材质文件路径:', currentMaterialPath);
            
            // 尝试加载材质
            const material = await loadModelMaterial(currentMaterialPath);
            if (material) {
                console.log('成功加载材质');
                // 将材质保存到全局变量，供convertSingleMDX使用
                loadedTexture = null; // 重置纹理，使用材质的默认设置
            }
            
            // 调用转换函数
            await convertSingleMDX(mdxPath, outputPath);
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

// 运行批量转换
batchConvert().catch((error) => {
    console.error('❌ 批量转换失败:', error);
});
