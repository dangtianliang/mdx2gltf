// 分析 MDX 动画数据结构并打印到控制台
function analyzeMdxAnimations(model) {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║          MDX 动画数据结构分析                                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    // 1. 分析 Sequences (动画序列)
    const sequences = model.Sequences || model.sequences || [];
    console.log(`📋 Sequences (动画序列): ${sequences.length} 个`);
    
    sequences.forEach((seq, i) => {
        console.log(`\n  [${i}] Sequence: ${seq.name || seq.Name || 'unnamed'}`);
        console.log(`      Interval: ${JSON.stringify(seq.interval || seq.Interval)}`);
        console.log(`      FPS: ${seq.fps || seq.FPS || 30}`);
        
        // 打印完整的 Sequence 对象
        console.log('      Full Object:', JSON.stringify(seq, null, 2).substring(0, 500));
    });
    
    // 2. 分析 GlobalSequences (全局序列)
    const globalSeqs = model.GlobalSequences || model.globalSequences || [];
    console.log(`\n🌍 GlobalSequences: ${globalSeqs.length} 个`);
    console.log('   ', globalSeqs);
    
    // 3. 分析 Bones (骨骼及其动画)
    const bones = model.Bones || model.bones || [];
    console.log(`\n🦴 Bones (骨骼): ${bones.length} 个`);
    
    bones.forEach((bone, i) => {
        const boneName = bone.name || bone.Name || `Bone_${i}`;
        console.log(`\n  [${i}] Bone: ${boneName}`);
        console.log(`      ObjectId: ${bone.objectId || bone.ObjectId}`);
        console.log(`      ParentId: ${bone.parentId || bone.ParentId}`);
        console.log(`      PivotPoint: ${JSON.stringify(bone.PivotPoint || bone.pivotPoint)}`);
        
        // 分析骨骼动画数据
        const trans = bone.Translation || bone.translation;
        const rot = bone.Rotation || bone.rotation;
        const scale = bone.Scaling || bone.scaling;
        
        if (trans) {
            console.log(`      📍 Translation (位置动画):`);
            printAnimationData(trans);
        }
        if (rot) {
            console.log(`      🔄 Rotation (旋转动画):`);
            printAnimationData(rot);
        }
        if (scale) {
            console.log(`      📏 Scaling (缩放动画):`);
            printAnimationData(scale);
        }
        
        // 如果没有动画数据，打印完整 bone 对象
        if (!trans && !rot && !scale) {
            console.log('      Full Bone Object:', JSON.stringify(bone, null, 2).substring(0, 300));
        }
    });
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║          MDX 动画分析完成                                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    // 返回分析结果供后续使用
    return { sequences, bones, globalSeqs };
}

// 打印动画数据结构
function printAnimationData(animData) {
    if (!animData) {
        console.log('        (无数据)');
        return;
    }
    
    console.log(`        type: ${animData.type !== undefined ? animData.type : 'N/A'}`);
    console.log(`        interpolationType: ${animData.interpolationType !== undefined ? animData.interpolationType : 'N/A'}`);
    console.log(`        globalSequenceId: ${animData.globalSequenceId !== undefined ? animData.globalSequenceId : 'N/A'}`);
    
    // 检查 frames/values 格式
    if (animData.frames) {
        console.log(`        frames: ${animData.frames.length} 个关键帧`);
        console.log(`        values: ${animData.values ? animData.values.length : 0} 个值`);
        if (animData.frames.length > 0) {
            console.log(`        第一帧: frame=${animData.frames[0]}, value=${JSON.stringify(animData.values ? animData.values[0] : 'N/A')}`);
        }
        if (animData.frames.length > 1) {
            console.log(`        最后一帧: frame=${animData.frames[animData.frames.length-1]}, value=${JSON.stringify(animData.values ? animData.values[animData.values.length-1] : 'N/A')}`);
        }
    }
    // 检查 keys 格式
    else if (animData.keys) {
        console.log(`        keys: ${animData.keys.length} 个关键帧`);
        if (animData.keys.length > 0) {
            const first = animData.keys[0];
            console.log(`        第一帧: ${JSON.stringify(first)}`);
        }
    }
    else {
        console.log('        Full Data:', JSON.stringify(animData).substring(0, 200));
    }
}

/**
 * 解析 MDX 动画数据为 Three.js 关键帧
 * 支持两种格式:
 * 1. 旧格式: { frames: [...], values: [...] }
 * 2. 新格式: { Keys: [{Frame, Vector, InTan, OutTan}, ...], LineType, GlobalSeqId }
 */
function parseMdxAnimation(mdxAnim, startFrame, endFrame, fps, valueSize) {
    const times = [];
    const values = [];
    
    if (!mdxAnim) {
        return { times, values, interpolationType: 0 };
    }
    
    // 获取插值类型 (0=None, 1=Linear, 2=Hermite, 3=Bezier)
    const lineType = mdxAnim.LineType !== undefined ? mdxAnim.LineType : 
                     mdxAnim.lineType !== undefined ? mdxAnim.lineType : 1;
    
    // ═══════════════════════════════════════════════════════════
    // 处理新格式: Keys 数组
    // ═══════════════════════════════════════════════════════════
    if (mdxAnim.Keys && Array.isArray(mdxAnim.Keys) && mdxAnim.Keys.length > 0) {
        const totalKeys = mdxAnim.Keys.length;
        const firstKeyFrame = mdxAnim.Keys[0].Frame;
        const lastKeyFrame = mdxAnim.Keys[totalKeys - 1].Frame;
        let keysInRange = 0;
        
        // 检查关键帧时间是否在动画序列范围内
        const hasKeysInRange = mdxAnim.Keys.some(key => key.Frame >= startFrame && key.Frame <= endFrame);
        
        // 如果没有关键帧在范围内，但关键帧时间在合理范围内，使用所有关键帧
        // 这种情况发生在 War3 模型的关键帧时间是全局时间，但动画序列的 Interval 不匹配
        if (!hasKeysInRange && firstKeyFrame >= 0 && lastKeyFrame <= 200000) {
            console.warn(`    ⚠️ 关键帧时间不在动画序列范围内，使用所有关键帧并重新计算时间`);
            console.warn(`       动画序列范围[${startFrame}-${endFrame}], 关键帧范围[${firstKeyFrame}-${lastKeyFrame}]`);
            
            // 使用所有关键帧，时间相对于关键帧的最小时间
            const baseFrame = firstKeyFrame;
            for (const key of mdxAnim.Keys) {
                const frame = key.Frame;
                const time = (frame - baseFrame) / fps;
                times.push(time);
                
                // 提取 Vector 值 (x,y,z 或 x,y,z,w)
                const vec = key.Vector;
                if (vec && typeof vec === 'object') {
                    const vecValues = [];
                    for (let i = 0; i < valueSize; i++) {
                        vecValues.push(vec[i] !== undefined ? vec[i] : 0);
                    }
                    values.push(...vecValues);
                }
            }
        } else {
            // 正常处理：只使用在动画序列范围内的关键帧
            for (const key of mdxAnim.Keys) {
                const frame = key.Frame;
                
                // 过滤在动画范围内的关键帧
                if (frame >= startFrame && frame <= endFrame) {
                    keysInRange++;
                    const time = (frame - startFrame) / fps;
                    times.push(time);
                    
                    // 提取 Vector 值 (x,y,z 或 x,y,z,w)
                    const vec = key.Vector;
                    if (vec && typeof vec === 'object') {
                        // Vector 格式: {"0": x, "1": y, "2": z, "3": w}
                        const vecValues = [];
                        for (let i = 0; i < valueSize; i++) {
                            vecValues.push(vec[i] !== undefined ? vec[i] : 0);
                        }
                        values.push(...vecValues);
                    }
                }
            }
            
            // 调试日志：如果关键帧被过滤掉了，打印详细信息
            if (times.length === 0 && totalKeys > 0) {
                console.warn(`    ⚠️ 所有关键帧被过滤! 范围[${startFrame}-${endFrame}], 关键帧范围[${firstKeyFrame}-${lastKeyFrame}], 总关键帧数=${totalKeys}`);
            }
        }
        
        // Hermite/Bezier 插值需要采样转换为 Linear
        // 因为 GLTF 只支持 Linear 插值
        if (lineType === 2 || lineType === 3) {
            return sampleHermiteToLinear(times, values, valueSize, fps);
        }
        
        return { times, values, interpolationType: lineType };
    }
    
    // ═══════════════════════════════════════════════════════════
    // 处理旧格式: frames/values 数组
    // ═══════════════════════════════════════════════════════════
    if (mdxAnim.frames && mdxAnim.values) {
        const totalFrames = mdxAnim.frames.length;
        const firstFrame = mdxAnim.frames[0];
        const lastFrame = mdxAnim.frames[totalFrames - 1];
        
        // 检查关键帧时间是否在动画序列范围内
        const hasKeysInRange = mdxAnim.frames.some(frame => frame >= startFrame && frame <= endFrame);
        
        // 如果没有关键帧在范围内，但关键帧时间在合理范围内，使用所有关键帧
        if (!hasKeysInRange && firstFrame >= 0 && lastFrame <= 200000) {
            console.warn(`    ⚠️ 关键帧时间不在动画序列范围内(旧格式)，使用所有关键帧并重新计算时间`);
            console.warn(`       动画序列范围[${startFrame}-${endFrame}], 关键帧范围[${firstFrame}-${lastFrame}]`);
            
            // 使用所有关键帧，时间相对于关键帧的最小时间
            const baseFrame = firstFrame;
            for (let i = 0; i < mdxAnim.frames.length; i++) {
                const frame = mdxAnim.frames[i];
                const time = (frame - baseFrame) / fps;
                times.push(time);
                
                const value = mdxAnim.values[i];
                if (Array.isArray(value)) {
                    values.push(...value.slice(0, valueSize));
                } else if (typeof value === 'number') {
                    values.push(value);
                }
            }
        } else {
            // 正常处理：只使用在动画序列范围内的关键帧
            for (let i = 0; i < mdxAnim.frames.length; i++) {
                const frame = mdxAnim.frames[i];
                
                if (frame >= startFrame && frame <= endFrame) {
                    const time = (frame - startFrame) / fps;
                    times.push(time);
                    
                    const value = mdxAnim.values[i];
                    if (Array.isArray(value)) {
                        values.push(...value.slice(0, valueSize));
                    } else if (typeof value === 'number') {
                        values.push(value);
                    }
                }
            }
            
            // 调试日志：如果关键帧被过滤掉了，打印详细信息
            if (times.length === 0 && totalFrames > 0) {
                console.warn(`    ⚠️ 所有关键帧被过滤! 范围[${startFrame}-${endFrame}], 关键帧范围[${firstFrame}-${lastFrame}], 总关键帧数=${totalFrames}`);
            }
        }
        
        return { times, values, interpolationType: lineType };
    }
    
    // 格式不支持
    return { times, values, interpolationType: 0 };
}

/**
 * Hermite 插值采样为 Linear
 * GLTF 不支持 Hermite 插值，需要密集采样转换为 Linear
 */
function sampleHermiteToLinear(times, values, valueSize, fps) {
    if (times.length < 2) {
        return { times, values, interpolationType: 1 };
    }
    
    const newTimes = [];
    const newValues = [];
    
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

// 将 Warcraft 3 四元数 (x, y, z, w) 转换为 Three.js 格式
// War3 使用 (x, y, z, w) 顺序，和 Three.js 相同
function convertRotationValues(values) {
    // War3 四元数和 Three.js 兼容
    // 但 War3 使用左手坐标系，可能需要调整
    const result = [];
    for (let i = 0; i < values.length; i += 4) {
        result.push(
            values[i],     // x
            values[i + 1], // y  
            values[i + 2], // z
            values[i + 3]  // w
        );
    }
    return result;
}

// 从骨骼数据中提取动画关键帧
function extractBoneAnimations(bone, startFrame, endFrame, fps) {
    const tracks = [];
    // 命名优先级必须与 createSkeleton 中完全一致！
    const boneName = bone.name || bone.Name || 
                     (bone.ObjectId !== undefined ? `Bone_${bone.ObjectId}` : 
                      (bone.objectId !== undefined ? `Bone_${bone.objectId}` : `bone_0`));
    
    // 获取骨骼动画数据
    const translationAnim = bone.Translation || bone.translation;
    const rotationAnim = bone.Rotation || bone.rotation;
    const scalingAnim = bone.Scaling || bone.scaling;
    
    // 1. 位置动画 (Vector3)
    if (translationAnim) {
        const posData = parseMdxAnimation(translationAnim, startFrame, endFrame, fps, 3);
        if (posData.times.length > 0 && posData.values.length >= posData.times.length * 3) {
            // 确保值数组长度正确
            const validValues = posData.values.slice(0, posData.times.length * 3);
            tracks.push(new THREE.VectorKeyframeTrack(
                `${boneName}.position`,
                posData.times,
                validValues
            ));
            console.log(`  [动画] ${boneName}.position: ${posData.times.length} 关键帧`);
        }
    }
    
    // 2. 旋转动画 (Quaternion: x, y, z, w)
    if (rotationAnim) {
        const rotData = parseMdxAnimation(rotationAnim, startFrame, endFrame, fps, 4);
        if (rotData.times.length > 0 && rotData.values.length >= rotData.times.length * 4) {
            const validValues = rotData.values.slice(0, rotData.times.length * 4);
            // War3 四元数直接使用
            tracks.push(new THREE.QuaternionKeyframeTrack(
                `${boneName}.quaternion`,
                rotData.times,
                validValues
            ));
            console.log(`  [动画] ${boneName}.quaternion: ${rotData.times.length} 关键帧`);
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
            console.log(`  [动画] ${boneName}.scale: ${scaleData.times.length} 关键帧`);
        }
    }
    
    return tracks;
}

// 转换 MDX 动画数据为 Three.js AnimationClip
function convertAnimationsToThreeJS(sequences, bones) {
    console.log('=== 转换 MDX 动画到 Three.js ===');
    console.log(`序列: ${sequences ? sequences.length : 0} 个, 骨骼: ${bones ? bones.length : 0} 个`);
    
    // 发送日志记录输入数据
    sendLog('convert_animations_input', '动画转换输入数据', {
        sequenceCount: sequences ? sequences.length : 0,
        boneCount: bones ? bones.length : 0,
        sequences: sequences ? sequences.map((s, i) => ({
            index: i,
            name: s.name || s.Name,
            interval: s.interval || s.Interval
        })) : [],
        bones: bones ? bones.map((b, i) => ({
            index: i,
            name: b.name || b.Name,
            parent: b.parent !== undefined ? b.parent : (b.Parent !== undefined ? b.Parent : -1),
            hasTranslation: !!(b.Translation || b.translation),
            hasRotation: !!(b.Rotation || b.rotation),
            hasScaling: !!(b.Scaling || b.scaling)
        })) : []
    });
    
    if (!sequences || !Array.isArray(sequences) || sequences.length === 0) {
        console.warn('❌ 没有动画序列');
        return [];
    }
    
    if (!bones || !Array.isArray(bones) || bones.length === 0) {
        console.warn('❌ 没有骨骼数据');
        return [];
    }
    
    const clips = [];
    const fps = 30; // War3 默认 30fps
    
    sequences.forEach((seq, seqIndex) => {
        const seqName = seq.name || seq.Name || `Sequence_${seqIndex}`;
        const interval = seq.interval || seq.Interval || [0, 100];
        const startFrame = interval[0];
        const endFrame = interval[1];
        const duration = (endFrame - startFrame) / fps;
        
        console.log(`\n处理序列: ${seqName} (${startFrame}-${endFrame}, ${duration.toFixed(2)}秒)`);
        
        const allTracks = [];
        let totalBoneTracksChecked = 0;
        
        // 为每个骨骼提取动画
        bones.forEach((bone, boneIndex) => {
            const boneName = bone.name || bone.Name || `Bone_${boneIndex}`;
            const hasTranslation = !!(bone.Translation || bone.translation);
            const hasRotation = !!(bone.Rotation || bone.rotation);
            const hasScaling = !!(bone.Scaling || bone.scaling);
            
            if (hasTranslation || hasRotation || hasScaling) {
                totalBoneTracksChecked++;
                console.log(`  检查骨骼 [${boneIndex}] ${boneName}: 位置=${hasTranslation}, 旋转=${hasRotation}, 缩放=${hasScaling}`);
            }
            
            const boneTracks = extractBoneAnimations(bone, startFrame, endFrame, fps);
            if (boneTracks.length > 0) {
                console.log(`  ✅ 骨骼 [${boneIndex}] ${boneName}: 提取了 ${boneTracks.length} 条轨迹`);
            }
            allTracks.push(...boneTracks);
        });
        
        console.log(`  总计: 检查了 ${totalBoneTracksChecked} 个骨骼的动画数据，提取了 ${allTracks.length} 条轨迹`);
        
        if (allTracks.length > 0) {
            const clip = new THREE.AnimationClip(seqName, duration, allTracks);
            clips.push(clip);
            console.log(`✅ 动画: ${seqName}, ${allTracks.length} 条轨迹`);
        } else {
            console.warn(`⚠️ ${seqName} 无轨迹 (检查了 ${totalBoneTracksChecked} 个骨骼)`);
        }
    });
    
    console.log(`\n=== 动画转换完成: ${clips.length} 个动画 ===`);
    
    // 发送日志记录转换完成的详细结果
    sendLog('convert_animations_result', '动画转换完成', {
        clipCount: clips.length,
        clips: clips.map((clip, i) => ({
            index: i,
            name: clip.name,
            duration: clip.duration,
            trackCount: clip.tracks ? clip.tracks.length : 0,
            tracks: clip.tracks ? clip.tracks.map(t => ({
                name: t.name,
                timesCount: t.times ? t.times.length : 0,
                valuesCount: t.values ? t.values.length : 0
            })) : []
        }))
    });
    
    return clips;
}

// 加载 GLTF 数据到预览场景
function loadGltfPreview(gltfData) {
    console.log('=== 加载 GLTF 预览 ===');
    
    // 显示加载中
    document.getElementById('gltf-loading').style.display = 'block';
    
    // 清除之前的模型
    if (gltfModel) {
        gltfScene.remove(gltfModel);
        gltfModel = null;
    }
    
    // 重置动画
    gltfAnimations = [];
    gltfMixer = null;
    currentAnimationAction = null;
    isGltfPlaying = false;
    
    // 使用 GLTFLoader 加载数据
    const loader = new THREE.GLTFLoader();
    
    let blobUrl = null;
    try {
        // 将 GLTF 数据转换为 Blob URL
        let blob;
        if (typeof gltfData === 'string') {
            blob = new Blob([gltfData], { type: 'application/json' });
        } else {
            blob = new Blob([JSON.stringify(gltfData)], { type: 'application/json' });
        }
        blobUrl = URL.createObjectURL(blob);
        
        loader.load(blobUrl, (gltf) => {
            console.log('GLTF 加载成功:', gltf);
            // 记录 GLTF 加载成功
            try { sendLog('gltf_loaded', 'GLTF loaded into preview', { animations: gltf.animations ? gltf.animations.length : 0 }); } catch (e) { console.warn('sendLog failed', e); }
            
            // 添加模型到场景
            gltfModel = gltf.scene;
            gltfScene.add(gltfModel);
            
            // 调整相机位置以适应模型
            fitCameraToModel(gltfModel);
            
            // 设置动画
            if (gltf.animations && gltf.animations.length > 0) {
                gltfAnimations = gltf.animations;
                gltfMixer = new THREE.AnimationMixer(gltfModel);
                
                console.log('✅ 发现动画:', gltfAnimations.length, '个');
                console.log('动画数据:', gltfAnimations);
                
                // 验证动画是否是有效的 AnimationClip
                gltfAnimations.forEach((anim, i) => {
                    console.log(`动画 [${i}] ${anim.name}:`);
                    console.log('   isAnimationClip:', anim instanceof THREE.AnimationClip);
                    console.log('   hasTracks:', !!anim.tracks);
                    console.log('   tracksCount:', anim.tracks ? anim.tracks.length : 0);
                    console.log('   duration:', anim.duration);
                    try { sendLog('gltf_animation_info', 'Animation clip info', { index: i, name: anim.name, tracks: anim.tracks ? anim.tracks.length : 0, duration: anim.duration }); } catch (e) { console.warn('sendLog failed', e); }
                });
                
                // 列出场景中所有对象名称，用于匹配动画轨迹
                const allNames = [];
                const boneNames = [];
                gltfModel.traverse((obj) => {
                    allNames.push(obj.name);
                    if (obj.isBone || obj.isSkinnedMesh) {
                        boneNames.push(obj.name);
                    }
                });
                console.log('📋 场景中的所有对象名称:', allNames);
                console.log('🦴 场景中的骨骼:', boneNames);
                
                // 检查每个动画的轨迹是否能匹配到场景中的对象
                gltfAnimations.forEach((anim, i) => {
                    console.log(`\n📽️ 动画 [${i}] ${anim.name}:`);
                    console.log('   动画对象:', anim);
                    if (anim.tracks) {
                        console.log('   轨迹数量:', anim.tracks.length);
                        anim.tracks.forEach((track, trackIndex) => {
                            const targetName = track.name.split('.')[0];
                            const propertyName = track.name.split('.')[1];
                            const targetObj = gltfScene.getObjectByName(targetName);
                            console.log(`   轨迹 [${trackIndex}]: ${track.name}`);
                            console.log(`      targetName: ${targetName}, property: ${propertyName}`);
                            console.log(`      匹配结果: ${targetObj ? '✅ 找到' : '❌ 未找到'}`);
                            try { sendLog('gltf_track_match', 'Track match check', { animationIndex: i, trackIndex: trackIndex, trackName: track.name, targetName: targetName, matched: !!targetObj, timesCount: track.times ? track.times.length : 0 }); } catch (e) { console.warn('sendLog failed', e); }
                            if (targetObj) {
                                console.log(`      对象类型: ${targetObj.type}, isBone: ${targetObj.isBone}`);
                            }
                            console.log(`      times: ${track.times ? track.times.length : 0} 个关键帧`);
                            console.log(`      values: ${track.values ? track.values.length : 0} 个值`);
                            if (track.times && track.times.length > 0) {
                                console.log(`      时间范围: [${track.times[0]}, ${track.times[track.times.length - 1]}]`);
                            }
                        });
                    } else {
                        console.warn('   ⚠️ 动画没有 tracks 属性');
                        try { sendLog('gltf_animation_no_tracks', 'Animation clip has no tracks', { animationIndex: i, name: anim.name }); } catch (e) { console.warn('sendLog failed', e); }
                    }
                });
                
                // 填充动画选择器
                const animSelector = document.getElementById('anim-selector');
                animSelector.innerHTML = '';
                gltfAnimations.forEach((anim, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = anim.name || `动画 ${index + 1}`;
                    animSelector.appendChild(option);
                });
                
                // 显示动画控制
                document.getElementById('animation-controls').style.display = 'block';
                document.getElementById('anim-info').textContent = 
                    `共 ${gltfAnimations.length} 个动画，当前: ${gltfAnimations[0].name || '动画 1'}`;
                
                // 自动播放第一个动画
                console.log('▶️ 自动播放第一个动画...');
                try { sendLog('gltf_autoplay_start', 'Auto playing first animation', { index: 0, name: gltfAnimations[0] ? gltfAnimations[0].name : null }); } catch (e) { console.warn('sendLog failed', e); }
                playAnimation(0);
                
            } else {
                console.warn('⚠️ GLTF 中没有动画数据');
                document.getElementById('animation-controls').style.display = 'none';
                document.getElementById('anim-info').textContent = '无动画';
            }
            
            // 隐藏加载中
            document.getElementById('gltf-loading').style.display = 'none';
            
            showStatus('GLTF 预览加载成功！', 'success');
            
        }, (progress) => {
            console.log('GLTF 加载进度:', progress);
        }, (error) => {
            console.error('GLTF 加载失败:', error);
            document.getElementById('gltf-loading').style.display = 'none';
            try { sendLog('gltf_load_error', 'GLTF load failed', { message: error && error.message ? error.message : String(error) }); } catch (e) { console.warn('sendLog failed', e); }
            showStatus('GLTF 预览加载失败: ' + error.message, 'error');
        });
        
    } catch (error) {
        console.error('GLTF 预览错误:', error);
        document.getElementById('gltf-loading').style.display = 'none';
        showStatus('GLTF 预览错误: ' + error.message, 'error');
    }
}

// 调整相机以适应模型
function fitCameraToModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = gltfCamera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    
    cameraZ *= 2.5; // 添加一些边距
    
    gltfCamera.position.set(center.x, center.y, center.z + cameraZ);
    gltfCamera.lookAt(center);
    
    gltfControls.target.copy(center);
    gltfControls.update();
}

// 播放指定动画
function playAnimation(index) {
    if (!gltfMixer || index < 0 || index >= gltfAnimations.length) {
        console.warn('无法播放动画: mixer或索引无效', {
            hasMixer: !!gltfMixer,
            index: index,
            animCount: gltfAnimations.length
        });
        return;
    }
    
    const animation = gltfAnimations[index];
    console.log(`▶️ 播放动画 [${index}]: ${animation.name}`);
    try { sendLog('play_request', 'Play animation requested', { index: index, name: animation.name }); } catch (e) { console.warn('sendLog failed', e); }
    console.log('动画对象详情:', {
        name: animation.name,
        duration: animation.duration,
        tracksCount: animation.tracks ? animation.tracks.length : 0,
        isAnimationClip: animation instanceof THREE.AnimationClip,
        constructor: animation.constructor.name
    });
    
    // 停止当前动画
    if (currentAnimationAction) {
        currentAnimationAction.stop();
        console.log('   停止之前的动画');
    }
    
    // 创建动画动作
    try {
        currentAnimationAction = gltfMixer.clipAction(animation);
        console.log('   clipAction 创建成功:', currentAnimationAction);
        try { sendLog('clipAction_created', 'clipAction created', { name: animation.name }); } catch (e) { console.warn('sendLog failed', e); }
    } catch (e) {
        console.error('   clipAction 创建失败:', e);
        try { sendLog('clipAction_error', 'clipAction creation failed', { error: e && e.message ? e.message : String(e), name: animation.name }); } catch (e2) { console.warn('sendLog failed', e2); }
        return;
    }
    
    // 设置动画参数
    currentAnimationAction.reset();
    currentAnimationAction.clampWhenFinished = false;
    currentAnimationAction.loop = THREE.LoopRepeat;
    
    // 播放动画
    const playResult = currentAnimationAction.play();
    console.log('   play() 返回:', playResult);
    try { sendLog('animation_play_invoked', 'Animation play invoked', { name: animation.name, playResult: String(playResult) }); } catch (e) { console.warn('sendLog failed', e); }
    
    isGltfPlaying = true;
    
    document.getElementById('anim-info').textContent = 
        `▶️ 播放中: ${animation.name || '动画 ' + (index + 1)} (${animation.duration.toFixed(2)}秒)`;
    
    console.log('✅ 动画开始播放:', animation.name, '时长:', animation.duration);
    
    // 打印动画轨迹信息
    if (animation.tracks) {
        console.log('   动画轨迹:');
        animation.tracks.forEach(track => {
            console.log(`        - ${track.name}: ${track.times.length} 关键帧`);
        });
    }
}

// 绑定动画控制事件
function bindAnimationControls() {
    // 播放按钮
    document.getElementById('anim-play-btn').addEventListener('click', () => {
        console.log('=== 播放按钮点击 ===');
        console.log('当前动画动作:', currentAnimationAction);
        console.log('动画系统状态:', {
            hasAction: !!currentAnimationAction,
            isPlaying: isGltfPlaying,
            mixer: gltfMixer
        });
        
        if (currentAnimationAction) {
            console.log('开始播放动画:', currentAnimationAction.getClip().name);
            
            // 添加sendLog调用
            sendLog('animation_play_clicked', '播放按钮点击事件', {
                animationName: currentAnimationAction.getClip().name,
                isGltfPlaying: isGltfPlaying,
                mixerExists: !!gltfMixer,
                actionExists: !!currentAnimationAction
            });
            
            try {
                currentAnimationAction.play();
                isGltfPlaying = true;
                
                // 播放后检查状态
                const playState = currentAnimationAction.isRunning();
                console.log('播放命令执行后状态:', {
                    isRunning: playState,
                    paused: currentAnimationAction.paused,
                    clipName: currentAnimationAction.getClip().name
                });
                
                sendLog('animation_play_started', '动画播放开始', {
                    animationName: currentAnimationAction.getClip().name,
                    isRunning: playState,
                    isPaused: currentAnimationAction.paused
                });
                
                // 更新UI
                document.getElementById('anim-info').textContent = 
                    `▶ 播放中: ${currentAnimationAction.getClip().name}`;
                
            } catch (error) {
                console.error('播放动画失败:', error);
                sendLog('animation_play_error', '播放动画失败', {
                    error: error.message,
                    animationName: currentAnimationAction.getClip().name
                });
            }
        } else {
            console.log('❌ 无法播放动画: 动画动作未初始化');
            sendLog('animation_play_error', '播放动画失败', {
                reason: '动画动作未初始化',
                mixerExists: !!gltfMixer,
                actionExists: !!currentAnimationAction
            });
        }
    });
    
    // 暂停按钮
    document.getElementById('anim-pause-btn').addEventListener('click', () => {
        console.log('=== 暂停按钮点击 ===');
        
        if (currentAnimationAction) {
            sendLog('animation_pause_clicked', '暂停按钮点击事件', {
                animationName: currentAnimationAction.getClip().name,
                isGltfPlaying: isGltfPlaying
            });
            
            currentAnimationAction.paused = true;
            isGltfPlaying = false;
            document.getElementById('anim-info').textContent = 
                `⏸️ 已暂停: ${currentAnimationAction.getClip().name}`;
            console.log('⏸️ 动画已暂停');
            
            sendLog('animation_paused', '动画已暂停', {
                animationName: currentAnimationAction.getClip().name
            });
        }
    });
    
    // 停止按钮
    document.getElementById('anim-stop-btn').addEventListener('click', () => {
        console.log('=== 停止按钮点击 ===');
        
        if (currentAnimationAction) {
            sendLog('animation_stop_clicked', '停止按钮点击事件', {
                animationName: currentAnimationAction.getClip().name,
                isGltfPlaying: isGltfPlaying
            });
            
            currentAnimationAction.stop();
            isGltfPlaying = false;
            document.getElementById('anim-info').textContent = 
                `⏹️ 已停止: ${currentAnimationAction.getClip().name}`;
            console.log('⏹️ 动画已停止');
            
            sendLog('animation_stopped', '动画已停止', {
                animationName: currentAnimationAction.getClip().name
            });
        }
    });
    
    // 动画选择器
    document.getElementById('anim-selector').addEventListener('change', (e) => {
        const animationIndex = parseInt(e.target.value);
        console.log('=== 动画选择器变化 ===');
        console.log('选择的动画索引:', animationIndex);
        
        sendLog('animation_selector_changed', '动画选择器变化', {
            animationIndex: animationIndex,
            animationName: gltfAnimations[animationIndex] ? gltfAnimations[animationIndex].name : '未知'
        });
        
        playAnimation(animationIndex);
    });
}