import React from 'react';
import { Empty, PanelHeader } from '../../audit/tracing/components';
import { format } from './charts';
import { containerKey, containerName, matchesContainer } from './containers';
import { useMetric, useMonitoring } from './useMonitoring';

// La tabla conserva todas las opciones aunque los gráficos estén filtrados.
export default function ContainerTable() {
  const cpu = useMetric('cpu');
  const memory = useMetric('memory');
  const { selectedContainer, selectContainer } = useMonitoring();
  const containers = new Map();
  for (const [metric, state] of [['cpu', cpu], ['memory', memory]]) {
    for (const series of state.data?.series || []) {
      const key = containerKey(series.labels);
      if (!key) continue;
      const row = containers.get(key) || { key, labels: series.labels };
      row[metric] = series.points.at(-1)?.[1];
      containers.set(key, row);
    }
  }
  const rows = [...containers.values()].sort((a, b) =>
    containerName(a.key).localeCompare(containerName(b.key), 'es'),
  );
  return (
    <section className="obs-panel">
      <PanelHeader
        title="Contenedores"
        description="Seleccioná un contenedor para filtrar los gráficos de recursos y disponibilidad."
      >
        <button
          className="obs-btn obs-btn-secondary"
          onClick={() => selectContainer('')}
          disabled={!selectedContainer}
        >
          Ver todos
        </button>
      </PanelHeader>
      {(cpu.error || memory.error) && (
        <p className="mon-inline-error" role="status">
          {cpu.error || memory.error}
          {rows.length > 0 && ' Se muestran los últimos datos disponibles.'}
        </p>
      )}
      {rows.length ? (
        <div className="obs-table-scroll">
          <table className="obs-table">
            <thead>
              <tr>
                <th>Contenedor</th>
                <th>CPU</th>
                <th>Memoria</th>
                <th>Selección</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const active = !!selectedContainer && matchesContainer(row.labels, selectedContainer);
                return (
                  <tr key={row.key} className={active ? 'mon-selected-row' : ''}>
                    <td>
                      <button
                        className="mon-container-button"
                        aria-pressed={active}
                        onClick={() => selectContainer(active ? '' : row.key)}
                      >
                        {containerName(row.key)}
                      </button>
                    </td>
                    <td>{format(row.cpu, 'percent')}</td>
                    <td>{format(row.memory, 'bytes')}</td>
                    <td>{active ? 'Seleccionado' : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={cpu.loading || memory.loading ? 'Cargando contenedores…' : 'Sin datos de contenedores'}
          icon="services"
        >
          {!cpu.loading && !memory.loading &&
            'cAdvisor debe poder consultar Docker y publicar los nombres de los contenedores. Después de reiniciarlo, esperá las primeras muestras de Prometheus.'}
        </Empty>
      )}
    </section>
  );
}
