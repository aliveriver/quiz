import { useState, useEffect, useRef, useMemo } from 'react';
import './HorrorScreen.css';

/**
 * 恐怖黑屏组件
 * type: 'typewriter' — 打字机逐字显示文本后回调 onDone
 * type: 'shatter' — 文字瞬间出现 → 屏幕破碎 → 回调 onDone
 * type: 'perfunctory' — 网页卡死(隐藏指针) → 题目像沙子掉落 → 中央敲字 → 回调 onDone
 */
export default function HorrorScreen({
  type,
  text,
  audioSrc,
  onPlayAudio,
  sandText = '',
  onDone,
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [fadingOut, setFadingOut] = useState(false);
  const [shattering, setShattering] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const [sandFalling, setSandFalling] = useState(false);
  const timerRef = useRef(null);
  const audioPlayedRef = useRef(false);

  const playAudioOnce = () => {
    if (!audioSrc || audioPlayedRef.current) return true;
    audioPlayedRef.current = true;
    onPlayAudio?.(audioSrc);
    return true;
  };

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

  // 将题目文本拆成单字"沙粒"，每个字随机重力下落参数
  const sandChars = useMemo(() => {
    const chars = (sandText || '问卷').split('');
    return chars.map((ch, i) => ({
      id: i,
      ch: ch === ' ' ? ' ' : ch,
      tx: `${(Math.random() - 0.5) * 240}px`,
      rot: `${(Math.random() - 0.5) * 540}deg`,
      delay: `${i * 0.04 + Math.random() * 0.3}s`,
      dur: `${1.6 + Math.random() * 1.4}s`,
    }));
  }, [sandText]);

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
        playAudioOnce();
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
      playAudioOnce();
      const t1 = setTimeout(() => setGlitching(true), 2000);
      const t2 = setTimeout(() => setShattering(true), 3000);
      const t3 = setTimeout(() => onDone?.(), 4500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }

    if (type === 'perfunctory') {
      // 阶段 1: 网页"卡死"——画面凝固、指针隐藏（覆盖层默认即冻结输入）。停顿一下制造卡死感。
      // 阶段 2: 题目文字像沙子一样掉落
      const tSand = setTimeout(() => setSandFalling(true), 1400);

      // 阶段 3: 沙子落完后，中央缓慢敲出质问文字
      let typeTimer = null;
      const tType = setTimeout(() => {
        playAudioOnce();
        let i = 0;
        typeTimer = setInterval(() => {
          if (i < text.length) {
            setDisplayedText(text.slice(0, i + 1));
            i++;
          } else {
            clearInterval(typeTimer);
            // 阶段 4: 停留后关闭网页
            setTimeout(() => {
              setFadingOut(true);
              setTimeout(() => onDone?.(), 1200);
            }, 2600);
          }
        }, 220); // 缓慢敲字
      }, 3400);

      return () => {
        clearTimeout(tSand);
        clearTimeout(tType);
        if (typeTimer) clearInterval(typeTimer);
      };
    }
  }, [type, text, audioSrc, onPlayAudio, onDone]);

  return (
    <div
      className={`horror-overlay ${fadingOut ? 'horror-overlay--fade' : ''} ${type === 'perfunctory' ? 'horror-overlay--frozen' : ''}`}
    >
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

      {type === 'perfunctory' && (
        <>
          {/* 题目像沙子一样掉落 */}
          <div className="horror-sand">
            {sandChars.map((c) => (
              <span
                key={c.id}
                className={`horror-sand-char ${sandFalling ? 'horror-sand-char--fall' : ''}`}
                style={{
                  '--tx': c.tx,
                  '--rot': c.rot,
                  '--delay': c.delay,
                  '--dur': c.dur,
                }}
              >
                {c.ch === ' ' ? ' ' : c.ch}
              </span>
            ))}
          </div>

          {/* 中央缓慢敲出的质问文字 */}
          {displayedText && (
            <div className="horror-text horror-text--accuse">
              {displayedText}<span className="horror-cursor">|</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
