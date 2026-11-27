
(function(){
'use strict';

var root = document.documentElement;
var yr = document.getElementById('yr');
if(yr) yr.textContent = new Date().getFullYear();

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function track(n, p, id){ if(window.track) window.track(n, p, id); }

function ghlEndpoint(){ return root.getAttribute('data-ghl-endpoint') || ''; }
function ghlCalendar(){ return root.getAttribute('data-ghl-calendar') || ''; }

(function(){
  var p = document.getElementById('stepBook');
  if(p && !ghlCalendar() && p.getAttribute('data-nocal')) p.textContent = p.getAttribute('data-nocal');
})();

function postGHL(d){
  var url = ghlEndpoint(); if(!url) return;
  try{

    fetch(url, {method:'POST', keepalive:true,
      headers:{'Content-Type':'text/plain;charset=UTF-8'},
      body:JSON.stringify(d)}).catch(function(){});
  }catch(e){}
}

function setupVideo(v, src){
  if(!v) return;
  var start = function(){
    if(!v.getAttribute('src')){ v.src = src; v.muted = true; v.defaultMuted = true; v.load(); }
    var p = v.play(); if(p && p.catch) p.catch(function(){});
  };
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){ es.forEach(function(e){
      if(e.isIntersecting) start();
      else if(v.getAttribute('src')) v.pause();
    }); }, {threshold:.15}).observe(v);
  } else { start(); }
}
var heroVideo = document.getElementById('heroVideo');
setupVideo(heroVideo, 'assets/hero-drone.mp4');
setupVideo(document.getElementById('baVideo'), 'assets/ba.mp4');
setupVideo(document.getElementById('ctaVideo'), 'assets/cta.mp4');
document.addEventListener('touchstart', function(){
  if(heroVideo){ var p = heroVideo.play(); if(p && p.catch) p.catch(function(){}); }
}, {once:true, passive:true});

var quiz = document.getElementById('quiz');
if(quiz){

var lead = {};
var STEPS = ['1','2','3','4','5'];
var progressBar = document.getElementById('progressBar');
var started = false;

function currentStep(){ var a = quiz.querySelector('.quiz-step.active'); return a ? a.getAttribute('data-step') : '1'; }
function goStep(key, scroll){
  Array.prototype.forEach.call(quiz.querySelectorAll('.quiz-step'), function(s){
    s.classList.toggle('active', s.getAttribute('data-step') === key);
  });
  var i = STEPS.indexOf(key);

  progressBar.style.width = (i >= 0 ? Math.min((i + 1) / 4, 1) * 100 : 100) + '%';
  if(scroll) quiz.scrollIntoView({behavior:'smooth', block:'start'});
}
function advance(){ var i = STEPS.indexOf(currentStep()); if(i > -1 && i < STEPS.length - 1) goStep(STEPS[i + 1], false); }
function back(){ var i = STEPS.indexOf(currentStep()); if(i > 0) goStep(STEPS[i - 1], false); }
Array.prototype.forEach.call(quiz.querySelectorAll('.quiz-back'), function(b){ b.addEventListener('click', back); });

Array.prototype.forEach.call(quiz.querySelectorAll('.opt, .opt-row'), function(btn){
  btn.addEventListener('click', function(){
    var f = btn.getAttribute('data-field');
    lead[f] = btn.getAttribute('data-val');
    Array.prototype.forEach.call(quiz.querySelectorAll('[data-field="' + f + '"]'), function(x){ x.classList.remove('sel'); });
    btn.classList.add('sel');
    if(f === 'service' && !started){ started = true; track('funnel_start', { answer: lead.service }); }
    track('funnel_step', { step: currentStep(), answer: lead[f] });
    setTimeout(advance, 160);
  });
});

function el(id){ return document.getElementById(id); }
function v(id){ var e = el(id); return e ? String(e.value || '').trim() : ''; }
function digits(s){ return String(s).replace(/\D/g, ''); }

var RULES = {
  leadAddress:  function(s){ return s.length >= 3; },
  leadPostcode: function(s){ return s.replace(/\s/g, '').length >= 2; },
  leadName:     function(s){ return s.length >= 2; },
  leadPhone:    function(s){ var n = digits(s).length; return n >= 10 && n <= 15; }
};
function check(ids){
  var bad = [];
  ids.forEach(function(id){
    var ok = RULES[id](v(id));
    el(id).classList.toggle('err', !ok);
    if(!ok) bad.push(id);
  });
  return bad;
}

Object.keys(RULES).forEach(function(id){
  var f = el(id); if(!f) return;
  f.addEventListener('input', function(){
    if(f.classList.contains('err') && RULES[id](v(id))) f.classList.remove('err');
  });
});

quiz.querySelector('[data-step="3"] .q-next').addEventListener('click', function(){
  var bad = check(['leadAddress', 'leadPostcode']);
  el('err3').hidden = !bad.length;
  if(bad.length){ el(bad[0]).focus(); track('funnel_invalid', { step: 3, missing: bad.join(',') }); return; }
  lead.address = v('leadAddress'); lead.postcode = v('leadPostcode').toUpperCase();
  track('funnel_step', { step: 3, answer: 'address given' });
  advance();
});

function cookie(n){
  var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)');
  return m ? decodeURIComponent(m[1]) : '';
}

el('toBooking').addEventListener('click', function(){
  var bad = check(['leadName', 'leadPhone']);
  el('err4').hidden = !bad.length;
  if(bad.length){ el(bad[0]).focus(); track('funnel_invalid', { step: 4, missing: bad.join(',') }); return; }

  lead.name = v('leadName'); lead.phone = v('leadPhone'); lead.email = v('leadEmail');

  if(v('leadWebsite')){ showDone(false); return; }

  if(!lead._sent){
    lead._sent = true;

    lead.eventId = 'lead.' + Date.now() + '.' + Math.random().toString(36).slice(2, 10);
    var meta = { event_id: lead.eventId, fbp: cookie('_fbp'), fbc: cookie('_fbc'), ua: navigator.userAgent || '' };
    var where = lead.address + ', ' + lead.postcode;

    if(window.sendLead){
      window.sendLead({
        type: 'Quote form', source: 'quiz step 4',
        name: lead.name, phone: lead.phone, email: lead.email,
        postcode: where, service: lead.service || '', details: lead.urgency || '',
        event_id: meta.event_id, fbp: meta.fbp, fbc: meta.fbc, ua: meta.ua
      });
    }
    postGHL({
      name: lead.name, phone: lead.phone, email: lead.email,
      address: lead.address, postcode: lead.postcode,
      service: lead.service || '', urgency: lead.urgency || '',
      message: 'Free roof inspection request. Timing: ' + (lead.urgency || '-') + '. Property: ' + where,
      page: location.href, referrer: document.referrer,
      event_id: meta.event_id, fbp: meta.fbp, fbc: meta.fbc, ua: meta.ua,
      company_website: ''
    });
    track('Lead', { content_name: 'Quote funnel', job: lead.service || '', urgency: lead.urgency || '' }, lead.eventId);
  }

  if(ghlCalendar()){
    el('bookSub').textContent = 'Thanks ' + lead.name.split(' ')[0] + '. Pick a time below for your free inspection.';
    goStep('5', true);
    initBooking();
  } else {
    showDone(false);
  }
});

var bookingInited = false;
function initBooking(){
  if(bookingInited) return;
  var id = ghlCalendar(), box = el('ghlBooking');
  if(!id || !box) return;
  bookingInited = true;
  var parts = lead.name.split(/\s+/);
  var qs = new URLSearchParams({
    first_name: parts[0] || '', last_name: parts.slice(1).join(' '),
    phone: lead.phone || '', email: lead.email || ''
  });
  var f = document.createElement('iframe');
  f.src = 'https://api.leadconnectorhq.com/widget/booking/' + encodeURIComponent(id) + '?' + qs.toString();
  f.id = id + '_' + Date.now();
  f.title = 'Book your free roof inspection';
  f.setAttribute('scrolling', 'no');
  box.appendChild(f);

  var s = document.createElement('script');
  s.src = 'https://link.msgsndr.com/js/form_embed.js';
  s.async = true;
  document.body.appendChild(s);
}

var GHL_HOST = /^https:\/\/([a-z0-9-]+\.)*(leadconnectorhq\.com|msgsndr\.com)$/;
var BOOKED = /booking[-_ ]?(success|confirmed|complete|booked)|appointment[-_ ]?(booked|scheduled|created)|calendar[-_ ]?booked/i;
window.addEventListener('message', function(e){
  if(!GHL_HOST.test(e.origin) && !(window.ASAP_LEADTEST && e.origin === location.origin)) return;
  var txt = ''; try{ txt = typeof e.data === 'string' ? e.data : JSON.stringify(e.data); }catch(x){}
  if(!BOOKED.test(txt) || !lead.name) return;
  showDone(true);
});
el('skipBook').addEventListener('click', function(e){ e.preventDefault(); showDone(false, true); });

function waLink(booked){
  var lines = ["Hi ASAP, I'd like a free roofing quote" + (booked ? ' (home visit booked on the website).' : '.'), '',
    'Name: ' + (lead.name || '-'), 'Phone: ' + (lead.phone || '-')];
  if(lead.address) lines.push('Address: ' + lead.address + ', ' + (lead.postcode || ''));
  if(lead.email) lines.push('Email: ' + lead.email);
  lines.push('Job: ' + (lead.service || '-'));
  if(lead.urgency) lines.push('Timing: ' + lead.urgency);
  return 'https://wa.me/447865989617?text=' + encodeURIComponent(lines.join('\n'));
}

var doneShown = false;
function showDone(booked, skipped){
  if(doneShown && !booked) return;
  doneShown = true;
  goStep('done', true);
  progressBar.style.width = '100%';
  var row = { name: lead.name, phone: lead.phone, email: lead.email,
    postcode: (lead.address || '') + ', ' + (lead.postcode || ''), service: lead.service || '', details: lead.urgency || '' };
  if(booked){
    track('booking_confirmed', { job: lead.service || '' });
    if(window.sendLead){ row.type = 'Booking confirmed'; row.source = 'ghl calendar'; window.sendLead(row); }
  } else {
    track('enquiry_sent', { job: lead.service || '' });
    if(skipped && window.sendLead){ row.type = 'Callback request'; row.source = 'skipped calendar'; window.sendLead(row); }
  }
  var fn = lead.name ? lead.name.split(' ')[0] : 'there';
  el('doneHead').textContent = booked ? 'Booking Confirmed' : 'Request Sent';
  el('doneMsg').textContent = booked
    ? 'Thanks ' + fn + ', your free inspection is in the diary. You will get a confirmation shortly.'
    : 'Thanks ' + fn + ', we have your details. Levi will ring you shortly to arrange your free inspection.';
  el('doneSummary').innerHTML =
    '<b>Name:</b> ' + esc(lead.name || '-') + '<br><b>Phone:</b> ' + esc(lead.phone || '-') +
    '<br><b>Job:</b> ' + esc(lead.service || 'Roofing quote') +
    (lead.postcode ? '<br><b>Where:</b> ' + esc(lead.address || '') + ', ' + esc(lead.postcode) : '');
  var wa = el('waConfirm');
  wa.href = waLink(booked);
}

}

var REVIEWS = [
  { text:'Had some essential roof maintenance done with a few added extras. Quoted the same day. The price was definitely the best of the quotes I had. The lads who did the job were hard working, polite and kept me posted on progress. Photos received to prove the work that was done too. Would definitely recommend!', name:'Dulcie Bridge' },
  { text:'I would like to say a great big thank you to Sean from ASAP property maintenance LTD. After other companies not turning up and some extortionate quotes, I lost confidence in using people advertising on Facebook. But this company kept popping up quite a lot in my feed and I checked out some of the reviews then thought I will give one last try. I got the quote one day and they were here and sorted out my problem at a decent price the next day. Thank you so much for restoring my faith. I would definitely recommend them.', name:'Margaret Elizbeth' },
  { text:'Had my chimney repointed by ASAP Property Maintenance LTD last week. Got booked in quickly and they did a fantastic job for a great price. No hard sell or pressure at all. Would recommend!', name:'Dexter Phillips' },
  { text:'Had the front of our house done today. Delighted with the work. Very polite and professional. Work looks brilliant. 100 per cent hire them again and also super fast from message to work done. Thanks guys', name:'Sharon Phelan' },
  { text:'100% recommend done fantastic work on my new roof', name:'Monika Bowring' },
  { text:'Very professional company, would definitely recommend, work is of the highest standard and completed on time.', name:'Kris Sweeney' },
  { text:'Had some roof repairs carried out yesterday. Sean and James were great! I would definitely recommend this company for a professional and fast service.', name:'Sue Murphy' },
  { text:'Contacted the guys, and within a week they had been and replaced my gutter. Reasonably priced. Good work and efficient. Would definitely use them again.', name:'Marian Hughes' }
];

(function initSlider(){
  var track_ = document.getElementById('revTrack');
  var dotsWrap = document.getElementById('revDots');
  var view = document.getElementById('revView');
  if(!track_ || !dotsWrap || !view || !REVIEWS.length) return;
  var FB = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';
  var THUMB = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>';

  track_.innerHTML = REVIEWS.map(function(r){
    return '<div class="rev-cell"><article class="rev-card">' +
      '<div class="rev-top"><div class="rev-av">' + FB + '</div>' +
      '<div class="rev-who"><b>' + esc(r.name) + '</b><span>Facebook recommendation</span></div></div>' +
      '<div class="rev-rec">' + THUMB + 'Recommends ASAP</div>' +
      '<div class="rev-body"><p data-verbatim>' + esc(r.text) + '</p><button type="button" class="rev-more" hidden>Read more</button></div>' +
      '<div class="rev-foot">Recommended on Facebook</div>' +
    '</article></div>';
  }).join('');

  function clampCheck(){
    Array.prototype.forEach.call(track_.querySelectorAll('.rev-card'), function(card){
      if(card.classList.contains('open')) return;
      var p = card.querySelector('.rev-body p');
      card.querySelector('.rev-more').hidden = p.scrollHeight <= p.clientHeight + 2;
    });
  }
  track_.addEventListener('click', function(e){
    var b = e.target.closest('.rev-more');
    if(!b) return;
    var open = b.closest('.rev-card').classList.toggle('open');
    b.textContent = open ? 'Show less' : 'Read more';
  });

  function perView(){ return window.innerWidth <= 680 ? 1 : (window.innerWidth <= 1024 ? 2 : 3); }
  var pv = perView(), page = 0, timer = null;
  function pages(){ return Math.max(1, Math.ceil(REVIEWS.length / pv)); }
  function buildDots(){
    dotsWrap.innerHTML = '';
    for(var i = 0; i < pages(); i++){
      (function(i){
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Reviews page ' + (i + 1));
        b.addEventListener('click', function(){ go(i); reset(); });
        dotsWrap.appendChild(b);
      })(i);
    }
  }
  function go(n){
    var pc = pages();
    page = (n + pc) % pc;
    track_.style.transform = 'translateX(-' + (page * 100) + '%)';
    Array.prototype.forEach.call(dotsWrap.children, function(b, k){ b.classList.toggle('active', k === page); });
  }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }
  function reset(){ stop(); timer = setInterval(function(){ go(page + 1); }, 6500); }

  buildDots(); go(0); reset(); clampCheck();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(clampCheck);
  view.addEventListener('mouseenter', stop);
  view.addEventListener('mouseleave', reset);
  document.getElementById('revPrev').addEventListener('click', function(){ go(page - 1); reset(); });
  document.getElementById('revNext').addEventListener('click', function(){ go(page + 1); reset(); });
  var sx = 0, sy = 0;
  view.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, {passive:true});
  view.addEventListener('touchend', function(e){
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if(Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)){ go(page + (dx < 0 ? 1 : -1)); reset(); }
  }, {passive:true});
  window.addEventListener('resize', function(){
    clampCheck();
    var n = perView();
    if(n !== pv){ pv = n; buildDots(); go(0); reset(); }
  });
  document.addEventListener('visibilitychange', function(){ if(document.hidden) stop(); else reset(); });
})();

})();
