// Real per-town hazard-shift ratios, replacing the earlier illustrative H
// placeholder for every town in this list.
// Source: user-provided "locations_final.tsv" workbook (the reconciled
// successor to the earlier "location-loads_corrected.tsv" pass - that
// earlier pass's H values turned out to be inconsistent with the real
// per-town NZS 3604 / TS 1170.5:2025 demand figures used everywhere else in
// this tool, e.g. townDemand.ts and the worked example in BracingCheck.jsx;
// locations_final.tsv gives both demand figures directly per town and site
// class, so H is now computed as ts1170 / nzs3604 straight from it, which
// this dataset matches exactly (also cross-checked against townDemand.ts,
// which already agreed with locations_final.tsv on nzs3604/ts1170 for every
// town - only the old H column was wrong).
//
// H is the ratio of the new TS 1170.5:2025 hazard spectral value to the
// superseded NZS 1170.5:2004 value, at matching site subsoil classes:
//   AB = old site class A/B -> new site class I/II
//   C  = old site class C   -> new site class III
//   DE = old site class D/E -> new site class IV/V
// This is the same "H = NSHM-2022 demand / 3604 basis" ratio the engine's
// seismic scaling uses, now computed per site class instead of guessed.
//
// This H is adjusted from a raw continuous-Z comparison to account for NZS
// 3604 only defining a handful of earthquake zones, each with a single
// coarse zone factor, rather than the town's exact continuous Z. NZS 3604
// actually defines four zones (factors 0.2, 0.3, 0.46, 0.6), based on the
// NZS 1170.5 Z factor at each site; only zones 1-3 appear among the towns
// in this list, so 0.6 (zone 4) is not used below:
//   eqZoneFactor = the NZS 3604 zone's own factor, i.e. what a 3604 design
//     actually assumes for this town.
//   zMultiplier  = z / eqZoneFactor, how far this town's real Z sits from the
//     zone's coarse assumption. Usually below 1, since zone factors sit near
//     the top of their zone's Z range, but not always (see D/E site class).
// H already has this adjustment folded in; eqZoneFactor and zMultiplier are
// kept for reference, not for the engine to recompute H from.
//
// eqZone is the NZS 3604:2011 earthquake zone (1-4) at this location. It is
// not yet used by the engine (bracing units still come from the user's own
// NZS 3604 calculation), but is kept here for reference.
//
// windRegion is the AS/NZS 1170.2 wind region (A6, A7, W (NZ3), W (NZ4)),
// not the NZS 3604 Low/Medium/High wind zone, which depends on site terrain
// and shelter. leeZone flags an NZS 3604 Lee Zone site.

export type SiteClass = "AB" | "C" | "DE";

export const SITE_CLASS_LABELS: Record<SiteClass, string> = {
  AB: "A/B",
  C: "C",
  DE: "D/E",
};

export const DEFAULT_SITE_CLASS: SiteClass = "C";

export interface LocationHazard {
  name: string;
  windRegion: string;
  leeZone: boolean;
  z: number;
  eqZone: number;
  /** The NZS 3604 zone's own coarse hazard factor (zone 1 = 0.2, zone 2 = 0.3, zone 3 = 0.46). */
  eqZoneFactor: number;
  /** z / eqZoneFactor: how far this town's real Z sits from its zone's coarse assumption. */
  zMultiplier: number;
  /** Hazard-shift ratio H, one per NZS 1170.5 site subsoil class, adjusted for NZS 3604 zone granularity. */
  H: Record<SiteClass, number>;
}

export const LOCATION_HAZARDS: LocationHazard[] = [
  { name: 'Alexandra', windRegion: 'A7', leeZone: false, z: 0.21, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.7, H: { AB: 0.6, C: 0.54, DE: 0.47 } },
  { name: 'Arrowtown', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.8, C: 0.71, DE: 0.59 } },
  { name: 'Ashburton', windRegion: 'A7', leeZone: false, z: 0.2, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 1, H: { AB: 0.83, C: 0.75, DE: 0.7 } },
  { name: 'Ashhurst', windRegion: 'A7', leeZone: false, z: 0.39, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.85, H: { AB: 1.38, C: 1.14, DE: 0.72 } },
  { name: 'Auckland', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Balclutha', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.83, C: 0.69, DE: 0.65 } },
  { name: 'Beachlands', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Blenheim', windRegion: 'A7', leeZone: false, z: 0.33, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.72, H: { AB: 1.25, C: 1.07, DE: 0.7 } },
  { name: 'Brightwater', windRegion: 'A7', leeZone: false, z: 0.27, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.9, H: { AB: 0.95, C: 0.83, DE: 0.66 } },
  { name: 'Cambridge', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Carterton', windRegion: 'A7', leeZone: true, z: 0.42, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.91, H: { AB: 1.83, C: 1.46, DE: 0.85 } },
  { name: 'Christchurch', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.85, C: 0.75, DE: 0.59 } },
  { name: 'Clive', windRegion: 'A7', leeZone: false, z: 0.38, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.83, H: { AB: 1.21, C: 1.04, DE: 0.68 } },
  { name: 'Cromwell', windRegion: 'A7', leeZone: false, z: 0.24, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.8, H: { AB: 0.65, C: 0.62, DE: 0.53 } },
  { name: 'Dannevirke', windRegion: 'A7', leeZone: false, z: 0.42, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.91, H: { AB: 1.5, C: 1.21, DE: 0.75 } },
  { name: 'Darfield', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.75, C: 0.67, DE: 0.56 } },
  { name: 'Dargaville', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Dunedin', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.83, C: 0.69, DE: 0.65 } },
  { name: 'Featherston', windRegion: 'A7', leeZone: true, z: 0.42, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.91, H: { AB: 1.79, C: 1.43, DE: 0.85 } },
  { name: 'Feilding', windRegion: 'A7', leeZone: false, z: 0.37, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.8, H: { AB: 1.17, C: 1, DE: 0.68 } },
  { name: 'Foxton', windRegion: 'A7', leeZone: true, z: 0.36, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.78, H: { AB: 1.25, C: 1.07, DE: 0.7 } },
  { name: 'Geraldine', windRegion: 'A7', leeZone: false, z: 0.19, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.95, H: { AB: 0.83, C: 0.75, DE: 0.7 } },
  { name: 'Gisborne', windRegion: 'A7', leeZone: false, z: 0.36, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.78, H: { AB: 1.21, C: 1.04, DE: 0.65 } },
  { name: 'Gore', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.92, C: 0.75, DE: 0.7 } },
  { name: 'Greymouth', windRegion: 'A7', leeZone: false, z: 0.37, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.8, H: { AB: 0.67, C: 0.64, DE: 0.47 } },
  { name: 'Greytown', windRegion: 'A7', leeZone: true, z: 0.42, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.91, H: { AB: 1.75, C: 1.43, DE: 0.82 } },
  { name: 'Hamilton', windRegion: 'A7', leeZone: false, z: 0.16, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.8, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Hastings', windRegion: 'A7', leeZone: false, z: 0.39, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.85, H: { AB: 1.25, C: 1.04, DE: 0.68 } },
  { name: 'Havelock North', windRegion: 'A7', leeZone: false, z: 0.39, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.85, H: { AB: 1.25, C: 1.07, DE: 0.68 } },
  { name: 'Hawera', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.75, C: 0.69, DE: 0.65 } },
  { name: 'Helensville', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Hibiscus Coast', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Hokitika', windRegion: 'A7', leeZone: false, z: 0.45, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.98, H: { AB: 0.79, C: 0.75, DE: 0.52 } },
  { name: 'Huntly', windRegion: 'A7', leeZone: false, z: 0.15, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.75, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Inglewood', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.67, C: 0.56, DE: 0.55 } },
  { name: 'Invercargill', windRegion: 'W (NZ4)', leeZone: false, z: 0.17, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.85, H: { AB: 1, C: 0.81, DE: 0.75 } },
  { name: 'Kaiapoi', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.75, C: 0.67, DE: 0.56 } },
  { name: 'Kaikohe', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Kaikoura', windRegion: 'A7', leeZone: true, z: 0.42, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.91, H: { AB: 1.25, C: 1.07, DE: 0.7 } },
  { name: 'Kaitaia', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Katikati', windRegion: 'A7', leeZone: false, z: 0.2, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 1, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Kawerau', windRegion: 'A7', leeZone: false, z: 0.29, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.97, H: { AB: 0.95, C: 0.83, DE: 0.66 } },
  { name: 'Kerikeri', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Kihikihi', windRegion: 'A7', leeZone: false, z: 0.17, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.85, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Kumeu-Huapai', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Lake Hayes', windRegion: 'A7', leeZone: false, z: 0.32, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.7, H: { AB: 0.67, C: 0.61, DE: 0.47 } },
  { name: 'Leeston', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.6, C: 0.54, DE: 0.47 } },
  { name: 'Levin', windRegion: 'A7', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.87, H: { AB: 1.38, C: 1.18, DE: 0.72 } },
  { name: 'Lincoln', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.75, C: 0.67, DE: 0.56 } },
  { name: 'Lower Hutt', windRegion: 'W (NZ3)', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.87, H: { AB: 1.63, C: 1.32, DE: 0.8 } },
  { name: 'Lyttelton', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.8, C: 0.71, DE: 0.59 } },
  { name: 'Maraetai', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Marton', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.2, C: 1.04, DE: 0.75 } },
  { name: 'Masterton', windRegion: 'A7', leeZone: false, z: 0.42, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.91, H: { AB: 1.83, C: 1.46, DE: 0.85 } },
  { name: 'Matamata', windRegion: 'A7', leeZone: false, z: 0.19, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.95, H: { AB: 0.58, C: 0.5, DE: 0.55 } },
  { name: 'Milton', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.83, C: 0.69, DE: 0.65 } },
  { name: 'Morrinsville', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Mosgiel', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.83, C: 0.69, DE: 0.65 } },
  { name: 'Motueka', windRegion: 'A7', leeZone: false, z: 0.26, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.87, H: { AB: 0.8, C: 0.75, DE: 0.59 } },
  { name: 'Napier', windRegion: 'A7', leeZone: false, z: 0.38, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.83, H: { AB: 1.17, C: 1, DE: 0.65 } },
  { name: 'Nelson', windRegion: 'A7', leeZone: false, z: 0.27, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.9, H: { AB: 1, C: 0.88, DE: 0.69 } },
  { name: 'New Plymouth', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Ngaruawahia', windRegion: 'A7', leeZone: false, z: 0.15, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.75, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Ngongotaha', windRegion: 'A7', leeZone: false, z: 0.24, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.8, H: { AB: 0.6, C: 0.54, DE: 0.47 } },
  { name: 'Oamaru', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.83, C: 0.69, DE: 0.65 } },
  { name: 'Ohope', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.15, C: 1, DE: 0.75 } },
  { name: 'Omokoroa', windRegion: 'A7', leeZone: false, z: 0.2, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 1, H: { AB: 0.67, C: 0.56, DE: 0.55 } },
  { name: 'One Tree Point', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Opotiki', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.15, C: 1, DE: 0.75 } },
  { name: 'Otaki', windRegion: 'A7', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.87, H: { AB: 1.42, C: 1.18, DE: 0.75 } },
  { name: 'Otorohanga', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Oxford', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.8, C: 0.71, DE: 0.59 } },
  { name: 'Paeroa', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Pahiatua', windRegion: 'A7', leeZone: false, z: 0.42, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.91, H: { AB: 1.54, C: 1.25, DE: 0.77 } },
  { name: 'Palmerston North', windRegion: 'A7', leeZone: false, z: 0.38, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.83, H: { AB: 1.33, C: 1.11, DE: 0.72 } },
  { name: 'Paraparaumu', windRegion: 'W (NZ3)', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.87, H: { AB: 1.46, C: 1.21, DE: 0.75 } },
  { name: 'Pegasus', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.75, C: 0.67, DE: 0.56 } },
  { name: 'Picton', windRegion: 'W (NZ3)', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.35, C: 1.17, DE: 0.84 } },
  { name: 'Pokeno', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Porirua', windRegion: 'W (NZ3)', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.87, H: { AB: 1.54, C: 1.29, DE: 0.77 } },
  { name: 'Prebbleton', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.8, C: 0.71, DE: 0.56 } },
  { name: 'Pukekohe', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Putaruru', windRegion: 'A7', leeZone: false, z: 0.21, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.7, H: { AB: 0.4, C: 0.38, DE: 0.38 } },
  { name: 'Queenstown', windRegion: 'A7', leeZone: false, z: 0.32, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.7, H: { AB: 0.67, C: 0.61, DE: 0.47 } },
  { name: 'Raglan', windRegion: 'A7', leeZone: false, z: 0.16, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.8, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Rangiora', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.75, C: 0.67, DE: 0.56 } },
  { name: 'Renwick', windRegion: 'A7', leeZone: false, z: 0.33, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.72, H: { AB: 1.21, C: 1.04, DE: 0.68 } },
  { name: 'Richmond', windRegion: 'A7', leeZone: false, z: 0.27, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.9, H: { AB: 1, C: 0.88, DE: 0.69 } },
  { name: 'Riverhead', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Rolleston', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.75, C: 0.67, DE: 0.56 } },
  { name: 'Rotorua', windRegion: 'A7', leeZone: false, z: 0.24, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.8, H: { AB: 0.65, C: 0.62, DE: 0.5 } },
  { name: 'Ruakaka', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Snells Beach', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Stratford', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.67, C: 0.62, DE: 0.6 } },
  { name: 'Taumarunui', windRegion: 'A7', leeZone: true, z: 0.21, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.7, H: { AB: 0.5, C: 0.46, DE: 0.41 } },
  { name: 'Taupo', windRegion: 'A7', leeZone: false, z: 0.28, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.93, H: { AB: 0.8, C: 0.71, DE: 0.56 } },
  { name: 'Tauranga', windRegion: 'A7', leeZone: false, z: 0.2, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 1, H: { AB: 0.75, C: 0.62, DE: 0.6 } },
  { name: 'Te Anau', windRegion: 'A7', leeZone: false, z: 0.36, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.78, H: { AB: 0.92, C: 0.82, DE: 0.57 } },
  { name: 'Te Aroha', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Te Awamutu', windRegion: 'A7', leeZone: false, z: 0.17, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.85, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Te Kuiti', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Te Puke', windRegion: 'A7', leeZone: false, z: 0.22, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.73, H: { AB: 0.55, C: 0.5, DE: 0.44 } },
  { name: 'Temuka', windRegion: 'A7', leeZone: false, z: 0.17, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.85, H: { AB: 0.83, C: 0.69, DE: 0.65 } },
  { name: 'Thames', windRegion: 'A6', leeZone: true, z: 0.16, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.8, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Timaru', windRegion: 'A7', leeZone: false, z: 0.15, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.75, H: { AB: 0.83, C: 0.69, DE: 0.65 } },
  { name: 'Tokoroa', windRegion: 'A7', leeZone: false, z: 0.21, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.7, H: { AB: 0.45, C: 0.46, DE: 0.41 } },
  { name: 'Tuakau', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Turangi', windRegion: 'A7', leeZone: false, z: 0.27, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.9, H: { AB: 0.95, C: 0.83, DE: 0.66 } },
  { name: 'Upper Hutt', windRegion: 'A7', leeZone: false, z: 0.42, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.91, H: { AB: 1.67, C: 1.36, DE: 0.82 } },
  { name: 'Waiheke West', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Waihi', windRegion: 'A6', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Waihi Beach', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Waikanae', windRegion: 'W (NZ3)', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.87, H: { AB: 1.46, C: 1.21, DE: 0.75 } },
  { name: 'Waimate', windRegion: 'A7', leeZone: false, z: 0.14, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.7, H: { AB: 0.83, C: 0.69, DE: 0.65 } },
  { name: 'Waipawa', windRegion: 'A7', leeZone: false, z: 0.41, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.89, H: { AB: 1.38, C: 1.14, DE: 0.72 } },
  { name: 'Waipukurau', windRegion: 'A7', leeZone: false, z: 0.41, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.89, H: { AB: 1.42, C: 1.18, DE: 0.72 } },
  { name: 'Wairoa', windRegion: 'A7', leeZone: false, z: 0.37, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.8, H: { AB: 1.04, C: 0.93, DE: 0.62 } },
  { name: 'Waitara', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Waiuku', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Wakefield', windRegion: 'A7', leeZone: false, z: 0.27, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.9, H: { AB: 0.95, C: 0.83, DE: 0.66 } },
  { name: 'Wanaka', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.8, C: 0.71, DE: 0.59 } },
  { name: 'Warkworth', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Wellington', windRegion: 'W (NZ3)', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.46, zMultiplier: 0.87, H: { AB: 1.63, C: 1.32, DE: 0.8 } },
  { name: 'Wellsford', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'West Melton', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.75, C: 0.71, DE: 0.56 } },
  { name: 'Westport', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.75, C: 0.67, DE: 0.56 } },
  { name: 'Whakatane', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.2, C: 1, DE: 0.78 } },
  { name: 'Whangamata', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Whanganui', windRegion: 'A7', leeZone: false, z: 0.25, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.83, H: { AB: 1, C: 0.88, DE: 0.69 } },
  { name: 'Whangarei', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Whitianga', windRegion: 'A6', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.58, C: 0.5, DE: 0.5 } },
  { name: 'Winton', windRegion: 'A7', leeZone: false, z: 0.2, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 1, H: { AB: 1, C: 0.88, DE: 0.8 } },
  { name: 'Woodend', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 0.75, C: 0.67, DE: 0.56 } },
];

// Keyed by town name, so the tool can look a location up directly.
export const LOCATION_HAZARDS_BY_NAME: Record<string, LocationHazard> =
  Object.fromEntries(LOCATION_HAZARDS.map((l) => [l.name, l]));
