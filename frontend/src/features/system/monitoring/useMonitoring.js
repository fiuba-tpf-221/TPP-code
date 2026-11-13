import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RANGES } from '../../audit/tracing/model';
import { read } from '../../../shared/api/monitoringApi';

export const MonitoringContext = createContext(null);
// Accede al estado de monitoreo compartido por la sección.
export const useMonitoring = () => useContext(MonitoringContext);

// Consulta una fuente y conserva su última respuesta al fallar una actualización.
export function useRemote(url, key = url) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: '',
    key,
  });
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) =>
      previous.key === key
        ? { ...previous, loading: true, error: '' }
        : { data: null, loading: true, error: '', key },
    );
    read(url, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ data, loading: false, error: '', key });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            loading: false,
            error: error.message,
          }));
      });
    return () => controller.abort();
  }, [url, key]);
  return state;
}

// Comparte el período, la actualización y las observaciones de la sección.
export function useMonitoringState() {
  const [params, setParams] = useSearchParams();
  const range = Object.hasOwn(RANGES, params.get('range'))
    ? params.get('range')
    : '1h';
  const [revision, setRevision] = useState(0);
  const [interval, setRefreshInterval] = useState(15);
  const window = useMemo(() => {
    const end = Date.now() / 1000;
    return { start: end - RANGES[range][1] / 1000, end };
  }, [range, revision]);
  const snapshot = useRemote(`/api/overview?refresh=${revision}`, 'overview');
  useEffect(() => {
    if (!interval) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible')
        setRevision((value) => value + 1);
    }, interval * 1000);
    return () => clearInterval(timer);
  }, [interval]);
  return {
    ...snapshot,
    range,
    selectedContainer: params.get('container') || '',
    selectContainer: (value) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        value ? next.set('container', value) : next.delete('container');
        return next;
      }),
    window,
    params,
    interval,
    setRefreshInterval,
    revision,
    refresh: () => setRevision((value) => value + 1),
    setRange: (value) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set('range', value);
        return next;
      }),
  };
}

// Consulta una métrica permitida o un panel aprovisionado en el período elegido.
export function useMetric(name, panel = null) {
  const { window, range } = useMonitoring();
  const path = panel
    ? `/api/dashboards/${encodeURIComponent(panel.uid)}/panels/${encodeURIComponent(panel.id)}`
    : `/api/metrics/${name}`;
  return useRemote(
    `${path}?${new URLSearchParams(window)}`,
    `${path}:${range}`,
  );
}
