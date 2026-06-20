/* ===== ASAP Property Maintenance — Cookie consent + deferred trackers =====
   - Google Analytics (GA4) loads with Consent Mode v2 defaulted to "denied"
     (set inline in <head>); this file flips it to "granted" only on Accept.
   - The Meta/Facebook Pixel is NOT loaded at all until the visitor accepts.
   - The visitor's choice is stored so the banner only shows until they decide,
     and can be reopened any time via the footer "Cookie settings" link. */
(function(){
  'use strict';
  var KEY = 'asap_cookie_consent';      // stored value: 'granted' | 'denied'
  var PIXEL_ID = '830826223035594';

  // ---- Meta Pixel: injected once, and only after consent is granted ----
  window.loadMetaPixel = function(){
    if(window._asapPixelLoaded) return; window._asapPixelLoaded = true;
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
  };

  // gtag is defined inline in <head>; fall back to a dataLayer push if not.
  function gt(){
    return (typeof window.gtag === 'function')
      ? window.gtag
      : function(){ (window.dataLayer = window.dataLayer || []).push(arguments); };
  }

  function apply(granted){
    gt()('consent', 'update', {
      ad_storage:         granted ? 'granted' : 'denied',
      ad_user_data:       granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
      analytics_storage:  granted ? 'granted' : 'denied'
    });
    if(granted){ window.loadMetaPixel(); }
    else if(window.fbq){ try{ fbq('consent', 'revoke'); }catch(e){} }
  }

  function stored(){ try{ return localStorage.getItem(KEY); }catch(e){ return null; } }
  function save(v){ try{ localStorage.setItem(KEY, v); }catch(e){} }

  // Re-apply any previous choice as early as possible (return visitors).
  var prior = stored();
  if(prior === 'granted') apply(true);
  else if(prior === 'denied') apply(false);

  // ---- Consent banner ----
  function build(){
    if(document.getElementById('cookieBar')) return;
    var bar = document.createElement('div');
    bar.id = 'cookieBar';
    bar.className = 'cookie-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML =
      '<div class="cookie-text">We use cookies to measure website traffic and the performance of our advertising. ' +
      'Essential cookies are always on; you can accept or reject the rest. See our <a href="privacy.html">Privacy Policy</a>.</div>' +
      '<div class="cookie-btns">' +
        '<button type="button" class="btn cookie-reject" id="cookieReject">Reject</button>' +
        '<button type="button" class="btn btn-gold cookie-accept" id="cookieAccept">Accept</button>' +
      '</div>';
    document.body.appendChild(bar);
    document.getElementById('cookieAccept').addEventListener('click', function(){ save('granted'); apply(true); hide(); });
    document.getElementById('cookieReject').addEventListener('click', function(){ save('denied'); apply(false); hide(); });
  }
  function show(){ build(); var b = document.getElementById('cookieBar'); if(b) b.classList.add('show'); }
  function hide(){ var b = document.getElementById('cookieBar'); if(b) b.classList.remove('show'); }

  // Allow the visitor to reopen / change their choice from the footer link.
  window.openCookieSettings = function(){ show(); };

  function init(){
    if(!stored()) show();
    var link = document.getElementById('cookieSettingsLink');
    if(link) link.addEventListener('click', function(e){ e.preventDefault(); show(); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
