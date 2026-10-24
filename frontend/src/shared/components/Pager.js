import React from 'react';

// Paginación de las grillas: rango mostrado, tamaño de página y navegación.
export default function Pager({ page, pageSize, total, sizes = [10, 20, 50], onPage, onSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="pager">
      <span>Mostrando {from}–{to} de {total}</span>
      <label className="pager__size">
        Filas por página{' '}
        <select value={pageSize} onChange={(e) => onSize(Number(e.target.value))}>
          {sizes.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <nav className="pager__nav" aria-label="Paginación">
        <button type="button" className="btn btn--secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
        <span>Página {page} de {pages}</span>
        <button type="button" className="btn btn--secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</button>
      </nav>
    </div>
  );
}
