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

    // ?plan=managed desde los botones de precios de la portada
    const wanted = new URLSearchParams(location.search).get('plan');
    if (wanted && plans[wanted]) co.querySelector(`[name=plan][value=${wanted}]`).checked = true;
    qty('tablet').value = 10;
    qty('charger').value = 1;

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
    });
    co.addEventListener('change', render);
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

  // ───────── Gracias: resumen del pedido y subida de archivos ─────────
  const tyOrder = document.querySelector('[data-ty-order]');
  if (tyOrder) {
    try {
      const o = JSON.parse(sessionStorage.getItem('menutab-order') || 'null');
      if (o) {
        const es = document.documentElement.lang === 'es';
        tyOrder.innerHTML = `<span><b>${o.restaurant.replace(/</g, '&lt;')}</b></span><span>${o.planName}</span><span>${es ? 'Pagado hoy' : 'Paid today'}: <b>${o.today}</b></span><span>${es ? 'Luego' : 'Then'} <b>${o.month}</b>${es ? '/mes' : '/month'}</span>`;
        tyOrder.hidden = false;
      }
    } catch {}
  }
  const up = document.querySelector('[data-upload]');
  if (up) {
    const drop = up.querySelector('[data-drop]');
    const input = up.querySelector('[data-files]');
    const list = up.querySelector('[data-file-list]');
    const msg = up.querySelector('[data-up-msg]');
    const btn = up.querySelector('button[type=submit]');
    const who = up.querySelector('[data-who]');
    const M = JSON.parse(up.dataset.msg);
    const OK_EXT = /\.(pdf|jpe?g|png|hei[cf]|webp|gif|xlsx?|csv|docx?|txt)$/i;
    const MAX = 20 * 1024 * 1024;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const local = ['localhost', '127.0.0.1'].includes(location.hostname) || 'preview' in document.documentElement.dataset;
    const sid = new URLSearchParams(location.search).get('session_id') || '';
    let order = null;
    try { order = JSON.parse(sessionStorage.getItem('menutab-order') || 'null'); } catch {}
    // Sin pedido conocido (p. ej. vuelve otro día desde el enlace): pedimos restaurante y correo
    if (!sid && !order) { who.hidden = false; who.querySelectorAll('input').forEach((i) => (i.required = true)); }
    // Un lote por visita: si vuelve a enviar más archivos, van a la misma carpeta
    const batch = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    let files = [];

    const problem = (f) => (!OK_EXT.test(f.name) ? M.badType : f.size > MAX ? M.tooBig : '');
    const show = () => {
      list.innerHTML = files.map((f, i) => {
        const bad = problem(f);
        return `<li data-i="${i}"${bad ? ' class="is-bad"' : ''}><span>${esc(f.name)}</span><span data-st>${bad || (f.size / 1048576).toFixed(1) + ' MB'}</span></li>`;
      }).join('');
    };
    input.addEventListener('change', () => { files = [...input.files]; msg.hidden = true; show(); });
    who.addEventListener('input', (e) => e.target.classList.remove('is-bad'));
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.add('is-over')));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));

    const send = (data, onProgress) => new Promise((resolve, reject) => {
      // XMLHttpRequest y no fetch: fetch no informa del progreso de subida
      const x = new XMLHttpRequest();
      x.open('POST', up.action);
      x.setRequestHeader('Accept', 'application/json');
      if (onProgress) x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      x.onload = () => (x.status === 200 ? resolve() : reject(new Error(x.status)));
      x.onerror = () => reject(new Error('network'));
      x.send(data);
    });
    const base = () => {
      const fd = new FormData();
      fd.append('batch', batch);
      fd.append('session_id', sid);
      for (const k of ['lang', 'website', 'restaurant', 'email']) fd.append(k, up.elements[k]?.value || '');
      if (order) for (const k of ['restaurant', 'email', 'name', 'phone']) if (order[k] && !fd.get(k)) fd.set(k, order[k]);
      return fd;
    };
    const say = (text, cls) => { msg.textContent = text; msg.className = 'up__msg ' + cls; msg.hidden = false; };

    up.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bad = [...who.querySelectorAll('input')].filter((i) => !who.hidden && !i.checkValidity());
      bad.forEach((i) => i.classList.add('is-bad'));
      if (bad.length) { bad[0].focus(); return; }
      const todo = files.map((f, i) => [f, i]).filter(([f]) => !problem(f));
      if (!todo.length) { input.click(); return; }
      btn.disabled = true;
      msg.hidden = true;
      let failed = 0;
      for (const [f, i] of todo) {
        const li = list.querySelector(`[data-i="${i}"]`);
        if (li.classList.contains('is-ok')) continue;
        const st = li.querySelector('[data-st]');
        try {
          if (local) { for (let p = 0; p <= 1; p += 0.25) { st.textContent = `${M.sending} ${Math.round(p * 100)}%`; await new Promise((r) => setTimeout(r, 120)); } }
          else {
            const fd = base();
            fd.append('action', 'file');
            fd.append('file', f);
            await send(fd, (p) => (st.textContent = `${M.sending} ${Math.round(p * 100)}%`));
          }
          li.classList.add('is-ok');
          st.textContent = '✓';
        } catch {
          failed++;
          li.classList.add('is-bad');
          st.textContent = '!';
        }
      }
      try {
        if (!local && failed < todo.length) { const fd = base(); fd.append('action', 'done'); await send(fd); }
      } catch { failed = failed || 1; }
      btn.disabled = false;
      if (failed) say(`${M.error} ${up.dataset.email}`, 'is-err');
      else say(M.sent, 'is-ok');
    });
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
})();
