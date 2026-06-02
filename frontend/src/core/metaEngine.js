import { runtimeConfig } from './runtimeConfig';

/**
 * Meta 特效引擎
 * 
 * 管理全局 Meta 特效池，根据六维参数动态触发各种视觉干扰。
 * 触发概率公式：base(10%) + obsession * 50%
 */

/**
 * 特效定义
 */
const EFFECTS = [
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
  {
    id: 'optionShake',
    name: '选项抖动',
    duration: 1500,
    description: '选项卡片轻微震动',
  },
  {
    id: 'glitchOverlay',
    name: '故障画面',
    duration: 2500,
    description: '全屏故障线条效果',
  },
];

// 基础触发概率
const BASE_PROBABILITY = runtimeConfig.meta.base_probability;
// 偏执值系数
const OBSESSION_FACTOR = runtimeConfig.meta.obsession_factor;

/**
 * 计算当前触发概率
 */
function calcTriggerProbability(normalizedStats) {
  const obsession = normalizedStats.obsession || 0;
  return Math.min(0.8, BASE_PROBABILITY + obsession * OBSESSION_FACTOR);
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

  if (EFFECTS.length === 0) return null;

  const idx = Math.floor(Math.random() * EFFECTS.length);
  const effect = EFFECTS[idx];

  return {
    ...effect,
    triggeredAt: Date.now(),
  };
}

/**
 * 强制触发特效（用于冲突惩罚等场景）
 */
function forceTriggerEffect() {
  const idx = Math.floor(Math.random() * EFFECTS.length);
  return {
    ...EFFECTS[idx],
    forced: true,
    triggeredAt: Date.now(),
  };
}

/**
 * 获取所有可用特效列表
 */
function getAllEffects() {
  return [ ...EFFECTS ];
}

export {
  EFFECTS,
  calcTriggerProbability,
  tryTriggerEffect,
  forceTriggerEffect,
  getAllEffects,
};
