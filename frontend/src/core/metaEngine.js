/**
 * Meta 特效引擎
 * 
 * 管理全局 Meta 特效池，根据六维参数动态触发各种视觉干扰。
 * 特效分为三个等级：轻微、中度、重度。
 * 触发概率公式：base(5%) + obsession * 0.3%
 */

/**
 * 特效定义
 */
const EFFECTS = {
  // 轻微特效
  light: [
    {
      id: 'screenFlicker',
      name: '屏幕微闪',
      duration: 300,
      description: '屏幕短暂闪烁',
    },
    {
      id: 'breathe',
      name: '页面呼吸',
      duration: 3000,
      description: '页面缓慢缩放呼吸',
    },
    {
      id: 'colorShift',
      name: '色调偏移',
      duration: 2000,
      description: '背景色短暂变化',
    },
  ],

  // 中度特效
  medium: [
    {
      id: 'textRain',
      name: '文字雨',
      duration: 4000,
      description: '中文字符从屏幕顶部飘落',
    },
    {
      id: 'cursorDrift',
      name: '光标漂移',
      duration: 3000,
      description: '视觉光标轨迹效果',
    },
    {
      id: 'optionShake',
      name: '选项抖动',
      duration: 1500,
      description: '选项卡片轻微震动',
    },
  ],

  // 重度特效（高参数触发）
  heavy: [
    {
      id: 'glitchOverlay',
      name: '故障画面',
      duration: 2500,
      description: '全屏故障线条效果',
    },
    {
      id: 'fakeDialog',
      name: '伪系统弹窗',
      duration: 5000,
      description: '模拟系统对话框',
    },
    {
      id: 'textRain',
      name: '密集文字雨',
      duration: 6000,
      description: '大量文字从屏幕飘落',
    },
  ],
};

// 基础触发概率
const BASE_PROBABILITY = 0.05;
// 偏执值系数
const OBSESSION_FACTOR = 0.003;

/**
 * 计算当前触发概率
 */
function calcTriggerProbability(normalizedStats) {
  const obsession = normalizedStats.obsession || 0;
  return Math.min(0.8, BASE_PROBABILITY + obsession * OBSESSION_FACTOR);
}

/**
 * 决定特效等级
 * 根据阶段和参数选择特效池
 */
function getEffectTier(phase, normalizedStats) {
  const dangerAvg =
    ((normalizedStats.anxiety || 0) +
      (normalizedStats.obsession || 0) +
      (normalizedStats.possessiveness || 0)) /
    3;

  if (phase === 'breaking' || dangerAvg > 70) return 'heavy';
  if (phase === 'obsessed' || dangerAvg > 40) return 'medium';
  return 'light';
}

/**
 * 尝试触发一个 Meta 特效
 * 
 * @param {string} phase - 当前阶段
 * @param {object} normalizedStats - 归一化的六维参数
 * @param {boolean} metaEnabled - 是否启用 Meta 特效
 * @returns {object|null} 触发的特效对象，或 null
 */
function tryTriggerEffect(phase, normalizedStats, metaEnabled = true) {
  if (!metaEnabled) return null;

  const probability = calcTriggerProbability(normalizedStats);
  const roll = Math.random();

  if (roll > probability) return null;

  const tier = getEffectTier(phase, normalizedStats);
  const pool = EFFECTS[tier];

  if (!pool || pool.length === 0) return null;

  const idx = Math.floor(Math.random() * pool.length);
  const effect = pool[idx];

  return {
    ...effect,
    tier,
    triggeredAt: Date.now(),
  };
}

/**
 * 强制触发特效（用于冲突惩罚等场景）
 */
function forceTriggerEffect(tier = 'medium') {
  const pool = EFFECTS[tier] || EFFECTS.medium;
  const idx = Math.floor(Math.random() * pool.length);
  return {
    ...pool[idx],
    tier,
    forced: true,
    triggeredAt: Date.now(),
  };
}

/**
 * 获取所有可用特效列表
 */
function getAllEffects() {
  return { ...EFFECTS };
}

export {
  EFFECTS,
  calcTriggerProbability,
  getEffectTier,
  tryTriggerEffect,
  forceTriggerEffect,
  getAllEffects,
};
