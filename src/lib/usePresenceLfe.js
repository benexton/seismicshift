import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseLfe } from './supabaseLfe.js';

/**
 * Live "who is working on what" presence via Supabase Realtime, namespaced
 * per event so two events' volunteers never collide on one channel. Each
 * open session joins that event's channel and announces the record it
 * currently has open. Presence is ephemeral: it clears automatically when the
 * person closes the record or disconnects, so there are no stale locks and no
 * database writes.
 *
 * Returns:
 *   othersByRecord  Map<recordId, string[]>  names of OTHER people on a record
 *   setActiveRecord(recordId | null)         announce what you have open
 */
export function usePresenceLfe(eventId, userKey, name) {
  const [state, setState] = useState({});
  const channelRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    if (!userKey || !eventId) return undefined;
    let channel;
    try {
      channel = supabaseLfe.channel(`lfe-triage-${eventId}`, { config: { presence: { key: String(userKey) } } });
      channelRef.current = channel;
      channel.on('presence', { event: 'sync' }, () => {
        try { setState(channel.presenceState()); } catch { /* ignore */ }
      });
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try { await channel.track({ name, recordId: activeRef.current }); } catch { /* ignore */ }
        }
      });
    } catch {
      // Realtime unavailable: presence simply stays empty, app is unaffected.
    }
    return () => {
      channelRef.current = null;
      if (channel) { try { supabaseLfe.removeChannel(channel); } catch { /* ignore */ } }
    };
  }, [eventId, userKey, name]);

  const setActiveRecord = useCallback(async (recordId) => {
    activeRef.current = recordId ?? null;
    const ch = channelRef.current;
    if (ch) { try { await ch.track({ name, recordId: activeRef.current }); } catch { /* ignore */ } }
  }, [name]);

  const othersByRecord = useMemo(() => {
    const m = new Map();
    for (const key of Object.keys(state)) {
      if (String(key) === String(userKey)) continue; // skip myself
      for (const pres of state[key] || []) {
        if (!pres || !pres.recordId) continue;
        const who = pres.name || 'Someone';
        if (!m.has(pres.recordId)) m.set(pres.recordId, []);
        const arr = m.get(pres.recordId);
        if (!arr.includes(who)) arr.push(who);
      }
    }
    return m;
  }, [state, userKey]);

  return { othersByRecord, setActiveRecord };
}
