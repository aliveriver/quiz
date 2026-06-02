/**
 * 六维情感参数状态机
 * 
 * 管理角色的六个情感维度：
 * - affection (好感度)
 * - possessiveness (占有欲)
 * - anxiety (不安感)
 * - obsession (偏执)
 * - trust (信任度)
 * - dependency (依赖度)
 * 
 * 每个维度范围 0-100，初始值 0。
 * 根据累积的 raw 分数映射到 0-100 的刻度。
 */

const DIMENSIONS = ['affection', 'possessiveness', 'anxiety', 'obsession', 'trust', 'dependency'];

// raw 分数达到此值时映射为 100%
const RAW_MAX = 35;

/**
 * 创建初始状态
 */
function createInitialState() {
  return {
    raw: {
      affection: 0,
      possessiveness: 0,
      anxiety: 0,
      obsession: 0,
      trust: 0,
      dependency: 0,
    },
    answeredCount: 0,
    history: [],
  };
}

/**
 * 将 raw 分数映射到 0-100
 */
function normalize(rawValue) {
  const clamped = Math.max(0, Math.min(RAW_MAX, rawValue));
  return Math.round((clamped / RAW_MAX) * 100);
}

/**
 * 获取所有维度的归一化值
 */
function getNormalizedStats(state) {
  const result = {};
  for (const dim of DIMENSIONS) {
    result[dim] = normalize(state.raw[dim]);
  }
  return result;
}

/**
 * 应用选项效果到状态
 */
function applyEffects(state, effects) {
  const newState = {
    ...state,
    raw: { ...state.raw },
    answeredCount: state.answeredCount + 1,
    history: [...state.history],
  };

  for (const dim of DIMENSIONS) {
    if (effects[dim] !== undefined) {
      newState.raw[dim] = Math.max(0, newState.raw[dim] + effects[dim]);
    }
  }

  return newState;
}

/**
 * 应用冲突惩罚
 */
function applyConflictPenalty(state) {
  const newState = {
    ...state,
    raw: { ...state.raw },
  };

  newState.raw.trust = Math.max(0, newState.raw.trust - 10);
  newState.raw.anxiety = newState.raw.anxiety + 7;
  newState.raw.obsession = newState.raw.obsession + 7;

  return newState;
}

/**
 * 记录一次答题
 */
function recordAnswer(state, questionId, optionIndex, attitudeTag) {
  return {
    ...state,
    history: [
      ...state.history,
      {
        questionId,
        optionIndex,
        attitudeTag,
        timestamp: Date.now(),
      },
    ],
  };
}

// 注意: 不再支持保存/加载游戏进度
// 用户必须一次性完成测试,不能中途退出后继续

export {
  DIMENSIONS,
  createInitialState,
  normalize,
  getNormalizedStats,
  applyEffects,
  applyConflictPenalty,
  recordAnswer,
};
