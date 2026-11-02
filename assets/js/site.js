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
    const show = () => {
      list.innerHTML = [...input.files].map((f) => `<li><span>${f.name.replace(/</g, '&lt;')}</span><span>${(f.size / 1048576).toFixed(1)} MB</span></li>`).join('');
    };
    input.addEventListener('change', show);
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.add('is-over')));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
    up.addEventListener('submit', (e) => e.preventDefault()); // la subida se conecta con el backend en la fase de Stripe
  }

  // Vídeos de las pantallas: solo se reproducen mientras se ven; con «reducir movimiento», imagen fija
  const vids = document.querySelectorAll('video[data-autoplay]');
  if (vids.length && !matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(({ target: v, isIntersecting }) => {
        if (isIntersecting) { v.muted = true; v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
      });
    }, { threshold: 0.35 });
    vids.forEach((v) => io.observe(v));
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
