-- Splits the single free-text country_codes.overview_md blob into discrete,
-- independently-editable title+body sections (country_code_sections) - e.g.
-- "Seismotectonic setting" and "Seismic code and retrofit policy history" as
-- two separate boxes, rather than one combined textarea - with the ability
-- to add further named sections per country beyond those two. country_codes
-- itself is kept as the anchor row (the FK target for both this table and
-- country_code_entries, and what makes a country appear in the list at all),
-- but its own overview_md column is no longer needed once the migration
-- below moves its content into sections, so it is dropped at the end.
--
-- This runs regardless of whether 0031's seed data is present yet - it
-- upserts the country_codes anchor rows for Venezuela/Japan itself before
-- inserting their sections, so it does not depend on 0031 having run first.

create table public.country_code_sections (
  id uuid primary key default gen_random_uuid(),
  country text not null references public.country_codes (country) on delete cascade,
  title text not null,
  body_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create trigger trg_touch_country_code_sections_updated_at
  before update on public.country_code_sections
  for each row execute function public.touch_updated_at();

create index idx_country_code_sections_country on public.country_code_sections (country, created_at);

alter table public.country_code_sections enable row level security;

-- Same permission model as country_codes/country_code_entries (0030): any
-- authenticated user can read, any triager/admin on any event can write.
create policy "country_code_sections select" on public.country_code_sections
  for select to authenticated
  using (true);

create policy "country_code_sections insert" on public.country_code_sections
  for insert to authenticated
  with check (public.is_any_event_writer());

create policy "country_code_sections update" on public.country_code_sections
  for update to authenticated
  using (public.is_any_event_writer());

create policy "country_code_sections delete" on public.country_code_sections
  for delete to authenticated
  using (public.is_any_event_writer());

-- Ensure the anchor rows exist (safe whether or not 0031 already ran).
insert into public.country_codes (country) values ('Venezuela'), ('Japan')
on conflict (country) do nothing;

-- Migrates the two existing countries' content (previously one overview_md
-- blob each, seeded in 0031) into the new two-section shape.
insert into public.country_code_sections (country, title, body_md) values
('Venezuela', 'Seismotectonic setting', $$Venezuela sits at the boundary between the Caribbean and South American plates, with the
Caribbean plate moving east relative to South America at roughly 20 mm/yr. Major historical
ruptures include the 1812 earthquake (Boconó Fault inland, San Sebastián Fault off Caracas), a
1900 event attributed to the offshore San Sebastián Fault, and the 1967 Caracas earthquake
(M6.6), also on the San Sebastián Fault. The 2026 Catia La Mar / La Guaira doublet (Mw 7.2 and
7.5) appears to have ruptured the westerly sections of the San Sebastián Fault, near its
intersection with the Boconó Fault.$$),
('Venezuela', 'Seismic code and retrofit policy history', $$Before the 1967 Caracas earthquake, Venezuela's only building code was MOP-1939, with
minimum accelerations specified only for mountainous and coastal areas. The 1967 earthquake
prompted a first provisional seismic-resistant design standard (MOP-1967). FUNVISIS (Fundación
Venezolana de Investigaciones Sismológicas) then developed the country's first dedicated
seismic code in 1982 (COVENIN 1756-1982), which made column-confinement and ductile
detailing mandatory. The code was substantially revised in 1998, reviewed again in 2001 (COVENIN
1756-1:2001), and most recently revised in 2019 (COVENIN 1756-1:2019, approved by FONDONORMA
in 2020), which follows a capacity-design philosophy.

Source: NZSEE VERT Venezuela report (June 2026, V1.0).$$),

('Japan', 'Seismotectonic setting', $$Japan sits at the junction of the North America, Pacific, Philippine Sea, and Eurasia plates. Off
the north-east Pacific coast, the Pacific plate subducts beneath the North America plate at
roughly 80-90 mm/yr (Kuril-Kamchatka and Japan trenches); towards south-west Japan, the
Philippine Sea plate subducts beneath the Eurasia plate at roughly 48-65 mm/yr (Nankai and
Ryukyu trenches). Residual relative plate motion is also accommodated through active shallow
crustal faults within the overriding plate. The 2016 and 2026 Kumamoto earthquake sequences
both occurred on the Futagawa-Hinagu strike-slip fault zone (Futagawa Fault to the north, Hinagu
Fault to the south); the 2026 rupture is thought to have occurred adjacent to, and south of, the
2016 rupture.$$),
('Japan', 'Seismic code and retrofit policy history', $$Japan's current seismic design standard - the "New Seismic Design Standard" (shin-taishin) -
came into force in June 1981 under the Building Standards Law, and is the key threshold for
building vulnerability: the 2016 and 2026 Kumamoto earthquakes both showed pre-1981
buildings, and timber houses built between 1981 and 2000 (before connection and wall-balance
requirements were clarified in a 2000 amendment), to be the most vulnerable stock.

Separately, the Act on Promotion of Seismic Retrofit of Buildings (1995) was enacted following
the 1995 Great Hanshin-Awaji (Kobe) earthquake, establishing a national framework for assessing
and retrofitting existing buildings, strengthened by amendments in 2006 and 2013 (the 2013
amendment added mandatory assessment/disclosure for specified building types, plus incentives
such as relaxed approval requirements and reduced condominium retrofit voting thresholds).
National policy cascades through prefectural seismic-retrofit promotion plans down to municipal
implementation, funding and owner engagement.

By the end of FY2024, MLIT reported approximately 94% of large buildings requiring urgent safety
confirmation had resolved inadequate seismic resistance, versus ~46% for buildings on
designated evacuation routes and ~90% for housing generally (2023) - illustrating that
institutional framework and actual risk reduction can diverge significantly by building category.
Kumamoto City itself reviewed its retrofit plan in 2018 following the 2016 earthquake, extending
eligibility to timber houses built before June 2000 and expanding support to integrated retrofit,
replacement, and seismic shelters.

Source: NZSEE VERT Kumamoto report (28 July 2026 event, V1.0).$$);
-- No ON CONFLICT here - id is a fresh random uuid per row, so there is
-- nothing for a conflict target to catch. Run this migration once only,
-- same as 0031; re-running it will insert duplicate section rows.

alter table public.country_codes drop column if exists overview_md;
