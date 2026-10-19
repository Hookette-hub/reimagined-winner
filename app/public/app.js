/* ===================== Réglages ===================== */
// L'Usine tourne en mode TEST : « Réel » lit les vraies données de l'environnement TEST (le vrai tableau n'est jamais écrit).
// Aucun ID dans le code : google.js retrouve le tableau TEST par son nom, après la connexion du Président.
const SHEET = "tableau-test";
const GS = "Google Sheets", GD = "Google Drive";
const RANGES = {
  et:"'État du moteur'!A1:E2000", dq:"'Décisions & Questions'!A1:J2000", pj:"Projets!A1:V500", rt:"'Rentabilité'!A1:M200",
  ob:"Objectifs!A1:J2000", dp:"'Dépenses'!A1:G2000", ou:"Outils!A1:H200", pa:"'Parler à l''Usine'!A1:E2000",
  la:"Lacunes!A1:K500", bi:"'Index Bibliothèque'!A1:N500", ap:"'Applications des fiches'!A1:I3000", id:"'Idées'!A1:M500",
  qg:"'Données du QG'!A1:E3000",
};
const OPTIONNELS = ["qg","pa","la","ap","id","dp","rt","ob"]; // onglets qui peuvent ne pas encore exister
/* Prénoms et postes de départ (config/equipe.yaml) : le QG les utilise tant que le moteur n'a pas écrit « Données du QG ». */
const EQUIPE_DEFAUT = {
  directeur_general:["Directeur général","Karim","Direction","Coordonne l'équipe et prépare vos décisions."],
  secretariat:["Secrétariat","Sofia","Direction","Tient le tableau, le calendrier et vos questions à jour."],
  veille_strategie:["Veille & Stratégie","Yasmine","Recherche & Stratégie","Trouve les idées de projets et les note."],
  chef_produit:["Chef de produit SaaS","Omar","Produit & Technique","Écrit les études de marché et les cahiers des charges."],
  developpeur:["Développeur","Mehdi","Produit & Technique","Construit et teste les sites."],
  designer:["Designer","Nadia","Produit & Technique","Crée l'identité visuelle de chaque projet."],
  seo:["SEO & Mots-clés","Rayan","Croissance","Choisit les mots-clés pour être trouvé sur Google."],
  contenu:["Contenu & Blogging","Inès","Croissance","Écrit les articles et les textes."],
  marketing:["Marketing & Acquisition","Sami","Croissance","Fait connaître les projets (communautés, partenariats)."],
  optimisation:["Optimisation","Adam","Croissance","Cherche chaque semaine ce qui peut marcher mieux."],
  finance:["Finance","Léa","Finance & Performance","Surveille le budget, les coûts et les revenus."],
  analyste:["Analyste (suivi)","Lina","Finance & Performance","Compare les chiffres aux objectifs et écrit les rapports."],
  maintenance:["Maintenance","Hamza","Opérations","Contrôle chaque jour que tout marche, et répare."],
  bibliothecaire:["Bibliothécaire","Zoé","Opérations","Tient la Bibliothèque des bonnes pratiques."],
  controle_qualite:["Contrôle qualité","Nora","Opérations","Relit chaque livrable avant qu'il arrive chez vous."],
};
const ETAPES = ["Idée","Étude","Votre accord","Préparation","Construction","En ligne","Rentable"];
const MODELES = {gratuit:{nom:"Modèle gratuit", cout:"0 $", desc:"Gratuit et rapide, parfois moins précis."},
  standard:{nom:"Sonnet", cout:"Payé à chaque tâche", desc:"Fiable, bon rapport qualité-prix."},
  expert:{nom:"Opus", cout:"Payé à chaque tâche, le plus cher", desc:"Le plus précis, pour les tâches difficiles."}};
const NIV = ["gratuit","standard","expert"];
/* Les 5 seules sortes de questions qui arrivent au Président (règle du patron, moteur/questions_president.py). */
const CATS = {1:"Valider le projet", 2:"Valider l'aperçu du site", 3:"Décider après le test", 4:"Dépenser de l'argent réel", 5:"Problème grave"};
function categorie(type, desc){
  const d = String(desc || "").toLowerCase();
  if (/valider le projet/.test(d)) return 1;
  if (/approuver l.aper[cç]u|valider l.aper[cç]u/.test(d)) return 2;
  if (/d[ée]cision apr[eè]s le test|revue trimestrielle/.test(d)) return 3;
  if (/alerte budget|acheter le nom de domaine|cr[ée]er les comptes communs|au-del[aà] du budget/.test(d)) return 4;
  const sans = d.replace(/«[^»]*»/g, "");
  if ((type === "Urgence" || type === "Problème") && /instruction cach[ée]e|fuite de|fuite d.|secret|piratage|intrusion|l[ée]gal|juridique|rgpd|plainte|perte de donn[ée]es|donn[ée]es perdues|action interdite|sauvegarde/.test(sans)
      && !/d[ée]pense anormale|acc[eè]s refus[ée] par un service|rien depuis/.test(d)) return 5;
  return null;
}

/* ===================== Outils ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur = v => (Math.abs(v) < 10 && v % 1 ? v.toFixed(2).replace(".", ",") : Math.round(v).toLocaleString("fr-FR")) + " €";
const usd = v => (v || 0).toFixed(2).replace(".", ",") + " $";
const sum = a => a.reduce((s, v) => s + (v || 0), 0);
const signe = v => (v >= 0 ? "+" : "−") + eur(Math.abs(v));
const nombre = s => { const n = parseFloat(String(s ?? "").replace(/\s/g, "").replace(",", ".")); return isNaN(n) ? null : n; };
const MN = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
const MNL = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const dateD = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const fmtD = s => { const d = dateD(s); return d ? `${d.getDate()} ${MN[d.getMonth()]}` : (s || ""); };
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function douzeMois(fin){ const [y, m] = fin.split("-").map(Number); const out = [];
  for (let i = 11; i >= 0; i--){ let mm = m - i, yy = y; while (mm < 1){ mm += 12; yy--; } out.push(`${yy}-${String(mm).padStart(2, "0")}`); } return out; }
const ICON = {
  projets:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  equipe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 1.8 6 5.5"/></svg>',
  argent:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
  decide:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>',
  plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7"/></svg>',
  evol:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/></svg>',
  rapports:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>',
  messages:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v11H8l-4 4z"/></svg>',
  travail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3"/></svg>',
  contrat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  objectif:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  livre:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/></svg>',
  usine:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21V10l6 4V10l6 4V6l6-3v18z"/></svg>',
  sante:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  outils:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 6a4 4 0 0 0 5 5l-9 9-3-3 9-9a4 4 0 0 1-2-2z"/></svg>',
  calendrier:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  qualite:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  pret:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  veille:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/></svg>',
  idee:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  trou:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg>',
};
const tile = (href, ic, titre, ligne, cls = "") => `<a class="tile ${cls}" href="#${esc(href)}"><span class="ic">${ICON[ic]}</span><span class="tx"><b>${esc(titre)}</b><span>${esc(ligne)}</span></span><span class="go">›</span></a>`;
const kpi = (k, v, cls = "") => `<div class="kpi"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
const stepsMini = (k, arr) => `<div class="steps">${ETAPES.map((_, j) => `<i class="${arr ? "" : j < k ? "done" : j === k ? "now" : ""}"></i>`).join("")}</div>`;
const stepsBig = (k, arr) => `<div class="stepbig">${ETAPES.map((e, j) => `<div class="${arr ? "" : j < k ? "done" : j === k ? "now" : ""}"><span>${j < k && !arr ? "✓" : j + 1}</span>${e}</div>`).join("")}</div>`;
const vide = t => `<div class="empty">${t}</div>`;
const titreSect = t => `<div class="sub" style="font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">${esc(t)}</div>`;

/* Graphiques (un seul axe, mêmes unités) */
let MOIS = [];
let cid = 0;
function lineChart(series, opts){
  const id = "c" + (++cid), W = 720, H = 250, L = 48, R = 96, T = 16, B = 30;
  const vals = series.flatMap(s => s.v.filter(v => v != null)); const max = Math.max(...vals, opts.min || 10);
  const step = opts.step || [1,2,5,10,20,50,100,200,250,500,1000,2000,5000].find(s => max / s <= 5) || 10000;
  const bottom = opts.bottom < 0 ? Math.floor(opts.bottom / step) * step : opts.bottom || 0, top = opts.top || Math.ceil(max / step) * step;
  const X = i => L + i / 11 * (W - L - R), Y = v => T + (1 - (v - bottom) / (top - bottom)) * (H - T - B);
  const path = a => a.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean).map((p, j) => (j ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
  const ticks = []; for (let v = bottom; v <= top + 1e-9; v += step) ticks.push(+v.toFixed(4));
  const ends = series.map(s => { const i = s.v.findLastIndex(v => v != null); return {s, i, y: i >= 0 ? Y(s.v[i]) : 0}; }).filter(e => e.i >= 0);
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 16){ const [a, b] = ends[0].y < ends[1].y ? ends : [ends[1], ends[0]]; b.y = a.y + 16; }
  let eq = -1; if (opts.equilibre){ const [r, c] = series; for (let i = 0; i < 12; i++) if (r.v[i] != null && c.v[i] != null && r.v[i] > c.v[i]){ eq = i; break; } }
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)}">
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--f-num)">${v.toLocaleString("fr-FR")}</text>`).join("")}
    ${MOIS.map((m, i) => `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${m}</text>`).join("")}
    ${eq >= 0 ? `<line x1="${X(eq)}" x2="${X(eq)}" y1="${T}" y2="${H - B}" stroke="var(--good)" stroke-dasharray="4 4"/><text x="${X(eq) + 6}" y="${T + 10}" font-size="11" font-weight="600" fill="var(--ink)">Rentable depuis ${MOIS[eq]}</text>` : ""}
    ${series.slice().reverse().map(s => `<path d="${path(s.v)}" fill="none" stroke="${s.c}" stroke-width="${s.w || 2}" stroke-linejoin="round"/>`).join("")}
    ${ends.map(e => `<circle cx="${X(e.i)}" cy="${Y(e.s.v[e.i])}" r="4" fill="${e.s.c}" stroke="var(--surface)" stroke-width="2"/><text x="${X(e.i) + 8}" y="${e.y + 4}" font-size="12" font-weight="600" fill="var(--ink)">${esc(e.s.fmt(e.s.v[e.i]))}</text>`).join("")}
    <line id="${id}-x" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--muted)" opacity="0"/>
    ${MOIS.map((m, i) => `<rect data-i="${i}" x="${X(i) - (W - L - R) / 22}" y="${T}" width="${(W - L - R) / 11}" height="${H - T - B}" fill="transparent"/>`).join("")}</svg>`;
  setTimeout(() => {
    const box = document.getElementById(id); if (!box) return;
    const tip = box.querySelector(".tip"), cross = document.getElementById(id + "-x");
    box.querySelectorAll("rect[data-i]").forEach(r => {
      const show = () => { const i = +r.dataset.i; if (series.every(s => s.v[i] == null)){ tip.style.opacity = 0; return; }
        const w = box.getBoundingClientRect().width, k = w / W;
        cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("opacity", ".4");
        tip.innerHTML = `<b>${MOIS[i]}</b>` + series.map(s => `${s.n} : ${s.v[i] == null ? "–" : esc(s.fmt(s.v[i]))}`).join("<br>") + (opts.equilibre && series[0].v[i] != null ? `<br>Bénéfice : ${signe((series[0].v[i] || 0) - (series[1].v[i] || 0))}` : "");
        tip.style.left = Math.min(Math.max(X(i) * k, 80), w - 80) + "px"; tip.style.top = (T + 24) * k + "px"; tip.style.opacity = 1; };
      r.addEventListener("mouseenter", show); r.addEventListener("click", show);
      r.addEventListener("mouseleave", () => { tip.style.opacity = 0; cross.setAttribute("opacity", "0"); });
    });
  });
  const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.c}"></i>${s.n}</span>`).join("")}</div>` : "";
  return legend + `<div class="chart" id="${id}">${svg}<div class="tip"></div></div>`;
}
const points = a => a.filter(v => v != null).length;
/* Une courbe a besoin d'au moins deux mois mesurés : sinon une phrase dit ce qu'on sait. */
function courbe(series, opts, siVide){
  if (series.every(s => points(s.v) < 2)){
    const s = series.find(x => points(x.v) === 1);
    if (s){ const i = s.v.findIndex(v => v != null); return vide(`Un seul mois mesuré pour l'instant (${MNL[(+MOISK[i].slice(5)) - 1]}) : ${esc(s.fmt(s.v[i]))}. La courbe apparaîtra dès le deuxième mois.`); }
    return vide(siVide || "Pas encore de mesure : la courbe apparaîtra dès les premiers chiffres.");
  }
  return lineChart(series, opts);
}
const argentChart = (rev, cost, label) => courbe([{n:"Revenus", v:rev, c:"var(--rev)", w:2.5, fmt:v => "Revenus " + eur(v)},{n:"Dépenses", v:cost, c:"var(--cost)", fmt:v => "Dépenses " + eur(v)}], {label, equilibre:true});

/* Mini-courbes et tendances (partout où un chiffre change dans le temps) */
function spark(vals, color = "var(--rev)", cls = "spark"){
  const pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
  if (pts.length < 2) return `<svg class="${cls}" viewBox="0 0 120 36" aria-hidden="true">${pts.length ? `<circle cx="${2 + pts[0][0] / 11 * 116}" cy="18" r="3" fill="${color}"/>` : ""}</svg>`;
  const lo = Math.min(...pts.map(p => p[1]), 0), hi = Math.max(...pts.map(p => p[1]), 1);
  const X = i => 2 + i / 11 * 116, Y = v => 32 - (v - lo) / (hi - lo || 1) * 28;
  const d = pts.map((p, j) => (j ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("");
  const z = Y(Math.max(lo, 0));
  return `<svg class="${cls}" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path d="${d}L${X(pts.at(-1)[0]).toFixed(1)} ${z}L${X(pts[0][0]).toFixed(1)} ${z}Z" fill="${color}" fill-opacity=".14"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${X(pts.at(-1)[0])}" cy="${Y(pts.at(-1)[1])}" r="2.5" fill="${color}"/></svg>`;
}
function tendance(vals, invert){
  const v = vals.filter(x => x != null);
  if (v.length < 2) return v.length ? `<span class="trend sub">Premier mois mesuré</span>` : `<span class="trend sub">Pas encore mesuré</span>`;
  const now = v.at(-1), before = v.at(-2); if (!before) return now ? `<span class="trend up">Nouveau ce mois</span>` : `<span class="trend sub">= sur un mois</span>`;
  const p = Math.round(100 * (now - before) / Math.abs(before)); const good = invert ? p <= 0 : p >= 0;
  return `<span class="trend ${p === 0 ? "" : good ? "up" : "down"}">${p > 0 ? "▲" : p < 0 ? "▼" : "="} ${Math.abs(p)} % sur un mois</span>`;
}
const cumul = a => { let s = 0, seen = false; return a.map(v => { if (v == null && !seen) return null; seen = true; s += v || 0; return s; }); };
function barsSignes(vals, label){
  if (points(vals) < 2 && !vals.some(v => v)) return vide("Pas encore de bénéfice ni de perte mesurés : aucun projet ne vend encore.");
  const W = 720, H = 230, L = 48, R = 16, T = 14, B = 30, max = Math.max(...vals.map(v => Math.abs(v || 0)), 10);
  const step = [10,20,50,100,200,250,500].find(s => max / s <= 3) || 1000, top = Math.ceil(Math.max(...vals.map(v => v || 0), 0) / step) * step || step, bot = -Math.ceil(Math.max(...vals.map(v => -(v || 0)), 0) / step) * step;
  const bw = (W - L - R) / 12, Y = v => T + (top - v) / (top - bot) * (H - T - B), ticks = []; for (let v = bot; v <= top; v += step) ticks.push(v);
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v === 0 ? "var(--muted)" : "var(--grid)"}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--f-num)">${v}</text>`).join("")}
    ${vals.map((v, i) => v == null || v === 0 ? "" : `<rect x="${L + i * bw + 5}" y="${Math.min(Y(v), Y(0))}" width="${bw - 10}" height="${Math.abs(Y(v) - Y(0))}" rx="4" fill="${v >= 0 ? "var(--good)" : "var(--cost)"}"><title>${MOIS[i]} : ${signe(v)}</title></rect>`).join("")}
    ${MOIS.map((m, i) => `<text x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--muted)">${m}</text>`).join("")}
    ${vals[11] != null ? `<text x="${L + 11 * bw + bw / 2}" y="${(vals[11] >= 0 ? Y(vals[11]) - 6 : Y(vals[11]) + 14)}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--ink)" font-family="var(--f-num)">${signe(vals[11])}</text>` : ""}</svg></div>`;
}
const tileS = (href, ic, titre, ligne, vals, color, cls = "") => `<a class="tile ${cls}" href="#${esc(href)}"><span class="ic">${ICON[ic]}</span><span class="tx"><b>${esc(titre)}</b><span>${esc(ligne)}</span>${vals ? tendance(vals) : ""}</span>${vals ? spark(vals, color) : ""}<span class="go">›</span></a>`;
const dernier = a => { const v = a.filter(x => x != null); return v.length ? v.at(-1) : null; };

/* Petit lecteur Markdown pour le résumé d'une page (titres, listes, gras, liens) */
function md(t){
  const inl = s => esc(s).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  let out = "", list = "";
  const close = () => { if (list){ out += `</${list}>`; list = ""; } };
  for (const raw of String(t || "").split(/\r?\n/)){
    const l = raw.trim();
    if (!l){ close(); continue; }
    let m;
    if ((m = /^#{1,6}\s+(.*)/.exec(l))){ close(); out += `<h3>${inl(m[1])}</h3>`; }
    else if ((m = /^[-*•]\s+(.*)/.exec(l))){ if (list !== "ul"){ close(); out += "<ul>"; list = "ul"; } out += `<li>${inl(m[1])}</li>`; }
    else if ((m = /^\d+[.)]\s+(.*)/.exec(l))){ if (list !== "ol"){ close(); out += "<ol>"; list = "ol"; } out += `<li>${inl(m[1])}</li>`; }
    else { close(); out += `<p>${inl(l)}</p>`; }
  }
  close(); return out;
}

/* ===================== État ===================== */
let MODE = "reel"; try { if (localStorage.getItem("qg-usine-mode") === "sim") MODE = "sim"; } catch(e) {}
const G = window.QG_GOOGLE;        // connexion Google (google.js) : jeton en mémoire seulement
let mcp = null, mcpPret = false;
const S = {err:{}, at:0};          // feuilles lues (réel)
let M = null, MOISK = [];           // modèle normalisé affiché
const notes = {};                   // messages de confirmation par écran
const resumes = {};                 // résumés d'une page lus sur Drive
let PERSO = {}; try { PERSO = JSON.parse(localStorage.getItem("qg-usine-perso") || "{}"); } catch(e) {}
const savePerso = () => { try { localStorage.setItem("qg-usine-perso", JSON.stringify(PERSO)); } catch(e) {} };

function rowsFrom(payload){
  const v = (payload && payload.values) || [];
  if (!v.length) return [];
  const head = v[0].map(h => String(h).trim());
  return v.slice(1).map((r, i) => { const o = {_n: i + 2}; head.forEach((h, j) => o[h] = (r[j] ?? "").toString().trim()); return o; })
          .filter(o => head.some(h => o[h] !== ""));
}
const col = (o, debut) => { const k = Object.keys(o).find(h => h.startsWith(debut)); return k ? o[k] : ""; };
const R = k => (S[k] && S[k].rows) || [];
function errText(e, server){
  switch(e && e.code){
    case "needs_reauth": return `Votre connexion Google a expiré (elle dure une heure). Reconnectez-vous.`;
    case "not_granted": return `Google n'a pas donné l'accès à ${server}. Reconnectez-vous et cochez toutes les cases.`;
    case "no_sheet": return `Le tableau TEST de l'Usine est introuvable avec ce compte Google. Connectez-vous avec le compte de test.`;
    case "many_sheets": return `Plusieurs tableaux portent le nom du tableau TEST : gardez-en un seul (sans rien supprimer, renommez les autres).`;
    case "offline": return `Pas de connexion Internet. Vos vraies données se lisent en ligne ; la Simulation marche hors ligne.`;
    case "server_unavailable": case "rate_limited": case "upstream_error": return `${server} ne répond pas pour le moment. Les dernières données restent affichées.`;
    case "tool_error": return `${server} a refusé la demande : ${e.message || "erreur inconnue"}.`;
    default: return `Problème de connexion avec ${server}${e && e.message ? " : " + e.message : ""}.`;
  }
}

/* ===================== Données réelles → modèle affiché ===================== */
function construireReel(){
  const et = R("et"), qg = R("qg"), dq = R("dq"), pj = R("pj"), pa = R("pa");
  const etR = rub => et.filter(r => r.Rubrique === rub);
  const qgR = rub => qg.filter(r => r["Rubrique"] === rub).map(r => { let d = r["Données"]; try { d = JSON.parse(d); } catch(e) {} return {cle: r["Clé"], per: r["Période"], d, date: r.Date}; });
  // Jour du moteur : la date la plus récente qu'il a écrite (en TEST accéléré, elle peut dépasser la date du jour).
  const dates = et.filter(r => r.Rubrique !== "Calendrier").map(r => r.Date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const jour = dates.at(-1) || iso(new Date());
  const pers = [...qgR("Projet mois"), ...qgR("Agent mois")].map(x => x.per).filter(p => /^\d{4}-\d{2}$/.test(p)).sort();
  const fin = [pers.at(-1) || jour.slice(0, 7), jour.slice(0, 7)].sort().at(-1);
  MOISK = douzeMois(fin); MOIS = MOISK.map(k => MN[+k.slice(5) - 1]);
  const serie = (lignes, cle, champ) => MOISK.map(k => { const x = lignes.find(l => l.cle === cle && l.per === k); return x && x.d && x.d[champ] != null ? x.d[champ] : null; });

  /* Équipe */
  const eqRows = qgR("Équipe");
  const cles = eqRows.length ? eqRows.map(x => x.cle) : Object.keys(EQUIPE_DEFAUT);
  const am = qgR("Agent mois");
  const qual = etR("Qualité des agents"), alertes = qual.filter(r => r.Nom === "Alerte");
  const agents = cles.map(cle => {
    const d = (eqRows.find(x => x.cle === cle) || {}).d || {}, def = EQUIPE_DEFAUT[cle] || [cle, cle, "Autres", ""];
    const poste = d.poste || def[0], ligne = etR("Agent").find(r => r.Nom === poste);
    const q = qual.find(r => r.Nom === cle), examens = q ? (/Historique\s*:\s*(.*)/.exec(q["Détail"]) || [, ""])[1].split(",").map(nombre).filter(v => v != null) : [];
    const ex = ligne ? /(\d+) exécution\(s\), (\d+) échec\(s\), (\d+) tâche/.exec(ligne["Détail"]) : null;
    return {id: cle, poste, prenom: d.prenom || def[1], service: d.service || def[2], role: d.role || def[3], rythme: d.rythme || (ligne ? (ligne["Détail"].split(" · ")[1] || "") : ""),
      niveau: d.niveau || "gratuit", niveauDepuis: d.niveau_depuis || "", remplacant: d.remplacant_demande || "", depuis: d.depuis || "",
      etat: ligne ? ligne["État"] : "", dernierPassage: ligne ? ligne.Date : "", executions: ex ? +ex[1] : null, echecs: ex ? +ex[2] : null, enAttente: ex ? +ex[3] : null,
      taches: serie(am, cle, "taches"), qualite: serie(am, cle, "qualite"), cout: serie(am, cle, "cout_usd"), passages: serie(am, cle, "passages"),
      examens, noteActuelle: q ? nombre(q["État"]) : null, alertes: alertes.filter(a => a["Détail"].startsWith(cle + " ")).map(a => a["Détail"].replace(/^\S+ : /, "")), travail: [], histoire: []};
  });
  const parCle = Object.fromEntries(agents.map(a => [a.id, a])), parPoste = Object.fromEntries(agents.map(a => [a.poste, a]));

  /* Projets */
  const projets = pj.filter(p => p.ID).map(p => {
    const statut = p.Statut || "", s = statut.toLowerCase();
    const arrete = /arr[êe]t|refus|abandon/.test(s);
    const etape = /rentable/.test(s) ? 6 : /en ligne|en test|lanc/.test(s) ? 5 : /aper[cç]u|construction|d[ée]velopp/.test(s) ? 4 : /pr[ée]paration/.test(s) ? 3 : /attente de validation|valid/.test(s) ? 2 : /[ée]tud/.test(s) ? 1 : 0;
    const rt = R("rt").find(r => r.ID === p.ID) || null;
    return {id: p.ID, nom: p["Nom du projet"] || p.ID, type: (p.Type || "").replace(" / outil en ligne", ""), phrase: p["Problème résolu (valeur client)"] || "", concept: col(p, "Concept unique"),
      cible: p["Niche / cible"] || "", note: p["Note totale /35"], creation: p["Date création"], statut, etape, arrete, prochaine: p["Prochaine action"] || "", lienPlan: p["Lien du plan"] || "",
      visiteurs: serie(qgR("Projet mois"), p.ID, "visiteurs"), revenus: serie(qgR("Projet mois"), p.ID, "revenus"), couts: serie(qgR("Projet mois"), p.ID, "depenses"),
      rentab: rt ? {r12: nombre(col(rt, "Revenus estimés 12 mois")), b12: nombre(col(rt, "Bénéfice estimé 12 mois")), pm: nombre(col(rt, "Point mort")), mensuel: nombre(col(rt, "Coûts mensuels")), prix: nombre(col(rt, "Prix")), depart: nombre(col(rt, "Coûts de départ"))} : null,
      scores: Object.keys(p).filter(h => /\/5\b/.test(h)).map(h => [h.replace(/\s*\/5.*$/, ""), nombre(p[h])]), notes: p.Notes || "",
      objectifs: R("ob").filter(o => o.ID === p.ID).map(o => ({mois: o["Mois (1, 2, 3…)"], fin: o["Date de fin du mois"], ind: o["Indicateur (visites, inscriptions, ventes, revenus…)"], obj: o.Objectif, reel: o["Réel"], statut: o.Statut})),
      livrables: qgR("Livrable").filter(l => l.cle === p.ID).map(l => ({genre: l.per, lien: l.d.lien, version: l.d.version})),
      rapports: qgR("Rapport").filter(r => r.cle === p.ID).map(r => ({date: r.per, titre: r.d.titre, qui: r.d.auteur, texte: r.d.texte, lien: r.d.lien})).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
      messages: [], plan: [], decisions: []};
  });
  const parId = Object.fromEntries(projets.map(p => [p.id, p]));
  const nomP = id => parId[id] ? parId[id].nom : "un projet";
  M = {parCle, parId}; // propre() remplace déjà les noms de code par les prénoms et les noms de projet

  /* Décisions : seules les 5 sortes de la règle du patron, encore sans réponse */
  const decisions = dq.filter(r => /attente/i.test(col(r, "Statut")) && !r["RÉPONSE DU PRÉSIDENT"]).map(r => {
    const desc = r.Description || "", type = col(r, "Type"), cat = categorie(type, desc);
    if (!cat) return null;
    const projet = parId[r["Projet (ID)"]] ? r["Projet (ID)"] : (Object.keys(parId).find(id => desc.includes(id)) || "");
    const resume = (/R[ée]sum[ée] d.une page[^h]*(https:\/\/docs\.google\.com\/document\/d\/([\w-]+))/.exec(desc) || []);
    return {n: r._n, cat, projet, titre: CATS[cat] + (projet ? " " + nomP(projet) : ""), texte: propre(desc), options: (r["Options possibles"] || "").split(/\s*\/\s*(?=\d\))/).map(o => o.replace(/^\d\)\s*/, "")).filter(Boolean),
      reco: propre(r["Recommandation de l'agent"] || ""), qui: r.Agent, date: r.Date, resumeLien: resume[1] || "", resumeId: resume[2] || ""};
  }).filter(Boolean);
  decisions.forEach(d => { if (d.projet) parId[d.projet].decisions.push(d); });

  /* Fil de la semaine et plan de chaque projet (tirés de ce que l'équipe a vraiment fait) */
  const fil = qgR("Fil").map(f => ({agent: f.cle, texte: pluriel(typeof f.d === "string" ? f.d : String(f.d)), date: f.per})).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  fil.forEach(f => { const a = parCle[f.agent]; if (a) a.travail.push(f); });
  projets.forEach(p => {
    const plan = [];
    if (p.creation) plan.push(["done", p.creation, "Idée trouvée", `${parCle.veille_strategie ? parCle.veille_strategie.prenom + " (Veille)" : "La Veille"}${p.note ? " : note " + p.note + "/35" : ""}`]);
    const val = dq.find(r => (r["Projet (ID)"] === p.id || (r.Description || "").includes(p.id)) && categorie(col(r, "Type"), r.Description) === 1 && r["RÉPONSE DU PRÉSIDENT"]);
    const vus = new Set();
    fil.filter(f => f.texte.includes(p.nom) && !/appliqué votre réponse|reçu un livrable|relu un livrable/.test(f.texte)).forEach(f => {
      const t = f.texte.replace(" de " + p.nom, "").replace(" pour " + p.nom, ""); if (vus.has(t)) return; vus.add(t);
      const a = parCle[f.agent]; plan.push(["done", f.date, t.charAt(0).toUpperCase() + t.slice(1).replace(/^A /, ""), a ? a.prenom + " (" + posteCourt(a.poste) + ")" : ""]);
    });
    if (val) plan.push(["done", col(val, "Date de traitement") || val.Date, "Validé par vous", ""]);
    plan.sort((a, b) => (a[1] || "").localeCompare(b[1] || ""));
    plan.forEach(x => x[2] = x[2].replace(/^A (\S)/, (m, c) => c.toUpperCase()));
    if (p.decisions.length) plan.push(["now", "Maintenant", "À vous de décider : " + p.decisions[0].titre.toLowerCase(), ""]);
    else if (p.prochaine && !p.arrete) plan.push(["now", "En cours", propre(p.prochaine), ""]);
    ETAPES.slice(p.etape + 1).forEach(e => plan.push(["", "Ensuite", e, ""]));
    p.plan = plan.map(x => [x[0], /^\d{4}/.test(x[1]) ? fmtD(x[1]) : x[1], x[2], x[3]]);
  });

  /* Parler à l'Usine : messages rangés par projet (référence ajoutée à la fin du message envoyé) */
  const messages = pa.map(m => ({date: m.Date, texte: m.Message, reponse: m["Réponse"], statut: m.Statut, type: m.Type, n: m._n}));
  messages.forEach(m => { const p = projets.find(x => m.texte.includes(x.id) || m.texte.includes(x.nom)); if (p) p.messages.push(m); });

  /* Histoire de chaque employé */
  agents.forEach(a => {
    if (a.depuis) a.histoire.push(["done", a.depuis, "Arrivé dans l'équipe", `Poste : ${a.poste}`]);
    if (a.niveauDepuis) a.histoire.push(["done", a.niveauDepuis, `Passé au modèle ${MODELES[a.niveau].nom}`, "Sur votre décision"]);
    if (a.remplacant) a.histoire.push(["done", a.remplacant, "Remplaçant demandé", "Le Directeur général propose quelqu'un, avec une semaine d'essai"]);
    if (a.examens.length) a.histoire.push(["done", a.dernierPassage || jour, `Notes de ses derniers contrôles : ${a.examens.join(", ")} sur 100`, a.alertes[0] ? "Attention : " + a.alertes[0] : ""]);
    a.histoire.sort((x, y) => (x[1] || "").localeCompare(y[1] || ""));
    a.histoire = a.histoire.map(h => [h[0], fmtD(h[1]), h[2], h[3]]);
  });

  /* Argent */
  const lire = (rub, nom) => et.find(r => r.Rubrique === rub && r.Nom === nom) || {};
  const ia = lire("Moteur", "Coût IA du mois"), dp = lire("Moteur", "Dépenses des projets du mois"), plan = lire("Plan", "Projets actifs");
  const objTxt = /Pas encore d'objectif/.test(plan["Détail"] || "") ? "" : ((/(Pour [^.]*\.)/.exec(plan["Détail"] || "") || [])[1] || "");
  const coutIA = MOISK.map((k, i) => { const v = agents.map(a => a.cout[i]).filter(x => x != null); return v.length ? sum(v) : null; });
  const iMois = MOISK.indexOf(jour.slice(0, 7)); if (iMois >= 0 && nombre(ia["État"]) != null) coutIA[iMois] = nombre(ia["État"]);
  const depenses = R("dp").map(d => ({date: d.Date, projet: d["Projet (ID)"], montant: nombre(d["Montant (€)"]) || 0, objet: d.Objet, mois: d.Mois, accord: d["Accord du Président"]}));

  /* Bibliothèque */
  const fiches = R("bi").filter(f => f.ID).map(f => ({id: f.ID, titre: f.Titre, rayon: f.Domaine || "Autres", livre: f["Étape du processus"] || "Toutes", version: f.Version, statut: col(f, "Statut"), preuve: col(f, "Niveau de preuve"),
    agents: f["Agents qui l'utilisent"], types: f["Types de projets"], lien: f.Lien, revision: f["Dernière révision"], applications: f["Nb d'applications"], reussite: f["Taux de réussite"], notes: f.Notes,
    projets: [...new Set(R("ap").filter(a => a["Fiche (ID)"] === f.ID).map(a => a["Projet (ID)"]))].map(nomP)}));
  const lacunes = R("la").map(l => ({quoi: propre(l.Quoi), pourquoi: propre(l.Pourquoi), prudence: propre(col(l, "Option prudente")), statut: col(l, "Statut"), bloquante: /oui/i.test(col(l, "Bloquante")), date: l.Date, qui: l.Agent}));
  const idees = R("id").map(i => ({titre: i.Titre, type: (i.Type || "").replace(" / outil en ligne", ""), decision: col(i, "Décision"), note: i["Note /35"], confiance: nombre(i["Confiance (%)"]), date: i.Date, source: col(i, "Source"), lien: i["Lien du document"], statut: i.Statut, description: i.Description}));
  const ilYa7 = iso(new Date(dateD(jour).getTime() - 7 * 864e5));
  const semaine = fiches.filter(f => /valid/i.test(f.statut) && f.revision >= ilYa7 && /directeur g[ée]n[ée]ral/i.test(f.notes || ""));

  /* L'Usine (les coulisses) */
  const usine = {
    moteur: etR("Moteur"), securite: etR("Sécurité"), sante: etR("Santé"),
    outils: R("ou").map(o => ({fonction: o.Fonction, principal: o["Outil principal"], secours: o["Outil de secours"], gratuit: col(o, "Gratuit"), statut: col(o, "Statut"), compte: col(o, "Compte"), qui: o["Agent responsable"], notes: o.Notes})),
    calendrier: etR("Calendrier").map(c => ({jour: c["Détail"], date: c.Date, agents: c.Nom.split(",").map(x => x.trim()).filter(Boolean)})),
    pret: etR("Prêt pour le réel"), veille: etR("Veille concurrentielle"), alertes,
  };
  return {mode: "reel", jour, agents, parCle, parPoste, projets, parId, decisions, fil, messages,
    argent: {ia: nombre(ia["État"]), iaPlafond: ia["Détail"] || "", dep: nombre(dp["État"]), depPlafond: dp["Détail"] || "", objectif: objTxt, planDetail: plan["Détail"] || "", coutIA, depenses},
    biblio: {fiches, lacunes, idees, semaine}, usine, qgAbsent: !qg.length};
}
/* Remplace le jargon par des mots simples : numéros de tâche, numéros de mission, adresses, noms de code des agents. */
function propre(s){
  let t = String(s || "");
  t = t.replace(/\s*\[T-\d+\]/g, "").replace(/\s*\[TEST – pas GO\]/g, "").replace(/\s*\((?:moment|question|mission|Charte)\s*[^)]*\)/gi, "")
       .replace(/\b(?:mission|moment|question)\s+\d+(?:\s*§\s*\d+)?\b\s*:?\s*/gi, "").replace(/https?:\/\/\S+/g, "").replace(/\bdocs\/[\w./-]+\.md\b,?/g, "")
       .replace(/R[ée]sum[ée] d.une page \(à lire avant de répondre\)\s*:\s*\.?/g, "").replace(/[ÉE]tude de march[ée]\s*:\s*\.?/g, "");
  if (M && M.parCle) t = t.replace(/\b([a-z]+(?:_[a-z]+)*)\b/g, (m, k) => M.parCle[k] ? M.parCle[k].prenom : m);
  if (M && M.parId){ t = t.replace(/\b(?:TEST-)?P\d{3}\b/g, id => M.parId[id] ? M.parId[id].nom : id); Object.values(M.parId).forEach(p => { t = t.split(`${p.nom} « ${p.nom} »`).join(`« ${p.nom} »`); }); }
  t = t.replace(/Environnement Usine à projets – TEST\s*:\s*/g, "").replace(/Le jeton Google/g, "L'accès du moteur à Google").replace(/\bjeton\b/gi, "accès")
       .replace(/VALIDÉES/g, "validées").replace(/VALIDÉE/g, "validée").replace(/PROPOSITIONS/g, "propositions").replace(/PROPOSITION/g, "proposition").replace(/dans l'Index/g, "dans la Bibliothèque")
       .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, d => fmtD(d)).replace(/(\d)\.(\d+)\s*(€|\$)/g, "$1,$2 $3");
  t = pluriel(t);
  return t.replace(/\s{2,}/g, " ").replace(/\s+([.,])/g, "$1").replace(/\.\s*\./g, ".").trim();
}

function pluriel(s){ return String(s || "").replace(/(\d+)\s+([\p{L}'-]+)\(s\)(?:\s+([\p{L}-]+)\(s\))?/gu, (m, n, a, b) => { const p = +n > 1 ? "s" : ""; return `${n} ${a}${p}${b ? " " + b + p : ""}`; }).replace(/\(s\)/g, ""); }

/* ===================== Simulation : les données d'exemple du modèle ===================== */
function construireSim(){
  MOIS = ["nov.","déc.","janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct."];
  MOISK = douzeMois("2026-10");
  const N = null;
  const P = (id, nom, type, phrase, etape, statut, vis, rev, cou, objectif, plan, rapports, messages, extra = {}) => ({id, nom, type, phrase, concept: "", etape, statut, arrete: !!extra.arrete,
    visiteurs: vis, revenus: rev, couts: cou, objectif, prochaine: "", plan, rapports: rapports.map(([date, titre, qui, texte]) => ({date, titre, qui, texte})),
    messages: messages.map(([w, t, d]) => w === "me" ? {texte: t, date: d, reponse: "", statut: "Traité"} : {texte: "", reponse: t, date: d, statut: "Traité"}),
    livrables: [{genre: "Étude de marché", lien: "", version: 2}, {genre: "Cahier des charges", lien: "", version: 1}, {genre: "Identité visuelle", lien: "", version: 1}].concat(etape >= 4 ? [{genre: "Aperçu du site", lien: "", version: 1}, {genre: "Fiche technique", lien: "", version: 1}] : []),
    decisions: [], rentab: null, objectifs: [], ...extra});
  const projets = [
    P("P001","PDF Sans Fuite","SaaS","Convertir ses PDF sans jamais envoyer ses fichiers sur Internet.",6,"Rentable",[0,0,0,320,780,1400,2100,2900,3600,4300,5200,6100],[0,0,0,0,0,45,90,160,230,310,390,480],[4,6,8,12,10,9,9,10,11,12,12,13],"500 € par mois avant décembre",
      [["done","nov. 2025","Idée trouvée","Yasmine (Veille) : note 29/35"],["done","déc.","Étude de marché","Omar : 7 concurrents, aucun 100 % local"],["done","janv.","Validé par vous",""],["done","févr.","Site construit","Mehdi (Développeur)"],["done","mars","Test de 14 jours","41 inscrits pour 30 visés"],["done","avr.","Premiers abonnés payants","Rentable depuis avril"],["now","21 oct.","Version anglaise","Inès (Contenu)"],["","28 oct.","Partenariats avec 2 blogs juridiques","Sami (Marketing)"]],
      [["17 oct.","Bilan d'octobre","Lina (Analyste)","26 abonnés payants (+4). Revenu du mois : 480 € (+23 %). Coût du mois : 13 €. La page de prix B convertit 22 % de mieux : elle est gardée."],["30 sept.","Bilan de septembre","Lina (Analyste)","22 abonnés, 390 € de revenu. Les visiteurs viennent surtout de Google (64 %)."]],
      [["me","Où en sont les abonnements ?","12 oct."],["them","26 abonnés payants, 4 de plus que le mois dernier. Revenu du mois : 480 €.","12 oct. · Lina"]]),
    P("P002","Planner crochet","Produit numérique","Un agenda imprimable pour suivre ses ouvrages au crochet, vendu sur Etsy.",6,"Rentable",[N,N,N,0,0,150,420,640,800,900,950,1020],[N,N,N,0,0,0,18,36,54,63,70,77],[N,N,N,3,4,5,4,3,3,3,3,3],"100 € par mois avant janvier",
      [["done","févr.","Idée trouvée","Yasmine (Veille)"],["done","avr.","Boutique Etsy prête","Nadia (Designer)"],["done","mai","Premières ventes",""],["now","25 oct.","Pack de 3 agendas","Omar (Chef de produit)"]],
      [["9 oct.","Bilan d'octobre","Lina (Analyste)","14 ventes à 5,50 €, soit 77 €. Les épingles de Noël marchent bien."]], []),
    P("P003","Tatoo Idées","Blog","Un blog d'idées de tatouages, nourri par Pinterest et payé par la publicité.",5,"En test",[N,N,N,N,0,0,800,2400,5100,8800,12500,16000],[N,N,N,N,0,0,0,6,14,27,41,58],[N,N,N,N,6,8,7,7,7,7,7,7],"20 000 visiteurs par mois",
      [["done","mars","Idée et étude",""],["done","mai","En ligne",""],["now","oct.","Test en cours","40 articles, 16 000 visiteurs"]],
      [["15 oct.","Trafic d'octobre","Lina (Analyste)","16 000 visiteurs (+28 %). Revenu publicitaire : 3,60 € pour 1 000 visites."]], []),
    P("P004","Juste Prix Freelance","SaaS","Calculer le bon prix de sa prestation de freelance en 2 minutes.",4,"Aperçu prêt",[N,N,N,N,N,N,N,N,0,0,0,0],[N,N,N,N,N,N,N,N,0,0,0,0],[N,N,N,N,N,N,N,N,5,6,7,8],"30 inscriptions en 14 jours",
      [["done","juil.","Idée trouvée",""],["done","sept.","Validé par vous",""],["now","16 oct.","Aperçu privé terminé","Mehdi : tous les contrôles au vert"]],
      [["16 oct.","Aperçu prêt","Mehdi (Développeur)","Le site fonctionne sur ordinateur et téléphone. Il ne manque que votre accord."]], [],
      {note: "28", scores: [["Valeur client", 4], ["Demande", 4], ["Concurrence", 2], ["Rentabilité", 4], ["Originalité", 4]], notes: "Beaucoup de calculateurs gratuits en anglais", rentab: {depart: 0, mensuel: 5, prix: 9, pm: 3, r12: 1080, b12: 1020}}),
    P("P005","Feuilles Pro Arabe","Produit numérique","Des modèles Google Sheets pour les commerçants, en arabe et en français.",2,"Étude finie",[N,N,N,N,N,N,N,N,N,N,0,0],[N,N,N,N,N,N,N,N,N,N,0,0],[N,N,N,N,N,N,N,N,N,N,2,3],"Prouver qu'il existe une vraie demande",
      [["done","sept.","Idée trouvée","Yasmine"],["now","17 oct.","Étude de marché finie","Omar : 6 concurrents, presque aucun en arabe"]],
      [["17 oct.","Résumé du projet","Omar (Chef de produit)","Des modèles de factures et de stock prêts à l'emploi pour les petits commerçants. Test proposé : 20 ventes en 30 jours, 15 € de budget."]], [],
      {note: "27", scores: [["Valeur client", 4], ["Demande", 3], ["Concurrence", 4], ["Rentabilité", 3], ["Originalité", 5]], notes: "Il faudra relire chaque modèle en arabe avant la vente", rentab: {depart: 15, mensuel: 0, prix: 12, pm: 2, r12: 720, b12: 705}}),
    P("P006","Image Express","SaaS","Un convertisseur d'images rapide.",5,"Arrêté",[N,0,0,90,140,160,170,N,N,N,N,N],[N,0,0,0,0,0,0,N,N,N,N,N],[N,5,7,6,5,4,3,N,N,N,N,N],"Arrêté en mai : trop de concurrents gratuits",
      [["done","déc.","Idée",""],["done","févr.","En ligne",""],["done","mai","Arrêté après le test","Leçon ajoutée à la Bibliothèque"]],
      [["mai","Pourquoi on arrête","Karim (Directeur général)","170 visiteurs après 3 mois, aucun inscrit. Leçon : vérifier la concurrence gratuite avant de construire."]], [], {arrete: true}),
  ];
  const resumeSim = "# Juste Prix Freelance\n**Quoi :** un calculateur de prix pour les freelances.\n**Pour qui :** les indépendants qui débutent.\n- Concurrence : peu d'outils en français.\n- Test : 30 inscriptions en 14 jours.\n- Budget : 0 €, tout est gratuit.";
  const decisions = [
    {n: "s1", cat: 2, projet: "P004", date: "2026-10-16", qui: "Mehdi (Développeur)", titre: "Valider l'aperçu du site Juste Prix Freelance", texte: "L'aperçu privé est prêt : il fonctionne sur ordinateur et téléphone.", options: ["Valider l'aperçu", "Demander des corrections"], reco: "Valider.", resumeSim},
    {n: "s2", cat: 1, projet: "P005", date: "2026-10-17", qui: "Omar (Chef de produit)", titre: "Valider le projet Feuilles Pro Arabe", texte: "Étude de marché finie : forte concurrence en anglais, presque rien en arabe.", options: ["Valider le projet", "Le garder en réserve", "Refuser"], reco: "Valider.", resumeSim: "# Feuilles Pro Arabe\n**Quoi :** des modèles de factures et de stock.\n- Pour qui : les petits commerçants.\n- Test : 20 ventes en 30 jours, 15 € de budget."},
  ];
  decisions.forEach(d => projets.find(p => p.id === d.projet).decisions.push(d));
  const SVC = {karim:"Direction", yasmine:"Recherche & Stratégie", omar:"Produit & Technique", mehdi:"Produit & Technique", nadia:"Produit & Technique", ines:"Croissance", sami:"Croissance", lina:"Finance & Performance", hamza:"Opérations"};
  const A = (id, prenom, poste, niveau, depuis, role, taches, qualite, cout, travail, histoire) => ({id, prenom, poste, service: SVC[id], niveau, depuis, role, rythme: "", taches, qualite: qualite.map(v => v || null), cout: cout.map((v, i) => qualite[i] ? v : null),
    passages: taches, travail: travail.map(t => ({texte: t, date: "2026-10-16"})), histoire, examens: [], alertes: [], etat: "Réussi"});
  const agents = [
    A("karim","Karim","Directeur général","standard","nov. 2025","Coordonne l'équipe et prépare vos décisions.",[6,8,9,11,12,12,13,14,14,15,15,16],[82,84,85,87,88,90,91,91,92,93,93,94],[0.2,0.25,0.3,0.32,0.35,0.36,0.38,0.38,0.4,0.41,0.42,0.42],["a écrit 4 bilans de projet","a préparé 2 décisions pour vous"],[["done","nov. 2025","Embauché",""],["done","mai","A proposé d'arrêter Image Express","Économie estimée : 30 € par mois"]]),
    A("yasmine","Yasmine","Veille & Stratégie","standard","nov. 2025","Trouve les idées et les note.",[9,10,10,11,10,9,10,11,10,9,9,9],[76,78,80,83,84,85,86,87,87,88,88,88],[0.3,0.3,0.32,0.33,0.34,0.34,0.35,0.35,0.36,0.36,0.36,0.36],["a noté 9 idées","a retenu Feuilles Pro Arabe"],[["done","nov. 2025","Embauchée",""],["done","déc.","A trouvé PDF Sans Fuite",""]]),
    A("omar","Omar","Chef de produit","standard","nov. 2025","Études de marché, cahiers des charges, prix.",[3,4,5,5,6,6,6,7,7,7,8,8],[80,82,84,85,86,87,88,89,89,90,91,91],[0.3,0.32,0.35,0.38,0.4,0.42,0.44,0.46,0.48,0.49,0.5,0.51],["a fini l'étude de Feuilles Pro Arabe","a lancé la formule « Équipe » de PDF Sans Fuite"],[["done","nov. 2025","Embauché",""]]),
    A("mehdi","Mehdi","Développeur","expert","nov. 2025","Construit et teste les sites.",[2,3,5,6,6,7,8,8,9,9,10,10],[70,72,75,78,80,81,83,84,84,85,86,86],[0.5,0.55,0.6,0.65,0.7,0.72,0.75,0.78,0.8,0.82,0.85,0.88],["a terminé l'aperçu de Juste Prix Freelance"],[["done","nov. 2025","Embauché (modèle Sonnet)",""],["done","févr.","Passé au modèle Opus","La qualité est passée de 72 à 78 en un mois"]]),
    A("nadia","Nadia","Designer","standard","déc. 2025","Identité visuelle des projets.",[0,2,3,3,4,4,4,5,5,5,5,5],[0,85,86,87,88,89,90,90,91,91,92,92],[0,0.1,0.12,0.13,0.14,0.15,0.16,0.17,0.18,0.18,0.19,0.19],["a fait la version Noël du Planner crochet"],[["done","déc. 2025","Embauchée",""]]),
    A("ines","Inès","Contenu","standard","janv. 2026","Articles et textes.",[0,0,6,8,9,10,10,11,11,11,11,11],[0,0,82,84,85,86,87,88,88,89,89,89],[0,0,0.4,0.45,0.5,0.55,0.58,0.6,0.62,0.63,0.64,0.64],["a écrit 11 articles"],[["done","janv. 2026","Embauchée",""]]),
    A("sami","Sami","Marketing","gratuit","janv. 2026","Pinterest et partenariats.",[0,0,20,40,55,60,65,70,72,74,75,75],[0,0,72,73,74,75,76,76,77,77,78,78],[0,0,0,0,0,0,0,0,0,0,0,0],["a publié 75 épingles Pinterest"],[["done","janv. 2026","Embauché (modèle gratuit)",""],["done","sept.","Qualité sous 80 depuis 9 mois","À vous de voir : augmenter son modèle ?"]]),
    A("lina","Lina","Analyste","gratuit","nov. 2025","Chiffres, rapports, tests A/B.",[2,2,3,3,4,4,4,4,4,4,4,4],[90,91,92,92,93,93,94,94,95,95,95,95],[0,0,0,0,0,0,0,0,0,0,0,0.18],["a écrit le bilan d'octobre : +23 % de revenus"],[["done","nov. 2025","Embauchée",""]]),
    A("hamza","Hamza","Maintenance","gratuit","nov. 2025","Contrôles, sauvegardes, secours.",[30,31,31,28,31,30,31,31,30,31,30,31],[97,97,98,98,98,99,99,99,99,99,99,99],[0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05,0.05],["a fait 31 contrôles","a réglé seul 3 pannes"],[["done","nov. 2025","Embauché",""]]),
  ];
  agents.forEach(a => { const p = PERSO[a.id] || {}; if (p.prenom) a.prenom = p.prenom; if (p.niveau) a.niveau = p.niveau; });
  const fil = [["omar","a lancé la formule « Équipe » de PDF Sans Fuite","2026-10-14"],["mehdi","a terminé l'aperçu de Juste Prix Freelance","2026-10-16"],["omar","a fini l'étude de Feuilles Pro Arabe","2026-10-17"],["lina","a écrit le bilan d'octobre : +23 % de revenus","2026-10-17"]].map(([agent, texte, date]) => ({agent, texte, date})).reverse();
  const totCost = MOIS.map((_, i) => sum(projets.map(p => p.couts[i])));
  const fiches = [
    {id:"S1", titre:"Vérifier la concurrence gratuite avant de construire", rayon:"Fondations", livre:"Validation", version:"v2", statut:"VALIDÉE", preuve:"A", agents:"Veille & Stratégie", types:"Tous", lien:"", revision:"2026-10-15", applications:"6", reussite:"83 %", notes:"Validée par le Directeur général", projets:["PDF Sans Fuite","Juste Prix Freelance"]},
    {id:"S2", titre:"Écrire une page de prix claire", rayon:"SaaS & Produit", livre:"Préparation", version:"v1", statut:"VALIDÉE", preuve:"B", agents:"Chef de produit", types:"SaaS", lien:"", revision:"2026-09-02", applications:"3", reussite:"67 %", notes:"", projets:["PDF Sans Fuite"]},
    {id:"S3", titre:"Épingles Pinterest de saison", rayon:"Croissance", livre:"Croissance", version:"v1", statut:"PROPOSITION", preuve:"C", agents:"Marketing", types:"Produit numérique", lien:"", revision:"2026-10-10", applications:"1", reussite:"", notes:"", projets:["Planner crochet"]},
  ];
  return {mode: "sim", jour: "2026-10-18", agents, parCle: Object.fromEntries(agents.map(a => [a.id, a])), projets, parId: Object.fromEntries(projets.map(p => [p.id, p])), decisions, fil, messages: [],
    argent: {ia: 3.65, iaPlafond: "Plafond : 2,68 $ par jour", dep: totCost[11], depPlafond: "Plafond : 20 € par mois, rien sans votre accord", objectif: "1 000 € de bénéfice par mois en avril 2027.", sim: true,
      coutIA: MOIS.map((_, i) => sum(agents.map(a => a.cout[i]))), depenses: [{date:"2026-10-02", projet:"P001", montant:12, objet:"Hébergement", mois:"2026-10"},{date:"2026-09-12", projet:"P002", montant:10, objet:"Nom de domaine", mois:"2026-09"}]},
    biblio: {fiches, lacunes: [{quoi:"Pas de fiche sur les partenariats avec des blogs", pourquoi:"Sami en a besoin pour PDF Sans Fuite", prudence:"Il avance avec les règles de base en attendant", statut:"Ouverte", bloquante:false, date:"2026-10-12", qui:"sami"}],
      idees: [{titre:"Feuilles Pro Arabe", type:"Produit numérique", decision:"GO", note:"27", confiance:70, date:"2026-09-20", source:"Veille", statut:"Étudiée", description:"Des modèles Google Sheets en arabe."},{titre:"Menu de restaurant en QR", type:"SaaS", decision:"NON", note:"18", confiance:60, date:"2026-10-01", source:"Veille", statut:"Étudiée", description:"Trop de concurrents gratuits."}],
      semaine: [fiches[0]]},
    usine: {moteur: [{Nom:"Dernière journée", "État":"Réussi", "Détail":"Tout a tourné normalement", Date:"2026-10-18"}], securite: [{Nom:"Surveillance", "État":"Tout va bien", "Détail":"Aucune dépense, aucun accès ni comportement anormal", Date:"2026-10-18"}], sante: [],
      outils: [{fonction:"Hébergement des sites", principal:"Cloudflare Pages", secours:"Netlify", gratuit:"Oui", statut:"Actif", qui:"Développeur"},{fonction:"Paiement", principal:"Stripe", secours:"Lemon Squeezy", gratuit:"Commission par vente", statut:"Actif", qui:"Finance"},{fonction:"Navigateur automatique", principal:"Playwright", secours:"Captures manuelles", gratuit:"Oui", statut:"Actif", qui:"Chef de produit"}],
      calendrier: ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"].map((j, i) => ({jour: j, date: iso(new Date(2026, 9, 19 + i)), agents: ["Maintenance","Secrétariat"].concat(i === 0 ? ["Directeur général"] : i === 4 ? ["Analyste (suivi)"] : [])})),
      pret: [{Nom:"Décision", "État":"OUI", "Détail":"Tout est prêt"}], veille: [{Nom:"collecteur", "État":"Actif", "Détail":"principal playwright, secours crawl4ai"}], alertes: []}};
}

/* ===================== Écrans ===================== */
const prenomDe = cle => M.parCle[cle] ? M.parCle[cle].prenom : (EQUIPE_DEFAUT[cle] ? EQUIPE_DEFAUT[cle][1] : "L'équipe");
const parPosteOuNom = nom => M.agents.find(a => a.poste === nom || a.id === nom || a.prenom === nom);
const actifs = () => M.projets.filter(p => !p.arrete);
const totRev = () => MOISK.map((_, i) => { const v = M.projets.map(p => p.revenus[i]).filter(x => x != null); return v.length ? sum(v) : null; });
const totCost = () => MOISK.map((_, i) => { const v = M.projets.map(p => p.couts[i]).filter(x => x != null); return v.length ? sum(v) : null; });
const benefSerie = () => { const r = totRev(), c = totCost(); return MOISK.map((_, i) => r[i] == null && c[i] == null ? null : (r[i] || 0) - (c[i] || 0)); };
const visitSerie = () => MOISK.map((_, i) => { const v = M.projets.map(p => p.visiteurs[i]).filter(x => x != null); return v.length ? sum(v) : null; });
const qualSerie = (as = M.agents) => MOISK.map((_, i) => { const q = as.map(a => a.qualite[i]).filter(v => v != null); return q.length ? Math.round(sum(q) / q.length) : null; });
const tachesSerie = (as = M.agents) => MOISK.map((_, i) => { const q = as.map(a => a.taches[i]).filter(v => v != null); return q.length ? sum(q) : null; });
const coutSerie = (as = M.agents) => MOISK.map((_, i) => { const q = as.map(a => a.cout[i]).filter(v => v != null); return q.length ? sum(q) : null; });
const services = () => { const g = {}; M.agents.forEach(a => (g[a.service] ||= []).push(a)); return Object.entries(g); };
const serviceIdx = a => services().findIndex(([s]) => s === a.service);
const enLigne = p => p.visiteurs.some(v => v != null);
const pasDeVisiteurs = p => p.arrete ? "Projet arrêté." : "Pas encore de visiteurs : le site n'est pas en ligne.";
const pasDeRevenus = p => p.arrete ? "Projet arrêté." : enLigne(p) ? "Pas encore de revenus." : "Pas encore de revenus : rien n'est en vente.";
const statutPill = p => p.decisions.length ? ["À décider","info"] : p.arrete ? [p.statut || "Arrêté","off"] : p.etape === 6 ? [p.statut,"good"] : p.etape === 5 ? [p.statut,"warn"] : [p.statut || ETAPES[p.etape],"info"];
const qualiteDe = a => a.noteActuelle != null ? a.noteActuelle : dernier(a.qualite);
const pillQualite = q => q == null ? `<span class="pill off">Pas encore noté</span>` : `<span class="pill ${q >= 85 ? "good" : q >= 75 ? "warn" : "bad"}">${q >= 85 ? "Très bien" : q >= 75 ? "Correct" : "À surveiller"}</span>`;
// Une confirmation reste affichée sur son écran (même quand les données se relisent) jusqu'au changement d'écran.
const noteEcran = k => { const n = notes[k]; if (!n) return ""; n.t0 ||= Date.now(); return `<div class="note ${n.cls || ""}" role="status">${esc(n.t)}</div>`; };
const enSim = () => MODE === "sim";
const lienDoc = (lien, t = "Ouvrir") => lien ? `<a class="btn" href="${esc(lien)}" target="_blank" rel="noopener">${t} ↗</a>` : "";
const maj = s => String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
const aujourdhui = () => maj(new Date().toLocaleDateString("fr-FR", {weekday: "long", day: "numeric", month: "long"}));
const journeeSimulee = () => { const d = dateD(M.jour); return d ? `Journée simulée : ${d.toLocaleDateString("fr-FR", {day: "numeric", month: "long"})}` : ""; };
const de = n => /^[aeiouyhàâéèêîôûAEIOUYHÀÂÉÈÊÎÔÛ]/.test(n) ? "d'" + n : "de " + n;
const posteCourt = p => String(p || "").replace(/\s*\(.*\)/, "");

const VUES = {
  decisions(){
    const d = M.decisions;
    return { crumbs: [["Mes décisions"]], html: `<div><h1>Vos décisions</h1><p class="lead">Seulement ce qui a besoin du patron : valider un projet, valider un aperçu, décider après un test, dépenser de l'argent réel, ou un problème grave. Le reste, l'équipe le règle.</p></div>
      ${noteEcran("decisions")}
      ${d.length ? `<div class="rows">${d.map(x => `<a class="rowl" href="#${x.projet ? `projets.${x.projet}.decision` : `decisions.${x.n}`}"><span class="avatar">${esc((x.projet ? M.parId[x.projet].nom : x.titre)[0])}</span><span class="tx"><b>${esc(x.titre)}</b><span>${esc(x.texte.slice(0, 140))}${x.texte.length > 140 ? "…" : ""}</span></span><span class="go">›</span></a>`).join("")}</div>` : vide("Aucune décision en attente. L'équipe avance.")}`};
  },
  projets(){
    const list = M.projets.slice().sort((a, b) => (a.arrete - b.arrete) || (b.decisions.length - a.decisions.length) || (b.etape - a.etape));
    return { crumbs: [["Mes projets"]], html: `<div><h1>Mes projets</h1><p class="lead">Cliquez sur un projet pour l'ouvrir.</p></div>
      ${list.length ? `<div class="rows">${list.map(p => { const st = statutPill(p); return `
        <a class="rowl" href="#projets.${esc(p.id)}" style="${p.arrete ? "opacity:.6" : ""}"><span class="avatar">${esc(p.nom[0])}</span>
          <span class="tx"><b>${esc(p.nom)}</b><span>${esc(p.type)} · ${ETAPES[p.etape]}</span><div style="margin-top:6px;max-width:260px">${stepsMini(p.etape, p.arrete)}</div></span>
          ${p.revenus.some(v => v) ? `<span style="text-align:right">${spark(p.revenus)}${tendance(p.revenus)}</span>` : ""}
          <span class="pill ${st[1]}">${esc(st[0])}</span><span class="go">›</span></a>`; }).join("")}</div>` : vide("Pas encore de projet : la Veille cherche des idées. Elles sont dans la Boîte à idées de la Bibliothèque.")}`};
  },
  projet(p){
    const rev = sum(p.revenus), cost = sum(p.couts), b = rev - cost, now = p.plan.find(x => x[0] === "now"), st = statutPill(p);
    const vis = dernier(p.visiteurs), re = dernier(p.revenus), pm = p.decisions[0];
    return { crumbs: [["Mes projets", "projets"], [p.nom]], html: `
      <div class="card" style="display:flex;flex-direction:column;gap:18px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div style="min-width:0"><h1>${esc(p.nom)}</h1><p class="lead">${esc(p.concept || p.phrase)}</p></div><span class="pill ${st[1]}">${esc(st[0])}</span></div>${stepsBig(p.etape, p.arrete)}</div>
      ${pm ? `<div class="decide"><div><b>À vous de décider</b><div style="opacity:.9">${esc(pm.titre)}</div></div><a class="btn" href="#projets.${esc(p.id)}.decision">Lire le résumé et décider</a></div>` : ""}
      <div class="mini">
        <div class="kpi"><div class="k">Visiteurs du mois</div>${vis != null ? `<div class="v">${vis.toLocaleString("fr-FR")}</div>${tendance(p.visiteurs)}${spark(p.visiteurs)}` : `<div class="v txt">Pas encore</div><span class="sub">${pasDeVisiteurs(p)}</span>`}</div>
        <div class="kpi"><div class="k">Revenus du mois</div>${re != null ? `<div class="v">${eur(re)}</div>${tendance(p.revenus)}${spark(p.revenus)}` : `<div class="v txt">Pas encore</div><span class="sub">${pasDeRevenus(p)}</span>`}</div>
        <div class="kpi"><div class="k">Dépensé depuis le début</div><div class="v ${cost ? "down" : ""}">${eur(cost)}</div>${tendance(p.couts, true)}${spark(p.couts, "var(--cost)")}</div>
      </div>
      <div class="tiles">
        ${tile(`projets.${p.id}.plan`, "plan", "Le plan", now ? `En cours : ${now[2]}` : "Toutes les étapes")}
        ${tile(`projets.${p.id}.evolution`, "evol", "Évolution et rentabilité", rev || cost ? `Bénéfice : ${signe(b)}` : p.rentab && p.rentab.r12 != null ? `Prévu : ${eur(p.rentab.r12)} sur 12 mois` : "Les courbes sur 12 mois")}
        ${tile(`projets.${p.id}.rapports`, "rapports", "Rapports", p.rapports.length ? `${p.rapports.length} rapport${p.rapports.length > 1 ? "s" : ""}${p.rapports[0].date ? " · dernier le " + fmtD(p.rapports[0].date) : ""}` : "Pas encore de rapport")}
        ${tile(`projets.${p.id}.messages`, "messages", "Parler de ce projet", p.messages.length ? `${p.messages.length} message${p.messages.length > 1 ? "s" : ""}` : "Poser une question, donner un ordre")}
        ${tile(`projets.${p.id}.livrables`, "travail", "Livrables", `${p.livrables.length} document${p.livrables.length > 1 ? "s" : ""} : étude, cahier des charges, identité…`)}
      </div>`};
  },
  "projet.decision"(p){ const x = p.decisions[0]; return x ? VUES.decision(x) : null; },
  "projet.plan"(p){
    const obj = p.objectif || (p.objectifs.length ? p.objectifs.filter(o => o.mois === p.objectifs[0].mois).map(o => `${o.obj} ${o.ind}`).join(", ") + ` à la fin du mois ${p.objectifs[0].mois}` : "");
    return { crumbs: [["Mes projets", "projets"], [p.nom, "projets." + p.id], ["Le plan"]], html: `<div><h1>Le plan</h1>${obj ? `<p class="lead">Objectif : <b style="color:var(--ink)">${esc(obj)}</b></p>` : ""}</div>
      <div class="card"><ul class="tl">${p.plan.map(([s, d, t, x]) => `<li class="${s}"><span class="d">${esc(d)}</span><b>${esc(t)}</b>${x ? `<span class="sub">${esc(x)}</span>` : ""}</li>`).join("")}</ul></div>
      ${p.objectifs.length ? `<div class="card"><h2 style="margin-bottom:10px">Les objectifs mois par mois</h2><div class="rows" style="border:0">${[...new Set(p.objectifs.map(o => o.mois))].map(m => { const l = p.objectifs.filter(o => o.mois === m); return `<div class="rowl"><span class="tx"><b>Mois ${esc(m)}${l[0].fin ? " (jusqu'au " + fmtD(l[0].fin) + ")" : ""}</b><span>${l.map(o => `${esc(o.obj)} ${esc(o.ind)}${o.reel ? " (réel : " + esc(o.reel) + ")" : ""}`).join(" · ")}</span></span></div>`; }).join("")}</div></div>` : ""}
      ${lienDoc(p.lienPlan, "Ouvrir le plan complet")}`};
  },
  "projet.evolution"(p){
    const rev = sum(p.revenus), cost = sum(p.couts), b = rev - cost, c = cumul(p.revenus.map((r, i) => r == null && p.couts[i] == null ? null : (r || 0) - (p.couts[i] || 0)));
    const cv = c.filter(v => v != null), mn = Math.min(0, ...cv), mx = Math.max(0, ...cv);
    return { crumbs: [["Mes projets", "projets"], [p.nom, "projets." + p.id], ["Évolution"]], html: `<div><h1>Évolution et rentabilité</h1><p class="lead">${!rev && !p.arrete ? pasDeRevenus(p) + " Voici ce qui est dépensé, et ce que l'étude prévoit." : b >= 0 ? "Le projet a déjà rapporté plus qu'il n'a coûté." : p.arrete ? "Projet arrêté : ce qu'il a coûté." : "Le projet n'a pas encore remboursé ce qu'il a coûté."}</p></div>
      <div class="kpis">${kpi("Dépensé", eur(cost))}${kpi("Gagné", eur(rev))}${kpi("Bénéfice", signe(b), b > 0 ? "up" : b < 0 ? "down" : "")}</div>
      ${p.rentab ? `<div class="card"><h2>Ce que l'étude prévoit</h2><p class="sub" style="margin:4px 0 12px">Une prévision, pas un résultat : elle sera comparée aux vrais chiffres dès la mise en ligne.</p><div class="kpis">${p.rentab.r12 != null ? kpi("Revenus sur 12 mois", eur(p.rentab.r12)) : ""}${p.rentab.b12 != null ? kpi("Bénéfice sur 12 mois", signe(p.rentab.b12), "up") : ""}${p.rentab.pm != null ? kpi("Rentable dès", `le mois ${p.rentab.pm}`, "txt") : ""}${p.rentab.mensuel != null ? kpi("Coût par mois", eur(p.rentab.mensuel)) : ""}</div></div>` : ""}
      <div class="card"><h2 style="margin-bottom:12px">Revenus et dépenses par mois</h2>${argentChart(p.revenus, p.couts, "Revenus et dépenses de " + p.nom)}</div>
      <div class="card"><h2>Bénéfice total depuis le lancement</h2><p class="sub" style="margin:4px 0 12px">Sous zéro, le projet rembourse encore ce qu'il a coûté. Au-dessus, il rapporte.</p>${courbe([{n:"Bénéfice total", v:c, c: mx > 0 ? "var(--good)" : "var(--cost)", w:2.5, fmt:v => "Total " + signe(v)}], {label:"Bénéfice total de " + p.nom, bottom: Math.floor(mn / 10) * 10, min: 10})}</div>
      <div class="card"><h2 style="margin-bottom:12px">Visiteurs par mois</h2>${courbe([{n:"Visiteurs", v:p.visiteurs, c:"var(--rev)", w:2.5, fmt:v => v.toLocaleString("fr-FR") + " visiteurs"}], {label:"Visiteurs de " + p.nom}, pasDeVisiteurs(p))}</div>`};
  },
  "projet.rapports"(p){
    return { crumbs: [["Mes projets", "projets"], [p.nom, "projets." + p.id], ["Rapports"]], html: `<div><h1>Rapports</h1><p class="lead">Cliquez sur un rapport pour le lire.</p></div>
      ${p.rapports.length ? `<div class="rows">${p.rapports.map((r, i) => { const qui = M.parCle[r.qui] ? `${M.parCle[r.qui].prenom} (${posteCourt(M.parCle[r.qui].poste)})` : (r.qui || "L'équipe"); return `<details class="rep" ${i === 0 ? "open" : ""}><summary><span class="avatar" style="width:36px;height:36px;font-size:13px">${esc(qui[0])}</span><span class="tx"><b>${esc(r.titre)}</b><span class="sub">${r.date ? esc(fmtD(r.date)) + " · " : ""}${esc(qui)}</span></span></summary><div class="body">${r.texte && r.texte !== "pas encore de mesure" ? esc(propre(r.texte)) : r.texte ? "Pas encore de chiffres : le site n'est pas en ligne." : ""}${r.lien ? `<div style="margin-top:10px">${lienDoc(r.lien, "Lire le document")}</div>` : ""}</div></details>`; }).join("")}</div>` : vide("Pas encore de rapport : le premier arrive avec le suivi de la semaine.")}`};
  },
  "projet.messages"(p){
    const suffixe = new RegExp(`\\s*\\(projet ${p.id}[^)]*\\)\\s*$`);
    return { crumbs: [["Mes projets", "projets"], [p.nom, "projets." + p.id], ["Parler de ce projet"]], html: `<div><h1>Parler de ce projet</h1><p class="lead">Vos messages et les réponses de l'équipe, pour ${esc(p.nom)} seulement.</p></div>
      <div class="card"><div class="thread" id="thread">${p.messages.length ? p.messages.map(m => (m.texte ? `<div class="msg me">${esc(m.texte.replace(suffixe, ""))}<small>${esc(fmtD(m.date) || m.date)}</small></div>` : "") + (m.reponse ? `<div class="msg them">${esc(propre(m.reponse))}<small>${esc(m.statut || "Réponse de l'Usine")}</small></div>` : m.texte ? `<div class="msg them"><span class="sub">Message reçu. L'équipe répond à son prochain passage.</span></div>` : "")).join("") : `<p class="sub">Aucun message pour l'instant.</p>`}</div>
      ${noteEcran("msg" + p.id)}
      <form class="compose" data-proj="${esc(p.id)}"><input id="cm" aria-label="Votre message" placeholder="Ex. : « Où en est le cahier des charges ? »" autocomplete="off"><button class="btn primary">Envoyer</button></form>
      <p class="sub" style="margin:8px 0 0">${enSim() ? "Simulation : le message reste ici, il n'est envoyé à personne." : "Le message est écrit dans « Parler à l'Usine ». La réponse arrive au prochain passage du moteur."}</p></div>`};
  },
  "projet.livrables"(p){
    const attendus = ["Étude de marché","Cahier des charges","Identité visuelle","Aperçu du site","Fiche technique"];
    const pourquoi = {"Aperçu du site": "Il arrive à l'étape « Construction » : vous le validerez avant toute mise en ligne.", "Fiche technique": "Elle est écrite avec l'aperçu du site."};
    const autres = p.livrables.filter(l => !attendus.includes(l.genre));
    const ligne = (g, l) => `<div class="rowl"><span class="avatar">${esc(g[0])}</span><span class="tx"><b>${esc(g)}</b><span>${l ? (l.version > 1 ? `Version ${l.version}, après corrections` : "Première version") : esc(pourquoi[g] || "Pas encore fait.")}</span></span>${l ? (l.lien ? lienDoc(l.lien) : `<span class="pill good">Fait</span>`) : `<span class="pill off">Pas encore</span>`}</div>`;
    return { crumbs: [["Mes projets", "projets"], [p.nom, "projets." + p.id], ["Livrables"]], html: `<div><h1>Livrables</h1><p class="lead">Les documents produits par l'équipe pour ${esc(p.nom)}, dans leur dernière version.</p></div>
      <div class="rows">${attendus.map(g => ligne(g, p.livrables.find(l => l.genre === g))).join("")}</div>
      ${autres.length ? `<div>${titreSect("Autres documents")}<div class="rows">${autres.map(l => ligne(l.genre, l)).join("")}</div></div>` : ""}
      ${enSim() ? `<p class="sub">Simulation : ces documents sont des exemples, sans lien.</p>` : ""}`};
  },
  equipe(){
    const qs = qualSerie(), ts = tachesSerie(), cs = coutSerie();
    return { crumbs: [["Mon équipe"]], html: `<div><h1>Mon équipe</h1><p class="lead">${M.agents.length} employés, rangés par service. Cliquez sur un service pour voir ses employés.</p></div>
      <div class="mini">
        <div class="kpi"><div class="k">Qualité moyenne</div>${dernier(qs) != null ? `<div class="v">${dernier(qs)} / 100</div>` : `<div class="v txt">Pas encore notée</div>`}${tendance(qs)}${spark(qs)}</div>
        <div class="kpi"><div class="k">Tâches faites ce mois</div><div class="v">${dernier(ts) ?? 0}</div>${tendance(ts)}${spark(ts)}</div>
        <div class="kpi"><div class="k">Coût de l'équipe ce mois</div><div class="v">${usd(M.argent.ia ?? dernier(cs) ?? 0)}</div>${tendance(cs, true)}${spark(cs, "var(--cost)")}</div>
      </div>
      <div class="tiles">${services().map(([s, l], i) => tileS(`equipe.service-${i}`, "equipe", s, l.map(a => a.prenom).join(", "), qualSerie(l), "var(--rev)")).join("")}</div>
      <div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:10px"><h2>Cette semaine</h2><span class="sub">ce que chaque employé a fait</span></div>
        ${M.fil.length ? `<ul class="feed">${M.fil.slice(0, 8).map(f => `<li><span class="avatar">${esc(prenomDe(f.agent)[0])}</span><span class="tx"><a href="#equipe.${esc(f.agent)}" style="color:inherit;font-weight:700;text-decoration:none">${esc(prenomDe(f.agent))}</a> ${esc(f.texte)}</span><span class="when">${esc(fmtD(f.date))}</span></li>`).join("")}</ul>${M.fil.length > 8 ? `<p class="sub" style="margin:8px 0 0">Et ${M.fil.length - 8} autre${M.fil.length > 9 ? "s" : ""} travaux : voyez « Son travail » de chaque employé.</p>` : ""}` : vide(M.qgAbsent ? "Le fil de la semaine arrivera avec la prochaine mise à jour du moteur." : "Rien de nouveau cette semaine.")}</div>`};
  },
  service(i){
    const [s, l] = services()[i] || [];
    if (!s) return null;
    return { crumbs: [["Mon équipe", "equipe"], [s]], html: `<div><h1>${esc(s)}</h1><p class="lead">Cliquez sur un employé pour voir son travail, son évolution, son histoire et son contrat.</p></div>
      <div class="rows">${l.map(a => { const q = qualiteDe(a); return `<a class="rowl" href="#equipe.${esc(a.id)}"><span class="avatar">${esc(a.prenom[0])}</span><span class="tx"><b>${esc(a.prenom)}</b><span>${esc(a.poste)} · ${MODELES[a.niveau].nom}</span></span><span style="text-align:right">${spark(a.qualite)}${points(a.qualite) ? tendance(a.qualite) : ""}</span>${pillQualite(q)}<span class="go">›</span></a>`; }).join("")}</div>`};
  },
  agent(a){
    const q = qualiteDe(a), t = dernier(a.taches), c = dernier(a.cout);
    return { crumbs: [["Mon équipe", "equipe"], [a.service, "equipe.service-" + serviceIdx(a)], [a.prenom]], html: `
      <div class="card" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><span class="avatar" style="width:64px;height:64px;font-size:24px">${esc(a.prenom[0])}</span><div style="flex:1;min-width:200px"><h1>${esc(a.prenom)}</h1><p class="lead">${esc(a.poste)} · ${esc(a.role)}</p><p class="sub" style="margin:4px 0 0">${a.depuis ? `Dans l'équipe depuis le ${esc(/^\d{4}-/.test(a.depuis) ? fmtD(a.depuis) : a.depuis)} · ` : ""}${MODELES[a.niveau].nom}${a.rythme ? ` · travaille ${esc(a.rythme)}` : ""}</p></div>${pillQualite(q)}</div>
      <div class="mini">
        <div class="kpi"><div class="k">Qualité</div>${q != null ? `<div class="v">${q} / 100</div>` : `<div class="v txt">Pas encore notée</div>`}${points(a.qualite) ? tendance(a.qualite) : a.examens.length > 1 ? `<span class="trend sub">Contrôles : ${a.examens.join(", ")}</span>` : tendance(a.qualite)}${spark(points(a.qualite) > 1 ? a.qualite : a.examens.length > 1 ? Array(12 - a.examens.length).fill(null).concat(a.examens) : a.qualite)}</div>
        <div class="kpi"><div class="k">Tâches ce mois</div><div class="v">${t ?? 0}</div>${tendance(a.taches)}${spark(a.taches)}</div>
        <div class="kpi"><div class="k">Coût ce mois</div><div class="v">${usd(c ?? 0)}</div>${tendance(a.cout, true)}${spark(a.cout, "var(--cost)")}</div>
      </div>
      <div class="tiles">
        ${tile(`equipe.${a.id}.travail`, "travail", "Son travail", a.travail[0] ? a.travail[0].texte : "Rien cette semaine")}
        ${tile(`equipe.${a.id}.evolution`, "evol", "Son évolution", q != null ? `Qualité ${q} / 100` : "Qualité, tâches et coût")}
        ${tile(`equipe.${a.id}.histoire`, "rapports", "Son histoire", `${a.histoire.length} moment${a.histoire.length > 1 ? "s" : ""} marquant${a.histoire.length > 1 ? "s" : ""}`)}
        ${tile(`equipe.${a.id}.contrat`, "contrat", "Son contrat", `${MODELES[a.niveau].nom} · ${usd(c ?? 0)} ce mois`)}
      </div>`};
  },
  "agent.travail"(a){
    const crumbs = [["Mon équipe", "equipe"], [a.service, "equipe.service-" + serviceIdx(a)], [a.prenom, "equipe." + a.id], ["Son travail"]];
    return { crumbs, html: `<div><h1>Le travail ${esc(de(a.prenom))}</h1><p class="lead">Ce qu'il ou elle a fait ces 7 derniers jours.</p></div>
      <div class="kpis">${kpi("Tâches ce mois", dernier(a.taches) ?? 0)}${a.executions != null ? kpi("Passages au total", a.executions) : ""}${a.echecs != null ? kpi("Ratés au total", a.echecs, a.echecs ? "down" : "") : ""}${a.enAttente != null ? kpi("Tâches qui attendent", a.enAttente) : ""}</div>
      <div class="card">${a.travail.length ? `<ul class="tl">${a.travail.map(t => `<li class="done"><span class="d">${esc(fmtD(t.date))}</span><b>${esc(t.texte.charAt(0).toUpperCase() + t.texte.slice(1))}</b></li>`).join("")}</ul>` : `<p class="sub" style="margin:0">Rien cette semaine. ${a.rythme ? `Son rythme : ${esc(a.rythme)}.` : ""}</p>`}</div>`};
  },
  "agent.evolution"(a){
    const crumbs = [["Mon équipe", "equipe"], [a.service, "equipe.service-" + serviceIdx(a)], [a.prenom, "equipe." + a.id], ["Son évolution"]];
    const q = a.qualite, debut = q.findIndex(v => v != null);
    return { crumbs, html: `<div><h1>L'évolution ${esc(de(a.prenom))}</h1><p class="lead">${points(q) > 1 ? `Qualité : de ${q[debut]} à ${dernier(q)} sur 100 depuis son arrivée.` : "Sa qualité, ses tâches et son coût, mois par mois."}</p></div>
      <div class="card"><h2 style="margin-bottom:12px">Qualité de son travail (sur 100)</h2>${courbe([{n:"Qualité", v:q, c:"var(--rev)", w:2.5, fmt:v => v + " / 100"}], {label:"Qualité de " + a.prenom, bottom:50, top:100, step:10}, "Pas encore notée.")}
        ${a.examens.length ? `<p class="sub" style="margin:10px 0 0">Ses derniers contrôles de qualité : ${a.examens.join(", ")} sur 100.${a.alertes[0] ? " " + esc(a.alertes[0].replace(/note en baisse/, "Note en baisse")) + "." : ""}</p>` : ""}</div>
      <div class="card"><h2 style="margin-bottom:12px">Tâches faites par mois</h2>${courbe([{n:"Tâches", v:a.taches, c:"var(--rev)", w:2.5, fmt:v => v + " tâches"}], {label:"Tâches de " + a.prenom})}</div>
      <div class="card"><h2>Ce qu'il coûte, mois par mois (en dollars)</h2><p class="sub" style="margin:4px 0 12px">Pour juger s'il vaut son « salaire » : son coût à côté de sa qualité et de son travail.</p>${courbe([{n:"Coût", v:a.cout, c:"var(--cost)", w:2.5, fmt:v => usd(v)}], {label:"Coût de " + a.prenom, step:0.2, min:0.2})}</div>`};
  },
  "agent.histoire"(a){
    const crumbs = [["Mon équipe", "equipe"], [a.service, "equipe.service-" + serviceIdx(a)], [a.prenom, "equipe." + a.id], ["Son histoire"]];
    return { crumbs, html: `<div><h1>L'histoire ${esc(de(a.prenom))}</h1></div>
      <div class="card">${a.histoire.length ? `<ul class="tl">${a.histoire.map(([s, d, t, x]) => `<li class="${s}"><span class="d">${esc(d)}</span><b>${esc(t)}</b>${x ? `<span class="sub">${esc(x)}</span>` : ""}</li>`).join("")}</ul>` : `<p class="sub" style="margin:0">Pas encore de moment marquant.</p>`}</div>`};
  },
  "agent.contrat"(a){
    const crumbs = [["Mon équipe", "equipe"], [a.service, "equipe.service-" + serviceIdx(a)], [a.prenom, "equipe." + a.id], ["Son contrat"]];
    const cur = a.niveau, enCours = enSim() ? [] : M.messages.filter(m => !m.statut && m.texte.includes(`« ${a.poste} »`));
    return { crumbs, html: `<div><h1>Le contrat ${esc(de(a.prenom))}</h1><p class="lead">Son « salaire », c'est le modèle d'IA qu'il utilise. Un meilleur modèle coûte plus cher et travaille mieux. Ses plafonds de dépense ne changent pas.</p></div>
      ${noteEcran("contrat" + a.id)}
      ${enCours.length ? `<div class="note warn">Demande envoyée, pas encore appliquée : « ${esc(enCours.at(-1).texte)} ». L'Usine l'applique à son prochain passage.</div>` : ""}
      <div class="contract">${NIV.map(k => { const m = MODELES[k]; return `<div class="opt ${k === cur ? "cur" : ""}"><b>${m.nom}</b><span class="num">${m.cout}</span><span class="sub">${m.desc}</span>${k === cur ? `<span class="pill info">Son modèle actuel</span>` : `<button class="btn" data-modele="${k}" data-agent="${esc(a.id)}">${NIV.indexOf(k) > NIV.indexOf(cur) ? "Augmenter" : "Baisser"}</button>`}</div>`; }).join("")}</div>
      <div class="card"><h2 style="margin-bottom:10px">Changer son prénom</h2><form class="field" data-renommer="${esc(a.id)}"><input id="np" aria-label="Nouveau prénom" maxlength="30" value="${esc(a.prenom)}"><button class="btn primary">Enregistrer</button></form></div>
      <div class="card"><h2>Le remplacer</h2><p class="sub" style="margin:6px 0 12px">Le Directeur général propose un remplaçant (un autre modèle ou d'autres consignes), avec une semaine d'essai avant de décider.</p><button class="btn" data-remplacer="${esc(a.id)}">Demander un remplaçant</button></div>
      <p class="sub">${enSim() ? "Simulation : ces changements restent dans ce navigateur." : "Chaque changement est envoyé à l'Usine comme un ordre. Il s'applique à partir du lendemain."}</p>`};
  },
  argent(){
    const bs = benefSerie(), r = totRev(), c = totCost(), ia = M.argent.coutIA;
    const vend = bs.some(v => v);
    return { crumbs: [["Mon argent"]], html: `<div><h1>Mon argent</h1><p class="lead">${vend ? `Bénéfice du mois : <b class="${(bs[11] || 0) >= 0 ? "up" : "down"}">${signe(bs[11] || 0)}</b>` : "Pas encore de revenus : aucun projet ne vend encore. Voici ce que l'Usine dépense."}</p></div>
      <div class="mini">
        <div class="kpi"><div class="k">Revenus du mois</div>${dernier(r) ? `<div class="v">${eur(dernier(r))}</div>${tendance(r)}${spark(r)}` : `<div class="v txt">Pas encore</div><span class="sub">Rien n'est en vente.</span>`}</div>
        <div class="kpi"><div class="k">Dépenses des projets ce mois</div><div class="v">${eur(M.argent.dep ?? dernier(c) ?? 0)}</div>${tendance(c, true)}${spark(c, "var(--cost)")}</div>
        <div class="kpi"><div class="k">Coût de l'IA ce mois</div><div class="v">${usd(M.argent.ia ?? dernier(ia) ?? 0)}</div>${tendance(ia, true)}${spark(ia, "var(--cost)")}</div>
      </div>
      <div class="tiles">
        ${tileS("argent.ensemble", "evol", "Vue d'ensemble", vend ? `Sur 12 mois : ${signe(sum(r) - sum(c))}` : "Revenus, dépenses et IA sur 12 mois", vend ? bs : ia, vend ? "var(--good)" : "var(--cost)")}
        ${tile("argent.projets", "projets", "Par projet", "Lequel rapporte, lequel coûte")}
        ${tile("argent.objectif", "objectif", "Mon objectif", M.argent.objectif ? M.argent.objectif : "Pas encore fixé : à vous de le choisir")}
        ${tile("argent.depenses", "rapports", "Dépenses détaillées", "IA, domaines, hébergement, outils")}
      </div>`};
  },
  "argent.ensemble"(){
    const r = totRev(), c = totCost(), bs = benefSerie(), ia = M.argent.coutIA, Rv = sum(r), C = sum(c);
    return { crumbs: [["Mon argent", "argent"], ["Vue d'ensemble"]], html: `<div><h1>Vue d'ensemble</h1><p class="lead">Tous les projets additionnés, sur 12 mois. L'IA est comptée à part, en dollars, comme elle est payée.</p></div>
      <div class="kpis">${kpi("Revenus", eur(Rv))}${kpi("Dépenses des projets", eur(C))}${kpi("Bénéfice", signe(Rv - C), Rv - C > 0 ? "up" : Rv - C < 0 ? "down" : "")}${kpi("IA sur 12 mois", usd(sum(ia)))}</div>
      <div class="card"><h2 style="margin-bottom:12px">L'entreprise mois par mois</h2>${argentChart(r, c, "Revenus et dépenses de l'entreprise")}</div>
      <div class="card"><h2>Bénéfice de chaque mois</h2><p class="sub" style="margin:4px 0 12px">Vert : mois gagnant. Orange : mois où l'on a plus dépensé que gagné.</p>${barsSignes(bs, "Bénéfice de chaque mois")}</div>
      <div class="card"><h2>Coût de l'IA, mois par mois (en dollars)</h2><p class="sub" style="margin:4px 0 12px">Ce que coûtent les modèles d'IA de toute l'équipe. ${esc(M.argent.iaPlafond)}.</p>${courbe([{n:"IA", v:ia, c:"var(--cost)", w:2.5, fmt:v => usd(v)}], {label:"Coût de l'IA", step: Math.max(...ia.filter(v => v != null), 0) > 5 ? 1 : 0.5, min: 0.5})}</div>`};
  },
  "argent.projets"(){
    const rows = M.projets.map(p => ({p, r: sum(p.revenus), c: sum(p.couts)})).map(x => ({...x, b: x.r - x.c})).sort((x, y) => y.b - x.b);
    return { crumbs: [["Mon argent", "argent"], ["Par projet"]], html: `<div><h1>Par projet</h1><p class="lead">Du plus rentable au moins rentable, sur 12 mois. Cliquez pour ouvrir le projet.</p></div>
      ${rows.length ? `<div class="rows">${rows.map(({p, r, c, b}) => `<a class="rowl" href="#projets.${esc(p.id)}"><span class="avatar">${esc(p.nom[0])}</span><span class="tx"><b>${esc(p.nom)}</b><span>${r ? eur(r) + " gagnés" : pasDeRevenus(p)} · ${eur(c)} dépensés${p.rentab && p.rentab.r12 != null && !r ? ` · prévu : ${eur(p.rentab.r12)} sur 12 mois` : ""}</span></span>${spark(cumul(p.revenus.map((x, i) => x == null && p.couts[i] == null ? null : (x || 0) - (p.couts[i] || 0))), b >= 0 ? "var(--good)" : "var(--cost)")}<b class="num ${b > 0 ? "up" : b < 0 ? "down" : ""}">${signe(b)}</b><span class="go">›</span></a>`).join("")}</div>` : vide("Pas encore de projet.")}
      <p class="sub">Le coût de l'IA n'est pas encore réparti par projet : il est compté pour toute l'Usine, dans la vue d'ensemble.</p>`};
  },
  "argent.objectif"(){
    const bs = benefSerie(), b = bs[11] || 0, obj = M.argent.objectif;
    const cible = nombre((/([\d\s.,]+)\s*€/.exec(obj || "") || [])[1]);
    const pct = cible ? Math.max(0, Math.min(100, Math.round(100 * b / cible))) : 0;
    return { crumbs: [["Mon argent", "argent"], ["Mon objectif"]], html: `<div><h1>Mon objectif</h1><p class="lead">${obj ? esc(obj) : "Vous n'avez pas encore fixé d'objectif. Dites combien vous voulez gagner par mois, et dans combien de temps : l'Usine calcule combien de projets il faut tester."}</p></div>
      ${noteEcran("objectif")}
      ${obj && cible ? `<div class="card"><div style="display:flex;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap"><b class="num">${eur(b)} par mois</b><span class="sub">${pct} % de l'objectif</span></div><div class="goal"><i style="width:${pct}%"></i></div>
        <div style="margin-top:18px">${courbe([{n:"Bénéfice du mois", v:bs, c:"var(--good)", w:2.5, fmt:v => signe(v) + " / mois"}], {label:"Bénéfice mensuel vers l'objectif", top: cible, step: cible / 4, bottom: Math.min(0, Math.floor(Math.min(...bs.filter(v => v != null), 0) / (cible / 4)) * (cible / 4))}, "Pas encore de bénéfice : aucun projet ne vend encore.")}</div></div>` : ""}
      ${M.argent.planDetail && !enSim() ? `<div class="card"><h2 style="margin-bottom:6px">Le plan de l'Usine</h2><p style="margin:0">${esc(propre(M.argent.planDetail).replace(/Pas encore d'objectif[^.]*\./, "").replace(/«[^»]*»\)?\.?/, "").trim())}</p></div>` : ""}
      <div class="card"><h2 style="margin-bottom:10px">${obj ? "Changer mon objectif" : "Fixer mon objectif"}</h2><form class="field" data-objectif="1"><input id="obj-eur" inputmode="numeric" aria-label="Euros par mois" placeholder="Euros par mois, ex. 1000" style="min-width:140px"><input id="obj-mois" inputmode="numeric" aria-label="Dans combien de mois" placeholder="Dans combien de mois, ex. 12" style="min-width:140px"><button class="btn primary">Envoyer</button></form>
        <p class="sub" style="margin:8px 0 0">${enSim() ? "Simulation : rien n'est envoyé." : "Votre objectif est envoyé à l'Usine dans « Parler à l'Usine »."}</p></div>`};
  },
  "argent.depenses"(){
    const d = M.argent.depenses, cats = [["Intelligence artificielle", null], ["Noms de domaine", /domaine/i], ["Hébergement", /h[ée]berg|serveur|cloudflare|netlify|vercel/i], ["Outils et abonnements", /outil|abonnement|logiciel|canva|compte/i]];
    const autres = d.filter(x => !cats.slice(1).some(([, re]) => re.test(x.objet || "")));
    const ia = M.argent.coutIA;
    const ligne = x => `<div class="rowl"><span class="tx"><b>${esc(x.objet || "Dépense")}</b><span>${esc(fmtD(x.date))}${x.projet ? " · " + esc(M.parId[x.projet] ? M.parId[x.projet].nom : x.projet) : ""}</span></span><b class="num">${eur(x.montant)}</b></div>`;
    const payants = M.usine.outils.filter(o => o.statut && /actif/i.test(o.statut));
    return { crumbs: [["Mon argent", "argent"], ["Dépenses détaillées"]], html: `<div><h1>Dépenses détaillées</h1><p class="lead">Chaque euro et chaque dollar dépensés, rangés par sorte. ${esc(M.argent.depPlafond)}.</p></div>
      <div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><h2>Intelligence artificielle</h2><b class="num">${usd(M.argent.ia ?? dernier(ia) ?? 0)} ce mois</b></div><p class="sub" style="margin:4px 0 12px">Les modèles d'IA de l'équipe, payés en dollars. ${esc(M.argent.iaPlafond)}.</p>
        <div class="rows" style="border:0">${M.agents.filter(a => dernier(a.cout)).sort((x, y) => dernier(y.cout) - dernier(x.cout)).map(a => `<a class="rowl" href="#equipe.${esc(a.id)}.contrat"><span class="avatar" style="width:32px;height:32px;font-size:12px">${esc(a.prenom[0])}</span><span class="tx"><b>${esc(a.prenom)}</b><span>${esc(a.poste)} · ${MODELES[a.niveau].nom}</span></span><b class="num">${usd(dernier(a.cout))}</b></a>`).join("") || `<p class="sub" style="margin:0">Pas encore de coût détaillé par employé.</p>`}</div></div>
      ${cats.slice(1).map(([t, re]) => { const l = d.filter(x => re.test(x.objet || "")); return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><h2>${t}</h2><b class="num">${eur(sum(l.map(x => x.montant)))}</b></div>${l.length ? `<div class="rows" style="border:0;margin-top:8px">${l.map(ligne).join("")}</div>` : `<p class="sub" style="margin:6px 0 0">Aucune dépense${t === "Noms de domaine" ? " : aucun domaine n'est acheté. C'est vous qui l'achetez, au moment de la mise en ligne." : t === "Hébergement" ? " : l'aperçu privé ne coûte rien." : " : les outils utilisés sont gratuits pour l'instant."}</p>`}</div>`; }).join("")}
      ${autres.length ? `<div class="card"><h2>Autres dépenses</h2><div class="rows" style="border:0;margin-top:8px">${autres.map(ligne).join("")}</div></div>` : ""}
      ${payants.length ? `<p class="sub">Outils en service : ${payants.map(o => esc(o.principal) + (o.gratuit ? ` (${esc(/^oui/i.test(o.gratuit) ? "gratuit" : o.gratuit)})` : "")).join(", ")}.</p>` : ""}`};
  },
  biblio(){
    const f = M.biblio.fiches, rayons = rayonsDe(), ouv = M.biblio.lacunes.filter(l => !/r[ée]solu/i.test(l.statut));
    return { crumbs: [["La Bibliothèque"]], html: `<div><h1>La Bibliothèque</h1><p class="lead">Les bonnes pratiques de l'Usine, rangées comme une vraie bibliothèque : des rayons, des livres, des fiches. Chaque agent suit les fiches validées.</p></div>
      <div class="kpis">${kpi("Fiches validées", f.filter(x => /valid/i.test(x.statut)).length)}${kpi("Propositions", f.filter(x => /propos/i.test(x.statut)).length)}${kpi("Utilisations", sum(f.map(x => nombre(x.applications) || 0)))}</div>
      <div class="tiles">${rayons.map(([r, l], i) => tile(`biblio.r${i}`, "livre", r, `${l.length} fiche${l.length > 1 ? "s" : ""}`)).join("")}</div>
      <div class="tiles">
        ${tile("biblio.lacunes", "trou", "Ce qui manque", ouv.length ? `${ouv.length} manque${ouv.length > 1 ? "s" : ""} à combler` : "Rien ne manque")}
        ${tile("biblio.idees", "idee", "Boîte à idées", `${M.biblio.idees.length} idée${M.biblio.idees.length > 1 ? "s" : ""} notée${M.biblio.idees.length > 1 ? "s" : ""}`)}
        ${tile("biblio.deposer", "rapports", "Déposer un document", "La Bibliothécaire l'intègre à son prochain passage")}
        ${tile("biblio.semaine", "decide", "Validées cette semaine", M.biblio.semaine.length ? `${M.biblio.semaine.length} par le Directeur général` : "Aucune par le Directeur général")}
      </div>`};
  },
  rayon(i){
    const [r, l] = rayonsDe()[i] || []; if (!r) return null;
    const livres = livresDe(l);
    return { crumbs: [["La Bibliothèque", "biblio"], [r]], html: `<div><h1>${esc(r)}</h1><p class="lead">Les livres de ce rayon : un livre par étape du travail.</p></div>
      <div class="tiles">${livres.map(([lv, fs], j) => tile(`biblio.r${i}.${j}`, "livre", lv === "Toutes" ? "Pour toutes les étapes" : lv, `${fs.length} fiche${fs.length > 1 ? "s" : ""}`)).join("")}</div>`};
  },
  livre(i, j){
    const [r, l] = rayonsDe()[i] || []; if (!r) return null; const [lv, fs] = livresDe(l)[j] || []; if (!lv) return null;
    return { crumbs: [["La Bibliothèque", "biblio"], [r, "biblio.r" + i], [lv === "Toutes" ? "Toutes les étapes" : lv]], html: `<div><h1>${esc(lv === "Toutes" ? "Pour toutes les étapes" : lv)}</h1><p class="lead">Les fiches de ce livre. Cliquez pour en lire une.</p></div>
      <div class="rows">${fs.map(f => `<a class="rowl" href="#biblio.f.${encodeURIComponent(f.id).replace(/%/g, "~")}"><span class="avatar">${esc(f.titre[0])}</span><span class="tx"><b>${esc(f.titre)}</b><span>Version ${esc(String(f.version).replace(/^v/, ""))} · ${f.projets.length ? "utilisée par " + esc(f.projets.join(", ")) : "pas encore utilisée par un projet"}</span></span>${statutFiche(f)}<span class="go">›</span></a>`).join("")}</div>`};
  },
  fiche(f){
    const rayons = rayonsDe(), i = rayons.findIndex(([r]) => r === f.rayon), livres = livresDe(rayons[i][1]), j = livres.findIndex(([lv]) => lv === f.livre);
    const preuve = {A: "Solides (mesurées sur de vrais projets)", B: "Correctes (sources sérieuses)", C: "À confirmer (premiers essais)"}[f.preuve] || "Non précisé";
    return { crumbs: [["La Bibliothèque", "biblio"], [f.rayon, "biblio.r" + i], [f.livre === "Toutes" ? "Toutes les étapes" : f.livre, `biblio.r${i}.${j}`], [f.titre]], html: `<div><h1>${esc(f.titre)}</h1><p class="lead">${statutFiche(f)}</p></div>
      ${noteEcran("fiche" + f.id)}
      <div class="card"><dl class="dl">
        <dt>Statut</dt><dd>${/valid/i.test(f.statut) ? "Validée : les agents la suivent." : /propos/i.test(f.statut) ? "Proposition : pas encore suivie, elle attend d'être validée." : esc(f.statut)}</dd>
        <dt>Écrite par</dt><dd>${/directeur g[ée]n[ée]ral/i.test(f.notes || "") ? "Le Directeur général" : "L'équipe de la Bibliothèque"}${f.revision ? `, revue le ${esc(fmtD(f.revision))}` : ""} · version ${esc(String(f.version).replace(/^v/, ""))}</dd>
        <dt>Pour qui</dt><dd>${esc(f.agents || "Tous")}${f.types && f.types !== "Tous" ? ` · projets ${esc(f.types)}` : ""}</dd>
        <dt>Projets qui l'utilisent</dt><dd>${f.projets.length ? esc(f.projets.join(", ")) : "Aucun pour l'instant"}${f.applications ? ` · utilisée ${esc(f.applications)} fois` : ""}${f.reussite ? ` · réussite ${esc(f.reussite)}` : ""}</dd>
        <dt>Ses sources</dt><dd>${preuve}</dd>
        ${f.notes ? `<dt>À savoir</dt><dd>${esc(propre(f.notes))}</dd>` : ""}
      </dl>${f.lien ? `<div style="margin-top:14px">${lienDoc(f.lien, "Lire la fiche")}</div>` : ""}</div>`};
  },
  lacunes(){
    const l = M.biblio.lacunes;
    return { crumbs: [["La Bibliothèque", "biblio"], ["Ce qui manque"]], html: `<div><h1>Ce qui manque</h1><p class="lead">Quand un agent ne trouve pas de fiche pour ce qu'il doit faire, il le note ici et avance prudemment en attendant.</p></div>
      ${l.length ? `<div class="rows">${l.map(x => `<div class="rowl"><span class="avatar">${esc(prenomDe(x.qui)[0])}</span><span class="tx"><b>${esc(x.quoi.replace(/^fiche manquante\s*:\s*/i, "Fiche manquante : "))}</b><span>${esc(x.pourquoi)}${x.prudence ? ". En attendant : " + esc(x.prudence.charAt(0).toLowerCase() + x.prudence.slice(1)) : ""}</span></span><span class="pill ${/r[ée]solu/i.test(x.statut) ? "good" : x.bloquante ? "bad" : "warn"}">${/r[ée]solu/i.test(x.statut) ? "Comblé" : x.bloquante ? "Bloque le travail" : "Ne bloque rien"}</span></div>`).join("")}</div>` : vide("Rien ne manque pour l'instant.")}`};
  },
  idees(){
    const l = M.biblio.idees.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const cls = d => /go/i.test(d) && !/non/i.test(d) ? "good" : /creuser/i.test(d) ? "warn" : "off";
    return { crumbs: [["La Bibliothèque", "biblio"], ["Boîte à idées"]], html: `<div><h1>Boîte à idées</h1><p class="lead">Les idées trouvées par la Veille, avec sa note sur 35 et sa confiance. Les meilleures deviennent des projets.</p></div>
      ${l.length ? `<div class="rows">${l.map(x => `<div class="rowl"><span class="avatar">${esc(x.titre[0])}</span><span class="tx"><b>${esc(x.titre)}</b><span>${esc(x.description)} · note ${esc(x.note)}/35${x.confiance != null ? `, confiance ${x.confiance} %` : ""} · ${esc(fmtD(x.date))}</span></span>${x.lien ? lienDoc(x.lien) : ""}<span class="pill ${cls(x.decision)}">${esc(/^go$/i.test(x.decision) ? "À lancer" : /creuser/i.test(x.decision) ? "À creuser" : /non/i.test(x.decision) ? "Écartée" : x.decision || "À étudier")}</span></div>`).join("")}</div>` : vide("Pas encore d'idée : la Veille cherche au début de chaque mois.")}`};
  },
  deposer(){
    return { crumbs: [["La Bibliothèque", "biblio"], ["Déposer un document"]], html: `<div><h1>Déposer un document</h1><p class="lead">Une bonne pratique, une source, une note : elle devient un Google Doc dans le dossier « À intégrer » du Drive TEST. La Bibliothécaire en fait une fiche à son prochain passage.</p></div>
      ${noteEcran("deposer")}
      <form class="card" data-deposer="1" style="display:flex;flex-direction:column;gap:10px">
        <label class="sub" for="dep-titre">Titre</label><input id="dep-titre" maxlength="120" required autocomplete="off" style="border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface-2)">
        <label class="sub" for="dep-texte">Texte</label><textarea id="dep-texte" required maxlength="20000" style="min-height:160px;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface-2)"></textarea>
        <div><button class="btn primary">Déposer dans le Drive</button></div>
        <p class="sub" style="margin:0">${enSim() ? "Simulation : rien n'est envoyé." : "Le document est créé avec votre compte Google, dans le Drive TEST."}</p>
      </form>`};
  },
  semaine(){
    const l = M.biblio.semaine;
    return { crumbs: [["La Bibliothèque", "biblio"], ["Validées cette semaine"]], html: `<div><h1>Validées cette semaine</h1><p class="lead">Les fiches que le Directeur général a validées ces 7 derniers jours. Vous pouvez en annuler une : elle revient à sa version précédente.</p></div>
      ${noteEcran("semaine")}
      ${l.length ? `<div class="rows">${l.map(f => { const v = parseInt(String(f.version).replace(/\D/g, "")) || 1; return `<div class="rowl"><span class="avatar">${esc(f.titre[0])}</span><span class="tx"><b>${esc(f.titre)}</b><span>Version ${v}, validée le ${esc(fmtD(f.revision))}</span></span>${v > 1 ? `<button class="btn" data-annuler="${esc(f.id)}" data-v="${v - 1}">Annuler</button>` : `<span class="sub">Première version : écrivez à l'Usine pour l'annuler.</span>`}</div>`; }).join("")}</div>` : vide("Aucune cette semaine. Aujourd'hui, seules vos validations rendent une fiche officielle : le Directeur général propose, il ne valide pas encore seul.")}`};
  },
  usine(){
    const sec = M.usine.securite[0] || {}, pret = M.usine.pret.find(r => r.Nom === "Décision") || {}, q = qualSerie();
    const ia = M.argent.coutIA;
    return { crumbs: [["L'Usine"]], html: `<div><h1>L'Usine (les coulisses)</h1><p class="lead">Comment la machine tourne. Rien ici ne vous demande d'agir : l'équipe s'en occupe.</p>${journeeSimulee() ? `<p class="sub" style="margin:4px 0 0">${esc(journeeSimulee())} (la date où en est le moteur du test, différente de la date du jour).</p>` : ""}</div>
      <div class="tiles">
        ${tile("usine.sante", "sante", "Santé et sécurité", sec["État"] ? sec["État"] : "Les contrôles du jour")}
        ${tile("usine.outils", "outils", "Outils", `${M.usine.outils.length} outils, chacun avec un secours`)}
        ${tile("usine.calendrier", "calendrier", "Calendrier", "La semaine en 7 colonnes")}
        ${tileS("usine.qualite", "qualite", "Qualité des agents", dernier(q) != null ? `Moyenne ${dernier(q)} / 100` : "Les dernières notes", q, "var(--rev)")}
        ${tile("usine.pret", "pret", "Prêt pour le réel", pret["État"] === "OUI" ? "Oui, tout est prêt" : "Pas encore : voyez ce qui manque")}
        ${tile("usine.veille", "veille", "Veille concurrentielle", `${M.usine.veille.length} sources de veille`)}
      </div>
      <div class="card"><h2 style="margin-bottom:12px">Ce que coûte la machine, mois par mois (en dollars)</h2>${courbe([{n:"IA", v:ia, c:"var(--cost)", w:2.5, fmt:v => usd(v)}], {label:"Coût de l'IA", step:0.5, min:0.5})}</div>`};
  },
  "usine.sante"(){
    const l = [...M.usine.securite, ...M.usine.moteur.filter(r => r.Nom !== "Coût IA du mois" && r.Nom !== "Dépenses des projets du mois"), ...M.usine.sante];
    const cls = e => /tout va bien|réussi|réel|actif|^0$/i.test(e) ? "good" : /expir|panne|échec|alerte/i.test(e) ? "bad" : "info";
    const nom = {"Dernière journée":"Dernière journée de travail","Jeton Google":"Accès du moteur à Google","Surveillance":"Surveillance de sécurité","Écritures du tableau en attente":"Écritures du tableau en attente","Tâches entre agents":"Tâches entre employés"};
    return { crumbs: [["L'Usine", "usine"], ["Santé et sécurité"]], html: `<div><h1>Santé et sécurité</h1><p class="lead">Les contrôles faits chaque jour par ${esc(prenomDe("maintenance"))} (Maintenance).</p></div>
      ${l.length ? `<div class="rows">${l.map(r => `<div class="rowl"><span class="tx"><b>${esc(nom[r.Nom] || r.Nom)}</b><span>${esc(propre(r["Détail"]).replace(/Pour le renouveler[^.]*\./, "Claude s'en occupe avec vous.").replace(/a_faire (\d+), fait (\d+)/, "$1 à faire, $2 faites"))}${r.Date ? " · " + esc(fmtD(r.Date)) : ""}</span></span><span class="pill ${cls(r["État"])}">${esc(r["État"] === "Réel" ? "Faite" : r["État"])}</span></div>`).join("")}</div>` : vide("Pas encore de contrôle enregistré.")}`};
  },
  "usine.outils"(){
    const l = M.usine.outils;
    return { crumbs: [["L'Usine", "usine"], ["Outils"]], html: `<div><h1>Outils</h1><p class="lead">Chaque besoin a un outil principal et un outil de secours, prêt à prendre le relais en cas de panne.</p></div>
      ${l.length ? `<div class="rows">${l.map(o => `<div class="rowl"><span class="tx"><b>${esc(o.fonction)}</b><span>Principal : ${esc(o.principal)} · secours : ${esc(o.secours)}${o.gratuit ? " · " + esc(/^oui/i.test(o.gratuit) ? "gratuit" : o.gratuit) : ""}</span></span><span class="pill ${/actif/i.test(o.statut) ? "good" : /panne/i.test(o.statut) ? "bad" : /secours/i.test(o.statut) ? "warn" : "off"}">${esc(/pr[ée]vu/i.test(o.statut) ? "Prévu" : o.statut || "Prévu")}</span></div>`).join("")}</div>` : vide("Pas encore d'outil enregistré.")}`};
  },
  "usine.calendrier"(){
    const l = M.usine.calendrier.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")).slice(0, 7);
    return { crumbs: [["L'Usine", "usine"], ["Calendrier"]], html: `<div><h1>Calendrier</h1><p class="lead">Qui travaille lors des 7 prochaines journées de l'Usine. Ces dates suivent la journée simulée du test, pas le calendrier réel.</p></div>
      ${l.length ? `<div class="weekscroll"><div class="week">${l.map((c, i) => `<div class="day ${i === 0 ? "today" : ""}"><h3>${esc(maj(c.jour))} ${esc(fmtD(c.date))}</h3>${c.agents.map(n => { const a = parPosteOuNom(n); return `<span><span class="avatar">${esc((a ? a.prenom : n)[0])}</span>${esc(a ? a.prenom : n)}</span>`; }).join("")}</div>`).join("")}</div></div><p class="sub">Sur téléphone, faites glisser pour voir toute la semaine.</p>` : vide("Le calendrier arrive avec la prochaine journée du moteur.")}`};
  },
  "usine.qualite"(){
    const l = M.agents.slice().sort((a, b) => (qualiteDe(a) ?? 999) - (qualiteDe(b) ?? 999));
    const q = qualSerie();
    return { crumbs: [["L'Usine", "usine"], ["Qualité des agents"]], html: `<div><h1>Qualité des agents</h1><p class="lead">Chaque employé passe des contrôles de qualité. Les moins bonnes notes d'abord.</p></div>
      <div class="card"><h2 style="margin-bottom:12px">Qualité moyenne de l'équipe</h2>${courbe([{n:"Qualité", v:q, c:"var(--rev)", w:2.5, fmt:v => v + " / 100"}], {label:"Qualité moyenne", bottom:50, top:100, step:10})}</div>
      <div class="rows">${l.map(a => { const n = qualiteDe(a); return `<a class="rowl" href="#equipe.${esc(a.id)}.evolution"><span class="avatar">${esc(a.prenom[0])}</span><span class="tx"><b>${esc(a.prenom)}</b><span>${esc(a.poste)}${a.examens.length ? " · contrôles : " + a.examens.join(", ") : ""}${a.alertes[0] ? " · " + esc(a.alertes[0]) : ""}</span></span>${n != null ? `<b class="num">${n}</b>` : ""}${pillQualite(n)}<span class="go">›</span></a>`; }).join("")}</div>`};
  },
  "usine.pret"(){
    const dec = M.usine.pret.find(r => r.Nom === "Décision") || {}, l = M.usine.pret.filter(r => r.Nom !== "Décision");
    const nom = {"jours sans erreur grave":"Des jours sans erreur grave","projets arrivés à l'aperçu":"Un projet arrivé à l'aperçu du site","coût IA du test ($)":"Un coût d'IA raisonnable pendant le test","qualité des agents stable":"Une qualité stable chez tous les agents","lacunes bloquantes ouvertes":"Aucun manque bloquant dans la Bibliothèque","décisions métier sans fiche":"Aucune décision prise sans fiche"};
    const detail = (n, d) => { const m = /^(\S+) \(seuil (.+)\)$/.exec(String(d || "")); if (!m) return propre(d); const v = m[1], s = m[2], x = nombre(v), y = nombre(s);
      if (/qualit/.test(n)) return v === "True" ? "Stable" : "Pas encore stable : des notes ont baissé cette semaine.";
      if (/co[uû]t/.test(n)) return `${usd(x)} dépensés pendant le test, pour un maximum de ${usd(y)}.`;
      if (/jours/.test(n)) return `${x} jour${x > 1 ? "s" : ""} sans erreur grave pour l'instant, il en faut ${y}.`;
      if (/aper/.test(n)) return `${x} projet arrivé à l'aperçu, il en faut ${y}.`;
      return `${x} aujourd'hui, ${y} au maximum.`; };
    return { crumbs: [["L'Usine", "usine"], ["Prêt pour le réel"]], html: `<div><h1>Prêt pour le réel</h1><p class="lead">${dec["État"] === "OUI" ? "Oui : l'Usine peut passer du test au réel quand vous le décidez." : "Pas encore. L'Usine reste en test tant que ces conditions ne sont pas toutes remplies."}</p></div>
      ${l.length ? `<div class="rows">${l.map(r => `<div class="rowl"><span class="tx"><b>${esc(nom[r.Nom] || r.Nom)}</b><span>${esc(detail(r.Nom, r["Détail"]))}</span></span><span class="pill ${r["État"] === "OK" ? "good" : "warn"}">${r["État"] === "OK" ? "Rempli" : "Pas encore"}</span></div>`).join("")}</div>` : vide("Les conditions seront contrôlées à la prochaine journée du moteur.")}`};
  },
  "usine.veille"(){
    const nom = {collecteur:"Prix, avis et meilleures ventes", publicites:"Publicités des concurrents", seo:"Mots-clés des concurrents", archive:"Anciennes versions des sites concurrents", technologies:"Technologies des concurrents", communautes:"Discussions sur les forums"};
    const l = M.usine.veille;
    return { crumbs: [["L'Usine", "usine"], ["Veille concurrentielle"]], html: `<div><h1>Veille concurrentielle</h1><p class="lead">Comment ${esc(prenomDe("veille_strategie"))} (Veille) surveille les concurrents. Chaque source a un outil principal et un secours.</p></div>
      ${l.length ? `<div class="rows">${l.map(r => { const m = /principal ([^,]+), secours ([^,]+)(?:, compte : (.*))?/.exec(r["Détail"] || "") || []; return `<div class="rowl"><span class="tx"><b>${esc(nom[r.Nom] || r.Nom)}</b><span>${m[1] ? `Outil : ${esc(maj(m[1]))} · secours : ${esc(maj(m[2]))}${m[3] && m[3] !== "sans" ? " · compte " + esc(m[3]) : ""}` : esc(r["Détail"])}</span></span><span class="pill ${/actif/i.test(r["État"]) ? "good" : "warn"}">${esc(r["État"])}</span></div>`; }).join("")}</div>` : vide("Pas encore de source de veille.")}`};
  },
};
/* ===================== Le cockpit (comme le modèle « Centre de pilotage ») ===================== */
const CATS_COURTS = {1:"Valider un projet", 2:"Valider un aperçu", 3:"Décider après le test", 4:"Argent réel", 5:"Problème grave"};
const lienDecision = x => x.projet ? `projets.${x.projet}.decision` : `decisions.${x.n}`;
const ICO = {
  verrou:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  envoyer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  reglages:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
};
const prio = (n, t, extra = "", acc) => `<div class="plabel"><span class="rank ${acc ? "acc" : ""}">${n}</span>${t}${extra ? ` <span class="extra">· ${extra}</span>` : ""}</div>`;

/* La barre du haut : titre, fraîcheur des données, bascule Simulation / Réel. */
function barre(){
  const min = S.at ? Math.max(0, Math.round((Date.now() - S.at) / 60000)) : null;
  const live = enSim() ? `<span class="live off"><span class="dot"></span>${esc(journeeSimulee() || "Simulation")}</span>`
    : !mcp ? `<span class="live off"><span class="dot"></span>pas connecté</span>`
    : Object.keys(S.err).some(k => !OPTIONNELS.includes(k)) ? `<span class="live off"><span class="dot"></span>données pas à jour</span>`
    : `<span class="live"><span class="dot"></span>à jour${min != null ? (min ? ` · il y a ${min} min` : " · à l'instant") : ""}</span>`;
  return `<header class="bar"><div><div class="eye">Centre de pilotage</div><h1>Mon QG</h1></div>${live}
    <div class="toggle" role="group" aria-label="Données affichées"><button data-mode="sim" aria-pressed="${enSim()}">Simulation</button><button data-mode="reel" aria-pressed="${!enSim()}">Réel</button></div></header>`;
}

function verdict2(){
  const d = M.decisions, grave = d.filter(x => x.cat === 5).length;
  if (grave) return {cls: "crit", t: `${grave > 1 ? grave + " problèmes graves" : "Un problème grave"} à regarder tout de suite.`};
  if (d.length) return {cls: "", t: `${d.length > 1 ? d.length + " décisions vous attendent" : "1 décision vous attend"}, tout le reste va bien.`};
  return {cls: "ok", t: "Rien à décider : tout va bien."};
}

/* ② Argent : la courbe du bénéfice cumulé, qu'on touche pour lire chaque mois. En Réel, un 0 € honnête. */
function argentAccueil(){
  const bs = benefSerie(), cum = cumul(bs), vend = totRev().some(v => v);
  if (!enSim() && !vend){
    return `<section class="card money"><div class="row"><span class="big">0 €</span><span class="tag wait">En attente du 1er vrai test</span></div>
      <span class="sub">Argent réel : rien gagné, rien dépensé. L'Usine est en mode TEST.</span>
      <div class="chartwrap"><svg viewBox="0 0 480 150" role="img" aria-label="0 € réel, en attente du premier test"><line x1="10" x2="470" y1="75" y2="75" stroke="var(--faint)" stroke-dasharray="4 5"/><text x="240" y="62" text-anchor="middle" font-size="13" fill="var(--muted)">0 € réel, en attente du 1er test</text></svg></div>
      <div class="acts"><a class="open-link" href="#argent">Ouvrir l'argent ›</a></div></section>`;
  }
  const fin = dernier(cum) ?? 0;
  let eq = -1; for (let i = 1; i < 12; i++) if (cum[i] != null && cum[i - 1] != null && cum[i - 1] < 0 && cum[i] >= 0){ eq = i; break; }
  const tag = eq >= 0 ? `<span class="tag">Équilibre au mois ${eq + 1}</span>` : fin >= 0 ? `<span class="tag">Rentable</span>` : `<span class="tag wait">Pas encore à l'équilibre</span>`;
  return `<section class="card money"><div class="row"><span class="big">${signe(fin)}</span>${tag}</div>
    <span class="sub">Bénéfice cumulé sur 12 mois, tous projets${enSim() ? " (exemple)" : ""}. Touchez la courbe pour lire chaque mois.</span>
    ${courbeArgent(cum, eq)}
    <div class="acts"><a class="open-link" href="#argent">Ouvrir l'argent ›</a></div></section>`;
}
function courbeArgent(vals, eq){
  const W = 480, H = 150, P = 12, pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
  if (pts.length < 2) return `<p class="sub">La courbe apparaîtra dès le deuxième mois mesuré.</p>`;
  const lo = Math.min(0, ...pts.map(p => p[1])), hi = Math.max(0, ...pts.map(p => p[1])), X = i => P + i / 11 * (W - 2 * P), Y = v => P + (hi - v) / (hi - lo || 1) * (H - 2 * P);
  const d = pts.map((p, j) => (j ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("");
  const id = "g" + (++cid), coul = (dernier(vals) ?? 0) >= 0 ? "var(--good)" : "var(--crit)";
  return `<div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bénéfice cumulé mois par mois">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <line x1="${P}" x2="${W - P}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--faint)" stroke-dasharray="4 5"/>
    <path d="${d}L${X(pts.at(-1)[0]).toFixed(1)} ${H}L${X(pts[0][0]).toFixed(1)} ${H}Z" fill="url(#${id})"/>
    <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${eq >= 0 ? `<circle cx="${X(eq)}" cy="${Y(vals[eq])}" r="5" fill="var(--warn)" stroke="var(--surface)" stroke-width="2"/>` : ""}
    <circle cx="${X(pts.at(-1)[0])}" cy="${Y(pts.at(-1)[1])}" r="4.5" fill="${coul}" stroke="var(--surface)" stroke-width="2"/>
    ${pts.map(([i, v]) => `<rect data-tip="${esc(MNL[(+MOISK[i].slice(5)) - 1])} · ${esc(signe(v))}" data-x="${(X(i) / W * 100).toFixed(2)}" data-y="${(Y(v) / H * 100).toFixed(2)}" x="${X(i) - (W - 2 * P) / 22}" y="0" width="${(W - 2 * P) / 11}" height="${H}" fill="transparent"/>`).join("")}
    </svg><div class="tip2" aria-hidden="true"></div></div>
    <div class="ticks">${[0, 3, 6, 9, 11].map(i => `<span>${esc(MOIS[i])}</span>`).join("")}</div>`;
}
function montrerBulle(r){
  const w = r.closest(".chartwrap"), t = w && w.querySelector(".tip2"); if (!t) return;
  t.textContent = r.dataset.tip; t.style.left = Math.min(Math.max(+r.dataset.x, 14), 86) + "%"; t.style.top = `calc(${r.dataset.y}% - 8px)`; t.style.opacity = 1;
}
const bulleSous = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest && el.closest(".chartwrap rect[data-tip]"); };
document.addEventListener("pointermove", e => { const r = bulleSous(e); if (r) montrerBulle(r); else if (e.pointerType === "mouse") document.querySelectorAll(".tip2").forEach(t => t.style.opacity = 0); });
document.addEventListener("pointerdown", e => { const r = bulleSous(e); if (r) montrerBulle(r); });

/* ③ Projets : une seule entrée, résumée. */
function projetsAccueil(){
  const act = actifs(), adec = M.projets.filter(p => p.decisions.length).length, arr = M.projets.length - act.length, avance = act.filter(p => !p.decisions.length).length;
  return `<section class="card psum"><div class="psum-main"><span class="psum-n">${act.length}</span><div><div class="psum-t">projet${act.length > 1 ? "s" : ""} en cours</div><div class="psum-b">${M.projets.length ? pluriel(`${M.projets.length} au total`) : "La Veille cherche des idées"}</div></div></div>
    <div class="psum-tags">${avance ? `<span class="pill good">${avance} avance${avance > 1 ? "nt" : ""}</span>` : ""}${adec ? `<span class="pill warn">${adec} à décider</span>` : ""}${arr ? `<span class="pill off">${arr} arrêté${arr > 1 ? "s" : ""}</span>` : ""}</div>
    <a class="open-link" href="#projets">Voir tous les projets ›</a></section>`;
}

/* ④ La machine : on entre dans chaque partie. */
function etatSecurite(){
  const sec = M.usine.securite[0] || {}, alertes = securiteAlertes();
  return {ok: !alertes.length && !/alerte|anormal|fuite|intrusion/i.test(sec["État"] || ""), alertes};
}
function securiteAlertes(){
  const graves = M.decisions.filter(d => d.cat === 5).map(d => ({t: d.titre + " : " + d.texte, date: d.date, lien: lienDecision(d)}));
  const autres = (M.usine.alertes || []).map(a => ({t: propre(a["Détail"] || a.Nom), date: a.Date}));
  return graves.concat(autres);
}
function machine(){
  const s = etatSecurite(), fiches = M.biblio.fiches.length;
  return `<div class="machine">
    <a class="mtile" href="#equipe"><span class="ico">${ICON.equipe}</span><span class="n">${M.agents.length}</span><span class="l">Agents</span></a>
    <a class="mtile" href="#biblio"><span class="ico">${ICON.livre}</span><span class="n">${fiches}</span><span class="l">Fiches</span></a>
    <a class="mtile" href="#securite"><span class="ico">${ICON.sante}</span><span class="n ${s.ok ? "ok" : "ko"}">${s.ok ? "OK" : s.alertes.length}</span><span class="l">Sécurité</span></a>
    <a class="mtile" href="#reglages"><span class="ico">${ICO.reglages}</span><span class="n">TEST</span><span class="l">Réglages</span></a></div>`;
}

/* 💬 Parler à l'Usine : le chat sur l'accueil (les derniers messages) et en grand (#chat). */
const SIMCHAT = [];
const sansSuffixe = t => String(t || "").replace(/\s*\(projet [^)]*\)\s*$/, "");
function filChat(){
  const l = [];
  if (enSim()){
    l.push({qui: "them", t: "Bonjour. Donnez-moi un ordre ou posez une question : j'organise l'équipe.", d: "Usine"});
    SIMCHAT.forEach(m => l.push(m));
    return l;
  }
  M.messages.forEach(m => {
    if (m.texte) l.push({qui: "me", t: sansSuffixe(m.texte), d: fmtD(m.date) || m.date});
    if (m.reponse) l.push({qui: "them", t: propre(m.reponse), d: m.statut || "Usine"});
    else if (m.texte) l.push({qui: "them", t: "Bien reçu. L'équipe répond à son prochain passage.", d: "en attente", attente: true});
  });
  return l;
}
function chatHtml(grand){
  const l = filChat(), vus = grand ? l : l.slice(-4), p = actifs()[0];
  const chips = [[p ? `Où en est ${p.nom} ?` : "Où en est l'Usine ?", ""], ["Ajouter une vidéo", "Ajoute cette vidéo à la Bibliothèque : "], ["Lancer un test", "Lance un test pour "], ["Montre l'argent", "#argent"]];
  return `<section class="card chat"><div class="ch-head"><span class="av">U</span><div><div class="who">L'Usine</div><span class="st">${enSim() ? "simulation" : "répond à son prochain passage"}</span></div>${grand ? "" : `<a class="ouvrir" href="#chat">Tout voir ›</a>`}</div>
    <div class="msgs ${grand ? "long" : ""}" id="msgs">${vus.length ? vus.map(m => `<div class="msg ${m.qui}">${esc(m.t)}${m.d ? `<small>${esc(m.d)}</small>` : ""}</div>`).join("") : `<p class="sub" style="margin:0">Aucun message pour l'instant. Écrivez à l'Usine : une question, un ordre, une vidéo à étudier.</p>`}</div>
    ${noteEcran("chat")}
    <div class="chips">${chips.map(([t, v]) => `<button class="chip" type="button" data-chip="${esc(v || t)}">${esc(t)}</button>`).join("")}</div>
    <form class="ch-input" data-chat="1"><input id="chat-in" aria-label="Votre message à l'Usine" placeholder="Une question, un ordre…" autocomplete="off" maxlength="500"><button class="send" aria-label="Envoyer">${ICO.envoyer}</button></form></section>`;
}
function reponseSim(v){
  const p = M.projets.find(x => v.includes(x.nom) || v.includes(x.id));
  if (/o[uù] en est/i.test(v) && p){ const now = p.plan.find(x => x[0] === "now"); return `${p.nom} : étape « ${ETAPES[p.etape]} »${now ? `. En cours : ${now[2].toLowerCase()}` : ""}.`; }
  if (/vid[ée]o|youtube|https?:/i.test(v)) return "Bien reçu : la Bibliothécaire regarde la vidéo et propose une fiche. Vous la validerez ou la refuserez dans Fiches.";
  if (/test/i.test(v)) return "Je prépare le test. Rien ne sera publié, acheté ni dépensé en vrai sans votre « oui ».";
  if (/argent|gagn|b[ée]n[ée]fice/i.test(v)) return `Bénéfice cumulé sur 12 mois : ${signe(dernier(cumul(benefSerie())) ?? 0)}.`;
  return "Bien reçu. Le Directeur général s'en occupe à son prochain passage.";
}

VUES.accueil = function(){
  const d = M.decisions, v = verdict2(), x = d[0];
  const dec = x ? `<section class="card dec2 ${x.cat === 5 ? "grave" : ""}"><div class="meta"><span class="d"></span>${esc(CATS_COURTS[x.cat] || "Décision")}<span class="count">1 sur ${d.length}</span></div>
      <h2 class="q">${esc(x.titre)}</h2><p class="why">${esc(x.texte.slice(0, 170))}${x.texte.length > 170 ? "…" : ""}</p>
      <div class="acts"><a class="btn primary" href="#${lienDecision(x)}">Ouvrir la décision ›</a>${d.length > 1 ? `<a class="btn" href="#decisions">Voir les ${d.length}</a>` : ""}</div>
      <p class="hint">Vous entrez, vous lisez, vous décidez. Jamais à l'aveugle.</p></section>`
    : `<section class="card"><div class="done-msg">${ICON.decide.replace("<svg", '<svg width="20" height="20"')}Rien à décider. Vous serez prévenu dès qu'une décision arrive.</div></section>`;
  return { crumbs: [], html: `${barre()}
    <div class="verdict2 ${v.cls}" role="status"><span class="vdot"></span>${esc(v.t)}</div>
    ${noteEcran("decisions")}
    ${prio(1, "À décider", d.length ? `${d.length} en attente` : "", true)}${dec}
    ${inviterNotifications()}
    <div class="plabel"><span class="rank">💬</span>Parler à l'Usine</div>${chatHtml(false)}
    ${prio(2, "Argent")}${argentAccueil()}
    ${prio(3, "Projets")}${projetsAccueil()}
    ${prio(4, "La machine", "touchez pour entrer")}${machine()}
    ${pied()}`};
};
VUES.chat = function(){
  return { crumbs: [["Parler à l'Usine"]], html: `<div><div class="kicker">Parler à l'Usine</div><h1>Vos messages et les réponses</h1><p class="lead">Posez une question, donnez un ordre (ajouter une vidéo, lancer un test). ${enSim() ? "Simulation : rien n'est envoyé." : "Le message est écrit dans « Parler à l'Usine »."}</p></div>${chatHtml(true)}`};
};

/* La fenêtre Décision : voir (date, analyse, problèmes, coût, estimation, recommandation), puis décider en 2 touchers. */
function rentabDe(p){ return p && p.rentab ? p.rentab : null; }
function problemesDe(x, p){
  const l = [];
  if (p && p.scores) p.scores.filter(([, v]) => v != null && v <= 2).forEach(([k, v]) => l.push(`${k} : ${v} sur 5, c'est faible.`));
  if (p && p.notes) p.notes.split(/\s*[;\n]\s*/).filter(Boolean).forEach(t => l.push(propre(t)));
  if (x.cat === 5) l.unshift(x.texte);
  return l;
}
const confianceDe = p => { if (!p) return null; const i = M.biblio.idees.find(i => i.titre === p.nom); return i && i.confiance != null ? i.confiance : null; };
VUES.decision = function(x){
  const p = x.projet ? M.parId[x.projet] : null, r = rentabDe(p), probs = problemesDe(x, p), conf = confianceDe(p);
  const cr = p ? [["Mes projets", "projets"], [p.nom, "projets." + p.id], ["Décision"]] : [["Mes décisions", "decisions"], ["Décision"]];
  const options = x.options.length ? x.options : ["Valider"];
  const recoIdx = options.findIndex(o => x.reco && x.reco.toLowerCase().startsWith(o.toLowerCase().split(/\s+/)[0]));
  const cellule = (l, v, n = "") => v == null || v === "" ? "" : `<div><span class="cl">${l}</span><span class="cv">${v}</span>${n ? `<span class="cn">${n}</span>` : ""}</div>`;
  const cout = r ? [cellule("Coût de départ", r.depart != null ? eur(r.depart) : null, r.mensuel != null ? `puis ${eur(r.mensuel)} par mois` : ""), cellule("Prix prévu", r.prix != null ? eur(r.prix) : null),
    cellule("Équilibre estimé", r.pm != null ? `mois ${r.pm}` : null), cellule("Bénéfice sur 12 mois", r.b12 != null ? signe(r.b12) : null, r.r12 != null ? `pour ${eur(r.r12)} de revenus` : ""),
    cellule("Confiance de la Veille", conf != null ? conf + " %" : null)].join("") : "";
  const faits = [`Posée le ${fmtD(x.date) || "?"}${x.qui ? ` par ${propre(x.qui)}` : ""}.`];
  if (p) faits.push(`Projet ${p.nom} : étape « ${ETAPES[p.etape]} »${p.note ? `, note de la Veille ${p.note}/35` : ""}.`);
  if (x.cat !== 5) faits.push(x.texte);
  return { crumbs: cr, html: `<div><div class="kicker">${esc(CATS[x.cat] || "Décision")}</div><h1>${esc(x.titre)}</h1></div>
    ${noteEcran("dec" + x.n)}
    <div><h3 class="sec">L'analyse</h3><ul class="facts">${faits.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>
    <details class="card rep" ${x.resumeSim || x.resumeId ? "" : "hidden"}><summary><span class="tx"><b>Le résumé d'une page</b></span>${lienDoc(x.resumeLien, "Ouvrir")}</summary><div class="body">${resumeHtml(x)}</div></details>
    <div><h3 class="sec">Les problèmes</h3>${probs.length ? `<ul class="probs">${probs.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="sub" style="margin:0">Aucun problème relevé par l'équipe.</p>`}</div>
    <div><h3 class="sec">Le coût et l'estimation</h3>${cout ? `<div class="costgrid">${cout}</div><p class="sub" style="margin:8px 0 0">Une estimation, pas un résultat : elle sera comparée aux vrais chiffres.</p>` : `<p class="sub" style="margin:0">Pas encore chiffré par la Finance.</p>`}</div>
    ${x.reco ? `<div><h3 class="sec">Ce que l'équipe recommande</h3><p class="reco2">${esc(x.reco)}</p></div>` : ""}
    <div><h3 class="sec">Votre décision</h3><div class="opts">${options.map((o, i) => `<button class="opt ${i === recoIdx ? "reco-opt" : ""}" data-opt="${i + 1}" data-n="${esc(x.n)}"><b>${esc(o)}</b><small>${i === recoIdx ? "Recommandé par l'équipe" : "Toucher pour choisir"}</small></button>`).join("")}
      <button class="opt" data-corriger="${esc(x.n)}"><b>Demander des corrections</b><small>Écrire ce qu'il faut changer</small></button></div>
      <form id="fix-${esc(x.n)}" data-fix="${esc(x.n)}" hidden style="margin-top:10px;flex-direction:column;gap:8px"><textarea class="fix" id="fixt-${esc(x.n)}" aria-label="Les corrections demandées" placeholder="Ex. : « Ajoutez une version en anglais avant de lancer. »"></textarea><div><button class="btn primary">Envoyer les corrections</button></div></form>
      <p class="hint">Un toucher pour choisir, un deuxième pour confirmer.</p></div>
    <p class="sub">${enSim() ? "Simulation : votre réponse reste dans ce navigateur." : "Votre réponse est écrite dans le tableau. L'équipe l'applique à son prochain passage."}</p>`};
};

/* Sécurité : voir, révoquer un accès, voir les alertes. */
VUES.securite = function(){
  const s = etatSecurite(), sec = M.usine.securite[0] || {};
  const ok = [["Seul votre compte Google ouvre vos données", true], ["Votre e-mail n'est écrit nulle part dans l'app", true], ["Aucun secret dans l'app", true],
    ["Rien de vos données n'est gardé sur le téléphone", true], ["Mode TEST : aucune dépense réelle sans votre « oui »", true],
    [sec["État"] ? `Surveillance de l'Usine : ${propre(sec["État"])}` : "Surveillance de l'Usine : pas encore de contrôle", !!sec["État"] && s.ok]];
  return { crumbs: [["Sécurité"]], html: `<div><div class="kicker">Sécurité</div><h1>${s.ok ? "Tout est vert" : pluriel(`${s.alertes.length} alerte(s) à regarder`)}</h1></div>
    ${noteEcran("securite")}
    <ul class="statline">${ok.map(([t, v]) => `<li><span class="${v ? "ok" : "ko"}">${v ? "✓" : "!"}</span>${esc(t)}</li>`).join("")}</ul>
    <div><h3 class="sec">Alertes</h3>${s.alertes.length ? `<div class="vlist">${s.alertes.map(a => a.lien ? `<a class="vrow" href="#${esc(a.lien)}"><span class="nm">${esc(a.t)}<small>${esc(fmtD(a.date))}</small></span><span class="go rt">›</span></a>` : `<div class="vrow"><span class="nm">${esc(a.t)}<small>${esc(fmtD(a.date))}</small></span></div>`).join("")}</div>` : `<p class="sub" style="margin:0">Aucune alerte.</p>`}</div>
    <div><h3 class="sec">Accès</h3><div class="vlist">
      <div class="vrow"><span class="nm">Google (votre compte)<small>${enSim() ? "Simulation : pas de connexion." : G.connecte() ? "Connecté, pour une heure au plus. Jamais enregistré." : "Pas connecté."}</small></span>${!enSim() && G.connecte() ? `<button class="btn danger rt" data-arme="revoquer">Couper l'accès</button>` : ""}</div>
    </div><p class="sub" style="margin:8px 0 0">Pour retirer l'autorisation donnée à l'app : <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">vos autorisations Google ↗</a>.</p></div>
    <a class="open-link" href="#usine" style="margin-left:0;align-self:flex-start">Les coulisses de l'Usine ›</a>`};
};

/* ===================== Notifications, réglages ===================== */
function inviterNotifications(){
  const A = window.QG_ALERTES; if (!A) return "";
  const e = A.etat(); if (e.permission !== "default" || (!e.support && !e.ios)) return "";
  if (!e.support) return e.installee ? "" : `<div class="banner info"><span>Pour être prévenu quand une décision vous attend, installez d'abord l'app sur l'écran d'accueil (Partager, puis « Sur l'écran d'accueil »).</span><a class="btn" href="#demarrage">Comment faire</a></div>`;
  return `<div class="banner info"><span>Être prévenu sur ce téléphone quand une décision vous attend ?</span><button class="btn primary" id="notif-activer">Activer</button></div>`;
}
const fait = (ok, texte) => `<span class="pill ${ok ? "good" : "warn"}">${ok ? "Fait" : texte || "À faire"}</span>`;
function etatMiseEnRoute(){
  const A = window.QG_ALERTES, e = A ? A.etat() : {};
  const enLigne = location.protocol === "https:" && !/^(localhost|127\.)/.test(location.hostname);
  const client = G.idClientValide(G.idClient()), co = G.connecte();
  return {e, client, co, faits: [enLigne, client && co, !!e.installee, e.permission === "granted"]};
}
VUES.reglages = function(){
  const {e, faits} = etatMiseEnRoute(), theme = THEME(), reste = faits.filter(x => !x).length;
  const perm = e.permission === "granted" ? "Activées sur ce téléphone." : e.permission === "denied" ? "Refusées : rouvrez-les dans les réglages du téléphone (Notifications, Mon QG)." :
    !e.support ? (e.ios && !e.installee ? "Sur iPhone, elles marchent une fois l'app installée sur l'écran d'accueil." : "Ce navigateur ne sait pas afficher de notifications.") : "Pas encore activées.";
  return { crumbs: [["Réglages"]], html: `<div><h1>Réglages</h1></div>
    ${noteEcran("reglages")}
    ${tile("demarrage", "pret", "Mise en route", reste ? `${reste} étape${reste > 1 ? "s" : ""} à faire vous-même` : "Tout est fait.")}
    <div class="card stack"><h2>Notifications</h2><p class="sub" style="margin:0">${perm} Vous êtes prévenu de chaque nouvelle décision et de tout problème grave.</p>
      <div class="row-btns">${e.support && e.permission === "default" ? `<button class="btn primary" id="notif-activer">Activer les notifications</button>` : ""}${e.permission === "granted" ? `<button class="btn" id="notif-tester">Essayer</button>` : ""}</div>
      ${e.push ? `<div class="ligne-reglage"><span><b>Même app fermée</b><span class="sub">${e.appFermee ? "Activé sur ce téléphone." : "Après la mise en ligne et le script Google."}</span></span>${e.appFermee ? `<button class="btn" id="notif-push-stop">Arrêter</button>` : `<button class="btn" id="notif-push">Activer</button>`}</div>` : ""}</div>
    <div class="card stack"><h2>Données affichées</h2><div class="seg seg-l" role="group" aria-label="Données affichées"><button data-mode="reel" aria-pressed="${MODE === "reel"}">Vraies données</button><button data-mode="sim" aria-pressed="${MODE === "sim"}">Simulation</button></div>
      <p class="sub" style="margin:0">La Simulation montre l'app avec des données d'exemple. Rien n'est envoyé.</p></div>
    <div class="card stack"><h2>Apparence</h2><div class="seg seg-l" role="group" aria-label="Thème">${[["auto","Comme le téléphone"],["light","Clair"],["dark","Sombre"]].map(([k, t]) => `<button data-theme-choix="${k}" aria-pressed="${theme === k}">${t}</button>`).join("")}</div></div>
    <p class="foot">Mon QG ne garde aucune de vos données sur le téléphone. La connexion Google dure une heure et n'est jamais enregistrée.</p>`};
};
VUES.demarrage = function(){
  const {e, client, co, faits} = etatMiseEnRoute();
  const etape = (n, titre, ok, texte, action = "") => `<li class="${ok ? "done" : ""}"><span class="num-rond">${ok ? "✓" : n}</span><div><div class="et-h"><b>${titre}</b>${fait(ok)}</div><p class="sub" style="margin:4px 0 0">${texte}</p>${action}</div></li>`;
  return { crumbs: [["Réglages", "reglages"], ["Mise en route"]], html: `<div><h1>Mise en route</h1><p class="lead">Ce que vous devez faire vous-même, une seule fois. Rien n'est payant.</p></div>
    <div class="card"><ol class="etapes">
      ${etape(1, "Créer un compte Cloudflare (gratuit)", faits[0], "Sur dash.cloudflare.com, « Sign up ». Aucune carte bancaire. Dites-moi ensuite « c'est fait » : je prépare la mise en ligne et ne la lance qu'avec votre « oui ».")}
      ${etape(2, "Donner l'autorisation Google", faits[1], client ? (co ? "Connecté : l'app lit et écrit votre tableau TEST avec votre compte." : "L'ID client est enregistré. Il reste à vous connecter.") : "Dans Google Cloud (Clients, « Client Web 1 »), ajoutez l'adresse de l'app, puis collez ici l'ID client et connectez-vous. Je vous donnerai l'adresse exacte après la mise en ligne.",
        client && !co ? `<button class="btn primary" id="connexion" style="margin-top:8px">Se connecter avec Google</button>` : "")}
      ${etape(3, "Installer l'app sur l'écran d'accueil", faits[2], e.ios ? "Dans Safari : bouton Partager, puis « Sur l'écran d'accueil », puis Ajouter." : "Dans Chrome : menu ⋮, puis « Installer l'application ».")}
      ${etape(4, "Activer les notifications", faits[3], "Dans Réglages. Sur iPhone, depuis l'app installée (étape 3).")}
      ${etape(5, "Être prévenu même app fermée (facultatif)", !!e.appFermee, "Dans le tableau TEST : Extensions, Apps Script, collez le script « Mon QG » que je vous donne, puis lancez « installer ». Ensuite, dans Réglages, « Même app fermée ».")}
    </ol></div>`};
};
const THEME = () => { try { return localStorage.getItem("qg-theme") || "auto"; } catch(e){ return "auto"; } };
function appliquerTheme(t){
  try { t === "auto" ? localStorage.removeItem("qg-theme") : localStorage.setItem("qg-theme", t); } catch(e) {}
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
appliquerTheme(THEME());
const ERREURS_NOTIF = {no_push: "Ce navigateur ne sait pas recevoir de notifications app fermée.", denied: "Les notifications sont refusées sur ce téléphone.",
  no_relay: "Le relais n'est pas encore en ligne : il viendra avec la mise en ligne sur Cloudflare.", needs_reauth: "Connectez-vous d'abord avec Google (Réel).",
  other_owner: "Ce relais appartient à un autre compte Google.", offline: "Pas de réseau."};
async function notif(travail, ok){
  try { await travail(); if (ok) notes.reglages = {t: ok}; }
  catch(e){ notes.reglages = {t: ERREURS_NOTIF[e && e.code] || "Ça n'a pas marché. Réessayez plus tard.", cls: "bad"}; }
  route(true);
}

function statutFiche(f){ return /valid/i.test(f.statut) ? `<span class="pill good">Validée</span>` : /propos/i.test(f.statut) ? `<span class="pill warn">Proposition</span>` : `<span class="pill off">${esc(f.statut || "Ancienne")}</span>`; }
function rayonsDe(){ const g = {}; M.biblio.fiches.forEach(f => (g[f.rayon] ||= []).push(f)); return Object.entries(g); }
function livresDe(fs){ const g = {}; fs.forEach(f => (g[f.livre] ||= []).push(f)); return Object.entries(g).sort((a, b) => (a[0] === "Toutes") - (b[0] === "Toutes")); }
function resumeHtml(x){
  if (x.resumeSim) return `<div class="md">${md(x.resumeSim)}</div>`;
  if (!x.resumeId) return `<p class="sub" style="margin:0">Pas de résumé joint à cette décision.</p>`;
  const r = resumes[x.resumeId];
  if (!r){ chargerResume(x.resumeId); return `<p class="sub" style="margin:0">Lecture du résumé dans Google Drive…</p>`; }
  if (r.err) return `<p class="sub" style="margin:0">${esc(r.err)} Ouvrez le document avec le bouton.</p>`;
  return `<div class="md">${md(r.texte.split("\n").map(l => /https?:/.test(l) ? l : l.replace(/\s*au moment \d+/g, "").replace(/\s*\(moment \d+\)/g, "").replace(/^(#+\s*\**)(?:TEST-)?P\d{3}\s*–\s*/, "$1").replace(/\b(?:TEST-)?P\d{3}\b/g, id => M.parId[id] ? M.parId[id].nom : id).replace(/(fiche) [A-Z]{2,3}-[0-9A-Z]{3}/g, "$1")).join("\n"))}</div>`;
}
async function chargerResume(id){
  if (resumes[id] || !mcp) { if (!mcp) resumes[id] = {err: "Connectez-vous à Google pour lire le résumé."}; return; }
  resumes[id] = null;
  try { const res = await mcp.callTool(GD, "read_file_content", {fileId: id}, {cache: {staleTime: 300000, gcTime: 3600000}});
    const p = res.payload || {}; resumes[id] = {texte: p.fileContent || p.content || ""}; }
  catch(e){ resumes[id] = {err: errText(e, GD)}; }
  route(true);
}
function pied(){
  const lieu = enSim() ? "Simulation : données d'exemple, rien n'est envoyé ni dépensé." : "Vraies données de l'Usine (environnement TEST), lues avec votre compte Google.";
  return `<div class="foot2">${ICO.verrou}<span>Seul vous pouvez entrer. Votre e-mail n'est écrit nulle part. ${lieu}${!enSim() && mcp ? ` <button class="btn" id="deconnexion" style="padding:4px 10px;font-size:12px;min-height:0">Se déconnecter</button>` : ""}</span></div>`;
}

/* ===================== Navigation par niveaux ===================== */
function bandeau(){
  if (enSim()) return "";
  const errs = Object.entries(S.err).filter(([k]) => !OPTIONNELS.includes(k));
  if (!mcp && mcpPret) return connexionHtml();
  if (errs.length) return `<div class="banner ${errs[0][1].retryable ? "" : "bad"}"><span>${esc(errText(errs[0][1], GS))}</span>${["needs_reauth","not_granted","no_sheet"].includes(errs[0][1].code) ? `<button class="btn" id="perm">Se reconnecter</button>` : `<button class="btn" id="reload">Réessayer</button>`}</div>`;
  return "";
}
let derniereVue = "", envoye = null;
const idsDu = f => new Set([...(f ? f.elements : [])].map(e => e.id).filter(Boolean));
function route(garderScroll){
  if (MODE === "reel" && (!S.et || !S.pj)){
    $("#view").innerHTML = barre() + bandeau() + (mcp || !mcpPret ? `<p class="sub" role="status" style="margin:0">Lecture de vos vraies données dans le tableau de l'Usine…</p><div class="sk sk-h"></div><div class="sk sk-card"></div><div class="sk sk-card"></div>` : "");
    return;
  }
  M = MODE === "sim" ? (M && M.mode === "sim" && M.persoV === persoV ? M : Object.assign(construireSim(), {persoV})) : construireReel();
  const h = (location.hash.slice(1) || "accueil"), parts = h.split(".");
  let v = null;
  try {
    if (parts[0] === "projets" && parts[1]){ const p = M.parId[parts[1]]; v = p ? (parts[2] ? VUES["projet." + parts[2]]?.(p) : VUES.projet(p)) : null; }
    else if (parts[0] === "equipe" && parts[1]){
      if (parts[1].startsWith("service-")) v = VUES.service(+parts[1].slice(8));
      else { const a = M.parCle[parts[1]]; v = a ? (parts[2] ? VUES["agent." + parts[2]]?.(a) : VUES.agent(a)) : null; } }
    else if (parts[0] === "decisions" && parts[1]){ const x = M.decisions.find(d => String(d.n) === parts[1]); v = x ? VUES.decision(x) : null; }
    else if ((parts[0] === "argent" || parts[0] === "usine") && parts[1]) v = VUES[parts[0] + "." + parts[1]]?.();
    else if (parts[0] === "biblio" && parts[1]){
      if (parts[1] === "f"){ const id = decodeURIComponent((parts[2] || "").replace(/~/g, "%")); const f = M.biblio.fiches.find(x => x.id === id); v = f ? VUES.fiche(f) : null; }
      else if (/^r\d+$/.test(parts[1])) v = parts[2] != null ? VUES.livre(+parts[1].slice(1), +parts[2]) : VUES.rayon(+parts[1].slice(1));
      else v = VUES[parts[1]]?.(); }
    else if (parts[0] === "biblio") v = VUES.biblio();
    else v = VUES[parts[0]]?.();
  } catch(e){ console.error(e); v = {crumbs: [], html: `<div class="banner bad"><span>Cette page n'a pas pu s'afficher. Revenez à l'accueil.</span><a class="btn" href="#accueil">Accueil</a></div>`}; }
  if (!v){ if (h !== "accueil"){ location.hash = "accueil"; return; } return; }
  // Les données se relisent en arrière-plan : ce que le Président est en train d'écrire ne doit pas s'effacer.
  const saisies = garderScroll ? [...document.querySelectorAll("#view input[id], #view textarea[id]")].map(e => [e.id, e.value, e === document.activeElement]) : [];
  // L'accueil est le cockpit ; tout le reste s'ouvre comme une fenêtre, avec « Retour » (un niveau plus haut).
  if (parts[0] === "accueil") $("#view").innerHTML = bandeau() + v.html;
  else {
    const parent = (v.crumbs.slice(0, -1).reverse().find(c => c[1]) || [, "accueil"])[1], titre = (v.crumbs.at(-1) || ["Mon QG"])[0];
    $("#view").innerHTML = `<section class="sheet"><div class="sheet-head"><a class="back" href="#${esc(parent)}">‹ Retour</a><span class="sheet-tag ${enSim() ? "sim" : ""}">${enSim() ? "Simulation · " : ""}${esc(titre)}</span></div><div class="sheet-body">${bandeau()}${v.html}</div></section>`;
  }
  const vides = envoye; envoye = null; // un formulaire bien envoyé repart vide
  saisies.forEach(([id, val, actif]) => { const e = document.getElementById(id); if (!e || (vides && vides.has(id))) return; if (val && e.value !== val) e.value = val; if (actif) e.focus(); });
  const th = $("#thread") || $("#msgs"); if (th) th.scrollTop = th.scrollHeight;
  if (!garderScroll && derniereVue !== h) window.scrollTo(0, 0);
  derniereVue = h;
  if (MODE === "reel" && window.QG_ALERTES) QG_ALERTES.verifier(M.decisions);
}
let persoV = 0;
function setMode(m){
  MODE = m; try { localStorage.setItem("qg-usine-mode", m); } catch(e) {}
  M = null; route();
}

/* ===================== Écritures (Réel : dans le tableau ; Simulation : dans ce navigateur) ===================== */
const maintenant = () => { const d = new Date(); return `${iso(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
async function envoyerMessage(texte){
  await mcp.callTool(GS, "append_values", {spreadsheetId: SHEET, range: "'Parler à l''Usine'!A1:E1", values: [[maintenant(), texte, "", "", ""]]});
  await mcp.invalidate(GS, "get_values").catch(() => {});
}
async function repondre(n, texte){
  await mcp.callTool(GS, "update_values", {spreadsheetId: SHEET, range: `'Décisions & Questions'!H${n}:I${n}`, values: [[texte, "Répondu"]]});
  await mcp.invalidate(GS, "get_values").catch(() => {});
}
const echecEnvoi = e => (e && (e.code === "server_unavailable" || e.code === "upstream_error")) ? "Pas de confirmation de Google Sheets. Actualisez la page pour vérifier si c'est arrivé avant de renvoyer." : errText(e, GS);
async function action(cle, travail, ok, boutons){
  boutons.forEach(b => b.disabled = true);
  try { await travail(); notes[cle] = {t: ok}; envoye = idsDu(boutons[0] && boutons[0].form); }
  catch(e){ notes[cle] = {t: echecEnvoi(e), cls: "bad"}; }
  boutons.forEach(b => b.disabled = false); route(true);
}
function decider(n, texte, libelle, boutons){
  const x = M.decisions.find(d => String(d.n) === String(n)); if (!x) return;
  const cle = "decisions", ok = libelle ? `C'est noté : « ${libelle} » pour « ${x.titre} ». L'équipe passe à la suite.` : "Vos corrections sont envoyées. L'équipe les fait et revient vers vous.";
  if (enSim()){ SIMDEC.add(String(n)); notes[cle] = {t: ok}; persoV++; if (location.hash.slice(1) !== "accueil") location.hash = "accueil"; else route(true); return; }
  action(cle, () => repondre(n, texte), ok, boutons).then(() => { if (notes[cle] && !notes[cle].cls && location.hash.slice(1) !== "accueil") location.hash = "accueil"; });
}
/* Une action qui compte = 2 touchers : le premier arme le bouton, le second confirme (4 secondes pour le faire). */
function arme(b, texte){
  if (b.classList.contains("arme")) return true;
  document.querySelectorAll("#view .arme").forEach(desarmer);
  const s = b.querySelector("small") || b; b.dataset.avant = s.textContent; s.textContent = texte || "Touchez encore pour confirmer"; b.classList.add("arme");
  b._t = setTimeout(() => desarmer(b), 4000); return false;
}
function desarmer(b){ clearTimeout(b._t); if (!b.classList.contains("arme")) return; (b.querySelector("small") || b).textContent = b.dataset.avant; b.classList.remove("arme"); }
const SIMDEC = new Set();
const _construireSim = construireSim;
construireSim = function(){ const m = _construireSim(); m.decisions = m.decisions.filter(d => !SIMDEC.has(String(d.n))); m.projets.forEach(p => p.decisions = p.decisions.filter(d => !SIMDEC.has(String(d.n)))); (SIMMSG).forEach(([id, t]) => { const p = m.parId[id]; if (p) p.messages.push({texte: t, date: "à l'instant", reponse: "", statut: ""}); }); return m; };
const SIMMSG = [];

document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.mode){ setMode(b.dataset.mode); return; }
  if (b.id === "reload"){ S.err = {}; demarrer(); return; }
  if (b.id === "perm" || b.id === "connexion"){ connecter(); return; }
  if (b.id === "deconnexion"){ G.seDeconnecter(); mcp = null; unsubs.forEach(u => { try { u(); } catch(e) {} }); unsubs = []; Object.keys(RANGES).forEach(k => delete S[k]); S.err = {}; route(); return; }
  if (b.id === "client-ok"){ const v = ($("#client-id").value || "").trim(); if (!G.idClientValide(v)){ notes.connexion = {t: "Ce n'est pas un ID client Google : il finit par « .apps.googleusercontent.com ».", cls: "bad"}; route(true); return; }
    G.enregistrerIdClient(v); connecter(); return; }
  if (b.id === "client-change"){ G.enregistrerIdClient(""); route(true); return; }
  if (b.dataset.opt){ if (!arme(b)) return; desarmer(b); decider(b.dataset.n, b.dataset.opt, b.querySelector("b").textContent, [...document.querySelectorAll("#view .opt")]); return; }
  if (b.dataset.chip){ const v = b.dataset.chip; if (v.startsWith("#")){ location.hash = v.slice(1); return; } const i = $("#chat-in"); i.value = v; i.focus(); i.setSelectionRange(v.length, v.length); return; }
  if (b.dataset.arme === "revoquer"){ if (!arme(b)) return; G.seDeconnecter(); mcp = null; unsubs.forEach(u => { try { u(); } catch(e) {} }); unsubs = []; Object.keys(RANGES).forEach(k => delete S[k]); S.err = {}; notes.connexion = {t: "Accès Google coupé sur ce téléphone. Pour retirer aussi l'autorisation, ouvrez vos autorisations Google."}; location.hash = "accueil"; route(); return; }
  if (b.id === "notif-activer"){ notif(() => QG_ALERTES.activer().then(p => { if (p !== "granted"){ const e = new Error(p); e.code = "denied"; throw e; } if (M && MODE === "reel") QG_ALERTES.verifier(M.decisions); }), "Notifications activées. Vous serez prévenu quand une décision vous attend."); return; }
  if (b.id === "notif-tester"){ notif(() => QG_ALERTES.tester(), "Notification de test envoyée."); return; }
  if (b.id === "notif-push"){ notif(() => QG_ALERTES.activerAppFermee(), "C'est prêt : vous serez prévenu même app fermée. Une notification de bienvenue arrive."); return; }
  if (b.id === "notif-push-stop"){ notif(() => QG_ALERTES.arreterAppFermee(), "Notifications app fermée arrêtées sur ce téléphone."); return; }
  if (b.dataset.themeChoix){ appliquerTheme(b.dataset.themeChoix); route(true); return; }
  if (b.dataset.corriger){ const f = document.getElementById("fix-" + b.dataset.corriger); f.hidden = false; f.style.display = "flex"; f.querySelector("textarea").focus(); return; }
  const a = M && (M.parCle[b.dataset.agent || b.dataset.remplacer]);
  if (b.dataset.modele && a){
    const ok = `${a.prenom} passera au modèle ${MODELES[b.dataset.modele].nom} dès demain. On mesurera l'effet sur sa qualité dans un mois.`;
    if (enSim()){ (PERSO[a.id] ||= {}).niveau = b.dataset.modele; savePerso(); persoV++; notes["contrat" + a.id] = {t: ok}; route(true); return; }
    action("contrat" + a.id, () => envoyerMessage(`Change le modèle de « ${a.poste} » : ${b.dataset.modele}`), ok + " La demande est envoyée à l'Usine.", [b]); return;
  }
  if (b.dataset.remplacer && a){
    const ok = `Demande envoyée : le Directeur général proposera un remplaçant pour ${a.prenom}, avec une semaine d'essai avant de décider.`;
    if (enSim()){ notes["contrat" + a.id] = {t: ok}; route(true); return; }
    action("contrat" + a.id, () => envoyerMessage(`Change « ${a.poste} » : demander un remplaçant`), ok, [b]); return;
  }
  if (b.dataset.annuler){
    const f = M.biblio.fiches.find(x => x.id === b.dataset.annuler), ok = `C'est noté : « ${f.titre} » revient à sa version ${b.dataset.v}.`;
    if (enSim()){ notes.semaine = {t: ok}; route(true); return; }
    action("semaine", () => envoyerMessage(`Change, reviens à la v${b.dataset.v} de la fiche ${f.id}`), ok, [b]); return;
  }
});
document.addEventListener("submit", e => {
  e.preventDefault(); const f = e.target, btns = [...f.querySelectorAll("button")];
  if (enSim()) envoye = idsDu(f); // en Simulation, l'envoi réussit tout de suite
  if (f.dataset.proj){ const v = $("#cm").value.trim(); if (!v) return; const p = M.parId[f.dataset.proj];
    if (enSim()){ SIMMSG.push([p.id, v]); persoV++; notes["msg" + p.id] = {t: "Message gardé dans la simulation."}; route(true); return; }
    action("msg" + p.id, () => envoyerMessage(`${v} (projet ${p.id}, ${p.nom})`), "Message envoyé. La réponse arrive au prochain passage du moteur.", btns); return; }
  if (f.dataset.fix){ const v = document.getElementById("fixt-" + f.dataset.fix).value.trim(); if (!v) return; decider(f.dataset.fix, "Demander des corrections : " + v, "", btns); return; }
  if (f.dataset.chat){ const v = $("#chat-in").value.trim().slice(0, 500); if (!v) return;
    if (enSim()){ SIMCHAT.push({qui: "me", t: v, d: "à l'instant"}, {qui: "them", t: reponseSim(v), d: "Usine · simulation"}); route(true); return; }
    action("chat", () => envoyerMessage(v), "Envoyé à l'Usine. Elle répond à son prochain passage.", btns); return; }
  if (f.dataset.renommer){ const v = $("#np").value.trim().slice(0, 30); const a = M.parCle[f.dataset.renommer]; if (!v || !a) return;
    if (enSim()){ (PERSO[a.id] ||= {}).prenom = v; savePerso(); persoV++; notes["contrat" + a.id] = {t: `Il s'appelle maintenant ${v}.`}; route(true); return; }
    action("contrat" + a.id, () => envoyerMessage(`Change le prénom de « ${a.poste} » en ${v}`), `C'est envoyé : ${a.poste} s'appellera ${v} après le prochain passage du moteur.`, btns); return; }
  if (f.dataset.deposer){ const t = $("#dep-titre").value.trim().slice(0, 120), x = $("#dep-texte").value.trim(); if (!t || !x) return;
    if (enSim()){ notes.deposer = {t: `Simulation : « ${t} » serait déposé dans « À intégrer ».`}; route(true); return; }
    btns.forEach(b => b.disabled = true);
    G.deposerDocument(t, x).then(r => { envoye = idsDu(f); notes.deposer = r.dansLeDossier ? {t: `« ${t} » est dans « À intégrer ». La Bibliothécaire l'intègre à son prochain passage.`}
        : {t: `Google n'a pas permis d'écrire dans « À intégrer » : « ${t} » est dans votre Drive, à la racine. Glissez-le dans « À intégrer (TEST) ».`, cls: "warn"}; })
      .catch(e => { notes.deposer = {t: errText(e, GD), cls: "bad"}; }).finally(() => { btns.forEach(b => b.disabled = false); route(true); });
    return; }
  if (f.dataset.objectif){ const x = nombre($("#obj-eur").value), m = nombre($("#obj-mois").value); if (!x || !m) { notes.objectif = {t: "Indiquez un montant en euros et un nombre de mois.", cls: "warn"}; route(true); return; }
    const ok = `Objectif envoyé : ${eur(x)} par mois dans ${m} mois.`;
    if (enSim()){ notes.objectif = {t: ok}; route(true); return; }
    action("objectif", () => envoyerMessage(`Change l'objectif : ${x} € par mois dans ${m} mois`), ok + " L'Usine l'utilise pour calculer combien de projets tester.", btns); return; }
});

/* ===================== Lecture des vraies données ===================== */
let unsubs = [];
function demarrer(){
  unsubs.forEach(u => { try { u(); } catch(e) {} }); unsubs = [];
  Object.keys(RANGES).forEach(k => {
    unsubs.push(mcp.watchTool(GS, "get_values", {spreadsheetId: SHEET, range: RANGES[k]}, ev => {
      if (ev.type === "data"){ S[k] = {rows: rowsFrom(ev.result.payload)}; delete S.err[k]; S.at = ev.result.cache ? ev.result.cache.storedAt : Date.now(); }
      else if (OPTIONNELS.includes(k) && ev.error.code === "tool_error"){ S[k] = {rows: [], absent: true}; }
      else { S.err[k] = ev.error; if (["needs_reauth","not_granted","no_sheet","many_sheets"].includes(ev.error.code)) S[k] = null; }
      planifier();
    }, {refetchInterval: 180000}));
  });
}
let timer = 0;
const planifier = () => { clearTimeout(timer); timer = setTimeout(() => { if (MODE === "reel") route(true); }, 60); };
/* « Retour » ramène là d'où l'on vient (un niveau en arrière) ; sans historique, au niveau du dessus. */
let pile = [], enRetour = false;
document.addEventListener("click", e => {
  const a = e.target.closest("a.back"); if (!a) return;
  e.preventDefault(); enRetour = true; const h = pile.pop(); location.hash = h || a.getAttribute("href").slice(1);
}, true);
window.addEventListener("hashchange", () => {
  const h = location.hash.slice(1) || "accueil";
  if (h === "accueil") pile = []; else if (!enRetour && derniereVue && derniereVue !== h) pile.push(derniereVue);
  enRetour = false; Object.keys(notes).forEach(k => { if (notes[k].t0 && Date.now() - notes[k].t0 > 1500) delete notes[k]; }); route(); });
route();
mcp = G.connecte() ? G.mcp : null;
mcpPret = true;
{ const e = G.erreurRetour(); if (e) notes.connexion = {t: e, cls: "bad"}; }
if (mcp) demarrer();
route(true);

/* ===================== Connexion Google (Réel) ===================== */
function connecter(){ if (!G.seConnecter()){ notes.connexion = {t: "Collez d'abord l'ID du client Google.", cls: "bad"}; route(true); } }
function connexionHtml(){
  const client = G.idClient();
  if (!G.idClientValide(client)) return `<div class="card" style="display:flex;flex-direction:column;gap:10px">${noteEcran("connexion")}
    <h2>Première connexion</h2><p class="sub" style="margin:0">Collez l'<b>ID client</b> de « Client Web 1 » (Google Cloud, Google Auth Platform, Clients). Ce n'est pas un secret ; il reste sur ce téléphone.</p>
    <div class="field"><input id="client-id" aria-label="ID client Google" placeholder="123…apps.googleusercontent.com" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn primary" id="client-ok">Enregistrer et se connecter</button></div>
    <p class="sub" style="margin:0">En attendant, la <button class="btn" data-mode="sim" style="padding:2px 8px">Simulation</button> montre l'app avec des données d'exemple.</p></div>`;
  return `<div class="card" style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">${noteEcran("connexion")}
    <h2>Connectez-vous pour voir vos vraies données</h2>
    <p class="sub" style="margin:0">Le QG lit et écrit le tableau et le Drive de l'Usine (environnement TEST) avec votre compte Google. La connexion dure une heure et n'est jamais enregistrée sur le téléphone.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="connexion">Se connecter avec Google</button><button class="btn" data-mode="sim">Voir la Simulation</button></div>
    <button class="btn" id="client-change" style="padding:4px 10px;font-size:12px">Changer l'ID client</button></div>`;
}
