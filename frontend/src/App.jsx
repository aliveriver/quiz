import { useState, useEffect, useCallback, useRef } from 'react';
import Warning from './components/Warning/Warning';
import QuizCard from './components/Quiz/QuizCard';
import ProgressBar from './components/Progress/ProgressBar';
import MetaLayer from './components/MetaEffects/MetaLayer';
import TabAwayWatcher from './components/MetaEffects/TabAwayWatcher';
import Ending from './components/Ending/Ending';
import HorrorScreen from './components/HorrorScreen/HorrorScreen';
import CornerWhisper from './components/CornerWhisper/CornerWhisper';
import {
  createInitialState,
  applyEffects,
  applyConflictPenalty,
  recordAnswer,
  getNormalizedStats,
} from './core/stateMachine';
import { detectConflict, getConflictMessage } from './core/conflictDetector';
import { drawQuestions, getConfrontationQuestion } from './core/questionPool';
import { tryTriggerEffect, forceTriggerEffect } from './core/metaEngine';
import { collectDeviceInfo } from './core/deviceProbe';
import { runtimeConfig } from './core/runtimeConfig';

const QUESTIONS_PER_ROUND = runtimeConfig.game.questions_per_round;

export default function App() {
  const [appState, setAppState] = useState('warning'); // 警告、答题、结局
  const [metaEnabled, setMetaEnabled] = useState(true);
  
  // 游戏核心状态
  const [gameState, setGameState] = useState(createInitialState());
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // 演出状态
  const [currentMetaEffect, setCurrentMetaEffect] = useState(null);
  const [confrontationOverlay, setConfrontationOverlay] = useState(null);
  const [monologue, setMonologue] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [escapeAttempts, setEscapeAttempts] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [showConflictWarning, setShowConflictWarning] = useState(false);

  // 刷新追踪 & 恐怖效果
  const [horrorType, setHorrorType] = useState(null);
  const [horrorText, setHorrorText] = useState('');
  const [showCornerWhisper, setShowCornerWhisper] = useState(false);
  const refreshCheckedRef = useRef(false);

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

    // 检测是否曾被恐怖关闭
    if (localStorage.getItem('horror_closed') === 'true') {
      setShowCornerWhisper(true);
    }

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

  // 配置: 冲突警告阈值
  const CONFLICT_WARNING_THRESHOLD = 3;

  const handleStart = (disableMeta = false) => {
    setMetaEnabled(!disableMeta);
    setQuestions(drawQuestions(QUESTIONS_PER_ROUND));
    setAppState('quiz');
    localStorage.setItem('quiz_started', 'true');

    // 提前在后台收集设备信息用于结局
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

    // 1. 态度冲突检测
    const conflictResult = detectConflict(gameState.history, optionData.attitude_tag);
    
    let newState = gameState;

    if (conflictResult.conflict) {
      // 触发冲突惩罚
      newState = applyConflictPenalty(newState);
      
      // 插入质问锚点题
      const confrontationMsg = getConflictMessage(conflictResult);
      setConfrontationOverlay(confrontationMsg);
      
      // 强制触发严重视觉特效
      if (metaEnabled) {
        setCurrentMetaEffect(forceTriggerEffect(conflictResult.severity === 'severe' ? 'heavy' : 'medium'));
      }

      // 等待特效和提示后，插入特殊题目
      setTimeout(() => {
        setConfrontationOverlay(null);
        const cq = getConfrontationQuestion();
        const newQuestions = [...questions];
        newQuestions.splice(currentQuestionIndex + 1, 0, cq);
        setQuestions(newQuestions);
        proceedToNext(newState, optionIndex, optionData);
      }, 3000);
      
      return;
    }

    // 2. 正常效果累加
    newState = applyEffects(newState, optionData.effects || {});
    proceedToNext(newState, optionIndex, optionData);

  }, [gameState, questions, currentQuestionIndex, metaEnabled, conflictCount]);

  const proceedToNext = (newState, optionIndex, optionData) => {
    const nextState = recordAnswer(newState, questions[currentQuestionIndex]._id, optionIndex, optionData.attitude_tag);
    setGameState(nextState);

    // 尝试触发常规 Meta 特效
    if (metaEnabled) {
      const effect = tryTriggerEffect(null, getNormalizedStats(nextState), true);
      if (effect) setCurrentMetaEffect(effect);
    }

    // 进入下一题或结局
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishGame(nextState);
    }
  };

  const [monologueComplete, setMonologueComplete] = useState(false);

  const finishGame = async (finalState) => {
    setAppState('ending');

    // 清除逃离次数记录
    sessionStorage.removeItem('escape_attempts');
    localStorage.removeItem('quiz_started');
    localStorage.removeItem('refresh_count');

    try {
      const profile = getNormalizedStats(finalState);

      // 调用后端 SSE 流式生成结局独白
      const response = await fetch('http://localhost:8080/api/stream-monologue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          device: deviceInfo || {},
        }),
      });

      if (!response.ok) throw new Error('API Error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留不完整行

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') {
            setMonologueComplete(true);
            break;
          }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              fullText += parsed.text;
              setMonologue(fullText);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      setMonologueComplete(true);
    } catch (error) {
      console.error('Failed to generate monologue:', error);
      // 降级文案
      setMonologue("……我一直在看着你。\n你的每一次犹豫，每一次撒谎，我都看在眼里。\n不过没关系，现在，只剩下我们了。");
      setMonologueComplete(true);
    }
  };

  return (
    <>
      {horrorType && (
        <HorrorScreen
          type={horrorType}
          text={horrorText}
          sandText={horrorType === 'perfunctory' ? (questions[currentQuestionIndex]?.question || '') : ''}
          onDone={handleHorrorDone}
        />
      )}

      {showCornerWhisper && <CornerWhisper />}

      {appState === 'warning' && (
        <Warning
          onStart={() => handleStart(false)}
          onDisableMeta={() => handleStart(true)}
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
              bottom: '1.5rem',
              right: '1.5rem',
              fontSize: '0.75rem',
              color: 'rgba(255, 255, 255, 0.15)',
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

      {appState === 'ending' && (
        <Ending
          monologue={monologue}
          deviceInfo={deviceInfo}
          escapeAttempts={escapeAttempts}
          monologueComplete={monologueComplete}
          stats={getNormalizedStats(gameState)}
        />
      )}

      <MetaLayer
        effect={currentMetaEffect}
        onEffectEnd={() => setCurrentMetaEffect(null)}
      />
    </>
  );
}
