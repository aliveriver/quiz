import { runtimeConfig } from './runtimeConfig';

/**
 * 态度冲突检测系统
 * 
 * 使用滑动窗口追踪玩家最近几道题的态度标签，
 * 检测是否出现矛盾行为（如先选 clingy 后选 independent）。
 * 
 * 冲突触发时会阻断常规加分，直接修改状态参数。
 */

// 对立标签对
const CONFLICT_PAIRS = [
  ['clingy', 'independent'],
  ['clingy', 'avoidant'],
  ['pleasing', 'passive_aggressive'],
  ['obsessive', 'avoidant'],
  ['obsessive', 'rational'],
  ['emotional', 'rational'],
  ['jealous', 'respectful'],
];

// 默认滑动窗口大小
const DEFAULT_WINDOW_SIZE = runtimeConfig.game.conflict_window_size;

/**
 * 获取最近 N 道题的态度标签
 */
function getRecentTags(history, windowSize = DEFAULT_WINDOW_SIZE) {
  const recent = history.slice(-windowSize);
  return recent
    .map(entry => entry.attitudeTag)
    .filter(tag => tag && tag.length > 0);
}

/**
 * 计算主导性格标签
 * 返回最近窗口内出现次数最多的标签
 */
function getDominantTag(history, windowSize = DEFAULT_WINDOW_SIZE) {
  const tags = getRecentTags(history, windowSize);
  if (tags.length === 0) return null;

  const counts = {};
  for (const tag of tags) {
    counts[tag] = (counts[tag] || 0) + 1;
  }

  let maxTag = null;
  let maxCount = 0;
  for (const [tag, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxTag = tag;
    }
  }

  return maxTag;
}

/**
 * 检查两个标签是否构成冲突
 */
function isConflict(tagA, tagB) {
  if (!tagA || !tagB) return false;
  if (tagA === tagB) return false;

  return CONFLICT_PAIRS.some(
    ([a, b]) =>
      (tagA === a && tagB === b) ||
      (tagA === b && tagB === a)
  );
}

/**
 * 检测当前选择是否与玩家主导性格冲突
 *
 * @param {Array} history - 答题历史 [{attitudeTag, ...}]
 * @param {string} currentTag - 当前选项的态度标签
 * @param {number} windowSize - 滑动窗口大小
 * @param {number} conflictCount - 当前累计冲突次数
 * @returns {{ conflict: boolean, dominantTag: string|null, currentTag: string, severity: string, conflictCount: number }}
 */
function detectConflict(history, currentTag, windowSize = DEFAULT_WINDOW_SIZE, conflictCount = 0) {
  const dominantTag = getDominantTag(history, windowSize);

  if (!dominantTag || !currentTag) {
    return {
      conflict: false,
      dominantTag,
      currentTag,
      severity: 'none',
      conflictCount,
    };
  }

  const hasConflict = isConflict(dominantTag, currentTag);

  if (!hasConflict) {
    return {
      conflict: false,
      dominantTag,
      currentTag,
      severity: 'none',
      conflictCount,
    };
  }

  // 增加冲突计数
  const newConflictCount = conflictCount + 1;

  // 计算冲突严重程度
  // 如果主导标签在窗口中出现 3 次以上，冲突更严重
  const recentTags = getRecentTags(history, windowSize);
  const dominantCount = recentTags.filter(t => t === dominantTag).length;

  let severity = 'mild';
  if (dominantCount >= 3) severity = 'moderate';
  if (dominantCount >= 4) severity = 'severe';

  return {
    conflict: true,
    dominantTag,
    currentTag,
    severity,
    conflictCount: newConflictCount,
  };
}

/**
 * 获取冲突事件描述（用于 UI 展示）
 */
function getConflictMessage(conflictResult) {
  if (!conflictResult.conflict) return null;

  const messages = {
    mild: '……你刚才的回答，和之前有些不一样。',
    moderate: '……你在说谎吗？',
    severe: '……我注意到了。你变了。',
  };

  return messages[conflictResult.severity] || messages.mild;
}

export {
  CONFLICT_PAIRS,
  getRecentTags,
  getDominantTag,
  isConflict,
  detectConflict,
  getConflictMessage,
};
