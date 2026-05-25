/**
 * 题库管理与抽题系统
 * 
 * 从题库中按分类权重随机抽取题目，
 * 保证分类覆盖均匀，支持动态插入质问锚点题。
 */

import questionsData from '../data/questions.json';

// 所有分类
const CATEGORIES = [
  'late_night',
  'waiting_for_reply',
  'chat_behavior',
  'disappearing',
  'special_treatment',
  'social_distance',
  'emotional_contradiction',
  'memory_behavior',
  'online_presence',
  'emotional_dependency',
];

// 质问锚点题（冲突检测时插入）
const CONFRONTATION_QUESTIONS = [
  {
    category: 'confrontation',
    question: '刚刚那道题……你是认真选的吗？',
    isConfrontation: true,
    options: [
      {
        text: '是的，我改主意了',
        attitude_tag: 'honest',
        effects: { affection: 1, possessiveness: 0, anxiety: -1, obsession: 0, trust: 3, dependency: 0 },
      },
      {
        text: '随便选的，别太在意',
        attitude_tag: 'avoidant',
        effects: { affection: -1, possessiveness: 0, anxiety: 1, obsession: 1, trust: -3, dependency: 0 },
      },
      {
        text: '……你为什么会这样问？',
        attitude_tag: 'emotional',
        effects: { affection: 0, possessiveness: 0, anxiety: 2, obsession: 2, trust: -1, dependency: 1 },
      },
    ],
  },
  {
    category: 'confrontation',
    question: '你之前说的那些……都是真的吗？',
    isConfrontation: true,
    options: [
      {
        text: '当然是真的',
        attitude_tag: 'honest',
        effects: { affection: 2, possessiveness: 0, anxiety: 0, obsession: 0, trust: 3, dependency: 1 },
      },
      {
        text: '有些是，有些不是',
        attitude_tag: 'avoidant',
        effects: { affection: 0, possessiveness: 0, anxiety: 1, obsession: 1, trust: -2, dependency: 0 },
      },
      {
        text: '你不需要知道',
        attitude_tag: 'independent',
        effects: { affection: -2, possessiveness: 0, anxiety: 0, obsession: 2, trust: -4, dependency: -1 },
      },
    ],
  },
  {
    category: 'confrontation',
    question: '你好像……和一开始不太一样了。',
    isConfrontation: true,
    options: [
      {
        text: '人总会变的',
        attitude_tag: 'rational',
        effects: { affection: 0, possessiveness: 0, anxiety: 0, obsession: 0, trust: 1, dependency: -1 },
      },
      {
        text: '是你想太多了',
        attitude_tag: 'avoidant',
        effects: { affection: -1, possessiveness: 0, anxiety: 1, obsession: 2, trust: -3, dependency: 0 },
      },
      {
        text: '……你觉得我变了？',
        attitude_tag: 'emotional',
        effects: { affection: 1, possessiveness: 0, anxiety: 2, obsession: 1, trust: 0, dependency: 1 },
      },
    ],
  },
];

/**
 * Fisher-Yates 洗牌算法
 */
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 按分类分组题目
 */
function groupByCategory(questions) {
  const groups = {};
  for (const q of questions) {
    const cat = q.category;
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(q);
  }
  return groups;
}

/**
 * 从题库中抽取指定数量的题目
 * 保证分类覆盖均匀
 * 
 * @param {number} count - 抽取题目数量
 * @returns {Array} 抽取的题目列表
 */
function drawQuestions(count = 20) {
  const allQuestions = [...questionsData];
  const grouped = groupByCategory(allQuestions);
  const availableCategories = Object.keys(grouped);

  const selected = [];
  const usedIndices = new Set();

  // 第一轮：每个分类至少抽 1 题
  for (const cat of availableCategories) {
    const catQuestions = grouped[cat];
    if (catQuestions.length > 0) {
      const shuffled = shuffle(catQuestions);
      const q = shuffled[0];
      const globalIndex = allQuestions.indexOf(q);
      if (!usedIndices.has(globalIndex)) {
        selected.push({ ...q, _id: globalIndex });
        usedIndices.add(globalIndex);
      }
    }
    if (selected.length >= count) break;
  }

  // 第二轮：随机补充剩余题目
  const remaining = allQuestions.filter((_, i) => !usedIndices.has(i));
  const shuffledRemaining = shuffle(remaining);

  for (const q of shuffledRemaining) {
    if (selected.length >= count) break;
    const globalIndex = allQuestions.indexOf(q);
    selected.push({ ...q, _id: globalIndex });
    usedIndices.add(globalIndex);
  }

  // 最终洗牌
  return shuffle(selected);
}

/**
 * 获取一道随机的质问锚点题
 */
function getConfrontationQuestion() {
  const idx = Math.floor(Math.random() * CONFRONTATION_QUESTIONS.length);
  return { ...CONFRONTATION_QUESTIONS[idx] };
}

/**
 * 获取题库总数信息
 */
function getPoolStats() {
  const grouped = groupByCategory(questionsData);
  const stats = {};
  for (const [cat, questions] of Object.entries(grouped)) {
    stats[cat] = questions.length;
  }
  return {
    total: questionsData.length,
    byCategory: stats,
  };
}

export {
  CATEGORIES,
  drawQuestions,
  getConfrontationQuestion,
  getPoolStats,
  shuffle,
};
