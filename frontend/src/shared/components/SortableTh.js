import React from 'react';

// Encabezado de columna ordenable (ascendente/descendente). `column.sortable === false` lo deja como texto.
export default function SortableTh({ column, sort, order, onSort, className }) {
  const sortable = column.sortable !== false;
  const active = sortable && sort === column.key;
  return (
    <th scope="col" className={className} aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : undefined}>
      {sortable ? (
        <button type="button" className="th-sort" onClick={() => onSort(column.key)}>
          {column.label}
          <span aria-hidden="true">{active ? (order === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span>
        </button>
      ) : column.label}
    </th>
  );
}
