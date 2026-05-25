import { useState } from 'react';
import './FakeDialog.css';

/**
 * 伪系统弹窗
 * 模拟浏览器/操作系统对话框
 */
export default function FakeDialog() {
  const [dismissed, setDismissed] = useState(false);

  const messages = [
    { title: '系统提示', body: '检测到异常操作。' },
    { title: '提示', body: '你确定要关闭这个页面吗？' },
    { title: '注意', body: '有人正在查看你的浏览记录。' },
    { title: '系统通知', body: '该页面请求获取您的注意力。' },
  ];

  const msg = messages[Math.floor(Math.random() * messages.length)];

  if (dismissed) return null;

  return (
    <div className="fake-dialog-backdrop" onClick={() => setDismissed(true)}>
      <div className="fake-dialog" onClick={e => e.stopPropagation()}>
        <div className="fake-dialog-header">
          <span className="fake-dialog-icon">⚠</span>
          <span className="fake-dialog-title">{msg.title}</span>
        </div>
        <p className="fake-dialog-body">{msg.body}</p>
        <div className="fake-dialog-actions">
          <button
            className="fake-dialog-btn"
            onClick={() => setDismissed(true)}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
