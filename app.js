/* ============================================================
   BIRTHDAY SITE — frontend logic
   - One continuous Three.js scene the camera flies through as
     you scroll (stars -> balloons -> cake -> fireworks).
   - All editable text/photos/date persist via the backend API
     in /api routes (see server.js), so edits survive refreshes
     and are visible to anyone who loads the site once deployed.
   ============================================================ */

const API = {
  async getContent(){ return (await fetch('/api/content')).json(); },
  async saveContent(data){ return (await fetch('/api/content', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)})).json(); },
  async getGuestbook(){ return (await fetch('/api/guestbook')).json(); },
  async postGuestbook(entry){ return (await fetch('/api/guestbook', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(entry)})).json(); }
};

let state = {
  name: 'Someone Wonderful',
  subhead: 'This is your party to plan — edit anything on the page.',
  message: 'Write your birthday message here.',
  footer: 'Made with love, one candle at a time.',
  targetDate: null,
  photos: []
};

/* ---------------- Save indicator ---------------- */
const indicator = document.getElementById('save-indicator');
let saveTimer = null;
function flashSaved(){
  indicator.classList.add('show');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=> indicator.classList.remove('show'), 1400);
}

let persistTimer = null;
function schedulePersist(){
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async ()=>{
    await API.saveContent(state);
    flashSaved();
  }, 500);
}

/* ---------------- Editable fields ---------------- */
function bindEditable(){
  document.querySelectorAll('[contenteditable="true"][data-key]').forEach(el=>{
    const key = el.dataset.key;
    if(state[key]) el.textContent = state[key];
    el.addEventListener('input', ()=>{
      state[key] = el.textContent;
      schedulePersist();
    });
  });
}

/* ---------------- Countdown ---------------- */
const dateInput = document.getElementById('target-date');
function pad(n){ return String(n).padStart(2,'0'); }
function updateCountdown(){
  const target = new Date(dateInput.value).getTime();
  if(isNaN(target)) return;
  let diff = Math.max(0, target - Date.now());
  document.getElementById('cd-days').textContent = pad(Math.floor(diff/86400000));
  document.getElementById('cd-hours').textContent = pad(Math.floor((diff%86400000)/3600000));
  document.getElementById('cd-mins').textContent = pad(Math.floor((diff%3600000)/60000));
  document.getElementById('cd-secs').textContent = pad(Math.floor((diff%60000)/1000));
}
dateInput.addEventListener('input', ()=>{
  state.targetDate = dateInput.value;
  schedulePersist();
  updateCountdown();
});

/* ---------------- Gallery ---------------- */
const galleryGrid = document.getElementById('gallery-grid');
function renderGallery(){
  galleryGrid.innerHTML = '';
  for(let i=0;i<8;i++){
    const slot = document.createElement('label');
    slot.className = 'slot';
    const existing = state.photos[i];
    slot.innerHTML = existing
      ? `<img src="${existing}" alt="photo"><input type="file" accept="image/*">`
      : `<span>+ Add photo</span><input type="file" accept="image/*">`;
    const input = slot.querySelector('input');
    input.addEventListener('change', e=>{
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = ev=>{
        state.photos[i] = ev.target.result;
        slot.innerHTML = `<img src="${ev.target.result}" alt="photo"><input type="file" accept="image/*">`;
        slot.querySelector('input').addEventListener('change', input.onchange);
        schedulePersist();
      };
      reader.readAsDataURL(file);
    });
    galleryGrid.appendChild(slot);
  }
}

/* ---------------- Guestbook ---------------- */
const guestWall = document.getElementById('guest-wall');
function renderGuestbook(entries){
  guestWall.innerHTML = entries.map(e=>`
    <div class="guest-card">
      <div class="who">${escapeHTML(e.name)}</div>
      <div class="what">${escapeHTML(e.message)}</div>
      <div class="when">${new Date(e.createdAt).toLocaleString()}</div>
    </div>
  `).join('');
}
function escapeHTML(str){
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
document.getElementById('guest-form').addEventListener('submit', async e=>{
  e.preventDefault();
  const name = document.getElementById('guest-name').value.trim();
  const message = document.getElementById('guest-message').value.trim();
  if(!message) return;
  const entry = await API.postGuestbook({name, message});
  const list = await API.getGuestbook();
  renderGuestbook(list);
  e.target.reset();
  burstFireworks(); // little celebration when someone posts a wish
});

/* ---------------- Section nav dots ---------------- */
const dots = document.querySelectorAll('#dots a');
const sections = document.querySelectorAll('.panel, footer');
const observer = new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      dots.forEach(d=>d.classList.remove('active'));
      const match = document.querySelector(`#dots a[href="#${entry.target.id}"]`);
      if(match) match.classList.add('active');
    }
  });
}, {threshold:0.5});
sections.forEach(s=>{ if(s.id) observer.observe(s); });

document.getElementById('scrollcue').addEventListener('click', ()=>{
  document.getElementById('countdown').scrollIntoView({behavior:'smooth'});
});

/* ============================================================
   THREE.JS SCENE — a continuous world the camera dollies through
   as the page scrolls. Depths (world Z, camera moves from Z=60
   down to Z=-10):
     Z ~ 55   starfield begins (visible throughout)
     Z ~ 40   balloons cluster (hero)
     Z ~ 22   floating "time" ring (countdown)
     Z ~ 5    birthday cake with 5 candles
     Z ~ -8   fireworks trigger zone
   ============================================================ */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 60);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const keyLight = new THREE.PointLight(0xff3e8e, 1.6, 80);
keyLight.position.set(6, 8, 20);
scene.add(keyLight);
const fillLight = new THREE.PointLight(0xffc857, 1.2, 80);
fillLight.position.set(-8, -4, 10);
scene.add(fillLight);

const PALETTE = [0xFF3E8E, 0xFFC857, 0xC9B6FF, 0xFFF8F0];

/* Starfield */
const starCount = 900;
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(starCount*3);
for(let i=0;i<starCount;i++){
  starPos[i*3] = (Math.random()-0.5)*140;
  starPos[i*3+1] = (Math.random()-0.5)*140;
  starPos[i*3+2] = (Math.random()-0.5)*140 + 20;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({color:0xffffff, size:0.18, transparent:true, opacity:0.7}));
scene.add(stars);

/* Balloons (reused from hero concept) */
function makeBalloon(color){
  const g = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(1, 28, 28);
  bodyGeo.scale(1, 1.25, 1);
  const mat = new THREE.MeshPhongMaterial({color, shininess:90, specular:0xffffff});
  const body = new THREE.Mesh(bodyGeo, mat);
  g.add(body);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.28, 10), mat);
  knot.position.y = -1.32;
  knot.rotation.x = Math.PI;
  g.add(knot);
  return g;
}
const balloons = [];
for(let i=0;i<9;i++){
  const b = makeBalloon(PALETTE[i % PALETTE.length]);
  const scale = 0.8 + Math.random()*0.9;
  b.scale.setScalar(scale);
  b.position.set((Math.random()-0.5)*20, (Math.random()-0.5)*14, 36 + (Math.random()-0.5)*10);
  b.userData = {baseX:b.position.x, baseY:b.position.y, phase:Math.random()*Math.PI*2, speed:0.3+Math.random()*0.4};
  balloons.push(b);
  scene.add(b);
}

/* Floating ring for the countdown zone */
const ringGeo = new THREE.TorusGeometry(6, 0.12, 16, 100);
const ringMat = new THREE.MeshPhongMaterial({color:0xC9B6FF, emissive:0x2a1a55, shininess:100});
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.position.set(0, 0, 20);
ring.rotation.x = Math.PI/2.4;
scene.add(ring);
const ring2 = ring.clone();
ring2.scale.setScalar(0.7);
ring2.rotation.z = 0.6;
scene.add(ring2);

/* Cake with 5 candles */
const cakeGroup = new THREE.Group();
cakeGroup.position.set(0, -3, 4);
const tierMat1 = new THREE.MeshPhongMaterial({color:0xFFF3E0, shininess:20});
const tierMat2 = new THREE.MeshPhongMaterial({color:0xFF3E8E, shininess:30});
const base = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.8, 1.6, 32), tierMat2);
base.position.y = 0;
cakeGroup.add(base);
const tier = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4, 1.6, 32), tierMat1);
tier.position.y = 1.5;
cakeGroup.add(tier);
const icingDrip = new THREE.Mesh(new THREE.TorusGeometry(3.75, 0.25, 12, 32), new THREE.MeshPhongMaterial({color:0xFFC857}));
icingDrip.position.y = 0.75;
icingDrip.rotation.x = Math.PI/2;
cakeGroup.add(icingDrip);

const candles = [];
const candlePositions = [-2.4, -1.2, 0, 1.2, 2.4];
candlePositions.forEach((x, idx)=>{
  const candleGroup = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 12), new THREE.MeshPhongMaterial({color:PALETTE[idx % PALETTE.length]}));
  stick.position.y = 2.9;
  candleGroup.add(stick);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.42, 10),
    new THREE.MeshBasicMaterial({color:0xFFC857})
  );
  flame.position.y = 3.72;
  flame.userData = {lit:true, baseY:3.72};
  candleGroup.add(flame);
  const flameLight = new THREE.PointLight(0xffb347, 0.6, 4);
  flameLight.position.y = 3.9;
  candleGroup.add(flameLight);
  candleGroup.position.x = x;
  candleGroup.userData = {flame, flameLight, lit:true};
  candles.push(candleGroup);
  cakeGroup.add(candleGroup);
});
scene.add(cakeGroup);

/* Fireworks system — pooled particle bursts */
const fireworkBursts = [];
function burstFireworks(count = 3){
  for(let b=0; b<count; b++){
    const n = 90;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n*3);
    const vel = new Float32Array(n*3);
    const colorArr = new Float32Array(n*3);
    const color = new THREE.Color(PALETTE[Math.floor(Math.random()*PALETTE.length)]);
    const origin = new THREE.Vector3((Math.random()-0.5)*14, 2+Math.random()*6, -6 + (Math.random()-0.5)*6);
    for(let i=0;i<n;i++){
      pos[i*3]=origin.x; pos[i*3+1]=origin.y; pos[i*3+2]=origin.z;
      const theta = Math.random()*Math.PI*2;
      const phi = Math.acos(2*Math.random()-1);
      const speed = 0.05 + Math.random()*0.09;
      vel[i*3] = Math.sin(phi)*Math.cos(theta)*speed;
      vel[i*3+1] = Math.sin(phi)*Math.sin(theta)*speed;
      vel[i*3+2] = Math.cos(phi)*speed;
      colorArr[i*3]=color.r; colorArr[i*3+1]=color.g; colorArr[i*3+2]=color.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    const mat = new THREE.PointsMaterial({size:0.22, vertexColors:true, transparent:true, opacity:1});
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    fireworkBursts.push({points, vel, life:0, maxLife:70});
  }
}

/* Candle click-to-blow interaction */
const raycaster = new THREE.Raycaster();
const mouseVec = new THREE.Vector2();
canvas.addEventListener('click', (e)=>{
  const cakeSection = document.getElementById('cake');
  const rect = cakeSection.getBoundingClientRect();
  const inCakeView = rect.top < window.innerHeight*0.6 && rect.bottom > window.innerHeight*0.4;
  if(!inCakeView) return;

  mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);
  const flameMeshes = candles.map(c=>c.userData.flame);
  const hits = raycaster.intersectObjects(flameMeshes);
  if(hits.length){
    const flame = hits[0].object;
    const candle = candles.find(c=>c.userData.flame === flame);
    blowOutCandle(candle);
  }
});
function blowOutCandle(candle){
  if(!candle.userData.lit) return;
  candle.userData.lit = false;
  candle.userData.flame.visible = false;
  candle.userData.flameLight.intensity = 0;
  if(candles.every(c=>!c.userData.lit)){
    setTimeout(()=> burstFireworks(5), 200);
  }
}
document.getElementById('relight').addEventListener('click', ()=>{
  candles.forEach(c=>{
    c.userData.lit = true;
    c.userData.flame.visible = true;
    c.userData.flameLight.intensity = 0.6;
  });
});

/* ---------------- Scroll-driven camera ---------------- */
function scrollProgress(){
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

let mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', e=>{
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate(){
  const t = clock.getElapsedTime();
  const p = scrollProgress();

  // camera dollies from z=60 (hero/stars) to z=-14 (fireworks zone)
  const targetZ = 60 - p * 74;
  camera.position.z += (targetZ - camera.position.z) * 0.08;
  camera.position.x += (mouseX*1.4 - (camera.position.x - 0)) * 0.03;
  camera.position.y += (-mouseY*1.0 - camera.position.y) * 0.03;
  camera.lookAt(0, 0, camera.position.z - 20);

  balloons.forEach(b=>{
    b.position.y = b.userData.baseY + Math.sin(t*b.userData.speed + b.userData.phase)*0.6;
    b.position.x = b.userData.baseX + Math.sin(t*0.2 + b.userData.phase)*0.4;
    b.rotation.z = Math.sin(t*0.3 + b.userData.phase)*0.06;
  });

  ring.rotation.z += 0.002;
  ring2.rotation.z -= 0.0026;

  candles.forEach(c=>{
    if(c.userData.lit){
      c.userData.flame.scale.y = 1 + Math.sin(t*14 + c.position.x*3)*0.15;
      c.userData.flame.position.x = Math.sin(t*10 + c.position.x)*0.02;
    }
  });

  stars.rotation.y += 0.0003;

  // update fireworks
  for(let i=fireworkBursts.length-1; i>=0; i--){
    const fw = fireworkBursts[i];
    const posAttr = fw.points.geometry.attributes.position;
    for(let j=0; j<posAttr.count; j++){
      posAttr.array[j*3] += fw.vel[j*3];
      posAttr.array[j*3+1] += fw.vel[j*3+1] - 0.0012; // gravity
      posAttr.array[j*3+2] += fw.vel[j*3+2];
    }
    posAttr.needsUpdate = true;
    fw.life++;
    fw.points.material.opacity = 1 - (fw.life / fw.maxLife);
    if(fw.life >= fw.maxLife){
      scene.remove(fw.points);
      fireworkBursts.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

/* ---------------- Init ---------------- */
(async function init(){
  try {
    const loaded = await API.getContent();
    state = {...state, ...loaded};
  } catch(e){ /* backend not reachable yet — defaults are fine */ }

  bindEditable();
  if(state.targetDate){
    dateInput.value = state.targetDate;
  } else {
    const d = new Date();
    d.setDate(d.getDate()+7);
    d.setHours(19,0,0,0);
    dateInput.value = d.toISOString().slice(0,16);
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);
  renderGallery();

  try {
    const entries = await API.getGuestbook();
    renderGuestbook(entries);
  } catch(e){ /* backend not reachable yet */ }

  animate();
})();
