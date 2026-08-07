// Real per-town hazard-shift ratios, replacing the earlier illustrative H
// placeholder for every town in this list.
// Source: user-provided "Environmental Loads by Towns & Cities" workbook,
// TS 1170.5:2025 comparison columns, adjusted for NZS 3604 zone granularity
// (location-loads_corrected.tsv). An earlier pass of this workbook had its
// final three columns mislabelled, which silently rotated the AB/C/DE ratios
// between site classes for every town; the corrected file fixed the labels
// (not the values) and this dataset was regenerated from it.
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
// actually defines four zones (factors 0.2, 0.3, 0.45, 0.6), based on the
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
  /** The NZS 3604 zone's own coarse hazard factor (zone 1 = 0.2, zone 2 = 0.3, zone 3 = 0.45). */
  eqZoneFactor: number;
  /** z / eqZoneFactor: how far this town's real Z sits from its zone's coarse assumption. */
  zMultiplier: number;
  /** Hazard-shift ratio H, one per NZS 1170.5 site subsoil class, adjusted for NZS 3604 zone granularity. */
  H: Record<SiteClass, number>;
}

export const LOCATION_HAZARDS: LocationHazard[] = [
  { name: 'Alexandra', windRegion: 'A7', leeZone: false, z: 0.21, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.7, H: { AB: 1.06, C: 0.95, DE: 0.86 } },
  { name: 'Arrowtown', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.41, C: 1.23, DE: 1.04 } },
  { name: 'Ashburton', windRegion: 'A7', leeZone: false, z: 0.2, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 1, H: { AB: 1.38, C: 1.25, DE: 1.17 } },
  { name: 'Ashhurst', windRegion: 'A7', leeZone: false, z: 0.39, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.87, H: { AB: 1.94, C: 1.52, DE: 1.07 } },
  { name: 'Auckland', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Balclutha', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 1.3, C: 1.19, DE: 1.07 } },
  { name: 'Beachlands', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Blenheim', windRegion: 'A7', leeZone: false, z: 0.33, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.73, H: { AB: 1.78, C: 1.41, DE: 1.05 } },
  { name: 'Brightwater', windRegion: 'A7', leeZone: false, z: 0.27, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.9, H: { AB: 1.71, C: 1.44, DE: 1.19 } },
  { name: 'Cambridge', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Carterton', windRegion: 'A7', leeZone: true, z: 0.42, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.93, H: { AB: 2.56, C: 1.91, DE: 1.25 } },
  { name: 'Christchurch', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.46, C: 1.27, DE: 1.07 } },
  { name: 'Clive', windRegion: 'A7', leeZone: false, z: 0.38, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.84, H: { AB: 1.72, C: 1.36, DE: 0.99 } },
  { name: 'Cromwell', windRegion: 'A7', leeZone: false, z: 0.24, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.8, H: { AB: 1.18, C: 1.05, DE: 0.92 } },
  { name: 'Dannevirke', windRegion: 'A7', leeZone: false, z: 0.42, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.93, H: { AB: 2.09, C: 1.61, DE: 1.12 } },
  { name: 'Darfield', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.31, C: 1.14, DE: 1 } },
  { name: 'Dargaville', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Dunedin', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 1.27, C: 1.14, DE: 1.05 } },
  { name: 'Featherston', windRegion: 'A7', leeZone: true, z: 0.42, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.93, H: { AB: 2.52, C: 1.88, DE: 1.24 } },
  { name: 'Feilding', windRegion: 'A7', leeZone: false, z: 0.37, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.82, H: { AB: 1.67, C: 1.33, DE: 0.99 } },
  { name: 'Foxton', windRegion: 'A7', leeZone: true, z: 0.36, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.8, H: { AB: 1.76, C: 1.4, DE: 1.02 } },
  { name: 'Geraldine', windRegion: 'A7', leeZone: false, z: 0.19, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.95, H: { AB: 1.38, C: 1.25, DE: 1.17 } },
  { name: 'Gisborne', windRegion: 'A7', leeZone: false, z: 0.36, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.8, H: { AB: 1.7, C: 1.36, DE: 0.98 } },
  { name: 'Gore', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 1.43, C: 1.27, DE: 1.17 } },
  { name: 'Greymouth', windRegion: 'A7', leeZone: false, z: 0.37, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.82, H: { AB: 0.96, C: 0.84, DE: 0.71 } },
  { name: 'Greytown', windRegion: 'A7', leeZone: true, z: 0.42, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.93, H: { AB: 2.49, C: 1.86, DE: 1.24 } },
  { name: 'Hamilton', windRegion: 'A7', leeZone: false, z: 0.16, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.8, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Hastings', windRegion: 'A7', leeZone: false, z: 0.39, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.87, H: { AB: 1.75, C: 1.38, DE: 1 } },
  { name: 'Havelock North', windRegion: 'A7', leeZone: false, z: 0.39, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.87, H: { AB: 1.78, C: 1.4, DE: 1.01 } },
  { name: 'Hawera', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 1.24, C: 1.14, DE: 1.07 } },
  { name: 'Helensville', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Hibiscus Coast', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Hokitika', windRegion: 'A7', leeZone: false, z: 0.45, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 1, H: { AB: 1.13, C: 0.97, DE: 0.79 } },
  { name: 'Huntly', windRegion: 'A7', leeZone: false, z: 0.15, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.75, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Inglewood', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 1.03, C: 0.95, DE: 0.93 } },
  { name: 'Invercargill', windRegion: 'W (NZ4)', leeZone: false, z: 0.17, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.85, H: { AB: 1.56, C: 1.4, DE: 1.27 } },
  { name: 'Kaiapoi', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.32, C: 1.16, DE: 1.01 } },
  { name: 'Kaikohe', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Kaikoura', windRegion: 'A7', leeZone: true, z: 0.42, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.93, H: { AB: 1.76, C: 1.41, DE: 1.03 } },
  { name: 'Kaitaia', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Katikati', windRegion: 'A7', leeZone: false, z: 0.2, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 1, H: { AB: 0.9, C: 0.87, DE: 0.85 } },
  { name: 'Kawerau', windRegion: 'A7', leeZone: false, z: 0.29, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.97, H: { AB: 1.69, C: 1.44, DE: 1.17 } },
  { name: 'Kerikeri', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Kihikihi', windRegion: 'A7', leeZone: false, z: 0.17, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.85, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Kumeu-Huapai', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Lake Hayes', windRegion: 'A7', leeZone: false, z: 0.32, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.71, H: { AB: 0.93, C: 0.8, DE: 0.69 } },
  { name: 'Leeston', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.04, C: 0.93, DE: 0.86 } },
  { name: 'Levin', windRegion: 'A7', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.89, H: { AB: 1.96, C: 1.53, DE: 1.09 } },
  { name: 'Lincoln', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.31, C: 1.14, DE: 0.99 } },
  { name: 'Lower Hutt', windRegion: 'W (NZ3)', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.89, H: { AB: 2.27, C: 1.74, DE: 1.19 } },
  { name: 'Lyttelton', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.41, C: 1.23, DE: 1.03 } },
  { name: 'Maraetai', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Marton', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 2.15, C: 1.75, DE: 1.36 } },
  { name: 'Masterton', windRegion: 'A7', leeZone: false, z: 0.42, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.93, H: { AB: 2.57, C: 1.91, DE: 1.24 } },
  { name: 'Matamata', windRegion: 'A7', leeZone: false, z: 0.19, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.95, H: { AB: 0.95, C: 0.89, DE: 0.88 } },
  { name: 'Milton', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 1.32, C: 1.19, DE: 1.08 } },
  { name: 'Morrinsville', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Mosgiel', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 1.27, C: 1.17, DE: 1.07 } },
  { name: 'Motueka', windRegion: 'A7', leeZone: false, z: 0.26, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.87, H: { AB: 1.45, C: 1.24, DE: 1.06 } },
  { name: 'Napier', windRegion: 'A7', leeZone: false, z: 0.38, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.84, H: { AB: 1.65, C: 1.31, DE: 0.96 } },
  { name: 'Nelson', windRegion: 'A7', leeZone: false, z: 0.27, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.9, H: { AB: 1.73, C: 1.45, DE: 1.2 } },
  { name: 'New Plymouth', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.95, C: 0.89, DE: 0.87 } },
  { name: 'Ngaruawahia', windRegion: 'A7', leeZone: false, z: 0.15, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.75, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Ngongotaha', windRegion: 'A7', leeZone: false, z: 0.24, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.8, H: { AB: 1.06, C: 0.95, DE: 0.86 } },
  { name: 'Oamaru', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 1.27, C: 1.14, DE: 1.05 } },
  { name: 'Ohope', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 2.06, C: 1.72, DE: 1.36 } },
  { name: 'Omokoroa', windRegion: 'A7', leeZone: false, z: 0.2, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 1, H: { AB: 1.01, C: 0.95, DE: 0.93 } },
  { name: 'One Tree Point', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Opotiki', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 2.06, C: 1.71, DE: 1.34 } },
  { name: 'Otaki', windRegion: 'A7', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.89, H: { AB: 2, C: 1.55, DE: 1.1 } },
  { name: 'Otorohanga', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Oxford', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.38, C: 1.21, DE: 1.04 } },
  { name: 'Paeroa', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Pahiatua', windRegion: 'A7', leeZone: false, z: 0.42, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.93, H: { AB: 2.18, C: 1.67, DE: 1.15 } },
  { name: 'Palmerston North', windRegion: 'A7', leeZone: false, z: 0.38, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.84, H: { AB: 1.88, C: 1.48, DE: 1.06 } },
  { name: 'Paraparaumu', windRegion: 'W (NZ3)', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.89, H: { AB: 2.07, C: 1.6, DE: 1.12 } },
  { name: 'Pegasus', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.29, C: 1.13, DE: 1 } },
  { name: 'Picton', windRegion: 'W (NZ3)', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 2.4, C: 1.95, DE: 1.48 } },
  { name: 'Pokeno', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Porirua', windRegion: 'W (NZ3)', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.89, H: { AB: 2.19, C: 1.68, DE: 1.16 } },
  { name: 'Prebbleton', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.38, C: 1.2, DE: 1.02 } },
  { name: 'Pukekohe', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Putaruru', windRegion: 'A7', leeZone: false, z: 0.21, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.7, H: { AB: 0.71, C: 0.66, DE: 0.64 } },
  { name: 'Queenstown', windRegion: 'A7', leeZone: false, z: 0.32, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.71, H: { AB: 0.94, C: 0.82, DE: 0.7 } },
  { name: 'Raglan', windRegion: 'A7', leeZone: false, z: 0.16, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.8, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Rangiora', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.29, C: 1.13, DE: 1 } },
  { name: 'Renwick', windRegion: 'A7', leeZone: false, z: 0.33, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.73, H: { AB: 1.68, C: 1.36, DE: 1.01 } },
  { name: 'Richmond', windRegion: 'A7', leeZone: false, z: 0.27, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.9, H: { AB: 1.73, C: 1.45, DE: 1.2 } },
  { name: 'Riverhead', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Rolleston', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.31, C: 1.16, DE: 1 } },
  { name: 'Rotorua', windRegion: 'A7', leeZone: false, z: 0.24, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.8, H: { AB: 1.16, C: 1.03, DE: 0.9 } },
  { name: 'Ruakaka', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Snells Beach', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Stratford', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 1.11, C: 1.04, DE: 0.98 } },
  { name: 'Taumarunui', windRegion: 'A7', leeZone: true, z: 0.21, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.7, H: { AB: 0.86, C: 0.79, DE: 0.74 } },
  { name: 'Taupo', windRegion: 'A7', leeZone: false, z: 0.28, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.93, H: { AB: 1.38, C: 1.19, DE: 1.01 } },
  { name: 'Tauranga', windRegion: 'A7', leeZone: false, z: 0.2, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 1, H: { AB: 1.16, C: 1.08, DE: 1.03 } },
  { name: 'Te Anau', windRegion: 'A7', leeZone: false, z: 0.36, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.8, H: { AB: 1.29, C: 1.07, DE: 0.85 } },
  { name: 'Te Aroha', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Te Awamutu', windRegion: 'A7', leeZone: false, z: 0.17, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.85, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Te Kuiti', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.87, C: 0.83, DE: 0.83 } },
  { name: 'Te Puke', windRegion: 'A7', leeZone: false, z: 0.22, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.73, H: { AB: 0.95, C: 0.88, DE: 0.8 } },
  { name: 'Temuka', windRegion: 'A7', leeZone: false, z: 0.17, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.85, H: { AB: 1.32, C: 1.21, DE: 1.12 } },
  { name: 'Thames', windRegion: 'A6', leeZone: true, z: 0.16, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.8, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Timaru', windRegion: 'A7', leeZone: false, z: 0.15, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.75, H: { AB: 1.3, C: 1.19, DE: 1.1 } },
  { name: 'Tokoroa', windRegion: 'A7', leeZone: false, z: 0.21, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.7, H: { AB: 0.83, C: 0.78, DE: 0.72 } },
  { name: 'Tuakau', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Turangi', windRegion: 'A7', leeZone: false, z: 0.27, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.9, H: { AB: 1.66, C: 1.4, DE: 1.16 } },
  { name: 'Upper Hutt', windRegion: 'A7', leeZone: false, z: 0.42, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.93, H: { AB: 2.36, C: 1.79, DE: 1.21 } },
  { name: 'Waiheke West', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Waihi', windRegion: 'A6', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Waihi Beach', windRegion: 'A7', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.87, C: 0.83, DE: 0.83 } },
  { name: 'Waikanae', windRegion: 'W (NZ3)', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.89, H: { AB: 2.07, C: 1.59, DE: 1.12 } },
  { name: 'Waimate', windRegion: 'A7', leeZone: false, z: 0.14, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.7, H: { AB: 1.3, C: 1.17, DE: 1.08 } },
  { name: 'Waipawa', windRegion: 'A7', leeZone: false, z: 0.41, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.91, H: { AB: 1.96, C: 1.53, DE: 1.07 } },
  { name: 'Waipukurau', windRegion: 'A7', leeZone: false, z: 0.41, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.91, H: { AB: 2.02, C: 1.55, DE: 1.09 } },
  { name: 'Wairoa', windRegion: 'A7', leeZone: false, z: 0.37, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.82, H: { AB: 1.49, C: 1.21, DE: 0.91 } },
  { name: 'Waitara', windRegion: 'A7', leeZone: true, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.93, C: 0.87, DE: 0.85 } },
  { name: 'Waiuku', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Wakefield', windRegion: 'A7', leeZone: false, z: 0.27, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.9, H: { AB: 1.71, C: 1.44, DE: 1.19 } },
  { name: 'Wanaka', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.39, C: 1.21, DE: 1.04 } },
  { name: 'Warkworth', windRegion: 'A6', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Wellington', windRegion: 'W (NZ3)', leeZone: false, z: 0.4, eqZone: 3, eqZoneFactor: 0.45, zMultiplier: 0.89, H: { AB: 2.27, C: 1.73, DE: 1.19 } },
  { name: 'Wellsford', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'West Melton', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.34, C: 1.17, DE: 1.01 } },
  { name: 'Westport', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.32, C: 1.16, DE: 1 } },
  { name: 'Whakatane', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 2.08, C: 1.72, DE: 1.37 } },
  { name: 'Whangamata', windRegion: 'A7', leeZone: false, z: 0.13, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.65, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Whanganui', windRegion: 'A7', leeZone: false, z: 0.25, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 0.83, H: { AB: 1.76, C: 1.48, DE: 1.2 } },
  { name: 'Whangarei', windRegion: 'A6', leeZone: false, z: 0.1, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.5, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Whitianga', windRegion: 'A6', leeZone: false, z: 0.18, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 0.9, H: { AB: 0.87, C: 0.81, DE: 0.8 } },
  { name: 'Winton', windRegion: 'A7', leeZone: false, z: 0.2, eqZone: 1, eqZoneFactor: 0.2, zMultiplier: 1, H: { AB: 1.61, C: 1.44, DE: 1.3 } },
  { name: 'Woodend', windRegion: 'A7', leeZone: false, z: 0.3, eqZone: 2, eqZoneFactor: 0.3, zMultiplier: 1, H: { AB: 1.29, C: 1.14, DE: 1 } },
];

// Keyed by town name, so the tool can look a location up directly.
export const LOCATION_HAZARDS_BY_NAME: Record<string, LocationHazard> =
  Object.fromEntries(LOCATION_HAZARDS.map((l) => [l.name, l]));
