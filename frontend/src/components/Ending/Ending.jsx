import { useState, useEffect } from 'react';
import './Ending.css';

/**
 * 结局演出组件
 * 游戏结束时的总结展示，打破第四面墙的独白
 */
export default function Ending({ stats, monologue, deviceInfo, phase }) {
  const [typedText, setTypedText] = useState('');
  const [isTypingComplete, setIsTypingComplete] = useState(false);

  // 打字机效果
  useEffect(() => {
    if (!monologue) return;

    let i = 0;
    const speed = 60;
    
    const typeWriter = () => {
      if (i < monologue.length) {
        setTypedText(monologue.slice(0, i + 1));
        i++;
        setTimeout(typeWriter, speed + (Math.random() * 50));
      } else {
        setIsTypingComplete(true);
      }
    };

    const timer = setTimeout(typeWriter, 1000);
    return () => clearTimeout(timer);
  }, [monologue]);

  const handleRestart = () => {
    window.location.reload();
  };

  if (!monologue) {
    return (
      <div className="ending-loading">
        <div className="ending-spinner" />
        <p>正在解析你留下的痕迹……</p>
      </div>
    );
  }

  return (
    <div className="ending-screen">
      <div className="ending-content">
        
        {/* 独白文本 */}
        <div className="ending-monologue-container">
          <p className="ending-monologue">
            {typedText}
            {!isTypingComplete && <span className="ending-cursor" />}
          </p>
        </div>

        {/* 重新开始按钮 */}
        {isTypingComplete && (
          <div className="ending-actions" style={{ marginTop: '3rem', textAlign: 'center' }}>
            <button className="ending-btn" onClick={handleRestart}>
              重新开始
            </button>
          </div>
        )}

      </div>
      
      {/* 噪点背景层 */}
      <div className="ending-noise" />
    </div>
  );
}

function StatItem({ label, value }) {
  // 将数值转化为视觉表现，而不是冰冷的数字
  let intensity = 'low';
  if (value > 70) intensity = 'high';
  else if (value > 40) intensity = 'medium';

  return (
    <div className={`ending-stat-item ending-stat--${intensity}`}>
      <span className="ending-stat-label">{label}</span>
      <div className="ending-stat-bar-container">
        <div 
          className="ending-stat-bar" 
          style={{ width: `${value}%`, transitionDelay: `${Math.random() * 0.5}s` }} 
        />
      </div>
    </div>
  );
}
