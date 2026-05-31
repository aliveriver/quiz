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

// ─── LLM 提示词占位（后续填充）────────────────────────────────────────────────
/**
 * 根据结局 ID 与六维数值，生成传给 LLM 的 system prompt。
 * 目前为占位结构，后续在此填写完整 prompt。
 *
 * @param {'A'|'B'|'C'|'D'|'E'|'F'} endingId
 * @param {object} stats
 * @returns {string}  system prompt 字符串
 */
export function buildLLMPrompt(endingId, stats) {
  // ╔══════════════════════════════════════════════════╗
  // ║   TODO: 在此填写各结局的 LLM System Prompt       ║
  // ╚══════════════════════════════════════════════════╝
  const prompts = {
    A: `【占位】结局A「溺爱窒息线」LLM Prompt —— 请在此填写病娇角色的独白生成指令。
维度参考：好感${stats.affection}，偏执${stats.obsession}`,

    B: `【占位】结局B「寄生共生线」LLM Prompt —— 请在此填写病娇角色的独白生成指令。
维度参考：好感${stats.affection}，依赖${stats.dependency}，支配${stats.possessiveness}`,

    C: `【占位】结局C「偏执囚禁线」LLM Prompt —— 请在此填写病娇角色的独白生成指令。
维度参考：好感${stats.affection}，支配${stats.possessiveness}，不安${stats.anxiety}`,

    D: `【占位】结局D「信息茧房线」LLM Prompt —— 请在此填写病娇角色的独白生成指令。
维度参考：支配${stats.possessiveness}，信任${stats.trust}`,

    E: `【占位】结局E「矛盾崩溃线」LLM Prompt —— 请在此填写病娇角色的独白生成指令。
维度参考：信任${stats.trust}，依赖${stats.dependency}`,

    F: `【占位】结局F「同归于尽线」LLM Prompt —— 请在此填写病娇角色的独白生成指令。
维度参考：信任${stats.trust}，不安${stats.anxiety}，偏执${stats.obsession}`,
  };

  return prompts[endingId] ?? prompts['E'];
}

// ─── TTS API 占位 ──────────────────────────────────────────────────────────────
/**
 * 调用 TTS 接口将文本转为音频 URL。
 * 目前为占位函数，后续在此对接真实 TTS API。
 *
 * @param {string} text        需要朗读的独白文本
 * @param {'A'|'B'|'C'|'D'|'E'|'F'} endingId  用于选择语音风格
 * @returns {Promise<string|null>}  返回可播放的音频 URL，失败时返回 null
 */
export async function callTTS(text, endingId) {
  // ╔══════════════════════════════════════════════════╗
  // ║   TODO: 在此对接 TTS API（如 ElevenLabs / 微软   ║
  // ║   Azure TTS / OpenAI TTS）                       ║
  // ║                                                  ║
  // ║   示例结构（ElevenLabs）：                        ║
  // ║   const res = await fetch(                       ║
  // ║     `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_MAP[endingId]}`,
  // ║     { method:'POST', headers:{...}, body:JSON.stringify({text}) }
  // ║   );                                             ║
  // ║   const blob = await res.blob();                 ║
  // ║   return URL.createObjectURL(blob);              ║
  // ╚══════════════════════════════════════════════════╝
  console.log('[TTS 占位] 文本已就绪，待对接 API。endingId:', endingId, 'text:', text.slice(0, 30));
  return null;
}
