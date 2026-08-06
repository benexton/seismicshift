-- One-time seed for five more countries in the Codes & standards knowledge
-- base: Canada, Chile, New Zealand, Taiwan, United States (alphabetical
-- order, as requested). Content researched via web search against primary/
-- authoritative sources (standards bodies, NEHRP/FEMA, NZSEE bulletins,
-- academic papers on each country's code evolution) rather than recalled
-- from memory alone, given this becomes real reference content. Same two-
-- section shape as Venezuela/Japan (0032): "Seismotectonic setting" and
-- "Seismic code and retrofit policy history".
--
-- Run once only - not idempotent, same as 0031/0032. Requires 0032 (the
-- country_code_sections table) to already be applied.

insert into public.country_codes (country) values
('Canada'), ('Chile'), ('New Zealand'), ('Taiwan'), ('United States')
on conflict (country) do nothing;

insert into public.country_code_sections (country, title, body_md) values

('Canada', 'Seismotectonic setting', $$Canada's seismic hazard is concentrated in two main regions. In the west, the Cascadia
subduction zone (where the Juan de Fuca Plate subducts beneath the North American Plate off
Vancouver Island and southern British Columbia) is capable of producing megathrust earthquakes
above magnitude 9, while the nearby Queen Charlotte Fault is a major transform boundary. In the
east, damaging but less frequent intraplate earthquakes occur along ancient rift structures, most
notably the Charlevoix-Kamouraska seismic zone along the St. Lawrence River.$$),
('Canada', 'Seismic code and retrofit policy history', $$The National Building Code of Canada (NBCC) was first published in 1941, with seismic
provisions only in an appendix; dedicated seismic provisions did not appear in the code proper
until 1953, when the country was first divided into seismic zones. The 1965 edition introduced
importance and soil factors, and responsibility for the seismic provisions passed to the Canadian
National Committee on Earthquake Engineering (CANCEE). The 1970 edition moved to a
probabilistic hazard basis (100-year return period), and the 1985 edition recalculated hazard at
the now-standard 475-year return period (10% probability of exceedance in 50 years).

The 2005 edition was a major advance: it introduced uniform hazard spectra, explicit epistemic
uncertainty via a logic-tree approach, a 2%-in-50-year probability level, and - for the first time -
explicit inclusion of Cascadia subduction megathrust hazard and low-seismicity central-Canada
sources. Subsequent editions have continued to update the underlying hazard model as more
strong-motion and paleoseismic data becomes available.$$),

('Chile', 'Seismotectonic setting', $$Chile lies along one of the most seismically active margins on Earth, where the Nazca Plate
subducts beneath the South American Plate at the Peru-Chile Trench at a rate of roughly
65-80 mm/yr. This megathrust boundary has produced some of the largest earthquakes ever
recorded, including the Mw 9.5 1960 Valdivia earthquake - the largest instrumentally recorded
earthquake in history - and the Mw 8.8 2010 Maule earthquake.$$),
('Chile', 'Seismic code and retrofit policy history', $$Chile's first seismic building provisions were the OGUC (Ordenanza General de Construcciones
y Urbanización) of 1936, which included design requirements for low-rise confined masonry
construction up to two storeys. The catastrophic 1939 Chillán earthquake (Mw 8.3, approximately
28,000 deaths - Chile's deadliest disaster) confirmed the good performance of confined masonry
built to this ordinance and drove its widespread adoption, with further refinement following the
1960 Valdivia earthquake.

Chile's first dedicated modern seismic code, NCh433, was promulgated in 1972 and performed
well in subsequent earthquakes including the 1985 Central Chile (Valparaíso) event. It was
formally re-issued as NCh433.Of96 by presidential decree in December 1996, and amended in
2009 (NCh433.Of96 Mod.2009). The Mw 8.8 2010 Maule earthquake - despite ranking among the
largest earthquakes ever recorded - caused comparatively contained building damage, but still
exposed specific weaknesses in tall reinforced-concrete shear-wall buildings; a government-
appointed subcommittee's recommendations were adopted as Supreme Decrees DS60 (RC
building design) and DS61 (seismic demands) in 2011, then further amended in 2012, expanding
soil classification from five to six categories based on Vs30 and revising design spectra.$$),

('New Zealand', 'Seismotectonic setting', $$New Zealand straddles the boundary between the Australian and Pacific plates. In the North
Island, the Pacific Plate subducts north-westward beneath the Australian Plate along the
Hikurangi subduction zone - the country's largest plate-boundary fault and largest single source
of earthquake and tsunami hazard, capable of producing magnitude 8+ earthquakes. In the South
Island, this relative motion is instead taken up by the Alpine Fault, a single structure running for
over 500 km that links the Puysegur Trench in the south to the Marlborough Fault System in the
north-east, which in turn connects to the Hikurangi subduction zone.$$),
('New Zealand', 'Seismic code and retrofit policy history', $$New Zealand's first seismic design provisions followed the 1931 Hawke's Bay (Napier)
earthquake, which killed 256 people and remains the country's deadliest natural disaster: the
model building bylaw NZSS 95 was published in 1935, one of the first building standards
worldwide to explicitly account for seismic loads. This was updated as NZSS 1900 Chapter 8 in
1965 (introducing importance and soil factors), then superseded by NZS 4203 in 1976, revised in
1984 and again in 1992 (introducing limit-state design). The current earthquake actions standard,
NZS 1170.5, was published in 2004 as part of the joint Australia/New Zealand structural design
actions suite.

The 2010-2011 Canterbury earthquake sequence exposed major gaps in the management of
existing buildings, leading to the Building (Earthquake-prone Buildings) Amendment Act 2016,
which took effect on 1 July 2017. It established a nationally consistent %NBS (percentage of New
Building Standard) system - buildings assessed at 33% or less are classed as earthquake-prone -
divided the country into three seismic risk zones, and created a national public register of
earthquake-prone buildings. Following the 2016 Kaikōura earthquake, the first major update to
NZS 1170.5 since 2004 was released for comment as TS 1170.5:2025.$$),

('Taiwan', 'Seismotectonic setting', $$Taiwan sits at the actively colliding boundary between the Philippine Sea Plate and the
Eurasian Plate, producing one of the most tectonically active orogenic (mountain-building) belts
in the world. The 1999 Chi-Chi (921) earthquake, Taiwan's most destructive in the modern era,
ruptured the Chelungpu Fault, a major thrust fault beneath the western foothills of central
Taiwan.$$),
('Taiwan', 'Seismic code and retrofit policy history', $$Taiwan's first seismic design regulations were introduced in 1974 as part of the Building
Technical Regulations, modelled on the format of the US Uniform Building Code and dividing the
island into three seismic zones (strong/moderate/light) based on regional earthquake frequency,
magnitude and intensity. In 1982, importance factors for different building occupancy categories
were added, with stricter requirements for disaster-response-critical and hazardous-material
buildings.

The devastating Mw 7.6 Chi-Chi (921) earthquake of 21 September 1999 (over 2,400 deaths)
prompted an emergency revision within three months: the December 1999 amendment divided
the country into two earthquake zones (A and B) with design coefficients of 0.33g and 0.23g
respectively. The 2005 update rationalised these zone divisions, with minor updates in 2011
(Taipei Basin sub-zoning, new base-isolated structure provisions). The most recent major
revision, in 2022, strengthened requirements near active fault zones, improved earthquake
resistance for buildings with weak/soft ground floors, refined soil liquefaction assessment and
anti-liquefaction design, and strengthened design quality-assurance requirements.$$),

('United States', 'Seismotectonic setting', $$Seismic hazard in the United States is dominated by the tectonically active West Coast,
where the Pacific Plate grinds past the North American Plate along the San Andreas Fault system
in California, and the Juan de Fuca Plate subducts beneath the North American Plate at the
Cascadia Subduction Zone off Washington, Oregon and northern California - capable of producing
magnitude 9-class megathrust earthquakes similar to the 2011 Tōhoku event. Alaska sits above
the highly active Aleutian subduction zone. Away from these plate boundaries, damaging
intraplate earthquakes still occur, most notably in the New Madrid Seismic Zone in the central US
and the Charleston, South Carolina area.$$),
('United States', 'Seismic code and retrofit policy history', $$The Uniform Building Code (UBC) was first published in 1927 by the International Conference
of Building Officials, but it carried no real seismic design provisions until the Structural Engineers
Association of California's 1959 "Blue Book" (Recommended Lateral Force Requirements) was
incorporated. The 1971 San Fernando earthquake exposed serious deficiencies in concrete frame
ductility and building separation, prompting the 1976 UBC - often cited as the first "modern" US
seismic code - which introduced the first major increase in seismic base-shear coefficients since
the 1930s.

Congress established the National Earthquake Hazards Reduction Program (NEHRP) via the
Earthquake Hazards Reduction Act of 1977. From 1985, the Building Seismic Safety Council
published the NEHRP Recommended Provisions (based on the ATC 3-06 report), which the rival
BOCA and Standard Building Codes adopted from 1993 (the UBC retained its own separate
provisions). The 1994 Northridge earthquake revealed that prescriptive welded steel moment-
frame connections used since the 1970s were fundamentally inadequate, triggering the FEMA/SAC
Steel Moment Frame Project and new connection-qualification testing requirements (FEMA 350,
2000).

By 2000 the three competing model codes consolidated into a single International Building Code
(IBC), incorporating the NEHRP provisions and ASCE 7 (Minimum Design Loads for Buildings and
Other Structures), which remains the primary referenced seismic design-loads standard today.
USGS periodically updates the underlying national seismic hazard maps (most recently in 2014,
feeding ASCE 7-16/IBC 2018), keeping design ground motions current with the latest science.$$);

insert into public.country_code_entries (country, year_start, year_end, title, description) values

('Canada', 1941, null, 'National Building Code of Canada (NBCC), 1st edition',
  'First edition; seismic provisions appeared only in an appendix, not the code proper.'),
('Canada', 1953, null, 'NBCC 1953',
  'First dedicated seismic provisions in the code proper; divided the country into seismic zones for the first time.'),
('Canada', 1965, null, 'NBCC 1965',
  'Introduced importance and soil factors; responsibility for seismic provisions passed to the Canadian National Committee on Earthquake Engineering (CANCEE).'),
('Canada', 1970, null, 'NBCC 1970',
  'Moved to a probabilistic seismic hazard basis, using 100-year return-period values.'),
('Canada', 1985, null, 'NBCC 1985',
  'Hazard recalculated at a 475-year return period (10% probability of exceedance in 50 years), still the standard basis today.'),
('Canada', 2005, null, 'NBCC 2005 (4th generation hazard model)',
  'Major advance: introduced uniform hazard spectra, explicit epistemic uncertainty (logic-tree approach), a 2%-in-50-year probability level, and - for the first time - explicit Cascadia subduction megathrust hazard and low-seismicity central/eastern Canada sources.'),

('Chile', 1936, null, 'OGUC (Ordenanza General de Construcciones y Urbanización)',
  'Chile''s first seismic building provisions, covering low-rise confined masonry construction up to two storeys. Confirmed and popularised after confined masonry built to this ordinance performed well in the 1939 Chillán earthquake.'),
('Chile', 1972, null, 'NCh433 (first edition)',
  'Chile''s first dedicated modern seismic design code.'),
('Chile', 1996, null, 'NCh433.Of96',
  'Formal re-issue by Presidential Decree No. 172 (5 December 1996), incorporating lessons from the 1985 Central Chile earthquake.'),
('Chile', 2009, null, 'NCh433.Of96 Mod.2009',
  'Modification of the 1996 standard.'),
('Chile', 2010, 2012, 'Post-Maule reforms (DS60/DS61)',
  'Following the Mw 8.8 2010 Maule earthquake, a government subcommittee''s recommendations were adopted as Supreme Decrees DS60 (RC building design) and DS61 (seismic demands), further amended in 2012; soil classification expanded from five to six categories based on Vs30, and design spectra revised.'),

('New Zealand', 1935, null, 'NZSS 95 (Model Building By-law)',
  'First New Zealand seismic design provisions, issued directly in response to the 1931 Hawke''s Bay (Napier) earthquake (256 deaths, the country''s deadliest disaster). One of the first building standards in the world to account for seismic loads.'),
('New Zealand', 1965, null, 'NZSS 1900, Chapter 8',
  'Updated general structural design and design loadings, introducing importance and soil factors.'),
('New Zealand', 1976, null, 'NZS 4203:1976',
  'Code of practice for general structural design and design loadings for buildings; substantially increased required loading for structures that dissipate seismic energy other than by ductile flexural yielding.'),
('New Zealand', 1984, null, 'NZS 4203:1984',
  'Revision; the separate importance factor was dropped and merged into the risk factor.'),
('New Zealand', 1992, null, 'NZS 4203:1992',
  'Introduced limit-state design, with a further increase in seismic design coefficients.'),
('New Zealand', 2004, null, 'NZS 1170.5:2004',
  'Current earthquake actions standard, part of the joint AS/NZS 1170 structural design actions suite.'),
('New Zealand', 2016, 2017, 'Building (Earthquake-prone Buildings) Amendment Act 2016',
  'Enacted following the 2010-2011 Canterbury earthquake sequence; took effect 1 July 2017. Introduced the %NBS system (earthquake-prone = 33% or less of new-building standard), three seismic risk zones, and a national public register.'),
('New Zealand', 2025, null, 'TS 1170.5:2025',
  'First major update to the earthquake actions standard since 2004, released for public comment following the 2016 Kaikōura earthquake.'),

('Taiwan', 1974, null, 'Building Technical Regulations (first seismic provisions)',
  'Taiwan''s first seismic design regulations, modelled on the US Uniform Building Code format; divided the island into three seismic zones (strong/moderate/light).'),
('Taiwan', 1982, null, 'Building Technical Regulations amendment',
  'Added importance factors by building occupancy category, with stricter requirements for disaster-response-critical and hazardous-material buildings.'),
('Taiwan', 1999, null, 'Post-Chi-Chi emergency revision',
  'Emergency revision within three months of the Mw 7.6 Chi-Chi (921) earthquake (21 September 1999, 2,400+ deaths); divided the country into Earthquake Division A (0.33g) and B (0.23g).'),
('Taiwan', 2005, null, 'Seismic zone rationalisation',
  'Rationalised the seismic zone divisions introduced after Chi-Chi.'),
('Taiwan', 2011, null, 'Minor code update',
  'Adjusted Taipei Basin sub-zoning; added new provisions for base-isolated structures.'),
('Taiwan', 2022, null, 'Major seismic design revision',
  'Four major changes: increased safety near active fault zones, improved earthquake resistance for weak/soft ground-floor buildings, refined soil liquefaction assessment and anti-liquefaction design, and strengthened design quality-assurance requirements.'),

('United States', 1927, null, 'Uniform Building Code (UBC) first published',
  'First edition, published by the International Conference of Building Officials (ICBO); carried no meaningful seismic design provisions at this stage.'),
('United States', 1959, null, 'SEAOC "Blue Book" (Recommended Lateral Force Requirements)',
  'First substantive US seismic design provisions, developed by the Structural Engineers Association of California and adopted into the UBC.'),
('United States', 1971, 1976, 'Post-San Fernando UBC revision',
  'The 1971 San Fernando earthquake exposed concrete-frame ductility and building-separation deficiencies; the 1976 UBC is widely cited as the first ''modern'' US seismic code, with the first major base-shear increase since the 1930s.'),
('United States', 1977, null, 'National Earthquake Hazards Reduction Program (NEHRP) established',
  'Established by Congress via the Earthquake Hazards Reduction Act of 1977 (Public Law 95-124).'),
('United States', 1985, null, 'NEHRP Recommended Provisions (first edition)',
  'Published by the Building Seismic Safety Council, based on the ATC 3-06 report; adopted by the BOCA and Standard Building Codes from 1993 (the UBC retained its own separate provisions).'),
('United States', 1994, 2000, 'Post-Northridge steel connection reforms',
  'The 1994 Northridge earthquake revealed that prescriptive welded steel moment-frame connections (used 1970-1994) were inadequate; the FEMA/SAC Steel Moment Frame Project produced new mandatory connection-qualification testing requirements (FEMA 350, 2000).'),
('United States', 2000, null, 'International Building Code (IBC) first published',
  'Consolidated the UBC, BOCA and Standard Building Codes into one national model code, incorporating the NEHRP provisions and ASCE 7.'),
('United States', 2014, 2018, 'USGS hazard map update / ASCE 7-16',
  'Updated national seismic hazard model incorporating current science, feeding into ASCE 7-16 and IBC 2018 design ground motions.');
