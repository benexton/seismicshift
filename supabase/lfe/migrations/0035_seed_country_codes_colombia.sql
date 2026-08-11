-- One-time seed for Colombia in the Codes & standards knowledge base. Content
-- researched via web search against primary/authoritative sources (AIS -
-- Asociación Colombiana de Ingeniería Sísmica - decree texts via
-- minvivienda.gov.co/suin-juriscol.gov.co, EEFIT/NZSEE earthquake reports,
-- peer-reviewed seismotectonic literature) rather than recalled from memory
-- alone, given this becomes real reference content. Same two-section shape
-- as the other seeded countries (0032/0033): "Seismotectonic setting" and
-- "Seismic code and retrofit policy history".
--
-- Run once only - not idempotent, same as 0031/0032/0033. Requires 0032 (the
-- country_code_sections table) to already be applied.

insert into public.country_codes (country) values ('Colombia')
on conflict (country) do nothing;

insert into public.country_code_sections (country, title, body_md) values

('Colombia', 'Seismotectonic setting', $$Colombia sits at a complex junction of the Nazca, Caribbean and South American plates. Along
the Pacific coast, the Nazca Plate subducts beneath South America at roughly 60 mm/yr; the slab
is flat for about 400 km beneath the Cauca-Patía region before steepening to around 50° beneath
the Eastern Cordillera, producing the Bucaramanga Nest - an unusually concentrated cluster of
intermediate-depth (60-160 km) earthquakes that accounts for roughly 60% of the seismicity
recorded annually by Colombia's national seismological network, though its depth limits surface
shaking. Shallower crustal hazard is dominated by the Romeral Fault System, a major strike-slip
system running the length of the Andean interior and the source of the 1999 Armenia (Quindío)
earthquake, alongside other Andean fault systems such as that responsible for the 1983 Popayán
earthquake. To the north, slower convergence of the Caribbean Plate beneath the South
Caribbean Deformed Belt adds a third, less active source.$$),

('Colombia', 'Seismic code and retrofit policy history', $$Colombia had no dedicated seismic-resistant building code until the Mw 5.6 1983 Popayán
earthquake (267 deaths) prompted the national government to commission the Colombian
Association of Seismic Engineering (AIS, via its Committee AIS-100) to draft one. The result,
Decreto 1400 de 1984 (Código Colombiano de Construcciones Sismo Resistentes, CCCSR-84), took
effect on 1 December 1984 and applied nationwide; it remained in force for 14 years.

Ley 400 de 1997 replaced this ad hoc, decree-by-decree approach with a standing legal
framework - defining professional responsibilities and establishing a permanent AIS advisory
commission empowered to update the technical regulation without new legislation each time. The
first regulation issued under that framework, NSR-98 (Decreto 33 de 1998), took effect on 19
February 1998 - less than a year before the Mw 6.2, 25 January 1999 Armenia (Quindío) earthquake
(Eje Cafetero region; over 1,180 deaths, 35,000+ homes destroyed or damaged) exposed how
unevenly it had actually been enforced. The disaster accelerated enforcement and drove
amending decrees in 1999, 2000 and 2002 that tightened drift limits, required explicit design of
non-structural elements, and mandated seismic vulnerability evaluation and retrofit of
indispensable buildings (hospitals, emergency-response facilities).

The current code, NSR-10 (Decreto 926 de 2010), was developed by AIS Committee AIS-100
drawing on SEAOC 1999, NEHRP 2006, IBC-2006 and Eurocode 8, and introduced capacity-design
principles, new energy-dissipation coefficients, stricter requirements for irregular structures, and
dedicated chapters on non-structural elements and soil-structure interaction. It has since been
refined by further technical-correction decrees, most substantially Decreto 340 de 2012, with
additional amendments in 2017, 2019 and 2023.$$);

insert into public.country_code_entries (country, year_start, year_end, title, description) values

('Colombia', 1984, null, 'CCCSR-84 (Decreto 1400 de 1984)',
  'Colombia''s first seismic-resistant design and construction code, developed by AIS Committee 100 in direct response to the 1983 Popayán earthquake (267 deaths); took effect 1 December 1984 and applied nationwide.'),
('Colombia', 1997, null, 'Ley 400 de 1997',
  'Established a standing legal framework for seismic-resistant construction - professional responsibilities plus a permanent AIS advisory commission empowered to update the technical regulation periodically without new legislation.'),
('Colombia', 1998, 2002, 'NSR-98 (Decreto 33 de 1998 and amendments)',
  'First regulation issued under Law 400 of 1997, in force from 19 February 1998; amended in 1999, 2000 and 2002 to tighten drift limits, require design of non-structural elements, and mandate seismic evaluation/retrofit of indispensable buildings after the January 1999 Armenia (Quindío) earthquake exposed uneven enforcement.'),
('Colombia', 2010, null, 'NSR-10 (Decreto 926 de 2010)',
  'Current national seismic code, developed by AIS Committee AIS-100 drawing on SEAOC 1999, NEHRP 2006, IBC-2006 and Eurocode 8; introduced capacity-design principles, new energy-dissipation coefficients, stricter rules for irregular structures, and dedicated chapters on non-structural elements and soil-structure interaction.'),
('Colombia', 2012, null, 'Decreto 340 de 2012',
  'Technical-correction decree clarifying ordinances, figures, tables, equations, values and coefficients across NSR-10.'),
('Colombia', 2019, null, 'Decreto 2113 de 2019',
  'Further technical amendment to NSR-10.');
