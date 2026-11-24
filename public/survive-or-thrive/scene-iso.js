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

  /* An X-braced bay of DonoBrace tension-only rods on a front-left face, as
     the brace classes the animation colours (tension red / compression blue).
     With Quake Defender, each rod carries a device in line near its bottom
     anchor, as the QD methodology (V26.10) installs it: QD in series with
     tension-only X bracing in the wall bracing bays. */
  function xBraceL(face, y, x0, x1, zBot, zTop, i, sw, qd){
    face.line([x0,y,zTop],[x1,y,zBot], PAL.member, sw, { 'class':'brace', 'data-i':i, 'data-dir':'back' });
    face.line([x1,y,zTop],[x0,y,zBot], PAL.member, sw, { 'class':'brace', 'data-i':i, 'data-dir':'fwd' });
    if(!qd) return;
    qdDevice(face, y, [x1,zBot], [x0,zTop]);
    qdDevice(face, y, [x0,zBot], [x1,zTop]);
  }
  // A Quake Defender device on a rod, starting just above its bottom anchor:
  // brand blue with a thin white edge so it reads against any wall.
  function qdDevice(face, y, bot, top){
    var dx = top[0]-bot[0], dz = top[1]-bot[1], len = Math.hypot(dx, dz), ux = dx/len, uz = dz/len, nx = -uz*2.8, nz = ux*2.8;
    var s0 = Math.min(5, len*0.08), s1 = s0 + Math.min(17, len*0.3);
    function p(s, o){ return [bot[0]+ux*s+nx*o, y, bot[1]+uz*s+nz*o]; }
    face.poly([p(s0-1,-1.45),p(s1+1,-1.45),p(s1+1,1.45),p(s0-1,1.45)], '#ffffff', { stroke:null });
    face.poly([p(s0,-1),p(s1,-1),p(s1,1),p(s0,1)], PAL.brandFill, { stroke:PAL.brand, sw:1.1, 'class':'damper' });
    face.poly([p(s0,-1),p(s0+2.4,-1),p(s0+2.4,1),p(s0,1)], PAL.brand, { stroke:null, 'class':'damper' });
    face.line(p((s0+s1)/2,-1), p((s0+s1)/2,1), PAL.brand, 0.8);
  }

  function crackSets(face, y, x0, w, zb, h, i){
    function X(f){ return x0 + w*f; }
    var s1 = [[[X(.18),zb+h-2],[X(.22),zb+h*.68],[X(.19),zb+h*.45]], [[X(.82),zb+2],[X(.79),zb+h*.4],[X(.83),zb+h*.62]]];
    var s2 = [[[X(.03),zb+h-3],[X(.46),zb+h*.6],[X(.54),zb+h*.42],[X(.96),zb+3]], [[X(.96),zb+h-3],[X(.55),zb+h*.6],[X(.46),zb+h*.44],[X(.04),zb+3]]];
    s1.forEach(function(c){ face.pl(c.map(function(a){ return [a[0], y, a[1]]; }), '#dc2626', 1.1, { 'class':'crack', 'data-stage':'1', 'data-i':i, opacity:0 }); });
    s2.forEach(function(c){ face.pl(c.map(function(a){ return [a[0], y, a[1]]; }), '#dc2626', 1.6, { 'class':'crack', 'data-stage':'2', 'data-i':i, opacity:0 }); });
  }

  /* ---------- ground: grass island, foundation slab, optional isolator layer ---------- */
  // yard: depth of a concrete yard along the front-left side (industrial),
  // deep enough for a fallen tilt-up panel to land on.
  function ground(B, X, Y, isolated, isHouse, yard){
    var e = 16, ef = yard ? yard + 8 : 18;
    var T = B.piece('ground', 'T', planeT(0));
    if(!NO_ISLAND){
      var L = B.piece('ground', 'L', planeL(Y+ef)), R = B.piece('ground', 'R', planeR(X+e));
      L.poly(qL(-e, X+e, -22, -9, Y+ef), PAL.soil, { sw:SW*0.8 }).poly(qL(-e, X+e, -9, 0, Y+ef), PAL.grassSide, { sw:SW*0.8 });
      R.poly(qR(-e, Y+ef, -22, -9, X+e), shade(PAL.soil,-.18), { sw:SW*0.8 }).poly(qR(-e, Y+ef, -9, 0, X+e), shade(PAL.grassSide,-.14), { sw:SW*0.8 });
      T.poly(qT(-e, X+e, -e, Y+ef, 0), PAL.grass, { sw:SW*0.8 });
    }
    if(yard){
      T.poly(qT(-8, X+8, Y+4, Y+yard, 0.15), '#d4d8dc', { sw:SW*0.6 });
      for(var jx = -8 + (X+16)/5; jx < X+8; jx += (X+16)/5) T.line([jx, Y+4, 0.15], [jx, Y+yard, 0.15], '#b9c0c7', 0.7);
    }
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
    fr.poly([F(0,-5),F(0,Lx),F(1,Lx),F(1,-5)], shade(roofCol,-.25));

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
    // The far slope's overhang past the gable sits in front of the gable wall,
    // so it's drawn after it (otherwise the wall cuts a notch in the roof line).
    B.piece('roof', 'Fv', [F(0,0), F(0,10), F(1,0)]).poly([F(0,Lx),F(0,Lx+5),F(1,Lx+5),F(1,Lx)], shade(roofCol,-.25));

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
    // The chimney's front base edge (it topples forward about this line).
    var chim = A.chimney ? { x0:80, x1:92, y:32, z:H + r - 9 } : null;
    return { storeys:n, storeyH:h, baseZ:zb, height:n*h+r, span:Lx, depth:Ly, chimney:chim };
  }

  /* =========================================================
     INDUSTRIAL - 1 tall storey. Portal frames span across y (the gable
     end, with the roller door, is the front-right face); the shaking runs
     along the building's length (x). In that direction the portal frames
     do little: the long side walls resist it through X-braced end bays of
     DonoBrace tension-only rods - where Quake Defender devices go, per the
     V26.10 methodology - or through tilt-up concrete panels, or through
     moment-connected column heads.
  ========================================================= */
  function drawIndustrial(B, d){
    var Lx = 160, Ly = 100, Hw = 56, r = 18, bay = 32;
    var P = d.protections || {}, A = d.additions || {}, sys = d.systemKey;
    var isolated = !!P.isolation;
    var zb = ground(B, Lx, Ly, isolated, false, NO_YARD ? 0 : Hw + 6);
    var H = zb + Hw, apex = H + r;
    var tilt = sys === 'shearwalls', qd = !!P.quakeDefender;
    var wallCol = tilt ? PAL.conc : PAL.clad, wallR = shade(wallCol,-.16);
    var roofCol = A.greenroof ? PAL.green : PAL.iron;
    function zr(y){ return H + r*(1-Math.abs(y-Ly/2)/(Ly/2)); }

    // Tilt-up only: the inside of the shed (floor, back wall, far gable),
    // hidden at rest, seen once the front panels fall away in a collapse.
    if(tilt){
      B.piece('in', 'floor', planeT(zb+0.2)).poly(qT(0,Lx,0,Ly,zb+0.2), '#d9d4cc', { sw:SW*0.5 });
      B.piece('in', 'back', planeL(0)).poly([[0,0,zb],[Lx,0,zb],[Lx,0,H],[0,0,H]], shade(PAL.conc,-.3), { sw:SW*0.6 });
      B.piece('in', 'end', planeR(0)).poly([[0,0,zb],[0,Ly,zb],[0,Ly,H],[0,Ly/2,apex],[0,0,H]], shade(PAL.conc,-.2), { sw:SW*0.6 });
    }

    // far slope (faces -y)
    function F(t, x){ return [x, Ly/2 - t*(Ly/2+5), apex - t*(r + r*5/(Ly/2))]; }
    B.piece('roof', 'F', [F(0,0), F(0,10), F(1,0)]).poly([F(0,-4),F(0,Lx),F(1,Lx),F(1,-4)], shade(roofCol,-.24));

    // gable end (front-right face, x = Lx): roller door, portal frame outline
    var R = B.piece('s0', 'R', planeR(Lx));
    R.poly([[Lx,0,zb],[Lx,Ly,zb],[Lx,Ly,H],[Lx,Ly/2,apex],[Lx,0,H]], wallR);
    var d0 = 32, d1 = 68, dTop = zb + 42;
    if(tilt){
      [d0, d1].forEach(function(y){ R.line([Lx,y,zb],[Lx,y,zr(y)], shade(PAL.concJoint,-.1), 1.1); });
    } else {
      for(var ry = 6; ry < Ly; ry += 6) R.line([Lx,ry,zb+1],[Lx,ry,zr(ry)-1.5], shade(PAL.rib,-.14), 0.6);
      R.poly(qR(d0-4,d1+4,dTop+5,dTop+11,Lx), shade(PAL.glass,-.14), { sw:SW*0.6 });
    }
    R.poly(qR(d0,d1,zb,dTop,Lx), shade(PAL.rollDoor,-.12), { sw:SW });
    for(var s = 1; s < 7; s++) R.line([Lx,d0+1,zb+s*(dTop-zb)/7],[Lx,d1-1,zb+s*(dTop-zb)/7], INK, 0.6, { 'stroke-opacity':0.45 });
    if(!tilt){
      R.line([Lx,0,zb],[Lx,0,H], PAL.steel, 3).line([Lx,Ly,zb],[Lx,Ly,H], PAL.steel, 3);
      R.line([Lx,0,H],[Lx,Ly/2,apex], PAL.steel, 2.6).line([Lx,Ly/2,apex],[Lx,Ly,H], PAL.steel, 2.6);
    }
    // far slope's overhang past the gable, drawn in front of the gable wall
    B.piece('roof', 'Fv', [F(0,0), F(0,10), F(1,0)]).poly([F(0,Lx),F(0,Lx+4),F(1,Lx+4),F(1,Lx)], shade(roofCol,-.24));

    // near slope (faces +y): roof finish, solar, rooftop plant and signage
    function N(t, x){ return [x, Ly/2 + t*(Ly/2+6), apex - t*(r + r*6/(Ly/2))]; }
    function zSlope(y){ return apex - (y-Ly/2)/(Ly/2+6)*(r + r*6/(Ly/2)); }
    var ns = B.piece('roof', 'N', [N(0,0), N(0,10), N(1,0)]);
    ns.poly([N(0,-4),N(0,Lx+4),N(1,Lx+4),N(1,-4)], roofCol);
    if(A.greenroof){
      for(var gx = 6; gx < Lx; gx += 11) for(var gt = 0.12; gt < 1; gt += 0.19){ var g0 = N(gt, gx); ns.line(g0, [g0[0], g0[1], g0[2]+3], PAL.tuft, 0.9); }
    } else {
      for(var rx = 4; rx < Lx; rx += 8) ns.line(N(0.03,rx), N(0.97,rx), shade(roofCol,-.16), 0.6);
    }
    if(A.solar){
      // panels kept to the right-hand part of the slope, clear of the plant platform
      for(var c = 0; c < 4; c++){
        var x0 = 52 + c*27, x1 = x0 + 23;
        ns.poly([N(.12,x0),N(.12,x1),N(.46,x1),N(.46,x0)], PAL.solar, { sw:SW*0.55 });
        ns.poly([N(.54,x0),N(.54,x1),N(.88,x1),N(.88,x0)], PAL.solar, { sw:SW*0.55 });
        ns.line(N(.29,x0+1), N(.29,x1-1), PAL.solarLine, 0.6).line(N(.71,x0+1), N(.71,x1-1), PAL.solarLine, 0.6);
      }
    }
    ns.line([-4,Ly/2,apex],[Lx+4,Ly/2,apex], shade(roofCol,-.42), 2.4);
    if(A.signage){
      // billboard on two posts along the ridge, at the gable end
      var sy = Ly/2, sz0 = apex + 7, sz1 = sz0 + 16;
      var sg = B.piece('roof', 'sign', planeL(sy));
      sg.line([112,sy,apex],[112,sy,sz0], PAL.steel, 1.8).line([140,sy,apex],[140,sy,sz0], PAL.steel, 1.8);
      sg.poly(qL(102,150,sz0,sz1,sy), PAL.sign, { stroke:PAL.brand, sw:SW });
      sg.line([108,sy,sz0+10],[142,sy,sz0+10], '#ffffff', 1.4, { 'stroke-opacity':0.75 }).line([108,sy,sz0+5],[130,sy,sz0+5], '#ffffff', 1.4, { 'stroke-opacity':0.75 });
      // plant unit on a level steel platform at the other end of the slope
      var py0 = Ly/2 + 8, py1 = Ly/2 + 30, px0 = 8, px1 = 36, deck = zSlope(py0) + 1.5;
      var legs = B.piece('roof', 'legs', planeL(py1));
      [px0+1, px1-1].forEach(function(x){ legs.line([x,py1,zSlope(py1)],[x,py1,deck], PAL.steel, 1.6); });
      legs.poly(qL(px0,px1,deck-2,deck,py1), shade(PAL.steel,.25), { sw:SW*0.6 });
      B.piece('roof', 'legsR', planeR(px1)).poly(qR(py0,py1,deck-2,deck,px1), shade(PAL.steel,.1), { sw:SW*0.6 })
        .line([px1,py0+1,zSlope(py0+1)],[px1,py0+1,deck-2], PAL.steel, 1.2);
      B.piece('roof', 'deck', planeT(deck)).poly(qT(px0,px1,py0,py1,deck), shade(PAL.steel,.45), { sw:SW*0.6 });
      box(B, 'roof', 'plant', px0+4, px1-4, py0+3, py1-3, deck, deck+12, PAL.plant);
      var fan = []; for(var k = 0; k < 14; k++){ var a = 2*Math.PI*k/14; fan.push([(px0+px1)/2 + 6*Math.cos(a), (py0+py1)/2 + 6*Math.sin(a), deck+12]); }
      B.piece('roof', 'plantT', planeT(deck+12)).poly(fan, shade(PAL.plant,-.25), { sw:0.8 });
    }

    // long side wall (front-left face, y = Ly): where the lateral system lives
    if(tilt){
      // Tilt-up: each concrete panel is its own group ('tp0'..'tp4'), so in a
      // collapse they can break their connections and fall outward one by one.
      for(var k = 0; k < Lx/bay; k++){
        var px = k*bay, tp = B.piece('tp'+k, 'L', planeL(Ly));
        tp.poly(qL(px,px+bay,zb,H,Ly), wallCol, { sw:SW*0.9 });
        if(px <= 74 && px+bay >= 88) tp.poly(qL(74,88,zb,zb+26,Ly), PAL.rollDoor, { sw:SW*0.8 });
        tp.line([px,Ly,H],[px+bay,Ly,H], INK, 1.2);
        tp.pl([[px+bay*.3,Ly,zb+2],[px+bay*.38,Ly,zb+Hw*.25],[px+bay*.32,Ly,zb+Hw*.45]], '#dc2626', 1.1, { 'class':'crack', 'data-stage':'1', 'data-i':0, opacity:0 });
        tp.pl([[px+3,Ly,zb+Hw*.75],[px+bay*.5,Ly,zb+Hw*.42],[px+bay-4,Ly,zb+3]], '#dc2626', 1.6, { 'class':'crack', 'data-stage':'2', 'data-i':0, opacity:0 });
      }
      return { storeys:1, storeyH:Hw, baseZ:zb, height:Hw+r, span:Lx, depth:Ly, panels:Lx/bay, bay:bay };
    }
    var L = B.piece('s0', 'L', planeL(Ly));
    L.poly(qL(0,Lx,zb,H,Ly), wallCol);
    {
      for(var x = 6; x < Lx; x += 6) L.line([x,Ly,zb+1],[x,Ly,H-1], PAL.rib, 0.7);
      if(!NO_WALL_WINDOW){
        L.poly(qL(bay+4,Lx-bay-4,H-19,H-12,Ly), PAL.glass, { sw:SW*0.6 });
        for(var w = bay*2; w < Lx-bay; w += bay) L.line([w,Ly,H-19],[w,Ly,H-12], PAL.frame, 1.1);
      }
    }
    L.poly(qL(74,88,zb,zb+26,Ly), PAL.rollDoor, { sw:SW*0.8 });
    {
      for(var cx = 0; cx <= Lx; cx += bay) L.line([cx,Ly,zb],[cx,Ly,H], PAL.steel, cx === 0 || cx === Lx ? 3 : 2.2);
      // X-braced end bays: a portal-frame shed always relies on wall bracing
      // along its length, so every steel option shows it - plain rods, or
      // with Quake Defender devices in line when chosen.
      {
        xBraceL(L, Ly, 3, bay-3, zb+1, H-2, 0, 1.6, qd);
        xBraceL(L, Ly, Lx-bay+3, Lx-3, zb+1, H-2, 0, 1.6, qd);
      }
      // moment-connected column heads glow with demand
      if(sys === 'moment'){
        for(var hx = 0; hx <= Lx; hx += bay){
          if(hx > 0) L.poly([[hx,Ly,H],[hx-6,Ly,H],[hx,Ly,H-6]], PAL.member, { stroke:null, 'class':'haunch', 'data-i':0 });
          if(hx < Lx) L.poly([[hx,Ly,H],[hx+6,Ly,H],[hx,Ly,H-6]], PAL.member, { stroke:null, 'class':'haunch', 'data-i':0 });
        }
      }
    }
    L.line([0,Ly,H],[Lx,Ly,H], INK, 1.2);
    crackSets(L, Ly, 0, Lx, zb, Hw, 0);
    return { storeys:1, storeyH:Hw, baseZ:zb, height:Hw+r, span:Lx, depth:Ly };
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
      if(P.quakeDefender || sys === 'braced') xBraceL(L, Ly, 42, 78, a0+1, a1-5, j, 1.5, !!P.quakeDefender);
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
  // opts.noIsland: leave out the grass island, for scenes that put several
  // buildings on one shared ground (the landing page).
  // opts.noYard / opts.noWallWindow: leave out the industrial shed's concrete
  // yard and the window strip on its long wall (the landing page).
  var NO_ISLAND = false, NO_YARD = false, NO_WALL_WINDOW = false;
  function render(d, opts){
    opts = opts || {};
    NO_ISLAND = !!opts.noIsland; NO_YARD = !!opts.noYard; NO_WALL_WINDOW = !!opts.noWallWindow;
    var B = new Builder();
    var info = d.typeKey === 'house' ? drawHouse(B, d) : (d.typeKey === 'industrial' ? drawIndustrial(B, d) : drawCommercial(B, d));
    NO_ISLAND = false; NO_YARD = false; NO_WALL_WINDOW = false;
    var m = opts.margin == null ? 10 : opts.margin;
    var vb = [B.minX - m, B.minY - m - (opts.headroom || 0), (B.maxX - B.minX) + 2*m, (B.maxY - B.minY) + 2*m + (opts.headroom || 0)];
    return { markup:B.markup(), viewBox:vb, pieces:B.pieces.map(function(pc){ return { key:pc.key, group:pc.group, ref:pc.ref }; }), info:info };
  }

  root.SOT_SCENE = { render:render, project:proj, PALETTE:PAL, SLAB_H:SLAB_H, ISO_H:ISO_H };
})(globalThis);
