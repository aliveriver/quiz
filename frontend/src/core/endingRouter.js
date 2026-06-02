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

  // ── 信任一票否决：信任归零时强制进入崩溃线 ──────────────────────────
  if (trust < 20 && anxiety > 80 && obsession > 80) return 'F';
  if (trust < 30 && dependency > 70)               return 'E';

  // ── 主导情绪 × 催化剂情绪复合判定 ────────────────────────────────────
  // 1. 找最高峰值
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
    if (trust < 30) return 'F';
    return 'A';
  }

  // 依赖主导
  if (dependency === peak) {
    if (trust < 30) return 'E';
    return 'B';
  }

  // 兜底：以好感/信任均值判断
  const warmth = (affection + trust) / 2;
  if (warmth >= 50) return 'B';
  if (warmth >= 30) return 'A';
  return 'E';
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
    const response = await fetch(apiUrl('/api/tts'), {
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
