-- One-time seed for the Codes & standards knowledge base (0030), giving it a
-- real starting point rather than an empty list. Content drawn directly from
-- two NZSEE VERT reports: "VERT Venezuela June 2026 (V1.0)" and
-- "VERT Kumamoto, Japan, 28th July 2026 (V1.0)" - specifically their
-- "Seismic codes in Venezuela" / "Seismic Improvement Policy and Performance
-- in Kumamoto" sections. Run once; re-running will duplicate the timeline
-- rows (no unique constraint on country_code_entries beyond its own id),
-- same one-shot convention as 0011's seed inserts.

insert into public.country_codes (country, overview_md) values
('Venezuela', $$## Seismotectonic setting

Venezuela sits at the boundary between the Caribbean and South American plates, with the
Caribbean plate moving east relative to South America at roughly 20 mm/yr. Major historical
ruptures include the 1812 earthquake (Boconó Fault inland, San Sebastián Fault off Caracas), a
1900 event attributed to the offshore San Sebastián Fault, and the 1967 Caracas earthquake
(M6.6), also on the San Sebastián Fault. The 2026 Catia La Mar / La Guaira doublet (Mw 7.2 and
7.5) appears to have ruptured the westerly sections of the San Sebastián Fault, near its
intersection with the Boconó Fault.

## Seismic code history

Before the 1967 Caracas earthquake, Venezuela's only building code was MOP-1939, with
minimum accelerations specified only for mountainous and coastal areas. The 1967 earthquake
prompted a first provisional seismic-resistant design standard (MOP-1967). FUNVISIS (Fundación
Venezolana de Investigaciones Sismológicas) then developed the country's first dedicated
seismic code in 1982 (COVENIN 1756-1982), which made column-confinement and ductile
detailing mandatory. The code was substantially revised in 1998, reviewed again in 2001 (COVENIN
1756-1:2001), and most recently revised in 2019 (COVENIN 1756-1:2019, approved by FONDONORMA
in 2020), which follows a capacity-design philosophy.

Source: NZSEE VERT Venezuela report (June 2026, V1.0).$$),
('Japan', $$## Seismotectonic setting

Japan sits at the junction of the North America, Pacific, Philippine Sea, and Eurasia plates. Off
the north-east Pacific coast, the Pacific plate subducts beneath the North America plate at
roughly 80-90 mm/yr (Kuril-Kamchatka and Japan trenches); towards south-west Japan, the
Philippine Sea plate subducts beneath the Eurasia plate at roughly 48-65 mm/yr (Nankai and
Ryukyu trenches). Residual relative plate motion is also accommodated through active shallow
crustal faults within the overriding plate. The 2016 and 2026 Kumamoto earthquake sequences
both occurred on the Futagawa-Hinagu strike-slip fault zone (Futagawa Fault to the north, Hinagu
Fault to the south); the 2026 rupture is thought to have occurred adjacent to, and south of, the
2016 rupture.

## Seismic code and retrofit policy history

Japan's current seismic design standard - the "New Seismic Design Standard" (shin-taishin) -
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

Source: NZSEE VERT Kumamoto report (28 July 2026 event, V1.0).$$)
on conflict (country) do update set overview_md = excluded.overview_md;

insert into public.country_code_entries (country, year_start, year_end, title, description) values
('Venezuela', 1939, null, 'MOP-1939 (Normas para el Cálculo de Edificios)',
  'Venezuela''s first building code. Specified only minimum accelerations for mountainous and coastal areas; no general seismic design requirements.'),
('Venezuela', 1967, null, 'MOP-1967 (Norma Provisional para Construcciones Antisísmicas)',
  'First provisional seismic-resistant design approach, issued in direct response to the 1967 Caracas earthquake (M6.6).'),
('Venezuela', 1982, null, 'COVENIN 1756-1982',
  'First dedicated seismic code, developed by FUNVISIS. Made column-confinement and ductile detailing mandatory.'),
('Venezuela', 1998, null, 'COVENIN 1756-98',
  'Substantial revision of the 1982 code.'),
('Venezuela', 2001, null, 'COVENIN 1756-1:2001',
  'Review of the 1998 revision.'),
('Venezuela', 2019, 2020, 'COVENIN 1756-1:2019',
  'Latest revision, following a capacity-design philosophy. Approved by FONDONORMA in 2020.'),

('Japan', 1981, null, 'New Seismic Design Standard (Shin-Taishin)',
  'Building Standards Law revision introducing modern seismic design requirements. The single most important threshold for building vulnerability in Japan - pre-1981 buildings are consistently the most heavily damaged in both the 2016 and 2026 Kumamoto sequences.'),
('Japan', 1995, null, 'Act on Promotion of Seismic Retrofit of Buildings',
  'Enacted following the 1995 Great Hanshin-Awaji (Kobe) earthquake. Established the national framework for assessing and retrofitting existing buildings, implemented via prefectural and municipal seismic-retrofit promotion plans.'),
('Japan', 2000, null, 'Building Standards Law amendment (timber connections / wall balance)',
  'Clarified connection and wall-balance requirements for timber houses. Buildings built 1981-2000, before this clarification, remain a distinct vulnerability band alongside pre-1981 stock.'),
('Japan', 2006, null, 'Amendment to the Act on Promotion of Seismic Retrofit of Buildings',
  'Strengthened the 1995 framework.'),
('Japan', 2013, null, 'Amendment to the Act on Promotion of Seismic Retrofit of Buildings',
  'Strengthened mandatory assessment, public disclosure, and administrative powers; also eased retrofit uptake via relaxed approval requirements, floor-area/coverage exemptions, seismic-safety certification, and reduced condominium retrofit voting thresholds.'),
('Japan', 2018, 2024, 'Kumamoto City seismic-retrofit promotion plan (reviewed/extended)',
  'Reviewed after the 2016 Kumamoto earthquake; extended eligibility to timber houses built before June 2000 and expanded support to integrated retrofit, replacement, and seismic shelters. Reissued 2021, minor revisions 2024.');
