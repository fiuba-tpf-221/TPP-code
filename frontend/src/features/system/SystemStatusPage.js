import React, { useCallback, useEffect, useState } from 'react';
import Icon from '../../shared/components/icons';
import { CONSOLES, INFRA_CARDS } from '../../config/services';
import { FEATURES } from '../../config/features';
import Alert from '../../shared/components/Alert';
import { checkInfrastructure, SIMULATED_SCENARIOS } from './infraService';
import './system.css';

const STATUS = {
  ONLINE: { label: 'En línea', tone: 'ok' },
  DEGRADED: { label: 'Degradado', tone: 'warn' },
  CHECKING: { label: 'Verificando…', tone: 'wait' },
  UNKNOWN: { label: 'Sin datos', tone: 'idle' },
  OFFLINE: { label: 'Desconectado', tone: 'off' },
};
const CHECKING = Object.fromEntries(INFRA_CARDS.map((c) => [c.id, 'CHECKING']));

function StatusBadge({ status }) {
  const { label, tone } = STATUS[status] ?? STATUS.UNKNOWN; // el texto acompaña al color: no depende solo de él
  return (
    <span className={`svc-badge svc-badge--${tone}`}>
      <span className="svc-badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

// Panel de control e infraestructura: estado de los servicios y accesos a las consolas de monitoreo.
export default function SystemStatusPage() {
  const [statuses, setStatuses] = useState(CHECKING);
  const [checking, setChecking] = useState(true);
  const [checkedAt, setCheckedAt] = useState(null);
  const [scenario, setScenario] = useState('ok'); // solo en modo simulado

  const refresh = useCallback(async () => {
    setChecking(true);
    setStatuses(CHECKING);
    setStatuses(await checkInfrastructure(scenario));
    setCheckedAt(new Date());
    setChecking(false);
  }, [scenario]); // al cambiar de escenario se vuelve a consultar solo

  useEffect(() => { refresh(); }, [refresh]);

  const online = INFRA_CARDS.filter((c) => statuses[c.id] === 'ONLINE').length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Sistema</h1>
          <p className="muted">Panel de control e infraestructura</p>
        </div>
        <button type="button" className="btn btn--secondary" onClick={() => refresh()} disabled={checking}>
          {checking ? 'Verificando…' : 'Actualizar'}
        </button>
      </div>

      {FEATURES.SIMULATE_INFRA && (
        <div className="sim-panel">
          <Alert kind="info">Modo simulado: estos estados no vienen de los servicios reales. Elegí un escenario para ver cómo se muestra cada estado.</Alert>
          <div className="field">
            <label htmlFor="sim-scenario">Escenario simulado</label>
            <select id="sim-scenario" value={scenario} onChange={(e) => setScenario(e.target.value)}>
              {Object.entries(SIMULATED_SCENARIOS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <section className="system-section" aria-labelledby="infra-title">
        <h2 id="infra-title">Estado de la infraestructura base</h2>
        <p className="muted" aria-live="polite">
          {checking ? 'Verificando servicios…' : `${online} de ${INFRA_CARDS.length} servicios en línea · Última verificación: ${checkedAt.toLocaleTimeString('es-AR')}`}
        </p>
        <div className="svc-grid">
          {INFRA_CARDS.map((c) => (
            <article key={c.id} className="svc-card">
              <h3>{c.name}</h3>
              <p className="muted">Puerto {c.port}</p>
              <StatusBadge status={statuses[c.id]} />
            </article>
          ))}
        </div>
      </section>

      <section className="system-section" aria-labelledby="consoles-title">
        <h2 id="consoles-title">Consolas de administración y monitoreo</h2>
        <div className="console-grid">
          {CONSOLES.map((c) => (
            <a key={c.id} className="console" href={c.url} target="_blank" rel="noreferrer noopener">
              <span className="console__icon"><Icon name={c.icon} size={22} /></span>
              <span>
                <strong>{c.name} <span aria-hidden="true">↗</span></strong>
                <small>{c.desc}</small>
              </span>
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
