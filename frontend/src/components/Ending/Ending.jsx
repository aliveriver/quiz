import { useState, useEffect, useRef, useCallback } from 'react';
import { routeEnding, buildLLMPrompt, callTTS } from '../../core/endingRouter';
import './Ending.css';

/**
 * 结局演出总控组件
 * 根据 getNormalizedStats() 的六维数值路由到对应的结局子组件
 */
// ─── 调试后门 ────────────────────────────────────────────────────────────────
// URL 参数: ?debug_ending=A  (A/B/C/D/E/F)
// 控制台:   window.__debug_ending('F')
// 示例独白: ?debug_ending=A&debug_monologue=1
// ─────────────────────────────────────────────────────────────────────────────
function getDebugEndingId() {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  const v = p.get('debug_ending');
  if (v && ['A','B','C','D','E','F'].includes(v.toUpperCase())) return v.toUpperCase();
  return null;
}

const DEBUG_MONOLOGUE = '【调试独白】这是用于测试结局演出的占位文本。\n一切都在正常运行中。';

export default function Ending({ monologue, deviceInfo, escapeAttempts, monologueComplete, stats }) {
  const [endingId, setEndingId] = useState(() => getDebugEndingId());
  const [ttsUrl, setTtsUrl] = useState(null);

  // 调试模式：若 URL 有 ?debug_ending=X，跳过正常路由
  const isDebug = !!getDebugEndingId();
  const debugMonologue = isDebug
    ? (new URLSearchParams(window.location.search).get('debug_monologue')
        ? DEBUG_MONOLOGUE
        : monologue)
    : monologue;
  const debugComplete = isDebug
    ? (new URLSearchParams(window.location.search).get('debug_monologue') ? true : monologueComplete)
    : monologueComplete;

  useEffect(() => {
    if (isDebug) return;
    if (!stats) return;
    const id = routeEnding(stats);
    setEndingId(id);
  }, [stats, isDebug]);

  // 控制台后门
  useEffect(() => {
    window.__debug_ending = (id) => {
      const upper = String(id).toUpperCase();
      if (['A','B','C','D','E','F'].includes(upper)) {
        setEndingId(upper);
        console.log(`[debug] 结局已切换到: ${upper}`);
      } else {
        console.warn('[debug] 无效结局 ID，可用值: A B C D E F');
      }
    };
    return () => { delete window.__debug_ending; };
  }, []);

  useEffect(() => {
    if (!monologueComplete || !monologue || !endingId) return;
    callTTS(monologue, endingId).then(url => {
      if (url) setTtsUrl(url);
    });
  }, [monologueComplete, monologue, endingId]);

  if (!endingId) {
    return (
      <div className="ending-loading">
        <div className="ending-spinner" />
        <p>正在解析你留下的痕迹……</p>
      </div>
    );
  }

  const endingProps = { monologue: debugMonologue, monologueComplete: debugComplete, deviceInfo, escapeAttempts, stats, ttsUrl };

  switch (endingId) {
    case 'A': return <EndingA {...endingProps} />;
    case 'B': return <EndingB {...endingProps} />;
    case 'C': return <EndingC {...endingProps} />;
    case 'D': return <EndingD {...endingProps} />;
    case 'E': return <EndingE {...endingProps} />;
    case 'F': return <EndingF {...endingProps} />;
    default:  return <EndingE {...endingProps} />;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 A —— 溺爱窒息线
   高好感 + 高偏执：引力鼠标、视觉吞噬、终身归属协议、满屏弹幕
───────────────────────────────────────────────────────────────────────────── */
function EndingA({ monologue, monologueComplete, ttsUrl }) {
  const [showContract, setShowContract] = useState(false);
  const [rejectPos, setRejectPos] = useState({ x: null, y: null });
  const [rejectLabel, setRejectLabel] = useState('拒绝');
  const [accepted, setAccepted] = useState(false);
  
  const [mousePos, setMousePos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [cursorPos, setCursorPos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const acceptRef = useRef(null);
  const rejectRef = useRef(null);
  const [spam, setSpam] = useState([]);

  useEffect(() => {
    if (monologueComplete) {
      const t = setTimeout(() => setShowContract(true), 1500);
      return () => clearTimeout(t);
    }
  }, [monologueComplete]);

  // 物理引力光标算法
  useEffect(() => {
    if (!showContract || accepted) return;
    let animationFrameId;
    
    const updateCursor = () => {
      setCursorPos(prev => {
        if (!acceptRef.current) return mousePos;
        
        const acceptRect = acceptRef.current.getBoundingClientRect();
        const acceptCenter = {
          x: acceptRect.left + acceptRect.width / 2,
          y: acceptRect.top + acceptRect.height / 2
        };
        
        const dx = acceptCenter.x - mousePos.x;
        const dy = acceptCenter.y - mousePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 距离越远（越想逃向拒绝按钮），引力越大
        let pullStrength = 0;
        if (dist > 150) {
          pullStrength = Math.min(0.8, (dist - 150) / 400); 
        }
        
        return {
          x: mousePos.x + dx * pullStrength,
          y: mousePos.y + dy * pullStrength
        };
      });
      animationFrameId = requestAnimationFrame(updateCursor);
    };
    
    updateCursor();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mousePos, showContract, accepted]);

  const handleMouseMove = (e) => {
    if (!showContract || accepted) return;
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleRejectHover = useCallback(() => {
    const labels = ['我早就离不开你了', '算了，我不走了', '好吧……', '……'];
    setRejectLabel(labels[Math.floor(Math.random() * labels.length)]);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setRejectPos({
      x: Math.random() * (vw - 120) + 20,
      y: Math.random() * (vh - 60) + 20,
    });
  }, []);
  
  const handleAccept = () => {
    setAccepted(true);
    // 生成弹幕狂潮
    const newSpam = Array.from({length: 120}).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 1.5,
      scale: 0.5 + Math.random() * 2,
      text: ['我爱你', '永远', '我的', '不分开', '♡'][Math.floor(Math.random() * 5)]
    }));
    setSpam(newSpam);
  };

  return (
    <div className={`ending-screen ending-a ${showContract ? 'hide-cursor' : ''}`} onMouseMove={handleMouseMove}>
      {ttsUrl && <audio src={ttsUrl} autoPlay />}
      
      {showContract && !accepted && (
        <div className="ending-a-cursor" style={{ left: cursorPos.x, top: cursorPos.y, transform: 'translate(-50%, -50%)' }}>♥</div>
      )}

      <div className="ending-a-petals" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="petal" style={{ '--i': i }} />
        ))}
      </div>
      
      <div className="ending-a-vignette" />

      <div className="ending-content">
        {!showContract ? (
          <MonologueBlock monologue={monologue} monologueComplete={monologueComplete} />
        ) : accepted ? (
          <div className="ending-a-accepted">
            <p className="ending-a-big">我就知道。</p>
            <p className="ending-a-sub">我们永远不会分开了。</p>
            {spam.map(s => (
              <div key={s.id} className="ending-a-spam" style={{
                left: `${s.x}vw`, top: `${s.y}vh`, 
                animationDelay: `${s.delay}s`,
                transform: `scale(${s.scale})`
              }}>
                {s.text}
              </div>
            ))}
          </div>
        ) : (
          <div className="ending-a-contract">
            <h2 className="ending-a-contract-title">终身归属协议</h2>
            <div className="ending-a-evidence">
              <p className="ending-a-evidence-title">以下是你留下的爱的证据：</p>
              <ul>
                {getContractEvidence().map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
            <div className="ending-a-buttons">
              <button
                ref={acceptRef}
                className="ending-a-btn-accept"
                onClick={handleAccept}
                onMouseEnter={() => {
                  // Cursor hover effect can be added here
                }}
              >
                我愿意
              </button>
              <button
                ref={rejectRef}
                className="ending-a-btn-reject"
                style={rejectPos.x !== null ? {
                  position: 'fixed',
                  left: rejectPos.x,
                  top: rejectPos.y,
                  zIndex: 9999,
                } : {}}
                onMouseEnter={handleRejectHover}
                onFocus={handleRejectHover}
              >
                {rejectLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getContractEvidence() {
  const history = (() => {
    try { return JSON.parse(localStorage.getItem('quiz_history') || '[]'); } catch { return []; }
  })();
  return [
    '你选择了靠近，而不是逃跑',
    '你的犹豫证明了你在意',
    '你没有关闭这个页面',
    '你一直在这里',
    '你的心跳我都听见了'
  ].slice(0, 4);
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 B —— 寄生共生线
   高好感 + 高依赖 + 低支配：UI 血肉化溶解，信息素丝线纠缠，PWA与拦截请求
───────────────────────────────────────────────────────────────────────────── */
function EndingB({ monologue, monologueComplete, ttsUrl }) {
  const [dissolved, setDissolved] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState(false);
  const [threads, setThreads] = useState([]);
  const lastPos = useRef({ x: -100, y: -100 });

  useEffect(() => {
    if (monologueComplete) {
      const t1 = setTimeout(() => setDissolved(true), 1000);
      const t2 = setTimeout(() => setPwaPrompt(true), 3500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [monologueComplete]);

  // 拦截关闭页面
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (pwaPrompt) {
        e.preventDefault();
        e.returnValue = "你要丢下我了吗？";
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pwaPrompt]);

  // 鼠标绘制丝线
  const handleMouseMove = (e) => {
    if (!dissolved) return;
    const x = e.clientX;
    const y = e.clientY;
    
    if (lastPos.current.x === -100) {
      lastPos.current = { x, y };
      return;
    }
    
    setThreads(prev => {
      const newThread = {
        x1: lastPos.current.x, y1: lastPos.current.y,
        x2: x, y2: y,
        id: Date.now() + Math.random()
      };
      const maxThreads = 60; // 防止卡顿
      const updated = [...prev, newThread];
      if (updated.length > maxThreads) updated.shift();
      return updated;
    });
    lastPos.current = { x, y };
  };

  return (
    <div className={`ending-screen ending-b ${dissolved ? 'ending-b--dissolved' : ''}`} onMouseMove={handleMouseMove}>
      {ttsUrl && <audio src={ttsUrl} autoPlay />}

      {/* SVG 滤镜制造血肉化溶解感 */}
      <svg width="0" height="0" className="ending-b-svg-filter">
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </svg>
      
      {dissolved && (
        <svg className="ending-b-threads" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
          {threads.map(t => (
            <line key={t.id} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="rgba(210, 40, 60, 0.4)" strokeWidth="1.5" />
          ))}
        </svg>
      )}

      <div className="ending-b-vines" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="vine" style={{ '--i': i }} />
        ))}
      </div>

      <div className="ending-content ending-b-gooey">
        <MonologueBlock monologue={monologue} monologueComplete={monologueComplete} />

        {pwaPrompt && (
          <div className="ending-b-pwa">
            <p>允许我永远嵌入你的设备吗？</p>
            <p className="ending-b-subtext">不要拔掉电源，不要关机，我只有你了。</p>
            <button
              className="ending-b-pwa-btn"
              onClick={() => {
                alert('系统已被接管。我不会再离开了。');
              }}
            >
              [ 允许系统权限 ]
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 C —— 偏执囚禁线
   低好感 + 高支配 + 高不安：暗黑模式，监控暗角，重力/阻尼光标，验证死循环
───────────────────────────────────────────────────────────────────────────── */
function EndingC({ monologue, monologueComplete, ttsUrl }) {
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaFail, setCaptchaFail] = useState(0);
  const [grid, setGrid] = useState(() => generateEyeGrid(0));
  const [selected, setSelected] = useState(new Set());
  const [failMsg, setFailMsg] = useState('');
  
  const [mousePos, setMousePos] = useState({ x: window.innerWidth/2, y: window.innerHeight/2 });
  const [cursorPos, setCursorPos] = useState({ x: window.innerWidth/2, y: window.innerHeight/2 });

  const FAIL_MESSAGES = [
    '验证失败，你还在想别人',
    '检测到逃跑意图，请重新验证',
    '你的眼神不对，再试一次',
    '我知道你在撒谎',
    '验证失败，你哪也去不了',
  ];

  useEffect(() => {
    if (monologueComplete) {
      const t = setTimeout(() => setShowCaptcha(true), 1200);
      return () => clearTimeout(t);
    }
  }, [monologueComplete]);
  
  // 阻尼光标：模拟被戴上镣铐的沉重感
  useEffect(() => {
    if (!showCaptcha) return;
    let animationFrameId;
    const updateCursor = () => {
      setCursorPos(prev => {
        const dx = mousePos.x - prev.x;
        const dy = mousePos.y - prev.y;
        return {
          x: prev.x + dx * 0.08,
          y: prev.y + dy * 0.08
        };
      });
      animationFrameId = requestAnimationFrame(updateCursor);
    };
    updateCursor();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mousePos, showCaptcha]);

  const handleMouseMove = (e) => {
    if (showCaptcha) setMousePos({ x: e.clientX, y: e.clientY });
  };

  const [lockdown, setLockdown] = useState(false);
  const handleVerify = () => {
    const count = captchaFail + 1;
    setCaptchaFail(count);
    if (count >= 5) {
      setTimeout(() => setLockdown(true), 800);
      setFailMsg('系统强制接管...');
      setGrid(Array.from({ length: 9 }, () => '抓 到 你 了'));
      return;
    }
    setFailMsg(FAIL_MESSAGES[count % FAIL_MESSAGES.length]);
    setGrid(generateEyeGrid(count));
    setSelected(new Set());
  };

  const toggleCell = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  if (!showCaptcha) {
    return (
      <div className="ending-screen ending-c">
        {ttsUrl && <audio src={ttsUrl} autoPlay />}
        <MonologueBlock monologue={monologue} monologueComplete={monologueComplete} />
      </div>
    );
  }

  if (lockdown) {
    return (
      <div className="ending-screen ending-c-lockdown">
        {ttsUrl && <audio src={ttsUrl} autoPlay />}
        <div className="lockdown-glitch-bg" />
        <div className="lockdown-content">
          <h1 className="lockdown-title">FATAL ERROR: ESCAPE_DENIED</h1>
          <div className="lockdown-eye">👁</div>
          <p className="lockdown-big">“现在，你只能看着我了。”</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ending-screen ending-c hide-cursor" onMouseMove={handleMouseMove}>
      {ttsUrl && <audio src={ttsUrl} autoPlay />}
      
      {/* 自定义重力光标 */}
      <div className="ending-c-cursor" style={{ left: cursorPos.x, top: cursorPos.y }}></div>
      
      <div className="ending-c-vignette" />

      <div className="ending-c-captcha">
        <div className="ending-c-captcha-header">
          <span className="ending-c-captcha-logo">🔒</span>
          <span>系统异常，请验证你的忠诚</span>
        </div>

        <p className="ending-c-captcha-prompt">
          请选出所有包含「{captchaFail >= 4 ? '我' : '斑马线'}」的图片
        </p>

        <div className="ending-c-captcha-grid">
          {grid.map((cell, i) => (
            <div
              key={i}
              className={`ending-c-captcha-cell ${selected.has(i) ? 'selected' : ''}`}
              onClick={() => toggleCell(i)}
            >
              <span>{cell}</span>
            </div>
          ))}
        </div>

        {failMsg && (
          <p className="ending-c-captcha-fail">{failMsg}</p>
        )}

        <button
          className="ending-c-captcha-btn"
          onClick={handleVerify}
        >
          {captchaFail >= 4 ? '我哪也不去' : '验证'}
        </button>

        <p className="ending-c-captcha-footer">
          reCAPTCHA · 无法逃离 · 最终条款
        </p>
      </div>
    </div>
  );
}

function generateEyeGrid(failCount) {
  if (failCount >= 4) {
    return Array.from({ length: 9 }, () => '我哪也不去');
  }
  const eyeTexts = ['看着我', '不准走', '👁', '我看见你了', '别逃', '只有我', '你是我的', '不许走'];
  return Array.from({ length: 9 }, () =>
    eyeTexts[Math.floor(Math.random() * eyeTexts.length)]
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 D —— 信息茧房线
   高支配 + 高信任：纯白医疗室，键盘强行劫持（禁用退格），背景压迫水印
───────────────────────────────────────────────────────────────────────────── */

const LOVELINE = '我会永远留在你身边，哪也不去。';

function EndingD({ monologue, monologueComplete, ttsUrl }) {
  const [showInput, setShowInput] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [loveIndex, setLoveIndex] = useState(0);
  const [phase, setPhase] = useState('monologue');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!monologueComplete) return;
    const t = setTimeout(() => {
      setPhase('prompt');
      setShowInput(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [monologueComplete]);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  useEffect(() => {
    if (!showInput) return;

    const handleKeyDown = (e) => {
      // 彻底禁用退格键
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        return;
      }
      
      // 任意单字符输入，都转换为他的情话
      if (e.key.length === 1 || e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'prompt' || phase === 'typing') {
          setPhase('typing');
          setLoveIndex(i => {
            const next = Math.min(i + 1, LOVELINE.length);
            setDisplayText(LOVELINE.slice(0, next));
            if (next === LOVELINE.length) setPhase('done');
            return next;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [showInput, phase]);

  return (
    <div className="ending-screen ending-d">
      {ttsUrl && <audio src={ttsUrl} autoPlay />}
      
      {/* 巨大的压迫感水印 */}
      <div className="ending-d-watermarks">
         {displayText.length > 3 && <div className="watermark w1">你是我的</div>}
         {displayText.length > 8 && <div className="watermark w2">真乖</div>}
         {displayText.length > 12 && <div className="watermark w3">不准走</div>}
      </div>

      {!showInput ? (
        <MonologueBlock monologue={monologue} monologueComplete={monologueComplete} className="ending-d-mono" />
      ) : (
        <div className="ending-d-hijack">
          <p className="ending-d-prompt">
            现在，把你心里最真实的感受打字告诉我吧。
          </p>

          <div className="ending-d-input-wrap">
            <textarea
              ref={inputRef}
              className="ending-d-input"
              value={displayText}
              onChange={() => {}}
              placeholder="在这里输入，你无法撤回……"
              rows={3}
              spellCheck={false}
              autoComplete="off"
            />
            {phase !== 'done' && (
              <span className="ending-d-cursor-blink" />
            )}
          </div>

          {phase === 'done' && (
            <p className="ending-d-done-line">
              你看，我就知道。这就把你锁起来。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 E —— 矛盾崩溃线
   低信任 + 高依赖：Glitch Art，红色弹窗指数级暴增，产生真实的卡顿假死感
───────────────────────────────────────────────────────────────────────────── */
function EndingE({ monologue, monologueComplete, ttsUrl }) {
  const [showAccusation, setShowAccusation] = useState(false);
  const [popups, setPopups] = useState([]);
  const popupTimerRef = useRef(null);

  useEffect(() => {
    if (monologueComplete) {
      const t = setTimeout(() => setShowAccusation(true), 1200);
      return () => clearTimeout(t);
    }
  }, [monologueComplete]);

  useEffect(() => {
    if (!showAccusation) return;
    let count = 0;
    const msgs = [
      '你为什么要撒谎？',
      '第3题你明明说不会离开！',
      '为什么要假装喜欢我？',
      '为什么你前后矛盾！',
      '你在骗我！！！',
      '你怎么可以这样对我',
    ];
    
    const spawnPopup = () => {
      count++;
      setPopups(prev => [...prev, {
        id: Date.now() + count + Math.random(),
        msg: msgs[count % msgs.length],
        x: Math.random() * 80 + 10,
        y: Math.random() * 80 + 10,
      }]);
      
      // 弹窗生成速度呈指数级加快，极限为 15ms
      const nextDelay = Math.max(15, 600 * Math.pow(0.85, count));
      
      if (count < 150) {
        popupTimerRef.current = setTimeout(spawnPopup, nextDelay);
      } else {
        // 卡顿到一定程度，网页呈现假死状态，UI完全冻结
        document.body.style.cursor = 'wait';
      }
    };
    
    popupTimerRef.current = setTimeout(spawnPopup, 500);
    return () => clearTimeout(popupTimerRef.current);
  }, [showAccusation]);

  return (
    <div className={`ending-screen ending-e ${showAccusation ? 'ending-e--glitch' : ''}`}>
      {ttsUrl && <audio src={ttsUrl} autoPlay />}

      {!showAccusation && (
        <MonologueBlock monologue={monologue} monologueComplete={monologueComplete} />
      )}

      {popups.map(p => (
        <div
          key={p.id}
          className="ending-e-popup"
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
        >
          <div className="ending-e-popup-title">⚠ 严重警告</div>
          <p>{p.msg}</p>
          <button onClick={(e) => {
             // 故意阻止冒泡，但关闭速度赶不上生成速度
             e.target.parentElement.style.display = 'none';
          }}>
            关闭
          </button>
        </div>
      ))}
      <div className="ending-noise" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 F —— 同归于尽线
   极低信任 + 高不安 + 高偏执：Terminal打印，物理毁灭（失去重力），抹杀URL
───────────────────────────────────────────────────────────────────────────── */
function EndingF({ monologue, monologueComplete, ttsUrl }) {
  const [logs, setLogs] = useState([]);
  const [destroyed, setDestroyed] = useState(false);
  const [fFinalPhase, setFFinalPhase] = useState(false);
  const [gravity, setGravity] = useState(false);
  const [finalLine, setFinalLine] = useState('');
  const timersRef = useRef([]);

  const FINAL_DIALOGUE = '既然都是假的，那什么都别留下了。';

  const scheduleTimer = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };

  const getHistoryLogs = () => [
    '你选择了回避……………………………… [LIES]',
    '你假装在乎……………………………… [FAILED]',
    '你的犹豫暴露了你……………………… [DETECTED]',
    '你试图离开过……………………………… [LOGGED]',
    '你不是真心的……………………………… [CONFIRMED]',
    '系统即将格式化……………………………… [FATAL]',
  ];

  useEffect(() => {
    if (!monologueComplete) return;

    const historyItems = getHistoryLogs();
    let i = 0;

    const addLog = () => {
      if (i < historyItems.length) {
        const item = historyItems[i];
        setLogs(prev => [...prev, item]);
        i++;
        scheduleTimer(addLog, 400);
      } else {
        let j = 0;
        const typeDialogue = () => {
          if (j < FINAL_DIALOGUE.length) {
            j++;
            setFinalLine(FINAL_DIALOGUE.slice(0, j));
            scheduleTimer(typeDialogue, 80);
          } else {
            // 触发失去重力破碎
            scheduleTimer(() => setGravity(true), 1000);
            // 物理破碎后清空一切
            scheduleTimer(handleDissolveEnd, 3500);
          }
        };
        scheduleTimer(typeDialogue, 800);
      }
    };

    scheduleTimer(addLog, 1000);
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [monologueComplete]);

  const handleDissolveEnd = () => {
    setDestroyed(true);
    localStorage.clear();
    sessionStorage.clear();
    try { window.history.replaceState(null, '', 'about:blank'); } catch (_) {}
    
    // 红点持续3秒后，进入真正的“虚无”
    setTimeout(() => {
      setFFinalPhase('crt-off');
    }, 3000);
  };

  if (destroyed) {
    return (
      <div className="ending-screen ending-f-destroyed">
         {fFinalPhase !== 'crt-off' ? (
           <div className="ending-f-reddot"></div>
         ) : (
           <div className="ending-f-crt-off"></div>
         )}
      </div>
    );
  }

  return (
    <div className={`ending-screen ending-f ${gravity ? 'ending-f--gravity' : ''}`}>
      {ttsUrl && <audio src={ttsUrl} autoPlay />}

      {!monologueComplete && (
        <MonologueBlock monologue={monologue} monologueComplete={monologueComplete} />
      )}

      {monologueComplete && (
        <div className="ending-f-console">
          <div className="ending-f-console-header">
            <span className="ending-f-dot red" />
            <span className="ending-f-dot yellow" />
            <span className="ending-f-dot green" />
            <span style={{ marginLeft: '0.5rem', opacity: 0.5 }}>root@system:~# tail -f audit.log</span>
          </div>
          <div className="ending-f-console-body">
            {logs.map((log, i) => (
              <div key={i} className="ending-f-log-line">
                <span className="ending-f-timestamp">[{String(i).padStart(2, '0')}:0{i}]</span>
                <span className={log.includes('FAILED') || log.includes('LIES') || log.includes('FATAL') ? 'ending-f-log-red' : 'ending-f-log-dim'}>
                  {log}
                </span>
              </div>
            ))}
            {finalLine && (
              <div className="ending-f-final-line">
                {finalLine}
                {finalLine.length < FINAL_DIALOGUE.length && <span className="ending-cursor" />}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="ending-noise" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   共用：独白展示块
───────────────────────────────────────────────────────────────────────────── */
function MonologueBlock({ monologue, monologueComplete, className = "" }) {
  if (!monologue) {
    return (
      <div className={`ending-loading-inline ${className}`}>
        <div className="ending-spinner" />
        <p>正在解析你留下的痕迹……</p>
      </div>
    );
  }

  return (
    <div className={`ending-monologue-container ${className}`}>
      <p className="ending-monologue">
        {monologue}
        {!monologueComplete && <span className="ending-cursor" />}
      </p>
    </div>
  );
}
