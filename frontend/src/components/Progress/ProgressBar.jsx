import './ProgressBar.css';

/**
 * 进度条组件
 * 显示当前答题进度，不暴露六维参数
 */
export default function ProgressBar({ current, total, phase }) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="progress-bar" data-phase={phase}>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="progress-text">
        {current} / {total}
      </span>
    </div>
  );
}
