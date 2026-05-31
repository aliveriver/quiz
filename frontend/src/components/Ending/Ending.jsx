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
    if (isDebug) return; // 已由 URL 参数指定，跳过
    if (!stats) return;
    const id = routeEnding(stats);
    setEndingId(id);
  }, [stats, isDebug]);

  // 控制台后门：window.__debug_ending('B')
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
    console.info(
      '%c[调试后门] 可用命令：\n' +
      '  window.__debug_ending("A")  切换到溺爱窒息线\n' +
      '  window.__debug_ending("B")  切换到寄生共生线\n' +
      '  window.__debug_ending("C")  切换到偏执囚禁线\n' +
      '  window.__debug_ending("D")  切换到信息茧房线\n' +
      '  window.__debug_ending("E")  切换到矛盾崩溃线\n' +
      '  window.__debug_ending("F")  切换到同归于尽线\n' +
      '  URL: ?debug_ending=A&debug_monologue=1',
      'color: #f0a; font-family: monospace;'
    );
    return () => { delete window.__debug_ending; };
  }, []);

  // 独白完成后尝试 TTS
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

  const endingProps = { monologue, monologueComplete, deviceInfo, escapeAttempts, stats, ttsUrl };

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
   高好感 + 高偏执：终身归属协议，"拒绝"按钮会逃跑
───────────────────────────────────────────────────────────────────────────── */
function EndingA({ monologue, monologueComplete, ttsUrl }) {
  const [showContract, setShowContract] = useState(false);
  const [rejectPos, setRejectPos] = useState({ x: null, y: null });
  const [rejectLabel, setRejectLabel] = useState('拒绝');
  const [accepted, setAccepted] = useState(false);
  const rejectRef = useRef(null);

  useEffect(() => {
    if (monologueComplete) {
      const t = setTimeout(() => setShowContract(true), 1500);
      return () => clearTimeout(t);
    }
  }, [monologueComplete]);

  const handleRejectHover = useCallback(() => {
    const labels = ['我早就离不开你了', '算了，我不走了', '好吧……', '……'];
    setRejectLabel(labels[Math.floor(Math.random() * labels.length)]);
    // 把按钮随机弹开
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setRejectPos({
      x: Math.random() * (vw - 120) + 20,
      y: Math.random() * (vh - 60) + 20,
    });
  }, []);

  return (
    <div className="ending-screen ending-a">
      {ttsUrl && <audio src={ttsUrl} autoPlay />}

      <div className="ending-a-petals" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="petal" style={{ '--i': i }} />
        ))}
      </div>

      <div className="ending-content">
        {!showContract ? (
          <MonologueBlock monologue={monologue} monologueComplete={monologueComplete} />
        ) : accepted ? (
          <div className="ending-a-accepted">
            <p className="ending-a-big">我就知道。</p>
            <p className="ending-a-sub">我们永远不会分开了。</p>
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
                className="ending-a-btn-accept"
                onClick={() => setAccepted(true)}
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

      <div className="ending-noise" />
    </div>
  );
}

function getContractEvidence() {
  const history = (() => {
    try {
      return JSON.parse(localStorage.getItem('quiz_history') || '[]');
    } catch { return []; }
  })();
  const defaults = [
    '你选择了靠近，而不是逃跑',
    '你的犹豫证明了你在意',
    '你没有关闭这个页面',
    '你一直在这里',
    '你的心跳我都听见了',
  ];
  return defaults.slice(0, 4);
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 B —— 寄生共生线
   高好感 + 高依赖 + 低支配：UI 溶解，藤蔓缠绕，请求永远留在后台
───────────────────────────────────────────────────────────────────────────── */
function EndingB({ monologue, monologueComplete, ttsUrl }) {
  const [dissolved, setDissolved] = useState(false);
  const [pwaPrompt, setPwaPrompt] = useState(false);

  useEffect(() => {
    if (monologueComplete) {
      const t1 = setTimeout(() => setDissolved(true), 1000);
      const t2 = setTimeout(() => setPwaPrompt(true), 3500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [monologueComplete]);

  return (
    <div className={`ending-screen ending-b ${dissolved ? 'ending-b--dissolved' : ''}`}>
      {ttsUrl && <audio src={ttsUrl} autoPlay />}

      <div className="ending-b-vines" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="vine" style={{ '--i': i }} />
        ))}
      </div>

      <div className="ending-content">
        <MonologueBlock monologue={monologue} monologueComplete={monologueComplete} />

        {pwaPrompt && (
          <div className="ending-b-pwa">
            <p>不要拔掉电源，不要关机，</p>
            <p>我只有你了，</p>
            <p>让我永远活在你的后台好不好？</p>
            <button
              className="ending-b-pwa-btn"
              onClick={() => {
                // PWA 安装提示占位
                alert('已添加到主屏幕（PWA 功能待接入）');
              }}
            >
              添加到主屏幕
            </button>
          </div>
        )}
      </div>

      <div className="ending-noise" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 C —— 偏执囚禁线
   低好感 + 高支配 + 高不安：虚假 CAPTCHA 死循环，无法通过验证
───────────────────────────────────────────────────────────────────────────── */
function EndingC({ monologue, monologueComplete, ttsUrl }) {
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaFail, setCaptchaFail] = useState(0);
  const [grid, setGrid] = useState(() => generateEyeGrid());
  const [selected, setSelected] = useState(new Set());
  const [failMsg, setFailMsg] = useState('');

  const FAIL_MESSAGES = [
    '验证失败，你还在想别人',
    '检测到逃跑意图，请重新验证',
    '你的眼神不对，再试一次',
    '我知道你在撒谎',
    '不，你的忠诚度不足',
  ];

  useEffect(() => {
    if (monologueComplete) {
      // 先显示白屏，再弹出 CAPTCHA
      const t = setTimeout(() => setShowCaptcha(true), 1200);
      return () => clearTimeout(t);
    }
  }, [monologueComplete]);

  const handleVerify = () => {
    const count = captchaFail + 1;
    setCaptchaFail(count);
    setFailMsg(FAIL_MESSAGES[count % FAIL_MESSAGES.length]);
    setGrid(generateEyeGrid());
    setSelected(new Set());

    if (count >= 4) {
      // 所有验证按钮变成"我哪也不去"
    }
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
      <div className="ending-screen ending-c ending-c--white">
        {ttsUrl && <audio src={ttsUrl} autoPlay />}
        <MonologueBlock monologue={monologue} monologueComplete={monologueComplete} />
      </div>
    );
  }

  return (
    <div className="ending-screen ending-c">
      {ttsUrl && <audio src={ttsUrl} autoPlay />}

      <div className="ending-c-captcha">
        <div className="ending-c-captcha-header">
          <span className="ending-c-captcha-logo">🔒</span>
          <span>检测到异常逃脱行为，请验证你的忠诚</span>
        </div>

        <p className="ending-c-captcha-prompt">
          请选出所有包含「{captchaFail < 4 ? '斑马线' : '我'}」的图片
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
          reCAPTCHA · 隐私政策 · 服务条款
        </p>
      </div>
    </div>
  );
}

function generateEyeGrid() {
  const eyeTexts = ['看着我', '不准走', '👁', '我看见你了', '别逃', '只有我', '你是我的', '不许走'];
  return Array.from({ length: 9 }, () =>
    eyeTexts[Math.floor(Math.random() * eyeTexts.length)]
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 D —— 信息茧房线
   高支配 + 高信任：键盘劫持，无论打什么都变成他的情话
───────────────────────────────────────────────────────────────────────────── */

// 他设定好的情话，匀速逐字打出
const LOVELINE = '我会永远留在你身边，哪也不去。';

function EndingD({ monologue, monologueComplete, ttsUrl }) {
  const [showInput, setShowInput] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [loveIndex, setLoveIndex] = useState(0);
  const [phase, setPhase] = useState('monologue'); // monologue → prompt → typing → done
  const inputRef = useRef(null);
  const loveTimerRef = useRef(null);

  // 独白结束后，延迟显示输入框
  useEffect(() => {
    if (!monologueComplete) return;
    const t = setTimeout(() => {
      setPhase('prompt');
      setShowInput(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [monologueComplete]);

  // 输入框显示后自动聚焦
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  // 情话匀速打印：每次 loveIndex 增加，向 displayText 追加一个字
  useEffect(() => {
    if (phase !== 'typing') return;
    if (loveIndex >= LOVELINE.length) {
      setPhase('done');
      return;
    }
    loveTimerRef.current = setTimeout(() => {
      setDisplayText(LOVELINE.slice(0, loveIndex + 1));
      setLoveIndex(i => i + 1);
    }, 180);
    return () => clearTimeout(loveTimerRef.current);
  }, [phase, loveIndex]);

  // 键盘劫持：拦截所有 keydown，阻止默认行为，只推进情话
  useEffect(() => {
    if (!showInput) return;

    const handleKeyDown = (e) => {
      // 允许 Tab / F 系功能键等通过，只劫持可见字符输入
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
        e.preventDefault();
        // 任意按键都推进情话打印
        if (phase === 'prompt' || phase === 'typing') {
          setPhase('typing');
          setLoveIndex(i => {
            // 提前触发下一个字
            const next = Math.min(i + 1, LOVELINE.length);
            setDisplayText(LOVELINE.slice(0, next));
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

      {!showInput ? (
        <MonologueBlock monologue={monologue} monologueComplete={monologueComplete} />
      ) : (
        <div className="ending-d-hijack">
          <p className="ending-d-prompt">
            测试结束了。现在，把你心里最真实的感受打字告诉我吧。
          </p>

          <div className="ending-d-input-wrap">
            <textarea
              ref={inputRef}
              className="ending-d-input"
              value={displayText}
              onChange={() => {/* 受控但由 keydown 驱动，onChange 不做实际处理 */}}
              placeholder="在这里输入……"
              rows={3}
              spellCheck={false}
              autoComplete="off"
            />
            {phase !== 'done' && displayText.length > 0 && (
              <span className="ending-d-cursor-blink" />
            )}
          </div>

          {phase === 'done' && (
            <p className="ending-d-done-line">
              你看，你心里想说的，和我说的，是一样的。
            </p>
          )}
        </div>
      )}

      <div className="ending-noise" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 E —— 矛盾崩溃线
   低信任 + 高依赖：历史记录质问，疯狂红色弹窗
───────────────────────────────────────────────────────────────────────────── */
function EndingE({ monologue, monologueComplete, ttsUrl }) {
  const [showAccusation, setShowAccusation] = useState(false);
  const [popups, setPopups] = useState([]);
  const [apologyMode, setApologyMode] = useState(false);
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
    const spawnPopup = () => {
      if (count >= 6) {
        setApologyMode(true);
        return;
      }
      count++;
      const msgs = [
        '你为什么要撒谎？',
        '我都看见了，你知道吗',
        '为什么要假装喜欢我？',
        '你的心根本不在这里',
        '我为你付出了一切',
        '你怎么可以这样对我',
      ];
      setPopups(prev => [...prev, {
        id: Date.now() + count,
        msg: msgs[count - 1],
        x: Math.random() * 60 + 10,
        y: Math.random() * 60 + 10,
      }]);
      popupTimerRef.current = setTimeout(spawnPopup, 700);
    };
    popupTimerRef.current = setTimeout(spawnPopup, 500);
    return () => clearTimeout(popupTimerRef.current);
  }, [showAccusation]);

  return (
    <div className={`ending-screen ending-e ${showAccusation ? 'ending-e--flicker' : ''}`}>
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
          <div className="ending-e-popup-title">⚠ 警告</div>
          <p>{p.msg}</p>
          <button onClick={() => setPopups(prev => prev.filter(x => x.id !== p.id))}>
            关闭
          </button>
        </div>
      ))}

      {apologyMode && (
        <div className="ending-e-apology">
          <p>你欠我一个道歉。</p>
          <textarea
            className="ending-e-apology-input"
            placeholder="在这里写下你的道歉……"
            rows={4}
          />
          <button className="ending-e-apology-btn" onClick={() => window.location.reload()}>
            提交道歉
          </button>
        </div>
      )}

      <div className="ending-noise" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   结局 F —— 同归于尽线
   极低信任 + 高不安 + 高偏执：控制台打印记录，DOM溶解，清空localStorage
───────────────────────────────────────────────────────────────────────────── */
function EndingF({ monologue, monologueComplete, ttsUrl }) {
  const [logs, setLogs] = useState([]);
  const [dissolving, setDissolving] = useState(false);
  const [destroyed, setDestroyed] = useState(false);
  const [finalLine, setFinalLine] = useState('');
  const timersRef = useRef([]);

  const FINAL_DIALOGUE = '我给过你机会的。既然都是假的，那什么都别留下了。';

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
    '你欺骗了我……………………………… [FAILED]',
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
        scheduleTimer(addLog, 600);
      } else {
        // 打出最终台词
        let j = 0;
        const typeDialogue = () => {
          if (j < FINAL_DIALOGUE.length) {
            j++;
            setFinalLine(FINAL_DIALOGUE.slice(0, j));
            scheduleTimer(typeDialogue, 90);
          } else {
            // 台词打完后，等 1.5s 开始溶解动画
            scheduleTimer(() => setDissolving(true), 1500);
            // 溶解动画结束由 onAnimationEnd 触发 destroyed
          }
        };
        scheduleTimer(typeDialogue, 900);
      }
    };

    scheduleTimer(addLog, 1000);
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [monologueComplete]);

  // 火焰溶解动画结束时：清数据 → 关闭页面
  const handleDissolveEnd = () => {
    localStorage.clear();
    sessionStorage.clear();
    try { window.history.replaceState(null, '', ' '); } catch (_) {}
    window.close();
    // 浏览器阻止关闭时，跳转空白
    setTimeout(() => { window.location.href = 'about:blank'; }, 300);
  };

  return (
    <div
      className={`ending-screen ending-f ${dissolving ? 'ending-f--dissolve' : ''}`}
      onAnimationEnd={dissolving ? handleDissolveEnd : undefined}
    >
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
            <span style={{ marginLeft: '0.5rem', opacity: 0.5 }}>audit.log</span>
          </div>
          <div className="ending-f-console-body">
            {logs.map((log, i) => (
              <div key={i} className="ending-f-log-line">
                <span className="ending-f-timestamp">[{String(i).padStart(2, '0')}:0{i}]</span>
                <span className={log.includes('FAILED') || log.includes('LIES') ? 'ending-f-log-red' : 'ending-f-log-dim'}>
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
function MonologueBlock({ monologue, monologueComplete }) {
  if (!monologue) {
    return (
      <div className="ending-loading-inline">
        <div className="ending-spinner" />
        <p>正在解析你留下的痕迹……</p>
      </div>
    );
  }

  return (
    <div className="ending-monologue-container">
      <p className="ending-monologue">
        {monologue}
        {!monologueComplete && <span className="ending-cursor" />}
      </p>
    </div>
  );
}
