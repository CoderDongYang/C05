import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/utils';
import { useUserStore } from '@/store/userStore';
import type { ToggleChangeEvent } from '@/types';

interface UseSseOptions {
  onRefresh?: (env?: string) => void;
  onToggleChange?: (event: ToggleChangeEvent) => void;
  onMessage?: (event: string, data: unknown) => void;
}

const extractPayload = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  if (obj.data && typeof obj.data === 'object' && obj.data !== null) {
    const inner = obj.data as Record<string, unknown>;
    if (inner.toggleKey !== undefined) {
      return inner;
    }
  }
  if (obj.toggleKey !== undefined) {
    return obj;
  }
  return {};
};

const adaptToggleChange = (raw: Record<string, unknown>): ToggleChangeEvent => {
  const payload = extractPayload(raw);
  return {
    toggleId: String(payload.toggleId ?? ''),
    toggleKey: payload.toggleKey as string,
    environment: payload.environment as ToggleChangeEvent['environment'],
    action: payload.action as ToggleChangeEvent['action'],
    operatorId: String(payload.operatorId ?? ''),
    operatorName: payload.operatorName as string,
    oldEnabled: payload.oldEnabled as boolean | undefined,
    newEnabled: payload.newEnabled as boolean | undefined,
    timestamp: payload.timestamp as string,
    currentUserId: payload.currentUserId !== undefined ? String(payload.currentUserId) : undefined,
  };
};

export const useSse = (options: UseSseOptions = {}) => {
  const esRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);
  const user = useUserStore((s) => s.user);
  const onRefreshRef = useRef(options.onRefresh);
  const onToggleChangeRef = useRef(options.onToggleChange);
  const onMessageRef = useRef(options.onMessage);

  onRefreshRef.current = options.onRefresh;
  onToggleChangeRef.current = options.onToggleChange;
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
        onRefreshRef.current?.(data?.environment || data?.data?.environment);
      } catch {
        onRefreshRef.current?.();
      }
    });

    es.addEventListener('toggle_change', (e) => {
      try {
        const raw = e.data ? JSON.parse(e.data) : undefined;
        const payload = raw?.data || raw;
        if (payload?.toggleKey) {
          onToggleChangeRef.current?.(adaptToggleChange(payload));
        }
      } catch (err) {
        console.warn('Failed to parse toggle_change event', err);
      }
    });

    es.addEventListener('message', (e) => {
      try {
        const parsed = e.data ? JSON.parse(e.data) : undefined;
        const payload = parsed?.data || parsed;
        if (payload?.type === 'toggle_change' && payload?.data?.toggleKey) {
          onToggleChangeRef.current?.(adaptToggleChange(payload.data as Record<string, unknown>));
        } else if (payload?.type === 'refresh') {
          onRefreshRef.current?.(payload.data?.environment);
        } else {
          onMessageRef.current?.('message', parsed);
        }
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
