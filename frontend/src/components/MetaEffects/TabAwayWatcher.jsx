import { useEffect, useRef, useState } from 'react';
import './TabAwayWatcher.css';

/**
 * 切屏惩罚演出
 *
 * 监听用户在答题阶段频繁切出标签页的行为，分三档施压：
 *  - 轻度（第 1-2 次切出）：仅用标题栏做 Meta 互动
 *      切出 → "你要去哪里？" / "别丢下我…"
 *      切回 → "你终于回来了❤"
 *  - 中度（第 3-6 次切出）：切回时页面出现递进破碎感，
 *      右下角隐约浮现质问文本（随机多条）
 *  - 重度（第 7 次切出）：切回时触发 onHeavyPunish，
 *      由父组件清空题目，并由本组件刷满红字瀑布后关闭页面
 *
 * @param {boolean} active        是否启用监听（仅答题阶段为 true）
 * @param {function} onHeavyPunish 第 7 次切回时回调（用于清空题目等）
 * @param {function} onClose       重度演出结束、需要关闭页面时回调
 */

const LEAVE_TITLES = ['你要去哪里？', '别丢下我…', '你去找谁了？', '不要走开…'];
const RETURN_TITLE = '你终于回来了❤';

const WHISPERS = [
  '你在犹豫什么？',
  '你刚才切出去看了谁的消息？',
  '是谁比我更重要？',
  '你回来了，可你心里在想别人吧。',
  '我数着你离开的每一秒。',
  '你以为我没看见吗？',
];

const HEAVY_THRESHOLD = 7;       // 第 7 次切出触发重度
const MEDIUM_START = 3;          // 第 3 次进入中度

// 重度：横向逐行刷满的红字（交替）
const HEAVY_PHRASES = ['看着我', '我爱你'];

export default function TabAwayWatcher({ active, onHeavyPunish, onClose }) {
  // 切出次数（切回时结算并递增显示效果）
  const leaveCountRef = useRef(0);
  const originalTitleRef = useRef('');
  // 当前是否处于"已离开"状态，避免 blur + visibilitychange 重复计数
  const awayRef = useRef(false);

  const [crackLevel, setCrackLevel] = useState(0); // 0=无，1..4 递进破碎
  const [whisper, setWhisper] = useState(null);
  const [heavy, setHeavy] = useState(false);
  const heavyRef = useRef(false); // 用 ref 追踪 heavy，避免 effect 重建导致闭包失效

  // 重度：横向刷满的红字行
  const [heavyLines, setHeavyLines] = useState([]);
  const heavyTimerRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    originalTitleRef.current = document.title;

    const handleLeave = () => {
      if (heavyRef.current) return;
      if (awayRef.current) return; // 已处于离开状态，去重（blur 与 visibilitychange 会同时触发）
      awayRef.current = true;
      leaveCountRef.current += 1;
      const n = leaveCountRef.current;

      // 标题栏 Meta 互动（所有档位都改标题，营造"它在追你"）
      const idx = Math.min(n - 1, LEAVE_TITLES.length - 1);
      document.title = LEAVE_TITLES[idx] || LEAVE_TITLES[LEAVE_TITLES.length - 1];
    };

    const handleReturn = () => {
      if (heavyRef.current) return;
      if (!awayRef.current) return; // 并非真正从离开态回来，去重
      awayRef.current = false;
      const n = leaveCountRef.current;

      // 重度：第 7 次切回 → 清空题目 + 红字逐行刷满 + 关闭
      if (n >= HEAVY_THRESHOLD) {
        document.title = RETURN_TITLE;
        onHeavyPunish?.();
        heavyRef.current = true;
        setHeavy(true);

        // 一行行逐渐占满屏幕：每隔一小段时间追加一行红字
        let i = 0;
        heavyTimerRef.current = setInterval(() => {
          const phrase = HEAVY_PHRASES[i % HEAVY_PHRASES.length];
          setHeavyLines((prev) => [...prev, { id: i, text: phrase }]);
          i += 1;
          // 刷满约 40 行后停止追加
          if (i >= 40) {
            clearInterval(heavyTimerRef.current);
            heavyTimerRef.current = null;
          }
        }, 130);

        // 刷满后停留片刻关闭页面
        setTimeout(() => onClose?.(), 4000);
        return;
      }

      // 标题栏：你终于回来了
      document.title = RETURN_TITLE;
      setTimeout(() => {
        if (!heavyRef.current) document.title = originalTitleRef.current;
      }, 2500);

      // 中度：第 3-6 次切回 → 递进破碎 + 右下角质问
      if (n >= MEDIUM_START) {
        // 递进放缓：第 3/4/5/6 次切回 → level 1/1/2/3，破碎感缓慢加深而非一步到顶
        const CRACK_LEVEL_BY_RETURN = { 3: 1, 4: 1, 5: 2, 6: 3 };
        const level = CRACK_LEVEL_BY_RETURN[n] || Math.min(n - MEDIUM_START + 1, 4);
        setCrackLevel(level);
        const w = WHISPERS[Math.floor(Math.random() * WHISPERS.length)];
        setWhisper({ text: w, key: Date.now() });
        setTimeout(() => setWhisper(null), 4200);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) handleLeave();
      else handleReturn();
    };

    // 兜底：部分场景（Alt+Tab 切到其他程序）只触发 window blur/focus 而不触发
    // visibilitychange。此时若 document 仍可见，则用 blur/focus 计数。
    const handleWinBlur = () => {
      if (document.hidden) return; // 切标签页已由 visibilitychange 处理，避免重复
      handleLeave();
    };
    const handleWinFocus = () => {
      if (document.hidden) return;
      handleReturn();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleWinBlur);
    window.addEventListener('focus', handleWinFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleWinBlur);
      window.removeEventListener('focus', handleWinFocus);
      document.title = originalTitleRef.current;
      if (heavyTimerRef.current) clearInterval(heavyTimerRef.current);
    };
  }, [active, onHeavyPunish, onClose]); // heavy 改用 heavyRef，不再作为依赖，避免 effect 重建导致演出被打断

  if (!active) return null;

  return (
    <>
      {/* 中度：递进破碎覆盖层（SVG 裂纹 + 屏幕震颤） */}
      {crackLevel > 0 && !heavy && (
        <div
          className={`tab-crack tab-crack--${crackLevel}`}
          aria-hidden="true"
        >
          <CrackSvg level={crackLevel} />
        </div>
      )}

      {/* 中度：右下角隐约质问 */}
      {whisper && !heavy && (
        <div key={whisper.key} className="tab-whisper">
          {whisper.text}
        </div>
      )}

      {/* 重度：横向逐行刷满的红字 */}
      {heavy && (
        <div className="tab-heavy">
          {heavyLines.map((line) => (
            <div key={line.id} className="tab-heavy-line">
              {/* 一行内重复填满整行 */}
              {line.text.repeat(24)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ===== 裂纹 SVG：从撞击点放射的玻璃裂痕 ===== */
// 撞击中心（视口百分比坐标系 0..100）
const IMPACT = { x: 50, y: 44 };

// 固定的放射主裂纹角度（度），不同等级启用不同数量，保证递进感且稳定不抖
const RADIAL_ANGLES = [
  -8, 26, 58, 94, 131, 167, -44, -78, -112, -148, 12, 78, 150, -28, 112,
];

// 伪随机（基于索引的确定性抖动，避免每次 render 跳动）
function jitter(seed, amp) {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * 2 * amp;
}

function CrackSvg({ level }) {
  // 等级 1..4 → 主裂纹数量 / 同心连接环数量
  const radialCount = [0, 4, 7, 11, 15][level];
  const ringCount = [0, 1, 2, 3, 4][level];

  const cx = IMPACT.x;
  const cy = IMPACT.y;

  // 每条主裂纹：从中心向外的折线（带分叉点），用于后续连接环
  const radials = [];
  for (let i = 0; i < radialCount; i++) {
    const baseAng = (RADIAL_ANGLES[i] * Math.PI) / 180;
    const reach = 60 + jitter(i + 1, 18); // 裂纹延伸长度（百分比对角线）
    const pts = [{ x: cx, y: cy, r: 0 }];
    const segs = 4;
    for (let s = 1; s <= segs; s++) {
      const r = (reach * s) / segs;
      const ang = baseAng + (jitter(i * 7 + s, 0.18)); // 每段轻微偏折
      pts.push({
        x: cx + Math.cos(ang) * r,
        y: cy + Math.sin(ang) * r * 0.82, // y 方向略压扁贴合宽屏
        r,
      });
    }
    radials.push(pts);
  }

  // 连接环：把相邻主裂纹在某半径上的点连成多边形碎块边
  const rings = [];
  for (let k = 1; k <= ringCount; k++) {
    const segIdx = k; // 取第 k 段的点
    const ringPts = radials
      .map((pts) => pts[Math.min(segIdx, pts.length - 1)])
      .filter(Boolean);
    if (ringPts.length >= 2) rings.push(ringPts);
  }

  return (
    <svg
      className="tab-crack-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="crackGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.25" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#crackGlow)">
        {/* 连接环（碎块边界）—— 先画，作为底层 */}
        {rings.map((pts, ri) => (
          <polyline
            key={`ring-${ri}`}
            className="crack-stroke crack-stroke--fine"
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            style={{ '--draw-delay': `${0.18 + ri * 0.06}s` }}
          />
        ))}

        {/* 主放射裂纹 */}
        {radials.map((pts, i) => (
          <polyline
            key={`rad-${i}`}
            className="crack-stroke crack-stroke--main"
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            style={{ '--draw-delay': `${i * 0.025}s` }}
          />
        ))}

        {/* 撞击中心：白色冲击亮点 */}
        <circle
          className="crack-impact"
          cx={cx}
          cy={cy}
          r={0.6 + level * 0.5}
        />
      </g>
    </svg>
  );
}
