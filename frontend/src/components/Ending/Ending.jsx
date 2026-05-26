import './Ending.css';

/**
 * 结局演出组件
 * 游戏结束时的总结展示，打破第四面墙的独白
 * monologue 由父组件通过 SSE 流式填充，本组件直接渲染即可
 */
export default function Ending({ monologue, deviceInfo, escapeAttempts, monologueComplete }) {
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

        {/* 独白文本 — 随 SSE 流式增长 */}
        <div className="ending-monologue-container">
          <p className="ending-monologue">
            {monologue}
            {!monologueComplete && <span className="ending-cursor" />}
          </p>
        </div>

        {/* 流式结束后显示重新开始按钮 */}
        {monologueComplete && (
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
