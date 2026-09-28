/* ============================================================
   RemoveBG Neon Studio · MAIN APP
   ============================================================ */

/* ================= UTILS ================= */
const $ = id => document.getElementById(id);

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const fmtDate = v => {
  if(!v) return '—';
  try{
    const d = new Date(v);
    return d.toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'}) +
           ' · ' +
           d.toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'});
  }catch{ return String(v); }
};

const todayISO = () => {
  const d = new Date(); d.setHours(0,0,0,0); return d.toISOString();
};

const initials = v => {
  const t = String(v || '?').trim();
  return t ? t.split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase() : '?';
};

const wait = ms => new Promise(r => setTimeout(r, ms));

const debounce = (fn, ms = 500) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/* Toast */
const toastEl = $('toast');
function toast(msg, type = ''){
  toastEl.className = 'toast show ' + type;
  toastEl.textContent = msg;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 4200);
}

/* ================= EMAIL VALIDATOR ================= */
const EmailValidator = (() => {
  const RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  const cache = new Map();

  function isValidFormat(email){
    return RE.test(email) && email.length <= 254 && !email.includes('..');
  }

  function isDisposable(email){
    const domain = email.split('@')[1]?.toLowerCase() || '';
    return CONFIG.BLOCK_DISPOSABLE.some(d => domain.includes(d));
  }

  async function hasMX(domain){
    if(cache.has(domain)) return cache.get(domain);
    try{
      const res = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
        { headers: { 'Accept': 'application/dns-json' } }
      );
      const data = await res.json();
      const ok = Array.isArray(data?.Answer) && data.Answer.some(a => a.type === 15);
      cache.set(domain, ok);
      return ok;
    }catch{
      return true; /* لو DNS فشل، نسمح بدل ما نمنع */
    }
  }

  async function validate(email){
    if(!email) return { ok:false, msg:'' };
    if(!isValidFormat(email)) return { ok:false, msg:'صيغة البريد غير صحيحة' };
    if(isDisposable(email)) return { ok:false, msg:'البريد المؤقت غير مسموح' };
    const domain = email.split('@')[1];
    const mx = await hasMX(domain);
    if(!mx) return { ok:false, msg:'نطاق البريد غير صالح' };
    return { ok:true, msg:'' };
  }

  return { validate, isValidFormat, isDisposable };
})();

/* ================= PASSWORD ================= */
const Password = (() => {
  const COMMON = ['password','123456','12345678','qwerty','111111','123456789','abc123','password1','letmein','welcome'];

  function score(pwd){
    const reqs = {
      len: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      num: /\d/.test(pwd),
      sym: /[^a-zA-Z0-9]/.test(pwd)
    };
    const cnt = Object.values(reqs).filter(Boolean).length;
    const common = COMMON.includes(pwd.toLowerCase());
    let lvl = 0;
    if(cnt <= 1 || pwd.length < 6) lvl = 1;
    else if(cnt === 2) lvl = 1;
    else if(cnt === 3) lvl = 2;
    else if(cnt === 4) lvl = 3;
    else if(cnt === 5 && pwd.length >= 10) lvl = 4;
    else lvl = 3;
    if(common || pwd.length < 6) lvl = 1;
    const labels = ['','ضعيفة','متوسطة','قوية','قوية جداً'];
    return { reqs, lvl, label: labels[lvl] };
  }
  return { score };
})();

/* ================= SLIDE CAPTCHA ================= */
class SlideCaptcha {
  constructor(root){
    this.root = root;
    this.track = root.querySelector('.captcha-track');
    this.fill = root.querySelector('.captcha-fill');
    this.handle = root.querySelector('.captcha-handle');
    this.text = root.querySelector('.captcha-text');
    this.state = 'idle';
    this.x = 0;
    this.startX = 0;
    this.maxX = 0;
    this.dragging = false;
    this.bind();
  }
  setState(s){ this.state = s; this.root.dataset.state = s; }
  get done(){ return this.state === 'done'; }

  bind(){
    const start = e => {
      if(this.done) return;
      this.dragging = true;
      this.setState('verifying');
      const pt = e.touches ? e.touches[0] : e;
      this.startX = pt.clientX;
      this.x = this.handle.offsetLeft;
      this.handle.setPointerCapture?.(e.pointerId);
    };
    const move = e => {
      if(!this.dragging || this.done) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - this.startX;
      const rect = this.track.getBoundingClientRect();
      const handleW = this.handle.offsetWidth;
      this.maxX = rect.width - handleW - 8;
      let left = this.x + dx;
      left = Math.max(4, Math.min(this.maxX + 4, left));
      this.handle.style.transform = `translateX(${left - this.x}px)`;
      this.fill.style.width = (left + handleW) + 'px';
      if(left >= this.maxX + 2){
        this.complete();
      }
    };
    const end = () => {
      if(this.done) return;
      this.dragging = false;
      if(this.state === 'verifying'){
        this.reset();
      }
    };
    this.handle.addEventListener('mousedown', start);
    this.handle.addEventListener('touchstart', start, {passive:true});
    document.addEventListener('mousemove', move);
    document.addEventListener('touchmove', move, {passive:true});
    document.addEventListener('mouseup', end);
    document.addEventListener('touchend', end);
  }

  complete(){
    this.dragging = false;
    this.setState('done');
    this.handle.style.transform = `translateX(${this.maxX - this.handle.offsetLeft + 4}px)`;
    this.fill.style.width = '100%';
    this.text.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg> تم التحقق';
    this.onComplete?.();
  }

  reset(){
    this.setState('idle');
    this.handle.style.transform = 'translateX(0)';
    this.fill.style.width = '56px';
  }
}

/* ================= LOADER ================= */
const Loader = (() => {
  const START = performance.now();
  let raf;

  function particles(){
    const c = $('fx');
    if(!c) return;
    const ctx = c.getContext('2d');
    let w, h, parts = [];
    const dpr = Math.min(devicePixelRatio, 2);

    const resize = () => {
      w = c.width = innerWidth * dpr;
      h = c.height = innerHeight * dpr;
      c.style.width = innerWidth + 'px';
      c.style.height = innerHeight + 'px';
    };
    resize();
    addEventListener('resize', resize);

    const count = Math.min(80, Math.floor(innerWidth / 16));
    for(let i=0;i<count;i++){
      parts.push({
        x: Math.random()*w, y: Math.random()*h,
        vx: (Math.random()-.5)*.3*dpr, vy: (Math.random()-.5)*.3*dpr,
        r: (Math.random()*1.6+.6)*dpr,
        a: Math.random()*.6+.3,
        hue: 260 + Math.random()*50
      });
    }

    function loop(){
      ctx.clearRect(0,0,w,h);
      for(let i=0;i<parts.length;i++){
        for(let j=i+1;j<parts.length;j++){
          const dx = parts[i].x - parts[j].x;
          const dy = parts[i].y - parts[j].y;
          const d = Math.hypot(dx,dy);
          if(d < 130*dpr){
            ctx.strokeStyle = `hsla(280,80%,65%,${(1-d/(130*dpr))*.18})`;
            ctx.lineWidth = .7*dpr;
            ctx.beginPath();
            ctx.moveTo(parts[i].x, parts[i].y);
            ctx.lineTo(parts[j].x, parts[j].y);
            ctx.stroke();
          }
        }
      }
      for(const p of parts){
        p.x += p.vx; p.y += p.vy;
        if(p.x<0||p.x>w) p.vx*=-1;
        if(p.y<0||p.y>h) p.vy*=-1;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue},85%,72%,${p.a})`;
        ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    }
    loop();
  }

  async function run(){
    particles();

    const steps = [
      {t:0,    s:'تهيئة النظام...'},
      {t:900,  s:'تحميل محرك المعالجة...'},
      {t:1800, s:'فحص الجلسة...'},
      {t:2700, s:'تجهيز الواجهة...'},
      {t:3600, s:'جاهز ✦'}
    ];
    steps.forEach(st => setTimeout(() => {
      if(!$('loader').classList.contains('hide'))
        $('ldStatus').textContent = st.s;
    }, st.t));

    let p = 0;
    const fill = $('ldFill'), pct = $('ldPct');
    const tick = setInterval(() => {
      p = Math.min(98, p + Math.random()*5 + 2);
      fill.style.width = p + '%';
      pct.textContent = Math.round(p) + '%';
    }, 170);

    const elapsed = performance.now() - START;
    await wait(Math.max(0, CONFIG.LOADER_MIN_MS - elapsed));

    clearInterval(tick);
    fill.style.width = '100%';
    pct.textContent = '100%';
    await wait(350);
    $('loader').classList.add('hide');
    if(raf) cancelAnimationFrame(raf);
    setTimeout(() => $('loader').remove(), 900);
  }

  return { run };
})();

/* ================= API (Supabase) ================= */
const API = (() => {

  async function req(path, opt = {}, token = null){
    const headers = {
      apikey: CONFIG.SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(opt.headers || {})
    };
    if(token) headers.Authorization = `Bearer ${token}`;

    let res;
    try{ res = await fetch(CONFIG.SUPABASE_URL + path, {...opt, headers}); }
    catch{ const e = new Error('فشل الاتصال بالسيرفر.'); e.status = 0; throw e; }

    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; } catch{ data = text; }

    if(!res.ok){
      const msg = data?.message || data?.msg || data?.error_description ||
                  data?.error || data?.hint || `HTTP ${res.status}`;
      const e = new Error(msg);
      e.status = res.status; e.data = data;
      throw e;
    }
    return data;
  }

  const normalize = d => ({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_in: d.expires_in,
    expires_at: Date.now() + (d.expires_in || 3600) * 1000,
    user: d.user || null
  });

  /* Auth */
  const login = async (email, password) =>
    normalize(await req('/auth/v1/token?grant_type=password', {
      method:'POST', body: JSON.stringify({email, password})
    }));

  const signup = async (email, password, username) => {
    const d = await req('/auth/v1/signup', {
      method:'POST',
      body: JSON.stringify({ email, password, data: { username } })
    });
    if(!d?.access_token) return { needsConfirmation:true, user:d?.user||null };
    return normalize(d);
  };

  const refresh = async s => {
    if(!s?.refresh_token) return null;
    try{
      return normalize(await req('/auth/v1/token?grant_type=refresh_token', {
        method:'POST', body: JSON.stringify({ refresh_token: s.refresh_token })
      }));
    }catch{ return null; }
  };

  const getUser = async s => {
    if(!s?.access_token) return null;
    try{ return await req('/auth/v1/user', {method:'GET'}, s.access_token); }
    catch{ return null; }
  };

  const signout = async s => {
    if(!s?.access_token) return;
    try{
      await fetch(CONFIG.SUPABASE_URL + '/auth/v1/logout', {
        method:'POST',
        headers:{ apikey: CONFIG.SUPABASE_KEY, Authorization: `Bearer ${s.access_token}` }
      });
    }catch{}
  };

  const forgotPassword = async email => {
    return req('/auth/v1/recover', {
      method:'POST',
      body: JSON.stringify({ email, gotrue_meta_security:{} })
    });
  };

  /* Profile */
  const getProfile = async (uid, tk) => {
    try{
      const d = await req(`/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}&select=*`, {method:'GET'}, tk);
      return Array.isArray(d) ? d[0] || null : null;
    }catch{ return null; }
  };

  /* Operations */
  const fetchOps = async (tk, uid) => {
    const d = await req(
      `/rest/v1/operations?user_id=eq.${encodeURIComponent(uid)}&deleted_at=is.null&select=*&order=created_at.desc&limit=100`,
      {method:'GET'}, tk
    );
    return Array.isArray(d) ? d : [];
  };

  const countTodayOps = async (tk, uid) => {
    const d = await req(
      `/rest/v1/operations?user_id=eq.${encodeURIComponent(uid)}&created_at=gte.${encodeURIComponent(todayISO())}&select=id`,
      {method:'GET'}, tk
    );
    return Array.isArray(d) ? d.length : 0;
  };

  const saveOp = async (tk, origPath, resPath) => {
    const d = await req('/rest/v1/rpc/create_removebg_operation', {
      method:'POST',
      body: JSON.stringify({ p_original_path: origPath, p_result_path: resPath })
    }, tk);
    return Array.isArray(d) ? d[0] || null : d;
  };

  const deleteOp = async (tk, id) => req('/rest/v1/rpc/soft_delete_operation', {
    method:'POST', body: JSON.stringify({ p_operation_id: id })
  }, tk);

  /* Storage */
  const extractPath = v => {
    if(!v) return null;
    const t = String(v);
    const markers = [
      `/storage/v1/object/public/${CONFIG.BUCKET}/`,
      `/storage/v1/object/${CONFIG.BUCKET}/`
    ];
    for(const m of markers){
      if(t.includes(m)) return t.split(m)[1]?.split('?')[0] || null;
    }
    if(t.startsWith(`${CONFIG.BUCKET}/`)) return t.slice(CONFIG.BUCKET.length+1);
    if(t.startsWith('http://')||t.startsWith('https://')) return null;
    return t.replace(/^\/+/, '').split('?')[0];
  };

  const signedUrl = async (tk, path, sec = CONFIG.SIGNED_URL_SECONDS) => {
    if(!path) return null;
    const clean = String(path).replace(/^\/+/, '').split('?')[0];
    const enc = clean.split('/').map(encodeURIComponent).join('/');
    try{
      const d = await req(`/storage/v1/object/sign/${CONFIG.BUCKET}/${enc}`, {
        method:'POST', body: JSON.stringify({ expiresIn: sec })
      }, tk);
      const u = d?.signedURL || d?.signedUrl || d?.url || d?.signed_url;
      if(!u) return null;
      return u.startsWith('http') ? u : CONFIG.SUPABASE_URL + u;
    }catch{ return null; }
  };

  const publicUrl = path => {
    if(!path) return null;
    const clean = String(path).replace(/^\/+/, '').split('?')[0];
    const enc = clean.split('/').map(encodeURIComponent).join('/');
    return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/${CONFIG.BUCKET}/${enc}`;
  };

  const resolveImg = async (val, tk) => {
    if(!val) return null;
    const path = extractPath(val);
    if(!path) return val;
    const s = await signedUrl(tk, path);
    return s || publicUrl(path);
  };

  const upload = async (tk, uid, blob, folder) => {
    const name = `${uid}/${folder}-${Date.now()}-${Math.random().toString(36).slice(2,9)}.png`;
    const res = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/${CONFIG.BUCKET}/${name}`, {
      method:'POST',
      headers:{
        Authorization: `Bearer ${tk}`,
        apikey: CONFIG.SUPABASE_KEY,
        'Content-Type': 'image/png',
        'x-upsert': 'false',
        'cache-control': '3600'
      },
      body: blob
    });
    if(!res.ok){
      const t = await res.text().catch(()=> '');
      throw new Error(`فشل الرفع (${res.status}) ${t}`);
    }
    return name;
  };

  const removeFiles = async (tk, paths) => {
    const clean = paths.map(extractPath).filter(Boolean);
    if(!clean.length) return;
    try{
      await req(`/storage/v1/object/${CONFIG.BUCKET}`, {
        method:'DELETE', body: JSON.stringify({ prefixes: clean })
      }, tk);
    }catch{}
  };

  /* Matting */
  const removeBg = async file => {
    const fd = new FormData();
    fd.append('format','png');
    fd.append('model','v1');
    fd.append('image', file, file.name || 'image.png');

    const endpoint = CONFIG.MATTE_PROXY || CONFIG.PIXELCUT_DIRECT;
    const headers = {
      Accept:'application/json,text/plain,*/*',
      'x-locale':'en'
    };
    if(!CONFIG.MATTE_PROXY && CONFIG.PIXELCUT_CLIENT_VERSION){
      headers['x-client-version'] = CONFIG.PIXELCUT_CLIENT_VERSION;
    }

    const res = await fetch(endpoint, { method:'POST', headers, body: fd });
    if(!res.ok){
      let err = null; try{ err = await res.json(); }catch{}
      throw new Error(err?.message || `فشل (${res.status})`);
    }

    const ct = res.headers.get('content-type') || '';
    let blob = null, extUrl = null;

    if(ct.includes('image/')) blob = await res.blob();
    else{
      const data = await res.json();
      extUrl = findImg(data);
      if(extUrl){
        const r = await fetch(extUrl);
        if(!r.ok) throw new Error('تعذر تحميل النتيجة');
        blob = await r.blob();
      }
    }
    if(!blob) throw new Error('لا توجد نتيجة');
    return blob;
  };

  const findImg = data => {
    const keys = ['url','image','output','result','image_url','imageUrl','output_url','outputUrl','download_url','downloadUrl'];
    for(const k of keys){ const v = data?.[k]; if(typeof v === 'string' && v.trim()) return v.trim(); }
    for(const k of keys){ const v = data?.data?.[k]; if(typeof v === 'string' && v.trim()) return v.trim(); }
    return null;
  };

  /* Admin */
  const adminUsers = async (tk, search, limit=500) => {
    const d = await req('/rest/v1/rpc/admin_list_profiles', {
      method:'POST',
      body: JSON.stringify({ p_search: search || null, p_limit: limit })
    }, tk);
    return Array.isArray(d) ? d : [];
  };

  const adminOps = async (tk, uid=null) => {
    const d = await req('/rest/v1/rpc/admin_list_operations', {
      method:'POST',
      body: JSON.stringify({ p_user_id: uid, p_limit: uid ? 200 : 100 })
    }, tk);
    return Array.isArray(d) ? d : [];
  };

  const adminUpdate = async (tk, uid, plan, limit, banned) => req('/rest/v1/rpc/admin_update_user', {
    method:'POST',
    body: JSON.stringify({
      p_user_id: uid, p_plan: plan,
      p_daily_limit: Number(limit), p_is_banned: !!banned
    })
  }, tk);

  return {
    login, signup, refresh, getUser, signout, forgotPassword,
    getProfile, fetchOps, countTodayOps, saveOp, deleteOp,
    resolveImg, upload, removeFiles, removeBg,
    adminUsers, adminOps, adminUpdate
  };
})();

/* ================= AUTH ================= */
const Auth = (() => {

  let session = null;
  let profile = null;

  const save = s => {
    session = s;
    if(s) localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(CONFIG.SESSION_KEY);
  };

  const saved = () => {
    try{
      const r = localStorage.getItem(CONFIG.SESSION_KEY);
      return r ? JSON.parse(r) : null;
    }catch{ localStorage.removeItem(CONFIG.SESSION_KEY); return null; }
  };

  async function validSession(){
    const s = session || saved();
    if(!s) return null;
    const exp = s.expires_at || 0;
    if(exp && Date.now() < exp - 60000){ session = s; return s; }
    const r = await API.refresh(s);
    save(r);
    return r;
  }

  async function doLogin(email, password){
    const s = await API.login(email, password);
    if(!s.user) s.user = await API.getUser(s);
    if(!s.user) throw new Error('تعذر التحقق من الحساب');
    save(s);
    profile = await API.getProfile(s.user.id, s.access_token);
    return s;
  }

  async function doSignup(email, password, username){
    const r = await API.signup(email, password, username);
    if(r.needsConfirmation) return r;
    if(!r.user) r.user = await API.getUser(r);
    if(!r.user) throw new Error('تعذر إنشاء الحساب');
    save(r);
    profile = await API.getProfile(r.user.id, r.access_token);
    return r;
  }

  async function doLogout(show = true){
    const s = await validSession();
    await API.signout(s);
    save(null);
    session = null; profile = null;
    App.showAuth();
    if(show) toast('تم تسجيل الخروج');
  }

  return {
    validSession, doLogin, doSignup, doLogout, save,
    get session(){ return session; },
    set session(s){ session = s; },
    get profile(){ return profile; },
    set profile(p){ profile = p; },
    isDev(){ return profile?.role === 'developer'; },
    isPro(){ return profile?.plan === 'pro'; }
  };
})();

/* ================= OAUTH ================= */
const OAuth = (() => {
  const CALLBACK_KEY = 'oauth_in_progress';

  function start(provider){
    sessionStorage.setItem(CALLBACK_KEY, '1');
    const redirect = encodeURIComponent(location.origin + location.pathname);
    location.href = `${CONFIG.SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${redirect}`;
  }

  function handle(){
    const hash = location.hash.substring(1);
    if(!hash) return null;
    const p = new URLSearchParams(hash);
    const at = p.get('access_token');
    const rt = p.get('refresh_token');
    const exp = Number(p.get('expires_in') || 3600);
    const err = p.get('error_description') || p.get('error');

    history.replaceState(null, '', location.pathname + location.search);

    if(err){ toast(decodeURIComponent(err), 'err'); return null; }
    if(!at) return null;

    return {
      access_token: at,
      refresh_token: rt,
      expires_in: exp,
      expires_at: Date.now() + exp * 1000,
      user: null
    };
  }

  function bind(){
    document.querySelectorAll('.oauth-btn').forEach(b => {
      b.addEventListener('click', () => start(b.dataset.p));
      b.addEventListener('mousemove', e => {
        const r = b.getBoundingClientRect();
        b.style.setProperty('--x', (e.clientX - r.left) + 'px');
        b.style.setProperty('--y', (e.clientY - r.top) + 'px');
      });
    });
  }

  return { start, handle, bind };
})();

/* ================= AUTH UI ================= */
const AuthUI = (() => {
  let mode = 'login';
  let captcha;

  const setErr = (input, errEl, msg) => {
    input.classList.toggle('bad', !!msg);
    errEl.textContent = msg;
    errEl.classList.toggle('show', !!msg);
  };
  const clearErr = () => {
    ['username','email','password','confirm'].forEach(k => {
      const i = $(k), e = $('err' + k[0].toUpperCase() + k.slice(1));
      if(i) i.classList.remove('bad','ok');
      if(e){ e.textContent = ''; e.classList.remove('show'); }
    });
  };

  const msg = (txt, type = '') => {
    const m = $('authMsg');
    m.className = 'msg show ' + type;
    m.textContent = txt;
  };
  const clearMsg = () => { $('authMsg').className = 'msg'; $('authMsg').textContent = ''; };

  const setMode = m => {
    mode = m;
    clearErr(); clearMsg();
    const reg = m === 'register';
    $('tabLogin').classList.toggle('active', !reg);
    $('tabRegister').classList.toggle('active', reg);
    document.querySelector('.tabs').dataset.mode = reg ? 'register' : 'login';
    $('fUsername').classList.toggle('hidden', !reg);
    $('fConfirm').classList.toggle('hidden', !reg);
    $('reqs').classList.toggle('hidden', !reg);
    $('fTerms').classList.toggle('hidden', !reg);
    $('strength').classList.toggle('hidden', !reg);
    $('submitBtn').querySelector('.btn-text').textContent = reg ? 'إنشاء حساب' : 'تسجيل الدخول';
    $('password').setAttribute('autocomplete', reg ? 'new-password' : 'current-password');
    checkSubmit();
  };

  const checkSubmit = () => {
    const email = $('email').value.trim();
    const pwd = $('password').value;
    const reg = mode === 'register';
    let ok = captcha?.done && email && pwd.length >= 6;
    if(reg){
      ok = ok && $('username').value.trim().length >= 3;
      ok = ok && $('confirm').value === pwd;
      ok = ok && $('terms').checked;
    }
    $('submitBtn').disabled = !ok;
  };

  const eye = (input, btn) => {
    const v = input.type === 'text';
    input.type = v ? 'password' : 'text';
    btn.style.color = v ? '' : 'var(--p-400)';
  };

  function init(){
    setMode('login');
    OAuth.bind();

    captcha = new SlideCaptcha($('captcha'));
    captcha.onComplete = checkSubmit;

    $('tabLogin').addEventListener('click', () => setMode('login'));
    $('tabRegister').addEventListener('click', () => setMode('register'));
    $('eyePass').addEventListener('click', () => eye($('password'), $('eyePass')));
    $('eyeConfirm').addEventListener('click', () => eye($('confirm'), $('eyeConfirm')));

    /* Email live validation */
    const emailI = $('email');
    const emailHint = $('eHint');
    emailI.addEventListener('input', debounce(async () => {
      const v = emailI.value.trim();
      if(!v){ emailHint.classList.remove('show'); emailI.classList.remove('ok','bad'); return; }
      if(!EmailValidator.isValidFormat(v)){
        emailHint.classList.remove('show');
        emailI.classList.remove('ok');
        return;
      }
      if(EmailValidator.isDisposable(v)){
        setErr(emailI, $('errEmail'), 'البريد المؤقت غير مسموح');
        emailHint.classList.remove('show');
        return;
      }
      emailHint.textContent = '◌'; emailHint.classList.add('show');
      const r = await EmailValidator.validate(v);
      if(r.ok){
        emailI.classList.add('ok'); emailI.classList.remove('bad');
        emailHint.textContent = '✓'; emailHint.style.color = 'var(--ok)';
        $('errEmail').classList.remove('show');
      }else{
        emailHint.classList.remove('show');
        emailI.classList.remove('ok');
      }
    }, 550));
    emailI.addEventListener('input', checkSubmit);

    /* Password strength */
    const pwdI = $('password');
    pwdI.addEventListener('input', () => {
      if(mode !== 'register'){ checkSubmit(); return; }
      const v = pwdI.value;
      const {reqs, lvl, label} = Password.score(v);
      $('strength').classList.remove('hidden');
      document.querySelector('.bars').dataset.lvl = lvl;
      $('strengthTxt').textContent = label;
      document.querySelectorAll('.reqs li').forEach(li => {
        const r = li.dataset.r;
        li.classList.toggle('ok', !!reqs[r]);
      });
      checkSubmit();
    });

    /* Others */
    ['username','confirm'].forEach(k => $(k).addEventListener('input', checkSubmit));
    $('terms').addEventListener('change', checkSubmit);

    /* Forgot password */
    $('forgotBtn').addEventListener('click', async () => {
      const email = $('email').value.trim();
      if(!email || !EmailValidator.isValidFormat(email)){
        msg('أدخل بريدك الإلكتروني أولًا', 'err');
        return;
      }
      try{
        await API.forgotPassword(email);
        msg('تم إرسال رابط إعادة التعيين إلى بريدك ✓', 'ok');
      }catch(e){
        msg(e.message || 'فشل الإرسال', 'err');
      }
    });

    /* Submit */
    $('authForm').addEventListener('submit', async e => {
      e.preventDefault();
      clearErr(); clearMsg();

      const email = $('email').value.trim();
      const pwd = $('password').value;

      if(!EmailValidator.isValidFormat(email)){
        setErr($('email'), $('errEmail'), 'بريد غير صحيح');
        return;
      }
      if(pwd.length < 6){
        setErr($('password'), $('errPassword'), '٦ أحرف على الأقل');
        return;
      }
      if(!captcha.done){
        toast('أكمل التحقق من أنك لست روبوتًا', 'err');
        return;
      }

      if(mode === 'register'){
        const un = $('username').value.trim();
        if(!/^[a-zA-Z0-9_]{3,20}$/.test(un)){
          setErr($('username'), $('errUsername'), 'أحرف وأرقام و _ فقط (3-20)');
          return;
        }
        if($('confirm').value !== pwd){
          setErr($('confirm'), $('errConfirm'), 'كلمتا المرور غير متطابقتين');
          return;
        }
        if(!$('terms').checked){
          toast('يجب الموافقة على الشروط', 'err');
          return;
        }
      }

      const btn = $('submitBtn');
      const txt = btn.querySelector('.btn-text');
      btn.disabled = true;
      const original = txt.textContent;
      txt.textContent = mode === 'login' ? 'جاري الدخول...' : 'جاري الإنشاء...';

      try{
        if(mode === 'login'){
          await Auth.doLogin(email, pwd);
          if(Auth.profile?.is_banned){
            await Auth.doLogout(false);
            msg('هذا الحساب موقوف', 'err');
            return;
          }
          toast(`أهلًا ${Auth.profile?.username || ''} 💜`, 'ok');
          await App.enterApp();
        }else{
          const r = await Auth.doSignup(email, pwd, $('username').value.trim());
          if(r.needsConfirmation){
            msg('تم إنشاء الحساب ✅\nتحقق من بريدك الإلكتروني لتفعيل الحساب.', 'ok');
            captcha.reset();
            checkSubmit();
            return;
          }
          toast('تم إنشاء الحساب 🎉', 'ok');
          await App.enterApp();
        }

        /* Reset */
        ['email','password','username','confirm'].forEach(k => $(k).value = '');
        captcha.reset();
        checkSubmit();
      }catch(err){
        let m = err?.message || 'حدث خطأ';
        const l = m.toLowerCase();
        if(l.includes('invalid login')||l.includes('invalid credentials')) m = 'البريد أو كلمة المرور غير صحيحة';
        else if(l.includes('already registered')||l.includes('duplicate')) m = 'البريد أو الاسم مستخدم';
        else if(l.includes('email not confirmed')) m = 'يجب تأكيد البريد أولًا';
        else if(err?.status === 429) m = 'محاولات كثيرة، حاول لاحقًا';
        else if(err?.status === 0) m = 'فشل الاتصال';
        msg(m, 'err');
        captcha.reset();
        checkSubmit();
      }finally{
        btn.disabled = false;
        txt.textContent = original;
      }
    });
  }

  return { init, checkSubmit };
})();

/* ================= APP ================= */
const App = (() => {

  let selectedFile = null;
  let resultUrl = null;
  let opsCache = [];

  /* Screens */
  const showAuth = () => {
    $('authScreen').classList.remove('hidden');
    $('appScreen').classList.add('hidden');
  };
  const showApp = () => {
    $('authScreen').classList.add('hidden');
    $('appScreen').classList.remove('hidden');
  };

  async function enterApp(){
    AuthUI.checkSubmit();
    /* Set profile */
    if(!Auth.profile && Auth.session?.user){
      Auth.profile = await API.getProfile(Auth.session.user.id, Auth.session.access_token);
    }
    updateAdminVis();
    updatePlanUI();
    showApp();
    switchView('studio');
    await refreshUsage();
  }

  function switchView(name){
    if(name === 'admin' && !Auth.isDev()){
      toast('لا تملك صلاحية', 'err');
      return;
    }
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === name);
    });
    ['studio','history','profile','admin'].forEach(v => {
      const el = $(v + 'View');
      if(el) el.classList.toggle('hidden', v !== name);
    });
    if(name === 'history') refreshHistory();
    if(name === 'profile') refreshProfile();
    if(name === 'admin') Admin.refresh();
    scrollTo({top:0, behavior:'smooth'});
  }

  function updateAdminVis(){
    const d = Auth.isDev();
    $('adminMini').classList.toggle('hidden', !d);
    $('adminNav').classList.toggle('hidden', !d);
  }

  function updatePlanUI(){
    const p = Auth.isPro();
    $('planPill').classList.toggle('pro', p);
    $('planTxt').textContent = p ? 'Pro • ∞' : 'Free • 5/يوم';
    const pr = Auth.profile;
    $('pPlan').textContent = p ? 'Pro — بلا حدود'
      : (pr?.plan === 'custom' ? `Custom — ${pr.daily_limit}` : 'Free — 5/يوم');
  }

  async function refreshUsage(){
    const s = Auth.session;
    if(!s?.user) return;
    try{
      const t = await API.countTodayOps(s.access_token, s.user.id);
      if(Auth.isPro()){ $('statRemain').textContent = '∞'; return; }
      const lim = Number(Auth.profile?.daily_limit ?? CONFIG.DEFAULT_DAILY_LIMIT);
      $('statRemain').textContent = Math.max(0, lim - t);
    }catch{}
  }

  /* History */
  async function refreshHistory(){
    const s = Auth.session;
    if(!s?.user) return;
    const wrap = $('historyContent');
    wrap.innerHTML = `<div class="empty"><div class="empty-icon">⌛</div><h3>جاري التحميل...</h3></div>`;
    try{
      const ops = await API.fetchOps(s.access_token, s.user.id);
      opsCache = ops;
      const today = await API.countTodayOps(s.access_token, s.user.id);
      $('statTotal').textContent = ops.length;
      $('statToday').textContent = today;

      if(!ops.length){
        wrap.innerHTML = `<div class="empty"><div class="empty-icon">◌</div><h3>لا توجد عمليات</h3><p>ابدأ من الاستوديو</p></div>`;
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'history-grid';
      for(const op of ops){
        const c = document.createElement('div');
        c.className = 'hist-card';
        c.innerHTML = `
          <div class="hist-date">${esc(fmtDate(op.created_at))}</div>
          <div class="hist-thumb"><img alt="" loading="lazy"></div>
          <div class="hist-actions">
            <button class="btn-success" data-act="dl" data-id="${esc(op.id)}" type="button">⬇ تحميل</button>
            <button class="btn-danger" data-act="del" data-id="${esc(op.id)}" type="button">🗑 حذف</button>
          </div>
        `;
        grid.appendChild(c);
        const url = await API.resolveImg(op.result_url, s.access_token);
        if(url) c.querySelector('img').src = url;
      }
      wrap.innerHTML = '';
      wrap.appendChild(grid);

      grid.addEventListener('click', async e => {
        const b = e.target.closest('[data-act]');
        if(!b) return;
        const op = opsCache.find(o => String(o.id) === String(b.dataset.id));
        if(!op) return;

        if(b.dataset.act === 'dl'){
          b.disabled = true;
          try{
            const u = await API.resolveImg(op.result_url, s.access_token);
            if(!u) throw new Error('تعذر تجهيز الصورة');
            await downloadUrl(u, `removebg-${String(op.id).slice(0,8)}.png`);
          }catch(err){ toast(err.message, 'err'); }
          finally{ b.disabled = false; }
        }

        if(b.dataset.act === 'del'){
          if(!confirm('حذف هذه العملية؟')) return;
          b.disabled = true; b.textContent = '...';
          try{
            await API.deleteOp(s.access_token, op.id);
            await API.removeFiles(s.access_token, [op.original_url, op.result_url]);
            toast('تم الحذف ✅', 'ok');
            await refreshHistory();
          }catch(err){
            toast(err.message || 'فشل الحذف', 'err');
            b.disabled = false; b.textContent = '🗑 حذف';
          }
        }
      });
    }catch(e){
      wrap.innerHTML = `<div class="empty"><div class="empty-icon">!</div><h3>تعذر التحميل</h3><p>${esc(e.message)}</p></div>`;
    }
  }

  /* Profile */
  async function refreshProfile(){
    const s = Auth.session;
    if(!s?.user) return;
    try{
      if(!Auth.profile) Auth.profile = await API.getProfile(s.user.id, s.access_token);
      const p = Auth.profile;
      const ops = await API.fetchOps(s.access_token, s.user.id);
      const today = await API.countTodayOps(s.access_token, s.user.id);

      const un = p?.username || s.user.user_metadata?.username || s.user.email?.split('@')[0] || '?';
      const em = p?.email || s.user.email || '—';

      $('avatar').textContent = initials(un);
      $('pUsername').textContent = un;
      $('pEmail').textContent = em;
      $('pRole').textContent = Auth.isDev() ? '✦ المطوّر' : '● مستخدم';
      $('pRole').classList.toggle('dev', Auth.isDev());
      $('pJoined').textContent = p?.created_at ? `انضم في ${fmtDate(p.created_at)}` : '';

      $('statOps').textContent = ops.length;
      $('statOpsToday').textContent = today;
      updatePlanUI();

      if(Auth.isPro()) $('statRemain').textContent = '∞';
      else{
        const lim = Number(p?.daily_limit ?? CONFIG.DEFAULT_DAILY_LIMIT);
        $('statRemain').textContent = Math.max(0, lim - today);
      }
      $('pStatus').textContent = p?.is_banned ? 'موقوف' : 'نشط';
    }catch(e){ toast(e.message, 'err'); }
  }

  /* Studio */
  function resetResult(){
    if(resultUrl){ URL.revokeObjectURL(resultUrl); resultUrl = null; }
    $('previewResult').src = '';
    $('previewResult').classList.add('hidden');
    $('downloadBtn').classList.add('hidden');
    $('downloadBtn').dataset.url = '';
  }

  function setFile(file){
    selectedFile = file;
    const prev = $('previewOriginal');
    if(prev.src?.startsWith('blob:')) URL.revokeObjectURL(prev.src);
    prev.src = URL.createObjectURL(file);
    resetResult();
    $('previewArea').classList.remove('hidden');
    $('uploadPanel').classList.add('hidden');
    $('processing').classList.add('hidden');
    $('removeBtn').disabled = false;
    $('changeBtn').disabled = false;
  }

  async function validateFile(f){
    if(!f) return {ok:false, msg:'اختر صورة'};
    const allowed = ['image/png','image/jpeg','image/webp'];
    if(!allowed.includes(f.type)) return {ok:false, msg:'صيغة غير مدعومة'};
    if(f.size > CONFIG.MAX_FILE_MB * 1024 * 1024) return {ok:false, msg:`الحجم > ${CONFIG.MAX_FILE_MB}MB`};
    return {ok:true};
  }

  async function handleFile(f){
    const v = await validateFile(f);
    if(!v.ok) return toast(v.msg, 'err');
    setFile(f);
  }

  async function doRemove(){
    if(!selectedFile) return toast('اختر صورة أولًا', 'err');
    const s = await Auth.validSession();
    if(!s?.access_token || !s?.user?.id){
      toast('انتهت الجلسة', 'err');
      showAuth();
      return;
    }
    Auth.session = s;
    if(!Auth.profile) Auth.profile = await API.getProfile(s.user.id, s.access_token);
    if(Auth.profile?.is_banned) return toast('الحساب موقوف', 'err');

    if(!Auth.isPro()){
      const today = await API.countTodayOps(s.access_token, s.user.id).catch(()=>0);
      const lim = Number(Auth.profile?.daily_limit ?? CONFIG.DEFAULT_DAILY_LIMIT);
      if(lim > 0 && today >= lim){
        return toast(`وصلت للحد اليومي (${lim})`, 'err');
      }
    }

    const btn = $('removeBtn');
    btn.disabled = true;
    $('processing').classList.remove('hidden');
    resetResult();

    try{
      const orig = await API.upload(s.access_token, s.user.id, selectedFile, 'orig');
      const blob = await API.removeBg(selectedFile);
      const res = await API.upload(s.access_token, s.user.id, blob, 'res');
      await API.saveOp(s.access_token, orig, res);

      resultUrl = URL.createObjectURL(blob);
      $('previewResult').src = resultUrl;
      $('previewResult').classList.remove('hidden');

      const perm = await API.resolveImg(res, s.access_token);
      $('downloadBtn').dataset.url = perm || '';
      $('downloadBtn').classList.remove('hidden');

      toast('تمت إزالة الخلفية ✅', 'ok');
      await refreshUsage();
    }catch(e){
      console.error(e);
      toast(e.message || 'حدث خطأ', 'err');
    }finally{
      $('processing').classList.add('hidden');
      btn.disabled = false;
    }
  }

  async function downloadUrl(url, name){
    try{
      const r = await fetch(url, {mode:'cors'});
      if(!r.ok) throw 0;
      const blob = await r.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 2500);
    }catch{
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      document.body.appendChild(a); a.click(); a.remove();
    }
  }

  /* Bind UI */
  function bindUI(){
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.addEventListener('click', () => switchView(b.dataset.view));
    });
    $('adminMini').addEventListener('click', () => switchView('admin'));

    $('historyRefresh').addEventListener('click', async e => {
      e.currentTarget.disabled = true;
      try{ await refreshHistory(); } finally{ e.currentTarget.disabled = false; }
    });

    $('refreshProfile').addEventListener('click', async e => {
      e.currentTarget.disabled = true;
      try{
        Auth.profile = await API.getProfile(Auth.session.user.id, Auth.session.access_token);
        updateAdminVis();
        await refreshProfile();
        await refreshUsage();
        toast('تم التحديث ✅', 'ok');
      } finally{ e.currentTarget.disabled = false; }
    });

    $('logoutBtn').addEventListener('click', () => Auth.doLogout(true));

    $('chooseBtn').addEventListener('click', e => { e.stopPropagation(); $('fileInput').click(); });
    $('uploadPanel').addEventListener('click', () => $('fileInput').click());
    $('changeBtn').addEventListener('click', () => $('fileInput').click());

    $('fileInput').addEventListener('change', () => {
      const f = $('fileInput').files?.[0];
      $('fileInput').value = '';
      if(f) handleFile(f);
    });

    ['dragenter','dragover'].forEach(n => $('uploadPanel').addEventListener(n, e => {
      e.preventDefault(); $('uploadPanel').classList.add('drag');
    }));
    ['dragleave','drop'].forEach(n => $('uploadPanel').addEventListener(n, e => {
      e.preventDefault(); $('uploadPanel').classList.remove('drag');
    }));
    $('uploadPanel').addEventListener('drop', e => {
      const f = e.dataTransfer?.files?.[0];
      if(f) handleFile(f);
    });

    $('removeBtn').addEventListener('click', doRemove);

    $('downloadBtn').addEventListener('click', async () => {
      const u = $('downloadBtn').dataset.url || $('previewResult').src;
      if(!u) return toast('لا نتيجة', 'err');
      $('downloadBtn').disabled = true;
      try{ await downloadUrl(u, `removebg-${Date.now()}.png`); }
      finally{ $('downloadBtn').disabled = false; }
    });
  }

  return { showAuth, showApp, enterApp, switchView, bindUI, downloadUrl };
})();

/* ================= ADMIN ================= */
const Admin = (() => {
  let usersCache = [];
  let opsCache = [];

  async function refresh(){
    if(!Auth.isDev()) return;
    const list = $('usersList');
    list.innerHTML = `<div class="empty"><div class="empty-icon">⌛</div><h3>جاري التحميل...</h3></div>`;
    try{
      const tk = Auth.session.access_token;
      const search = $('adminSearch').value.trim() || null;
      const [users, ops] = await Promise.all([
        API.adminUsers(tk, search),
        API.adminOps(tk)
      ]);
      usersCache = users;
      opsCache = ops;

      const today = new Date(); today.setHours(0,0,0,0);
      const to = opsCache.filter(o => new Date(o.created_at) >= today);
      const act = new Set(to.map(o => o.user_id));

      $('mUsers').textContent = usersCache.length;
      $('mOps').textContent = opsCache.length;
      $('mToday').textContent = to.length;
      $('mActive').textContent = act.size;

      renderUsers();
      await renderOps();
    }catch(e){
      list.innerHTML = `<div class="empty"><div class="empty-icon">!</div><h3>تعذر التحميل</h3><p>${esc(e.message)}</p></div>`;
    }
  }

  function renderUsers(){
    const q = $('adminSearch').value.trim().toLowerCase();
    const list = usersCache.filter(p => !q ||
      [p.username, p.email, p.id].join(' ').toLowerCase().includes(q)
    );
    $('usersLabel').textContent = `${list.length} حساب`;
    const wrap = $('usersList');
    wrap.innerHTML = '';
    if(!list.length){
      wrap.innerHTML = `<div class="empty"><div class="empty-icon">⌕</div><h3>لا نتائج</h3></div>`;
      return;
    }
    list.forEach(p => {
      const r = document.createElement('div');
      r.className = 'user-row';
      const st = p.is_banned ? 'موقوف' : (p.plan === 'pro' ? 'Pro' : (p.plan === 'custom' ? 'Custom' : 'Free'));
      const sc = p.is_banned ? 'banned' : (p.plan === 'pro' ? 'pro' : '');
      r.innerHTML = `
        <div class="user-avatar">${esc(initials(p.username || p.email || '?'))}</div>
        <div class="user-main">
          <strong>${esc(p.username || 'بدون اسم')}</strong>
          <span>${esc(p.email || p.id || '—')}</span>
          <div class="user-state ${sc}">${esc(st)}</div>
        </div>
        <div class="user-meta">
          <strong>${esc(p.operations_count || 0)}</strong>
          <small>اليوم ${esc(p.today_operations || 0)}</small>
        </div>
        <button class="manage-btn" type="button">إدارة</button>
      `;
      r.querySelector('.manage-btn').addEventListener('click', () => openUser(p));
      wrap.appendChild(r);
    });
  }

  async function renderOps(){
    const wrap = $('opsList');
    wrap.innerHTML = '';
    if(!opsCache.length){
      wrap.innerHTML = `<div class="empty"><div class="empty-icon">◌</div><h3>لا عمليات</h3></div>`;
      return;
    }
    const map = new Map(usersCache.map(p => [String(p.id), p]));
    for(const op of opsCache){
      const c = document.createElement('div');
      c.className = 'op-card';
      c.innerHTML = `
        <div class="op-thumb"><img alt="" loading="lazy"></div>
        <div class="op-body">
          <strong>—</strong>
          <span>${esc(fmtDate(op.created_at))}</span>
        </div>
      `;
      const p = map.get(String(op.user_id));
      c.querySelector('strong').textContent = p?.username || p?.email || 'مستخدم';
      wrap.appendChild(c);
      const u = await API.resolveImg(op.result_url, Auth.session.access_token);
      if(u) c.querySelector('img').src = u;
    }
  }

  async function openUser(profile){
    const ops = await API.adminOps(Auth.session.access_token, profile.id);
    const curLim = Number(profile.daily_limit ?? CONFIG.DEFAULT_DAILY_LIMIT);

    $('modalTitle').textContent = 'إدارة الحساب';
    $('modalBody').innerHTML = `
      <div class="summary">
        <div class="summary-av">${esc(initials(profile.username || profile.email || '?'))}</div>
        <div>
          <div class="summary-name">${esc(profile.username || 'بدون اسم')}</div>
          <div class="summary-email">${esc(profile.email || '—')}</div>
          <div class="summary-pills">
            <div class="summary-pill">${esc(profile.plan || 'free')}</div>
            <div class="summary-pill">${esc(profile.operations_count || 0)} عملية</div>
            <div class="summary-pill">اليوم ${esc(profile.today_operations || 0)}</div>
          </div>
        </div>
      </div>
      <div class="mg-grid">
        <div class="mg-box">
          <label>الخطة</label>
          <select id="aPlan" class="plan-select">
            <option value="free" ${profile.plan==='free'?'selected':''}>Free</option>
            <option value="pro" ${profile.plan==='pro'?'selected':''}>Pro — بلا حدود</option>
            <option value="custom" ${profile.plan==='custom'?'selected':''}>Custom</option>
          </select>
        </div>
        <div class="mg-box">
          <label>الحد اليومي</label>
          <input id="aLimit" class="limit-input" type="number" min="0" value="${curLim}">
        </div>
      </div>
      <div class="ban-row">
        <span>إيقاف الحساب</span>
        <button id="aBan" class="switch ${profile.is_banned?'active':''}" type="button"></button>
      </div>
      <div class="modal-actions">
        <button id="aSave" class="btn-primary small" type="button"><span class="btn-text">حفظ</span></button>
        <button id="aClose" class="btn-ghost" type="button">إغلاق</button>
      </div>
      <div class="modal-section-title">عمليات <span class="grad-text">المستخدم</span></div>
      <div id="aOps" class="ops-grid"></div>
    `;
    $('modal').classList.add('show');

    const ban = $('aBan');
    let banned = !!profile.is_banned;
    ban.addEventListener('click', () => {
      banned = !banned;
      ban.classList.toggle('active', banned);
    });

    const plan = $('aPlan');
    const lim = $('aLimit');
    plan.addEventListener('change', () => {
      if(plan.value === 'pro') lim.value = 0;
      else if(plan.value === 'free') lim.value = 5;
    });

    $('aClose').addEventListener('click', closeModal);
    $('aSave').addEventListener('click', async e => {
      const b = e.currentTarget;
      b.disabled = true;
      try{
        let l = Number(lim.value);
        if(!Number.isFinite(l) || l < 0) throw new Error('الحد غير صحيح');
        if(plan.value === 'free') l = 5;
        if(plan.value === 'pro') l = 0;
        await API.adminUpdate(Auth.session.access_token, profile.id, plan.value, l, banned);
        toast('تم التحديث ✅', 'ok');
        await refresh();
      }catch(err){ toast(err.message, 'err'); }
      finally{ b.disabled = false; }
    });

    const aw = $('aOps');
    if(!ops.length){
      aw.innerHTML = `<div class="empty"><div class="empty-icon">◌</div><h3>لا عمليات</h3></div>`;
    }else{
      for(const op of ops.slice(0,20)){
        const c = document.createElement('div');
        c.className = 'op-card';
        c.innerHTML = `
          <div class="op-thumb"><img alt="" loading="lazy"></div>
          <div class="op-body">
            <strong>${esc(fmtDate(op.created_at))}</strong>
            <span>RemoveBG</span>
          </div>
        `;
        aw.appendChild(c);
        const u = await API.resolveImg(op.result_url, Auth.session.access_token);
        if(u) c.querySelector('img').src = u;
      }
    }
  }

  function closeModal(){ $('modal').classList.remove('show'); }

  function init(){
    $('modalClose').addEventListener('click', closeModal);
    $('modal').addEventListener('click', e => {
      if(e.target === $('modal')) closeModal();
    });
    $('adminSearch').addEventListener('input', renderUsers);
    $('adminRefresh').addEventListener('click', async e => {
      e.currentTarget.disabled = true;
      try{ await refresh(); toast('تم التحديث ✅', 'ok'); }
      finally{ e.currentTarget.disabled = false; }
    });
    $('adminBack').addEventListener('click', () => App.switchView('studio'));
  }

  return { init, refresh };
})();

/* ================= BOOTSTRAP ================= */
(async function boot(){
  AuthUI.init();
  App.bindUI();
  Admin.init();

  /* Handle OAuth callback before loader finishes */
  const oauthSess = OAuth.handle();
  if(oauthSess) Auth.save(oauthSess);

  /* Check existing session */
  let session = await Auth.validSession();
  let profile = null;
  let user = null;

  if(session){
    user = await API.getUser(session);
    if(user){
      session.user = user;
      Auth.save(session);
      profile = await API.getProfile(user.id, session.access_token);
  
