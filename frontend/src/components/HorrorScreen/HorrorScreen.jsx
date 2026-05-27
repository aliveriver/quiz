import { useState, useEffect, useRef, useMemo } from 'react';
import './HorrorScreen.css';

/**
 * 恐怖黑屏组件
 * type: 'typewriter' — 打字机逐字显示文本后回调 onDone
 * type: 'shatter' — 文字瞬间出现 → 屏幕破碎 → 回调 onDone
 */
export default function HorrorScreen({ type, text, onDone }) {
  const [displayedText, setDisplayedText] = useState('');
  const [fadingOut, setFadingOut] = useState(false);
  const [shattering, setShattering] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const timerRef = useRef(null);

  const COLS = 8;
  const ROWS = 6;
  const shards = useMemo(() => {
    return Array.from({ length: COLS * ROWS }).map((_, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return {
        id: i,
        left: `${(col / COLS) * 100}%`,
        top: `${(row / ROWS) * 100}%`,
        width: `${100 / COLS}%`,
        height: `${100 / ROWS}%`,
        angle: `${(Math.random() - 0.5) * 720}deg`,
        tx: `${(Math.random() - 0.5) * 800}px`,
        ty: `${(Math.random() - 0.5) * 600 + 200}px`,
        delay: `${Math.random() * 0.3}s`,
      };
    });
  }, []);

  useEffect(() => {
    const blockKeys = (e) => { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener('keydown', blockKeys, true);
    window.addEventListener('keyup', blockKeys, true);
    return () => {
      window.removeEventListener('keydown', blockKeys, true);
      window.removeEventListener('keyup', blockKeys, true);
    };
  }, []);

  useEffect(() => {
    if (type === 'typewriter') {
      let i = 0;
      const timer = setTimeout(() => {
        timerRef.current = setInterval(() => {
          if (i < text.length) {
            setDisplayedText(text.slice(0, i + 1));
            i++;
          } else {
            clearInterval(timerRef.current);
            setTimeout(() => {
              setFadingOut(true);
              setTimeout(() => onDone?.(), 800);
            }, 1500);
          }
        }, 120);
      }, 800);
      return () => { clearTimeout(timer); clearInterval(timerRef.current); };
    }

    if (type === 'shatter') {
      const t1 = setTimeout(() => setGlitching(true), 2000);
      const t2 = setTimeout(() => setShattering(true), 3000);
      const t3 = setTimeout(() => onDone?.(), 4500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [type, text, onDone]);

  return (
    <div className={`horror-overlay ${fadingOut ? 'horror-overlay--fade' : ''}`}>
      {type === 'typewriter' && (
        <div className="horror-text horror-text--typewriter">
          {displayedText}<span className="horror-cursor">|</span>
        </div>
      )}

      {type === 'shatter' && !shattering && (
        <div className={`horror-text horror-text--shatter ${glitching ? 'horror-text--glitch' : ''}`}>
          {text}
        </div>
      )}

      {type === 'shatter' && shattering && (
        <div className="horror-shatter-grid">
          {shards.map((s) => (
            <div
              key={s.id}
              className="horror-shard"
              style={{
                left: s.left,
                top: s.top,
                width: s.width,
                height: s.height,
                '--angle': s.angle,
                '--tx': s.tx,
                '--ty': s.ty,
                '--delay': s.delay,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
