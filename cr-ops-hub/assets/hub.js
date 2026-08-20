/* ============================================================
   Ops Hub — renders the cards from assets/resources.js and
   runs the search box. You should not need to touch this file
   to add or change a resource; edit resources.js instead.
   ============================================================ */

(function () {
  'use strict';

  var DATA = (window.CR_RESOURCES || []).filter(function (s) { return !s.hidden; });

  var sectionsEl = document.getElementById('sections');
  var noResultsEl = document.getElementById('no-results');
  var inputEl = document.getElementById('search-input');
  var clearEl = document.getElementById('clear-btn');
  var countEl = document.getElementById('total-count');

  /* ---------- helpers ---------- */

  function esc(value) {
    var d = document.createElement('div');
    d.textContent = value == null ? '' : String(value);
    return d.innerHTML;
  }

  function escAttr(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function badgeLetter(name) {
    return (String(name || '?').trim().charAt(0) || '?').toUpperCase();
  }

  /* Wraps the emphasis word in italic gold, the way the headings
     on the sub-sites do. Falls back to the plain name. */
  function styledName(item) {
    var name = esc(item.name);
    if (!item.emphasis) return name;
    var word = esc(item.emphasis);
    var at = name.indexOf(word);
    if (at === -1) return name;
    return name.slice(0, at) + '<em>' + word + '</em>' + name.slice(at + word.length);
  }

  function isLive(item) {
    return item.status !== 'soon' && !!item.href;
  }

  var ARROW = '<span class="arrow" aria-hidden="true">&rarr;</span>';

  /* ---------- searching ---------- */

  function haystack(item, section) {
    return [
      item.name,
      item.blurb,
      item.cta,
      section.title,
      section.label,
      (item.tags || []).join(' '),
    ].join(' ').toLowerCase();
  }

  function matches(item, section, query) {
    if (!query) return true;
    return haystack(item, section).indexOf(query) !== -1;
  }

  /* ---------- rendering ---------- */

  function cardHtml(item, featured) {
    var live = isLive(item);
    var inner;

    if (featured) {
      inner =
        (item.kicker ? '<div class="card-kicker">' + esc(item.kicker) + '</div>' : '') +
        '<div class="card-name">' + styledName(item) + '</div>' +
        '<div class="card-blurb">' + esc(item.blurb) + '</div>' +
        '<div class="card-cta">' + esc(item.cta || 'OPEN') + ' ' + ARROW + '</div>';
    } else {
      inner =
        '<div class="card-badge" aria-hidden="true">' + esc(badgeLetter(item.name)) + '</div>' +
        '<div class="card-name">' + esc(item.name) + '</div>' +
        '<div class="card-blurb">' + esc(item.blurb) + '</div>' +
        '<div class="card-cta">' +
          (live ? esc(item.cta || 'OPEN') + ' ' + ARROW : 'Coming soon') +
        '</div>';
    }

    if (item.external) {
      inner = '<span class="ext-mark">External</span>' + inner;
    }

    var cls = featured ? 'card-dark' : 'card';
    if (!live) cls += ' card-soon';

    if (!live) {
      return '<div class="' + cls + '" aria-disabled="true">' + inner + '</div>';
    }

    var target = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return '<a class="' + cls + '" href="' + escAttr(item.href) + '"' + target + '>' + inner + '</a>';
  }

  function sectionHtml(section, items) {
    var noun = items.length === 1 ? 'resource' : 'resources';
    return '' +
      '<section class="section">' +
        '<div class="section-head">' +
          '<div class="section-top">' +
            '<div class="section-label">' + esc(section.label) + '</div>' +
            '<div class="section-count">' + items.length + ' ' + noun + '</div>' +
          '</div>' +
          '<h2 class="section-title">' + esc(section.title) + '</h2>' +
        '</div>' +
        '<div class="grid">' +
          items.map(function (item) { return cardHtml(item, section.featured); }).join('') +
        '</div>' +
      '</section>';
  }

  function render(rawQuery) {
    var query = (rawQuery || '').trim().toLowerCase();
    var html = '';
    var shown = 0;

    DATA.forEach(function (section) {
      var items = (section.items || []).filter(function (item) {
        return !item.hidden && matches(item, section, query);
      });
      if (!items.length) return;
      shown += items.length;
      html += sectionHtml(section, items);
    });

    sectionsEl.innerHTML = html;
    noResultsEl.classList.toggle('visible', shown === 0);
  }

  /* ---------- total in the footer ---------- */

  function renderTotal() {
    if (!countEl) return;
    var live = 0;
    var total = 0;
    DATA.forEach(function (section) {
      (section.items || []).forEach(function (item) {
        if (item.hidden) return;
        total++;
        if (isLive(item)) live++;
      });
    });
    countEl.textContent = live + ' live · ' + total + ' listed';
  }

  /* ---------- wiring ---------- */

  function onInput() {
    var value = inputEl.value;
    clearEl.classList.toggle('visible', value.trim().length > 0);
    render(value);
  }

  inputEl.addEventListener('input', onInput);

  clearEl.addEventListener('click', function () {
    inputEl.value = '';
    inputEl.focus();
    onInput();
  });

  /* "/" focuses search, Escape clears it — same shortcuts as the
     referral leads sheet, so the habit carries across the sites. */
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== inputEl) {
      e.preventDefault();
      inputEl.focus();
    } else if (e.key === 'Escape' && document.activeElement === inputEl) {
      inputEl.value = '';
      inputEl.blur();
      onInput();
    }
  });

  render('');
  renderTotal();
})();
