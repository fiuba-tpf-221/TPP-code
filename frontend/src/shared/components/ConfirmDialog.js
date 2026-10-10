import React, { useEffect, useRef } from 'react';

// Confirmación previa a acciones sensibles. Usa <dialog> nativo: atrapa el foco y se cierra con Esc.
export default function ConfirmDialog({ open, title, children, confirmLabel, danger = false, busy = false, onConfirm, onCancel }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="dialog-title"
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}>
      <h2 id="dialog-title">{title}</h2>
      <div>{children}</div>
      <div className="dialog__actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="button" className={`btn${danger ? ' btn--danger' : ''}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Procesando…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
