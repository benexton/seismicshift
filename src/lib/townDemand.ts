// Per-town NZS 3604 vs TS 1170.5:2025 demand, by site subsoil class - powers
// the "How does your town/city stack up?" comparison chart on the designer
// tab (BracingCheck.jsx). Source: user-provided "graphing1.tsv" workbook.
//
// nzs3604 is the NZS 3604:2011 earthquake zone's own coarse demand - constant
// across every town sharing a zone, since 3604 design only ever looks at the
// zone, not the town's exact Z factor (same zone-granularity idea as
// locationHazard.ts's eqZoneFactor). ts1170 is the town's real per-site
// TS 1170.5:2025 demand. Both are unitless spectral-demand figures, not
// bracing units - meaningful only in relative comparison between towns,
// which is what the chart is for. A third "ignore" column in the source
// workbook (a repeat of the raw hazard-shift ratio, per the brief) is
// deliberately dropped here.

import type { SiteClass } from './locationHazard';
import { F_SR337 } from './bracingChecker';

export interface TownDemand {
  name: string;
  nzs3604: Record<SiteClass, number>;
  ts1170: Record<SiteClass, number>;
}

export const TOWN_DEMANDS: TownDemand[] = [
  { name: 'Alexandra', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.12, C: 0.13, DE: 0.15 } },
  { name: 'Arrowtown', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.16, C: 0.17, DE: 0.19 } },
  { name: 'Ashburton', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.1, C: 0.12, DE: 0.14 } },
  { name: 'Ashhurst', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.33, C: 0.32, DE: 0.29 } },
  { name: 'Auckland', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Balclutha', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.1, C: 0.11, DE: 0.13 } },
  { name: 'Beachlands', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Blenheim', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.3, C: 0.3, DE: 0.28 } },
  { name: 'Brightwater', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.19, C: 0.2, DE: 0.21 } },
  { name: 'Cambridge', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Carterton', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.44, C: 0.41, DE: 0.34 } },
  { name: 'Christchurch', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.17, C: 0.18, DE: 0.19 } },
  { name: 'Clive', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.29, C: 0.29, DE: 0.27 } },
  { name: 'Cromwell', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.13, C: 0.15, DE: 0.17 } },
  { name: 'Dannevirke', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.36, C: 0.34, DE: 0.3 } },
  { name: 'Darfield', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.15, C: 0.16, DE: 0.18 } },
  { name: 'Dargaville', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Dunedin', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.1, C: 0.11, DE: 0.13 } },
  { name: 'Featherston', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.43, C: 0.4, DE: 0.34 } },
  { name: 'Feilding', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.28, C: 0.28, DE: 0.27 } },
  { name: 'Foxton', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.3, C: 0.3, DE: 0.28 } },
  { name: 'Geraldine', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.1, C: 0.12, DE: 0.14 } },
  { name: 'Gisborne', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.29, C: 0.29, DE: 0.26 } },
  { name: 'Gore', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.11, C: 0.12, DE: 0.14 } },
  { name: 'Greymouth', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.16, C: 0.18, DE: 0.19 } },
  { name: 'Greytown', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.42, C: 0.4, DE: 0.33 } },
  { name: 'Hamilton', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Hastings', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.3, C: 0.29, DE: 0.27 } },
  { name: 'Havelock North', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.3, C: 0.3, DE: 0.27 } },
  { name: 'Hawera', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.09, C: 0.11, DE: 0.13 } },
  { name: 'Helensville', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Hibiscus Coast', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Hokitika', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.19, C: 0.21, DE: 0.21 } },
  { name: 'Huntly', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Inglewood', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.08, C: 0.09, DE: 0.11 } },
  { name: 'Invercargill', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.12, C: 0.13, DE: 0.15 } },
  { name: 'Kaiapoi', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.15, C: 0.16, DE: 0.18 } },
  { name: 'Kaikohe', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Kaikoura', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.3, C: 0.3, DE: 0.28 } },
  { name: 'Kaitaia', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Katikati', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Kawerau', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.19, C: 0.2, DE: 0.21 } },
  { name: 'Kerikeri', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Kihikihi', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Kumeu-Huapai', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Lake Hayes', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.16, C: 0.17, DE: 0.19 } },
  { name: 'Leeston', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.12, C: 0.13, DE: 0.15 } },
  { name: 'Levin', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.33, C: 0.33, DE: 0.29 } },
  { name: 'Lincoln', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.15, C: 0.16, DE: 0.18 } },
  { name: 'Lower Hutt', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.39, C: 0.37, DE: 0.32 } },
  { name: 'Lyttelton', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.16, C: 0.17, DE: 0.19 } },
  { name: 'Maraetai', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Marton', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.24, C: 0.25, DE: 0.24 } },
  { name: 'Masterton', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.44, C: 0.41, DE: 0.34 } },
  { name: 'Matamata', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.11 } },
  { name: 'Milton', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.1, C: 0.11, DE: 0.13 } },
  { name: 'Morrinsville', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Mosgiel', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.1, C: 0.11, DE: 0.13 } },
  { name: 'Motueka', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.16, C: 0.18, DE: 0.19 } },
  { name: 'Napier', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.28, C: 0.28, DE: 0.26 } },
  { name: 'Nelson', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.2, C: 0.21, DE: 0.22 } },
  { name: 'New Plymouth', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Ngaruawahia', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Ngongotaha', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.12, C: 0.13, DE: 0.15 } },
  { name: 'Oamaru', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.1, C: 0.11, DE: 0.13 } },
  { name: 'Ohope', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.23, C: 0.24, DE: 0.24 } },
  { name: 'Omokoroa', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.08, C: 0.09, DE: 0.11 } },
  { name: 'One Tree Point', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Opotiki', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.23, C: 0.24, DE: 0.24 } },
  { name: 'Otaki', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.34, C: 0.33, DE: 0.3 } },
  { name: 'Otorohanga', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Oxford', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.16, C: 0.17, DE: 0.19 } },
  { name: 'Paeroa', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Pahiatua', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.37, C: 0.35, DE: 0.31 } },
  { name: 'Palmerston North', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.32, C: 0.31, DE: 0.29 } },
  { name: 'Paraparaumu', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.35, C: 0.34, DE: 0.3 } },
  { name: 'Pegasus', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.15, C: 0.16, DE: 0.18 } },
  { name: 'Picton', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.27, C: 0.28, DE: 0.27 } },
  { name: 'Pokeno', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Porirua', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.37, C: 0.36, DE: 0.31 } },
  { name: 'Prebbleton', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.16, C: 0.17, DE: 0.18 } },
  { name: 'Pukekohe', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Putaruru', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.08, C: 0.09, DE: 0.12 } },
  { name: 'Queenstown', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.16, C: 0.17, DE: 0.19 } },
  { name: 'Raglan', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Rangiora', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.15, C: 0.16, DE: 0.18 } },
  { name: 'Renwick', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.29, C: 0.29, DE: 0.27 } },
  { name: 'Richmond', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.2, C: 0.21, DE: 0.22 } },
  { name: 'Riverhead', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Rolleston', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.15, C: 0.16, DE: 0.18 } },
  { name: 'Rotorua', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.13, C: 0.15, DE: 0.16 } },
  { name: 'Ruakaka', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Snells Beach', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Stratford', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.08, C: 0.1, DE: 0.12 } },
  { name: 'Taumarunui', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.1, C: 0.11, DE: 0.13 } },
  { name: 'Taupo', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.16, C: 0.17, DE: 0.18 } },
  { name: 'Tauranga', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.09, C: 0.1, DE: 0.12 } },
  { name: 'Te Anau', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.22, C: 0.23, DE: 0.23 } },
  { name: 'Te Aroha', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Te Awamutu', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Te Kuiti', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Te Puke', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.11, C: 0.12, DE: 0.14 } },
  { name: 'Temuka', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.1, C: 0.11, DE: 0.13 } },
  { name: 'Thames', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Timaru', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.1, C: 0.11, DE: 0.13 } },
  { name: 'Tokoroa', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.09, C: 0.11, DE: 0.13 } },
  { name: 'Tuakau', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Turangi', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.19, C: 0.2, DE: 0.21 } },
  { name: 'Upper Hutt', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.4, C: 0.38, DE: 0.33 } },
  { name: 'Waiheke West', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Waihi', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Waihi Beach', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Waikanae', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.35, C: 0.34, DE: 0.3 } },
  { name: 'Waimate', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.1, C: 0.11, DE: 0.13 } },
  { name: 'Waipawa', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.33, C: 0.32, DE: 0.29 } },
  { name: 'Waipukurau', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.34, C: 0.33, DE: 0.29 } },
  { name: 'Wairoa', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.25, C: 0.26, DE: 0.25 } },
  { name: 'Waitara', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Waiuku', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Wakefield', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.19, C: 0.2, DE: 0.21 } },
  { name: 'Wanaka', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.16, C: 0.17, DE: 0.19 } },
  { name: 'Warkworth', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Wellington', nzs3604: { AB: 0.24, C: 0.28, DE: 0.4 }, ts1170: { AB: 0.39, C: 0.37, DE: 0.32 } },
  { name: 'Wellsford', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'West Melton', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.15, C: 0.17, DE: 0.18 } },
  { name: 'Westport', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.15, C: 0.16, DE: 0.18 } },
  { name: 'Whakatane', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.24, C: 0.24, DE: 0.25 } },
  { name: 'Whangamata', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Whanganui', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.2, C: 0.21, DE: 0.22 } },
  { name: 'Whangarei', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Whitianga', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.07, C: 0.08, DE: 0.1 } },
  { name: 'Winton', nzs3604: { AB: 0.12, C: 0.16, DE: 0.2 }, ts1170: { AB: 0.12, C: 0.14, DE: 0.16 } },
  { name: 'Woodend', nzs3604: { AB: 0.2, C: 0.24, DE: 0.32 }, ts1170: { AB: 0.15, C: 0.16, DE: 0.18 } },
];

export interface TownChartStat {
  name: string;
  /** NZS 3604's own coarse (zone-only) demand. */
  base: number;
  /** How much the TS 1170.5:2025 demand sits above the NZS 3604 figure, if at all. */
  hazardExcess: number;
  /** The larger of the two - what the chart's "baseline" (black + excess) represents. */
  combined: number;
  /** combined * F_SR337 - the low damage target. */
  lowDamage: number;
  /** lowDamage - combined - the added SR337 margin, shown as the top (green) segment. */
  margin: number;
}

/** Every town's chart stats for one site class, ranked largest low-damage target first. */
export function getTownChartStats(siteClass: SiteClass): TownChartStat[] {
  return TOWN_DEMANDS.map((t) => {
    const base = t.nzs3604[siteClass];
    const ts = t.ts1170[siteClass];
    const combined = Math.max(base, ts);
    const hazardExcess = Math.max(0, ts - base);
    const lowDamage = combined * F_SR337;
    const margin = lowDamage - combined;
    return { name: t.name, base, hazardExcess, combined, lowDamage, margin };
  }).sort((a, b) => b.lowDamage - a.lowDamage);
}
