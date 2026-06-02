import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './MetaLayer.css';

/**
 * Meta 特效渲染层
 * 全屏覆盖层，用于渲染各种 Meta 干扰效果
 */
export default function MetaLayer({ effect, onEffectEnd }) {
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
  }, [effect, onEffectEnd]);

  if (!effect || !active) return null;

  const content = (
    <div className={`meta-layer meta-layer--${effect.id}`}>
      {renderEffect(effect)}
    </div>
  );

  return createPortal(content, document.body);
}

function renderEffect(effect) {
  switch (effect.id) {
    case 'screenFlicker':
      return <div className="meta-flicker" />;

    case 'breathe':
      return <div className="meta-breathe" />;

    case 'colorShift':
      return <div className="meta-color-shift" />;

    case 'optionShake':
      return <div className="meta-shake-trigger" />;

    case 'glitchOverlay':
      return <GlitchOverlay />;

    default:
      return null;
  }
}

/**
 * 故障画面效果
 */
function GlitchOverlay() {
  const [lines] = useState(() => Array.from({ length: 8 }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 0.5}s`,
    height: `${1 + Math.random() * 3}px`,
  })));

  return (
    <div className="meta-glitch">
      {lines.map((line) => (
        <div
          key={line.id}
          className="meta-glitch-line"
          style={line}
        />
      ))}
      <div className="meta-glitch-color" />
    </div>
  );
}
