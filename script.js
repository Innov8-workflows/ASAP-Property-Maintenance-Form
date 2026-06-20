/* ===== ASAP Property Maintenance — Ad Landing Page ===== */
(function(){
'use strict';

document.getElementById('yr').textContent = new Date().getFullYear();

/* ---------- LAZY BACKGROUND VIDEOS ---------- */
function setupVideo(v, src){
  if(!v) return;
  const start = () => {
    if(!v.getAttribute('src')){ v.src = src; v.muted = true; v.defaultMuted = true; v.load(); }
    const p = v.play(); if(p && p.catch) p.catch(()=>{});
  };
  if('IntersectionObserver' in window){
    new IntersectionObserver(es => es.forEach(e => {
      if(e.isIntersecting) start();
      else if(v.getAttribute('src')) v.pause();
    }), {threshold:.15}).observe(v);
  } else { start(); }
}
const heroVideo = document.getElementById('heroVideo');
const baVideo   = document.getElementById('baVideo');
setupVideo(heroVideo, 'assets/hero.mp4');
setupVideo(baVideo,   'assets/ba.mp4');
document.addEventListener('touchstart', () => {
  if(heroVideo){ const p = heroVideo.play(); if(p && p.catch) p.catch(()=>{}); }
}, {once:true, passive:true});

/* ---------- MULTI-STEP QUIZ ---------- */
const lead = {};
const STEPS = ['1','2','3','4','5'];           // numbered steps (drive the progress bar)
const quiz = document.getElementById('quiz');
const progressBar = document.getElementById('progressBar');

function currentStep(){ const a = document.querySelector('.quiz-step.active'); return a ? a.dataset.step : '1'; }

function goStep(key, scroll){
  document.querySelectorAll('.quiz-step').forEach(s => s.classList.toggle('active', s.dataset.step === key));
  const i = STEPS.indexOf(key);
  progressBar.style.width = (i >= 0 ? ((i + 1) / STEPS.length) * 100 : 100) + '%';
  if(scroll){ quiz.scrollIntoView({behavior:'smooth', block:'start'}); }
}
function advance(){ const i = STEPS.indexOf(currentStep()); if(i > -1 && i < STEPS.length - 1) goStep(STEPS[i + 1], false); }
function back(){ const i = STEPS.indexOf(currentStep()); if(i > 0) goStep(STEPS[i - 1], false); }

document.querySelectorAll('.quiz-back').forEach(b => b.addEventListener('click', back));

// option cards / rows — capture answer, then auto-advance
document.querySelectorAll('.opt, .opt-row').forEach(btn => {
  btn.addEventListener('click', () => {
    lead[btn.dataset.field] = btn.dataset.val;
    document.querySelectorAll('[data-field="'+btn.dataset.field+'"]').forEach(x => x.classList.remove('sel'));
    btn.classList.add('sel');
    setTimeout(advance, 160);
  });
});

const val = id => (document.getElementById(id).value || '').trim();

// step 3 — postcode
document.querySelector('[data-step="3"] .q-next').addEventListener('click', () => {
  const pc = document.getElementById('leadPostcode');
  if(!pc.value.trim()){ pc.classList.add('err'); pc.focus(); return; }
  pc.classList.remove('err'); lead.postcode = val('leadPostcode'); advance();
});

// step 4 — contact → reveal booking
document.getElementById('toBooking').addEventListener('click', () => {
  const name = document.getElementById('leadName'), phone = document.getElementById('leadPhone');
  let ok = true;
  [name, phone].forEach(f => { if(!f.value.trim()){ f.classList.add('err'); ok = false; } else f.classList.remove('err'); });
  if(!ok){ (name.value.trim() ? phone : name).focus(); return; }
  lead.name = val('leadName'); lead.phone = val('leadPhone'); lead.email = val('leadEmail');
  // Meta conversion: real lead captured (contact details submitted). Guarded so it fires once.
  if(window.fbq && !lead._tracked){ fbq('track', 'Lead'); lead._tracked = true; }
  document.getElementById('bookSub').textContent = 'Almost there, ' + lead.name.split(' ')[0] + ' — pick a time below.';
  goStep('5', true);
  initCalendly();
});

/* ---------- LIVE CALENDLY BOOKING ---------- */
// To change the booking link later, edit CALENDLY_URL below.
const CALENDLY_URL = 'https://calendly.com/leviprice/30min';
let calendlyInited = false;
function initCalendly(){
  if(calendlyInited) return;
  const el = document.getElementById('calendlyEmbed');
  let tries = 0;
  (function go(){
    if(window.Calendly && el){
      try{
        Calendly.initInlineWidget({
          url: CALENDLY_URL,
          parentElement: el,
          prefill: {
            name: lead.name || '',
            email: lead.email || '',
            customAnswers: { a1: lead.phone || '', a2: [lead.service, lead.urgency, lead.postcode].filter(Boolean).join(' · ') }
          }
        });
        calendlyInited = true;
      } catch(e){ showFallback(); }
    } else if(tries++ < 25){ setTimeout(go, 300); }
    else { showFallback(); }
  })();
}
function showFallback(){
  document.getElementById('calendlyEmbed').hidden = true;
  document.getElementById('calendlyFallback').hidden = false;
}

// customer completes a Calendly booking
window.addEventListener('message', function(e){
  if(e.data && typeof e.data.event === 'string' && e.data.event === 'calendly.event_scheduled'){ showDone(true); }
});
document.getElementById('skipBook').addEventListener('click', function(e){ e.preventDefault(); showDone(false); });

function waLink(booked){
  let t = "Hi ASAP — I'd like a free roofing quote";
  t += booked ? ' (home visit booked via the website).' : ' / callback.';
  t += '%0A%0A*Name:* ' + (lead.name || '-');
  t += '%0A*Phone:* ' + (lead.phone || '-');
  if(lead.postcode) t += '%0A*Postcode:* ' + lead.postcode;
  if(lead.email)    t += '%0A*Email:* ' + lead.email;
  t += '%0A*Service:* ' + (lead.service || '-');
  if(lead.urgency)  t += '%0A*Timing:* ' + lead.urgency;
  return 'https://wa.me/447865989617?text=' + t;
}

function showDone(booked){
  goStep('done', true);
  progressBar.style.width = '100%';
  var fn = lead.name ? lead.name.split(' ')[0] : 'there';
  document.getElementById('doneHead').textContent = booked ? 'Booking Confirmed!' : 'Request Sent!';
  document.getElementById('doneMsg').textContent = booked
    ? 'Thanks ' + fn + '! Your home visit is in the diary — ASAP will be in touch to confirm the details.'
    : 'Thanks ' + fn + "! We've got your enquiry and will call you back shortly to arrange a time.";
  document.getElementById('doneSummary').innerHTML =
    '<b>Name:</b> ' + (lead.name || '-') + '<br><b>Phone:</b> ' + (lead.phone || '-') +
    '<br><b>For:</b> ' + (lead.service || 'Roofing quote') + (lead.postcode ? ' · ' + lead.postcode : '');
  var wa = document.getElementById('waConfirm');
  wa.href = waLink(booked);
  wa.textContent = booked ? 'Send ASAP your job details' : 'Send my enquiry on WhatsApp';
}

/* ---------- REVIEWS SLIDER ---------- */
// Real reviews from facebook.com/ASAPpropertymaintenance1/mentions.
// `location` holds the review date (FB mentions don't expose the customer's town).
const REVIEW_COUNT = null; // set to a number once the real FB recommendation total is confirmed
const REVIEWS = [
  { stars:5, title:'Best price of all my quotes', text:'Had some essential roof maintenance done with a few added extras. Quoted the same day. The price was definitely the best of the quotes I had. The lads who did the job were hard working, polite and kept me posted on progress. Photos received to prove the work that was done too. Would definitely recommend!', name:'Dulcie Bridge', location:'April 2026' },
  { stars:5, title:'Delighted with the work', text:'Had the front of our house done today. Delighted with the work. Very polite and professional. Work looks brilliant. 100 per cent hire them again and also super fast from message to work done. Thanks guys.', name:'Sharon Phelan', location:'February 2026' },
  { stars:5, title:'Sean and James were great!', text:'Had some roof repairs carried out yesterday. Sean and James were great! I would definitely recommend this company for a professional and fast service.', name:'Sue Murphy', location:'April 2026' },
  { stars:5, title:'Highest standard, completed on time', text:'Very professional company, would definitely recommend. Work is of the highest standard and completed on time.', name:'Kris Sweeney', location:'February 2026' },
  { stars:5, title:'Quick and efficient', text:'Contacted the guys, and within a week they had been and replaced my gutter. Reasonably priced. Good work and efficient. Would definitely use them again.', name:'Marian Hughes', location:'March 2026' },
];

(function initSlider(){
  const track = document.getElementById('revTrack');
  const dotsWrap = document.getElementById('revDots');
  if(!track || !REVIEWS.length) return;

  // optional review counts
  if(REVIEW_COUNT){
    var rc = document.getElementById('reviewCount'); if(rc) rc.textContent = 'Based on ' + REVIEW_COUNT + '+ reviews';
    var rsc = document.getElementById('revSummaryCount'); if(rsc) rsc.textContent = 'Based on ' + REVIEW_COUNT + '+ Facebook reviews';
  }

  const fbSvg = '<svg class="rev-source" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"/></svg>';
  const initials = n => n.split(/[\s.]+/).filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase();

  track.innerHTML = REVIEWS.map(r => (
    '<div class="rev-card"><div class="rev-card-inner">' +
      '<div class="rev-card-stars">' + '★'.repeat(r.stars) + '</div>' +
      '<h4>' + r.title + '</h4>' +
      '<p>' + r.text + '</p>' +
      '<div class="rev-author">' +
        '<span class="rev-avatar">' + initials(r.name) + '</span>' +
        '<div class="rev-author-meta"><strong>' + r.name + '</strong><span>' + r.location + '</span></div>' +
        fbSvg +
      '</div>' +
    '</div></div>'
  )).join('');

  dotsWrap.innerHTML = REVIEWS.map((_, i) => '<button class="rev-dot' + (i===0?' active':'') + '" data-i="' + i + '" aria-label="Go to review ' + (i+1) + '"></button>').join('');
  const dots = Array.from(dotsWrap.children);

  let cur = 0, timer = null;
  function show(i){
    cur = (i + REVIEWS.length) % REVIEWS.length;
    track.style.transform = 'translateX(-' + (cur * 100) + '%)';
    dots.forEach((d, n) => d.classList.toggle('active', n === cur));
  }
  function next(){ show(cur + 1); }
  function prev(){ show(cur - 1); }
  function play(){ stop(); timer = setInterval(next, 5500); }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }

  document.getElementById('revNext').addEventListener('click', () => { next(); play(); });
  document.getElementById('revPrev').addEventListener('click', () => { prev(); play(); });
  dots.forEach(d => d.addEventListener('click', () => { show(+d.dataset.i); play(); }));

  const slider = document.getElementById('revSlider');
  slider.addEventListener('mouseenter', stop);
  slider.addEventListener('mouseleave', play);

  // touch swipe
  let x0 = null;
  slider.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; stop(); }, {passive:true});
  slider.addEventListener('touchend', e => {
    if(x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if(Math.abs(dx) > 40){ dx < 0 ? next() : prev(); }
    x0 = null; play();
  }, {passive:true});

  show(0); play();
})();

})();
