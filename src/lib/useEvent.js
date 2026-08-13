import { createContext, createElement, useContext, useEffect, useState } from 'react';
import { supabaseLfe } from './supabaseLfe.js';
import { BASEMAP_PRESETS } from './constantsLfe.js';

// Loads one events row (by slug) plus its event_meta row once, and provides
// them via context so any component in the triage workspace can read the
// event's basemap/map_center/epicentre without prop drilling through the
// tabs container and every modal.

const EventContext = createContext(null);

export function EventProvider({ slug, children }) {
  const [state, setState] = useState({ event: null, meta: null, loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setState({ event: null, meta: null, loading: false, error: 'No event specified. Add ?event=<slug> to the URL.' });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true, error: '' }));
    (async () => {
      const { data: event, error } = await supabaseLfe
        .from('events').select('*').eq('slug', slug).maybeSingle();
      if (cancelled) return;
      if (error) return setState({ event: null, meta: null, loading: false, error: error.message });
      if (!event) return setState({ event: null, meta: null, loading: false, error: `No event found for "${slug}".` });

      const { data: meta } = await supabaseLfe
        .from('event_meta').select('*').eq('event_id', event.id).maybeSingle();
      if (cancelled) return;
      setState({ event, meta: meta ?? null, loading: false, error: '' });
    })();
    return () => { cancelled = true; };
  }, [slug]);

  return createElement(EventContext.Provider, { value: state }, children);
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error('useEvent must be used within an EventProvider');
  return ctx;
}

// [[key, {label, url, attribution}], ...] for a basemap <select>. The admin
// panel only ever saves a single preset onto event.basemap, so that one is
// listed first (keeping it the default selection) and the rest of
// BASEMAP_PRESETS is appended - otherwise the picker would only ever offer
// one map type to switch between.
export function basemapEntries(event) {
  const chosen = Object.entries(event?.basemap ?? {});
  const chosenKeys = new Set(chosen.map(([k]) => k));
  const rest = Object.entries(BASEMAP_PRESETS).filter(([k]) => !chosenKeys.has(k));
  return [...chosen, ...rest];
}

export function mapCenterOf(event) {
  const c = event?.map_center ?? {};
  return { center: [c.lat ?? 0, c.lng ?? 0], zoom: c.zoom ?? 10 };
}

export function epicentreOf(event) {
  return { lat: event?.epicentre_lat ?? null, lng: event?.epicentre_lng ?? null };
}
