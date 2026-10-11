import React, { useEffect, useState } from 'react';
import keycloak from './keycloak.js';

function App() {
  const username = keycloak.tokenParsed?.preferred_username || 'Usuario';

  const [systemStatus, setSystemStatus] = useState({
    keycloak: 'ONLINE',
    minio: 'CHECKING',
    backend: 'CHECKING',
    postgres: 'CHECKING',
    rabbitmq: 'CHECKING',
    redis: 'CHECKING',
  });

  useEffect(() => {
    fetch('http://localhost:9002/minio/health/live', { mode: 'no-cors' })
      .then(() => setSystemStatus((prev) => ({ ...prev, minio: 'ONLINE' })))
      .catch(() => setSystemStatus((prev) => ({ ...prev, minio: 'OFFLINE' })));

    fetch('http://localhost:8000/health')
      .then((res) => res.json())
      .then((data) => {
        setSystemStatus((prev) => ({
          ...prev,
          backend: data.status,
          postgres: data.dependencies?.postgres || 'OFFLINE',
          rabbitmq: data.dependencies?.rabbitmq || 'OFFLINE',
          redis: data.dependencies?.redis || 'OFFLINE',
        }));
      })
      .catch(() => {
        setSystemStatus((prev) => ({
          ...prev,
          backend: 'OFFLINE',
          postgres: 'OFFLINE',
          rabbitmq: 'OFFLINE',
          redis: 'OFFLINE',
        }));
      });
  }, []);

  const renderBadge = (status) => {
    switch (status) {
      case 'ONLINE': return <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>🟢 En línea</span>;
      case 'DEGRADED': return <span style={{ color: '#ed6c02', fontWeight: 'bold' }}>🟡 Degradado</span>;
      case 'CHECKING': return <span style={{ color: '#ed6c02', fontWeight: 'bold' }}>⏳ Verificando...</span>;
      default: return <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>🔴 Desconectado</span>;
    }
  };

  const webServices = [
    { name: 'Grafana Dashboards', url: 'http://localhost:3001', icon: '📊', desc: 'Métricas e indicadores' },
    { name: 'RabbitMQ Console', url: 'http://localhost:15672', icon: '🐰', desc: 'Gestor de colas de mensajes' },
    { name: 'MinIO Console', url: 'http://localhost:9001', icon: '📦', desc: 'Explorador S3 / Buckets' },
    { name: 'Jaeger Tracing', url: 'http://localhost:16686', icon: '🔍', desc: 'Trazado distribuido' },
    { name: 'Prometheus Metrics', url: 'http://localhost:9090', icon: '🔥', desc: 'Servidor de métricas' },
    { name: 'SonarQube Quality', url: 'http://localhost:9000', icon: '🧹', desc: 'Análisis estático de código' },
  ];

  return (
    <div style={{ padding: '30px', fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '15px', marginBottom: '25px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1a1a1a' }}>FIUBA TPP - Plataforma de Exploración</h1>
          <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '14px' }}>Panel de Control e Infraestructura</p>
        </div>
        <div>
          <span style={{ marginRight: '15px', fontSize: '14px', color: '#333' }}>
            👤 <strong>{username}</strong>
          </span>
          <button
            onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
            style={{ padding: '8px 16px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
        <section>
          <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#333' }}>Estado de la Infraestructura Base</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>🔑 Keycloak Auth</h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>Puerto 8080</p>
              <div>{renderBadge(systemStatus.keycloak)}</div>
            </div>
            <div style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>📦 MinIO S3</h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>Puerto 9002</p>
              <div>{renderBadge(systemStatus.minio)}</div>
            </div>
            <div style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>⚙️ FastAPI Backend</h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>Puerto 8000</p>
              <div>{renderBadge(systemStatus.backend)}</div>
            </div>
            <div style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>🐘 PostgreSQL</h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>Puerto 5432</p>
              <div>{renderBadge(systemStatus.postgres)}</div>
            </div>
            <div style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>🐰 RabbitMQ</h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>Puerto 5672</p>
              <div>{renderBadge(systemStatus.rabbitmq)}</div>
            </div>
            <div style={{ padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fafafa' }}>
              <h3 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>⚡ Redis Cache</h3>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>Puerto 6380</p>
              <div>{renderBadge(systemStatus.redis)}</div>
            </div>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '18px', marginBottom: '15px', color: '#333' }}>Consolas de Administración y Monitoreo</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
            {webServices.map((srv) => (
              <a key={srv.name} href={srv.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', borderRadius: '8px', border: '1px solid #e0e0e0', backgroundColor: '#ffffff', textDecoration: 'none', color: 'inherit', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                <span style={{ fontSize: '28px' }}>{srv.icon}</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#1976d2' }}>{srv.name} ↗</h4>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#666' }}>{srv.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
