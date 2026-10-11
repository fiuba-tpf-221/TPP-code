import React, { useEffect, useState } from "react";
import api from "../services/api";

const Dashboard = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/health")
      .then((res) => {
        setHealth(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error al consultar health check:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>FIUBA TPP - Control de Infraestructura</h1>
      <h2>Estado de Servicios en Tiempo Real</h2>
      
      {loading ? (
        <p>Conectando con Backend FastAPI...</p>
      ) : health ? (
        <div style={{ background: "#fff", padding: "1.5rem", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <p><strong>Estado General API:</strong> <span style={{ color: "green" }}>{health.status}</span></p>
          <h3>Conexiones Internas:</h3>
          <ul>
            <li><strong>PostgreSQL / PostGIS:</strong> {health.services?.database}</li>
            <li><strong>RabbitMQ Broker:</strong> {health.services?.rabbitmq}</li>
            <li><strong>MinIO S3 Storage:</strong> {health.services?.minio}</li>
          </ul>
        </div>
      ) : (
        <p style={{ color: "red" }}>Error: No se pudo establecer conexión con el proxy/backend.</p>
      )}
    </div>
  );
};

export default Dashboard;
