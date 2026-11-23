

(function(){
'use strict';

var LEAD_URL = 'https://script.google.com/macros/s/AKfycbyNjq7hDc5xAB-se_bMQl5Z0iTUnAztr1-GjtTBtl-RdNzhW8zPbUDLhr1oS7O9LYBElw/exec';

var TEST = /[?&]leadtest=1(&|$)/.test(location.search);
window.ASAP_LEADTEST = TEST;

function post(d){
  if(!LEAD_URL) return;
  try{
    d.page = (location.pathname || '/') + campaign();
    if(TEST) d.test = 1;
    fetch(LEAD_URL, {method:'POST', mode:'no-cors', keepalive:true,
      headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(d)}).catch(function(){});
  }catch(e){}
}

function campaign(){
  try{
    var out = [];
    new URLSearchParams(location.search).forEach(function(v, k){
      if(k.indexOf('utm_') === 0 && v) out.push(k + '=' + v);
    });
    return out.length ? '?' + out.join('&') : '';
  }catch(e){ return ''; }
}

var seen = Object.create(null);
function once(key, ms){
  var now = new Date().getTime();
  if(seen[key] && now - seen[key] < ms) return false;
  seen[key] = now; return true;
}

window.sendLead = function(d){
  if(!d || !d.type) return;
  if(!once(d.type + '|' + (d.name || '') + '|' + (d.phone || ''), 864e5)) return;
  post(d);
};

function where(el){
  if(!el || !el.closest) return 'page';
  if(el.closest('.quiz'))     return 'quiz';
  if(el.closest('header'))    return 'header';
  if(el.closest('.cta-band')) return 'bottom CTA';
  if(el.closest('.legal'))    return 'privacy page';
  if(el.closest('footer'))    return 'footer';
  return 'page';
}

document.addEventListener('click', function(e){
  var t = e.target; if(!t || !t.closest) return;
  var a = t.closest('a'); if(!a || a.hasAttribute('data-quiz-send')) return;
  var h = a.getAttribute('href') || '';
  if(h.indexOf('tel:') !== 0) return;
  var src = where(a);
  if(!once('call|' + src, 30000)) return;
  post({ type:'Call click', phone:h.slice(4), source:src });
  if(window.track) window.track('click_to_call', { lead_source: src });
}, true);

})();
