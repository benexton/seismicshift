/* =============================================================================
   Survive or Thrive? - design data + engineering model.

   Pure functions of a `design` object, no DOM:
     { typeKey, systemKey, protections:{key:bool}, additions:{key:bool} }

   Loaded two ways, both reading globalThis.SOT_MODEL:
   - by index.html as a plain <script>;
   - by scripts/survive-or-thrive/gen-design-scores.mjs (evaluated in a vm
     context - this file stays a classic script, not a module),
     which enumerates every valid design and writes the server's
     design -> score lookup table. The server never trusts a score sent by
     the browser - it looks the submitted design up in that table instead.

   ANY change here that can move a score (data, costs, formulas, constants)
   means re-running that script and applying its SQL to the Supabase
   project, otherwise the leaderboard keeps scoring with the old numbers.

   HOW THE MODEL WORKS (a simplified performance-based assessment):
   - Every design is checked against three earthquakes - moderate (~1 in 25
     years), strong (the ~1-in-500-year design level) and major (~1 in 2,500
     years) - each a design-style response spectrum scaled to a peak ground
     acceleration.
   - Each structural system has a period T, a yield strength Cy (as a
     fraction of the building's weight), damping, and a ductility capacity
     (how far past yield it can deform before collapsing). Protection
     options change those; add-ons add roof-level mass the structure wasn't
     designed for.
   - Spectral demand / strength gives the strength ratio R, and R gives the
     ductility demand (Eurocode 8's N2 relation: equal displacement above
     the spectrum corner period, amplified below it). Ductility demand against capacity sets the
     damage state: none / slight (Thrive), moderate / extensive (Survive),
     collapse (Fail).
   - The leaderboard score weighs the damage in all three earthquakes
     (mostly the design-level one), relative to what's achievable for that
     building type, times a budget-efficiency factor. A design that
     collapses in the design-level earthquake fails life safety and can't
     score.
============================================================================= */
(function(root){
  "use strict";

  /* =========================================================
     DATA
  ========================================================= */
  var BUILDING_TYPES = {
    house: {
      key:'house', label:'Detached Home', category:'house', storeys:2,
      renderSegments:2, bw:70, renderH:70,
      blurb:'2-storey timber-framed home'
    },
    industrial: {
      key:'industrial', label:'Industrial Building', category:'standard', storeys:1,
      renderSegments:1, bw:150, renderH:96,
      blurb:'1 tall storey, wide clear-span building'
    },
    commercial: {
      key:'commercial', label:'Commercial Block', category:'standard', storeys:4,
      renderSegments:4, bw:96, renderH:195,
      blurb:'4-storey office block'
    }
  };
  var TYPE_ORDER = ['house','industrial','commercial'];

  var HOUSE_SYSTEMS = {
    plasterboard: { key:'plasterboard', label:'Plasterboard Linings', desc:'Standard plasterboard bracing walls.' },
    plywood:      { key:'plywood',      label:'Plywood Linings',      desc:'Structural plywood sheathing, stronger bracing.' }
  };
  var HOUSE_SYSTEM_ORDER = ['plasterboard','plywood'];

  var STANDARD_SYSTEMS = {
    moment:     { key:'moment',     label:'Moment Frame',  desc:'Rigid joints share the load evenly.' },
    braced:     { key:'braced',     label:'Braced Frame',  desc:'Diagonal braces resist sideways sway.' },
    shearwalls: { key:'shearwalls', label:'Shear Walls',   desc:'Solid walls give strong lateral resistance.' }
  };
  var STANDARD_SYSTEM_ORDER = ['moment','braced','shearwalls'];

  /* Structural behaviour of each system, per building type, as designed
     (before protection options and add-ons):
       T     - fundamental period, s
       Cy    - yield strength as a base-shear coefficient (fraction of weight),
               including typical overstrength
       zeta  - damping ratio (timber houses get extra from linings/partitions)
       muCap - ductility capacity: displacement ductility at collapse
     Calibrated so that, with no add-ons, each conventional system meets the
     code's intent: little or no damage in a moderate quake, life-safe but
     damaged in the design-level quake, no collapse even in a major one. */
  var SYSTEM_PHYSICS = {
    house: {
      plasterboard:  { T:0.25, Cy:0.50, zeta:0.10, muCap:5 },
      plywood:       { T:0.20, Cy:0.85, zeta:0.10, muCap:8 }
    },
    industrial: {
      moment:     { T:0.60, Cy:0.32, zeta:0.05, muCap:8 },
      braced:     { T:0.35, Cy:0.55, zeta:0.05, muCap:6 },
      shearwalls: { T:0.20, Cy:0.90, zeta:0.05, muCap:4 }
    },
    commercial: {
      moment:     { T:0.90, Cy:0.18, zeta:0.05, muCap:6 },
      braced:     { T:0.55, Cy:0.34, zeta:0.05, muCap:6 },
      shearwalls: { T:0.40, Cy:0.55, zeta:0.05, muCap:6 }
    }
  };

  var HOUSE_PROTECTIONS = {
    frontfootDampers:{ key:'frontfootDampers',label:'FrontFoot Dampers',      desc:'Dampers built into the floor slab - act like base isolation for the home.', featured:true },
    lightweight:     { key:'lightweight',     label:'Lightweight Construction', desc:'Lighter materials mean smaller seismic forces, but require more thought vs code minimum.' },
    upspecBracing:   { key:'upspecBracing',   label:'Up-Spec Bracing (+50%)', desc:'Increases wall bracing capacity by half.' }
  };
  var HOUSE_PROTECTION_ORDER = ['frontfootDampers','lightweight','upspecBracing'];

  var STANDARD_PROTECTIONS = {
    // notWith: structural systems this option isn't suitable for.
    quakeDefender: { key:'quakeDefender', label:'Quake Defender Bracing', desc:'Bracing and dampers combined - stiffer, and better damped.', featured:true, notWith:['shearwalls'] },
    isolation:     { key:'isolation',     label:'Base Isolation',        desc:'Lets the base slide, keeping most shaking out of the structure above.' }
  };
  var STANDARD_PROTECTION_ORDER = ['quakeDefender','isolation'];

  /* Additions: extras that cost money to install but add more than that
     to the building's value (ADDON_ECONOMICS). The client puts the
     difference towards seismic upgrades, so they RAISE the upgrade budget
     - but they ADD MASS up at roof level that the structure wasn't
     designed for. massPct is a fraction of the building's weight. */
  var HOUSE_ADDITIONS = {
    solar:    { key:'solar',    label:'Solar Panels', massPct:0.15, desc:'Power savings and feed-in earn back more than the install cost, but the panels add weight to the roof.' },
    tileRoof: { key:'tileRoof', label:'Tile Roof',    massPct:0.28, desc:'Kerb appeal adds resale value, but tiles are far heavier than a metal roof, right at the top.' },
    chimney:  { key:'chimney',  label:'Brick Chimney', massPct:0.12, desc:'A fireplace adds character and resale value. But unreinforced masonry up high is a classic quake weak point and a life-safety hazard.' }
  };
  var HOUSE_ADDITION_ORDER = ['solar','tileRoof','chimney'];

  var STANDARD_ADDITIONS = {
    solar:     { key:'solar',     label:'Solar Array',           massPct:0.14, desc:'Energy revenue earns back well over the install cost, but the panels add weight to the roof.' },
    greenroof: { key:'greenroof', label:'Green Roof',            massPct:0.30, desc:'Amenity and stormwater value, but saturated soil is heavy, and it is all up high.' },
    signage:   { key:'signage',   label:'Rooftop Plant & Signage', massPct:0.10, desc:'Advertising and services lease income, for a lighter appendage up top.' }
  };
  var STANDARD_ADDITION_ORDER = ['solar','greenroof','signage'];

  /* Prices, as a percentage of the building's base cost. Every building
     costs 100 whether it's a home or an office block, so options are
     priced by their realistic SHARE of the build, not in dollars. 0 = the
     base option, already in the 100. Indicative NZ new-build figures;
     FrontFoot's 2% is from its Central Otago case study (1.5-2.0% of
     build cost). */
  var PRICES = {
    house:      { plasterboard:0, plywood:0.5,
                  frontfootDampers:2, lightweight:1, upspecBracing:0.5 },
    industrial: { moment:0, braced:0.5, shearwalls:3,
                  quakeDefender:1.5, isolation:8 },
    commercial: { moment:1.5, braced:0, shearwalls:1,
                  quakeDefender:2, isolation:5 }
  };
  /* Add-ons on the same basis: what each costs to install, and what it
     adds to the building's value (resale, rent, power savings, lease
     income). value - cost is what the client puts towards upgrades. */
  var ADDON_ECONOMICS = {
    house:      { solar:{ cost:1.5, value:2.5 }, tileRoof:{ cost:1.5, value:2 },     chimney:{ cost:3,   value:3.5 } },
    industrial: { solar:{ cost:2,   value:4 },   greenroof:{ cost:5,   value:5.5 },  signage:{ cost:0.5, value:1.5 } },
    commercial: { solar:{ cost:1,   value:2 },   greenroof:{ cost:2.5, value:3 },    signage:{ cost:0.5, value:2 } }
  };
  // How far over the base cost the client will go for a better building,
  // as a percentage - the same for every building type.
  var UPGRADE_BUDGET = 5;

  /* The three earthquakes every design is assessed against. pga in g;
     weight = share of the score. */
  var QUAKES = {
    moderate: { key:'moderate', label:'Moderate', pga:0.12, returnPeriod:25,   weight:0.2 },
    strong:   { key:'strong',   label:'Strong',   pga:0.40, returnPeriod:500,  weight:0.5 },
    major:    { key:'major',    label:'Major',    pga:0.70, returnPeriod:2500, weight:0.3 }
  };
  var QUAKE_ORDER = ['moderate','strong','major'];
  // The code's life-safety check: collapse here means the design can't score.
  var DESIGN_QUAKE = 'strong';

  var DAMAGE = {
    none:      { key:'none',      label:'None',     tier:'thrive' },
    slight:    { key:'slight',    label:'Slight',   tier:'thrive' },
    moderate:  { key:'moderate',  label:'Moderate', tier:'survive' },
    extensive: { key:'extensive', label:'Heavy',    tier:'survive' },
    collapse:  { key:'collapse',  label:'Collapse', tier:'fail' }
  };
  var DAMAGE_ORDER = ['none','slight','moderate','extensive','collapse'];

  // Protection / add-on behaviour.
  var ROOF_MASS_FACTOR = 1.25;   // roof-level mass hurts a little more than its weight alone
  var QD_ZETA = 0.25;            // Quake Defender: viscous dampers in the bracing
  var QD_DESIGN_RATIO = 0.75;    // sized to stay elastic, with margin, in the design-level quake
  var FRONTFOOT_T = 2.0, FRONTFOOT_ZETA = 0.20;
  var ISOLATION_T = 2.5, ISOLATION_ZETA = 0.15;

  // Copy of a set of option definitions with this type's prices attached:
  // `cost` for systems and protections; `installCost`, `value` and the
  // net `budgetBonus` for add-ons.
  function priced(defs, typeKey, isAddon){
    var out = {};
    Object.keys(defs).forEach(function(k){
      var o = {};
      Object.keys(defs[k]).forEach(function(f){ o[f] = defs[k][f]; });
      if(isAddon){
        var econ = ADDON_ECONOMICS[typeKey][k];
        o.installCost = econ.cost;
        o.value = econ.value;
        o.budgetBonus = round1(econ.value - econ.cost);
      } else {
        o.cost = PRICES[typeKey][k];
      }
      out[k] = o;
    });
    return out;
  }

  /* Everything that depends on the building type, priced for that type. */
  var poolCache = {};
  function pools(typeKey){
    if(poolCache[typeKey]) return poolCache[typeKey];
    var isHouse = BUILDING_TYPES[typeKey].category==='house';
    return (poolCache[typeKey] = {
      isHouse: isHouse,
      systems: priced(isHouse ? HOUSE_SYSTEMS : STANDARD_SYSTEMS, typeKey, false),
      systemOrder: isHouse ? HOUSE_SYSTEM_ORDER : STANDARD_SYSTEM_ORDER,
      protections: priced(isHouse ? HOUSE_PROTECTIONS : STANDARD_PROTECTIONS, typeKey, false),
      protectionOrder: isHouse ? HOUSE_PROTECTION_ORDER : STANDARD_PROTECTION_ORDER,
      additions: priced(isHouse ? HOUSE_ADDITIONS : STANDARD_ADDITIONS, typeKey, true),
      additionOrder: isHouse ? HOUSE_ADDITION_ORDER : STANDARD_ADDITION_ORDER,
      // FrontFoot Dampers / Quake Defender - Seismic Shift's own products.
      featuredKey: isHouse ? 'frontfootDampers' : 'quakeDefender',
      isolationKey: isHouse ? 'frontfootDampers' : 'isolation'
    });
  }

  function chosen(map, pool){
    return Object.keys(pool).filter(function(k){ return !!(map && map[k]); });
  }

  /* =========================================================
     BUDGET
  ========================================================= */
  // All in percent of the base build cost, to one decimal place (rounded,
  // so 0.5 + 1.5 + ... never drifts off by floating-point dust).
  function round1(x){ return Math.round(x*10)/10; }

  // The budget functions also run before a building type is picked (the
  // budget bar is visible from the first screen) - no type = nothing
  // chosen yet, so the plain upgrade budget.
  function budgetTotal(d){
    if(!d.typeKey) return UPGRADE_BUDGET;
    var pool = pools(d.typeKey).additions;
    return round1(UPGRADE_BUDGET + chosen(d.additions, pool).reduce(function(s,k){ return s + pool[k].budgetBonus; }, 0));
  }
  function spentDesign(d){
    return (d.typeKey && d.systemKey) ? pools(d.typeKey).systems[d.systemKey].cost : 0;
  }
  function spentProtections(d){
    if(!d.typeKey) return 0;
    var pool = pools(d.typeKey).protections;
    return round1(chosen(d.protections, pool).reduce(function(s,k){ return s + pool[k].cost; }, 0));
  }
  function budgetRemaining(d){
    return round1(budgetTotal(d) - spentDesign(d) - spentProtections(d));
  }
  function additionMassPct(d){
    if(!d.typeKey) return 0;
    var pool = pools(d.typeKey).additions;
    return chosen(d.additions, pool).reduce(function(s,k){ return s + pool[k].massPct; }, 0);
  }

  /* =========================================================
     ENGINEERING MODEL
  ========================================================= */
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  // Design-style spectral shape (multiplier on PGA): ramp to a 2.5x plateau,
  // constant velocity (1/T) beyond the corner period TC, constant
  // displacement (1/T^2) beyond 3 s.
  var TC = 0.5;
  function spectralShape(T){
    if(T < 0.1) return 1 + 1.5*T/0.1;
    if(T <= TC) return 2.5;
    if(T <= 3) return 2.5*TC/T;
    return 2.5*TC*3/(T*T);
  }
  // Damping correction relative to the 5% spectrum (Eurocode 8 form).
  function dampingFactor(zeta){
    return Math.max(0.55, Math.sqrt(0.10/(0.05+zeta)));
  }
  function spectralAcc(T, zeta, pga){
    return pga * spectralShape(T) * dampingFactor(zeta);
  }

  function derive(d){
    var bt = BUILDING_TYPES[d.typeKey];
    var P = pools(d.typeKey);
    var ph = SYSTEM_PHYSICS[d.typeKey][d.systemKey];
    var prot = d.protections || {};
    var T = ph.T, Cy = ph.Cy, zeta = ph.zeta, muCap = ph.muCap;

    if(P.isHouse){
      if(prot.upspecBracing){ Cy *= 1.5; T /= Math.sqrt(1.5); }
      if(prot.lightweight){ Cy /= 0.8; T *= Math.sqrt(0.8); }   // 20% less weight on the same bracing
    }

    // Add-ons: weight at roof level the structure wasn't designed for.
    var massFactor = 1 + additionMassPct(d);
    var CyEff = Cy / (1 + ROOF_MASS_FACTOR*(massFactor-1));
    T *= Math.sqrt(massFactor);

    // Quake Defender is chosen after the add-ons and sized for the building
    // as built (as its sizing calculator does): bracing + dampers designed
    // together to stay near-elastic in the design-level quake.
    if(!P.isHouse && prot.quakeDefender){
      T *= 0.8;
      zeta = QD_ZETA;
      CyEff = Math.max(CyEff*1.2, spectralAcc(T, zeta, QUAKES[DESIGN_QUAKE].pga) / QD_DESIGN_RATIO);
    }

    var isolated = !!prot[P.isolationKey];
    if(isolated){
      T = (P.isHouse ? FRONTFOOT_T : ISOLATION_T) * Math.sqrt(massFactor);
      zeta = P.isHouse ? FRONTFOOT_ZETA : ISOLATION_ZETA;
    }
    return {
      bt:bt, isHouse:P.isHouse, isolated:isolated,
      T:T, fn:1/T, zeta:zeta, Cy:CyEff, muCap:muCap, massFactor:massFactor
    };
  }

  // Damage-state bands by ductility demand: none < 0.5 <= slight < 1
  // (yield) <= moderate < max(2, half the capacity) <= heavy < capacity
  // <= collapse.
  function damageState(mu, muCap){
    if(mu >= muCap) return 'collapse';
    if(mu < 0.5) return 'none';
    if(mu < 1.0) return 'slight';
    if(mu < Math.max(2, 0.5*muCap)) return 'moderate';
    return 'extensive';
  }

  /* Score points (0-100) for one quake, continuous in the ductility demand
     and lined up with the bands above: 100 for no damage, 100 -> 90 across
     slight, 90 -> 60 across moderate, 60 -> 25 across heavy, 0 for
     collapse. So a design that barely yields beats one on the edge of
     heavy damage, and there are no cliff edges inside a band. */
  function damagePoints(mu, muCap){
    var m2 = Math.max(2, 0.5*muCap);
    if(mu >= muCap) return 0;
    if(mu <= 0.5) return 100;
    if(mu <= 1) return 100 - 10*(mu-0.5)/0.5;
    if(mu <= m2) return 90 - 30*(mu-1)/(m2-1);
    return 60 - 35*(mu-m2)/(muCap-m2);
  }
  // A falling chimney is scored at the middle of the band it forces.
  var CHIMNEY_POINTS = { moderate:75, extensive:42 };
  function worse(a, b){ return DAMAGE_ORDER.indexOf(a) >= DAMAGE_ORDER.indexOf(b) ? a : b; }

  /* One design in one earthquake. */
  function assess(d, derived, quakeKey){
    var q = QUAKES[quakeKey];
    var Sa = spectralAcc(derived.T, derived.zeta, q.pga);
    var R = Sa / derived.Cy;
    // Ductility demand (Eurocode 8 N2 method): equal displacement for
    // T >= TC, amplified below it - continuous at TC.
    var mu = R <= 1 ? R : (derived.T >= TC ? R : (R-1)*TC/derived.T + 1);
    var state = damageState(mu, derived.muCap);
    var points = damagePoints(mu, derived.muCap);
    // An unreinforced brick chimney on a fixed-base house comes down in
    // strong shaking whatever the bracing does (Canterbury 2010-11).
    var chimneyFell = !!(d.additions && d.additions.chimney) && !derived.isolated && quakeKey!=='moderate';
    if(chimneyFell){
      var forced = quakeKey==='strong' ? 'moderate' : 'extensive';
      if(worse(state, forced)===forced && state!==forced){ state = forced; points = Math.min(points, CHIMNEY_POINTS[forced]); }
    }
    return {
      quake:quakeKey, pga:q.pga, Sa:Sa, R:R, mu:mu, muCap:derived.muCap,
      state:state, tier:DAMAGE[state].tier, points:points, chimneyFell:chimneyFell
    };
  }

  function transmissibility(r, zeta){
    var num = Math.sqrt(1 + Math.pow(2*zeta*r, 2));
    var den = Math.sqrt(Math.pow(1-r*r, 2) + Math.pow(2*zeta*r, 2));
    return clamp(num/den, 0.4, 2.5);
  }

  /* =========================================================
     DESIGN VALIDITY + ENUMERATION
  ========================================================= */
  function boolCombos(keys){
    var out = [], n = keys.length;
    for(var mask=0; mask<(1<<n); mask++){
      var o = {};
      keys.forEach(function(k,i){ o[k] = !!(mask & (1<<i)); });
      out.push(o);
    }
    return out;
  }

  /* Whether a protection option suits a structural system - e.g. Quake
     Defender bracing has no place in a shear-wall structure. */
  function suitable(typeKey, systemKey, protKey){
    var p = pools(typeKey).protections[protKey];
    return !(p && p.notWith && p.notWith.indexOf(systemKey) !== -1);
  }

  function isValid(d){
    if(!d || !BUILDING_TYPES[d.typeKey]) return false;
    var P = pools(d.typeKey);
    if(!P.systems[d.systemKey]) return false;
    var badKey = function(map, pool){
      return Object.keys(map || {}).some(function(k){ return map[k] && !pool[k]; });
    };
    if(badKey(d.protections, P.protections) || badKey(d.additions, P.additions)) return false;
    var prot = chosen(d.protections, P.protections);
    // The featured protection is an all-in-one system, never stacked.
    if(prot.indexOf(P.featuredKey)!==-1 && prot.length>1) return false;
    if(prot.some(function(k){ return !suitable(d.typeKey, d.systemKey, k); })) return false;
    return budgetRemaining(d) >= 0;
  }

  /* Canonical id of a design - also the primary key of the server's
     score lookup table, so its format must not drift.
     e.g. "commercial|braced|quakeDefender|solar+signage" ("-" = none). */
  function designKey(d){
    var P = pools(d.typeKey);
    var part = function(map, pool){ var ks = chosen(map, pool).sort(); return ks.length ? ks.join('+') : '-'; };
    return [d.typeKey, d.systemKey, part(d.protections, P.protections), part(d.additions, P.additions)].join('|');
  }

  function enumerate(typeKey){
    var P = pools(typeKey), out = [];
    P.systemOrder.forEach(function(sysKey){
      boolCombos(Object.keys(P.protections)).forEach(function(prot){
        boolCombos(Object.keys(P.additions)).forEach(function(add){
          var d = { typeKey:typeKey, systemKey:sysKey, protections:prot, additions:add };
          if(isValid(d)) out.push(d);
        });
      });
    });
    return out;
  }

  /* =========================================================
     SCORE
     raw   - damagePoints() across the three quakes, weighted (0-100).
     perf  - raw relative to the worst and best designs that pass the
             design-level check FOR THE SAME BUILDING TYPE, so a home, an
             industrial building and an office block compete fairly even
             though houses are inherently more robust.
     score - perf x budget efficiency, capped at OTHER_SCORE_CAP. Designs
             with FrontFoot Dampers / Quake Defender instead score that
             same measure as a share of the best featured design of their
             type (so each type's best reaches FEATURED_MAX), never below
             FEATURED_MIN. Collapse in the design-level quake = 0.
  ========================================================= */
  var MIN_SURVIVOR_SCORE = 5;
  var OTHER_SCORE_CAP = 84;
  var FEATURED_MIN = 85, FEATURED_MAX = 100;

  /* Cost efficiency: every 1% of build cost spent on the structure and
     protection takes 2% off the score (never below 0.8). Upgrades are a
     few percent of the build, so performance dominates - cost only
     separates designs that perform alike, as it would for a real client.
     Prices are shares of each building's own cost, so the same rule is
     fair across homes, industrial buildings and office blocks. */
  function computeEfficiency(spend){
    return clamp(1 - 0.02*spend, 0.8, 1);
  }

  function rawScore(levels){
    return QUAKE_ORDER.reduce(function(s, k){ return s + QUAKES[k].weight * levels[k].points; }, 0);
  }

  function assessAll(d){
    var derived = derive(d);
    var levels = {};
    QUAKE_ORDER.forEach(function(k){ levels[k] = assess(d, derived, k); });
    return { derived:derived, levels:levels, raw:rawScore(levels) };
  }

  // Lazily-built per type: the raw range across designs that pass the
  // design-level check, and the best featured perf x efficiency.
  var rangeCache = {};
  function typeRanges(typeKey){
    if(rangeCache[typeKey]) return rangeCache[typeKey];
    var fk = pools(typeKey).featuredKey;
    var lo = Infinity, hi = -Infinity, items = [];
    enumerate(typeKey).forEach(function(d){
      var a = assessAll(d);
      var featured = !!d.protections[fk];
      if(!featured && a.levels[DESIGN_QUAKE].state==='collapse') return;
      lo = Math.min(lo, a.raw); hi = Math.max(hi, a.raw);
      items.push({ d:d, raw:a.raw, featured:featured });
    });
    var fbest = 0;
    items.forEach(function(it){
      if(it.featured) fbest = Math.max(fbest, perfOf(it.raw, lo, hi) * efficiencyOf(it.d));
    });
    return (rangeCache[typeKey] = { lo:lo, hi:hi, fbest:fbest });
  }
  function perfOf(raw, lo, hi){ return hi > lo ? 100*clamp((raw-lo)/(hi-lo), 0, 1) : 100; }
  function efficiencyOf(d){ return computeEfficiency(spentDesign(d)+spentProtections(d)); }

  /* Everything the results screen and the leaderboard need. */
  function evaluate(d){
    var P = pools(d.typeKey);
    var a = assessAll(d);
    var featured = !!(d.protections && d.protections[P.featuredKey]);
    var rng = typeRanges(d.typeKey);
    var performance = perfOf(a.raw, rng.lo, rng.hi);
    var efficiency = efficiencyOf(d);
    var eligible = featured || a.levels[DESIGN_QUAKE].state !== 'collapse';
    var score = 0;
    if(eligible){
      score = featured
        ? clamp(Math.round(FEATURED_MAX * performance*efficiency / rng.fbest), FEATURED_MIN, FEATURED_MAX)
        : clamp(Math.round(performance*efficiency), MIN_SURVIVOR_SCORE, OTHER_SCORE_CAP);
    }
    return {
      derived:a.derived, levels:a.levels, raw:a.raw,
      performance:performance, efficiency:efficiency, featured:featured,
      eligible:eligible, score:score, key:designKey(d)
    };
  }

  root.SOT_MODEL = {
    BUILDING_TYPES:BUILDING_TYPES, TYPE_ORDER:TYPE_ORDER, UPGRADE_BUDGET:UPGRADE_BUDGET,
    QUAKES:QUAKES, QUAKE_ORDER:QUAKE_ORDER, DESIGN_QUAKE:DESIGN_QUAKE,
    DAMAGE:DAMAGE, DAMAGE_ORDER:DAMAGE_ORDER,
    pools:pools, chosen:chosen,
    budgetTotal:budgetTotal, spentDesign:spentDesign, spentProtections:spentProtections,
    budgetRemaining:budgetRemaining, additionMassPct:additionMassPct,
    derive:derive, transmissibility:transmissibility,
    suitable:suitable, isValid:isValid, designKey:designKey, enumerate:enumerate, evaluate:evaluate
  };
})(globalThis);
