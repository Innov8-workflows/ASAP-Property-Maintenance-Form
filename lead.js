/* ===== ASAP Property Maintenance — lead log beacon =====
   Every contact action POSTs to a Google Apps Script web app, which appends a
   row to the leads Sheet and emails an alert for the types in NOTIFY_TYPES.

   Loaded by BOTH index.html and privacy.html. Every hook is delegated off
   document and guarded, so this file is a harmless no-op on a page where the
   quiz doesn't exist. It makes NO changes to script.js and assumes nothing
   about whether script.js ran.

   NOT consent-gated, on purpose: it sets no cookies, writes no storage and
   carries no identifiers, so it isn't analytics — and a declined cookie banner
   must never cost Levi a real enquiry. GA4 and the Meta Pixel ARE gated, in
   consent.js. Different things; don't conflate them. */
(function(){
'use strict';

/* Apps Script web-app /exec URL. Empty = this file is inert, so deploying
   before the script exists breaks nothing. On redeploy always use
   Manage deployments -> pencil -> New version, so this URL stays valid. */
var LEAD_URL = '';

/* ?leadtest=1 sends rows to the sheet's "Test" tab and suppresses every email
   server-side. It's what makes verifying on the LIVE domain safe — the CSP can
   only really be proven on the real origin. It also unlocks the same-origin
   postMessage escape hatch below, so the Calendly path can be exercised
   without creating a booking that would notify the client. */
var TEST = /[?&]leadtest=1(&|$)/.test(location.search);

/* ---------- transport ----------
   NEVER navigator.sendBeacon: it silently drops the /exec cross-origin 302
   while returning true, so leads vanish with no error anywhere. fetch +
   no-cors + keepalive + text/plain is the only combination that survives the
   redirect and page unload (text/plain avoids a preflight Apps Script can't
   answer). CSP connect-src must allow script.google.com AND
   script.googleusercontent.com — the 302 hop is re-checked against the policy. */
function post(d){
  if(!LEAD_URL) return;
  try{
    d.page = (location.pathname || '/') + campaign();
    if(TEST) d.test = 1;
    fetch(LEAD_URL, {method:'POST', mode:'no-cors', keepalive:true,
      headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(d)});
  }catch(e){}
}

/* Campaign attribution for the Meta ads: utm_* only. fbclid/gclid are
   deliberately dropped — they're per-visitor identifiers, which would drag the
   beacon back into the consent question this design sidesteps. */
function campaign(){
  try{
    var out = [];
    new URLSearchParams(location.search).forEach(function(v, k){
      if(k.indexOf('utm_') === 0 && v) out.push(k + '=' + v);
    });
    return out.length ? '?' + out.join('&') : '';
  }catch(e){ return ''; }
}

/* In-memory only — deliberately NOT sessionStorage. Storing an id on a site
   with a PECR consent banner would need consent; a plain object doesn't. */
var seen = Object.create(null);
function once(key, ms){
  var now = new Date().getTime();
  if(seen[key] && now - seen[key] < ms) return false;
  seen[key] = now; return true;
}

function v(id){ var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }

/* .quiz sits INSIDE section.hero, so it must be tested first or every quiz
   click mislabels as "hero". */
function where(el){
  if(!el || !el.closest) return 'page';
  if(el.closest('.wa-float')) return 'whatsapp widget';
  if(el.closest('.quiz'))     return 'quiz';
  if(el.closest('header'))    return 'header';
  if(el.closest('.hero'))     return 'hero';
  if(el.closest('.cta-band')) return 'bottom CTA';
  if(el.closest('.legal'))    return 'privacy page';
  if(el.closest('footer'))    return 'footer';
  return 'page';
}

/* ---------- service / urgency ----------
   script.js keeps these in a closure we can't reach, and mirrors the choice
   onto the chosen button as a `.sel` class. Reading `.sel` works, but `.sel`
   has no CSS rule anywhere, so a future tidy-up could delete it as dead code
   and silently empty these columns. Capture the same data-val script.js reads
   instead — those attributes are load-bearing for the quiz and can't be
   removed without visibly breaking it. `.sel` stays as a fallback. */
var picked = {};
document.addEventListener('click', function(e){
  var t = e.target; if(!t || !t.closest) return;
  var b = t.closest('[data-field][data-val]'); if(!b) return;
  picked[b.getAttribute('data-field')] = b.getAttribute('data-val');
}, true);

function choice(f){
  if(picked[f]) return picked[f];
  var el = document.querySelector('.quiz [data-field="' + f + '"].sel');
  return el ? (el.getAttribute('data-val') || '') : '';
}

function quizFields(){
  return { name:v('leadName'), phone:v('leadPhone'), email:v('leadEmail'),
           postcode:v('leadPostcode'), service:choice('service'), details:choice('urgency') };
}

/* ---------- Quote form (the lead) ----------
   There is no <form> on this page, so there's no submit event — #toBooking is
   the only trigger.

   The guard below is the most important line in this file. script.js's own
   handler validates name/phone and RETURNS if either is blank; a capture-phase
   listener fires BEFORE that, so without this every mis-tap on mobile would
   log an empty row and fire an alert email. Bubble phase wouldn't help — a
   `return` in one listener doesn't stop the others. */
document.addEventListener('click', function(e){
  var t = e.target; if(!t || !t.closest || !t.closest('#toBooking')) return;
  var d = quizFields();
  if(!d.name || !d.phone) return;                 // mirrors script.js's own validation
  if(!once('quote|' + d.name + '|' + d.phone, 864e5)) return;
  d.type = 'Quote form'; d.source = 'quiz step 4';
  post(d);
  /* No GA4 mirror here: script.js already fires generate_lead behind its own
     lead._tracked guard. Firing it again would double-count. */
}, true);

/* ---------- Call / WhatsApp intent ----------
   Capture phase so the row is dispatched before a tel:/wa.me navigation tears
   the page down; keepalive is what lets it survive.
   #skipBook is href="#", so it matches neither branch. #waConfirm IS excluded:
   it has no href until showDone() sets a wa.me one, by which point this same
   person is already logged — letting it through just duplicates the row. */
document.addEventListener('click', function(e){
  var t = e.target; if(!t || !t.closest) return;
  var a = t.closest('a'); if(!a || a.id === 'waConfirm') return;
  var h = a.getAttribute('href') || '', type = '', phone = '';
  if(h.indexOf('tel:') === 0){ type = 'Call click'; phone = h.slice(4); }
  else if(h.indexOf('wa.me') > -1){ type = 'WhatsApp click'; }
  else return;

  var src = where(a);
  /* 30s, not permanent: a genuine second attempt later is real signal. */
  if(!once(type + '|' + src, 30000)) return;
  post({ type:type, phone:phone, source:src });

  /* GA4 mirror — these two are the only actions with no existing event. The
     quiz already fires generate_lead / booking_confirmed / enquiry_sent. */
  try{
    if(typeof gtag === 'function'){
      gtag('event', type === 'Call click' ? 'click_to_call' : 'click_whatsapp',
           { lead_source: src, page_path: location.pathname });
    }
  }catch(e){}
}, true);

/* ---------- outcome: booked vs callback (both silent, never emailed) ----------
   Independent of script.js's own message listener; both fire and they don't
   interact. Origin-checked here (script.js's isn't), with a same-origin escape
   hatch under ?leadtest=1 so the booking path can be exercised by a synthetic
   postMessage — a REAL Calendly booking emails the client, a simulated one
   can't. Calendly's payload carries only API URIs, not the invitee's details,
   so the row is rebuilt from the same DOM fields. */
window.addEventListener('message', function(e){
  var m = e.data;
  if(!m || typeof m.event !== 'string' || m.event !== 'calendly.event_scheduled') return;
  if(!/^https:\/\/([a-z0-9-]+\.)?calendly\.com$/.test(e.origin) &&
     !(TEST && e.origin === location.origin)) return;
  if(!once('booked', 864e5)) return;
  var d = quizFields(); d.type = 'Booking confirmed'; d.source = 'calendly';
  post(d);
});

document.addEventListener('click', function(e){
  var t = e.target; if(!t || !t.closest || !t.closest('#skipBook')) return;
  if(!once('skip', 864e5)) return;
  var d = quizFields(); d.type = 'Callback request'; d.source = 'skipped calendar';
  post(d);
}, true);

})();
