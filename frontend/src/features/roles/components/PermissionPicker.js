import React from 'react';

// Permisos agrupados por módulo.
//  mode "create": solo módulos activos y permisos activos (los únicos que pueden asignarse).
//  mode "edit":   además muestra, marcados como inactivos, los permisos que el rol ya tiene aunque hoy estén inactivos
//                 (o pertenezcan a un módulo inactivo). Esos se pueden quitar, pero no volver a asignar.
export default function PermissionPicker({ catalog, selected, assigned = [], onToggle, disabled = false, mode = 'create' }) {
  const assignedSet = new Set(assigned);
  const modules = catalog
    .map((m) => ({ ...m, visible: m.permissions.filter((p) => (m.active && p.active) || (mode === 'edit' && assignedSet.has(p.code))) }))
    .filter((m) => m.visible.length > 0);

  if (modules.length === 0) return <p className="muted">No hay permisos disponibles para asignar.</p>;

  return (
    <div className="perm-picker">
      {modules.map((m) => (
        <fieldset key={m.code} className="choice perm-module">
          <legend>
            {m.name}
            {!m.active && <span className="tag tag--off">Módulo inactivo</span>}
          </legend>
          {m.visible.map((p) => {
            const checked = selected.includes(p.code);
            const inactive = !p.active || !m.active;
            return (
              <label key={p.code} className={inactive ? 'perm perm--off' : 'perm'}>
                {/* un permiso inactivo ya quitado no puede volver a asignarse */}
                <input type="checkbox" checked={checked} disabled={disabled || (inactive && !checked)} onChange={() => onToggle(p.code)} />
                <span>{p.description}</span>
                {inactive && <span className="tag tag--off">Inactivo</span>}
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
