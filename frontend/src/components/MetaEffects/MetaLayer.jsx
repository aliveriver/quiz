import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import TextRain from './TextRain';
import FakeDialog from './FakeDialog';
import './MetaLayer.css';

/**
 * Meta 特效渲染层
 * 全屏覆盖层，用于渲染各种 Meta 干扰效果
 */
export default function MetaLayer({ effect, phase, onEffectEnd }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!effect) {
      setActive(false);
      return;
    }

    setActive(true);

    const timer = setTimeout(() => {
      setActive(false);
      onEffectEnd?.();
    }, effect.duration || 3000);

    return () => clearTimeout(timer);
  }, [effect]);

  if (!effect || !active) return null;

  const content = (
    <div className={`meta-layer meta-layer--${effect.id}`} data-phase={phase}>
      {renderEffect(effect, phase)}
    </div>
  );

  return createPortal(content, document.body);
}

function renderEffect(effect, phase) {
  switch (effect.id) {
    case 'screenFlicker':
      return <div className="meta-flicker" />;

    case 'breathe':
      return <div className="meta-breathe" />;

    case 'colorShift':
      return <div className="meta-color-shift" />;

    case 'textRain':
      return <TextRain duration={effect.duration} />;

    case 'cursorDrift':
      return <CursorDrift />;

    case 'optionShake':
      return <div className="meta-shake-trigger" />;

    case 'glitchOverlay':
      return <GlitchOverlay />;

    case 'fakeDialog':
      return <FakeDialog />;

    default:
      return null;
  }
}

/**
 * 光标漂移效果
 */
function CursorDrift() {
  const [trails, setTrails] = useState([]);

  useEffect(() => {
    const handleMove = (e) => {
      const id = Date.now() + Math.random();
      setTrails(prev => [...prev.slice(-12), { id, x: e.clientX, y: e.clientY }]);
    };

    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  // 清理旧轨迹
  useEffect(() => {
    const interval = setInterval(() => {
      setTrails(prev => prev.slice(-6));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="meta-cursor-drift">
      {trails.map((t, i) => (
        <div
          key={t.id}
          className="meta-cursor-trail"
          style={{
            left: t.x,
            top: t.y,
            opacity: (i + 1) / trails.length * 0.6,
            transform: `scale(${(i + 1) / trails.length})`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 故障画面效果
 */
function GlitchOverlay() {
  return (
    <div className="meta-glitch">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="meta-glitch-line"
          style={{
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            height: `${1 + Math.random() * 3}px`,
          }}
        />
      ))}
      <div className="meta-glitch-color" />
    </div>
  );
}
