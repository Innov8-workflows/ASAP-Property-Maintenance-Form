
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
setupVideo(heroVideo, 'assets/hero.mp4');
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
  if(!track_ || !REVIEWS.length) return;
  var fb = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#1877F2" aria-hidden="true"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>';
  var initials = function(n){ return n.split(/[\s.]+/).filter(Boolean).slice(0,2).map(function(w){ return w[0]; }).join('').toUpperCase(); };

  track_.innerHTML = REVIEWS.map(function(r){
    return '<div class="rev-card"><div class="rev-card-inner">' +
      '<span class="rev-rec">' + fb + 'Recommends ASAP</span>' +
      '<p>' + esc(r.text) + '</p>' +
      '<div class="rev-author"><span class="rev-avatar">' + esc(initials(r.name)) + '</span>' +
      '<div class="rev-author-meta"><strong>' + esc(r.name) + '</strong><span>Facebook review</span></div></div>' +
    '</div></div>';
  }).join('');

  dotsWrap.innerHTML = REVIEWS.map(function(_, i){ return '<button class="rev-dot' + (i === 0 ? ' active' : '') + '" data-i="' + i + '" aria-label="Go to review ' + (i + 1) + '"></button>'; }).join('');
  var dots = Array.prototype.slice.call(dotsWrap.children);

  var cur = 0, timer = null;
  function show(i){
    cur = (i + REVIEWS.length) % REVIEWS.length;
    track_.style.transform = 'translateX(-' + (cur * 100) + '%)';
    dots.forEach(function(d, n){ d.classList.toggle('active', n === cur); });
  }
  function next(){ show(cur + 1); }
  function prev(){ show(cur - 1); }
  function play(){ stop(); timer = setInterval(next, 6500); }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }

  document.getElementById('revNext').addEventListener('click', function(){ next(); play(); });
  document.getElementById('revPrev').addEventListener('click', function(){ prev(); play(); });
  dots.forEach(function(d){ d.addEventListener('click', function(){ show(+d.getAttribute('data-i')); play(); }); });

  var slider = document.getElementById('revSlider');
  slider.addEventListener('mouseenter', stop);
  slider.addEventListener('mouseleave', play);
  var x0 = null;
  slider.addEventListener('touchstart', function(e){ x0 = e.touches[0].clientX; stop(); }, {passive:true});
  slider.addEventListener('touchend', function(e){
    if(x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if(Math.abs(dx) > 40){ if(dx < 0) next(); else prev(); }
    x0 = null; play();
  }, {passive:true});

  show(0); play();
})();

})();
