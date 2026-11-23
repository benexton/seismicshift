/* =============================================================================
   Survive or Thrive? - isometric scene drawing.

   SOT_SCENE.render(design, opts) draws a design (the same object model.js
   takes) as an isometric SVG scene and returns
     { markup, viewBox:[x,y,w,h], pieces:[...] }.

   Everything is built in 3D model units and projected with a true 30-degree
   isometric projection. x runs along the front-left face (the face parallel
   to the shaking, which carries the structure), y along the front-right
   face, z is up.

   The drawing is split into PIECES: each piece is a set of shapes lying in
   one flat plane and belonging to one moving GROUP (ground, isolator, a
   storey 's0'..'s3', 'roof', 'chim'). Because each piece is flat, any 3D
   affine motion of its group (sway, racking, crushing, tilting, falling)
   projects to a single 2D affine transform on the piece's <g>. The shake
   animation only has to set one transform per piece per frame. Each piece
   carries three reference points in rest coordinates (data-ref) so the
   animation can work that transform out.

   Classed elements the animation drives (as in the current scene):
     .brace[data-i][data-dir]  tension red / compression blue
     .haunch[data-i]           moment-joint glow
     .crack[data-i][data-stage] two damage stages, hidden at rest
     .chimney                  pieces of the brick chimney (group 'chim')

   Classic script, no modules, no DOM: loaded by the game page and inlined
   into the review contact sheet.
============================================================================= */
(function(root){
  "use strict";

  var C30 = 0.8660254, S30 = 0.5;
  var INK = '#263445', SW = 1.4;
  var PAL = {
    grass:'#a6d38a', grassSide:'#86bf66', soil:'#d3b58c', slab:'#dde2e7', slabSide:'#bcc4cc',
    brand:'#17638f', brandFill:'#d5e8f4', brandSide:'#a9c7da',
    houseWall:'#f2dcb6', board:'#dcc196', iron:'#56697b', tile:'#c0653f', glass:'#9fd3f2', frame:'#ffffff',
    door:'#2f6f8f', brick:'#b4543d', ply:'#e2b67a', plyGrain:'#c99a5c', strap:'#475569',
    clad:'#dfe6ec', rib:'#c4cfd8', conc:'#d3d8dd', concJoint:'#aab3bc', steel:'#2f3d4c', rollDoor:'#bcc6cf',
    office:'#e7ecf1', column:'#8a97a5', floorBand:'#9aa6b2', plant:'#9aa6b2', sign:'#22364a',
    solar:'#1f3f6b', solarLine:'#86b6e6', green:'#6fae5a', tuft:'#a8d98f', member:'#334155'
  };
  var ISO_H = 10, SLAB_H = 3;

  function hex(c){ var n = parseInt(c.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
  function mixHex(c1, c2, t){
    var a = hex(c1), b = hex(c2);
    return '#'+[0,1,2].map(function(i){ return ('0'+Math.round(a[i]+(b[i]-a[i])*t).toString(16)).slice(-2); }).join('');
  }
  function shade(c, k){ return k < 0 ? mixHex(c, '#000000', -k) : mixHex(c, '#ffffff', k); }
  function f1(n){ return (Math.round(n*10)/10).toString(); }
  function proj(p){ return [(p[0]-p[1])*C30, (p[0]+p[1])*S30 - p[2]]; }

  /* ---------- builder: pieces of shapes, projected at rest ---------- */
  function Builder(){
    this.pieces = []; this.byKey = {};
    this.minX = Infinity; this.minY = Infinity; this.maxX = -Infinity; this.maxY = -Infinity;
  }
  Builder.prototype.track = function(q){
    if(q[0] < this.minX) this.minX = q[0]; if(q[0] > this.maxX) this.maxX = q[0];
    if(q[1] < this.minY) this.minY = q[1]; if(q[1] > this.maxY) this.maxY = q[1];
  };
  // A piece: one plane in one group. ref = three non-collinear rest points on the plane.
  Builder.prototype.piece = function(group, plane, ref, cls){
    var key = group + ':' + plane;
    if(!this.byKey[key]){
      var pc = { key:key, group:group, plane:plane, ref:ref, cls:cls || '', items:[] };
      this.byKey[key] = pc; this.pieces.push(pc);
    }
    var self = this, pc2 = this.byKey[key];
    function pts(a){ return a.map(function(p){ var q = proj(p); self.track(q); return f1(q[0])+','+f1(q[1]); }).join(' '); }
    function attrs(o){ return Object.keys(o||{}).map(function(k){ return ' '+k+'="'+o[k]+'"'; }).join(''); }
    return {
      poly: function(a, fill, o){
        o = o || {};
        var st = o.stroke === undefined ? INK : o.stroke, sw = o.sw === undefined ? SW : o.sw;
        delete o.stroke; delete o.sw;
        pc2.items.push('<polygon points="'+pts(a)+'" fill="'+fill+'"'+(st ? ' stroke="'+st+'" stroke-width="'+sw+'" stroke-linejoin="round"' : '')+attrs(o)+'/>');
        return this;
      },
      line: function(a, b, stroke, sw, o){
        var p = proj(a), q = proj(b); self.track(p); self.track(q);
        pc2.items.push('<line x1="'+f1(p[0])+'" y1="'+f1(p[1])+'" x2="'+f1(q[0])+'" y2="'+f1(q[1])+'" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linecap="round"'+attrs(o)+'/>');
        return this;
      },
      pl: function(a, stroke, sw, o){
        pc2.items.push('<polyline points="'+pts(a)+'" fill="none" stroke="'+stroke+'" stroke-width="'+sw+'" stroke-linecap="round" stroke-linejoin="round"'+attrs(o)+'/>');
        return this;
      }
    };
  };
  Builder.prototype.markup = function(){
    return this.pieces.map(function(pc){
      var ref = pc.ref.map(function(p){ return p.map(f1).join(','); }).join(';');
      return '<g class="pc'+(pc.cls ? ' '+pc.cls : '')+'" data-g="'+pc.group+'" data-k="'+pc.key+'" data-ref="'+ref+'">'+pc.items.join('')+'</g>';
    }).join('');
  };

  // Plane helpers: a face at y = const (front-left), x = const (front-right), z = const (top).
  function planeL(y){ return [[0,y,0],[10,y,0],[0,y,10]]; }
  function planeR(x){ return [[x,0,0],[x,10,0],[x,0,10]]; }
  function planeT(z){ return [[0,0,z],[10,0,z],[0,10,z]]; }
  function qL(x0,x1,z0,z1,y){ return [[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]]; }
  function qR(y0,y1,z0,z1,x){ return [[x,y0,z0],[x,y1,z0],[x,y1,z1],[x,y0,z1]]; }
  function qT(x0,x1,y0,y1,z){ return [[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]]; }
  // A regular polygon standing in a front-left (L) or front-right (R) face - for round things like bearings.
  function ngonL(cx, cz, r, y, n){ var a=[]; for(var i=0;i<n;i++){ var t=2*Math.PI*i/n; a.push([cx+r*Math.cos(t), y, cz+r*Math.sin(t)]); } return a; }
  function ngonR(cy, cz, r, x, n){ var a=[]; for(var i=0;i<n;i++){ var t=2*Math.PI*i/n; a.push([x, cy+r*Math.cos(t), cz+r*Math.sin(t)]); } return a; }

  // Three faces of a box, each its own piece in the group (so a rigid tumble still projects correctly).
  function box(B, group, name, x0,x1,y0,y1,z0,z1, col, cls){
    B.piece(group, name+'L', planeL(y1), cls).poly(qL(x0,x1,z0,z1,y1), col);
    B.piece(group, name+'R', planeR(x1), cls).poly(qR(y0,y1,z0,z1,x1), shade(col,-.16));
    B.piece(group, name+'T', planeT(z1), cls).poly(qT(x0,x1,y0,y1,z1), shade(col,.18));
  }

  /* A Quake Defender damper brace on a front-left face, from foot (x0,z0) to head (x1,z1):
     brand blue with a thin white edge so it reads against any wall. */
  function damperL(face, y, x0, z0, x1, z1, sw){
    var a = [x0,y,z0], b = [x1,y,z1];
    face.line(a, b, '#ffffff', sw*2.6).line(a, b, PAL.brand, sw*1.5, { 'class':'damper' });
    var dx = x1-x0, dz = z1-z0, len = Math.hypot(dx, dz), nx = -dz/len*4.2, nz = dx/len*4.2;
    function p(t, o){ return [x0+dx*t+nx*o, y, z0+dz*t+nz*o]; }
    face.poly([p(.36,-1),p(.64,-1),p(.64,1),p(.36,1)], PAL.brandFill, { stroke:PAL.brand, sw:sw*0.9, 'class':'damper' });
    face.line(p(.44,-1), p(.44,1), PAL.brand, 0.9).line(p(.56,-1), p(.56,1), PAL.brand, 0.9);
  }

  function crackSets(face, y, x0, w, zb, h, i){
    function X(f){ return x0 + w*f; }
    var s1 = [[[X(.18),zb+h-2],[X(.22),zb+h*.68],[X(.19),zb+h*.45]], [[X(.82),zb+2],[X(.79),zb+h*.4],[X(.83),zb+h*.62]]];
    var s2 = [[[X(.03),zb+h-3],[X(.46),zb+h*.6],[X(.54),zb+h*.42],[X(.96),zb+3]], [[X(.96),zb+h-3],[X(.55),zb+h*.6],[X(.46),zb+h*.44],[X(.04),zb+3]]];
    s1.forEach(function(c){ face.pl(c.map(function(a){ return [a[0], y, a[1]]; }), '#dc2626', 1.1, { 'class':'crack', 'data-stage':'1', 'data-i':i, opacity:0 }); });
    s2.forEach(function(c){ face.pl(c.map(function(a){ return [a[0], y, a[1]]; }), '#dc2626', 1.6, { 'class':'crack', 'data-stage':'2', 'data-i':i, opacity:0 }); });
  }

  /* ---------- ground: grass island, foundation slab, optional isolator layer ---------- */
  function ground(B, X, Y, isolated, isHouse){
    var e = 16, ef = 18;
    var L = B.piece('ground', 'L', planeL(Y+ef)), R = B.piece('ground', 'R', planeR(X+e)), T = B.piece('ground', 'T', planeT(0));
    L.poly(qL(-e, X+e, -22, -9, Y+ef), PAL.soil, { sw:SW*0.8 }).poly(qL(-e, X+e, -9, 0, Y+ef), PAL.grassSide, { sw:SW*0.8 });
    R.poly(qR(-e, Y+ef, -22, -9, X+e), shade(PAL.soil,-.18), { sw:SW*0.8 }).poly(qR(-e, Y+ef, -9, 0, X+e), shade(PAL.grassSide,-.14), { sw:SW*0.8 });
    T.poly(qT(-e, X+e, -e, Y+ef, 0), PAL.grass, { sw:SW*0.8 });
    // foundation slab
    var sL = B.piece('ground', 'slabL', planeL(Y+4)), sR = B.piece('ground', 'slabR', planeR(X+4)), sT = B.piece('ground', 'slabT', planeT(SLAB_H));
    sL.poly(qL(-4, X+4, 0, SLAB_H, Y+4), PAL.slabSide, { sw:SW*0.7 });
    sR.poly(qR(-4, Y+4, 0, SLAB_H, X+4), shade(PAL.slabSide,-.12), { sw:SW*0.7 });
    sT.poly(qT(-4, X+4, -4, Y+4, SLAB_H), PAL.slab, { sw:SW*0.7 });
    if(!isolated) return SLAB_H;
    // Isolator layer (FrontFoot dampers for a home, base isolation otherwise): Seismic Shift brand blue.
    var iL = B.piece('iso', 'L', planeL(Y+1)), iR = B.piece('iso', 'R', planeR(X+1));
    iL.poly(qL(-1, X+1, SLAB_H, SLAB_H+ISO_H, Y+1), PAL.brandFill, { stroke:PAL.brand, sw:SW });
    iR.poly(qR(-1, Y+1, SLAB_H, SLAB_H+ISO_H, X+1), PAL.brandSide, { stroke:PAL.brand, sw:SW });
    var zc = SLAB_H + ISO_H/2;
    for(var x = 10; x < X; x += (isHouse ? 22 : 24)) iL.poly(ngonL(x, zc, 3.3, Y+1, 12), '#ffffff', { stroke:PAL.brand, sw:1.1 });
    for(var y = 10; y < Y; y += (isHouse ? 22 : 24)) iR.poly(ngonR(y, zc, 3.3, X+1, 12), shade(PAL.brandFill,-.05), { stroke:PAL.brand, sw:1.1 });
    return SLAB_H + ISO_H;
  }

  /* ---------- window helpers ---------- */
  function windowL(face, x0, x1, z0, z1, y, mull){
    face.poly(qL(x0,x1,z0,z1,y), PAL.glass, { sw:SW*0.8 });
    if(mull !== false) face.line([(x0+x1)/2,y,z0+1], [(x0+x1)/2,y,z1-1], PAL.frame, 1.3);
    face.line([x0+2,y,z1-3], [x0+6,y,z1-7], '#ffffff', 1, { 'stroke-opacity':0.7 });
  }
  function windowR(face, y0, y1, z0, z1, x, glass){
    face.poly(qR(y0,y1,z0,z1,x), glass || shade(PAL.glass,-.12), { sw:SW*0.8 });
    face.line([x,(y0+y1)/2,z0+1], [x,(y0+y1)/2,z1-1], PAL.frame, 1.2);
  }

  /* =========================================================
     HOME - 2 timber storeys, gable roof with its ridge along x
  ========================================================= */
  function drawHouse(B, d){
    var Lx = 120, Ly = 74, h = 40, n = 2, r = 16;
    var P = d.protections || {}, A = d.additions || {};
    var isolated = !!P.frontfootDampers;
    var zb = ground(B, Lx, Ly, isolated, true);
    var H = zb + n*h, wall = PAL.houseWall, wallR = shade(wall,-.16);
    var roofCol = A.tileRoof ? PAL.tile : PAL.iron;
    var ply = d.systemKey === 'plywood', strap = !!P.upspecBracing;

    // far roof slope (faces -y)
    function F(t, x){ return [x, Ly/2 - t*(Ly/2+5), H+r - t*(r + r*5/(Ly/2))]; }
    var fr = B.piece('roof', 'F', [F(0,0), F(0,10), F(1,0)]);
    fr.poly([F(0,-5),F(0,Lx+5),F(1,Lx+5),F(1,-5)], shade(roofCol,-.25));

    // brick chimney on the far slope just behind the ridge, clear of any solar
    // panels (its own group, so it can topple)
    if(A.chimney){
      var cx0 = 80, cx1 = 92, cy0 = 20, cy1 = 32, zt = H + r + 16, zBase = H + r - 9;
      var cL = B.piece('chim', 'L', planeL(cy1), 'chimney'), cR = B.piece('chim', 'R', planeR(cx1), 'chimney'), cT = B.piece('chim', 'T', planeT(zt), 'chimney');
      cL.poly(qL(cx0,cx1,zBase,zt,cy1), PAL.brick);
      cR.poly(qR(cy0,cy1,zBase,zt,cx1), shade(PAL.brick,-.18));
      for(var bz = zBase+5; bz < zt-3; bz += 5){ cL.line([cx0,cy1,bz],[cx1,cy1,bz], shade(PAL.brick,-.3), 0.6); cR.line([cx1,cy0,bz],[cx1,cy1,bz], shade(PAL.brick,-.38), 0.6); }
      cL.poly(qL(cx0-1.5,cx1+1.5,zt-3,zt,cy1+1.5), shade(PAL.brick,.05), { sw:SW*0.7 });
      cR.poly(qR(cy0-1.5,cy1+1.5,zt-3,zt,cx1+1.5), shade(PAL.brick,-.12), { sw:SW*0.7 });
      cT.poly(qT(cx0-1.5,cx1+1.5,cy0-1.5,cy1+1.5,zt), shade(PAL.brick,.18));
    }

    // bracing panels, as a cartoon "x-ray" of the wall's bracing
    function plyPanelL(face, x0, x1, z0, z1, y){
      face.poly(qL(x0,x1,z0,z1,y), PAL.ply, { sw:SW*0.7 });
      face.line([x0,y,z0],[x1,y,z1], PAL.plyGrain, 1.2);
      face.line([x0+3,y,z0+(z1-z0)*.66],[x1-3,y,z0+(z1-z0)*.66], PAL.plyGrain, 0.6, { 'stroke-opacity':0.6 });
    }
    function strapL(face, x0, x1, z0, z1, y){
      face.line([x0,y,z0],[x1,y,z1], PAL.strap, 1.8).line([x1,y,z0],[x0,y,z1], PAL.strap, 1.8);
    }
    function plyPanelR(face, y0, y1, z0, z1, x){
      face.poly(qR(y0,y1,z0,z1,x), shade(PAL.ply,-.14), { sw:SW*0.7 });
      face.line([x,y0,z0],[x,y1,z1], shade(PAL.plyGrain,-.1), 1.2);
    }
    function strapR(face, y0, y1, z0, z1, x){
      face.line([x,y0,z0],[x,y1,z1], PAL.strap, 1.8).line([x,y1,z0],[x,y0,z1], PAL.strap, 1.8);
    }

    // right face (gable end) per storey, then the gable triangle on the roof group
    for(var i = 0; i < n; i++){
      var z0 = zb + i*h, z1 = z0 + h;
      var R = B.piece('s'+i, 'R', planeR(Lx));
      R.poly(qR(0,Ly,z0,z1,Lx), wallR);
      for(var z = z0+6; z < z1-2; z += 6) R.line([Lx,1,z],[Lx,Ly-1,z], shade(PAL.board,-.14), 0.7);
      if(ply) plyPanelR(R, 54, 70, z0+3, z1-3, Lx);
      if(strap) strapR(R, 4, 20, z0+3, z1-3, Lx);
      windowR(R, 24, 50, z0+12, z0+32, Lx);
      R.line([Lx,0,z1],[Lx,Ly,z1], INK, 0.8, { 'stroke-opacity':0.5 });
    }
    B.piece('roof', 'R', planeR(Lx)).poly([[Lx,0,H],[Lx,Ly,H],[Lx,Ly/2,H+r]], wallR)
      .poly(ngonR(Ly/2, H+r*0.42, 3.4, Lx, 10), shade(PAL.glass,-.12), { sw:SW*0.7 });

    // front-left face per storey
    for(var j = 0; j < n; j++){
      var a0 = zb + j*h, a1 = a0 + h;
      var L = B.piece('s'+j, 'L', planeL(Ly));
      L.poly(qL(0,Lx,a0,a1,Ly), wall);
      for(var zz = a0+6; zz < a1-2; zz += 6) L.line([1,Ly,zz],[Lx-1,Ly,zz], PAL.board, 0.7);
      if(j === 0){
        if(ply) plyPanelL(L, 50, 66, a0+3, a1-3, Ly);
        if(strap) strapL(L, 98, 116, a0+3, a1-3, Ly);
        windowL(L, 14, 46, a0+12, a0+33, Ly);
        L.poly(qL(70,92,a0,a0+34,Ly), PAL.door, { sw:SW*0.9 });
        L.poly(ngonL(87, a0+17, 1.3, Ly, 6), '#e8c46a', { sw:0.4 });
        L.poly(qL(68,94,a0+34,a0+36,Ly), shade(wall,-.25), { sw:SW*0.5 });
      } else {
        if(ply) plyPanelL(L, 50, 70, a0+3, a1-3, Ly);
        if(strap) strapL(L, 108, 118, a0+3, a1-3, Ly);
        windowL(L, 14, 46, a0+12, a0+33, Ly);
        windowL(L, 76, 106, a0+12, a0+33, Ly);
      }
      L.line([0,Ly,a1],[Lx,Ly,a1], INK, 0.8, { 'stroke-opacity':0.5 });
      crackSets(L, Ly, 0, Lx, a0, h, j);
    }

    // near roof slope (faces +y), with tiles or iron ribs, then solar
    function N(t, x){ return [x, Ly/2 + t*(Ly/2+7), H+r - t*(r + r*7/(Ly/2))]; }
    var nr = B.piece('roof', 'N', [N(0,0), N(0,10), N(1,0)]);
    nr.poly([N(0,-5),N(0,Lx+5),N(1,Lx+5),N(1,-5)], roofCol);
    if(A.tileRoof){
      for(var k = 1; k < 6; k++) nr.line(N(k/6,-5), N(k/6,Lx+5), shade(roofCol,-.22), 0.9);
      for(var tx = 6; tx < Lx; tx += 12) for(var kk = 0; kk < 6; kk++) nr.line(N(kk/6+0.02, tx + (kk%2)*6), N((kk+1)/6-0.02, tx + (kk%2)*6), shade(roofCol,-.18), 0.6);
    } else {
      for(var rx = 1; rx < 16; rx++){ var xx = -5 + rx*(Lx+10)/16; nr.line(N(0.03,xx), N(0.97,xx), shade(roofCol,-.18), 0.7); }
    }
    if(A.solar){
      for(var c = 0; c < 3; c++){
        var x0 = 10 + c*35, x1 = x0 + 30;
        nr.poly([N(.16,x0),N(.16,x1),N(.84,x1),N(.84,x0)], PAL.solar, { sw:SW*0.6 });
        nr.line(N(.5,x0+1), N(.5,x1-1), PAL.solarLine, 0.7);
        nr.line(N(.18,(x0+x1)/2), N(.82,(x0+x1)/2), PAL.solarLine, 0.7);
      }
    }
    nr.line([-5,Ly/2,H+r],[Lx+5,Ly/2,H+r], shade(roofCol,-.4), 2.6);
    return { storeys:n, storeyH:h, baseZ:zb, height:n*h+r, span:Lx, depth:Ly };
  }

  /* =========================================================
     INDUSTRIAL - 1 tall storey, portal frames across x, gable end
     (roller door) on the front-left face, ridge along y
  ========================================================= */
  function drawIndustrial(B, d){
    var Wx = 110, Ly = 150, Hw = 62, r = 20;
    var P = d.protections || {}, A = d.additions || {}, sys = d.systemKey;
    var isolated = !!P.isolation;
    var zb = ground(B, Wx, Ly, isolated, false);
    var H = zb + Hw, apex = H + r;
    var tilt = sys === 'shearwalls';
    var wallCol = tilt ? PAL.conc : PAL.clad;
    var roofCol = A.greenroof ? PAL.green : PAL.iron;
    function zr(x){ return H + r*(1-Math.abs(x-Wx/2)/(Wx/2)); }

    // far slope (faces -x)
    function F(t, y){ return [Wx/2 - t*(Wx/2+5), y, apex - t*(r + r*5/(Wx/2))]; }
    var fs = B.piece('roof', 'F', [F(0,0), F(0,10), F(1,0)]);
    fs.poly([F(0,-4),F(0,Ly),F(1,Ly),F(1,-4)], shade(roofCol,-.24));

    // long side (front-right face, x = Wx)
    var R = B.piece('s0', 'R', planeR(Wx));
    R.poly(qR(0,Ly,zb,H,Wx), shade(wallCol,-.16));
    if(tilt){
      for(var py = 30; py < Ly; py += 30) R.line([Wx,py,zb],[Wx,py,H], shade(PAL.concJoint,-.1), 1);
    } else {
      for(var ry = 6; ry < Ly; ry += 6) R.line([Wx,ry,zb+1],[Wx,ry,H-1], shade(PAL.rib,-.14), 0.6);
      R.poly(qR(8,Ly-8,H-14,H-7,Wx), shade(PAL.glass,-.14), { sw:SW*0.6 });
      for(var cy = 0; cy <= Ly; cy += 30) R.line([Wx,cy,zb],[Wx,cy,H], PAL.steel, cy === 0 || cy === Ly ? 2.6 : 1.8);
    }
    R.poly(qR(104,118,zb,zb+28,Wx), shade(PAL.rollDoor,-.14), { sw:SW*0.8 });

    // near slope (faces +x): roof finish, solar, signage
    function N(t, y){ return [Wx/2 + t*(Wx/2+5), y, apex - t*(r + r*5/(Wx/2))]; }
    var ns = B.piece('roof', 'N', [N(0,0), N(0,10), N(1,0)]);
    ns.poly([N(0,-4),N(0,Ly),N(1,Ly),N(1,-4)], roofCol);
    if(A.greenroof){
      for(var gy = 8; gy < Ly; gy += 12) for(var gt = 0.12; gt < 1; gt += 0.2){ var g0 = N(gt, gy); ns.line(g0, [g0[0], g0[1], g0[2]+3], PAL.tuft, 0.9); }
    } else {
      for(var yy = 4; yy < Ly; yy += 8) ns.line(N(0.03,yy), N(0.97,yy), shade(roofCol,-.16), 0.6);
    }
    if(A.solar){
      for(var c = 0; c < 5; c++){
        var y0 = 8 + c*28, y1 = y0 + 23;
        ns.poly([N(.12,y0),N(.12,y1),N(.46,y1),N(.46,y0)], PAL.solar, { sw:SW*0.55 });
        ns.poly([N(.54,y0),N(.54,y1),N(.88,y1),N(.88,y0)], PAL.solar, { sw:SW*0.55 });
        ns.line(N(.29,y0+1), N(.29,y1-1), PAL.solarLine, 0.6); ns.line(N(.71,y0+1), N(.71,y1-1), PAL.solarLine, 0.6);
      }
    }
    ns.line([Wx/2,-4,apex],[Wx/2,Ly,apex], shade(roofCol,-.42), 2.4);
    if(A.signage){
      // billboard on posts astride the ridge, facing front-left, and a plant unit on the near slope
      var sy = 40, sz0 = apex + 6, sz1 = sz0 + 16;
      var sg = B.piece('roof', 'sign', planeL(sy));
      sg.line([Wx/2-12,sy,apex-1],[Wx/2-12,sy,sz0], PAL.steel, 1.8).line([Wx/2+12,sy,apex-1],[Wx/2+12,sy,sz0], PAL.steel, 1.8);
      sg.poly(qL(Wx/2-26,Wx/2+26,sz0,sz1,sy), PAL.sign, { stroke:PAL.brand, sw:SW });
      sg.line([Wx/2-20,sy,sz0+10],[Wx/2+14,sy,sz0+10], '#ffffff', 1.4, { 'stroke-opacity':0.75 }).line([Wx/2-20,sy,sz0+5],[Wx/2+4,sy,sz0+5], '#ffffff', 1.4, { 'stroke-opacity':0.75 });
      var px0 = 70, px1 = 88, pz0 = zr(88) - 1;
      box(B, 'roof', 'plant', px0, px1, 96, 116, pz0, pz0 + 12, PAL.plant);
    }

    // gable end (front-left face, y = Ly)
    var L = B.piece('s0', 'L', planeL(Ly));
    var dL = 38, dR = 72, dTop = zb + 44;
    L.poly([[0,Ly,zb],[Wx,Ly,zb],[Wx,Ly,H],[Wx/2,Ly,apex],[0,Ly,H]], wallCol);
    if(tilt){
      [dL, dR].forEach(function(x){ L.line([x,Ly,zb],[x,Ly,zr(x)], PAL.concJoint, 1.2); });
      L.line([dL,Ly,dTop+2],[dR,Ly,dTop+2], PAL.concJoint, 1.2);
    } else {
      for(var x = 6; x < Wx; x += 6) L.line([x,Ly,zb+1],[x,Ly,zr(x)-1.5], PAL.rib, 0.7);
    }
    L.poly(qL(dL,dR,zb,dTop,Ly), PAL.rollDoor, { sw:SW });
    for(var s = 1; s < 7; s++) L.line([dL+1,Ly,zb+s*(dTop-zb)/7],[dR-1,Ly,zb+s*(dTop-zb)/7], INK, 0.6, { 'stroke-opacity':0.45 });
    if(!tilt){
      L.poly(qL(dL-4,dR+4,dTop+5,dTop+12,Ly), PAL.glass, { sw:SW*0.7 });
      for(var m = 1; m < 4; m++) L.line([dL-4+m*(dR-dL+8)/4,Ly,dTop+5],[dL-4+m*(dR-dL+8)/4,Ly,dTop+12], PAL.frame, 1.1);
    }

    // lateral system in the two bays either side of the door
    var bays = [[6, dL-6], [dR+6, Wx-6]];
    if(P.quakeDefender){
      // Quake Defender damper braces, leaning in towards the door as a symmetric pair
      damperL(L, Ly, bays[0][0], zb+1, bays[0][1], H-2, 1.2);
      damperL(L, Ly, bays[1][1], zb+1, bays[1][0], H-2, 1.2);
    } else if(sys === 'braced'){
      bays.forEach(function(b){
        L.line([b[0],Ly,H-1],[b[1],Ly,zb+1], PAL.member, 1.8, { 'class':'brace', 'data-i':0, 'data-dir':'back' });
        L.line([b[1],Ly,H-1],[b[0],Ly,zb+1], PAL.member, 1.8, { 'class':'brace', 'data-i':0, 'data-dir':'fwd' });
      });
    }
    if(!tilt){
      // steel portal frame at the gable: columns and rafters
      L.line([0,Ly,zb],[0,Ly,H], PAL.steel, 3.6).line([Wx,Ly,zb],[Wx,Ly,H], PAL.steel, 3.6);
      L.line([0,Ly,H],[Wx/2,Ly,apex], PAL.steel, 3).line([Wx/2,Ly,apex],[Wx,Ly,H], PAL.steel, 3);
      if(sys === 'moment'){
        var hz = 12;
        L.poly([[0,Ly,H-hz],[0,Ly,H],[hz,Ly,H+r*hz/(Wx/2)]], PAL.member, { stroke:null, 'class':'haunch', 'data-i':0 });
        L.poly([[Wx,Ly,H-hz],[Wx,Ly,H],[Wx-hz,Ly,H+r*hz/(Wx/2)]], PAL.member, { stroke:null, 'class':'haunch', 'data-i':0 });
        L.poly([[Wx/2-9,Ly,apex-r*9/(Wx/2)-5],[Wx/2,Ly,apex],[Wx/2+9,Ly,apex-r*9/(Wx/2)-5]], PAL.member, { stroke:null, 'class':'haunch', 'data-i':0 });
      }
    } else {
      L.line([0,Ly,H],[Wx/2,Ly,apex], INK, 1.2).line([Wx/2,Ly,apex],[Wx,Ly,H], INK, 1.2);
    }
    crackSets(L, Ly, 0, Wx, zb, Hw, 0);
    return { storeys:1, storeyH:Hw, baseZ:zb, height:Hw+r, span:Wx, depth:Ly };
  }

  /* =========================================================
     COMMERCIAL - 4 storeys, 3 bays on the front-left face with the
     lateral system in the centre bay, flat roof with parapet
  ========================================================= */
  function drawCommercial(B, d){
    var Lx = 120, Ly = 90, h = 34, n = 4, par = 6;
    var P = d.protections || {}, A = d.additions || {}, sys = d.systemKey;
    var isolated = !!P.isolation;
    var zb = ground(B, Lx, Ly, isolated, false);
    var H = zb + n*h, wall = PAL.office, wallR = shade(wall,-.16);
    var shear = sys === 'shearwalls', moment = sys === 'moment';
    var cols = [0, 38, 78, 116];

    for(var i = 0; i < n; i++){
      var z0 = zb + i*h, z1 = z0 + h;
      var R = B.piece('s'+i, 'R', planeR(Lx));
      R.poly(qR(0,Ly,z0,z1,Lx), wallR);
      if(shear){
        R.poly(qR(0,30,z0,z1,Lx), shade(PAL.conc,-.16), { sw:SW*0.8 });
        R.poly(qR(36,84,z0+9,z0+25,Lx), shade(PAL.glass,-.14), { sw:SW*0.6 });
        for(var m = 1; m < 3; m++) R.line([Lx,36+m*16,z0+9],[Lx,36+m*16,z0+25], PAL.frame, 1);
      } else {
        R.poly(qR(8,82,z0+9,z0+25,Lx), shade(PAL.glass,-.14), { sw:SW*0.6 });
        for(var mm = 1; mm < 5; mm++) R.line([Lx,8+mm*74/5,z0+9],[Lx,8+mm*74/5,z0+25], PAL.frame, 1);
      }
      R.poly(qR(0,Ly,z1-4,z1,Lx), shade(PAL.floorBand,-.15), { sw:SW*0.5 });
    }

    for(var j = 0; j < n; j++){
      var a0 = zb + j*h, a1 = a0 + h;
      var L = B.piece('s'+j, 'L', planeL(Ly));
      L.poly(qL(0,Lx,a0,a1,Ly), wall);
      // bays: left (6-36), centre (44-76), right (84-114)
      if(shear) L.poly(qL(0,40,a0,a1,Ly), PAL.conc, { sw:SW*0.8 });
      else windowL(L, 6, 36, a0+9, a0+25, Ly);
      windowL(L, 44, 76, a0+9, a0+25, Ly);
      if(j === 0){
        L.poly(qL(88,110,a0,a0+26,Ly), shade(PAL.glass,.1), { sw:SW*0.9 });
        L.line([99,Ly,a0+1],[99,Ly,a0+25], PAL.frame, 1.4);
        L.poly(qL(86,112,a0+26,a0+29,Ly), PAL.sign, { sw:SW*0.5 });
      } else windowL(L, 84, 114, a0+9, a0+25, Ly);
      // frame: columns and the floor band
      cols.forEach(function(x){ if(!(shear && x === 0)) L.poly(qL(x,x+4,a0,a1,Ly), moment ? shade(PAL.column,-.15) : PAL.column, { sw:SW*0.5 }); });
      L.poly(qL(0,Lx,a1-4,a1,Ly), PAL.floorBand, { sw:SW*0.5 });
      // lateral system in the centre bay
      if(P.quakeDefender) damperL(L, Ly, 42, a0+1, 78, a1-5, 1.1);
      else if(sys === 'braced'){
        L.line([42,Ly,a1-4],[78,Ly,a0+1], PAL.member, 1.6, { 'class':'brace', 'data-i':j, 'data-dir':'back' });
        L.line([78,Ly,a1-4],[42,Ly,a0+1], PAL.member, 1.6, { 'class':'brace', 'data-i':j, 'data-dir':'fwd' });
      }
      if(moment) cols.forEach(function(x){ L.poly(qL(x-1,x+5,a1-7,a1,Ly), PAL.member, { sw:0.4, 'class':'haunch', 'data-i':j }); });
      crackSets(L, Ly, 0, Lx, a0, h, j);
    }

    // roof: parapet, deck, add-ons
    var pL = B.piece('roof', 'L', planeL(Ly)), pR = B.piece('roof', 'R', planeR(Lx)), pT = B.piece('roof', 'T', planeT(H+par));
    pL.poly(qL(0,Lx,H,H+par,Ly), shade(wall,-.06));
    pR.poly(qR(0,Ly,H,H+par,Lx), shade(wall,-.22));
    pT.poly(qT(0,Lx,0,Ly,H+par), shade(wall,.2));
    pT.poly(qT(5,Lx-5,5,Ly-5,H+par), A.greenroof ? PAL.green : shade(PAL.plant,.4), { sw:SW*0.6 });
    if(A.greenroof) for(var tx = 12; tx < Lx-8; tx += 13) for(var ty = 12; ty < Ly-8; ty += 13) pT.line([tx,ty,H+par],[tx,ty,H+par+3], PAL.tuft, 0.9);
    if(A.solar){
      // tilted panel rows, each its own flat piece
      for(var row = 0; row < 3; row++){
        var y0 = 10 + row*13, y1 = y0 + 9, zr0 = H+par+1, zr1 = zr0 + 6;
        var sp = B.piece('roof', 'solar'+row, [[60,y1,zr0],[70,y1,zr0],[60,y0,zr1]]);
        sp.poly([[58,y1,zr0],[110,y1,zr0],[110,y0,zr1],[58,y0,zr1]], PAL.solar, { sw:SW*0.6 });
        for(var sc = 1; sc < 4; sc++) sp.line([58+sc*13,y1,zr0],[58+sc*13,y0,zr1], PAL.solarLine, 0.6);
      }
    }
    if(A.signage){
      box(B, 'roof', 'plant', 14, 44, 14, 40, H+par, H+par+15, PAL.plant);
      var sy = Ly - 14, sz0 = H + par + 9, sz1 = sz0 + 16;
      var sg = B.piece('roof', 'sign', planeL(sy));
      sg.line([62,sy,H+par],[62,sy,sz0], PAL.steel, 1.8).line([98,sy,H+par],[98,sy,sz0], PAL.steel, 1.8);
      sg.poly(qL(54,106,sz0,sz1,sy), PAL.sign, { stroke:PAL.brand, sw:SW });
      sg.line([60,sy,sz0+10],[96,sy,sz0+10], '#ffffff', 1.4, { 'stroke-opacity':0.75 }).line([60,sy,sz0+5],[86,sy,sz0+5], '#ffffff', 1.4, { 'stroke-opacity':0.75 });
    }
    return { storeys:n, storeyH:h, baseZ:zb, height:n*h+par, span:Lx, depth:Ly };
  }

  /* ---------- entry point ---------- */
  function render(d, opts){
    opts = opts || {};
    var B = new Builder();
    var info = d.typeKey === 'house' ? drawHouse(B, d) : (d.typeKey === 'industrial' ? drawIndustrial(B, d) : drawCommercial(B, d));
    var m = opts.margin == null ? 10 : opts.margin;
    var vb = [B.minX - m, B.minY - m - (opts.headroom || 0), (B.maxX - B.minX) + 2*m, (B.maxY - B.minY) + 2*m + (opts.headroom || 0)];
    return { markup:B.markup(), viewBox:vb, pieces:B.pieces.map(function(pc){ return { key:pc.key, group:pc.group, ref:pc.ref }; }), info:info };
  }

  root.SOT_SCENE = { render:render, project:proj, PALETTE:PAL };
})(globalThis);
