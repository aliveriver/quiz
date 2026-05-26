import { useState, useEffect, useCallback } from 'react';
import Warning from './components/Warning/Warning';
import QuizCard from './components/Quiz/QuizCard';
import ProgressBar from './components/Progress/ProgressBar';
import MetaLayer from './components/MetaEffects/MetaLayer';
import Ending from './components/Ending/Ending';
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

const QUESTIONS_PER_ROUND = 20;

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

  // 配置: 冲突警告阈值
  const CONFLICT_WARNING_THRESHOLD = 3;

  const handleStart = (disableMeta = false) => {
    setMetaEnabled(!disableMeta);
    setQuestions(drawQuestions(QUESTIONS_PER_ROUND));
    setAppState('quiz');
    
    // 提前在后台收集设备信息用于结局
    collectDeviceInfo().then(info => setDeviceInfo(info));
  };

  const handleAnswerSelect = useCallback((optionIndex, optionData) => {
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
      {appState === 'warning' && (
        <Warning
          onStart={() => handleStart(false)}
          onDisableMeta={() => handleStart(true)}
        />
      )}

      {appState === 'quiz' && (
        <>
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
        />
      )}

      <MetaLayer
        effect={currentMetaEffect}
        onEffectEnd={() => setCurrentMetaEffect(null)}
      />
    </>
  );
}
