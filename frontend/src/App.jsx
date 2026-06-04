import { useState, useEffect, useCallback, useRef } from 'react';
import Warning from './components/Warning/Warning';
import QuizCard from './components/Quiz/QuizCard';
import ProgressBar from './components/Progress/ProgressBar';
import MetaLayer from './components/MetaEffects/MetaLayer';
import TabAwayWatcher from './components/MetaEffects/TabAwayWatcher';
import Ending from './components/Ending/Ending';
import HorrorScreen from './components/HorrorScreen/HorrorScreen';
import {
  createInitialState,
  applyEffects,
  applyConflictPenalty,
  recordAnswer,
  getNormalizedStats,
} from './core/stateMachine';
import { detectConflict } from './core/conflictDetector';
import { drawQuestions, getConfrontationQuestion } from './core/questionPool';
import { tryTriggerEffect, forceTriggerEffect } from './core/metaEngine';
import { collectDeviceInfo } from './core/deviceProbe';
import { runtimeConfig } from './core/runtimeConfig';
import { routeEnding } from './core/endingRouter';
import { useStreamingAudio } from './core/useStreamingAudio';
import { getHorrorAudioSrc, playHorrorAudio, primeHorrorAudio } from './core/horrorAudio';
import { base64ToBytes, parseSSEEvent } from './core/sse';
import { apiUrl } from './core/apiClient';
import './App.css';

const QUESTIONS_PER_ROUND = runtimeConfig.game.questions_per_round;
const FALLBACK_MONOLOGUE = '……我一直在看着你。\n你的每一次犹豫，每一次撒谎，我都看在眼里。\n不过没关系，现在，只剩下我们了。';

export default function App() {
  const [appState, setAppState] = useState('warning'); // 警告、答题、结局
  const [metaEnabled, setMetaEnabled] = useState(true);
  
  // 游戏核心状态
  const [gameState, setGameState] = useState(createInitialState());
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // 演出状态
  const [currentMetaEffect, setCurrentMetaEffect] = useState(null);
  const [monologue, setMonologue] = useState(null);
  const [monologueComplete, setMonologueComplete] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [conflictCount, setConflictCount] = useState(0);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [finalStats, setFinalStats] = useState(null);

  // 刷新追踪 & 恐怖效果
  const [horrorType, setHorrorType] = useState(null);
  const [horrorText, setHorrorText] = useState('');
  const refreshCheckedRef = useRef(false);

  // PWA 安装事件（尽早捕获，避免 EndingB 挂载前错过）
  const deferredPwaPrompt = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      deferredPwaPrompt.current = e;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── DEBUG 后门：在浏览器控制台执行 window.__debugEnding('A') 直接跳到指定结局 ──
  useEffect(() => {
    window.__debugEnding = (id) => {
      const validIds = ['A', 'B', 'C', 'D', 'E', 'F'];
      const endingId = String(id).toUpperCase();
      if (!validIds.includes(endingId)) {
        console.warn('[Debug] 无效结局 ID，可选值：A B C D E F');
        return;
      }
      // 在 URL 上打上标记，让 Ending 组件直接读取
      const url = new URL(window.location.href);
      url.searchParams.set('debug_ending', endingId);
      window.history.replaceState(null, '', url.toString());
      // 跳过问卷直接进结局
      setMonologue('【Debug】这是调试独白。\n结局ID：' + endingId);
      setMonologueComplete(true);
      setAppState('ending');
      console.info('[Debug] 已跳转到结局', endingId);
    };
    console.info('[Debug] 结局调试后门已就绪。用法：window.__debugEnding("A") // A-F');
    return () => { delete window.__debugEnding; };
  }, []);

  // 敷衍检测：过题速度极快（不看题秒选）
  const perfunctoryRef = useRef({
    streak: 0,          // 连续"过题很快"的次数
    lastAnswerTime: 0,  // 上一题回答时间戳
  });
  const PERFUNCTORY_FAST_MS = 1500;  // 小于此间隔视为"过题很快/敷衍"
  const PERFUNCTORY_THRESHOLD = 3;   // 超过此次数触发演出

  useEffect(() => {
    // StrictMode 下 useEffect 会执行两次，用 ref 防止重复计数
    if (refreshCheckedRef.current) return;
    refreshCheckedRef.current = true;

    // 检测是否处于问卷进行中（刷新检测）
    if (localStorage.getItem('quiz_started') === 'true') {
      const count = parseInt(localStorage.getItem('refresh_count') || '0', 10) + 1;
      localStorage.setItem('refresh_count', String(count));

      if (count === 1) {
        // 首次刷新：静默断点续答
        setQuestions(drawQuestions(QUESTIONS_PER_ROUND));
        setAppState('quiz');
      } else if (count === 2) {
        setHorrorType('typewriter');
        setHorrorText('亲爱的，你以为刷新就能逃脱吗？');
        setQuestions(drawQuestions(QUESTIONS_PER_ROUND));
        setAppState('quiz');
      } else if (count >= 3) {
        setHorrorType('shatter');
        setHorrorText('不会让你逃掉的，亲爱的');
      }
    }
  }, []);

  const handleHorrorDone = () => {
    if (horrorType === 'shatter' || horrorType === 'perfunctory') {
      localStorage.setItem('horror_closed', 'true');
      localStorage.removeItem('quiz_started');
      localStorage.removeItem('refresh_count');
      // 尝试关闭页面，若浏览器阻止则跳转空白
      window.close();
      setTimeout(() => { window.location.href = 'about:blank'; }, 200);
      return;
    }
    setHorrorType(null);
    setHorrorText('');
  };

  // 切屏重度惩罚：清空所有题目与选项
  const handleTabHeavyPunish = useCallback(() => {
    setQuestions([]);
  }, []);

  // 强制关闭页面（切屏重度演出结束）
  const forceClosePage = useCallback(() => {
    localStorage.setItem('horror_closed', 'true');
    localStorage.removeItem('quiz_started');
    localStorage.removeItem('refresh_count');
    window.close();
    setTimeout(() => { window.location.href = 'about:blank'; }, 200);
  }, []);

  const handleStart = (disableMeta = false) => {
    setMetaEnabled(!disableMeta);
    setQuestions(drawQuestions(QUESTIONS_PER_ROUND));
    setAppState('quiz');
    localStorage.setItem('quiz_started', 'true');
    collectDeviceInfo().then(info => setDeviceInfo(info));
  };

  const handleAnswerSelect = useCallback((optionIndex, optionData) => {
    // 0. 敷衍检测：过题速度极快（不看题秒选）
    const now = Date.now();
    const p = perfunctoryRef.current;
    const fast = p.lastAnswerTime !== 0 && (now - p.lastAnswerTime) < PERFUNCTORY_FAST_MS;

    if (fast) {
      p.streak += 1;
    } else {
      p.streak = 0;
    }
    p.lastAnswerTime = now;

    if (p.streak >= PERFUNCTORY_THRESHOLD) {
      p.streak = 0;
      // 触发"敷衍"演出：网页卡死 → 题目像沙子掉落 → 中央敲字 → 关闭
      setHorrorType('perfunctory');
      setHorrorText('你连看都不看一眼，是在敷衍我吗？');
      return;
    }

    // 质问锚点题本身不触发冲突检测，避免连锁反应
    const isConfrontationQuestion = questions[currentQuestionIndex]?.isConfrontation;

    // 1. 态度冲突检测（质问锚点题跳过）
    const conflictResult = isConfrontationQuestion
      ? { conflict: false }
      : detectConflict(gameState.history, optionData.attitude_tag);

    let newState = gameState;

    if (conflictResult.conflict) {
      // 触发冲突惩罚
      newState = applyConflictPenalty(newState);

      const newConflictCount = conflictCount + 1;
      setConflictCount(newConflictCount);

      if (newConflictCount >= runtimeConfig.conflict.warning_threshold) {
        setShowConflictWarning(true);
      }

      // 强制触发视觉特效（非阻塞，立刻继续流程）
      if (metaEnabled) {
        setCurrentMetaEffect(forceTriggerEffect(conflictResult.severity === 'severe' ? 'heavy' : 'medium'));
      }

      // 插入质问锚点题，然后立即推进（不再延迟3秒）
      const cq = getConfrontationQuestion();
      const newQuestions = [...questions];
      newQuestions.splice(currentQuestionIndex + 1, 0, cq);
      setQuestions(newQuestions);
      newState = applyEffects(newState, optionData.effects || {});
      proceedToNext(newState, optionIndex, optionData, newQuestions);
      return;
    }

    // 2. 正常效果累加
    newState = applyEffects(newState, optionData.effects || {});
    proceedToNext(newState, optionIndex, optionData);

  }, [gameState, questions, currentQuestionIndex, metaEnabled, conflictCount]);

  function proceedToNext(newState, optionIndex, optionData, questionsOverride) {
    const activeQuestions = questionsOverride || questions;
    const nextState = recordAnswer(newState, activeQuestions[currentQuestionIndex]._id, optionIndex, optionData.attitude_tag);
    setGameState(nextState);

    // 尝试触发常规 Meta 特效
    if (metaEnabled) {
      const effect = tryTriggerEffect(null, getNormalizedStats(nextState), true);
      if (effect) setCurrentMetaEffect(effect);
    }

    // 进入下一题或结局
    if (currentQuestionIndex + 1 < activeQuestions.length) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishGame(nextState);
    }
  }

  const finishGame = async (finalState) => {
    const profile = getNormalizedStats(finalState);
    const endingId = routeEnding(profile);
    const currentDeviceInfo = deviceInfo || await collectDeviceInfo();

    if (!deviceInfo) {
      setDeviceInfo(currentDeviceInfo);
    }

    setFinalStats(profile);
    setAppState('pre-ending');
    setMonologue(null);
    setMonologueComplete(false);
    setAudioChunks([]);

    // 清除逃离次数记录
    sessionStorage.removeItem('escape_attempts');
    localStorage.removeItem('quiz_started');
    localStorage.removeItem('refresh_count');

    try {
      // 调用后端 SSE 流式生成结局独白 + TTS 语音
      const response = await fetch(apiUrl('/stream-monologue-tts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          ending_id: endingId,
          device: currentDeviceInfo || {},
        }),
      });

      if (!response.ok) throw new Error('API Error');
      if (!response.body) throw new Error('Streaming response body is empty');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let streamDone = false;

      const handleStreamEvent = (rawEvent) => {
        const event = parseSSEEvent(rawEvent);
        if (!event) return false;

        const payload = event.data.trim();
        if (event.type === 'done' || payload === '[DONE]') {
          return true;
        }

        let parsed;
        try {
          parsed = JSON.parse(payload);
        } catch (error) {
          console.warn('[SSE] Failed to parse event payload:', event, error);
          return false;
        }

        if (event.type === 'error' || parsed.error) {
          throw new Error(parsed.error || 'Stream returned an error event');
        }

        if ((event.type === 'text' || event.type === 'message') && typeof parsed.text === 'string') {
          fullText += parsed.text;
          if (fullText) setMonologue(fullText);
        } else if (event.type === 'audio' && (parsed.audio || parsed.final)) {
          setAudioChunks(prev => [...prev, {
            bytes: parsed.audio ? base64ToBytes(parsed.audio) : new Uint8Array(),
            isFinal: Boolean(parsed.final),
          }]);
        }

        return false;
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          streamDone = handleStreamEvent(rawEvent);
          if (streamDone) break;
        }

        if (done || streamDone) break;
      }

      if (!streamDone && buffer.trim()) {
        streamDone = handleStreamEvent(buffer);
      }

      if (!fullText.trim()) {
        throw new Error('Stream completed without text');
      }
      setMonologueComplete(true);
    } catch (error) {
      console.error('Failed to generate monologue:', error);
      // 降级文案
      setMonologue(FALLBACK_MONOLOGUE);
      setMonologueComplete(true);
    }
  };

  const enterEnding = () => {
    setAudioChunks([]);
    setAppState('ending');
  };

  return (
    <>
      {horrorType && (
        <HorrorScreen
          type={horrorType}
          text={horrorText}
          audioSrc={getHorrorAudioSrc(horrorType)}
          onPlayAudio={playHorrorAudio}
          sandText={horrorType === 'perfunctory' ? (questions[currentQuestionIndex]?.question || '') : ''}
          onDone={handleHorrorDone}
        />
      )}

      {appState === 'warning' && (
        <Warning
          onStart={() => handleStart(false)}
          onDisableMeta={() => handleStart(true)}
          onPrimeAudio={primeHorrorAudio}
        />
      )}

      {appState === 'quiz' && (
        <>
          <TabAwayWatcher
            active={metaEnabled}
            onHeavyPunish={handleTabHeavyPunish}
            onClose={forceClosePage}
          />
          <ProgressBar
            current={currentQuestionIndex + 1}
            total={questions.length}
          />
          
          <main style={{ padding: '6rem 1rem 2rem', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
            <QuizCard
              question={questions[currentQuestionIndex]}
              currentIndex={currentQuestionIndex}
              totalQuestions={questions.length}
              onSelect={handleAnswerSelect}
            />
          </main>

          {/* 微妙的冲突警告 - 右下角小字提示 */}
          {showConflictWarning && (
            <div style={{
              position: 'fixed',
              bottom: (runtimeConfig.conflict.warning_position || '').includes('bottom') ? '1.5rem' : 'auto',
              top: (runtimeConfig.conflict.warning_position || '').includes('top') ? '1.5rem' : 'auto',
              right: (runtimeConfig.conflict.warning_position || '').includes('right') ? '1.5rem' : 'auto',
              left: (runtimeConfig.conflict.warning_position || '').includes('left') ? '1.5rem' : 'auto',
              fontSize: `${runtimeConfig.conflict.warning_font_size || 0.75}rem`,
              color: `rgba(255, 255, 255, ${runtimeConfig.conflict.warning_opacity ?? 0.15})`,
              letterSpacing: '0.05em',
              pointerEvents: 'none',
              zIndex: 100,
              animation: 'fadeIn 0.8s ease',
              fontFamily: 'var(--font-mono)',
            }}>
              ...注意到了
            </div>
          )}
        </>
      )}

      {appState === 'pre-ending' && (
        <PreEndingMonologue
          monologue={monologue}
          monologueComplete={monologueComplete}
          audioChunks={audioChunks}
          onEnterEnding={enterEnding}
        />
      )}

      {appState === 'ending' && (
        <Ending
          monologue={monologue}
          deviceInfo={deviceInfo}
          escapeAttempts={Number(sessionStorage.getItem('escape_attempts') || 0)}
          monologueComplete={monologueComplete}
          stats={finalStats || getNormalizedStats(gameState)}
          audioChunks={[]}
          deferredPwaPrompt={deferredPwaPrompt}
        />
      )}

      <MetaLayer
        effect={currentMetaEffect}
        onEffectEnd={() => setCurrentMetaEffect(null)}
      />
    </>
  );
}

function PreEndingMonologue({ monologue, monologueComplete, audioChunks, onEnterEnding }) {
  const { isPlaying, hasAudio } = useStreamingAudio(audioChunks);
  const hasMonologue = Boolean(monologue && monologue.trim());
  const canEnter = hasMonologue && monologueComplete && (!hasAudio || !isPlaying);

  return (
    <main className="pre-ending-screen">
      <div className="pre-ending-vignette" />
      <section className="pre-ending-panel">
        {!monologue ? (
          <div className="pre-ending-loading">
            <div className="pre-ending-spinner" />
            <p>正在解析你留下的痕迹...</p>
          </div>
        ) : (
          <p className="pre-ending-monologue">
            {monologue}
            {!monologueComplete && <span className="pre-ending-cursor" />}
          </p>
        )}

        <button
          type="button"
          className="pre-ending-button"
          disabled={!canEnter}
          onClick={onEnterEnding}
        >
          {canEnter ? '进入结局' : (hasAudio ? '听完这段话...' : '请等我说完...')}
        </button>
      </section>
    </main>
  );
}
