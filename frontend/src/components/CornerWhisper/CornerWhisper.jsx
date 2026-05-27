import { useState, useEffect } from 'react';
import './CornerWhisper.css';

/**
 * 角落低语组件
 * 第三次刷新关闭页面后，再次打开时在右下角显示半透明提示
 */
export default function CornerWhisper() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.removeItem('horror_closed');
  };

  if (!visible) return null;

  const text = '你逃不掉的';

  return (
    <div className="corner-whisper" onClick={dismiss}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="corner-whisper-char"
          style={{ animationDelay: `${i * 0.4}s` }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}
