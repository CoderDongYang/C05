import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/utils';
import { useUserStore } from '@/store/userStore';

interface UseSseOptions {
  onRefresh?: (env?: string) => void;
  onMessage?: (event: string, data: unknown) => void;
}

export const useSse = (options: UseSseOptions = {}) => {
  const esRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);
  const user = useUserStore((s) => s.user);
  const onRefreshRef = useRef(options.onRefresh);
  const onMessageRef = useRef(options.onMessage);

  onRefreshRef.current = options.onRefresh;
  onMessageRef.current = options.onMessage;

  useEffect(() => {
    if (!user) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
        setConnected(false);
      }
      return;
    }

    const token = getToken();
    const url = `/api/events?token=${encodeURIComponent(token || '')}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onerror = () => {
      setConnected(false);
    };

    es.addEventListener('refresh', (e) => {
      try {
        const data = e.data ? JSON.parse(e.data) : undefined;
        onRefreshRef.current?.(data?.environment);
      } catch {
        onRefreshRef.current?.();
      }
    });

    es.addEventListener('message', (e) => {
      try {
        const parsed = e.data ? JSON.parse(e.data) : undefined;
        onMessageRef.current?.('message', parsed);
      } catch {
        onMessageRef.current?.('message', e.data);
      }
    });

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [user]);

  const close = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
      setConnected(false);
    }
  };

  return { connected, close };
};
