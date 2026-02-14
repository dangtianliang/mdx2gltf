/**
 * MDX 动画转换器 - 浏览器版本
 * 将 MDX 动画数据转换为 Three.js AnimationClip
 */

// 解析 MDX 动画数据为 Three.js 关键帧
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

/**
 * 转换 MDX 动画数据为 Three.js AnimationClip
 * @param {Array} sequences - 动画序列数组
 * @param {Array} bones - 骨骼数组
 * @param {Object} options - 转换选项
 * @returns {Array} Three.js 动画剪辑数组
 */
function convertAnimationsToThreeJS(sequences, bones, options = {}) {
  const {
    fps = 30,
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

  const clips = [];

  sequences.forEach((seq, seqIndex) => {
    const seqName = seq.name || seq.Name || `Sequence_${seqIndex}`;
    const interval = seq.interval || seq.Interval || [0, 100];
    const startFrame = interval[0];
    const endFrame = interval[1];
    const duration = (endFrame - startFrame) / fps;

    if (logDetails) {
      console.log(`\n处理序列: ${seqName} (${startFrame}-${endFrame}, ${duration.toFixed(2)}秒)`);
    }

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
        if (logDetails) {
          console.log(`  检查骨骼 [${boneIndex}] ${boneName}: 位置=${hasTranslation}, 旋转=${hasRotation}, 缩放=${hasScaling}`);
        }
      }

      const boneTracks = extractBoneAnimations(bone, startFrame, endFrame, fps);
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

// 向后兼容的函数调用
if (typeof window !== 'undefined') {
  window.convertAnimationsToThreeJS = convertAnimationsToThreeJS;
}

export { convertAnimationsToThreeJS, parseMdxAnimation, extractBoneAnimations };