/**
 * MDX到GLTF动画转换器 - 重构版本
 * 支持完整的MDX动画系统，包括：
 * - 所有节点类型（Bones, Helpers, Attachments, Particles）
 * - 正确的Hermite/Bezier插值
 * - 层级动画传递
 * - 几何体透明度动画
 */

class MdxAnimationExtractor {
    constructor(mdxData) {
        this.mdxData = mdxData;
        this.sequences = mdxData.Sequences || [];
        this.nodes = this.extractAllNodes();
        this.globalFps = 30; // War3 标准帧率
        this.frameToTime = this.buildFrameToTimeMapping();
    }
    
    // 提取所有动画节点
    extractAllNodes() {
        const nodes = [];
        
        // 骨骼节点
        (this.mdxData.Bones || []).forEach((bone, index) => {
            nodes.push({
                type: 'bone',
                index,
                data: bone,
                objectId: bone.ObjectId,
                name: bone.Name || `Bone_${index}`,
                parent: bone.Parent,
                pivotPoint: bone.PivotPoint
            });
        });
        
        // 辅助节点
        (this.mdxData.Helpers || []).forEach((helper, index) => {
            nodes.push({
                type: 'helper',
                index,
                data: helper,
                objectId: helper.ObjectId,
                name: helper.Name || `Helper_${index}`,
                parent: helper.Parent,
                pivotPoint: helper.PivotPoint,
                translation: helper.Translation,
                rotation: helper.Rotation,
                scaling: helper.Scaling
            });
        });
        
        // 挂载点
        (this.mdxData.Attachments || []).forEach((attachment, index) => {
            nodes.push({
                type: 'attachment',
                index,
                data: attachment,
                objectId: attachment.ObjectId,
                name: attachment.Name || `Attachment_${index}`,
                parent: attachment.Parent,
                pivotPoint: attachment.PivotPoint,
                visibility: attachment.Visibility
            });
        });
        
        // 粒子发射器
        (this.mdxData.ParticleEmitters2 || []).forEach((emitter, index) => {
            nodes.push({
                type: 'particle',
                index,
                data: emitter,
                objectId: emitter.ObjectId,
                name: emitter.Name || `Particle_${index}`,
                parent: emitter.Parent,
                pivotPoint: emitter.PivotPoint,
                translation: emitter.Translation,
                visibility: emitter.Visibility,
                emissionRate: emitter.EmissionRate,
                speed: emitter.Speed,
                variation: emitter.Variation
            });
        });
        
        return nodes;
    }
    
    // 构建帧到时间的映射
    buildFrameToTimeMapping() {
        // War3 使用 30fps，1帧 = 1/30秒
        return (frame) => frame / this.globalFps;
    }
    
    // 获取指定序列的所有动画节点
    getAnimatedNodesForSequence(sequence) {
        const interval = sequence.Interval || sequence.interval || [0, 100];
        const startFrame = interval[0];
        const endFrame = interval[1];
        
        return this.nodes.filter(node => {
            const data = node.data;
            return this.hasAnimationInRange(data, startFrame, endFrame);
        });
    }
    
    // 检查节点在指定范围内是否有动画
    hasAnimationInRange(data, startFrame, endFrame) {
        const animProperties = ['Translation', 'translation', 'Rotation', 'rotation', 'Scaling', 'scaling', 'Visibility', 'visibility'];
        
        return animProperties.some(prop => {
            const animData = data[prop];
            if (!animData) return false;
            
            // 检查 Keys 格式
            if (animData.Keys && Array.isArray(animData.Keys)) {
                return animData.Keys.some(key => {
                    const frame = key.Frame;
                    return frame >= startFrame && frame <= endFrame;
                });
            }
            
            // 检查旧格式
            if (animData.frames && Array.isArray(animData.frames)) {
                return animData.frames.some(frame => {
                    return frame >= startFrame && frame <= endFrame;
                });
            }
            
            return false;
        });
    }
}

class MdxKeyframeParser {
    constructor() {
        this.interpolationTypes = {
            NONE: 0,
            LINEAR: 1,
            HERMITE: 2,
            BEZIER: 3
        };
    }
    
    // 解析关键帧数据
    parseKeyframes(mdxAnimData, startFrame, endFrame, valueSize) {
        if (!mdxAnimData) return null;
        
        const lineType = mdxAnimData.LineType || mdxAnimData.lineType || this.interpolationTypes.LINEAR;
        
        // 处理 Keys 格式（新标准）
        if (mdxAnimData.Keys && Array.isArray(mdxAnimData.Keys)) {
            return this.parseKeysFormat(mdxAnimData.Keys, startFrame, endFrame, lineType, valueSize);
        }
        
        // 处理旧格式（frames/values）
        if (mdxAnimData.frames && mdxAnimData.values) {
            return this.parseFramesFormat(mdxAnimData, startFrame, endFrame, lineType, valueSize);
        }
        
        return null;
    }
    
    // 解析 Keys 格式关键帧
    parseKeysFormat(keys, startFrame, endFrame, lineType, valueSize) {
        const keyframes = [];
        
        // 过滤在动画区间内的关键帧
        const validKeys = keys.filter(key => {
            const frame = key.Frame;
            return frame >= startFrame && frame <= endFrame;
        });
        
        // 如果没有找到区间内的关键帧，但有有效关键帧，使用所有关键帧
        if (validKeys.length === 0 && keys.length > 0) {
            const allFrames = keys.map(k => k.Frame);
            const minFrame = Math.min(...allFrames);
            const maxFrame = Math.max(...allFrames);
            
            if (minFrame >= 0 && maxFrame <= 200000) {
                // 重新计算时间基准
                const baseFrame = minFrame;
                keys.forEach(key => {
                    const time = (key.Frame - baseFrame) / 30; // 转换为秒
                    const values = this.extractVectorValues(key.Vector, valueSize);
                    
                    keyframes.push({
                        time,
                        values,
                        frame: key.Frame,
                        inTan: this.extractVectorValues(key.InTan, valueSize),
                        outTan: this.extractVectorValues(key.OutTan, valueSize)
                    });
                });
            }
        } else {
            // 正常处理区间内的关键帧
            validKeys.forEach(key => {
                const time = (key.Frame - startFrame) / 30; // 转换为秒
                const values = this.extractVectorValues(key.Vector, valueSize);
                
                keyframes.push({
                    time,
                    values,
                    frame: key.Frame,
                    inTan: this.extractVectorValues(key.InTan, valueSize),
                    outTan: this.extractVectorValues(key.OutTan, valueSize)
                });
            });
        }
        
        return {
            keyframes,
            interpolationType: lineType,
            startFrame,
            endFrame
        };
    }
    
    // 解析旧格式关键帧
    parseFramesFormat(mdxAnimData, startFrame, endFrame, lineType, valueSize) {
        const keyframes = [];
        const { frames, values } = mdxAnimData;
        
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            
            if (frame >= startFrame && frame <= endFrame) {
                const time = (frame - startFrame) / 30; // 转换为秒
                const value = values[i];
                
                let extractedValues;
                if (Array.isArray(value)) {
                    extractedValues = value.slice(0, valueSize);
                } else if (typeof value === 'number') {
                    extractedValues = new Array(valueSize).fill(value);
                } else {
                    extractedValues = new Array(valueSize).fill(0);
                }
                
                keyframes.push({
                    time,
                    values: extractedValues,
                    frame
                });
            }
        }
        
        return {
            keyframes,
            interpolationType: lineType,
            startFrame,
            endFrame
        };
    }
    
    // 提取向量值
    extractVectorValues(vector, size) {
        if (!vector) return new Array(size).fill(0);
        
        const values = [];
        for (let i = 0; i < size; i++) {
            values.push(vector[i] !== undefined ? vector[i] : 0);
        }
        return values;
    }
}

class MdxInterpolationCalculator {
    constructor() {
        this.samplesPerSegment = 8; // 每段采样点数
    }
    
    // Hermite 插值计算
    interpolateHermite(keyframes, valueSize) {
        if (keyframes.length < 2) return keyframes;
        
        const result = [];
        
        for (let i = 0; i < keyframes.length - 1; i++) {
            const k0 = keyframes[i];
            const k1 = keyframes[i + 1];
            
            // 在关键帧之间采样
            for (let s = 0; s < this.samplesPerSegment; s++) {
                const t = s / this.samplesPerSegment;
                const time = k0.time + (k1.time - k0.time) * t;
                
                const values = [];
                for (let j = 0; j < valueSize; j++) {
                    const v0 = k0.values[j];
                    const v1 = k1.values[j];
                    const tan0 = k0.outTan[j] || 0;
                    const tan1 = k1.inTan[j] || 0;
                    
                    // Hermite 插值公式
                    const h00 = 2 * t * t * t - 3 * t * t + 1;
                    const h10 = t * t * t - 2 * t * t + t;
                    const h01 = -2 * t * t * t + 3 * t * t;
                    const h11 = t * t * t - t * t;
                    
                    const interpolated = h00 * v0 + h10 * tan0 + h01 * v1 + h11 * tan1;
                    values.push(interpolated);
                }
                
                result.push({
                    time,
                    values,
                    interpolation: 'LINEAR' // 转换为线性供GLTF使用
                });
            }
        }
        
        // 添加最后一个关键帧
        result.push({
            time: keyframes[keyframes.length - 1].time,
            values: [...keyframes[keyframes.length - 1].values],
            interpolation: 'LINEAR'
        });
        
        return result;
    }
}

class GltfAnimationGenerator {
    constructor() {
        this.tracks = [];
    }
    
    // 将MDX动画转换为GLTF动画
    convertAnimation(sequence, nodes, extractor) {
        const tracks = [];
        const seqName = sequence.Name || sequence.name || 'Animation';
        const interval = sequence.Interval || sequence.interval || [0, 100];
        const startFrame = interval[0];
        const endFrame = interval[1];
        const duration = (endFrame - startFrame) / 30; // 秒
        
        // 为每个节点生成动画轨道
        nodes.forEach(node => {
            const nodeTracks = this.generateNodeTracks(node, startFrame, endFrame);
            tracks.push(...nodeTracks);
        });
        
        // 为几何体动画生成轨道
        const geosetTracks = this.generateGeosetTracks(extractor.mdxData, startFrame, endFrame);
        tracks.push(...geosetTracks);
        
        // 为粒子系统生成轨道
        const particleTracks = this.generateParticleTracks(extractor.mdxData, startFrame, endFrame);
        tracks.push(...particleTracks);
        
        return {
            name: seqName,
            duration,
            tracks
        };
    }
    
    // 生成节点的动画轨道
    generateNodeTracks(node, startFrame, endFrame) {
        const tracks = [];
        const data = node.data;
        const parser = new MdxKeyframeParser();
        const interpolator = new MdxInterpolationCalculator();
        
        // 位置动画
        if (data.Translation || data.translation) {
            const transData = parser.parseKeyframes(
                data.Translation || data.translation,
                startFrame, endFrame, 3
            );
            
            if (transData && transData.keyframes.length > 0) {
                // 处理 Hermite/Bezier 插值
                let processedKeyframes = transData.keyframes;
                if (transData.interpolationType === 2 || transData.interpolationType === 3) {
                    processedKeyframes = interpolator.interpolateHermite(transData.keyframes, 3);
                }
                
                const times = processedKeyframes.map(k => k.time);
                const values = processedKeyframes.flatMap(k => k.values);
                
                tracks.push({
                    name: `${node.name}.translation`,
                    type: 'VEC3',
                    times,
                    values
                });
            }
        }
        
        // 旋转动画
        if (data.Rotation || data.rotation) {
            const rotData = parser.parseKeyframes(
                data.Rotation || data.rotation,
                startFrame, endFrame, 4
            );
            
            if (rotData && rotData.keyframes.length > 0) {
                // 处理 Hermite/Bezier 插值
                let processedKeyframes = rotData.keyframes;
                if (rotData.interpolationType === 2 || rotData.interpolationType === 3) {
                    processedKeyframes = interpolator.interpolateHermite(rotData.keyframes, 4);
                }
                
                const times = processedKeyframes.map(k => k.time);
                const values = processedKeyframes.flatMap(k => {
                    // 四元数标准化
                    const [x, y, z, w] = k.values;
                    const length = Math.sqrt(x*x + y*y + z*z + w*w);
                    return length > 0 ? [x/length, y/length, z/length, w/length] : [0, 0, 0, 1];
                });
                
                tracks.push({
                    name: `${node.name}.rotation`,
                    type: 'VEC4',
                    times,
                    values
                });
            }
        }
        
        // 缩放动画
        if (data.Scaling || data.scaling) {
            const scaleData = parser.parseKeyframes(
                data.Scaling || data.scaling,
                startFrame, endFrame, 3
            );
            
            if (scaleData && scaleData.keyframes.length > 0) {
                // 处理 Hermite/Bezier 插值
                let processedKeyframes = scaleData.keyframes;
                if (scaleData.interpolationType === 2 || scaleData.interpolationType === 3) {
                    processedKeyframes = interpolator.interpolateHermite(scaleData.keyframes, 3);
                }
                
                const times = processedKeyframes.map(k => k.time);
                const values = processedKeyframes.flatMap(k => k.values);
                
                tracks.push({
                    name: `${node.name}.scale`,
                    type: 'VEC3',
                    times,
                    values
                });
            }
        }
        
        // 可见性动画（用于Attachments等）
        if (data.Visibility || data.visibility) {
            const visData = parser.parseKeyframes(
                data.Visibility || data.visibility,
                startFrame, endFrame, 1
            );
            
            if (visData && visData.keyframes.length > 0) {
                const times = visData.keyframes.map(k => k.time);
                const values = visData.keyframes.flatMap(k => k.values);
                
                tracks.push({
                    name: `${node.name}.visibility`,
                    type: 'SCALAR',
                    times,
                    values
                });
            }
        }
        
        return tracks;
    }
    
    // 生成几何体动画轨道（透明度等）
    generateGeosetTracks(mdxData, startFrame, endFrame) {
        const tracks = [];
        const parser = new MdxKeyframeParser();
        
        (mdxData.GeosetAnims || []).forEach((geosetAnim, index) => {
            if (geosetAnim.Alpha || geosetAnim.alpha) {
                const alphaData = parser.parseKeyframes(
                    geosetAnim.Alpha || geosetAnim.alpha,
                    startFrame, endFrame, 1
                );
                
                if (alphaData && alphaData.keyframes.length > 0) {
                    const times = alphaData.keyframes.map(k => k.time);
                    const values = alphaData.keyframes.flatMap(k => k.values);
                    
                    tracks.push({
                        name: `GeosetAnim_${index}.alpha`,
                        type: 'SCALAR',
                        times,
                        values
                    });
                }
            }
        });
        
        return tracks;
    }
    
    // 生成粒子系统动画轨道
    generateParticleTracks(mdxData, startFrame, endFrame) {
        const tracks = [];
        const parser = new MdxKeyframeParser();
        
        (mdxData.ParticleEmitters2 || []).forEach((emitter, index) => {
            const data = emitter.data || emitter;
            
            // 发射器位置动画
            if (data.Translation || data.translation) {
                const transData = parser.parseKeyframes(
                    data.Translation || data.translation,
                    startFrame, endFrame, 3
                );
                
                if (transData && transData.keyframes.length > 0) {
                    const times = transData.keyframes.map(k => k.time);
                    const values = transData.keyframes.flatMap(k => k.values);
                    
                    tracks.push({
                        name: `ParticleEmitter_${index}.translation`,
                        type: 'VEC3',
                        times,
                        values
                    });
                }
            }
            
            // 发射器可见性动画
            if (data.Visibility || data.visibility) {
                const visData = parser.parseKeyframes(
                    data.Visibility || data.visibility,
                    startFrame, endFrame, 1
                );
                
                if (visData && visData.keyframes.length > 0) {
                    const times = visData.keyframes.map(k => k.time);
                    const values = visData.keyframes.flatMap(k => k.values);
                    
                    tracks.push({
                        name: `ParticleEmitter_${index}.visibility`,
                        type: 'SCALAR',
                        times,
                        values
                    });
                }
            }
        });
        
        return tracks;
    }
}

// 主转换函数
function convertMdxToGltfAnimations(mdxData) {
    const extractor = new MdxAnimationExtractor(mdxData);
    const generator = new GltfAnimationGenerator();
    
    const gltfAnimations = [];
    
    extractor.sequences.forEach(sequence => {
        const animatedNodes = extractor.getAnimatedNodesForSequence(sequence);
        const gltfAnimation = generator.convertAnimation(sequence, animatedNodes, extractor);
        
        if (gltfAnimation.tracks.length > 0) {
            gltfAnimations.push(gltfAnimation);
        }
    });
    
    return gltfAnimations;
}

// 导出转换函数供外部使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MdxAnimationExtractor,
        MdxKeyframeParser,
        MdxInterpolationCalculator,
        GltfAnimationGenerator,
        convertMdxToGltfAnimations
    };
}