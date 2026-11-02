// Páginas de compra: configurador («Get started» / «Empezar») y confirmación («Gracias»).
// El pago lo cobra Stripe Checkout (api/checkout.php); aquí solo se arma el pedido.

const LOCK = '<svg class="ico ico--sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';

export function startPage(t, ctx, { esc, money, icon, config }) {
  const c = t.checkout;
  const p = config.prices;
  const plans = t.pricing.plans;
  const stepper = (key) => `
        <div class="eq" data-eq="${key}">
          <div class="eq__txt"><b>${c.items[key][0]}</b><span>${c.items[key][1]} · ${money(p[key])} ${c.unit}</span></div>
          <div class="qty">
            <button type="button" class="qty__btn" data-step="-1" aria-label="−">−</button>
            <input class="qty__n" type="number" name="${key}" min="0" max="200" value="0" inputmode="numeric" aria-label="${esc(c.items[key][0])}">
            <button type="button" class="qty__btn" data-step="1" aria-label="+">+</button>
          </div>
        </div>`;

  const main = `
<section class="co">
  <div class="wrap co__in">
    <form class="co__form" data-checkout novalidate
      data-endpoint="${ctx.base}${config.checkoutEndpoint}"
      data-thanks="${ctx.home}${t.slugs.start}/${t.slugs.thanks}/"
      data-prices='${JSON.stringify(p)}'
      data-plans='${esc(JSON.stringify(Object.fromEntries(plans.map((pl) => [pl.key, pl.name]))))}'
      data-labels='${esc(JSON.stringify({ setup: c.setup, plan: c.plan, items: Object.fromEntries(Object.entries(c.items).map(([k, v]) => [k, v[0]])) }))}'>
      <header class="co__head">
        <p class="kicker kicker--dark">${c.kicker}</p>
        <h1 class="h2">${c.title}</h1>
        <p class="lead">${c.lead}</p>
      </header>

      <fieldset class="co__step">
        <legend><span>1</span>${c.s1}</legend>
        <div class="pick">
          ${plans.map((pl, i) => `
          <label class="pick__card">
            <input type="radio" name="plan" value="${pl.key}"${i === 0 ? ' checked' : ''}>
            <span class="pick__body">
              <span class="pick__tag">${pl.tag}</span>
              <span class="pick__name">${pl.name}</span>
              <span class="pick__price"><b>${money(p[pl.key])}</b>${t.pricing.perMonth}</span>
              <span class="pick__text">${pl.text}</span>
            </span>
            <span class="pick__dot" aria-hidden="true"></span>
          </label>`).join('')}
        </div>
      </fieldset>

      <fieldset class="co__step">
        <legend><span>2</span>${c.s2}</legend>
        <div class="seg" role="radiogroup">
          <label class="seg__opt"><input type="radio" name="hardware" value="ship" checked><span><b>${c.ship[0]}</b><small>${c.ship[1]}</small></span></label>
          <label class="seg__opt"><input type="radio" name="hardware" value="own"><span><b>${c.own[0]}</b><small>${c.own[1]}</small></span></label>
        </div>
        <div class="eqs" data-eqs>
          ${stepper('tablet')}
          ${stepper('charger')}
          ${stepper('cable')}
          <p class="eqs__hint">${c.chargerHint}</p>
        </div>
      </fieldset>

      <fieldset class="co__step">
        <legend><span>3</span>${c.s3}</legend>
        <div class="co__fields">
          <label><span>${c.fields.restaurant}</span><input name="restaurant" required autocomplete="organization"></label>
          <label><span>${c.fields.name}</span><input name="name" required autocomplete="name"></label>
          <label><span>${c.fields.email}</span><input name="email" type="email" required autocomplete="email"></label>
          <label><span>${c.fields.phone}</span><input name="phone" type="tel" required autocomplete="tel"></label>
        </div>
      </fieldset>
    </form>

    <aside class="sum" aria-live="polite">
      <div class="sum__card">
        <h2 class="sum__title">${c.summary}</h2>
        <ul class="sum__lines" data-sum-lines></ul>
        <div class="sum__total"><span>${c.today}</span><b data-sum-today>$0</b></div>
        <div class="sum__month"><span>${c.then}</span><b><span data-sum-month>$0</span>${c.perMonth}</b></div>
        <p class="sum__note">${c.monthlyNote}</p>
        <p class="sum__note">${c.taxes}</p>
        <label class="sum__terms"><input type="checkbox" data-terms> <span>${c.terms[0]} <a href="#">${c.terms[1]}</a> ${c.terms[2]} <a href="#">${c.terms[3]}</a>.</span></label>
        <button class="btn btn--accent btn--block" type="button" data-pay>${LOCK} ${c.pay}</button>
        <p class="sum__secure">${c.secure}</p>
        <p class="sum__methods">${c.methods}</p>
        <p class="sum__demo" data-demo hidden>${c.demo}</p>
        <p class="sum__err" data-err role="alert" hidden></p>
      </div>
      <div class="sum__next">
        <b>${c.next}</b>
        <ol>${c.nextSteps.map((s) => `<li>${s}</li>`).join('')}</ol>
      </div>
    </aside>
  </div>
</section>`;
  return { main, meta: { title: c.meta.title, description: c.meta.description } };
}

export function thanksPage(t, ctx, { icon, config }) {
  const g = t.thanks;
  const main = `
<section class="ty">
  <div class="wrap ty__in">
    <div class="ty__head">
      <span class="ty__check">${icon('check')}</span>
      <p class="kicker kicker--dark">${g.kicker}</p>
      <h1 class="h2">${g.title}</h1>
      <p class="lead">${g.lead}</p>
      <div class="ty__order" data-ty-order hidden></div>
    </div>

    <div class="ty__grid">
      <form class="up" data-upload>
        <h2 class="h3">${g.upload.title}</h2>
        <p class="mute">${g.upload.text}</p>
        <label class="up__drop" data-drop>
          <input type="file" name="files" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,image/*,application/pdf" data-files>
          <span class="up__icon">${icon('photo')}</span>
          <span>${g.upload.drop} <u>${g.upload.browse}</u></span>
          <small>${g.upload.limits}</small>
        </label>
        <ul class="up__list" data-file-list></ul>
        <button class="btn btn--accent btn--block" type="submit">${g.upload.send}</button>
        <p class="up__alt">${g.upload.alt} <a href="mailto:${config.email}">${config.email}</a></p>
      </form>

      <ol class="tl">
        ${g.steps.map(([when, what], i) => `<li class="tl__item${i === 0 ? ' is-now' : ''}"><span class="tl__dot"></span><b>${when}</b><p>${what}</p></li>`).join('')}
      </ol>
    </div>

    <p class="ty__help">${g.help} <a href="mailto:${config.email}">${config.email}</a> · <a href="${ctx.home || './'}">${g.back}</a></p>
  </div>
</section>`;
  return { main, meta: { title: g.meta.title, description: g.meta.description } };
}
