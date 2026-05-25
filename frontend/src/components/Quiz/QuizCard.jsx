import { useState, useEffect } from 'react';
import './QuizCard.css';

/**
 * 答题卡片组件
 * 展示题目和选项，处理选择动画
 */
export default function QuizCard({ question, currentIndex, totalQuestions, phase, onSelect }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [isExiting, setIsExiting] = useState(false);
  const [isEntering, setIsEntering] = useState(true);

  // 题目切换时重置状态
  useEffect(() => {
    setSelectedIndex(null);
    setIsExiting(false);
    setIsEntering(true);
    const timer = setTimeout(() => setIsEntering(false), 500);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  const handleSelect = (index) => {
    if (selectedIndex !== null) return; // 防止重复点击
    setSelectedIndex(index);

    // 延迟后触发退出动画并通知父组件
    setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onSelect(index, question.options[index]);
      }, 400);
    }, 600);
  };

  if (!question) return null;

  return (
    <div
      className={`quiz-card ${isEntering ? 'quiz-card--entering' : ''} ${isExiting ? 'quiz-card--exiting' : ''}`}
      data-phase={phase}
    >
      {/* 分类标签 */}
      <span className="quiz-category">
        {getCategoryLabel(question.category)}
      </span>

      {/* 题目 */}
      <h2 className="quiz-question">{question.question}</h2>

      {/* 选项 */}
      <div className="quiz-options">
        {question.options.map((option, index) => (
          <button
            key={index}
            id={`quiz-option-${index}`}
            className={`quiz-option ${
              selectedIndex === index ? 'quiz-option--selected' : ''
            } ${
              selectedIndex !== null && selectedIndex !== index
                ? 'quiz-option--dimmed'
                : ''
            }`}
            onClick={() => handleSelect(index)}
            disabled={selectedIndex !== null}
          >
            <span className="quiz-option-indicator">
              {String.fromCharCode(65 + index)}
            </span>
            <span className="quiz-option-text">{option.text}</span>
          </button>
        ))}
      </div>

      {/* 冲突提示（质问锚点题） */}
      {question.isConfrontation && (
        <div className="quiz-confrontation-hint">
          <span className="quiz-confrontation-dot" />
        </div>
      )}
    </div>
  );
}

/**
 * 分类标签中文映射
 */
function getCategoryLabel(category) {
  const labels = {
    late_night: '深夜',
    waiting_for_reply: '等待',
    chat_behavior: '聊天',
    disappearing: '冷淡',
    special_treatment: '特别',
    social_distance: '距离',
    emotional_contradiction: '矛盾',
    memory_behavior: '记忆',
    online_presence: '在线',
    emotional_dependency: '依赖',
    confrontation: '？',
  };
  return labels[category] || category;
}
