/* ORFE · comportements du site. Aucun suivi, aucune bibliothèque. Le site reste utilisable sans JavaScript. */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  };

  /* Menu mobile */
  var toggle = document.querySelector(".menu-bouton");
  var nav = document.getElementById("menu");
  if (toggle && nav) {
    var label = toggle.querySelector(".menu-bouton__texte");
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      nav.classList.toggle("est-ouvert", open);
      document.body.classList.toggle("menu-ouvert", open);
      if (label) label.textContent = open ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* Copier une citation ou le lien de la page */
  var copy = function (text, button) {
    var done = function () {
      var original = button.textContent;
      button.textContent = button.dataset.copied || "OK";
      setTimeout(function () { button.textContent = original; }, 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, function () {});
    } else {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "absolute";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); done(); } catch (err) {}
      document.body.removeChild(area);
    }
  };
  document.querySelectorAll("[data-copy-target]").forEach(function (b) {
    b.addEventListener("click", function () {
      var el = document.getElementById(b.dataset.copyTarget);
      if (el) copy(el.textContent.trim(), b);
    });
  });
  document.querySelectorAll("[data-copy-url]").forEach(function (b) {
    b.addEventListener("click", function () { copy(b.dataset.copyUrl, b); });
  });

  /* Carte de nuit : une lueur suit le pointeur, les repères répondent à l'analyse du moment */
  var carte = document.querySelector(".carte");
  if (carte) {
    var image = carte.querySelector(".carte__image");
    var hero = carte.closest(".nuit");
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (hero && image && fine.matches && !reduce.matches) {
      var lueur = null;
      var frame = 0;
      var px = 0, py = 0;
      var place = function () {
        frame = 0;
        var r = carte.getBoundingClientRect();
        carte.style.setProperty("--mx", ((px - r.left) / r.width) * 100 + "%");
        carte.style.setProperty("--my", ((py - r.top) / r.height) * 100 + "%");
      };
      hero.addEventListener("pointermove", function (e) {
        if (!lueur) {
          lueur = image.cloneNode(false);
          lueur.removeAttribute("fetchpriority");
          lueur.className = "carte__lueur";
          lueur.src = image.currentSrc || image.src;
          lueur.removeAttribute("srcset");
          image.parentNode.parentNode.insertBefore(lueur, image.parentNode.nextSibling);
        }
        px = e.clientX; py = e.clientY;
        carte.classList.add("carte--eclairee");
        if (!frame) frame = requestAnimationFrame(place);
      });
      hero.addEventListener("pointerleave", function () { carte.classList.remove("carte--eclairee"); });
    }
    var une = document.querySelector(".une[data-lieu]");
    var repereUne = document.querySelector(".repere--une");
    if (une && repereUne) {
      var on = function () { repereUne.classList.add("repere--actif"); };
      var off = function () { repereUne.classList.remove("repere--actif"); };
      une.addEventListener("pointerenter", on);
      une.addEventListener("pointerleave", off);
      une.addEventListener("focusin", on);
      une.addEventListener("focusout", off);
    }
  }

  /* Lecture d'une publication : les deux langues côte à côte, ou une seule */
  var doc = document.querySelector("[data-doc]");
  if (doc) {
    var choix = doc.querySelector("[data-lecture-choix]");
    var large = window.matchMedia("(min-width: 60em)");
    var pageLang = document.documentElement.lang;
    if (choix) {
      choix.hidden = false;
      var boutons = choix.querySelectorAll("button[data-mode]");
      var setMode = function (mode, save) {
        doc.dataset.mode = mode;
        boutons.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.mode === mode ? "true" : "false"); });
        if (save) store.set("orfe-lecture", mode);
      };
      var saved = store.get("orfe-lecture");
      setMode(saved === "deux" || saved === "es" || saved === "fr" ? saved : (large.matches ? "deux" : pageLang), false);
      boutons.forEach(function (b) {
        b.addEventListener("click", function () { setMode(b.dataset.mode, true); });
      });
    }

    /* Progression de lecture : la frontière se trace de l'Atlantique à la Méditerranée */
    var trace = doc.querySelector(".lecture__progression path");
    var corps = doc.querySelector(".doc__corps");
    if (trace && corps) {
      var tick = 0;
      var update = function () {
        tick = 0;
        var r = corps.getBoundingClientRect();
        var total = r.height - window.innerHeight * 0.6;
        var done = Math.min(1, Math.max(0, (-r.top + window.innerHeight * 0.25) / Math.max(total, 1)));
        trace.style.strokeDashoffset = String(1 - done);
      };
      window.addEventListener("scroll", function () { if (!tick) tick = requestAnimationFrame(update); }, { passive: true });
      window.addEventListener("resize", update);
      update();
    }
  }

  /* Filtres de la liste des publications */
  var filters = document.querySelector("[data-filters]");
  var list = document.querySelector("[data-filter-list]");
  if (filters && list) {
    var items = Array.prototype.slice.call(list.children);
    var empty = document.querySelector("[data-filter-empty]");
    var count = filters.querySelector("[data-count]");
    var apply = function () {
      var f = {
        pole: filters.elements.pole.value,
        format: filters.elements.format.value,
        year: filters.elements.year.value
      };
      var shown = 0;
      items.forEach(function (li) {
        var it = li.querySelector(".fiche");
        if (!it) return;
        var ok =
          (!f.pole || it.dataset.pole === f.pole) &&
          (!f.format || it.dataset.format === f.format) &&
          (!f.year || it.dataset.year === f.year);
        li.hidden = !ok;
        if (ok) shown++;
      });
      list.classList.toggle("fiches--filtre", Boolean(f.pole || f.format || f.year));
      if (empty) empty.hidden = shown !== 0;
      if (count) count.textContent = shown + " " + (shown === 1 ? count.dataset.one : count.dataset.many);
    };
    filters.addEventListener("change", apply);
    filters.addEventListener("reset", function () { setTimeout(apply, 0); });
    filters.addEventListener("submit", function (e) { e.preventDefault(); });
    apply();
  }

  /* Formulaire de contact ouvert depuis « Signaler une erreur » : motif et publication déjà remplis */
  (function () {
    var params = new URLSearchParams(window.location.search);
    var objet = document.getElementById("k-objet");
    var message = document.getElementById("k-message");
    if (!objet || params.get("objet") !== "erreur") return;
    objet.value = "erreur";
    var sujet = params.get("sujet");
    if (sujet && message && !message.value) message.value = "« " + sujet.slice(0, 200) + " »\n\n";
  })();

  /* Formulaires (Formspree) : message de succès seulement si l'envoi a réellement réussi */
  document.querySelectorAll("form[data-form]").forEach(function (form) {
    form.noValidate = true; // sans JavaScript, le navigateur valide lui-même les champs obligatoires
    var status = form.querySelector(".form__status");
    var button = form.querySelector("button[type=submit]");
    var showError = function (field, message) {
      var err = document.getElementById(field.getAttribute("aria-describedby"));
      field.setAttribute("aria-invalid", "true");
      if (err) { err.textContent = message; err.hidden = false; }
    };
    var clearError = function (field) {
      field.removeAttribute("aria-invalid");
      var id = field.getAttribute("aria-describedby");
      var err = id && document.getElementById(id);
      if (err && err.classList.contains("field__error")) { err.textContent = ""; err.hidden = true; }
    };
    var validate = function () {
      var firstInvalid = null;
      form.querySelectorAll("[required]").forEach(function (field) {
        clearError(field);
        var value = field.value.trim();
        if (!value) {
          showError(field, form.dataset.msgRequired);
        } else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          showError(field, form.dataset.msgEmail);
        } else {
          return;
        }
        if (!firstInvalid) firstInvalid = field;
      });
      return firstInvalid;
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var invalid = validate();
      status.className = "form__status";
      if (invalid) {
        status.textContent = form.dataset.msgInvalid;
        status.classList.add("is-error");
        invalid.focus();
        return;
      }
      if (form.dataset.preview) {
        status.textContent = form.dataset.msgPreview;
        status.classList.add("is-success");
        return;
      }
      button.disabled = true;
      var buttonText = button.textContent;
      button.textContent = form.dataset.msgSending;
      status.textContent = "";
      fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          form.reset();
          status.textContent = form.dataset.msgSuccess;
          status.classList.add("is-success");
        })
        .catch(function () {
          status.textContent = form.dataset.msgError;
          status.classList.add("is-error");
        })
        .then(function () {
          button.disabled = false;
          button.textContent = buttonText;
          status.setAttribute("tabindex", "-1");
          status.focus();
        });
    });
  });

  /* Boletín / newsletter (Brevo) : inscription sans quitter la page.
     Le message de succès n'apparaît que si Brevo accepte l'inscription ; en cas d'échec,
     un lien ouvre le formulaire Brevo dans un nouvel onglet (même adresse que l'envoi). */
  document.querySelectorAll("form[data-lettre]").forEach(function (form) {
    var input = form.querySelector("input[name=EMAIL]");
    var button = form.querySelector("button[type=submit]");
    var status = form.querySelector(".nl-form__statut");
    var dire = function (texte, etat, avecRepli) {
      status.className = "nl-form__statut " + etat;
      status.textContent = texte;
      if (avecRepli) {
        var a = document.createElement("a");
        a.href = form.getAttribute("action");
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = form.dataset.msgRepli;
        var cache = document.createElement("span");
        cache.className = "visually-hidden";
        cache.textContent = form.dataset.msgOnglet;
        a.appendChild(cache);
        status.appendChild(document.createTextNode(" "));
        status.appendChild(a);
      }
    };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
        input.setAttribute("aria-invalid", "true");
        dire(form.dataset.msgEmail, "is-error");
        input.focus();
        return;
      }
      input.removeAttribute("aria-invalid");
      if (form.dataset.preview) { dire(form.dataset.msgPreview, "is-success"); return; }
      var action = form.getAttribute("action");
      var texteBouton = button.textContent;
      button.disabled = true;
      button.textContent = form.dataset.msgSending;
      status.className = "nl-form__statut";
      status.textContent = "";
      fetch(action + (action.indexOf("?") === -1 ? "?" : "&") + "isAjax=1", { method: "POST", body: new FormData(form) })
        .then(function (r) {
          return r.text().then(function (corps) {
            var d = null;
            try { d = JSON.parse(corps); } catch (err) { d = null; }
            if (d && typeof d.success !== "undefined") return Boolean(d.success);
            return r.ok;
          });
        })
        .then(function (ok) {
          if (ok) { form.reset(); dire(form.dataset.msgSuccess, "is-success"); }
          else dire(form.dataset.msgError, "is-error", true);
        })
        .catch(function () { dire(form.dataset.msgError, "is-error", true); })
        .then(function () {
          button.disabled = false;
          button.textContent = texteBouton;
        });
    });
  });

  /* Recherche (Pagefind), seulement sur la page de recherche */
  var search = document.querySelector("[data-search]");
  if (search) {
    var start = function () {
      if (!window.PagefindUI) return;
      new window.PagefindUI({
        element: "#recherche",
        showSubResults: true,
        showImages: false,
        resetStyles: false,
        translations: {
          placeholder: search.dataset.placeholder,
          zero_results: search.dataset.zero + " [SEARCH_TERM]"
        }
      });
      // Libellé visible pour le champ de recherche (accessibilité)
      var tries = 0;
      var addLabel = function () {
        var input = search.querySelector("input");
        if (!input) { if (tries++ < 50) requestAnimationFrame(addLabel); return; }
        input.id = "champ-recherche";
        var lab = document.createElement("label");
        lab.setAttribute("for", "champ-recherche");
        lab.className = "recherche__label";
        lab.textContent = search.dataset.label;
        search.insertBefore(lab, search.firstChild);
      };
      addLabel();
    };
    /* Recherche de secours (aperçu hors ligne, ou si Pagefind ne se charge pas) : titres, chapôs et textes */
    var lite = function () {
      if (window.PagefindUI || search.dataset.lite) return;
      search.dataset.lite = "1";
      var norm = function (s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); };
      var lab = document.createElement("label");
      lab.setAttribute("for", "champ-recherche");
      lab.className = "recherche__label";
      lab.textContent = search.dataset.label;
      var input = document.createElement("input");
      input.type = "search"; input.id = "champ-recherche"; input.className = "recherche__champ";
      input.placeholder = search.dataset.placeholder;
      var status = document.createElement("p");
      status.className = "recherche__compte"; status.setAttribute("role", "status");
      var list = document.createElement("ol");
      list.className = "recherche__resultats";
      search.append(lab, input, status, list);
      fetch(search.dataset.index).then(function (r) { return r.json(); }).then(function (items) {
        var run = function () {
          var q = norm(input.value.trim());
          list.innerHTML = "";
          if (!q) { status.textContent = ""; return; }
          var words = q.split(/\s+/);
          var hits = items.filter(function (it) {
            var hay = norm(it.titre + " " + it.autre + " " + it.chapo + " " + it.texte);
            return words.every(function (w) { return hay.indexOf(w) !== -1; });
          });
          hits.forEach(function (it) {
            var li = document.createElement("li");
            var a = document.createElement("a");
            a.href = "../.." + it.url + (/\.html$/.test(location.pathname) ? "index.html" : ""); a.textContent = it.titre;
            var p = document.createElement("p"); p.textContent = it.chapo;
            li.append(a, p); list.append(li);
          });
          status.textContent = hits.length ? hits.length + " " + (hits.length === 1 ? search.dataset.one : search.dataset.many) : search.dataset.zero;
        };
        input.addEventListener("input", run);
      }, function () {});
    };
    if (window.PagefindUI) start(); else window.addEventListener("load", function () { start(); setTimeout(lite, 300); });
  }
})();
