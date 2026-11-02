// Genera el sitio estático en dist/: portada, configurador de compra y página de gracias,
// en inglés (/) y en español (/es/).
// Uso: node build.mjs   ·   Ver en local: node serve.mjs → http://localhost:8090
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { config } from './src/config.mjs';
import { en, es } from './src/content.mjs';

const root = new URL('.', import.meta.url).pathname;
// --preview: publicación de prueba sin PHP (GitHub Pages). No se indexa y los envíos se simulan.
const PREVIEW = process.argv.includes('--preview');
const read = (p) => readFileSync(root + p, 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = (n) => '$' + n.toLocaleString('en-US');

// Logo en línea (sin petición extra y nítido a cualquier tamaño); se quita <title> para no duplicar el aria-label
const logo = (file, cls) =>
  read('assets/img/' + file)
    .replace(/<\?xml[^>]*>/, '')
    .replace(/<title>.*?<\/title>/, '')
    .replace(/ width="[^"]*" height="[^"]*"/, '')
    .replace('<svg ', `<svg class="${cls}" `);

const SOL = `<svg class="sol" viewBox="0 0 100 100" aria-hidden="true"><path d="M8 64 A42 42 0 0 1 92 64" fill="none" stroke-width="8"/><path d="M24 64 A26 26 0 0 1 76 64" fill="none" stroke-width="8"/><circle cx="50" cy="64" r="11" stroke="none"/><rect x="2" y="74" width="96" height="8" rx="4" stroke="none"/><rect x="24" y="88" width="52" height="8" rx="4" stroke="none"/></svg>`;

const ICONS = {
  photo: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 8"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  wifi: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r=".8"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
  play: '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  wa: '<path d="M20 11.6a8.4 8.4 0 0 1-12.4 7.4L3 20.4l1.4-4.4A8.4 8.4 0 1 1 20 11.6z"/><path d="M9 8.5c.3 2.9 2.6 5.3 5.5 5.6l1-1.4-1.8-.9-.8.8a4 4 0 0 1-2-2l.8-.8-.9-1.8z"/>',
};
const icon = (name, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;


const tablet = (inner, cls = '') => `<div class="tablet ${cls}"><div class="tablet__screen">${inner}</div></div>`;
const wa = config.whatsapp ? `https://wa.me/${config.whatsapp}` : '';

// Rutas de una página en los dos idiomas. key = '' (portada), 'start' o 'thanks'
function routes(t, key) {
  const segs = (tt) => (key === '' ? [] : key === 'start' ? [tt.slugs.start] : [tt.slugs.start, tt.slugs.thanks]);
  const path = (tt) => (tt.lang === 'es' ? 'es/' : '') + segs(tt).map((s) => s + '/').join('');
  const depth = path(t).split('/').filter(Boolean).length;
  const base = '../'.repeat(depth);
  const otherT = t.lang === 'es' ? en : es;
  return { key, base, home: base + (t.lang === 'es' ? 'es/' : ''), other: base + path(otherT), path: path(t), pathEn: path(en), pathEs: path(es) };
}

function shell(t, ctx, main, { title, description, jsonld, script = '' }) {
  const isEs = t.lang === 'es';
  const url = (p) => config.siteUrl + '/' + p;
  const onHome = ctx.key === '';
  const a = (id) => (onHome ? '' : ctx.home) + '#' + id;
  return `<!doctype html>
<html lang="${t.lang}"${PREVIEW ? ' data-preview' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url(ctx.path)}">
<link rel="alternate" hreflang="en" href="${url(ctx.pathEn)}">
<link rel="alternate" hreflang="es" href="${url(ctx.pathEs)}">
<link rel="alternate" hreflang="x-default" href="${url(ctx.pathEn)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${config.siteUrl}/assets/img/og-image.jpg">
<meta property="og:locale" content="${isEs ? 'es_US' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#14121A">
${ctx.key === 'thanks' || PREVIEW ? '<meta name="robots" content="noindex">\n' : ''}<link rel="icon" href="${ctx.base}assets/img/menutab-favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${ctx.base}assets/img/favicon-180.png">
<link rel="preload" href="${ctx.base}assets/fonts/jakarta-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${ctx.base}assets/fonts/manrope-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${ctx.base}assets/css/site.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ''}</head>
<body${onHome ? '' : ` class="page-${ctx.key}"`}>
${PREVIEW ? `<div class="preview-bar">${isEs ? 'Vista previa · los formularios y el pago están simulados' : 'Preview · forms and checkout are simulated'}</div>\n` : ''}<a class="skip" href="#main">${isEs ? 'Saltar al contenido' : 'Skip to content'}</a>

<header class="hdr" data-hdr>
  <div class="wrap hdr__in">
    <a class="hdr__logo" href="${ctx.home || './'}" aria-label="menutab">${logo('menutab-logo-oscuro.svg', 'logo')}</a>
    <nav class="hdr__nav" aria-label="Main">
      <a href="${a('how')}">${t.nav.how}</a><a href="${a('features')}">${t.nav.features}</a><a href="${a('pricing')}">${t.nav.pricing}</a><a href="${a('faq')}">${t.nav.faq}</a>
    </nav>
    <div class="hdr__end">
      <a class="hdr__lang" href="${ctx.other || './'}" hreflang="${isEs ? 'en' : 'es'}" aria-label="${t.nav.otherLabel}">${t.nav.other}</a>
      ${ctx.key === 'start' ? '' : `<a class="btn btn--sm btn--accent" href="${ctx.home}${t.slugs.start}/">${t.nav.cta}</a>`}
    </div>
  </div>
</header>

<main id="main">
${main}
</main>

<footer class="ftr">
  <div class="wrap ftr__in">
    <div class="ftr__brand">
      <a href="${ctx.home || './'}" aria-label="menutab">${logo('menutab-logo-oscuro.svg', 'logo')}</a>
      <p class="ftr__desc">${t.hero.kicker}</p>
    </div>
    <nav class="ftr__col" aria-label="${t.footer.product}"><b>${t.footer.product}</b><a href="${a('how')}">${t.nav.how}</a><a href="${a('features')}">${t.nav.features}</a><a href="${a('pricing')}">${t.nav.pricing}</a><a href="${ctx.home}${t.slugs.start}/">${t.nav.cta}</a></nav>
    <nav class="ftr__col" aria-label="${t.footer.contact}"><b>${t.footer.contact}</b><a href="mailto:${config.email}">${config.email}</a>${wa ? `<a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<a href="${ctx.other || './'}" hreflang="${isEs ? 'en' : 'es'}">${t.nav.otherLabel}</a></nav>
  </div>
  <div class="wrap ftr__bottom">
    <span>© ${new Date().getFullYear()} menutab. ${t.footer.rights}</span>
    <span class="by" aria-label="By Muisca Labs">By ${SOL} Muisca Labs</span>
  </div>
</footer>

<script src="${ctx.base}assets/js/site.js" defer></script>
${script}</body>
</html>
`;
}

function home(t) {
  const ctx = routes(t, '');
  const p = config.prices;
  const isEs = t.lang === 'es';
  const main = `
<section class="hero">
  <div class="wrap hero__in">
    <div class="hero__copy">
      <p class="kicker">${t.hero.kicker}</p>
      <h1 class="hero__title">${t.hero.title[0]}<br><span>${t.hero.title[1]}</span></h1>
      <p class="hero__lead">${t.hero.lead}</p>
      <div class="hero__ctas">
        <a class="btn btn--accent" href="#pricing">${t.hero.primary} ${icon('arrow', 'ico ico--sm')}</a>
        <a class="btn btn--ghost" href="${config.demoUrl}" target="_blank" rel="noopener" data-demo-open>${icon('play', 'ico ico--sm')} ${t.hero.secondary}</a>
      </div>
      <p class="hero__slogan" aria-label="${t.hero.slogan.join(' ')}">${t.hero.slogan.map((w, i) => `<span${i === 2 ? ' class="hl"' : ''}>${w}</span>`).join(' ')}</p>
    </div>
    <div class="hero__media" id="demo">
      <a class="hero__demo" href="${config.demoUrl}" target="_blank" rel="noopener" data-demo-open aria-label="${esc(t.hero.secondary)}">
        ${tablet(`<video autoplay muted loop playsinline preload="auto" poster="${ctx.base}assets/video/menu-uso-poster.jpg" data-autoplay aria-hidden="true"><source src="${ctx.base}assets/video/menu-uso.mp4" type="video/mp4"></video>`, 'tablet--hero')}
        <span class="hero__try">${icon('play', 'ico ico--sm')} ${t.hero.tryIt}</span>
      </a>
      <div class="chip chip--a" aria-hidden="true">${icon('check', 'ico ico--sm')}<span><b>${t.hero.chipA}</b></span></div>
      <div class="chip chip--b" aria-hidden="true"><i class="pulse"></i>${t.hero.chipB}</div>
      <p class="hero__note">${t.hero.note}</p>
    </div>
  </div>
  <div class="wrap">
    <ul class="values">
      ${t.values.map((v) => `<li class="value">${icon(v.icon)}<h2>${v.title}</h2><p>${v.text}</p></li>`).join('')}
    </ul>
  </div>
</section>

<dialog class="demo" data-demo aria-label="${esc(t.hero.demoTitle)}">
  <div class="demo__bar">
    <div tabindex="-1" autofocus class="demo__title"><b>${t.hero.demoTitle}</b><span>${t.hero.demoOwner}</span></div>
    <button type="button" class="demo__close" data-demo-close aria-label="${isEs ? 'Cerrar' : 'Close'}">${icon('plus', 'ico')}</button>
  </div>
  <div class="demo__stage">
    <div class="tablet tablet--demo"><div class="tablet__screen"><iframe class="tablet__live" title="${esc(t.hero.demoTitle)}" data-src="${config.demoUrl}"></iframe></div></div>
  </div>
</dialog>

<section class="sec sec--paper" id="features">
  <div class="wrap">
    <div class="sec__head">
      <p class="kicker kicker--dark">${t.showcase.kicker}</p>
      <h2 class="h2">${t.showcase.title}</h2>
      <p class="lead">${t.showcase.lead}</p>
    </div>
    <div class="screens">
      ${t.showcase.screens.map((s, i) => `<figure class="screen screen--${i}">${tablet(s.video
        ? `<video muted loop playsinline preload="none" poster="${ctx.base}assets/video/${s.video}-poster.jpg" aria-label="${esc(s.title)}" data-autoplay><source src="${ctx.base}assets/video/${s.video}.mp4" type="video/mp4"></video>`
        : `<img src="${ctx.base}assets/img/${s.img}" alt="${esc(s.title)}" width="800" height="1280" loading="lazy">`)}<figcaption><b>${s.title}</b><span>${s.text}</span></figcaption></figure>`).join('')}
    </div>
  </div>
</section>

<section class="sec" id="how">
  <div class="wrap">
    <div class="sec__head">
      <p class="kicker kicker--dark">${t.how.kicker}</p>
      <h2 class="h2">${t.how.title}</h2>
    </div>
    <ol class="steps">
      ${t.how.steps.map((s, i) => `<li class="step"><span class="step__n">${String(i + 1).padStart(2, '0')}</span><h3>${s.title}</h3><p>${s.text}</p></li>`).join('')}
    </ol>
  </div>
</section>

<section class="sec sec--night">
  <div class="wrap more">
    <div class="more__copy">
      <p class="kicker">${t.more.kicker}</p>
      <h2 class="h2">${t.more.title}</h2>
      <ul class="more__list">
        ${t.more.items.map((m, i) => `<li>${icon(['qr', 'play', 'edit'][i])}<div><h3>${m.title}</h3><p>${m.text}</p></div></li>`).join('')}
      </ul>
    </div>
    <figure class="portal">
      <div class="portal__bar" aria-hidden="true"><i></i><i></i><i></i><span>${t.more.portal.title}</span></div>
      <img src="${ctx.base}assets/img/panel-platos.jpg" alt="${esc(t.more.portal.alt)}" width="1156" height="716" loading="lazy">
      <figcaption>${t.more.portal.caption}</figcaption>
    </figure>
  </div>
</section>

<section class="sec sec--paper" id="pricing">
  <div class="wrap">
    <div class="sec__head">
      <p class="kicker kicker--dark">${t.pricing.kicker}</p>
      <h2 class="h2">${t.pricing.title}</h2>
      <p class="lead">${t.pricing.lead}</p>
    </div>
    <div class="plans">
      ${t.pricing.plans.map((pl) => `<article class="plan${pl.featured ? ' plan--featured' : ''}">
        ${pl.badge ? `<span class="plan__badge">${pl.badge}</span>` : ''}
        <p class="plan__tag">${pl.tag}</p>
        <h3 class="plan__name">${pl.name}</h3>
        <p class="plan__price"><b>${money(p[pl.key])}</b><span>${t.pricing.perMonth}</span></p>
        <p class="plan__text">${pl.text}</p>
        <ul class="plan__list">${pl.features.map((f) => `<li>${icon('check', 'ico ico--sm')}${f}</li>`).join('')}</ul>
        <a class="btn ${pl.featured ? 'btn--accent' : 'btn--dark'} btn--block" href="${ctx.home}${t.slugs.start}/?plan=${pl.key}">${pl.cta}</a>
      </article>`).join('')}
    </div>

    <div class="hw">
      <div class="hw__copy">
        <h3 class="h3">${t.pricing.hw.title}</h3>
        <p>${t.pricing.hw.lead}</p>
        <ul class="hw__list">
          ${t.pricing.hw.items.map(([k, label, unit]) => `<li><span>${label}</span><b>${money(p[k])}<small>${unit}</small></b></li>`).join('')}
        </ul>
      </div>
      <div class="calc" data-calc data-tablet="${p.tablet}" data-charger="${p.charger}">
        <label for="tables">${t.pricing.hw.calc}</label>
        <div class="calc__row">
          <input id="tables" type="range" min="1" max="40" value="10" data-calc-input>
          <output data-calc-n>10</output>
        </div>
        <p class="calc__total"><b data-calc-total>${money(10 * p.tablet + p.charger)}</b><span>${t.pricing.hw.calcNote}</span></p>
        <p class="calc__hint">${t.pricing.hw.calcHint}</p>
        <a class="btn btn--ghost-dark btn--block" href="${ctx.home}${t.slugs.start}/">${t.pricing.hw.shop}</a>
      </div>
    </div>
  </div>
</section>

<section class="sec" id="faq">
  <div class="wrap faq">
    <div class="faq__head">
      <p class="kicker kicker--dark">${t.faq.kicker}</p>
      <h2 class="h2">${t.faq.title}</h2>
    </div>
    <div class="faq__list">
      ${t.faq.items.map(([q, a]) => `<details class="qa"><summary>${q}${icon('plus', 'ico ico--sm')}</summary><p>${a}</p></details>`).join('')}
    </div>
  </div>
</section>

<section class="sec sec--night cta" id="contact">
  <div class="wrap cta__in">
    <div class="cta__copy">
      <p class="kicker">${t.contact.kicker}</p>
      <h2 class="h2">${t.contact.title}</h2>
      <p class="lead">${t.contact.lead}</p>
      ${wa ? `<a class="btn btn--ghost" href="${wa}" target="_blank" rel="noopener">${icon('wa', 'ico ico--sm')} ${t.contact.whatsapp}</a>` : ''}
    </div>
    <form class="form" action="${ctx.base}contact.php" method="post" data-form data-ok="${esc(t.contact.ok)}" data-error="${esc(t.contact.error)}" data-email="${config.email}" data-sending="${esc(t.contact.sending)}">
      <input type="hidden" name="lang" value="${t.lang}">
      <div class="hp" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="form__grid">
        <label><span>${t.contact.fields.name}</span><input name="name" required autocomplete="name"></label>
        <label><span>${t.contact.fields.restaurant}</span><input name="restaurant" required autocomplete="organization"></label>
        <label><span>${t.contact.fields.phone}</span><input name="phone" type="tel" required autocomplete="tel"></label>
        <label><span>${t.contact.fields.email}</span><input name="email" type="email" required autocomplete="email"></label>
        <label><span>${t.contact.fields.tables}</span><input name="tables" type="number" min="1" max="500" inputmode="numeric"></label>
        <label class="form__full"><span>${t.contact.fields.message}</span><textarea name="message" rows="3"></textarea></label>
      </div>
      <button class="btn btn--accent btn--block" type="submit">${t.contact.submit}</button>
      <p class="form__note" data-form-msg role="status">${t.contact.privacy}</p>
    </form>
  </div>
</section>
`;
  return shell(t, ctx, main, {
    title: t.meta.title,
    description: t.meta.description,
    jsonld: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'menutab', url: config.siteUrl, logo: config.siteUrl + '/assets/img/favicon-180.png', parentOrganization: { '@type': 'Organization', name: 'Muisca Labs' } },
        { '@type': 'FAQPage', mainEntity: t.faq.items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
      ],
    },
  });
}

import { startPage, thanksPage } from './src/pages-checkout.mjs';
const helpers = { esc, money, icon, tablet, config };

const dist = root + 'dist/';
rmSync(dist, { recursive: true, force: true });
cpSync(root + 'assets', dist + 'assets', { recursive: true });
cpSync(root + 'src/contact.php', dist + 'contact.php');
cpSync(root + 'src/api', dist + 'api', { recursive: true });
// Titulares: ajusta la puntuación final (ver .pt en site.css)
const tighten = (html) => html.replace(/(<h[12][^>]*>)([\s\S]*?)(<\/h[12]>)/g, (_, a, body, z) => a + body.replace(/([.,?])(?=<|$)/g, '<span class="pt">$1</span>') + z);
const out = (path, html) => { mkdirSync(dist + path, { recursive: true }); writeFileSync(dist + path + 'index.html', tighten(html)); return path || '/'; };
const written = [];
for (const t of [en, es]) {
  written.push(out(routes(t, '').path, home(t)));
  const s = startPage(t, routes(t, 'start'), helpers);
  written.push(out(routes(t, 'start').path, shell(t, routes(t, 'start'), s.main, s.meta)));
  const g = thanksPage(t, routes(t, 'thanks'), helpers);
  written.push(out(routes(t, 'thanks').path, shell(t, routes(t, 'thanks'), g.main, g.meta)));
}
console.log((PREVIEW ? '[vista previa] ' : '') + 'dist/ listo:', written.join('  '));
