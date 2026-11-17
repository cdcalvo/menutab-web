// «Mi pedido» (/my-order/, /es/mi-pedido/) y la lista de lo que necesitamos del cliente, que se
// usa aquí y en la página de gracias. Todo se pinta con site.js a partir de api/order.php: la página
// es estática y el pedido llega con el enlace de acceso (?t=…).

// Lo mismo que acepta api/upload.php
export const ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.gif,.xlsx,.xls,.csv,.doc,.docx,.txt';
const KINDS = [['menu', true], ['logo', true], ['dishes', false], ['style', false]];

// Lista de piezas: cada una con su botón de subir, sus archivos y su ✓
export function checklist(t, ctx, { esc, icon, config }) {
  const f = t.files;
  return `
<section class="need" data-need hidden
  data-upload="${ctx.base}api/upload.php" data-api="${ctx.base}api/order.php" data-email="${config.email}"
  data-msg='${esc(JSON.stringify({ sending: f.sending, tooBig: f.tooBig, badType: f.badType, error: f.error, add: f.add, addMore: f.addMore, complete: f.complete }))}'>
  <div class="need__head">
    <h2 class="h3">${f.title}</h2>
    <p class="mute">${f.lead}</p>
  </div>
  <ul class="need__list">
    ${KINDS.map(([k, req]) => `
    <li class="piece" data-kind="${k}">
      <span class="piece__check" aria-hidden="true">${icon('check')}</span>
      <div class="piece__body">
        <p class="piece__title"><b>${f.kinds[k][0]}</b><span class="piece__tag${req ? ' is-req' : ''}">${req ? f.required : f.optional}</span></p>
        <p class="piece__text">${f.kinds[k][1]}</p>
        ${k === 'menu' ? `<p class="piece__tpl">${f.template[0]} <a href="${ctx.base}assets/files/${t.lang === 'es' ? 'plantilla-menu.xlsx' : 'menu-template.xlsx'}" download>${f.template[1]}</a></p>` : ''}
        <ul class="piece__files" data-files></ul>
        <div class="piece__actions">
          <label class="btn btn--ghost-dark btn--sm piece__add">
            <input type="file" multiple accept="${ACCEPT}" data-input>
            ${icon('plus', 'ico ico--sm')} <span data-add-label>${f.add}</span>
          </label>
          ${k === 'logo' ? `<label class="piece__none"><input type="checkbox" data-no-logo> ${f.noLogo}</label>` : ''}
        </div>
      </div>
    </li>`).join('')}
  </ul>
  <p class="need__limits">${f.limits}</p>
  <p class="need__msg" data-need-msg role="status" hidden></p>
</section>`;
}

export function orderPage(t, ctx, helpers) {
  const { esc, icon, config } = helpers;
  const o = t.order;
  const plans = Object.fromEntries(t.pricing.plans.map((pl) => [pl.key, pl.name]));
  const main = `
<section class="od" data-order
  data-api="${ctx.base}api/order.php"
  data-texts='${esc(JSON.stringify({ stages: o.stages, stagesOwn: o.stagesOwn, eta: o.eta, now: o.now, roundLabel: o.roundLabel, ordered: o.ordered, plans, sent: o.login.sent, expired: o.login.expired, error: o.login.error, billingError: o.billing.error }))}'
  data-email="${config.email}">
  <div class="wrap od__in">
    <p class="kicker kicker--dark">${o.kicker}</p>

    <div class="od__login" data-login hidden>
      <h1 class="h2">${o.login.title}</h1>
      <p class="lead">${o.login.lead}</p>
      <p class="od__notice" data-login-note role="status" hidden></p>
      <form class="od__form" data-login-form novalidate>
        <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
        <label><span>${o.login.email}</span><input name="email" type="email" required autocomplete="email" inputmode="email"></label>
        <button class="btn btn--accent" type="submit">${o.login.submit}</button>
      </form>
    </div>

    <!-- Esqueleto con la forma de la página mientras llega el pedido: así no salta nada -->
    <div class="od__skel" data-loading role="status" aria-label="${esc(o.loading)}">
      <span class="sk sk--title"></span>
      <span class="sk sk--meta"></span>
      <div class="od__grid">
        <div class="od__main"><span class="sk sk--now"></span><span class="sk sk--need"></span></div>
        <div class="od__side"><span class="sk sk--steps"></span><span class="sk sk--card"></span></div>
      </div>
    </div>

    <div class="od__view" data-view hidden>
      <header class="od__head">
        <h1 class="h2" data-o-restaurant></h1>
        <p class="od__meta" data-o-meta></p>
        <p class="od__demo" data-o-demo hidden>${o.demo}</p>
      </header>
      <p class="od__alert" data-o-pastdue hidden>${o.pastDue}</p>

      <div class="od__grid">
        <div class="od__main">
          <div class="od__now" data-o-now>
            <span class="od__now-tag">${o.now}</span>
            <h2 class="h3" data-o-now-title></h2>
            <p data-o-now-text></p>
            <p class="od__eta" data-o-eta hidden></p>
            <a class="btn btn--accent btn--sm" data-o-proposals target="_blank" rel="noopener" hidden>${o.proposals} ${icon('arrow', 'ico ico--sm')}</a>
            <p class="od__track" data-o-tracking hidden><b>${o.tracking}:</b> <span></span></p>
          </div>
          ${checklist(t, ctx, helpers)}
        </div>

        <aside class="od__side">
          <ol class="steps" data-o-steps aria-label="${esc(o.kicker)}"></ol>
          <div class="od__card">
            <h2 class="od__card-title">${o.billing.title}</h2>
            <p>${o.billing.text}</p>
            <button class="btn btn--dark btn--block btn--sm" type="button" data-o-billing>${o.billing.button}</button>
            <p class="od__err" data-o-billing-err role="alert" hidden></p>
          </div>
          <p class="od__help">${o.help} <a href="mailto:${config.email}">${config.email}</a></p>
          <button class="od__out" type="button" data-o-signout>${o.signout}</button>
        </aside>
      </div>
    </div>
  </div>
</section>`;
  return { main, meta: { title: o.meta.title, description: o.meta.description } };
}
