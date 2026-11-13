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
  var MODES = { 'voie-basse': 'voie basse', 'instrumentale': 'instrumentale', 'cesarienne': 'césarienne' };

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
    n.taille = typeof b.taille === 'number' && b.taille > 0 ? b.taille : null;
    n.mode = MODES[b.mode] ? b.mode : '';
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
    return t;
  }
  function textePoids(g) { return (g / 1000).toFixed(2).replace('.', ',') + ' kg'; }
  function texteTaille(cm) { return String(cm).replace('.', ',') + ' cm'; }
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
  function caseJour(d, index, semaine, k) {
    var cle = iso(d), liste = index[cle] || [];
    var classes = 'jour' + (liste.length ? ' plein' : '') + (cle === iso(new Date()) ? ' aujourdhui' : '') + (cle === etat.jour ? ' choisi' : '');
    var label = quantieme(d.getDate()) + ' ' + MOIS[d.getMonth()] + ', ' + (liste.length ? pluriel(liste.length, 'naissance') : 'aucune naissance');
    var enfants = [];
    if (semaine) enfants.push(el('span', { class: 'nomj', text: JOURS_C[k] }));
    enfants.push(el('span', { class: 'num', text: d.getDate() }));
    enfants = enfants.concat(semaine ? casePoints(liste, 10, 4, 10) : casePoints(liste, 3, 3, 2));
    return el('button', {
      type: 'button', class: classes, 'aria-label': label, 'aria-pressed': cle === etat.jour ? 'true' : 'false',
      onclick: function () { etat.jour = etat.jour === cle ? null : cle; rendreAccueil(); }
    }, enfants);
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
      for (var j = 1; j <= nb; j++) grille.appendChild(caseJour(new Date(y, m, j), index, false));
      cal.appendChild(nomsJours());
      cal.appendChild(grille);
    } else if (etat.periode === 'semaine') {
      var l = lundi(a), g = el('div', { class: 'grille semaine' });
      for (var k = 0; k < 7; k++) g.appendChild(caseJour(new Date(l.getFullYear(), l.getMonth(), l.getDate() + k), index, true, k));
      cal.appendChild(g);
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
  function bracelet(b) {
    var mesures = el('span', { class: 'bracelet-mesures' });
    if (b.poids) mesures.appendChild(document.createTextNode(textePoids(b.poids)));
    if (b.taille) mesures.appendChild(el('span', { text: texteTaille(b.taille) }));
    return el('button', {
      type: 'button', class: 'bracelet ' + b.sexe,
      'aria-label': 'Modifier ' + (b.prenom || 'ce bébé') + ', ' + texteQuand(b),
      onclick: function () { ouvrirFiche(b); }
    }, [
      el('span', { class: 'fermoir', 'aria-hidden': 'true' }, [el('i'), el('i')]),
      el('span', { class: 'bracelet-texte' }, [
        el('span', { class: 'bracelet-prenom', text: b.prenom || 'Bébé' }),
        el('span', { class: 'bracelet-quand', text: texteQuand(b) })
      ]),
      mesures
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
      pmin: pmin == null || isNaN(pmin) ? null : pmin, pmax: pmax == null || isNaN(pmax) ? null : pmax
    };
  }
  function correspond(b, c) {
    if (c.du && b.date < c.du) return false;
    if (c.au && b.date > c.au) return false;
    if (c.sexe && b.sexe !== c.sexe) return false;
    if (c.mode === 'aucun' ? b.mode : c.mode && b.mode !== c.mode) return false;
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
    var nbFiltres = ['du', 'au', 'sexe', 'mode', 'pmin', 'pmax'].filter(function (k) { return c[k] != null && c[k] !== ''; }).length;
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

  /* ---------- Rendu : stats (premier jet, à enrichir) ---------- */
  function tuile(val, lib, classe) {
    return el('div', { class: 'tuile' + (classe ? ' ' + classe : '') }, [el('p', { class: 'val', text: val }), el('p', { class: 'lib', text: lib })]);
  }
  function moyenne(liste, champ) {
    var vals = liste.map(function (b) { return b[champ]; }).filter(function (v) { return v != null; });
    return vals.length ? vals.reduce(function (s, v) { return s + v; }, 0) / vals.length : null;
  }
  function rendreStats() {
    var zone = $('stats'), tous = donnees.bebes;
    vider(zone);
    if (!tous.length) { zone.appendChild(el('p', { class: 'vide', text: 'Les stats apparaîtront dès le premier bébé ajouté.' })); return; }
    var nF = tous.filter(function (b) { return b.sexe === 'F'; }).length;
    var pm = moyenne(tous, 'poids'), tm = moyenne(tous, 'taille');
    var modes = el('div', { class: 'tuile large' }, [el('p', { class: 'lib', text: 'Mode d’accouchement' })]);
    Object.keys(MODES).forEach(function (k) {
      var n = tous.filter(function (b) { return b.mode === k; }).length;
      modes.appendChild(el('p', { class: 'rep-ligne' }, [el('span', { text: maj(MODES[k]) }), el('strong', { text: n })]));
    });
    var sans = tous.filter(function (b) { return !b.mode; }).length;
    if (sans) modes.appendChild(el('p', { class: 'rep-ligne' }, [el('span', { text: 'Non renseigné' }), el('strong', { text: sans })]));
    zone.appendChild(el('div', { class: 'tuiles' }, [
      tuile(nF, nF > 1 ? 'filles' : 'fille', 'F'),
      tuile(tous.length - nF, tous.length - nF > 1 ? 'garçons' : 'garçon', 'M'),
      tuile(pm ? textePoids(pm) : '—', 'poids moyen'),
      tuile(tm ? texteTaille(Math.round(tm * 10) / 10) : '—', 'taille moyenne'),
      modes
    ]));
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
    else rendreStats();
  }

  /* ---------- Fiche : ajout, modification, suppression ---------- */
  var form = $('form-fiche'), dlgFiche = $('dlg-fiche');
  function valeurSexe() { var c = form.querySelector('input[name="sexe"]:checked'); return c ? c.value : ''; }
  function valeurMode() { var c = form.querySelector('input[name="mode"]:checked'); return c ? c.value : ''; }
  function majApercu() {
    var sexe = valeurSexe(), ap = $('apercu');
    ap.className = 'bracelet apercu ' + (sexe || 'neutre');
    $('apercu-prenom').textContent = form.prenom.value.trim() || 'Prénom';
    ajusterPrenoms(ap);
    $('apercu-quand').textContent = form.date.value ? texteQuand({ date: form.date.value, heure: form.heure.value, mode: valeurMode() }) : '';
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
      form.querySelectorAll('input[name="mode"]').forEach(function (c) { c.checked = c.value === b.mode; });
      form.prenom.value = b.prenom;
      form.date.value = b.date;
      form.heure.value = b.heure;
      form.poids.value = b.poids == null ? '' : b.poids;
      form.taille.value = b.taille == null ? '' : String(b.taille).replace('.', ',');
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
    /* Le mode est facultatif : un seul choix à la fois, et on peut le décocher. */
    if (ev.target.name === 'mode' && ev.target.checked) {
      form.querySelectorAll('input[name="mode"]').forEach(function (c) { if (c !== ev.target) c.checked = false; });
    }
    $('fiche-erreur').hidden = true;
    majApercu();
  });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var sexe = valeurSexe(), date = form.date.value, poids = nombre(form.poids), taille = nombre(form.taille);
    if (!sexe) return erreurFiche('Choisir fille ou garçon.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return erreurFiche('Indiquer la date de naissance.');
    if (date > iso(new Date())) return erreurFiche('La date de naissance est dans le futur.');
    if (poids != null && (isNaN(poids) || poids < 300 || poids > 7000)) return erreurFiche('Le poids se saisit en grammes, entre 300 et 7000 (par exemple 3420).');
    if (taille != null && (isNaN(taille) || taille < 20 || taille > 65)) return erreurFiche('La taille se saisit en centimètres, entre 20 et 65 (par exemple 50).');
    var maintenant = new Date().toISOString();
    var ancien = ficheId ? donnees.bebes.filter(function (b) { return b.id === ficheId; })[0] : null;
    var fiche = normaliser({
      id: ficheId || identifiant(), prenom: form.prenom.value, sexe: sexe, date: date, heure: form.heure.value,
      poids: poids, taille: taille, mode: valeurMode(), note: form.note.value.trim(),
      cree: ancien ? ancien.cree : maintenant, modifie: maintenant
    });
    var avant = donnees.bebes.slice();
    if (ancien) donnees.bebes = donnees.bebes.map(function (b) { return b.id === ficheId ? fiche : b; });
    else donnees.bebes.push(fiche);
    if (!enregistrer()) { donnees.bebes = avant; return; }
    /* Depuis la vue Naissances, on y reste avec la recherche en cours ; sinon retour à l'accueil sur la date du bébé. */
    if (etat.vue !== 'naissances') {
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
      /* La loupe du téléphone sert à chercher : le champ prend le focus et le clavier s'ouvre. */
      if (etat.vue === 'naissances' && cible.classList.contains('btn-rond')) $('r-texte').focus();
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
    minuterieTaille = setTimeout(function () { ajusterPrenoms(document); }, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ajusterPrenoms(document); });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
