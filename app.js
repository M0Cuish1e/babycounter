/* Babycounter : carnet personnel des naissances.
   Tout est stocké sur l'appareil (localStorage). Aucun envoi réseau. */
(function () {
  'use strict';

  /* ---------- Constantes ---------- */
  var CLE = 'babycounter:donnees';
  var VERSION = 1;
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var JOURS_C = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  var MODES = { naturel: 'naturel', instrumente: 'instrumenté' };
  var PERIDURALE = { avec: 'avec péri', sans: 'sans péri' };
  var TRAVAIL = { spontane: 'spontané', declenche: 'déclenché' };
  /* Anciens modes (jusqu'en novembre 2026) : voie basse devient naturel, instrumentale devient instrumenté.
     La césarienne n'existe plus : le mode passe à « non renseigné » et l'ancienne valeur reste dans modeInitial. */
  var ANCIENS_MODES = { 'voie-basse': 'naturel', 'instrumentale': 'instrumente' };

  /* ---------- État ---------- */
  var donnees = { version: VERSION, bebes: [], dernierExport: null, rappelMasque: null };
  var etat = { vue: 'accueil', periode: 'mois', ancre: minuit(new Date()), jour: null };
  var ficheId = null;

  /* ---------- Outils ---------- */
  function $(id) { return document.getElementById(id); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function minuit(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function lire(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function lundi(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); }
  function maj(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function pluriel(n, mot) { return n + ' ' + mot + (n > 1 ? 's' : ''); }
  function quantieme(j) { return j === 1 ? '1er' : String(j); }
  function identifiant() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* Crée un élément : el('p', {class: 'x', text: '…'}, [enfants]) */
  function el(tag, props, enfants) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'onclick') e.addEventListener('click', v);
      else e.setAttribute(k, v);
    });
    (enfants || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function vider(e) { while (e.firstChild) e.removeChild(e.firstChild); }

  /* ---------- Stockage ---------- */
  /* Ramène n'importe quelle fiche (y compris d'un ancien export) au format courant.
     Les champs inconnus sont conservés pour ne rien perdre lors d'évolutions futures. */
  function normaliser(b) {
    if (!b || typeof b !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return null;
    var n = {};
    Object.keys(b).forEach(function (k) { n[k] = b[k]; });
    n.id = String(b.id || identifiant());
    n.prenom = String(b.prenom || '').trim().slice(0, 40);
    n.sexe = b.sexe === 'M' ? 'M' : 'F';
    n.heure = /^\d{2}:\d{2}$/.test(b.heure || '') ? b.heure : '';
    n.poids = typeof b.poids === 'number' && b.poids > 0 ? Math.round(b.poids) : null;
    /* La taille n'est plus saisie : une ancienne valeur reste dans la fiche comme champ inconnu. */
    n.mode = MODES[b.mode] ? b.mode : ANCIENS_MODES[b.mode] || '';
    if (b.mode === 'cesarienne') n.modeInitial = 'cesarienne';
    n.peridurale = PERIDURALE[b.peridurale] ? b.peridurale : '';
    n.travail = TRAVAIL[b.travail] ? b.travail : '';
    n.note = String(b.note || '').slice(0, 500);
    n.cree = b.cree || new Date().toISOString();
    n.modifie = b.modifie || n.cree;
    return n;
  }
  function charger() {
    try {
      var brut = JSON.parse(localStorage.getItem(CLE));
      if (brut && Array.isArray(brut.bebes)) {
        donnees.bebes = brut.bebes.map(normaliser).filter(Boolean);
        donnees.dernierExport = brut.dernierExport || null;
        donnees.rappelMasque = brut.rappelMasque || null;
      }
    } catch (e) { /* stockage vide ou illisible : on démarre sans données */ }
  }
  function enregistrer() {
    try {
      localStorage.setItem(CLE, JSON.stringify(donnees));
      return true;
    } catch (e) {
      toast('Enregistrement impossible : le stockage de l’appareil est plein ou bloqué.');
      return false;
    }
  }

  /* ---------- Sélections ---------- */
  function cleTri(b) { return b.date + ' ' + (b.heure || '00:00') + ' ' + b.cree; }
  function tries(liste) { return liste.slice().sort(function (a, b) { return cleTri(a) < cleTri(b) ? 1 : -1; }); }
  function parJour() {
    var index = {};
    tries(donnees.bebes).reverse().forEach(function (b) { (index[b.date] = index[b.date] || []).push(b); });
    return index;
  }
  function bornes() {
    var a = etat.ancre, debut, fin;
    if (etat.periode === 'semaine') { debut = lundi(a); fin = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + 6); }
    else if (etat.periode === 'mois') { debut = new Date(a.getFullYear(), a.getMonth(), 1); fin = new Date(a.getFullYear(), a.getMonth() + 1, 0); }
    else { debut = new Date(a.getFullYear(), 0, 1); fin = new Date(a.getFullYear(), 11, 31); }
    return { debut: debut, fin: fin };
  }
  function selection() {
    if (etat.jour) return tries(donnees.bebes.filter(function (b) { return b.date === etat.jour; }));
    var bo = bornes(), d = iso(bo.debut), f = iso(bo.fin);
    return tries(donnees.bebes.filter(function (b) { return b.date >= d && b.date <= f; }));
  }

  /* ---------- Textes ---------- */
  function texteQuand(b) {
    var d = lire(b.date), t = quantieme(d.getDate()) + ' ' + MOIS_C[d.getMonth()];
    if (d.getFullYear() !== new Date().getFullYear()) t += ' ' + d.getFullYear();
    if (b.heure) t += ' à ' + b.heure.replace(':', ' h ');
    if (b.mode) t += ', ' + MODES[b.mode];
    if (b.peridurale) t += ', ' + (b.peridurale === 'avec' ? 'péri' : 'sans péri');
    if (b.travail) t += ', ' + TRAVAIL[b.travail];
    return t;
  }
  function textePoids(g) { return (g / 1000).toFixed(2).replace('.', ',') + ' kg'; }
  function titrePeriode() {
    var a = etat.ancre, bo = bornes();
    if (etat.periode === 'mois') return maj(MOIS[a.getMonth()]) + ' ' + a.getFullYear();
    if (etat.periode === 'annee') return String(a.getFullYear());
    var memeMois = bo.debut.getMonth() === bo.fin.getMonth();
    return quantieme(bo.debut.getDate()) + (memeMois ? '' : ' ' + MOIS_C[bo.debut.getMonth()]) + ' au ' + bo.fin.getDate() + ' ' + MOIS_C[bo.fin.getMonth()] + ' ' + bo.fin.getFullYear();
  }

  /* ---------- Rendu : compteur et navigation ---------- */
  function rendreCompteur() {
    var n = donnees.bebes.length;
    document.querySelectorAll('[data-compteur]').forEach(function (e) {
      var quoi = e.getAttribute('data-compteur');
      if (quoi === 'nombre') e.textContent = n;
      else if (quoi === 'libelle') e.textContent = n > 1 ? 'bébés accueillis' : 'bébé accueilli';
      else e.textContent = n ? pluriel(n, 'bébé') : 'Aucun bébé';
    });
  }
  function rendreNavigation() {
    document.querySelectorAll('[data-vue]').forEach(function (b) {
      var actif = b.getAttribute('data-vue') === etat.vue;
      b.classList.toggle('actif', actif);
      if (actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('vue-accueil').hidden = etat.vue !== 'accueil';
    $('vue-naissances').hidden = etat.vue !== 'naissances';
    $('vue-stats').hidden = etat.vue !== 'stats';
    $('vue-records').hidden = etat.vue !== 'records';
  }

  /* ---------- Rendu : calendrier ---------- */
  function casePoints(liste, maxPts, capTel, capOrdi) {
    var pts = el('span', { class: 'pts', 'aria-hidden': 'true' });
    liste.slice(0, maxPts).forEach(function (b) {
      pts.appendChild(el('span', { class: 'pt ' + b.sexe, text: b.prenom || 'Bébé' }));
    });
    var plus = el('span', { class: 'plus', 'aria-hidden': 'true' });
    if (liste.length > capTel) plus.appendChild(el('span', { class: 'plus-m', text: '+' + (liste.length - capTel) }));
    if (liste.length > capOrdi) plus.appendChild(el('span', { class: 'plus-o', text: '+ ' + (liste.length - capOrdi) }));
    return [pts, plus];
  }
  function boutonJour(d, liste, enfants) {
    var cle = iso(d);
    var classes = 'jour' + (liste.length ? ' plein' : '') + (cle === iso(new Date()) ? ' aujourdhui' : '') + (cle === etat.jour ? ' choisi' : '');
    var label = quantieme(d.getDate()) + ' ' + MOIS[d.getMonth()] + ', ' + (liste.length ? pluriel(liste.length, 'naissance') : 'aucune naissance');
    return el('button', {
      type: 'button', class: classes, 'aria-label': label, 'aria-pressed': cle === etat.jour ? 'true' : 'false',
      onclick: function () { etat.jour = etat.jour === cle ? null : cle; rendreAccueil(); }
    }, [el('span', { class: 'num', text: d.getDate() })].concat(enfants));
  }
  function caseJour(d, index) {
    var liste = index[iso(d)] || [];
    return boutonJour(d, liste, casePoints(liste, 3, 3, 2));
  }

  /* Vue semaine : chaque jour est une colonne de 0 h à 24 h, chaque bébé y est placé à son heure.
     Les bébés sans heure vont dans une bande en bas, de même hauteur pour toute la semaine. */
  function minutes(h) { var p = h.split(':'); return +p[0] * 60 + +p[1]; }
  function caseSemaine(d, index, nbSansHeure) {
    var liste = index[iso(d)] || [];
    var frise = el('span', { class: 'frise', 'aria-hidden': 'true' });
    var sans = el('span', { class: 'sans-heure', 'aria-hidden': 'true', style: '--n:' + nbSansHeure });
    liste.forEach(function (b) {
      var pt = el('span', { class: 'pt ' + b.sexe, text: b.prenom || 'Bébé' });
      if (b.heure) { pt.setAttribute('data-min', minutes(b.heure)); frise.appendChild(pt); } else sans.appendChild(pt);
    });
    return boutonJour(d, liste, nbSansHeure ? [frise, sans] : [frise]);
  }
  function colonneHeures(nbSansHeure) {
    var frise = el('span', { class: 'frise' }, [6, 12, 18].map(function (h) {
      return el('span', { class: 'heure', style: 'top:' + (h / 24 * 100) + '%', text: h + ' h' });
    }));
    var enfants = [el('span', { class: 'num', text: '\u00a0' }), frise];
    if (nbSansHeure) enfants.push(el('span', { class: 'sans-heure', style: '--n:' + nbSansHeure }, [el('span', { class: 'heure', text: '?' })]));
    return el('div', { class: 'jour heures', 'aria-hidden': 'true' }, enfants);
  }
  /* Place les bébés à leur heure ; deux naissances proches sont écartées juste assez pour ne pas se chevaucher. */
  function placerFrises(racine) {
    racine.querySelectorAll('.grille.semaine .jour:not(.heures) .frise').forEach(function (frise) {
      var H = frise.clientHeight, pts = [].slice.call(frise.children), ecart = 2;
      if (!H || !pts.length) return;
      var h = pts[0].offsetHeight, y = [];
      pts.forEach(function (pt, i) {
        var ideal = Math.min(H - h, Math.max(0, pt.getAttribute('data-min') / 1440 * H - h / 2));
        y[i] = i ? Math.max(ideal, y[i - 1] + h + ecart) : ideal;
      });
      for (var i = pts.length - 1; i >= 0; i--) {
        var plafond = i === pts.length - 1 ? H - h : y[i + 1] - h - ecart;
        y[i] = Math.max(0, Math.min(y[i], plafond));
      }
      pts.forEach(function (pt, i) { pt.style.top = y[i] + 'px'; });
    });
  }
  function nomsJours() {
    return el('div', { class: 'jours-noms', 'aria-hidden': 'true' }, JOURS_C.map(function (j) { return el('span', { text: j }); }));
  }
  function rendreCalendrier() {
    var cal = $('calendrier'), a = etat.ancre, index = parJour();
    vider(cal);
    if (etat.periode === 'mois') {
      var y = a.getFullYear(), m = a.getMonth();
      var decalage = (new Date(y, m, 1).getDay() + 6) % 7, nb = new Date(y, m + 1, 0).getDate();
      var grille = el('div', { class: 'grille' });
      for (var i = 0; i < decalage; i++) grille.appendChild(el('span'));
      for (var j = 1; j <= nb; j++) grille.appendChild(caseJour(new Date(y, m, j), index));
      cal.appendChild(nomsJours());
      cal.appendChild(grille);
    } else if (etat.periode === 'semaine') {
      var l = lundi(a), jours = [], nbSansHeure = 0;
      for (var k = 0; k < 7; k++) jours.push(new Date(l.getFullYear(), l.getMonth(), l.getDate() + k));
      jours.forEach(function (d) {
        var n = (index[iso(d)] || []).filter(function (b) { return !b.heure; }).length;
        if (n > nbSansHeure) nbSansHeure = n;
      });
      var g = el('div', { class: 'grille semaine' }, [colonneHeures(nbSansHeure)].concat(jours.map(function (d) { return caseSemaine(d, index, nbSansHeure); })));
      var noms = nomsJours();
      noms.classList.add('semaine');
      noms.insertBefore(el('span'), noms.firstChild);
      cal.appendChild(noms);
      cal.appendChild(g);
      placerFrises(cal);
    } else {
      var an = a.getFullYear(), auj = new Date(), bloc = el('div', { class: 'annee' });
      MOIS.forEach(function (nom, mm) {
        var prefixe = an + '-' + pad(mm + 1) + '-';
        var liste = donnees.bebes.filter(function (b) { return b.date.indexOf(prefixe) === 0; });
        var nF = liste.filter(function (b) { return b.sexe === 'F'; }).length, nM = liste.length - nF;
        var barre = el('span', { class: 'barre-fg', 'aria-hidden': 'true' });
        if (nF) barre.appendChild(el('i', { class: 'F', style: 'flex:' + nF }));
        if (nM) barre.appendChild(el('i', { class: 'M', style: 'flex:' + nM }));
        bloc.appendChild(el('button', {
          type: 'button',
          class: 'moisc' + (liste.length ? ' plein' : '') + (an === auj.getFullYear() && mm === auj.getMonth() ? ' aujourdhui' : ''),
          'aria-label': nom + ' ' + an + ', ' + (liste.length ? pluriel(liste.length, 'naissance') : 'aucune naissance'),
          onclick: function () { etat.periode = 'mois'; etat.ancre = new Date(an, mm, 1); etat.jour = null; rendreAccueil(); }
        }, [
          el('span', { class: 'nom' }, [el('span', { class: 'nom-court', text: MOIS_C[mm] }), el('span', { class: 'nom-long', text: nom })]),
          el('span', { class: 'total', text: liste.length }),
          barre
        ]));
      });
      cal.appendChild(bloc);
    }
  }

  /* ---------- Rendu : liste ---------- */
  /* Les trois trous à droite du bracelet, purement décoratifs. */
  function trous() { return el('span', { class: 'trous', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]); }
  function bracelet(b) {
    var mesures = el('span', { class: 'bracelet-mesures' });
    if (b.poids) mesures.appendChild(document.createTextNode(textePoids(b.poids)));
    return el('button', {
      type: 'button', class: 'bracelet ' + b.sexe,
      'aria-label': 'Modifier ' + (b.prenom || 'ce bébé') + ', ' + texteQuand(b),
      onclick: function () { ouvrirFiche(b); }
    }, [
      el('span', { class: 'fente', 'aria-hidden': 'true' }),
      el('span', { class: 'bracelet-texte' }, [
        el('span', { class: 'bracelet-prenom', text: b.prenom || 'Bébé' }),
        el('span', { class: 'bracelet-quand', text: texteQuand(b) })
      ]),
      mesures,
      trous()
    ]);
  }
  function rendreListe() {
    var liste = selection(), zone = $('liste');
    var titre;
    if (etat.jour) { var d = lire(etat.jour); titre = 'Naissances du ' + quantieme(d.getDate()) + ' ' + MOIS[d.getMonth()]; }
    else titre = { semaine: 'Naissances de la semaine', mois: 'Naissances du mois', annee: 'Naissances de l’année' }[etat.periode];
    $('titre-liste').textContent = titre;
    var nF = liste.filter(function (b) { return b.sexe === 'F'; }).length, nM = liste.length - nF;
    $('resume-liste').textContent = liste.length ? pluriel(nF, 'fille') + ', ' + pluriel(nM, 'garçon') : '';
    vider(zone);
    if (!liste.length) {
      var vide = el('div', { class: 'vide' }, [el('p', { text: donnees.bebes.length ? 'Aucune naissance sur cette période.' : 'Aucun bébé pour l’instant. Le premier bracelet apparaîtra ici.' })]);
      if (!donnees.bebes.length) vide.appendChild(el('button', { type: 'button', class: 'btn-principal', text: 'Ajouter un bébé', onclick: function () { ouvrirFiche(null); } }));
      zone.appendChild(vide);
      return;
    }
    liste.forEach(function (b) { zone.appendChild(bracelet(b)); });
    ajusterPrenoms(zone);
  }

  /* Prénom trop long pour le bracelet : on réduit la police jusqu'à ce qu'il tienne,
     sans élargir la colonne. En dessous de 15 px, les points de suspension prennent le relais.
     Sans effet sur un élément masqué (largeur nulle) : on rappelle la fonction à l'affichage. */
  function ajusterPrenoms(racine) {
    racine.querySelectorAll('.bracelet-prenom').forEach(function (p) {
      p.style.fontSize = '';
      var dispo = p.clientWidth, besoin = p.scrollWidth;
      if (dispo > 0 && besoin > dispo) {
        p.style.fontSize = Math.max(15, Math.floor(parseFloat(getComputedStyle(p).fontSize) * dispo / besoin)) + 'px';
      }
    });
  }

  function rendreAccueil() {
    $('titre-periode').textContent = titrePeriode();
    document.querySelectorAll('[data-periode]').forEach(function (b) {
      var actif = b.getAttribute('data-periode') === etat.periode;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-pressed', actif ? 'true' : 'false');
    });
    rendreCalendrier();
    rendreListe();
  }

  /* ---------- Rendu : naissances (liste complète et recherche) ---------- */
  /* Les champs du formulaire de recherche sont la seule source des critères. */
  var formRech = $('form-recherche');
  function sansAccents(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").toLowerCase(); }
  function criteres() {
    var pmin = nombre(formRech.pmin), pmax = nombre(formRech.pmax);
    return {
      mots: sansAccents(formRech.texte.value.trim()).split(/\s+/).filter(Boolean),
      du: formRech.du.value, au: formRech.au.value, sexe: formRech.sexe.value, mode: formRech.mode.value,
      peridurale: formRech.peridurale.value, travail: formRech.travail.value,
      pmin: pmin == null || isNaN(pmin) ? null : pmin, pmax: pmax == null || isNaN(pmax) ? null : pmax
    };
  }
  function correspond(b, c) {
    if (c.du && b.date < c.du) return false;
    if (c.au && b.date > c.au) return false;
    if (c.sexe && b.sexe !== c.sexe) return false;
    /* « aucun » = non renseigné */
    for (var i = 0; i < CHOIX_FACULTATIFS.length; i++) {
      var k = CHOIX_FACULTATIFS[i];
      if (c[k] === 'aucun' ? b[k] : c[k] && b[k] !== c[k]) return false;
    }
    if (c.pmin != null && !(b.poids >= c.pmin)) return false;
    if (c.pmax != null && !(b.poids <= c.pmax)) return false;
    if (c.mots.length) {
      var texte = sansAccents(b.prenom + ' ' + b.note);
      if (!c.mots.every(function (m) { return texte.indexOf(m) >= 0; })) return false;
    }
    return true;
  }
  function rendreNaissances() {
    var c = criteres(), zone = $('resultats'), total = donnees.bebes.length;
    var nbFiltres = ['du', 'au', 'sexe', 'mode', 'peridurale', 'travail', 'pmin', 'pmax'].filter(function (k) { return c[k] != null && c[k] !== ''; }).length;
    var filtre = nbFiltres > 0 || c.mots.length > 0;
    var liste = filtre ? tries(donnees.bebes.filter(function (b) { return correspond(b, c); })) : tries(donnees.bebes);
    $('nb-filtres').textContent = nbFiltres;
    $('nb-filtres').hidden = !nbFiltres;
    $('nb-resultats').textContent = !total ? '' : filtre ? pluriel(liste.length, 'naissance') + ' sur ' + total : pluriel(total, 'naissance');
    $('btn-effacer-filtres').hidden = !filtre;
    vider(zone);
    if (!liste.length) {
      var vide = el('div', { class: 'vide' }, [el('p', { text: total ? 'Aucune naissance ne correspond à cette recherche.' : 'Aucun bébé pour l’instant.' })]);
      if (!total) vide.appendChild(el('button', { type: 'button', class: 'btn-principal', text: 'Ajouter un bébé', onclick: function () { ouvrirFiche(null); } }));
      zone.appendChild(vide);
      return;
    }
    liste.forEach(function (b) { zone.appendChild(bracelet(b)); });
    ajusterPrenoms(zone);
  }
  formRech.addEventListener('input', rendreNaissances);
  formRech.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (document.activeElement) document.activeElement.blur(); /* referme le clavier du téléphone */
  });
  $('btn-filtres').addEventListener('click', function () {
    var ouvert = $('filtres').classList.toggle('ouvert');
    $('btn-filtres').setAttribute('aria-expanded', ouvert ? 'true' : 'false');
    formRech.classList.toggle('filtres-ouverts', ouvert);
  });
  $('btn-effacer-filtres').addEventListener('click', function () { formRech.reset(); rendreNaissances(); });

  /* ---------- Stats : cadre commun ---------- */
  /* Chaque bloc a son propre sélecteur de période (portée Mois / Année / Tout + flèches).
     La période choisie est gardée tant que l'appli reste ouverte, puis revient à l'année en cours. */
  var NOMS_PORTEE = { mois: 'Mois', annee: 'Année', tout: 'Tout' };
  var MODES_STATS = [
    ['naturel', 'Naturel', 'var(--mode-naturel)'], ['instrumente', 'Instrumenté', 'var(--mode-instru)'], ['', 'Non renseigné', 'var(--trait)']
  ];
  /* Les trois critères de l'accouchement, dans l'ordre de la fiche. « notable » sert aux croisements du détail. */
  var CRITERES = [
    { cle: 'travail', titre: 'Travail', notable: 'declenche', valeurs: [
      ['spontane', 'Spontané', 'var(--travail-spontane)'], ['declenche', 'Déclenché', 'var(--travail-declenche)'], ['', 'Non renseigné', 'var(--trait)']] },
    { cle: 'peridurale', titre: 'Péridurale', notable: 'avec', valeurs: [
      ['avec', 'Avec péri', 'var(--peri-avec)'], ['sans', 'Sans péri', 'var(--peri-sans)'], ['', 'Non renseigné', 'var(--trait)']] },
    { cle: 'mode', titre: 'Mode d’accouchement', notable: 'instrumente', valeurs: MODES_STATS }
  ];
  var etatStats = {};
  function pct(n, t) { return t ? Math.round(n / t * 100) + ' %' : '—'; }
  function fg(liste) { var f = 0; liste.forEach(function (b) { if (b.sexe === 'F') f++; }); return { f: f, g: liste.length - f }; }
  function texteFG(liste) { var s = fg(liste); return [s.f ? pluriel(s.f, 'fille') : '', s.g ? pluriel(s.g, 'garçon') : ''].filter(Boolean).join(', '); }
  function moyenne(liste, champ) {
    var vals = liste.map(function (b) { return b[champ]; }).filter(function (v) { return v != null; });
    return vals.length ? vals.reduce(function (s, v) { return s + v; }, 0) / vals.length : null;
  }
  function dateLongue(s) { var d = lire(s); return quantieme(d.getDate()) + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear(); }
  function dateCourte(s) { var d = lire(s); return quantieme(d.getDate()) + ' ' + MOIS_C[d.getMonth()] + ' ' + d.getFullYear(); }
  function premiereDate() { return donnees.bebes.reduce(function (m, b) { return !m || b.date < m ? b.date : m; }, ''); }

  function periodeDe(id, defaut) {
    if (!etatStats[id]) { var auj = new Date(); etatStats[id] = { portee: defaut, a: auj.getFullYear(), m: auj.getMonth(), sexe: 'tous' }; }
    return etatStats[id];
  }
  function dansPeriode(b, per) {
    if (per.portee === 'tout') return true;
    var prefixe = per.portee === 'annee' ? per.a + '-' : per.a + '-' + pad(per.m + 1) + '-';
    return b.date.indexOf(prefixe) === 0;
  }
  function libellePeriode(per) {
    if (per.portee === 'tout') return 'Depuis le ' + dateCourte(premiereDate());
    if (per.portee === 'annee') return String(per.a);
    return maj(MOIS[per.m]) + ' ' + per.a;
  }
  /* Bornes de navigation : du mois du premier bébé jusqu'au mois en cours. */
  function rang(per) { return per.portee === 'annee' ? per.a : per.a * 12 + per.m; }
  function rangLimite(per, date) { var d = lire(date); return per.portee === 'annee' ? d.getFullYear() : d.getFullYear() * 12 + d.getMonth(); }
  function deplacerPeriode(per, sens) {
    if (per.portee === 'annee') { per.a += sens; return; }
    var r = per.a * 12 + per.m + sens; per.a = Math.floor(r / 12); per.m = r % 12;
  }
  /* Bornes de dates d'une période, pour ouvrir l'onglet Naissances filtré. */
  function bornesPeriode(per) {
    if (per.portee === 'tout') return { du: '', au: '' };
    if (per.portee === 'annee') return { du: per.a + '-01-01', au: per.a + '-12-31' };
    return { du: iso(new Date(per.a, per.m, 1)), au: iso(new Date(per.a, per.m + 1, 0)) };
  }

  /* Choix Tous / Filles / Garçons (carte de l'année, nuage, records). */
  function choixSexe(per, libelle, redessiner) {
    var groupe = el('div', { class: 'st-sexe', role: 'group', 'aria-label': libelle });
    [['tous', 'Tous'], ['F', 'Filles'], ['M', 'Garçons']].forEach(function (c) {
      groupe.appendChild(el('button', {
        type: 'button', class: 'st-sexe-' + c[0], 'aria-pressed': per.sexe === c[0] ? 'true' : 'false',
        onclick: function () {
          per.sexe = c[0];
          [].forEach.call(groupe.children, function (b, i) { b.setAttribute('aria-pressed', i === ['tous', 'F', 'M'].indexOf(c[0]) ? 'true' : 'false'); });
          redessiner();
        }
      }, [el('i', { 'aria-hidden': 'true' }), document.createTextNode(c[1])]));
    });
    return groupe;
  }
  function selonSexe(liste, per) { return per.sexe === 'tous' ? liste : liste.filter(function (b) { return b.sexe === per.sexe; }); }

  /* Un bloc : titre, sélecteur de période, contenu dessiné par dessiner(liste, per, corps). */
  function blocStats(id, titre, portees, defaut, dessiner, options) {
    options = options || {};
    var per = periodeDe(id, defaut);
    if (portees.indexOf(per.portee) < 0) per.portee = defaut;
    var bloc = el('section', { class: 'st-bloc' + (options.large ? ' st-large' : ''), 'aria-label': titre });
    var corps = el('div', { class: 'st-corps' });
    var seg = el('div', { class: 'st-seg', role: 'group', 'aria-label': 'Période de « ' + titre + ' »' });
    var prec = el('button', { type: 'button', class: 'btn-fleche', 'aria-label': 'Période précédente', onclick: function () { deplacerPeriode(per, -1); redessiner(); } });
    var suiv = el('button', { type: 'button', class: 'btn-fleche', 'aria-label': 'Période suivante', onclick: function () { deplacerPeriode(per, 1); redessiner(); } });
    prec.appendChild(icone('M15 18l-6-6 6-6')); suiv.appendChild(icone('M9 18l6-6-6-6'));
    var lib = el('span', { class: 'st-periode' });
    portees.forEach(function (p) {
      seg.appendChild(el('button', { type: 'button', 'data-p': p, text: NOMS_PORTEE[p], onclick: function () { per.portee = p; redessiner(); } }));
    });
    var outils = el('div', { class: 'st-outils' }, [portees.length > 1 ? seg : null, el('div', { class: 'st-nav' }, [prec, lib, suiv])]);
    bloc.appendChild(el('div', { class: 'st-tete' }, [el('h3', { class: options.titreMasque ? 'masque' : null, text: titre }), outils, options.sexe ? choixSexe(per, options.sexe, redessiner) : null]));
    bloc.appendChild(corps);
    function redessiner() {
      [].forEach.call(seg.children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-p') === per.portee ? 'true' : 'false'); });
      var tout = per.portee === 'tout';
      prec.hidden = suiv.hidden = tout;
      var premier = premiereDate(), auj = iso(new Date());
      prec.disabled = !premier || rang(per) <= rangLimite(per, premier);
      suiv.disabled = rang(per) >= rangLimite(per, auj);
      lib.textContent = libellePeriode(per);
      vider(corps);
      dessiner(donnees.bebes.filter(function (b) { return dansPeriode(b, per); }), per, corps);
    }
    redessiner();
    return bloc;
  }
  function icone(d) {
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); p.setAttribute('d', d); s.appendChild(p);
    return s;
  }
  function stVide(corps, liste, texte) {
    if (liste.length) return false;
    corps.appendChild(el('p', { class: 'st-vide', text: texte || 'Aucune naissance sur cette période.' }));
    return true;
  }
  /* Bande de détail sous un graphique, remplie au toucher (ou au survol sur ordinateur). */
  function bandeDetail(corps) { var d = el('div', { class: 'st-detail', 'aria-live': 'polite' }); corps.appendChild(d); return d; }
  function remplirDetail(d, titre, texte, filtres) {
    vider(d);
    d.appendChild(el('strong', { text: titre }));
    d.appendChild(el('span', { text: texte }));
    if (filtres) d.appendChild(el('button', { type: 'button', class: 'btn-lien st-voir', text: 'Voir ces naissances', onclick: function () { voirNaissances(filtres); } }));
  }
  function choisir(conteneur, noeud) {
    conteneur.querySelectorAll('.st-choisi').forEach(function (n) { n.classList.remove('st-choisi'); });
    if (noeud) noeud.classList.add('st-choisi');
  }
  /* Ouvre l'onglet Naissances avec des filtres déjà remplis. */
  function voirNaissances(f) {
    formRech.reset();
    ['texte', 'du', 'au', 'sexe', 'mode', 'peridurale', 'travail'].forEach(function (k) { if (f[k]) formRech[k].value = f[k]; });
    etat.vue = 'naissances';
    rendre();
    $('vue-naissances').scrollTop = 0;
  }

  /* ---------- Stats : chiffres clés ---------- */
  function blocChiffresCles() {
    return blocStats('cles', 'Chiffres clés', ['mois', 'annee', 'tout'], 'annee', function (liste, per, corps) {
      if (stVide(corps, liste)) return;
      var t = liste.length, s = fg(liste), pm = moyenne(liste, 'poids');
      function tuile(classe, val, complement, lib) {
        return el('div', { class: 'st-tuile' + (classe ? ' ' + classe : '') }, [
          el('p', { class: 'st-val' }, [document.createTextNode(val), complement ? el('small', { text: ' · ' + complement }) : null]),
          el('p', { class: 'st-lib', text: lib })
        ]);
      }
      corps.appendChild(el('div', { class: 'st-tuiles' }, [
        tuile('', String(t), null, t > 1 ? 'bébés' : 'bébé'),
        tuile('', pm ? textePoids(pm) : '—', null, 'poids moyen'),
        tuile('F', String(s.f), pct(s.f, t), s.f > 1 ? 'filles' : 'fille'),
        tuile('M', String(s.g), pct(s.g, t), s.g > 1 ? 'garçons' : 'garçon')
      ]));
      var reparts = el('div', { class: 'st-reparts' });
      CRITERES.forEach(function (cr) {
        var barre = el('div', { class: 'st-barre-seg', 'aria-hidden': 'true' }), lignes = el('div', { class: 'st-modes' });
        cr.valeurs.forEach(function (v) {
          var n = liste.filter(function (b) { return b[cr.cle] === v[0]; }).length;
          if (!n && !v[0]) return;
          if (n) barre.appendChild(el('i', { style: 'flex:' + n + ';background:' + v[2] }));
          lignes.appendChild(el('p', {}, [el('i', { style: 'background:' + v[2] }), el('span', { text: v[1] }), el('b', { text: n }), el('em', { text: pct(n, t) })]));
        });
        reparts.appendChild(el('div', { class: 'st-repart' }, [el('p', { class: 'st-lib', text: cr.titre }), barre, lignes]));
      });
      corps.appendChild(reparts);
    }, { large: true });
  }

  /* ---------- Stats : histogrammes (colonnes empilées filles / garçons) ---------- */
  function pasAxe(max) { var c = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]; for (var i = 0; i < c.length; i++) if (max / c[i] <= 4) return c[i]; return 1000; }
  /* groupes : listes de bébés, une par colonne ; nom(i) : libellé du détail ; filtres(i) : filtres du lien, ou null. */
  function histogramme(corps, groupes, etiquettes, nom, filtres) {
    var HAUT = 150, max = Math.max.apply(null, groupes.map(function (g) { return g.length; })) || 1;
    var pas = pasAxe(max), sommet = Math.ceil(max / pas) * pas;
    var axe = el('div', { class: 'st-axe-y', 'aria-hidden': 'true' }), zone = el('div', { class: 'st-zone' }), cols = el('div', { class: 'st-cols' });
    for (var v = 0; v <= sommet; v += pas) {
      axe.appendChild(el('span', { style: 'bottom:' + (v / sommet * 100) + '%', text: v }));
      zone.appendChild(el('i', { class: 'st-ligne-y' + (v ? '' : ' st-base'), style: 'bottom:' + (v / sommet * 100) + '%' }));
    }
    var iMax = groupes.reduce(function (im, g, i) { return g.length > groupes[im].length ? i : im; }, 0), detail;
    groupes.forEach(function (g, i) {
      var s = fg(g), pile = el('span', { class: 'st-pile' });
      if (s.f) pile.appendChild(el('i', { class: 'F', style: 'height:' + (s.f / sommet * HAUT) + 'px' }));
      if (s.g) pile.appendChild(el('i', { class: 'M', style: 'height:' + (s.g / sommet * HAUT) + 'px' }));
      var col = el('button', { type: 'button', class: 'st-col', 'aria-label': nom(i) + ' : ' + pluriel(g.length, 'naissance') }, [
        i === iMax && g.length ? el('span', { class: 'st-cap', text: g.length }) : null, pile
      ]);
      function voir() { choisir(cols, col); montrer(i); }
      col.addEventListener('click', voir);
      col.addEventListener('mouseenter', function () { montrer(i); });
      cols.appendChild(col);
    });
    zone.appendChild(cols);
    corps.appendChild(el('div', { class: 'st-histo' }, [axe, zone]));
    corps.appendChild(el('div', { class: 'st-axe-x', 'aria-hidden': 'true' }, etiquettes.map(function (t) { return el('span', { text: t }); })));
    corps.appendChild(el('div', { class: 'st-legende' }, [el('span', {}, [el('i', { class: 'F' }), document.createTextNode('Filles')]), el('span', {}, [el('i', { class: 'M' }), document.createTextNode('Garçons')])]));
    detail = bandeDetail(corps);
    function montrer(i) {
      var g = groupes[i];
      remplirDetail(detail, nom(i), pluriel(g.length, 'naissance') + (g.length ? ' · ' + texteFG(g) : ''), g.length && filtres ? filtres(i) : null);
    }
    montrer(iMax);
  }
  var MOIS_I = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  var JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  function blocParMois() {
    return blocStats('mois', 'Naissances par mois', ['annee', 'tout'], 'annee', function (liste, per, corps) {
      if (stVide(corps, liste)) return;
      var groupes = MOIS.map(function (_, m) { return liste.filter(function (b) { return +b.date.slice(5, 7) === m + 1; }); });
      histogramme(corps, groupes, window.innerWidth < 600 ? MOIS_I : MOIS_C, function (i) {
        return per.portee === 'tout' ? 'Tous les mois de ' + MOIS[i] : maj(MOIS[i]) + ' ' + per.a;
      }, per.portee === 'tout' ? null : function (i) {
        return { du: iso(new Date(per.a, i, 1)), au: iso(new Date(per.a, i + 1, 0)) };
      });
    });
  }
  function blocJourSemaine() {
    return blocStats('semaine', 'Jour de la semaine', ['mois', 'annee', 'tout'], 'annee', function (liste, per, corps) {
      if (stVide(corps, liste)) return;
      var groupes = JOURS.map(function (_, k) { return liste.filter(function (b) { return (lire(b.date).getDay() + 6) % 7 === k; }); });
      histogramme(corps, groupes, JOURS_C, function (i) { return 'Le ' + JOURS[i]; }, null);
    });
  }

  /* ---------- Stats : horloge des heures de naissance ---------- */
  function svgEl(tag, attrs, enfants) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (enfants || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function blocHorloge() {
    return blocStats('horloge', 'Heure de naissance', ['mois', 'annee', 'tout'], 'annee', function (liste, per, corps) {
      var avec = liste.filter(function (b) { return b.heure; });
      if (stVide(corps, avec, liste.length ? 'Aucune heure de naissance renseignée sur cette période.' : null)) return;
      var par = []; for (var h = 0; h < 24; h++) par.push([]);
      avec.forEach(function (b) { par[+b.heure.slice(0, 2)].push(b); });
      var max = Math.max.apply(null, par.map(function (x) { return x.length; })) || 1;
      var C = 160, R0 = 52, L = 86;
      function pt(r, ang) { var a = (ang - 90) * Math.PI / 180; return (C + r * Math.cos(a)).toFixed(2) + ',' + (C + r * Math.sin(a)).toFixed(2); }
      function secteur(r1, r2, a1, a2) {
        return 'M' + pt(r1, a1) + 'L' + pt(r2, a1) + 'A' + r2 + ',' + r2 + ' 0 0 1 ' + pt(r2, a2) + 'L' + pt(r1, a2) + 'A' + r1 + ',' + r1 + ' 0 0 0 ' + pt(r1, a1) + 'Z';
      }
      var racine = svgEl('svg', { viewBox: '0 0 320 320', class: 'st-horloge', role: 'img', 'aria-label': 'Naissances selon l’heure de la journée' });
      [0.5, 1].forEach(function (f) { racine.appendChild(svgEl('circle', { cx: C, cy: C, r: R0 + L * f, fill: 'none', stroke: 'var(--trait-doux)', 'stroke-width': 1 })); });
      racine.appendChild(svgEl('circle', { cx: C, cy: C, r: R0 - 4, fill: 'var(--case)' }));
      var centre = svgEl('text', { x: C, y: C + 2, 'text-anchor': 'middle', class: 'st-h-nombre' }), centre2 = svgEl('text', { x: C, y: C + 18, 'text-anchor': 'middle', class: 'st-h-lib' });
      var detail;
      par.forEach(function (x, h) {
        var a1 = h * 15 + 1.2, a2 = (h + 1) * 15 - 1.2, r2 = R0 + Math.max(2, x.length / max * L);
        var g = svgEl('g', { class: 'st-rayon', tabindex: 0, role: 'button', 'aria-label': 'De ' + h + ' h à ' + (h + 1) + ' h : ' + pluriel(x.length, 'naissance') }, [
          svgEl('path', { d: secteur(R0, R0 + L, a1 - 1.2, a2 + 1.2), fill: 'transparent' }),
          svgEl('path', { class: 'st-trace', d: secteur(R0, r2, a1, a2), fill: 'var(--heure)' })
        ]);
        function voir() { choisir(racine, g); montrer(h); }
        g.addEventListener('click', voir);
        g.addEventListener('mouseenter', voir);
        g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); voir(); } });
        racine.appendChild(g);
      });
      [[0, '0 h'], [6, '6 h'], [12, '12 h'], [18, '18 h']].forEach(function (t) {
        var p = pt(R0 + L + 16, t[0] * 15).split(',');
        racine.appendChild(svgEl('text', { x: p[0], y: +p[1] + 4, 'text-anchor': 'middle', class: 'st-h-repere' }, [document.createTextNode(t[1])]));
      });
      racine.appendChild(centre); racine.appendChild(centre2);
      corps.appendChild(el('div', { class: 'st-horloge-cadre' }, [racine]));
      detail = bandeDetail(corps);
      function montrer(h) {
        var x = par[h];
        centre.textContent = x.length; centre2.textContent = h + ' h – ' + (h + 1) + ' h';
        remplirDetail(detail, 'De ' + h + ' h à ' + (h + 1) + ' h', pluriel(x.length, 'naissance') + (x.length ? ' · ' + texteFG(x) : ''), null);
      }
      /* Au repos : part des naissances de nuit et heure la plus chargée. */
      var nuit = avec.filter(function (b) { var hh = +b.heure.slice(0, 2); return hh >= 22 || hh < 6; }).length;
      var hMax = par.reduce(function (im, x, i) { return x.length > par[im].length ? i : im; }, 0);
      centre.textContent = avec.length; centre2.textContent = 'avec heure';
      remplirDetail(detail, 'Nuit (22 h – 6 h)', pluriel(nuit, 'naissance') + ' · ' + pct(nuit, avec.length) + ' · heure la plus chargée : ' + hMax + ' h', null);
    });
  }

  /* ---------- Stats : accouchement (début du travail, péridurale, mode) ---------- */
  function blocAccouchement() {
    return blocStats('accouchement', 'Accouchement', ['mois', 'annee', 'tout'], 'annee', function (liste, per, corps) {
      if (stVide(corps, liste)) return;
      var t = liste.length, conteneur = el('div', { class: 'st-groupes' }), detail, premier = null;
      CRITERES.forEach(function (cr) {
        var groupe = el('div', { class: 'st-barres', role: 'group', 'aria-label': cr.titre }, [el('p', { class: 'st-lib', text: cr.titre })]);
        var lignes = cr.valeurs.map(function (v) { return { cr: cr, v: v, l: liste.filter(function (b) { return b[cr.cle] === v[0]; }) }; })
          .filter(function (x) { return x.v[0] || x.l.length; });
        lignes.forEach(function (x) {
          var b = el('button', { type: 'button', class: 'st-barre', 'aria-label': cr.titre + ', ' + x.v[1] + ' : ' + x.l.length + ', ' + pct(x.l.length, t) }, [
            el('span', { text: x.v[1] }),
            el('span', { class: 'st-piste' }, [el('i', { style: 'width:' + (x.l.length / t * 100) + '%;background:' + x.v[2] })]),
            el('b', {}, [document.createTextNode(String(x.l.length)), el('small', { text: ' · ' + pct(x.l.length, t) })])
          ]);
          function voir() { choisir(conteneur, b); montrer(x); }
          b.addEventListener('click', voir);
          b.addEventListener('mouseenter', voir);
          groupe.appendChild(b);
          if (!premier) premier = x;
        });
        conteneur.appendChild(groupe);
      });
      corps.appendChild(conteneur);
      detail = bandeDetail(corps);
      /* Détail : filles / garçons, poids moyen, et la part des deux autres critères dans ce groupe
         (ex. pour « Déclenché » : part avec péri et part d'instrumentés). */
      var NOTABLE = { travail: 'déclenchés', peridurale: 'avec péri', mode: 'instrumentés' };
      function montrer(x) {
        var pm = moyenne(x.l, 'poids'), bo = bornesPeriode(per), morceaux = [];
        if (x.l.length) {
          morceaux.push(texteFG(x.l));
          if (pm) morceaux.push('poids moyen ' + textePoids(pm));
          CRITERES.forEach(function (autre) {
            if (autre === x.cr) return;
            var n = x.l.filter(function (b) { return b[autre.cle] === autre.notable; }).length;
            morceaux.push(pct(n, x.l.length) + ' ' + NOTABLE[autre.cle]);
          });
        }
        var filtres = { du: bo.du, au: bo.au };
        filtres[x.cr.cle] = x.v[0] || 'aucun';
        remplirDetail(detail, x.cr.titre + ' : ' + x.v[1].toLowerCase(), x.l.length ? morceaux.join(' · ') : 'aucune naissance', x.l.length ? filtres : null);
      }
      montrer(premier);
    });
  }

  /* ---------- Stats : carte de l'année (12 lignes de mois × 31 jours) ---------- */
  var RAMPES = {
    tous: ['var(--case)', '#C9CBE3', '#9296C4', '#5D61A3', '#23254A'],
    F: ['var(--case)', '#F9C9D8', '#F09AB6', '#DB6189', '#A92D58'],
    M: ['var(--case)', '#C3DDF5', '#8DBDEB', '#4E8FD1', '#1F5A99']
  };
  function blocCarteAnnee() {
    /* Année : une case par date. Tout : toutes les années cumulées jour par jour (29 février compris),
       pour voir les dates d'anniversaire qui reviennent le plus. */
    return blocStats('carte', 'Carte de l’année', ['annee', 'tout'], 'annee', function (liste, per, corps) {
      liste = selonSexe(liste, per);
      var cumul = per.portee === 'tout', an = cumul ? 2024 : per.a; /* 2024 est bissextile : la grille a un 29 février */
      function cleDe(date) { return cumul ? date.slice(5) : date; }
      function nomDe(cle) { if (!cumul) return dateLongue(cle); var p = cle.split('-'); return quantieme(+p[1]) + ' ' + MOIS[+p[0] - 1]; }
      var rampe = RAMPES[per.sexe], index = {}, detail, cases = {};
      liste.forEach(function (b) { var k = cleDe(b.date); (index[k] = index[k] || []).push(b); });
      var grille = el('div', { class: 'st-calan' });
      grille.appendChild(el('span'));
      for (var j = 1; j <= 31; j++) grille.appendChild(el('span', { class: 'st-calan-j', 'aria-hidden': 'true', text: j === 1 || j % 5 === 0 ? j : '' }));
      MOIS_C.forEach(function (nom, m) {
        grille.appendChild(el('span', { class: 'st-calan-m', text: nom }));
        var nb = new Date(an, m + 1, 0).getDate();
        for (var j = 1; j <= 31; j++) {
          if (j > nb) { grille.appendChild(el('span')); continue; }
          (function (cle) {
            var n = (index[cle] || []).length;
            var c = el('button', { type: 'button', class: 'st-case', style: 'background:' + rampe[Math.min(n, 4)], 'aria-label': nomDe(cle) + ' : ' + pluriel(n, 'naissance') });
            function voir() { choisir(grille, c); montrer(cle); }
            c.addEventListener('click', voir);
            c.addEventListener('mouseenter', voir);
            cases[cle] = c;
            grille.appendChild(c);
          })(cleDe(iso(new Date(an, m, j))));
        }
      });
      corps.appendChild(grille);
      var echelle = el('div', { class: 'st-echelle', 'aria-hidden': 'true' }, [document.createTextNode('0')]);
      rampe.forEach(function (c) { echelle.appendChild(el('i', { style: 'background:' + c })); });
      echelle.appendChild(document.createTextNode('4 et plus'));
      corps.appendChild(echelle);
      var qui = { tous: 'naissance', F: 'fille', M: 'garçon' }[per.sexe];
      /* Anniversaires les plus fréquents (mode Tout) : dates partagées par au moins deux bébés. */
      if (cumul) {
        var partages = Object.keys(index).filter(function (k) { return index[k].length > 1; })
          .sort(function (a, b) { return index[b].length - index[a].length || (a < b ? -1 : 1); });
        var zone = el('div', { class: 'st-anniv' }, [el('p', { class: 'st-lib', text: 'Anniversaires les plus fréquents' })]);
        if (!partages.length) zone.appendChild(el('p', { class: 'st-lib', text: 'Aucune date partagée par deux bébés pour l’instant.' }));
        else zone.appendChild(el('div', { class: 'st-anniv-liste' }, partages.slice(0, 8).map(function (k) {
          return el('button', { type: 'button', 'aria-label': nomDe(k) + ' : ' + pluriel(index[k].length, 'bébé'), onclick: function () { choisir(grille, cases[k]); montrer(k); } }, [
            el('span', { text: nomDe(k) }), el('b', { text: index[k].length })
          ]);
        })));
        corps.appendChild(zone);
      }
      detail = bandeDetail(corps);
      function montrer(cle) {
        var l = index[cle] || [];
        var texte = per.sexe === 'tous' ? pluriel(l.length, 'naissance') + (l.length ? ' · ' + texteFG(l) : '') : pluriel(l.length, qui);
        if (cumul && l.length) {
          var ans = {};
          l.forEach(function (b) { var a = b.date.slice(0, 4); ans[a] = (ans[a] || 0) + 1; });
          texte += ' · ' + Object.keys(ans).sort().map(function (a) { return ans[a] > 1 ? a + ' (' + ans[a] + ')' : a; }).join(', ');
        }
        /* En mode Tout, une date couvre plusieurs années : pas de lien, les filtres de Naissances ne savent pas l'exprimer. */
        remplirDetail(detail, nomDe(cle), texte, l.length && !cumul ? { du: cle, au: cle, sexe: per.sexe === 'tous' ? '' : per.sexe } : null);
      }
      var jours = Object.keys(index).length;
      remplirDetail(detail, cumul ? 'Toutes les années' : String(per.a),
        pluriel(jours, 'jour') + (cumul ? ' du calendrier' : '') + ' avec au moins une ' + qui + ' · ' + pluriel(liste.length, per.sexe === 'tous' ? 'bébé' : qui), null);
    }, { large: true, sexe: 'Couleur de la carte' });
  }

  /* ---------- Stats : nuage des prénoms ---------- */
  function hachage(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function blocNuage() {
    return blocStats('nuage', 'Nuage des prénoms', ['mois', 'annee', 'tout'], 'annee', function (liste, per, corps) {
      liste = selonSexe(liste, per);
      var noms = {};
      liste.forEach(function (b) { if (b.prenom) (noms[b.prenom] = noms[b.prenom] || []).push(b); });
      var cles = Object.keys(noms);
      if (stVide(corps, cles, 'Aucun prénom sur cette période.')) return;
      var max = Math.max.apply(null, cles.map(function (k) { return noms[k].length; }));
      var nuage = el('div', { class: 'st-nuage' }), detail;
      /* Ordre mélangé mais stable, pour que les grands prénoms ne soient pas tous au début. */
      cles.sort(function (a, b) { return hachage(a) - hachage(b); }).forEach(function (k) {
        var n = noms[k].length, s = fg(noms[k]), taille = 18 + (max > 1 ? (n - 1) / (max - 1) : 0) * 32;
        var b = el('button', { type: 'button', class: s.f >= s.g ? 'F' : 'M', style: 'font-size:' + taille.toFixed(1) + 'px', text: k, 'aria-label': k + ', ' + n + ' fois' });
        function voir() { choisir(nuage, b); montrer(k); }
        b.addEventListener('click', voir);
        b.addEventListener('mouseenter', voir);
        nuage.appendChild(b);
      });
      corps.appendChild(nuage);
      corps.appendChild(el('p', { class: 'st-lib', text: 'Taille selon le nombre de fois où le prénom a été donné · ' + pluriel(cles.length, 'prénom') + ' différent' + (cles.length > 1 ? 's' : '') + '.' }));
      detail = bandeDetail(corps);
      function montrer(k) {
        var l = noms[k], s = fg(l), bo = bornesPeriode(per);
        remplirDetail(detail, k, 'donné ' + l.length + ' fois' + (s.f && s.g ? ' (' + texteFG(l) + ')' : ''),
          { texte: k, du: bo.du, au: bo.au, sexe: per.sexe === 'tous' ? '' : per.sexe });
      }
      montrer(cles.slice().sort(function (a, b) { return noms[b].length - noms[a].length || (a < b ? -1 : 1); })[0]);
    }, { large: true, sexe: 'Prénoms donnés à' });
  }

  /* ---------- Records (onglet à part) ---------- */
  /* Bracelet d'information (journée, prénom) : même forme que les bracelets de bébé. */
  function braceletInfo(classe, titre, sous, mesure, label, action) {
    return el('button', { type: 'button', class: 'bracelet ' + classe, 'aria-label': label, onclick: action }, [
      el('span', { class: 'fente', 'aria-hidden': 'true' }),
      el('span', { class: 'bracelet-texte' }, [el('span', { class: 'bracelet-prenom', text: titre }), el('span', { class: 'bracelet-quand', text: sous })]),
      el('span', { class: 'bracelet-mesures st-record-val', text: mesure }),
      trous()
    ]);
  }
  function exaequo(n, mot) { return n ? 'Ex æquo avec ' + n + ' autre' + (n > 1 ? 's ' : ' ') + mot + (n > 1 ? 's' : '') : null; }
  function blocRecords() {
    return blocStats('records', 'Records', ['mois', 'annee', 'tout'], 'annee', function (liste, per, corps) {
      liste = selonSexe(liste, per);
      if (stVide(corps, liste)) return;
      var fem = per.sexe === 'F', grille = el('div', { class: 'st-records' });
      function record(quoi, contenu, aussi) {
        grille.appendChild(el('div', { class: 'st-record' }, [el('p', { class: 'st-record-quoi', text: quoi }), contenu, aussi ? el('p', { class: 'st-record-aussi', text: aussi }) : null]));
      }
      /* Journée la plus chargée : toucher ouvre ce jour à l'accueil. */
      var parJourLoc = {};
      liste.forEach(function (b) { (parJourLoc[b.date] = parJourLoc[b.date] || []).push(b); });
      var jours = Object.keys(parJourLoc).sort();
      var jr = jours.reduce(function (m, k) { return !m || parJourLoc[k].length > parJourLoc[m].length ? k : m; }, null);
      var nJ = parJourLoc[jr].length;
      record('Journée la plus chargée', braceletInfo('neutre', dateLongue(jr), texteFG(parJourLoc[jr]), pluriel(nJ, 'bébé'),
        'Journée la plus chargée : ' + dateLongue(jr) + ', ' + pluriel(nJ, 'bébé'),
        function () { etat.vue = 'accueil'; etat.periode = 'mois'; etat.ancre = lire(jr); etat.jour = jr; rendre(); }),
        exaequo(jours.filter(function (k) { return parJourLoc[k].length === nJ; }).length - 1, 'jour'));
      /* Mesures extrêmes : le bracelet du bébé, qui ouvre sa fiche. */
      function extreme(champ, sens) {
        var v = liste.filter(function (b) { return b[champ] != null; });
        if (!v.length) return null;
        var m = v.reduce(function (a, b) { return sens * (b[champ] - a[champ]) > 0 ? b : a; });
        return { b: m, autres: v.filter(function (b) { return b[champ] === m[champ]; }).length - 1 };
      }
      [['poids', 1, fem ? 'La plus lourde' : 'Le plus lourd'], ['poids', -1, fem ? 'La plus légère' : 'Le plus léger']].forEach(function (x) {
        var e = extreme(x[0], x[1]);
        if (e) record(x[2], bracelet(e.b), exaequo(e.autres, 'bébé'));
      });
      /* Prénom le plus donné : toucher lance la recherche de ce prénom. */
      var noms = {};
      liste.forEach(function (b) { if (b.prenom) (noms[b.prenom] = noms[b.prenom] || []).push(b); });
      var cles = Object.keys(noms).sort();
      if (cles.length) {
        var top = cles.reduce(function (m, k) { return !m || noms[k].length > noms[m].length ? k : m; }, null), nT = noms[top].length;
        var autres = cles.filter(function (k) { return k !== top && noms[k].length === nT; });
        var s = fg(noms[top]), bo = bornesPeriode(per);
        record('Prénom le plus donné', braceletInfo(s.f >= s.g ? 'F' : 'M', top, 'dernier le ' + dateCourte(noms[top].map(function (b) { return b.date; }).sort().pop()), nT + ' fois',
          'Prénom le plus donné : ' + top + ', ' + nT + ' fois',
          function () { voirNaissances({ texte: top, du: bo.du, au: bo.au, sexe: per.sexe === 'tous' ? '' : per.sexe }); }),
          autres.length ? 'Ex æquo avec ' + autres.slice(0, 3).join(', ') + (autres.length > 3 ? ' et ' + (autres.length - 3) + ' autres' : '') : null);
      }
      corps.appendChild(grille);
      ajusterPrenoms(grille);
    }, { large: true, sexe: 'Records parmi', titreMasque: true });
  }
  function rendreRecords() {
    var zone = $('records');
    vider(zone);
    if (!donnees.bebes.length) { zone.appendChild(el('p', { class: 'vide', text: 'Les records apparaîtront dès le premier bébé ajouté.' })); return; }
    zone.appendChild(el('div', { class: 'st-grille' }, [blocRecords()]));
  }

  function rendreStats() {
    var zone = $('stats');
    vider(zone);
    if (!donnees.bebes.length) { zone.appendChild(el('p', { class: 'vide', text: 'Les stats apparaîtront dès le premier bébé ajouté.' })); return; }
    zone.appendChild(el('div', { class: 'st-grille' }, [blocChiffresCles(), blocParMois(), blocJourSemaine(), blocHorloge(), blocAccouchement(), blocCarteAnnee(), blocNuage()]));
  }

  function rendreRappel() {
    var montrer = false;
    if (donnees.bebes.length) {
      var dernier = donnees.bebes.reduce(function (m, b) { return b.modifie > m ? b.modifie : m; }, '');
      var reference = donnees.dernierExport || donnees.bebes.reduce(function (m, b) { return b.cree < m ? b.cree : m; }, dernier);
      var jours = (Date.now() - new Date(reference).getTime()) / 86400000;
      montrer = jours > 30 && (!donnees.dernierExport || dernier > donnees.dernierExport);
      /* Fermé à la main : le rappel revient un mois plus tard s'il n'y a toujours pas eu d'export. */
      if (donnees.rappelMasque && (Date.now() - new Date(donnees.rappelMasque).getTime()) / 86400000 < 30) montrer = false;
      $('rappel').firstElementChild.textContent = donnees.dernierExport ? 'Sauvegarde de plus d’un mois.' : 'Pas encore de sauvegarde.';
    }
    $('rappel').hidden = !montrer;
  }

  function rendre() {
    rendreCompteur();
    rendreNavigation();
    rendreRappel();
    if (etat.vue === 'accueil') rendreAccueil();
    else if (etat.vue === 'naissances') rendreNaissances();
    else if (etat.vue === 'records') rendreRecords();
    else rendreStats();
  }

  /* ---------- Fiche : ajout, modification, suppression ---------- */
  var form = $('form-fiche'), dlgFiche = $('dlg-fiche');
  function valeurSexe() { var c = form.querySelector('input[name="sexe"]:checked'); return c ? c.value : ''; }
  function valeurChoix(nom) { var c = form.querySelector('input[name="' + nom + '"]:checked'); return c ? c.value : ''; }
  var CHOIX_FACULTATIFS = ['mode', 'peridurale', 'travail'];
  function majApercu() {
    var sexe = valeurSexe(), ap = $('apercu');
    ap.className = 'bracelet apercu ' + (sexe || 'neutre');
    $('apercu-prenom').textContent = form.prenom.value.trim() || 'Prénom';
    ajusterPrenoms(ap);
    $('apercu-quand').textContent = form.date.value ? texteQuand({ date: form.date.value, heure: form.heure.value, mode: valeurChoix('mode'), peridurale: valeurChoix('peridurale'), travail: valeurChoix('travail') }) : '';
  }
  function ouvrirFiche(b) {
    ficheId = b ? b.id : null;
    form.reset();
    $('fiche-erreur').hidden = true;
    $('fiche-titre').textContent = b ? 'Modifier le bracelet' : 'Nouveau bracelet';
    $('btn-supprimer').hidden = !b;
    reinitSuppression();
    if (b) {
      form.querySelectorAll('input[name="sexe"]').forEach(function (r) { r.checked = r.value === b.sexe; });
      CHOIX_FACULTATIFS.forEach(function (nom) {
        form.querySelectorAll('input[name="' + nom + '"]').forEach(function (c) { c.checked = c.value === b[nom]; });
      });
      form.prenom.value = b.prenom;
      form.date.value = b.date;
      form.heure.value = b.heure;
      form.poids.value = b.poids == null ? '' : b.poids;
      form.note.value = b.note;
    } else {
      form.date.value = etat.jour || iso(new Date());
    }
    form.date.max = iso(new Date());
    majApercu();
    dlgFiche.showModal();
    ajusterPrenoms($('apercu'));
    dlgFiche.scrollTop = 0;
  }
  function erreurFiche(msg) { var e = $('fiche-erreur'); e.textContent = msg; e.hidden = false; }
  /* Champs texte (et non number) : la virgule décimale est acceptée partout, y compris sur iPhone.
     Les espaces sont ignorés (« 3 420 »). Une saisie non numérique donne NaN, donc un message d'erreur. */
  function nombre(champ) { var v = champ.value.replace(/\s/g, '').replace(',', '.'); return v === '' ? null : Number(v); }

  form.addEventListener('input', function () { $('fiche-erreur').hidden = true; majApercu(); });
  form.addEventListener('change', function (ev) {
    /* Mode, péridurale et début du travail sont facultatifs : un seul choix à la fois, et on peut le décocher. */
    if (CHOIX_FACULTATIFS.indexOf(ev.target.name) >= 0 && ev.target.checked) {
      form.querySelectorAll('input[name="' + ev.target.name + '"]').forEach(function (c) { if (c !== ev.target) c.checked = false; });
    }
    $('fiche-erreur').hidden = true;
    majApercu();
  });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var sexe = valeurSexe(), date = form.date.value, poids = nombre(form.poids);
    if (!sexe) return erreurFiche('Choisir fille ou garçon.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return erreurFiche('Indiquer la date de naissance.');
    if (date > iso(new Date())) return erreurFiche('La date de naissance est dans le futur.');
    if (poids != null && (isNaN(poids) || poids < 300 || poids > 7000)) return erreurFiche('Le poids se saisit en grammes, entre 300 et 7000 (par exemple 3420).');
    var maintenant = new Date().toISOString();
    var ancien = ficheId ? donnees.bebes.filter(function (b) { return b.id === ficheId; })[0] : null;
    /* On part de l'ancienne fiche pour garder ses champs inconnus (ancienne taille, champs d'une version future…). */
    var saisie = {
      id: ficheId || identifiant(), prenom: form.prenom.value, sexe: sexe, date: date, heure: form.heure.value,
      poids: poids, mode: valeurChoix('mode'), peridurale: valeurChoix('peridurale'), travail: valeurChoix('travail'),
      note: form.note.value.trim(), cree: ancien ? ancien.cree : maintenant, modifie: maintenant
    };
    var base = {};
    if (ancien) Object.keys(ancien).forEach(function (k) { base[k] = ancien[k]; });
    Object.keys(saisie).forEach(function (k) { base[k] = saisie[k]; });
    var fiche = normaliser(base);
    var avant = donnees.bebes.slice();
    if (ancien) donnees.bebes = donnees.bebes.map(function (b) { return b.id === ficheId ? fiche : b; });
    else donnees.bebes.push(fiche);
    if (!enregistrer()) { donnees.bebes = avant; return; }
    /* Depuis Naissances ou Records, on y reste ; sinon retour à l'accueil sur la date du bébé. */
    if (etat.vue !== 'naissances' && etat.vue !== 'records') {
      etat.ancre = lire(date);
      etat.jour = null;
      etat.vue = 'accueil';
    }
    dlgFiche.close();
    toast(ancien ? 'Bracelet modifié' : 'Bracelet ajouté');
    rendre();
  });

  /* Suppression en deux temps : le premier appui demande confirmation. */
  var minuterieSuppr = null;
  function reinitSuppression() {
    clearTimeout(minuterieSuppr);
    var b = $('btn-supprimer');
    b.textContent = 'Supprimer';
    b.removeAttribute('data-confirme');
  }
  $('btn-supprimer').addEventListener('click', function () {
    var b = $('btn-supprimer');
    if (!b.hasAttribute('data-confirme')) {
      b.setAttribute('data-confirme', '');
      b.textContent = 'Confirmer la suppression';
      minuterieSuppr = setTimeout(reinitSuppression, 4000);
      return;
    }
    var avant = donnees.bebes.slice();
    donnees.bebes = donnees.bebes.filter(function (x) { return x.id !== ficheId; });
    if (!enregistrer()) { donnees.bebes = avant; return; }
    dlgFiche.close();
    toast('Bracelet supprimé');
    rendre();
  });

  /* ---------- Réglages : export, import, effacement ---------- */
  var dlgReglages = $('dlg-reglages');
  function majReglages() {
    var n = donnees.bebes.length;
    $('info-nombre').textContent = n ? 'Télécharge un fichier avec ' + pluriel(n, 'bébé') : 'Aucun bébé à exporter pour l’instant';
    var info = $('info-export');
    if (donnees.dernierExport) {
      var d = new Date(donnees.dernierExport);
      info.textContent = 'Dernier export le ' + quantieme(d.getDate()) + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear() + '.';
      info.hidden = false;
    } else info.hidden = true;
    reinitEffacement();
  }
  function ouvrirReglages() { majReglages(); dlgReglages.showModal(); }
  function exporter() {
    if (!donnees.bebes.length) return toast('Aucun bébé à exporter.');
    var contenu = JSON.stringify({ app: 'babycounter', version: VERSION, exporte: new Date().toISOString(), bebes: donnees.bebes }, null, 2);
    var url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
    var a = el('a', { href: url, download: 'babycounter-' + iso(new Date()) + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    donnees.dernierExport = new Date().toISOString();
    enregistrer();
    toast('Sauvegarde exportée');
    rendreRappel();
    if (dlgReglages.open) majReglages();
  }
  function importer(fichier) {
    var lecteur = new FileReader();
    lecteur.onload = function () {
      var recus;
      try {
        var brut = JSON.parse(lecteur.result);
        /* Accepte un export Babycounter, un tableau simple, ou un export de l'ancien « Almanach ». */
        recus = (Array.isArray(brut) ? brut : brut.bebes || brut.births || []).map(normaliser).filter(Boolean);
      } catch (e) { recus = []; }
      if (!recus.length) return toast('Ce fichier ne contient aucune sauvegarde lisible.');
      var avant = donnees.bebes.slice(), parId = {}, ajoutes = 0, mis = 0;
      donnees.bebes.forEach(function (b) { parId[b.id] = b; });
      recus.forEach(function (b) { if (parId[b.id]) mis++; else ajoutes++; parId[b.id] = b; });
      donnees.bebes = Object.keys(parId).map(function (k) { return parId[k]; });
      if (!enregistrer()) { donnees.bebes = avant; return; }
      dlgReglages.close();
      var bilan = [];
      if (ajoutes) bilan.push(pluriel(ajoutes, 'bébé') + ' ajouté' + (ajoutes > 1 ? 's' : ''));
      if (mis) bilan.push(pluriel(mis, 'bébé') + ' mis à jour');
      toast(bilan.join(', '));
      rendre();
    };
    lecteur.onerror = function () { toast('Lecture du fichier impossible.'); };
    lecteur.readAsText(fichier);
  }
  $('fichier-import').addEventListener('change', function (ev) {
    if (ev.target.files[0]) importer(ev.target.files[0]);
    ev.target.value = '';
  });

  var minuterieEff = null;
  function reinitEffacement() {
    clearTimeout(minuterieEff);
    var b = $('btn-effacer');
    b.removeAttribute('data-confirme');
    b.querySelector('strong').textContent = 'Tout effacer';
    b.querySelector('span').textContent = 'Supprime tous les bébés de cet appareil';
  }
  $('btn-effacer').addEventListener('click', function () {
    var b = $('btn-effacer');
    if (!donnees.bebes.length) return toast('Il n’y a rien à effacer.');
    if (!b.hasAttribute('data-confirme')) {
      b.setAttribute('data-confirme', '');
      b.querySelector('strong').textContent = 'Confirmer : effacer ' + pluriel(donnees.bebes.length, 'bébé');
      b.querySelector('span').textContent = 'Action définitive. Penser à exporter avant.';
      minuterieEff = setTimeout(reinitEffacement, 5000);
      return;
    }
    var avant = donnees.bebes.slice();
    donnees.bebes = [];
    if (!enregistrer()) { donnees.bebes = avant; return; }
    dlgReglages.close();
    toast('Tous les bébés ont été effacés');
    rendre();
  });

  /* ---------- Message bref ---------- */
  var minuterieToast = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(minuterieToast);
    minuterieToast = setTimeout(function () { t.classList.remove('visible'); }, 2600);
  }

  /* ---------- Actions ---------- */
  function deplacer(sens) {
    var a = etat.ancre;
    if (etat.periode === 'semaine') etat.ancre = new Date(a.getFullYear(), a.getMonth(), a.getDate() + 7 * sens);
    else if (etat.periode === 'mois') etat.ancre = new Date(a.getFullYear(), a.getMonth() + sens, 1);
    else etat.ancre = new Date(a.getFullYear() + sens, a.getMonth(), 1);
    etat.jour = null;
    rendreAccueil();
  }
  document.addEventListener('click', function (ev) {
    var cible = ev.target.closest('[data-vue], [data-action], [data-periode], [data-fermer]');
    if (!cible) return;
    if (cible.hasAttribute('data-fermer')) { cible.closest('dialog').close(); return; }
    if (cible.hasAttribute('data-vue')) {
      etat.vue = cible.getAttribute('data-vue');
      rendre();
      return;
    }
    if (cible.hasAttribute('data-periode')) {
      etat.periode = cible.getAttribute('data-periode');
      if (etat.jour) etat.ancre = lire(etat.jour);
      etat.jour = null;
      rendreAccueil();
      return;
    }
    var action = cible.getAttribute('data-action');
    if (action === 'ajouter') ouvrirFiche(null);
    else if (action === 'reglages') ouvrirReglages();
    else if (action === 'exporter') exporter();
    else if (action === 'masquer-rappel') { donnees.rappelMasque = new Date().toISOString(); enregistrer(); rendreRappel(); }
    else if (action === 'importer') $('fichier-import').click();
    else if (action === 'precedent') deplacer(-1);
    else if (action === 'suivant') deplacer(1);
  });
  /* Sur ordinateur, un clic en dehors de la fenêtre la ferme. */
  [dlgFiche, dlgReglages].forEach(function (d) {
    d.addEventListener('click', function (ev) {
      if (ev.target !== d) return;
      var r = d.getBoundingClientRect();
      if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) d.close();
    });
  });

  /* ---------- Démarrage ---------- */
  charger();
  rendre();
  /* Les largeurs changent avec la fenêtre et quand la police manuscrite finit de charger. */
  var minuterieTaille = null;
  window.addEventListener('resize', function () {
    clearTimeout(minuterieTaille);
    minuterieTaille = setTimeout(function () { ajusterPrenoms(document); placerFrises(document); }, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ajusterPrenoms(document); });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});

  /* ---------- Hors ligne et installation ---------- */
  var sw = ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) ? navigator.serviceWorker : null;
  if (sw) {
    /* updateViaCache: 'none' : sw.js est toujours relu sur le réseau, jamais dans le cache HTTP. */
    sw.register('sw.js', { updateViaCache: 'none' }).catch(function () {});
    /* Une nouvelle version vient de s'installer en entier : on recharge pour l'afficher,
       sauf si une fenêtre est ouverte (saisie en cours) ; elle s'affichera à la prochaine ouverture. */
    var dejaControlee = !!sw.controller;
    sw.addEventListener('controllerchange', function () {
      if (dejaControlee && !document.querySelector('dialog[open]')) location.reload();
      dejaControlee = true;
    });
  }
  /* Version installée, demandée au service worker, affichée en bas des réglages. */
  function majVersion() {
    var p = $('info-version');
    if (!sw || !sw.controller) { p.textContent = 'Pas encore disponible hors ligne : ouvrir l’appli une fois avec du réseau.'; return; }
    var canal = new MessageChannel();
    canal.port1.onmessage = function (ev) { p.textContent = 'Version ' + ev.data + ' · disponible hors ligne'; };
    sw.controller.postMessage('version', [canal.port2]);
  }
  dlgReglages.addEventListener('toggle', function () { if (dlgReglages.open) majVersion(); });

  /* Aide à l'installation : Safari sur iPhone, page pas ouverte depuis l'icône.
     navigator.standalone n'existe que sur iPhone et iPad (false dans Safari, true dans l'appli).
     « ?installer » dans l'adresse force l'affichage, pour tester sur ordinateur. */
  var dansSafariIos = navigator.standalone === false && !matchMedia('(display-mode: standalone)').matches;
  var aideVue = false;
  try { aideVue = sessionStorage.getItem('babycounter:aide-installation') === 'vue'; } catch (e) {}
  if ((dansSafariIos && !aideVue) || /[?&]installer\b/.test(location.search)) {
    var dlgInstaller = $('dlg-installer');
    dlgInstaller.addEventListener('close', function () {
      try { sessionStorage.setItem('babycounter:aide-installation', 'vue'); } catch (e) {}
    });
    dlgInstaller.showModal();
  }
})();
