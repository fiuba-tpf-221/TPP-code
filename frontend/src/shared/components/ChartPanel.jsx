import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import './chart-panel.css';

const ChartView = createContext(null);

// Amplía el mismo panel sin remontar el gráfico ni perder su estado interactivo.
export function ChartPanel({ title, className = '', children }) {
  const [expanded, setExpanded] = useState(false);
  const panel = useRef(null);
  useEffect(() => {
    if (!expanded) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // El contenido fuera de la vista ampliada no recibe foco ni interacción.
    const siblings = [];
    let current = panel.current;
    while (current && current !== document.body) {
      for (const sibling of current.parentElement.children) {
        if (sibling !== current && !sibling.classList.contains('obs-chart-backdrop')) {
          siblings.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      }
      current = current.parentElement;
    }
    panel.current.querySelector('[data-chart-expand]')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      for (const [sibling, inert] of siblings) sibling.inert = inert;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [expanded]);

  function handleKeyDown(event) {
    if (!expanded) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setExpanded(false);
    }
    if (event.key === 'Tab') {
      const focusable = [...panel.current.querySelectorAll(
        'button, a[href], input, select, textarea, summary, [tabindex="0"]',
      )].filter((element) => !element.disabled && element.getClientRects().length);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <ChartView.Provider value={{ expanded, title, toggle: () => setExpanded(!expanded) }}>
      {expanded && <div className="obs-chart-backdrop" aria-hidden="true" onClick={() => setExpanded(false)} />}
      <section
        ref={panel}
        className={`obs-panel obs-chart-panel ${className} ${expanded ? 'is-expanded' : ''}`}
        role={expanded ? 'dialog' : undefined}
        aria-modal={expanded ? 'true' : undefined}
        aria-label={title}
        onKeyDown={handleKeyDown}
      >
        {children}
      </section>
    </ChartView.Provider>
  );
}

// PanelHeader agrega este control únicamente a los paneles ampliables.
export function ChartExpandButton() {
  const view = useContext(ChartView);
  if (!view) return null;
  return (
    <button
      type="button"
      className="obs-btn obs-btn-secondary obs-btn-small"
      data-chart-expand
      onClick={view.toggle}
      aria-expanded={view.expanded}
      aria-label={`${view.expanded ? 'Reducir' : 'Ampliar'} gráfico: ${view.title}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d={view.expanded ? 'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5' : 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5'} />
      </svg>
      {view.expanded ? 'Reducir' : 'Ampliar'}
    </button>
  );
}
