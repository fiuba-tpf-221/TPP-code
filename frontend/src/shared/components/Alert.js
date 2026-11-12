import React from 'react';

const MARK = {
  error: <path d="M6.5 6.5l7 7M13.5 6.5l-7 7" />,
  info: <path d="M10 9v5M10 6v.01" />,
  success: <path d="M6 10.5l2.7 2.7L14 8" />,
};

export default function Alert({ kind = 'error', children }) {
  return (
    <div className={`alert alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="currentColor" />
        <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">{MARK[kind]}</g>
      </svg>
      <div>{children}</div>
    </div>
  );
}
