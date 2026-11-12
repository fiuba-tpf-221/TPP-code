import React from 'react';
import { Link } from 'react-router-dom';

// items: [{ label, to? }]. El último es la pantalla actual.
export default function Breadcrumb({ items }) {
  return (
    <nav aria-label="Ruta de navegación" className="breadcrumb">
      <ol>
        {items.map((item, i) => (
          <li key={item.label} aria-current={i === items.length - 1 ? 'page' : undefined}>
            {item.to ? <Link to={item.to}>{item.label}</Link> : item.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
