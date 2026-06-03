import { getEndingSystemPrompt } from './endingPrompts';
import { apiUrl } from './apiClient';

/**
 * 结局路由器 — 六维雷达图面积判定法
 *
 * 维度映射（与 stateMachine 保持一致）：
 *   affection      → 好感度
 *   possessiveness → 支配欲（占有欲）
 *   anxiety        → 不安感
 *   obsession      → 偏执
 *   trust          → 信任度
 *   dependency     → 依赖度
 *
 * 六条结局：
 *   A — 溺爱窒息线   （高好感 + 高偏执）
 *   B — 寄生共生线   （高好感 + 高依赖 + 低支配）
 *   C — 偏执囚禁线   （低好感 + 高支配 + 高不安）
 *   D — 信息茧房线   （高支配 + 高信任）
 *   E — 矛盾崩溃线   （低信任 + 高依赖）
 *   F — 同归于尽线   （极低信任 + 高不安 + 高偏执）
 */

/**
 * 根据归一化六维数值（0-100）决定结局 ID
 * @param {object} stats  getNormalizedStats() 的返回值
 * @returns {'A'|'B'|'C'|'D'|'E'|'F'}
 */
export function routeEnding(stats) {
  const {
    affection,
    possessiveness,
    anxiety,
    obsession,
    trust,
    dependency,
  } = stats;

  // 先判定有明确数值签名的路线，避免默认低信任或偏执把 B/C/D 吃掉。
  if (affection >= 60 && dependency >= 55 && possessiveness < 35 && obsession < 75) return 'B';
  if (possessiveness >= 45 && trust >= 45 && anxiety < 70) return 'D';
  if (affection >= 65 && obsession >= 60) return 'A';

  // 低信任结局需要玩家把 trust 从中性值真正打低。
  if (trust <= 30 && dependency >= 55 && affection >= 40 && anxiety >= 45) return 'E';
  if (trust <= 25 && anxiety >= 80 && obsession >= 85 && dependency >= 35) return 'F';
  if (possessiveness >= 55 && anxiety >= 60 && affection < 45) return 'C';

  const peak = Math.max(affection, possessiveness, anxiety, obsession, trust, dependency);

  // 好感主导
  if (affection === peak || affection >= 80) {
    if (obsession > 70)                                  return 'A';
    if (dependency > 80 && possessiveness < 30)          return 'B';
    if (obsession > 50)                                  return 'A'; // 次级触发
  }

  // 支配欲主导
  if (possessiveness === peak || possessiveness >= 70) {
    if (trust > 60)                                      return 'D';
    if (affection < 40 && anxiety > 70)                 return 'C';
    return 'D'; // 支配但信任尚可
  }

  // 不安感主导
  if (anxiety === peak && affection < 40 && possessiveness > 60) return 'C';

  // 偏执主导 → 信任是否还在
  if (obsession === peak) {
    if (trust <= 25 && anxiety >= 60) return 'F';
    return 'A';
  }

  // 依赖主导
  if (dependency === peak) {
    if (trust <= 30 && affection >= 35 && anxiety >= 35) return 'E';
    return 'B';
  }

  // 兜底：低强度局用评分竞争分流，避免某个结局成为默认垃圾桶。
  // B 仍只由高好感 + 高依赖 + 低支配的强签名触发。
  return routeByWeakProfile(stats);
}

function routeByWeakProfile(stats) {
  const {
    affection,
    possessiveness,
    anxiety,
    obsession,
    trust,
    dependency,
  } = stats;

  const scores = {
    A: affection * 1.1 + obsession * 0.75 + trust * 0.25 + 12,
    C: possessiveness * 1.05 + anxiety * 0.85 - affection * 0.35 - dependency * 0.2 + 10,
    D: possessiveness * 0.95 + trust * 1.0 - anxiety * 0.25 + 12,
    E: dependency * 1.45 + (38 - trust) * 0.85 + affection * 0.15 + anxiety * 0.15 + 22,
    F: anxiety * 0.8 + obsession * 0.85 + (30 - trust) * 0.4 - dependency * 0.35 - 18,
  };

  return Object.entries(scores)
    .sort(([, left], [, right]) => right - left)[0][0];
}

// ─── LLM 提示词 ───────────────────────────────────────────────────────────────
/**
 * 根据结局 ID 与六维数值，生成传给 LLM 的 system prompt。
 *
 * @param {'A'|'B'|'C'|'D'|'E'|'F'} endingId
 * @param {object} stats
 * @returns {string}  system prompt 字符串
 */
export function buildLLMPrompt(endingId, stats) {
  const prompt = getEndingSystemPrompt(endingId);
  return `${prompt}

【当前六维数值】
- 好感度：${stats.affection}/100
- 占有欲：${stats.possessiveness}/100
- 不安感：${stats.anxiety}/100
- 执念度：${stats.obsession}/100
- 信任度：${stats.trust}/100
- 依赖度：${stats.dependency}/100`;
}

// ─── TTS API ──────────────────────────────────────────────────────────────────
/**
 * 调用后端 TTS 接口将文本转为音频 URL。
 * 后端会转发到 SiliconFlow TTS API（CosyVoice2），返回 mp3 音频流。
 *
 * @param {string} text        需要朗读的独白文本
 * @param {'A'|'B'|'C'|'D'|'E'|'F'} endingId  用于选择语音风格
 * @returns {Promise<string|null>}  返回可播放的 blob URL，失败时返回 null
 */
export async function callTTS(text, endingId) {
  if (!text || text.length === 0) {
    console.warn('[TTS] 文本为空，跳过语音合成');
    return null;
  }

  try {
    const response = await fetch(apiUrl('/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        ending_id: endingId,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[TTS] API 错误:', response.status, errData);
      return null;
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      console.warn('[TTS] 返回的音频数据为空');
      return null;
    }

    const audioUrl = URL.createObjectURL(blob);
    console.log('[TTS] 语音合成成功，音频大小:', (blob.size / 1024).toFixed(1), 'KB');
    return audioUrl;
  } catch (error) {
    console.error('[TTS] 语音合成失败:', error);
    return null;
  }
}
