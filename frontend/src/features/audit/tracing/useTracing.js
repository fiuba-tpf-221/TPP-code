import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getServices, getTraces } from './api';
import { RANGES, summarize } from './model';

export const TracingContext = createContext(null);
// Accede al estado de tracing compartido por la sección.
export const useTracing = () => useContext(TracingContext);

// Administra filtros y consultas cancelables de Jaeger solo en las pantallas de tracing.
export function useTraceQuery(enabled = true) {
  const [params, setParams] = useSearchParams();
  const service = params.get('service') || 'backend-api';
  const range = Object.hasOwn(RANGES, params.get('range'))
    ? params.get('range')
    : '1h';
  const operation = params.get('operation') || '';
  const status = params.get('status') === 'error' ? 'error' : '';
  const requestedDuration = Number(params.get('minDuration'));
  const minDuration = Number.isFinite(requestedDuration)
    ? Math.max(0, requestedDuration)
    : 0;
  const filters = useMemo(
    () => ({ service, range, operation, status, minDuration }),
    [service, range, operation, status, minDuration],
  );
  const [services, setServices] = useState([]);
  const [serviceError, setServiceError] = useState('');
  const [revision, setRevision] = useState(0);
  const [interval, setRefreshInterval] = useState(0);
  const [result, setResult] = useState({
    traces: [],
    window: null,
    updated: null,
    loading: true,
    refreshing: false,
    error: '',
  });
  // Solicita una actualización de las trazas actuales.
  const refresh = () => setRevision((value) => value + 1);

  // Actualiza los filtros en la URL preservando los parámetros restantes.
  function updateParams(values, replace = false) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(values).forEach(([key, value]) =>
          value === '' || value == null
            ? next.delete(key)
            : next.set(key, String(value)),
        );
        return next;
      },
      { replace },
    );
  }

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    getServices(controller.signal)
      .then((data) => {
        setServices(data.filter((value) => typeof value === 'string').sort());
        setServiceError('');
      })
      .catch((error) => {
        if (!controller.signal.aborted) setServiceError(error.message);
      });
    return () => controller.abort();
  }, [revision, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    // La ventana queda fijada por consulta, también para los gráficos.
    const end = Date.now();
    const window = { start: end - RANGES[range][1], end };
    const key = JSON.stringify(filters);
    setResult((previous) =>
      previous.key === key && previous.updated
        ? { ...previous, refreshing: true, error: '' }
        : {
            traces: [],
            window,
            updated: null,
            loading: true,
            refreshing: false,
            error: '',
            key,
          },
    );
    getTraces(filters, window, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({
            traces: data.map(summarize),
            window,
            updated: new Date(),
            loading: false,
            refreshing: false,
            error: '',
            key,
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            traces: [],
            window,
            updated: null,
            loading: false,
            refreshing: false,
            error: error.message,
            key,
          });
      });
    return () => controller.abort();
  }, [filters, range, revision, enabled]);

  useEffect(() => {
    if (!interval || !enabled) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible')
        setRevision((value) => value + 1);
    }, interval * 1000);
    return () => clearInterval(timer);
  }, [interval, enabled]);

  return {
    ...result,
    services,
    serviceError,
    filters,
    params,
    updateParams,
    refresh,
    interval,
    setRefreshInterval,
  };
}
