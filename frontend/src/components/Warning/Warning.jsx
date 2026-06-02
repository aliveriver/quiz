import { useState } from 'react';
import { runtimeConfig } from '../../core/runtimeConfig';
import './Warning.css';

/**
 * 内容警告页面
 * 深夜测试的入口，营造神秘氛围
 */
export default function Warning({ onStart, onDisableMeta }) {
  const [fading, setFading] = useState(false);

  const handleStart = (disableMeta) => {
    setFading(true);
    if (disableMeta) onDisableMeta?.();
    setTimeout(() => onStart(), 800);
  };

  const totalQuestions = runtimeConfig.game.questions_per_round;

  return (
    <div className={`warning-screen ${fading ? 'warning-screen--fading' : ''}`}>
      <div className="warning-content">
        <div className="warning-badge">深夜限定</div>

        <h1 className="warning-title">
          <span className="warning-title-char" style={{ animationDelay: '0.3s' }}>深</span>
          <span className="warning-title-char" style={{ animationDelay: '0.4s' }}>夜</span>
          <span className="warning-title-char" style={{ animationDelay: '0.5s' }}>人</span>
          <span className="warning-title-char" style={{ animationDelay: '0.6s' }}>格</span>
          <span className="warning-title-char" style={{ animationDelay: '0.7s' }}>测</span>
          <span className="warning-title-char" style={{ animationDelay: '0.8s' }}>试</span>
        </h1>

        <p className="warning-subtitle">一份关于你深夜社交习惯的小测试</p>

        <div className="warning-divider" />

        <p className="warning-notice">
          本测试包含轻微视觉效果<br />
          建议在安静环境下完成
        </p>

        <div className="warning-actions">
          <button
            className="warning-btn warning-btn--primary"
            id="btn-start-test"
            onClick={() => handleStart(false)}
          >
            开始测试
          </button>
          <button
            className="warning-btn warning-btn--ghost"
            id="btn-disable-meta"
            onClick={() => handleStart(true)}
          >
            关闭视觉特效
          </button>
        </div>

        <p className="warning-footer">约需 3-5 分钟 · 共 {totalQuestions} 题</p>
      </div>

      <div className="warning-ambient" />
    </div>
  );
}
