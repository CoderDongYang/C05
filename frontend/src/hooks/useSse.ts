import { useEffect, useRef, useState } from 'react';
import { getToken } from '@/utils';
import { useUserStore } from '@/store/userStore';
import type { ToggleChangeEvent } from '@/types';

interface UseSseOptions {
  onRefresh?: (env?: string) => void;
  onToggleChange?: (event: ToggleChangeEvent) => void;
}

interface SseEnvelope {
  type: 'refresh' | 'toggle_change' | 'ping';
  data: Record<string, unknown>;
}

const adaptToggleChange = (data: Record<string, unknown>): ToggleChangeEvent => ({
  toggleId: String(data.toggleId ?? ''),
  toggleKey: data.toggleKey as string,
  environment: data.environment as ToggleChangeEvent['environment'],
  action: data.action as ToggleChangeEvent['action'],
  operatorId: String(data.operatorId ?? ''),
  operatorName: data.operatorName as string,
  oldEnabled: data.oldEnabled as boolean | undefined,
  newEnabled: data.newEnabled as boolean | undefined,
  timestamp: data.timestamp as string,
  currentUserId: data.currentUserId !== undefined ? String(data.currentUserId) : undefined,
});

export const useSse = (options: UseSseOptions = {}) => {
  const esRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);
  const user = useUserStore((s) => s.user);
  const onRefreshRef = useRef(options.onRefresh);
  const onToggleChangeRef = useRef(options.onToggleChange);

  onRefreshRef.current = options.onRefresh;
  onToggleChangeRef.current = options.onToggleChange;

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
      console.log('[SSE] Connection opened');
      setConnected(true);
    };

    es.onerror = (e) => {
      console.warn('[SSE] Connection error', e);
      setConnected(false);
    };

    es.onmessage = (e) => {
      try {
        if (!e.data) return;
        const envelope: SseEnvelope = JSON.parse(e.data);
        console.log('[SSE] Received event:', envelope.type, envelope.data);

        if (envelope.type === 'refresh') {
          const env = envelope.data?.environment as string | undefined;
          onRefreshRef.current?.(env);
        } else if (envelope.type === 'toggle_change') {
          if (envelope.data?.toggleKey) {
            onToggleChangeRef.current?.(adaptToggleChange(envelope.data));
          }
        }
      } catch (err) {
        console.warn('[SSE] Failed to parse SSE message', err);
      }
    };

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
