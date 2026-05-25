import { useState, useEffect, useMemo } from 'react';
import './TextRain.css';

/**
 * 文字雨效果
 * 随机中文短语从屏幕顶部飘落
 */

const PHRASES = [
  '不要走', '你在看这里', '我知道', '别关掉',
  '你还在吗', '留下来', '我在这里', '别离开',
  '你是我的', '再看看我', '不要忽略我', '我等你',
  '你在想谁', '回来', '别走', '我看到你了',
  '你答应过的', '说好的', '为什么', '……',
];

export default function TextRain({ duration = 4000 }) {
  const drops = useMemo(() => {
    const count = Math.floor(12 + Math.random() * 10);
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      text: PHRASES[Math.floor(Math.random() * PHRASES.length)],
      left: Math.random() * 100,
      delay: Math.random() * 2,
      speed: 3 + Math.random() * 4,
      size: 0.7 + Math.random() * 0.8,
      opacity: 0.2 + Math.random() * 0.6,
    }));
  }, []);

  return (
    <div className="text-rain">
      {drops.map((drop) => (
        <span
          key={drop.id}
          className="text-rain-drop"
          style={{
            left: `${drop.left}%`,
            animationDelay: `${drop.delay}s`,
            animationDuration: `${drop.speed}s`,
            fontSize: `${drop.size}rem`,
            opacity: drop.opacity,
          }}
        >
          {drop.text}
        </span>
      ))}
    </div>
  );
}
