

(function(){
  'use strict';
  var root = document.documentElement;
  var GA = root.getAttribute('data-ga') || '';
  var PX = root.getAttribute('data-pixel') || '';
  var KEY = 'asap_cookie_consent';
  var started = false;
  var q = [];

  var GA_NAME = { Lead: 'generate_lead' };
  var META_STD = { Lead: 1, Contact: 1, PageView: 1 };

  function startTrackers(){
    if(started) return;
    started = true;
    if(GA){
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){ window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA);
      var g = document.createElement('script');
      g.async = true;
      g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA);
      document.head.appendChild(g);
    }
    if(PX){
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', PX);
      window.fbq('track', 'PageView');
    }
  }

  window.track = function(name, params, eventId){
    if(!started){ q.push([name, params, eventId]); return; }
    try{
      if(window.gtag) window.gtag('event', GA_NAME[name] || name, params || {});
      if(window.fbq){
        var type = META_STD[name] ? 'track' : 'trackCustom';
        if(eventId) window.fbq(type, name, params || {}, { eventID: eventId });
        else window.fbq(type, name, params || {});
      }
    }catch(e){}
  };
  function flush(){ var c = q.slice(); q.length = 0; c.forEach(function(e){ window.track(e[0], e[1], e[2]); }); }

  function stored(){ try{ return localStorage.getItem(KEY); }catch(e){ return null; } }
  function save(v){ try{ localStorage.setItem(KEY, v); }catch(e){} }

  function accept(){ save('granted'); startTrackers(); flush(); hide(); }
  function reject(){
    save('denied'); q.length = 0; hide();

    try{ if(window.gtag) window.gtag('consent', 'update', { analytics_storage:'denied', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied' }); }catch(e){}
    try{ if(window.fbq) window.fbq('consent', 'revoke'); }catch(e){}
  }

  if(stored() === 'granted'){ startTrackers(); }

  function build(){
    if(document.getElementById('cookieBar')) return;
    var bar = document.createElement('div');
    bar.id = 'cookieBar';
    bar.className = 'cookie-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML =
      '<div class="cookie-text">We use cookies to measure traffic and how our ads perform. <a href="privacy.html">Privacy Policy</a></div>' +
      '<div class="cookie-btns">' +
        '<button type="button" class="btn cookie-reject" id="cookieReject">Reject</button>' +
        '<button type="button" class="btn btn-gold cookie-accept" id="cookieAccept">Accept</button>' +
      '</div>';
    document.body.appendChild(bar);
    document.getElementById('cookieAccept').addEventListener('click', accept);
    document.getElementById('cookieReject').addEventListener('click', reject);
  }
  function show(){ build(); var b = document.getElementById('cookieBar'); if(b) b.classList.add('show'); }
  function hide(){ var b = document.getElementById('cookieBar'); if(b) b.classList.remove('show'); }
  window.openCookieSettings = show;

  function init(){
    if(!stored()) show();
    var links = document.querySelectorAll('#cookieSettingsLink, .cookie-settings');
    for(var i = 0; i < links.length; i++){
      links[i].addEventListener('click', function(e){ e.preventDefault(); show(); });
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
