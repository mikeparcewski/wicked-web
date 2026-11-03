/* The two sites' header (Topbar here="agile" | "labs"): the menu below 1024 px. Inlined by Topbar.astro right
   after the header, after the theme script it shares with the product sites. Plain ES5 with no regex literals,
   like the rest of the inline chrome.
   - Without script the header stays as the HTML draws it: the section links in the bar, the theme and menu
     buttons hidden. This script marks the header `js`, which turns the menu layout on.
   - The menu button opens the menu and moves focus to its first link. Escape closes it and puts focus back on
     the button; so does following a link that opens a new tab, or a modified click (the page stays). A click
     outside the header, or focus leaving the header (also by way of the browser's own controls), closes it.
   - Following one of the page's own section links (#id) in this tab moves focus to that section.
   - A layout change that hides the focused control hands focus to a visible stand-in (a section link hidden by
     the menu: the menu button; the menu button hidden on a desktop: the theme switch), and the menu closes
     once the bar holds its links again. */
(function () {
  'use strict';
  var bar = document.querySelector('header.topbar--family');
  var nav = document.getElementById('nav');
  var btn = document.getElementById('menuBtn');
  var theme = document.getElementById('themeBtn');
  if (!bar || !nav || !btn) return;
  bar.classList.add('js');
  function shown(el) { return !!(el && el.getClientRects().length); }
  function isOpen() { return nav.classList.contains('open'); }
  function setOpen(open, focusButton) {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var first = nav.querySelector('a');
      if (first) first.focus();
    } else if (focusButton && shown(btn)) {
      btn.focus();
    }
  }
  btn.addEventListener('click', function () { setOpen(!isOpen(), false); });
  nav.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    /* a modified click opens the link elsewhere (a new tab or window): this page stays where it is */
    var elsewhere = a.getAttribute('target') === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
    if (isOpen()) setOpen(false, elsewhere);
    var href = a.getAttribute('href') || '';
    if (!elsewhere && !e.defaultPrevented && href.charAt(0) === '#' && href.length > 1) {
      setTimeout(function () {
        var id;
        try { id = decodeURIComponent(href.slice(1)); } catch (x) { return; }
        var to = document.getElementById(id);
        if (!to) return;
        if (!to.hasAttribute('tabindex')) to.setAttribute('tabindex', '-1');
        to.focus({ preventScroll: true });
      }, 0);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) setOpen(false, true);
  });
  document.addEventListener('click', function (e) {
    if (isOpen() && !bar.contains(e.target)) setOpen(false, false);
  });
  bar.addEventListener('focusout', function (e) {
    if (isOpen() && e.relatedTarget && !bar.contains(e.relatedTarget)) setOpen(false, false);
  });
  /* the header control that last had focus: when a layout change hides it, the browser drops focus to the
     body before any change event runs, so the stand-in is found from here (cleared once focus, or a press, lands
     outside the header) */
  var last = null;
  document.addEventListener('focusin', function (e) {
    var inBar = bar.contains(e.target);
    last = inBar ? e.target : null;
    /* focus that left the header for the browser's controls (no related target) and came back elsewhere */
    if (!inBar && isOpen()) setOpen(false, false);
  });
  document.addEventListener('pointerdown', function (e) { if (!bar.contains(e.target)) last = null; });
  var wide = window.matchMedia ? window.matchMedia('(min-width: 1024px)') : null;
  function onLayout() {
    if (wide && wide.matches && isOpen()) setOpen(false, false);
    var at = document.activeElement;
    if (!at || at === document.body) at = last;
    if (at && bar.contains(at) && !shown(at)) {
      var to = shown(btn) ? btn : theme;
      if (shown(to)) to.focus({ preventScroll: true });
    }
  }
  if (wide && wide.addEventListener) wide.addEventListener('change', onLayout);
  else if (wide && wide.addListener) wide.addListener(onLayout);
})();
