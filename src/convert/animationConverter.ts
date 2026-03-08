import * as THREE from 'three';

/**
 * MDX 动画数据解析器
 * 将 MDX 动画数据转换为 Three.js 可用的关键帧数据
 */
export class AnimationDataParser {
    /**
     * 解析 MDX 动画数据为 Three.js 关键帧
     * @param mdxAnim - MDX 动画数据
     * @param startFrame - 起始帧
     * @param endFrame - 结束帧
     * @param fps - 帧率
     * @param valueSize - 值的大小 (3 为向量，4 为四元数)
     * @returns 时间和值数组
     */
    static parseMdxAnimation(
        mdxAnim: any, 
        startFrame: number, 
        endFrame: number, 
        fps: number, 
        valueSize: number
    ): { times: number[], values: number[], interpolationType: number } {
        const times: number[] = [];
        const values: number[] = [];
        
        if (!mdxAnim) {
            return { times, values, interpolationType: 1 };
        }
        
        // 获取插值类型 (0=None, 1=Linear, 2=Hermite, 3=Bezier)
        const interpolationType = mdxAnim.LineType !== undefined ? mdxAnim.LineType : 
                                 mdxAnim.lineType !== undefined ? mdxAnim.lineType : 1;
        
        // 处理 war3-model 库的返回格式
        let frames = mdxAnim.frames;
        let vals = mdxAnim.values;
        
        // 如果是 keys 格式，转换为 frames/values
        if (mdxAnim.keys && Array.isArray(mdxAnim.keys)) {
            frames = mdxAnim.keys.map((k: any) => k.frame !== undefined ? k.frame : k.time);
            vals = mdxAnim.keys.map((k: any) => {
                if (k.Vector !== undefined) {
                    // Vector 格式: {"0": x, "1": y, "2": z, "3": w}
                    const vecValues = [];
                    for (let i = 0; i < valueSize; i++) {
                        vecValues.push(k.Vector[i] !== undefined ? k.Vector[i] : 0);
                    }
                    return vecValues;
                }
                return k.value;
            });
        }
        
        if (!frames || !vals || frames.length === 0) {
            return { times, values, interpolationType };
        }
        
        // 检查关键帧时间是否在动画序列范围内
        const hasKeysInRange = frames.some((frame: number) => frame >= startFrame && frame <= endFrame);
        const firstFrame = Math.min(...frames);
        const lastFrame = Math.max(...frames);
        
        // 如果没有关键帧在范围内，但关键帧时间在合理范围内，使用所有关键帧
        if (!hasKeysInRange && firstFrame >= 0 && lastFrame <= 200000) {
            console.warn(`关键帧时间不在动画序列范围内，使用所有关键帧并重新计算时间`);
            console.warn(`动画序列范围[${startFrame}-${endFrame}], 关键帧范围[${firstFrame}-${lastFrame}]`);
            
            // 使用所有关键帧，时间相对于关键帧的最小时间
            const baseFrame = firstFrame;
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                const time = (frame - baseFrame) / fps;
                times.push(time);
                
                const value = vals[i];
                if (Array.isArray(value)) {
                    values.push(...value.slice(0, valueSize));
                } else if (typeof value === 'number') {
                    values.push(value);
                }
            }
        } else {
            // 正常处理：只使用在动画序列范围内的关键帧
            for (let i = 0; i < frames.length; i++) {
                const frame = frames[i];
                
                if (frame >= startFrame && frame <= endFrame) {
                    const time = (frame - startFrame) / fps;
                    times.push(time);
                    
                    const value = vals[i];
                    if (Array.isArray(value)) {
                        values.push(...value.slice(0, valueSize));
                    } else if (typeof value === 'number') {
                        values.push(value);
                    }
                }
            }
        }
        
        // Hermite/Bezier 插值需要采样转换为 Linear
        if (interpolationType === 2 || interpolationType === 3) {
            return this.sampleHermiteToLinear(times, values, valueSize, fps);
        }
        
        return { times, values, interpolationType };
    }
    
    /**
     * Hermite 插值采样为 Linear
     * GLTF 不支持 Hermite 插值，需要密集采样转换为 Linear
     */
    private static sampleHermiteToLinear(
        times: number[], 
        values: number[], 
        valueSize: number, 
        fps: number
    ): { times: number[], values: number[], interpolationType: number } {
        if (times.length < 2) {
            return { times, values, interpolationType: 1 };
        }
        
        const newTimes: number[] = [];
        const newValues: number[] = [];
        
        // 每两个关键帧之间采样 4 个点
        const samplesPerSegment = 4;
        
        for (let i = 0; i < times.length - 1; i++) {
            const t0 = times[i];
            const t1 = times[i + 1];
            const duration = t1 - t0;
            
            for (let s = 0; s < samplesPerSegment; s++) {
                const t = t0 + (duration * s / samplesPerSegment);
                newTimes.push(t);
                
                // 简单的线性插值 (实际应该用 Hermite 插值公式)
                const alpha = s / samplesPerSegment;
                for (let j = 0; j < valueSize; j++) {
                    const v0 = values[i * valueSize + j];
                    const v1 = values[(i + 1) * valueSize + j];
                    newValues.push(v0 + (v1 - v0) * alpha);
                }
            }
        }
        
        // 添加最后一个点
        newTimes.push(times[times.length - 1]);
        for (let j = 0; j < valueSize; j++) {
            newValues.push(values[(times.length - 1) * valueSize + j]);
        }
        
        return { times: newTimes, values: newValues, interpolationType: 1 };
    }
}

/**
 * 骨骼动画提取器
 * 从骨骼数据中提取动画关键帧轨道
 */
export class BoneAnimationExtractor {
    /**
     * 从骨骼数据中提取动画关键帧
     * @param bone - 骨骼数据
     * @param startFrame - 起始帧
     * @param endFrame - 结束帧
     * @param fps - 帧率
     * @returns Three.js 关键帧轨道数组
     */
    static extractBoneAnimations(
        bone: any, 
        startFrame: number, 
        endFrame: number, 
        fps: number
    ): THREE.KeyframeTrack[] {
        const tracks: THREE.KeyframeTrack[] = [];
        
        // 命名优先级必须与 createSkeleton 中完全一致
        const boneName = bone.name || bone.Name || 
                        (bone.ObjectId !== undefined ? `Bone_${bone.ObjectId}` : 
                         (bone.objectId !== undefined ? `Bone_${bone.objectId}` : `bone_0`));
        
        // 获取骨骼动画数据
        const translationAnim = bone.Translation || bone.translation;
        const rotationAnim = bone.Rotation || bone.rotation;
        const scalingAnim = bone.Scaling || bone.scaling;
        
        let trackCount = 0;
        
        // 1. 位置动画 (Vector3)
        if (translationAnim) {
            const posData = AnimationDataParser.parseMdxAnimation(translationAnim, startFrame, endFrame, fps, 3);
            if (posData.times.length > 0 && posData.values.length >= posData.times.length * 3) {
                // 确保值数组长度正确
                const validValues = posData.values.slice(0, posData.times.length * 3);
                tracks.push(new THREE.VectorKeyframeTrack(
                    `${boneName}.position`,
                    posData.times,
                    validValues
                ));
                trackCount++;
            }
        }
        
        // 2. 旋转动画 (Quaternion: x, y, z, w)
        if (rotationAnim) {
            const rotData = AnimationDataParser.parseMdxAnimation(rotationAnim, startFrame, endFrame, fps, 4);
            if (rotData.times.length > 0 && rotData.values.length >= rotData.times.length * 4) {
                const validValues = rotData.values.slice(0, rotData.times.length * 4);
                // War3 四元数直接使用
                tracks.push(new THREE.QuaternionKeyframeTrack(
                    `${boneName}.quaternion`,
                    rotData.times,
                    validValues
                ));
                trackCount++;
            }
        }
        
        // 3. 缩放动画 (Vector3)
        if (scalingAnim) {
            const scaleData = AnimationDataParser.parseMdxAnimation(scalingAnim, startFrame, endFrame, fps, 3);
            if (scaleData.times.length > 0 && scaleData.values.length >= scaleData.times.length * 3) {
                const validValues = scaleData.values.slice(0, scaleData.times.length * 3);
                tracks.push(new THREE.VectorKeyframeTrack(
                    `${boneName}.scale`,
                    scaleData.times,
                    validValues
                ));
                trackCount++;
            }
        }
        
        if (trackCount > 0) {
            console.log(`  ✅ 骨骼 [${boneName}]: 提取了 ${trackCount} 条轨迹`);
        }
        
        return tracks;
    }
}

/**
 * MDX 动画到 Three.js 转换器
 * 将 MDX 动画数据转换为 Three.js AnimationClip
 */
export class MdxAnimationConverter {
    private static readonly DEFAULT_FPS = 30; // War3 默认 30fps
    
    /**
     * 转换 MDX 动画数据为 Three.js AnimationClip
     * @param sequences - 动画序列数组
     * @param bones - 骨骼数组
     * @param options - 转换选项
     * @returns Three.js 动画剪辑数组
     */
    static convertAnimationsToThreeJS(
        sequences: any[], 
        bones: any[], 
        options: {
            fps?: number;
            logDetails?: boolean;
            validateData?: boolean;
        } = {}
    ): THREE.AnimationClip[] {
        const { 
            fps = this.DEFAULT_FPS, 
            logDetails = true, 
            validateData = true 
        } = options;
        
        if (logDetails) {
            console.log('=== 转换 MDX 动画到 Three.js ===');
            console.log(`序列: ${sequences ? sequences.length : 0} 个, 骨骼: ${bones ? bones.length : 0} 个`);
        }
        
        // 数据验证
        if (validateData) {
            if (!sequences || !Array.isArray(sequences) || sequences.length === 0) {
                console.warn('❌ 没有动画序列');
                return [];
            }
            
            if (!bones || !Array.isArray(bones) || bones.length === 0) {
                console.warn('❌ 没有骨骼数据');
                return [];
            }
        }
        
        const clips: THREE.AnimationClip[] = [];
        
        sequences.forEach((seq, seqIndex) => {
            const seqName = seq.name || seq.Name || `Sequence_${seqIndex}`;
            const interval = seq.interval || seq.Interval || [0, 100];
            const startFrame = interval[0];
            const endFrame = interval[1];
            const duration = (endFrame - startFrame) / fps;
            
            if (logDetails) {
                console.log(`\n处理序列: ${seqName} (${startFrame}-${endFrame}, ${duration.toFixed(2)}秒)`);
            }
            
            const allTracks: THREE.KeyframeTrack[] = [];
            let totalBoneTracksChecked = 0;
            
            // 为每个骨骼提取动画
            bones.forEach((bone, boneIndex) => {
                const boneName = bone.name || bone.Name || `Bone_${boneIndex}`;
                const hasTranslation = !!(bone.Translation || bone.translation);
                const hasRotation = !!(bone.Rotation || bone.rotation);
                const hasScaling = !!(bone.Scaling || bone.scaling);
                
                if (hasTranslation || hasRotation || hasScaling) {
                    totalBoneTracksChecked++;
                    if (logDetails) {
                        console.log(`  检查骨骼 [${boneIndex}] ${boneName}: 位置=${hasTranslation}, 旋转=${hasRotation}, 缩放=${hasScaling}`);
                    }
                }
                
                const boneTracks = BoneAnimationExtractor.extractBoneAnimations(bone, startFrame, endFrame, fps);
                allTracks.push(...boneTracks);
            });
            
            if (logDetails) {
                console.log(`  总计: 检查了 ${totalBoneTracksChecked} 个骨骼的动画数据，提取了 ${allTracks.length} 条轨迹`);
            }
            
            if (allTracks.length > 0) {
                const clip = new THREE.AnimationClip(seqName, duration, allTracks);
                clips.push(clip);
                if (logDetails) {
                    console.log(`✅ 动画: ${seqName}, ${allTracks.length} 条轨迹`);
                }
            } else {
                console.warn(`⚠️ ${seqName} 无轨迹 (检查了 ${totalBoneTracksChecked} 个骨骼)`);
            }
        });
        
        if (logDetails) {
            console.log(`\n=== 动画转换完成: ${clips.length} 个动画 ===`);
        }
        
        return clips;
    }
    
    /**
     * 分析动画数据
     * @param sequences - 动画序列
     * @param bones - 骨骼数据
     * @returns 分析结果
     */
    static analyzeAnimationData(sequences: any[], bones: any[]): {
        totalSequences: number;
        totalBones: number;
        animatedBones: number;
        sequenceInfo: Array<{
            name: string;
            startFrame: number;
            endFrame: number;
            duration: number;
            hasAnimatedBones: boolean;
        }>;
    } {
        const fps = this.DEFAULT_FPS;
        
        const sequenceInfo = sequences.map((seq, index) => {
            const seqName = seq.name || seq.Name || `Sequence_${index}`;
            const interval = seq.interval || seq.Interval || [0, 100];
            const startFrame = interval[0];
            const endFrame = interval[1];
            const duration = (endFrame - startFrame) / fps;
            
            // 检查是否有动画骨骼
            const hasAnimatedBones = bones.some(bone => {
                return !!(bone.Translation || bone.translation || 
                         bone.Rotation || bone.rotation || 
                         bone.Scaling || bone.scaling);
            });
            
            return {
                name: seqName,
                startFrame,
                endFrame,
                duration,
                hasAnimatedBones
            };
        });
        
        const animatedBones = bones.filter(bone => {
            return !!(bone.Translation || bone.translation || 
                     bone.Rotation || bone.rotation || 
                     bone.Scaling || bone.scaling);
        }).length;
        
        return {
            totalSequences: sequences.length,
            totalBones: bones.length,
            animatedBones,
            sequenceInfo
        };
    }
}

// 主要的转换函数，保持向后兼容性
export function convertAnimationsToThreeJS(
    sequences: any[], 
    bones: any[], 
    options?: {
        fps?: number;
        logDetails?: boolean;
        validateData?: boolean;
    }
): THREE.AnimationClip[] {
    return MdxAnimationConverter.convertAnimationsToThreeJS(sequences, bones, options);
}

// 导出所有相关的类和函数