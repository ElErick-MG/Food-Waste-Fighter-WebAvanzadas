/*
 * Food Waste Fighter — refrigeradora 3D reutilizable.
 * Usa Three.js r128 como global (THREE), servido en /assets/vendor/three.
 * Las texturas se cargan desde /assets/fwf/refri/*.jpg (mismo origen, CSP 'self').
 *
 * Una "pose" describe la cámara en píxeles de pantalla:
 *   th/ph  ángulos de órbita · hPx alto de la refri en px · ax/ay centro en px
 *   puertas 0 (cerradas) … 1 (abiertas) · calidez 0 (estudio) … 1 (luz cálida)
 */

export const W = .91, H = 1.77, D = .72, FOV = 32, TY = H / 2 + .03;

export function crearRefri(canvas, { base = '/assets/fwf/refri/', alCargar } = {}) {
  if (typeof THREE === 'undefined') throw new Error('Three.js no cargó');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 50);
  // Luces
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6b7480, .5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, .9); sun.position.set(2.5, 4, 3.5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 5; sun.shadow.bias = -.0004;
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -1, near: .5, far: 12 });
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd4ff, .35); fill.position.set(-3, 2, 2); scene.add(fill);
  // Entorno de estudio para reflejos realistas
  const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), [0x8c96a2, 0x8c96a2, 0xdfe6ee, 0x2e3338, 0x8c96a2, 0x7a848f].map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide }))));
  [[0, 9, 0, 12, .1, 6], [-12, 4, 6, .1, 8, 10], [12, 3, 4, .1, 7, 8], [0, 3, 13, 12, 7, .1]].forEach(p => { const m = new THREE.Mesh(new THREE.BoxGeometry(p[3], p[4], p[5]), new THREE.MeshBasicMaterial({ color: 0xffffff })); m.position.set(p[0], p[1], p[2]); es.add(m); });
  scene.environment = pm.fromScene(es, .02).texture;

  if (alCargar) THREE.DefaultLoadingManager.onLoad = alCargar;
  const MD = crearModelo(scene, base, alCargar);

  let vw = 1, vh = 1;
  const cA = {
    sun0: new THREE.Color(0xffffff), sun1: new THREE.Color(0xffe6c7), fill0: new THREE.Color(0xbfd4ff), fill1: new THREE.Color(0xffd9b0),
    hg0: new THREE.Color(0x6b7480), hg1: new THREE.Color(0x8a6a4a), p0: new THREE.Vector3(2.5, 4, 3.5), p1: new THREE.Vector3(-3, 4, 3),
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** Coloca la cámara para que la refri mida hPx de alto y quede centrada en (ax, ay). */
  function camara(th, ph, hPx, ax, ay) {
    const r = (H * vh) / (2 * Math.tan(FOV * Math.PI / 360) * hPx) + D / 2;
    camera.position.set(r * Math.sin(ph) * Math.sin(th), TY + r * Math.cos(ph), r * Math.sin(ph) * Math.cos(th));
    camera.lookAt(0, TY, 0);
    camera.setViewOffset(vw, vh, -(ax - vw / 2), -(ay - vh / 2), vw, vh);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }

  const ray = new THREE.Raycaster(), mp = new THREE.Vector2();

  return {
    MD,
    tamano(w, h) { vw = w; vh = h; renderer.setSize(w, h, false); camera.aspect = w / h; },
    /** Rectángulo en pantalla (px) que ocupa la refri en una pose. */
    caja(p) {
      camara(p.th, p.ph, p.hPx, p.ax, p.ay);
      const v = new THREE.Vector3(), r0 = { l: 1e9, t: 1e9, r: -1e9, b: -1e9 };
      for (const x of [-W / 2, W / 2]) for (const y of [0, H + .03]) for (const z of [-D / 2, D / 2 + .055]) {
        v.set(x, y, z).project(camera); const sx = (v.x + 1) / 2 * vw, sy = (1 - v.y) / 2 * vh;
        r0.l = Math.min(r0.l, sx); r0.r = Math.max(r0.r, sx); r0.t = Math.min(r0.t, sy); r0.b = Math.max(r0.b, sy);
      }
      return { l: clamp(r0.l, 0, vw), t: clamp(r0.t, 0, vh), r: clamp(r0.r, 0, vw), b: clamp(r0.b, 0, vh) };
    },
    /** Aplica una pose (con los ángulos efectivos ya calculados) a cámara, puertas y luces. */
    aplicar(pose, th = pose.th, ph = pose.ph, ay = pose.ay) {
      camara(th, ph, pose.hPx, pose.ax, ay);
      let open = 0;
      for (const s in MD.doors) { const d = MD.doors[s]; d.cur = pose.puertas; d.g.rotation.y = d.s * d.cur * Math.PI * .58; open = Math.max(open, d.cur); }
      const li = Math.min(1, Math.max(0, open) * 3);
      MD.inner.intensity = li * 1.1; MD.led.emissiveIntensity = li * 1.5; MD.white.emissiveIntensity = li * .18;
      MD.backM.emissiveIntensity = .1 + li * .5; MD.innerM.forEach(m => { m.emissiveIntensity = .1 + li * .5; });
      const w = clamp(pose.calidez || 0, 0, 1);
      sun.color.copy(cA.sun0).lerp(cA.sun1, w); sun.intensity = .9 + .1 * w; sun.position.copy(cA.p0).lerp(cA.p1, w);
      fill.color.copy(cA.fill0).lerp(cA.fill1, w); fill.intensity = .35 - .1 * w;
      hemi.groundColor.copy(cA.hg0).lerp(cA.hg1, w);
    },
    render() { renderer.render(scene, camera); },
    /** Punto del modelo (m) → píxeles de pantalla con la cámara actual. */
    proyectar(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(camera);
      return [(v.x + 1) / 2 * vw, (1 - v.y) / 2 * vh];
    },
    /** ¿El puntero está sobre la refri? (la cámara debe tener la pose actual aplicada) */
    toca(e) {
      const r = canvas.getBoundingClientRect();
      mp.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      ray.setFromCamera(mp, camera);
      return ray.intersectObject(MD.fr, true).length > 0;
    },
  };
}

/* Modelo copiado de refrigeradora.html (texturas, materiales, cuerpo, rieles, patas,
   puertas y suelo). Solo cambia el origen de las imágenes: archivos en lugar de base64. */
function crearModelo(scene, base, alCargar) {
  const textura = nombre => `${base}${nombre}.jpg`;
  const inner = new THREE.PointLight(0xdff2ff, 0, 2.2, 1.4); inner.position.set(0, 1.6, .1);
/* ----- inicio: código copiado de refrigeradora.html ----- */
// Texturas
function cnv(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
const sc=cnv(256,256),sx=sc.getContext('2d');
let g=sx.createLinearGradient(0,0,256,0);g.addColorStop(0,'#7b8086');g.addColorStop(.5,'#9aa0a6');g.addColorStop(1,'#767b81');
sx.fillStyle=g;sx.fillRect(0,0,256,256);
for(let i=0;i<900;i++){sx.fillStyle='rgba('+(Math.random()<.5?'255,255,255':'0,0,0')+','+(Math.random()*.07)+')';sx.fillRect(Math.random()*256,0,Math.random()*1.5+.3,256)}
const steelTex=new THREE.CanvasTexture(sc);steelTex.encoding=THREE.sRGBEncoding;
// Fotografía real del producto como textura de las puertas
const PH=textura('puertas');
const dc=[cnv(512,1024),cnv(512,1024)];
dc.forEach(c=>{const x=c.getContext('2d');x.fillStyle='#6b6f74';x.fillRect(0,0,512,1024)});
const photoT=dc.map(c=>{const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t});
const front=photoT.map(t=>new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.6,metalness:.25,roughness:.38,envMapIntensity:.6,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
const pimg=new Image();pimg.onload=()=>{const w=pimg.width,h=pimg.height;
 dc.forEach((c,i)=>c.getContext('2d').drawImage(pimg,i*w/2,0,w/2,h,0,0,512,1024));
 photoT.forEach(t=>t.needsUpdate=true);
 sx.drawImage(pimg,w*.55,h*.6,w*.4,h*.3,0,0,256,256);steelTex.needsUpdate=true};
pimg.src=PH;
const TL=new THREE.TextureLoader();
function tx(u){const t=TL.load(u);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t}
function pmat(u,ei,m,r){const t=tx(u);return new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:ei,metalness:m,roughness:r,envMapIntensity:.5})}
const topM=pmat(textura('techo'),.5,.45,.35),backOutM=pmat(textura('trasera'),.45,.2,.6);
const sideL=pmat(textura('lateral-izq'),.5,.5,.35),sideR=pmat(textura('lateral-der'),.5,.5,.35);
const backM=pmat(textura('fondo'),.15,0,.85);
const innerM=[pmat(textura('interior-izq'),.15,0,.8),pmat(textura('interior-der'),.15,0,.8)];
function streak(base,amp){const c=cnv(256,256),x=c.getContext('2d');x.fillStyle=base;x.fillRect(0,0,256,256);for(let i=0;i<1600;i++){x.fillStyle=(Math.random()<.5?'rgba(255,255,255,':'rgba(0,0,0,')+Math.random()*amp+')';x.fillRect(Math.random()*256,Math.random()*256,Math.random()*1.4+.3,Math.random()*120+20)}return c}
const rTex=new THREE.CanvasTexture(streak('#8a8a8a',.35));
const nc=cnv(128,128),nx=nc.getContext('2d');for(let i=0;i<4000;i++){const v=120+Math.random()*100|0;nx.fillStyle='rgb('+v+','+v+','+v+')';nx.fillRect(Math.random()*128,Math.random()*128,2,2)}
const nTex=new THREE.CanvasTexture(nc);nTex.wrapS=nTex.wrapT=THREE.RepeatWrapping;nTex.repeat.set(6,6);
const steel=new THREE.MeshStandardMaterial({map:steelTex,roughnessMap:rTex,bumpMap:rTex,bumpScale:.6,metalness:.9,roughness:.65,envMapIntensity:1});
const rubber=new THREE.MeshStandardMaterial({color:0x101112,roughness:.9});
const trim=new THREE.MeshStandardMaterial({color:0xd5dadf,metalness:.9,roughness:.25});
const white=new THREE.MeshStandardMaterial({color:0xf0f4fa,roughness:.78,envMapIntensity:.25,emissive:0xcfe0f5,emissiveIntensity:0});
const dark=new THREE.MeshStandardMaterial({color:0x1b1d20,roughness:.5,metalness:.4});
const black=new THREE.MeshStandardMaterial({color:0x0a0b0c,roughness:.15,metalness:.8});
const glassM=new THREE.MeshStandardMaterial({color:0xbfeee6,transparent:true,opacity:.38,roughness:.1,metalness:.1});
const binM=new THREE.MeshStandardMaterial({color:0xdfeff7,transparent:true,opacity:.42,roughness:.2});
const led=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xcfe9ff,emissiveIntensity:0});

const W=.91,H=1.77,D=.72,t=.03,T=.055;
const fr=new THREE.Group();fr.position.y=.03;scene.add(fr);fr.add(inner);
function box(w,h,d,m,x,y,z,parent){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;(parent||fr).add(o);return o}

// Cuerpo: [+x,-x,+y,-y,+z,-z]
box(t,H-2*t,D,[white,sideL,dark,dark,dark,dark],-W/2+t/2,H/2,0);
box(t,H-2*t,D,[sideR,white,dark,dark,dark,dark],W/2-t/2,H/2,0);
box(W,t,D,[topM,topM,topM,white,dark,dark],0,H-t/2,0);
box(W,t,D,[dark,dark,white,dark,dark,dark],0,t/2,0);
box(W-2*t,H-2*t,t,[white,white,white,white,backM,backOutM],0,H/2,-D/2+t/2);
// LEDs

// Rieles laterales con muescas para los estantes
const rc=cnv(16,64),rx=rc.getContext('2d');rx.fillStyle='#f1f5fa';rx.fillRect(0,0,16,64);rx.fillStyle='#aab6c4';rx.fillRect(5,24,6,10);
const rt=new THREE.CanvasTexture(rc);rt.wrapS=rt.wrapT=THREE.RepeatWrapping;rt.repeat.set(1,26);
const railM=new THREE.MeshStandardMaterial({map:rt,roughness:.6,envMapIntensity:.3});
[-1,1].forEach(s=>box(.02,H-2*t-.1,.008,railM,s*(W/2-t-.012),H/2,-D/2+t+.004));
// Patas
[-.38,.38].forEach(x=>[-.28,.3].forEach(z=>{const f=new THREE.Mesh(new THREE.CylinderGeometry(.022,.025,.03,16),dark);f.position.set(x,-.015,z);fr.add(f)}));

// Puertas
const dw=W/2-.003,dh=H-.012;
const doors={};
function makeDoor(side){
  const s=side==='L'?-1:1;
  const g=new THREE.Group();g.position.set(s*W/2,H/2,D/2+.004);g.userData.side=side;fr.add(g);
  const slab=new THREE.Group();slab.position.set(-s*dw/2,0,T/2);g.add(slab);
  const body=box(dw,dh,T,[sideL,sideL,sideL,sideL,steel,innerM[side==='L'?0:1]],0,0,0,slab);
  // contenedores
  const fp=new THREE.Mesh(new THREE.PlaneGeometry(dw,dh),front[side==='L'?0:1]);fp.position.z=T/2+.001;slab.add(fp);
  doors[side]={g,s,cur:0,tar:0};
}
makeDoor('L');makeDoor('R');

// Suelo con sombra
const floor=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.ShadowMaterial({opacity:.28}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;

/* ----- fin del código copiado ----- */
  pimg.addEventListener('load', () => alCargar?.());
  return { fr, doors, glassM, trim, white, led, backM, innerM, inner, floor };
}
