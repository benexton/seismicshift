/* =============================================================================
   Survive or Thrive? - design data + scoring model.

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
============================================================================= */
(function(root){
  "use strict";

  /* =========================================================
     DATA
  ========================================================= */
  var BUILDING_TYPES = {
    house: {
      key:'house', label:'Detached Home', category:'house',
      storeys:2, storeyHeightM:2.7, periodK:0.065, massBase:10,
      renderSegments:2, bw:70, renderH:70,
      blurb:'2-storey timber-framed home'
    },
    industrial: {
      key:'industrial', label:'Industrial Building', category:'standard',
      storeys:1, storeyHeightM:7.5, periodK:0.033, massBase:26,
      renderSegments:1, bw:150, renderH:96,
      blurb:'1 tall storey, wide clear-span building'
    },
    commercial: {
      key:'commercial', label:'Commercial Block', category:'standard',
      storeys:4, storeyHeightM:3.8, periodK:0.033, massBase:48,
      renderSegments:4, bw:96, renderH:195,
      blurb:'4-storey office block'
    }
  };
  var TYPE_ORDER = ['house','industrial','commercial'];

  var HOUSE_SYSTEMS = {
    plasterboard: { key:'plasterboard', label:'Plasterboard Linings', cost:15, stiffness:3,  strength:1.6,  zeta:0.030, desc:'Standard plasterboard bracing walls.' },
    plywood:      { key:'plywood',      label:'Plywood Linings',      cost:30, stiffness:6,  strength:1.85, zeta:0.032, desc:'Structural plywood sheathing, stronger bracing.' },
    concreteShear:{ key:'concreteShear',label:'Concrete Shear Walls', cost:45, stiffness:10, strength:3.2,  zeta:0.028, desc:'Maximum lateral strength and stiffness.' }
  };
  var HOUSE_SYSTEM_ORDER = ['plasterboard','plywood','concreteShear'];

  var STANDARD_SYSTEMS = {
    moment:     { key:'moment',     label:'Moment Frame',  cost:35, stiffness:5, strength:5,   zeta:0.050, desc:'Rigid joints share the load evenly.' },
    braced:     { key:'braced',     label:'Braced Frame',  cost:35, stiffness:7, strength:6.5, zeta:0.045, desc:'Diagonal braces resist sideways sway.' },
    shearwalls: { key:'shearwalls', label:'Shear Walls',   cost:55, stiffness:9, strength:8,   zeta:0.045, desc:'Solid walls give strong lateral resistance.' }
  };
  var STANDARD_SYSTEM_ORDER = ['moment','braced','shearwalls'];

  var HOUSE_PROTECTIONS = {
    frontfootDampers:{ key:'frontfootDampers',label:'FrontFoot Dampers',      cost:25, desc:'Dampers built into the floor slab - act like base isolation for the home.', featured:true },
    lightweight:     { key:'lightweight',     label:'Lightweight Construction', cost:28, desc:'Lighter materials mean smaller seismic forces, but require more thought vs code minimum.' },
    upspecBracing:   { key:'upspecBracing',   label:'Up-Spec Bracing (+50%)', cost:35, desc:'Increases wall bracing capacity by half.' }
  };
  var HOUSE_PROTECTION_ORDER = ['frontfootDampers','lightweight','upspecBracing'];

  var STANDARD_PROTECTIONS = {
    quakeDefender: { key:'quakeDefender', label:'Quake Defender Bracing', cost:30, desc:'Bracing and dampers combined - stiffer, and better damped.', featured:true },
    shearwallsAdd: { key:'shearwallsAdd', label:'Extra Shear Walls',     cost:35, desc:'Boosts lateral strength and stiffness further.' },
    isolation:     { key:'isolation',     label:'Base Isolation',        cost:55, desc:'Lets the base slide, keeping most shaking out of the structure above.' }
  };
  var STANDARD_PROTECTION_ORDER = ['quakeDefender','shearwallsAdd','isolation'];

  /* Additions: revenue-generating / value-adding features. They
     RAISE the budget ceiling (revenue) but ADD MASS - almost all
     of it up high on the roof, which is the worst place for it.
     They can never improve the score (the score only sees the
     extra mass, which hurts) - they're a real-building trade-off,
     not a performance cheat. massPct is a fraction of the
     building's base mass; budgetBonus is added to the 100 ceiling. */
  var HOUSE_ADDITIONS = {
    solar:    { key:'solar',    label:'Solar Panels', budgetBonus:8, massPct:0.15, desc:'Rooftop PV. Feed-in revenue lifts your budget - the panels add roof mass.' },
    tileRoof: { key:'tileRoof', label:'Tile Roof',    budgetBonus:6, massPct:0.28, desc:'Premium kerb appeal - but tiles are far heavier than a metal roof, right at the top.' },
    chimney:  { key:'chimney',  label:'Brick Chimney', budgetBonus:4, massPct:0.12, desc:'Adds character and value. Unreinforced masonry up high is a classic quake weak point and life-safety hazard.' }
  };
  var HOUSE_ADDITION_ORDER = ['solar','tileRoof','chimney'];

  var STANDARD_ADDITIONS = {
    solar:     { key:'solar',     label:'Solar Array',           budgetBonus:12, massPct:0.14, desc:'Rooftop PV. Energy revenue lifts your budget most; the panels add moderate roof mass.' },
    greenroof: { key:'greenroof', label:'Green Roof',            budgetBonus:8,  massPct:0.30, desc:'Amenity and stormwater value - but saturated soil is heavy, and it is all up high.' },
    signage:   { key:'signage',   label:'Rooftop Plant & Signage', budgetBonus:6, massPct:0.10, desc:'Advertising and services lease. Modest revenue, a lighter appendage up top.' }
  };
  var STANDARD_ADDITION_ORDER = ['solar','greenroof','signage'];

  var BASE_BUDGET = 100;

  /* Everything that depends on whether the type is a house or not. */
  function pools(typeKey){
    var isHouse = BUILDING_TYPES[typeKey].category==='house';
    return {
      isHouse: isHouse,
      systems: isHouse ? HOUSE_SYSTEMS : STANDARD_SYSTEMS,
      systemOrder: isHouse ? HOUSE_SYSTEM_ORDER : STANDARD_SYSTEM_ORDER,
      protections: isHouse ? HOUSE_PROTECTIONS : STANDARD_PROTECTIONS,
      protectionOrder: isHouse ? HOUSE_PROTECTION_ORDER : STANDARD_PROTECTION_ORDER,
      additions: isHouse ? HOUSE_ADDITIONS : STANDARD_ADDITIONS,
      additionOrder: isHouse ? HOUSE_ADDITION_ORDER : STANDARD_ADDITION_ORDER,
      // FrontFoot Dampers / Quake Defender - Seismic Shift's own products.
      featuredKey: isHouse ? 'frontfootDampers' : 'quakeDefender',
      isolationKey: isHouse ? 'frontfootDampers' : 'isolation'
    };
  }

  function chosen(map, pool){
    return Object.keys(pool).filter(function(k){ return !!(map && map[k]); });
  }

  /* =========================================================
     BUDGET
  ========================================================= */
  // The budget functions also run before a building type is picked (the
  // budget bar is visible from the first screen) - no type = nothing
  // chosen yet, so the plain base budget.
  function budgetTotal(d){
    if(!d.typeKey) return BASE_BUDGET;
    var pool = pools(d.typeKey).additions;
    return BASE_BUDGET + chosen(d.additions, pool).reduce(function(s,k){ return s + pool[k].budgetBonus; }, 0);
  }
  function spentDesign(d){
    return (d.typeKey && d.systemKey) ? pools(d.typeKey).systems[d.systemKey].cost : 0;
  }
  function spentProtections(d){
    if(!d.typeKey) return 0;
    var pool = pools(d.typeKey).protections;
    return chosen(d.protections, pool).reduce(function(s,k){ return s + pool[k].cost; }, 0);
  }
  function budgetRemaining(d){
    return budgetTotal(d) - spentDesign(d) - spentProtections(d);
  }
  function additionMassPct(d){
    if(!d.typeKey) return 0;
    var pool = pools(d.typeKey).additions;
    return chosen(d.additions, pool).reduce(function(s,k){ return s + pool[k].massPct; }, 0);
  }

  /* =========================================================
     SIMULATION MODEL
  ========================================================= */
  function derive(d){
    var bt = BUILDING_TYPES[d.typeKey];
    var P = pools(d.typeKey);
    var isHouse = P.isHouse;
    var sys = P.systems[d.systemKey];
    var prot = d.protections || {};
    var stiffness = sys.stiffness;
    var strength = sys.strength;
    var zeta = sys.zeta;
    var mass = bt.massBase;

    if(isHouse){
      if(prot.upspecBracing){ stiffness *= 1.5; strength *= 1.5; }
      if(prot.lightweight){ mass *= 0.8; }
    } else {
      if(prot.quakeDefender){ stiffness += 3; strength += 2; zeta += 0.07; }
      if(prot.shearwallsAdd){ stiffness += 3; strength += 3; }
    }

    // Revenue additions add mass (mostly roof-level - the worst place for it).
    mass *= (1 + additionMassPct(d));

    var isolated = !!prot[P.isolationKey];
    var totalHeightM = bt.storeys * bt.storeyHeightM;
    var fn;
    if(isolated){
      fn = 0.4;
      zeta = 0.12 + ((!isHouse && prot.quakeDefender) ? 0.03 : 0);
    } else {
      var T = bt.periodK * totalHeightM / Math.sqrt(stiffness/6);
      fn = 1/T;
    }
    return {
      totalHeightM:totalHeightM, mass:mass, stiffness:stiffness, strength:strength,
      zeta:zeta, fn:fn, isolated:isolated, isHouse:isHouse, bt:bt
    };
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function transmissibility(r, zeta){
    var num = Math.sqrt(1 + Math.pow(2*zeta*r, 2));
    var den = Math.sqrt(Math.pow(1-r*r, 2) + Math.pow(2*zeta*r, 2));
    return clamp(num/den, 0.4, 2.5);
  }

  // Quake frequencies the reference scenario averages over (Hz).
  var REF_FREQ_MIN = 0.35, REF_FREQ_MAX = 2.2;

  function averageTransmissibility(fn, zeta){
    var sum = 0, n = 0;
    for(var f=REF_FREQ_MIN; f<=REF_FREQ_MAX; f+=0.05){
      sum += transmissibility(f/fn, zeta);
      n++;
    }
    return sum/n;
  }

  /* =========================================================
     DETERMINISTIC VERDICT + SCORE
     The verdict and the score both come from one fixed reference
     scenario (intensity 0.35, transmissibility averaged across the
     full plausible frequency range) - never from the random
     earthquake drawn for the shake animation, and never from which
     level was chosen to watch it at. Identical choices always get
     identical results.

     TYPE_DEMAND_CALIBRATION exists because the three building types
     are not naturally comparable: at calib=1, the weakest possible
     choice (cheapest system, no protection) has a safety margin of
     1.27 for a house, 1.43 for a commercial block, and 3.57 for an
     industrial building. These factors equalise that worst-case
     margin to ~1.27 for all three, so a poor choice is comparably
     risky whichever type you pick.
  ========================================================= */
  var TYPE_DEMAND_CALIBRATION = { house: 1.00, industrial: 2.81, commercial: 1.12 };

  function referenceMargin(derived, typeKey){
    var meanTr = averageTransmissibility(derived.fn, derived.zeta);
    var massFactor = Math.sqrt(derived.mass/20);
    var heightFactor = 1 + derived.totalHeightM/40;
    var demand = TYPE_DEMAND_CALIBRATION[typeKey] * meanTr * 0.35 * massFactor * heightFactor * 2.5;
    if(derived.isolated) demand *= 0.5;
    return { meanTr:meanTr, demand:demand, capacity:derived.strength, margin: derived.strength/demand };
  }

  function boolCombos(keys){
    var out = [], n = keys.length;
    for(var mask=0; mask<(1<<n); mask++){
      var o = {};
      keys.forEach(function(k,i){ o[k] = !!(mask & (1<<i)); });
      out.push(o);
    }
    return out;
  }

  /* The 0-100 performance ceiling for each type: the best margin
     reachable by ANY system + protection combination inside the base
     100 budget (no revenue additions). Enumerated rather than
     hardcoded so it stays right if costs are ever rebalanced. */
  function bestAffordableMargin(typeKey){
    var P = pools(typeKey);
    var best = 1;
    P.systemOrder.forEach(function(sysKey){
      boolCombos(Object.keys(P.protections)).forEach(function(prot){
        var d = { typeKey:typeKey, systemKey:sysKey, protections:prot, additions:{} };
        if(spentDesign(d) + spentProtections(d) > BASE_BUDGET) return;
        best = Math.max(best, referenceMargin(derive(d), typeKey).margin);
      });
    });
    return best;
  }
  var SCORE_CEILING = {};
  TYPE_ORDER.forEach(function(k){ SCORE_CEILING[k] = bestAffordableMargin(k); });

  var SCORE_THRIVE_THRESHOLD = 70;

  /* reserve: how much strength is left over beyond the demand, 0 at
     margin 1 up to 1 at the type's best affordable margin.
     movement: 1 for a calm building, 0 once average amplification of
     the ground motion reaches ~1.9x. */
  function performanceFactors(margin, meanTr, typeKey){
    return {
      reserve: clamp((margin-1) / (SCORE_CEILING[typeKey]-1), 0, 1),
      movement: Math.pow(clamp(1 - (meanTr-0.6)/1.3, 0, 1), 0.8)
    };
  }
  function computePerformance(margin, meanTr, typeKey){
    var f = performanceFactors(margin, meanTr, typeKey);
    return 100 * f.reserve * f.movement;
  }

  /* Efficiency: a bounded bonus for spending less of the base budget,
     a bounded penalty for spending more - capped at +-30% so a cheap
     but mediocre design can't outscore a genuinely better one.
     categoryOffset puts standard types' (pricier) spend on the house
     scale, so equally good/cheap designs get the same multiplier. */
  function computeEfficiency(spend, isHouse){
    var categoryOffset = isHouse ? 0 : 20;
    return clamp(1.4 - 0.008*(spend-categoryOffset), 0.7, 1.3);
  }

  /* Failure: the calibration above keeps every design's strength
     margin above 1 in the reference scenario, so strength alone never
     fails a building. What does is too little reserve strength and/or
     too much movement - performance below MIN_SURVIVE_PERFORMANCE.
     FrontFoot Dampers / Quake Defender designs are exempt: Seismic
     Shift's own products always survive (and score in the featured
     band below).

     Score bands:
     - Failed: 0.
     - Survived without a Seismic Shift product: performance x
       efficiency, floored at MIN_SURVIVOR_SCORE (a standing building
       never shows 0) and capped at OTHER_SCORE_CAP, just under the
       featured band.
     - Survived with FrontFoot Dampers / Quake Defender: always in the
       FEATURED_MIN..FEATURED_MAX band, placed by how good the rest of
       the design is relative to the best and worst featured designs
       OF THE SAME TYPE - so the band means the same thing for a house
       as for a commercial block, and a strong featured design still
       outscores a weak one. */
  var MIN_SURVIVE_PERFORMANCE = 5;
  var MIN_SURVIVOR_SCORE = 5;
  var OTHER_SCORE_CAP = 84;
  var FEATURED_MIN = 85, FEATURED_MAX = 100;

  /* =========================================================
     DESIGN VALIDITY + ENUMERATION
  ========================================================= */
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
    // Extra Shear Walls isn't offered on a building that already is one.
    if(d.systemKey==='shearwalls' && prot.indexOf('shearwallsAdd')!==-1) return false;
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

  /* Raw (unbanded) score - performance x efficiency. */
  function rawScore(d, ref){
    return computePerformance(ref.margin, ref.meanTr, d.typeKey) *
           computeEfficiency(spentDesign(d)+spentProtections(d), pools(d.typeKey).isHouse);
  }

  // Lazily-built per-type range of rawScore across featured designs.
  var featuredRangeCache = {};
  function featuredRange(typeKey){
    if(featuredRangeCache[typeKey]) return featuredRangeCache[typeKey];
    var fk = pools(typeKey).featuredKey, lo = Infinity, hi = -Infinity;
    enumerate(typeKey).forEach(function(d){
      if(!d.protections[fk]) return;
      var r = rawScore(d, referenceMargin(derive(d), typeKey));
      lo = Math.min(lo, r); hi = Math.max(hi, r);
    });
    return (featuredRangeCache[typeKey] = { lo:lo, hi:hi });
  }

  /* Why a failed design failed - from the reference scenario, so the
     same design always gets the same explanation. Performance is the
     product of a strength-reserve factor and a movement factor; the
     smaller one is what sank it. */
  function failureCause(derived, ref, typeKey){
    var f = performanceFactors(ref.margin, ref.meanTr, typeKey);
    if(f.reserve < f.movement) return 'capacity';
    var inBand = !derived.isolated && derived.fn >= REF_FREQ_MIN && derived.fn <= REF_FREQ_MAX;
    return (inBand && ref.meanTr >= 1.5) ? 'resonance' : 'movement';
  }

  /* Everything the results screen and the leaderboard need. */
  function evaluate(d){
    var P = pools(d.typeKey);
    var derived = derive(d);
    var ref = referenceMargin(derived, d.typeKey);
    var performance = computePerformance(ref.margin, ref.meanTr, d.typeKey);
    var efficiency = computeEfficiency(spentDesign(d)+spentProtections(d), P.isHouse);
    var featured = !!(d.protections && d.protections[P.featuredKey]);
    var survives = ref.margin >= 1 && (featured || performance >= MIN_SURVIVE_PERFORMANCE);
    var score = 0;
    if(survives){
      if(featured){
        var rng = featuredRange(d.typeKey);
        var q = rng.hi > rng.lo ? clamp((rawScore(d, ref) - rng.lo)/(rng.hi - rng.lo), 0, 1) : 1;
        score = Math.round(FEATURED_MIN + (FEATURED_MAX-FEATURED_MIN)*q);
      } else {
        score = clamp(Math.round(performance*efficiency), MIN_SURVIVOR_SCORE, OTHER_SCORE_CAP);
      }
    }
    return {
      derived:derived, meanTr:ref.meanTr, demand:ref.demand, capacity:ref.capacity, margin:ref.margin,
      performance:performance, efficiency:efficiency, survives:survives, featured:featured,
      cause: survives ? null : failureCause(derived, ref, d.typeKey),
      factors: performanceFactors(ref.margin, ref.meanTr, d.typeKey),
      score:score,
      tier: !survives ? 'fail' : (score >= SCORE_THRIVE_THRESHOLD ? 'thrive' : 'survive'),
      key: designKey(d)
    };
  }

  var api = {
    BUILDING_TYPES:BUILDING_TYPES, TYPE_ORDER:TYPE_ORDER, BASE_BUDGET:BASE_BUDGET,
    pools:pools, chosen:chosen,
    budgetTotal:budgetTotal, spentDesign:spentDesign, spentProtections:spentProtections,
    budgetRemaining:budgetRemaining, additionMassPct:additionMassPct,
    derive:derive, transmissibility:transmissibility,
    isValid:isValid, designKey:designKey, enumerate:enumerate, evaluate:evaluate
  };
  root.SOT_MODEL = api;
})(globalThis);
