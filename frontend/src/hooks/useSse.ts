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
        options.onRefresh?.(data?.environment);
      } catch {
        options.onRefresh?.();
      }
    });

    es.addEventListener('message', (e) => {
      try {
        const parsed = e.data ? JSON.parse(e.data) : undefined;
        options.onMessage?.('message', parsed);
      } catch {
        options.onMessage?.('message', e.data);
      }
    });

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [user, options.onRefresh, options.onMessage]);

  const close = () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
      setConnected(false);
    }
  };

  return { connected, close };
};
