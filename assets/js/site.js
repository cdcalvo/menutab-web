// menutab — interacción mínima: cabecera, demo en vivo, calculadora de equipos y formulario.
(() => {
  const hdr = document.querySelector('[data-hdr]');
  const onScroll = () => hdr && hdr.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Demo en vivo: el iframe mide 800×1280 (la tablet real) y se escala al hueco de la pantalla
  document.querySelectorAll('.tablet__live').forEach((frame) => {
    const screen = frame.parentElement;
    const fit = () => frame.style.setProperty('--scale', screen.clientWidth / 800);
    fit();
    new ResizeObserver(fit).observe(screen);
    frame.addEventListener('load', () => frame.classList.add('is-ready'));
  });

  // Calculadora: tablets + 1 estación de carga por cada 10
  const calc = document.querySelector('[data-calc]');
  if (calc) {
    const input = calc.querySelector('[data-calc-input]');
    const n = calc.querySelector('[data-calc-n]');
    const total = calc.querySelector('[data-calc-total]');
    const tablet = +calc.dataset.tablet, charger = +calc.dataset.charger;
    const update = () => {
      const k = +input.value;
      n.textContent = k;
      total.textContent = '$' + (k * tablet + Math.ceil(k / 10) * charger).toLocaleString('en-US');
    };
    input.addEventListener('input', update);
    update();
  }

  // Formulario: se envía a contact.php sin recargar la página
  const form = document.querySelector('[data-form]');
  if (form) {
    const msg = form.querySelector('[data-form-msg]');
    const btn = form.querySelector('button[type=submit]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = form.dataset.sending;
      msg.className = 'form__note';
      try {
        // En local (sin PHP) se simula el envío para poder revisar el diseño
        const local = ['localhost', '127.0.0.1'].includes(location.hostname) || 'preview' in document.documentElement.dataset;
        if (!local) {
          const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(res.status);
        } else {
          await new Promise((r) => setTimeout(r, 700));
        }
        form.reset();
        msg.textContent = form.dataset.ok;
        msg.classList.add('is-ok');
      } catch {
        msg.textContent = `${form.dataset.error} ${form.dataset.email}`;
        msg.classList.add('is-err');
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  }

  // ───────── Configurador de compra ─────────
  const co = document.querySelector('[data-checkout]');
  if (co) {
    const prices = JSON.parse(co.dataset.prices);
    const plans = JSON.parse(co.dataset.plans);
    const L = JSON.parse(co.dataset.labels);
    const $ = (s) => document.querySelector(s);
    const money = (n) => '$' + n.toLocaleString('en-US');
    const qty = (k) => co.querySelector(`[name=${k}]`);
    const eqs = co.querySelector('[data-eqs]');
    const terms = $('[data-terms]');
    const err = $('[data-err]');
    const local = ['localhost', '127.0.0.1'].includes(location.hostname) || 'preview' in document.documentElement.dataset;
    let chargerTouched = false;

    // Lo elegido se recuerda mientras la pestaña siga abierta: al cambiar de idioma, al volver con
    // «atrás» desde Stripe o al recargar. Sin la casilla de los Términos (se vuelve a marcar).
    // Se borra en la página de gracias.
    const SAVE = 'menutab-checkout';
    const FIELDS = ['restaurant', 'name', 'email', 'phone'];
    const pick = (name, value) => { const r = co.querySelector(`[name=${name}][value="${value}"]`); if (r) r.checked = true; };
    try {
      const s = JSON.parse(sessionStorage.getItem(SAVE) || 'null');
      if (s) {
        if (plans[s.plan]) pick('plan', s.plan);
        pick('hardware', s.ship ? 'ship' : 'own');
        for (const k of ['tablet', 'charger', 'cable']) if (s[k] !== undefined) qty(k).value = Math.max(0, Math.min(200, parseInt(s[k], 10) || 0));
        chargerTouched = !!s.chargerTouched;
        for (const k of FIELDS) if (typeof s[k] === 'string') co.elements[k].value = s[k];
      }
    } catch {}
    const save = () => {
      try {
        sessionStorage.setItem(SAVE, JSON.stringify({
          plan: co.querySelector('[name=plan]:checked').value,
          ship: co.querySelector('[name=hardware]:checked').value === 'ship',
          tablet: qty('tablet').value, charger: qty('charger').value, cable: qty('cable').value, chargerTouched,
          ...Object.fromEntries(FIELDS.map((k) => [k, co.elements[k].value])),
        }));
      } catch {}
    };

    // ?plan=managed desde los botones de precios de la portada: manda sobre lo recordado
    const wanted = new URLSearchParams(location.search).get('plan');
    if (wanted && plans[wanted]) pick('plan', wanted);

    const order = () => {
      const plan = co.querySelector('[name=plan]:checked').value;
      const ship = co.querySelector('[name=hardware]:checked').value === 'ship';
      const n = (k) => (ship ? Math.max(0, Math.min(200, parseInt(qty(k).value, 10) || 0)) : 0);
      return { plan, ship, tablet: n('tablet'), charger: n('charger'), cable: n('cable') };
    };

    const render = () => {
      const o = order();
      eqs.hidden = !o.ship;
      const lines = [[`${plans[o.plan]} ${L.plan}<small>${L.setup}</small>`, prices[o.plan]]];
      for (const k of ['tablet', 'charger', 'cable']) if (o[k]) lines.push([`${L.items[k]} × ${o[k]}`, o[k] * prices[k]]);
      $('[data-sum-lines]').innerHTML = lines.map(([l, v]) => `<li><span>${l}</span><b>${money(v)}</b></li>`).join('');
      $('[data-sum-today]').textContent = money(lines.reduce((a, [, v]) => a + v, 0));
      $('[data-sum-month]').textContent = money(prices[o.plan]);
    };

    co.addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]');
      if (!b) return;
      const input = b.parentElement.querySelector('input');
      input.value = Math.max(0, Math.min(200, (parseInt(input.value, 10) || 0) + +b.dataset.step));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    co.addEventListener('input', (e) => {
      if (e.target.name === 'charger') chargerTouched = true;
      // Una estación por cada 10 tablets, mientras el cliente no la haya cambiado a mano
      if (e.target.name === 'tablet' && !chargerTouched) qty('charger').value = Math.ceil((parseInt(qty('tablet').value, 10) || 0) / 10);
      e.target.classList.remove('is-bad');
      render();
      save();
    });
    co.addEventListener('change', () => { render(); save(); });
    terms.addEventListener('change', () => terms.closest('label').classList.remove('is-bad'));
    if (local) $('[data-demo]').hidden = false;
    render();

    $('[data-pay]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      err.hidden = true;
      const bad = [...co.querySelectorAll('input[required]')].filter((i) => !i.checkValidity());
      bad.forEach((i) => i.classList.add('is-bad'));
      if (!terms.checked) terms.closest('label').classList.add('is-bad');
      if (bad.length) { bad[0].focus(); bad[0].scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      if (!terms.checked) return;

      const fd = new FormData(co);
      const body = { ...order(), lang: document.documentElement.lang, restaurant: fd.get('restaurant'), name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone') };
      sessionStorage.setItem('menutab-order', JSON.stringify({ ...body, today: $('[data-sum-today]').textContent, month: $('[data-sum-month]').textContent, planName: plans[body.plan] }));
      btn.disabled = true;
      try {
        if (local) {
          // Vista previa sin Stripe: se salta directo a la página de gracias
          await new Promise((r) => setTimeout(r, 700));
          location.href = co.dataset.thanks + '?preview=1';
          return;
        }
        const res = await fetch(co.dataset.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || res.status);
        location.href = data.url;
      } catch {
        err.textContent = document.documentElement.lang === 'es' ? 'No pudimos abrir el pago. Inténtalo de nuevo o escríbenos.' : 'We couldn’t open the payment page. Please try again or contact us.';
        err.hidden = false;
        btn.disabled = false;
      }
    });
  }

  // ───────── Gracias: resumen del pedido ─────────
  const tyOrder = document.querySelector('[data-ty-order]');
  if (tyOrder) {
    try {
      const o = JSON.parse(sessionStorage.getItem('menutab-order') || 'null');
      if (o) {
        const es = document.documentElement.lang === 'es';
        tyOrder.innerHTML = `<span><b>${o.restaurant.replace(/</g, '&lt;')}</b></span><span>${o.planName}</span><span>${es ? 'Pagado hoy' : 'Paid today'}: <b>${o.today}</b></span><span>${es ? 'Luego' : 'Then'} <b>${o.month}</b>${es ? '/mes' : '/month'}</span>`;
        tyOrder.hidden = false;
        // Sin equipos (tiene sus tablets): el último paso es la instalación, no la entrega
        if (!o.ship || !(o.tablet + o.charger + o.cable)) {
          document.querySelector('[data-ty-ship]')?.setAttribute('hidden', '');
          document.querySelector('[data-ty-own]')?.removeAttribute('hidden');
        }
      }
    } catch {}
  }
  // ───────── Pedido: lista de piezas (gracias y «Mi pedido») y «Mi pedido» ─────────
  // El enlace de acceso (token) lo da api/order.php; se guarda en este navegador por comodidad.
  const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname) || 'preview' in document.documentElement.dataset;
  const ES = document.documentElement.lang === 'es';
  const access = {
    get: () => { try { return localStorage.getItem('menutab-access') || ''; } catch { return ''; } },
    set: (v) => { try { v ? localStorage.setItem('menutab-access', v) : localStorage.removeItem('menutab-access'); } catch {} },
  };
  const post = async (url, body) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ lang: ES ? 'es' : 'en', ...body }) });
    let d = {};
    try { d = await r.json(); } catch {}
    return { ...d, status: r.status };
  };
  const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const size = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Lista de piezas: una subida por pieza (menú, logo, platos, estilo), cada una con sus archivos y su ✓
  function needList(root, opts) {
    const M = JSON.parse(root.dataset.msg);
    const OK_EXT = /\.(pdf|jpe?g|png|hei[cf]|webp|gif|xlsx?|csv|docx?|txt)$/i;
    const MAX = 20 * 1024 * 1024;
    const msg = root.querySelector('[data-need-msg]');
    const pieces = [...root.querySelectorAll('[data-kind]')];
    let files = { menu: [], logo: [], dishes: [], style: [], ...(opts.files || {}) };
    let noLogo = !!opts.noLogo;
    let wasComplete = null;
    const say = (text, cls) => { msg.textContent = text; msg.className = 'need__msg ' + cls; msg.hidden = false; };

    const paint = () => {
      pieces.forEach((p) => {
        const k = p.dataset.kind;
        const list = p.querySelector('[data-files]');
        list.querySelectorAll('li.is-ok').forEach((li) => li.remove());
        list.insertAdjacentHTML('afterbegin', files[k].map((f) => `<li class="is-ok"><span>${escH(f.name)}</span><span>${size(f.size)}</span></li>`).join(''));
        p.classList.toggle('is-ok', files[k].length > 0 || (k === 'logo' && noLogo));
        p.querySelector('[data-add-label]').textContent = files[k].length ? M.addMore : M.add;
        const nl = p.querySelector('[data-no-logo]');
        if (nl) { nl.checked = noLogo; nl.closest('label').hidden = files.logo.length > 0; }
      });
      const complete = !!(files.menu.length && (files.logo.length || noLogo));
      root.classList.toggle('is-complete', complete);
      if (complete && wasComplete === false) say(M.complete, 'is-ok');
      wasComplete = complete;
      opts.onChange?.({ complete });
    };

    const send = (fd, onProgress) => new Promise((resolve, reject) => {
      // XMLHttpRequest y no fetch: fetch no informa del progreso de subida
      const x = new XMLHttpRequest();
      x.open('POST', root.dataset.upload);
      x.setRequestHeader('Accept', 'application/json');
      if (onProgress) x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      x.onload = () => { let d = {}; try { d = JSON.parse(x.responseText); } catch {} x.status === 200 ? resolve(d) : reject(new Error(x.status)); };
      x.onerror = () => reject(new Error('network'));
      x.send(fd);
    });
    const form = (action) => { const fd = new FormData(); fd.append('token', opts.token()); fd.append('action', action); return fd; };

    async function upload(k, picked, list) {
      msg.hidden = true;
      let failed = 0, sent = 0;
      for (const f of picked) {
        const bad = !OK_EXT.test(f.name) ? M.badType : f.size > MAX ? M.tooBig : '';
        const li = document.createElement('li');
        li.className = bad ? 'is-bad' : 'is-up';
        li.innerHTML = `<span>${escH(f.name)}</span><span data-st>${bad || M.sending + ' 0%'}</span>`;
        list.append(li);
        if (bad) { failed++; continue; }
        const st = li.querySelector('[data-st]');
        try {
          if (opts.ready) await opts.ready;
          if (opts.demo) { for (let p = 0; p <= 1; p += 0.25) { st.textContent = `${M.sending} ${Math.round(p * 100)}%`; await wait(120); } }
          else {
            const fd = form('file');
            fd.append('kind', k);
            fd.append('file', f);
            await send(fd, (p) => (st.textContent = `${M.sending} ${Math.round(p * 100)}%`));
          }
          li.remove();
          files[k] = [...files[k], { name: f.name, size: f.size }];
          sent++;
          paint();
        } catch {
          failed++;
          li.className = 'is-bad';
          st.textContent = '!';
        }
      }
      // Fin de la tanda: nos avisa por correo y devuelve la lista real del servidor
      if (sent && !opts.demo) {
        try { const d = await send(form('done')); if (d.files) { files = { ...files, ...d.files }; paint(); } } catch {}
      }
      if (failed) say(`${M.error} ${root.dataset.email}`, 'is-err');
    }

    let queue = Promise.resolve();
    pieces.forEach((p) => {
      const k = p.dataset.kind;
      const input = p.querySelector('[data-input]');
      const list = p.querySelector('[data-files]');
      input.addEventListener('change', () => {
        const picked = [...input.files];
        input.value = '';
        list.querySelectorAll('li.is-bad').forEach((li) => li.remove());
        if (picked.length) queue = queue.then(() => upload(k, picked, list));
      });
      const nl = p.querySelector('[data-no-logo]');
      if (nl) nl.addEventListener('change', () => {
        noLogo = nl.checked;
        paint();
        if (!opts.demo) post(root.dataset.api, { action: 'logo', token: opts.token(), no_logo: noLogo }).catch(() => {});
      });
    });
    root.hidden = false;
    paint();
    // Para repintar con datos nuevos del servidor (sin volver a montar los oyentes)
    return { set(f, nl) { files = { menu: [], logo: [], dishes: [], style: [], ...(f || {}) }; noLogo = !!nl; wasComplete = null; paint(); } };
  }

  // Gracias: con el session_id de Stripe se abre el pedido recién pagado
  const tyNeed = document.querySelector('.ty [data-need]');
  if (tyNeed) try { sessionStorage.removeItem('menutab-checkout'); } catch {}
  if (tyNeed) {
    const sid = new URLSearchParams(location.search).get('session_id') || '';
    const link = document.querySelector('[data-ty-order-link]');
    const none = () => { tyNeed.hidden = true; document.querySelector('[data-ty-noorder]').hidden = false; };
    // La lista se pinta ya (sin esperar al servidor, para que la página no salte); las subidas
    // esperan a que el pedido esté confirmado
    let token = '';
    if (LOCAL) needList(tyNeed, { token: () => token, demo: true });
    else if (sid) {
      const ready = post(tyNeed.dataset.api, { action: 'session', session_id: sid }).then((d) => {
        if (!d.token) throw new Error(d.status);
        token = d.token;
        access.set(token);
        link.href = link.pathname + '?t=' + encodeURIComponent(token);
      });
      ready.catch(none);
      needList(tyNeed, { token: () => token, ready });
    } else none();
  }

  // «Mi pedido»
  const od = document.querySelector('[data-order]');
  if (od) {
    const T = JSON.parse(od.dataset.texts);
    const $o = (s) => od.querySelector(s);
    const API = od.dataset.api;
    const STAGES = ['paid', 'received', 'proposals', 'changes', 'preparing', 'shipped', 'live'];
    const q = new URLSearchParams(location.search);
    let token = q.get('t') || access.get();
    // El enlace de acceso no se queda a la vista en la barra de direcciones
    if (q.has('t')) history.replaceState(null, '', location.pathname);

    // Último pedido visto en esta pestaña: al cambiar de idioma o volver de Stripe se pinta al
    // instante (sin esqueleto ni saltos) y se actualiza en cuanto responde el servidor
    const CACHE = 'menutab-order-cache';
    const subOf = (t) => (t || '').split('.')[0];
    const cache = {
      get: () => { try { const c = JSON.parse(sessionStorage.getItem(CACHE) || 'null'); return c && c.sub === subOf(token) ? c.order : null; } catch { return null; } },
      set: (o) => { try { o ? sessionStorage.setItem(CACHE, JSON.stringify({ sub: subOf(token), order: o })) : sessionStorage.removeItem(CACHE); } catch {} },
    };

    const show = (which) => ['loading', 'login', 'view'].forEach((w) => ($o(`[data-${w}]`).hidden = w !== which));
    const login = (note, cls = '') => {
      show('login');
      const n = $o('[data-login-note]');
      n.hidden = !note;
      n.textContent = note || '';
      n.className = 'od__notice ' + cls;
    };

    let o = null;     // pedido pintado
    let need = null;  // lista de piezas (se crea una vez y luego solo se actualiza)
    let demo = false;

    const paintStage = () => {
      const r = o.round || 1;
      const own = o.hardware === 'own';
      const keys = STAGES.filter((k) => k !== 'shipped' || !own || o.stage === 'shipped');
      const now = Math.max(0, keys.indexOf(o.stage));
      const st = (k) => (own && T.stagesOwn[k]) || T.stages[k];
      const title = (k) => st(k)[0] + (k === 'changes' && o.stage === 'changes' ? ` · ${T.roundLabel.replace('{r}', r)}` : '');
      $o('[data-o-steps]').innerHTML = keys.map((k, i) => `<li class="${i < now ? 'is-done' : i === now ? 'is-now' : ''}"${i === now ? ' aria-current="step"' : ''}><span class="steps__dot"></span>${escH(title(k))}</li>`).join('');
      $o('[data-o-now-title]').textContent = title(o.stage);
      $o('[data-o-now-text]').textContent = st(o.stage)[1].replace('{r}', r);
      // Fecha estimada: la ponemos a mano en cada pedido (AAAA-MM-DD); sin fecha no se muestra
      const etaKey = o.stage === 'preparing' && own ? 'preparingOwn' : o.stage;
      const eta = $o('[data-o-eta]');
      const [y, m, d] = (o.eta || '').split('-').map(Number);
      eta.hidden = !(y && T.eta[etaKey]);
      if (!eta.hidden) eta.textContent = T.eta[etaKey].replace('{d}', new Date(y, m - 1, d).toLocaleDateString(ES ? 'es' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }));
      const prop = $o('[data-o-proposals]');
      prop.hidden = !(o.proposal_url && ['proposals', 'changes'].includes(o.stage));
      if (!prop.hidden) prop.href = o.proposal_url;
      const tr = $o('[data-o-tracking]');
      tr.hidden = !(o.tracking && ['shipped', 'live'].includes(o.stage));
      if (!tr.hidden) {
        const span = tr.querySelector('span');
        span.innerHTML = /^https:\/\//.test(o.tracking) ? `<a href="${escH(o.tracking)}" target="_blank" rel="noopener">${escH(o.tracking)}</a>` : escH(o.tracking);
      }
    };

    // Pinta (o repinta) el pedido; los oyentes y la lista de piezas se montan solo la primera vez
    const render = (order) => {
      o = order;
      $o('[data-o-restaurant]').textContent = o.restaurant || '—';
      const date = new Date(o.created * 1000).toLocaleDateString(ES ? 'es' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
      $o('[data-o-meta]').textContent = [T.plans[o.plan], `${T.ordered} ${date}`].filter(Boolean).join(' · ');
      $o('[data-o-demo]').hidden = !demo;
      $o('[data-o-pastdue]').hidden = !o.past_due;
      $o('[data-o-billing]').disabled = demo;
      paintStage();
      if (need) need.set(o.files, o.no_logo);
      else need = needList($o('[data-need]'), {
        token: () => token, files: o.files, noLogo: o.no_logo, demo,
        // Con lo obligatorio recibido, el pedido pasa solo a «Menú recibido» (el servidor hace lo mismo)
        onChange: ({ complete }) => { if (o && complete && o.stage === 'paid') { o.stage = 'received'; paintStage(); } },
      });
      show('view');
    };

    const bill = $o('[data-o-billing]');
    const billErr = $o('[data-o-billing-err]');
    bill.addEventListener('click', async () => {
      bill.disabled = true;
      billErr.hidden = true;
      try {
        const d = await post(API, { action: 'portal', token });
        if (!d.url) throw new Error(d.status);
        location.href = d.url;
      } catch {
        billErr.textContent = `${T.billingError} ${od.dataset.email}`;
        billErr.hidden = false;
        bill.disabled = false;
      }
    });
    $o('[data-o-signout]').addEventListener('click', () => { cache.set(null); access.set(''); token = ''; login(); });

    $o('[data-login-form]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const email = f.elements.email;
      if (!email.checkValidity() || !email.value) { email.classList.add('is-bad'); email.focus(); return; }
      email.classList.remove('is-bad');
      const btn = f.querySelector('button');
      btn.disabled = true;
      try {
        if (LOCAL) await wait(600);
        else { const d = await post(API, { action: 'login', email: email.value.trim(), website: f.elements.website.value }); if (!d.ok) throw new Error(d.status); }
        login(T.sent, 'is-ok');
      } catch {
        login(`${T.error} ${od.dataset.email}`, 'is-err');
      } finally { btn.disabled = false; }
    });

    if (LOCAL) {
      // Vista previa sin PHP: un pedido de ejemplo para revisar el diseño
      demo = true;
      render({ restaurant: 'La Berraquera', plan: 'managed', created: Date.now() / 1000 - 9 * 86400, hardware: 'ship', stage: 'changes', round: 2, eta: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), tracking: '', proposal_url: 'https://cdcalvo.github.io/restaurant_menu/menu.html', past_due: false, files: { menu: [{ name: 'carta-2025.pdf', size: 2400000 }], logo: [{ name: 'logo-berraquera.png', size: 310000 }], dishes: [], style: [] }, no_logo: false });
    } else if (!token) login();
    else {
      const cached = cache.get();
      if (cached) render(cached); // si no hay copia, se ve el esqueleto hasta que responde el servidor
      post(API, { action: 'get', token }).then((d) => {
        if (d.ok) { token = d.token; access.set(token); cache.set(d.order); render(d.order); }
        else { cache.set(null); access.set(''); token = ''; login(d.status === 401 ? T.expired : `${T.error} ${od.dataset.email}`, d.status === 401 ? '' : 'is-err'); }
      }).catch(() => { if (!cached) login(`${T.error} ${od.dataset.email}`, 'is-err'); });
    }
  }

  // Vídeos: arrancan solos (autoplay + muted, como los admite Safari en iPhone) y se pausan
  // fuera de pantalla para no gastar datos ni batería
  const vids = document.querySelectorAll('video[data-autoplay]');
  if (vids.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(({ target: v, isIntersecting }) => {
        if (isIntersecting) { v.muted = true; v.play().catch(() => {}); } else v.pause();
      });
    }, { threshold: 0.25 });
    vids.forEach((v) => io.observe(v));
  }

  // Entradas al hacer scroll: lo que entra en pantalla a la vez aparece escalonado (75 ms).
  // La clase .reveal la pone el <head>; REVEAL debe coincidir con el selector de site.css.
  const root = document.documentElement;
  if (root.classList.contains('reveal')) {
    window.__reveal = 1;
    const REVEAL = '.hero__copy > *, .hero__media, .value, .sec__head > *, .screen, .story__visual, .story__txt, .story__end, .client, .more__copy > .h2, .more__list li, .portal, .plan, .hw, .faq__head > *, .qa, .cta__copy > :not(.btn), .form';
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach(({ target }, k) => {
        target.style.transitionDelay = `${Math.min(k, 6) * 75}ms`;
        target.classList.add('is-in');
        io.unobserve(target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    document.querySelectorAll(REVEAL).forEach((el) => io.observe(el));
  }

  // Menú en vivo: se carga solo al abrirlo, en una ventana encima de la página
  const demo = document.querySelector('[data-demo]');
  if (demo && typeof demo.showModal === 'function') {
    const frame = demo.querySelector('iframe');
    const open = (e) => {
      e.preventDefault();
      if (!frame.src) frame.src = frame.dataset.src;
      demo.showModal();
      document.documentElement.classList.add('is-locked');
    };
    document.querySelectorAll('[data-demo-open]').forEach((a) => a.addEventListener('click', open));
    demo.querySelector('[data-demo-close]').addEventListener('click', () => demo.close());
    demo.addEventListener('click', (e) => { if (e.target === demo || e.target.classList.contains('demo__stage')) demo.close(); });
    demo.addEventListener('close', () => document.documentElement.classList.remove('is-locked'));
  }

  // Cambio de idioma sin perder el sitio: las dos versiones tienen la misma estructura, así que se
  // guarda qué bloque estaba en lo alto de la pantalla (por su posición en la lista) y a qué
  // distancia, y al abrir la otra página se vuelve a él al instante, ya con las fuentes cargadas
  // (con la fuente provisional los textos miden distinto). Si las páginas no coinciden, se queda arriba.
  const POS = 'menutab-lang-pos';
  // Sin lo que va fijo en pantalla (resumen del pedido, columna lateral): siempre estaría «arriba»
  const blocks = () => {
    const fixed = [...document.querySelectorAll('main *')].filter((e) => /sticky|fixed/.test(getComputedStyle(e).position));
    return [...document.querySelectorAll('main :is(section, article, form, fieldset, figure, li, h1, h2, h3, p)')].filter((el) => !fixed.some((f) => f.contains(el)));
  };
  // Posición real, sin el desplazamiento de la animación de entrada (translate)
  const topOf = (el) => el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).translate.split(' ')[1]) || 0);
  const lineY = () => (hdr ? hdr.offsetHeight : 0) + 1;
  // El bloque más concreto que cruza la línea bajo la cabecera (o el primero que viene después)
  const pick = (list) => {
    const y = lineY();
    let i = -1;
    list.forEach((el, k) => { const r = el.getBoundingClientRect(); if (r.height && topOf(el) <= y && r.bottom > y) i = k; });
    return i >= 0 ? i : list.findIndex((el) => el.getBoundingClientRect().height && topOf(el) > y);
  };
  document.querySelectorAll('a[hreflang]').forEach((a) => a.addEventListener('click', () => {
    if (scrollY < 40) return;
    const list = blocks();
    const i = pick(list);
    if (i < 0) return;
    try { sessionStorage.setItem(POS, JSON.stringify({ path: a.pathname, i, n: list.length, off: topOf(list[i]) })); } catch {}
  }));
  try {
    const p = JSON.parse(sessionStorage.getItem(POS) || 'null');
    sessionStorage.removeItem(POS);
    if (p && p.path === location.pathname) {
      const go = () => {
        const list = blocks();
        if (list.length === p.n && list[p.i]) window.scrollTo({ top: topOf(list[p.i]) + scrollY - p.off, behavior: 'instant' });
      };
      // Se repite cuando terminan las fuentes y la página (cambian la altura de los textos), salvo
      // que el usuario ya se haya movido
      let moved = false;
      ['wheel', 'touchstart', 'keydown'].forEach((ev) => addEventListener(ev, () => (moved = true), { once: true, passive: true }));
      const again = () => !moved && go();
      go();
      requestAnimationFrame(again);
      if (document.fonts) document.fonts.ready.then(() => requestAnimationFrame(again));
      addEventListener('load', again, { once: true });
    }
  } catch {}
})();
