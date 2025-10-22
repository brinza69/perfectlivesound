/* ========================================================================
   Helpers
   ======================================================================== */
const $  = (s, c=document) => c.querySelector(s);
const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));

/* ========================================================================
   1) Active nav (automat) – culoare/underline, fără „salt” de font-weight
   ======================================================================== */
(() => {
  const links = $$('.menu a[href]');
  if (!links.length) return;
  let path = location.pathname.split('/').pop() || 'index.html';
  links.forEach(a => {
    const href = a.getAttribute('href').replace(/^\.\//,'');
    if (href === path) { a.classList.add('is-active'); a.setAttribute('aria-current','page'); }
    else { a.classList.remove('is-active'); a.removeAttribute('aria-current'); }
  });
})();

/* ========================================================================
   Mobile menu – burger + flyout + CTA în meniu pe mobil
   ======================================================================== */
(function mobileMenu(){
  const $  = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));

  const burger = $('.burger');
  const menu   = $('.menu');
  if(!burger || !menu) return;

  const ensureMobileCTA = () => {
    if (!$('#mobileCTA', menu)) {
      const a = document.createElement('a');
      a.id = 'mobileCTA';
      a.href = 'contact.html';
      a.className = 'btn cta';
      a.textContent = 'Solicită ofertă';
      menu.appendChild(a);
    }
  };

  const removeMobileCTA = () => {
    const a = $('#mobileCTA', menu);
    if (a) a.remove();
  };

  const closeMenu = () => {
    menu.classList.remove('flyout');
    burger.setAttribute('aria-expanded','false');
    document.body.classList.remove('nav-open');
  };

  burger.addEventListener('click', ()=>{
    const open = menu.classList.toggle('flyout');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('nav-open', open);
    if (open) ensureMobileCTA();
  });

  document.addEventListener('click', e=>{
    if(menu.classList.contains('flyout') && !e.target.closest('.nav')) closeMenu();
  });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeMenu(); });

  // când revii pe desktop -> închide și elimină CTA-ul injectat
  const mq = window.matchMedia('(min-width: 981px)');
  const onMQ = e => { if (e.matches) { closeMenu(); removeMobileCTA(); } };
  if (mq.addEventListener) mq.addEventListener('change', onMQ);
  else mq.addListener(onMQ);

  // sincronează starea la încărcare (utile când Comuți în DevTools fără reload)
  const sync = () => {
    if (mq.matches) { closeMenu(); removeMobileCTA(); }
  };
  sync();

  // bonus: dacă redimensionezi fereastra cu mouse-ul, păstrează starea curată
  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(sync, 120);
  });
})();

/* ========================================================================
   3) Section reveal (seamless)
   ======================================================================== */
(() => {
  const candidates = $$('.services, .testimonials, .page-hero, .contact-only, .gallery-preview, .grid-gallery');
  candidates.forEach(el => { if(!el.hasAttribute('data-animate')) el.setAttribute('data-animate',''); });

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    });
  }, { rootMargin:'-10% 0px -10% 0px', threshold:0.12 });

  $$('[data-animate]').forEach(el => io.observe(el));
})();

/* ========================================================================
   4) Galerie: filtre Toate/Imagini/Video + fadeUp
   ======================================================================== */
(() => {
  const groups = $$('.filters');
  if(!groups.length) return;

  const findGridFor = (filtersEl) => {
    let p = filtersEl.parentElement;
    while(p && !$('.grid-gallery', p)) p = p.parentElement;
    return p ? $('.grid-gallery', p) : $('.grid-gallery'); // fallback
  };

  groups.forEach(group => {
    const grid = findGridFor(group);
    if(!grid) return;

    group.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if(!btn) return;

      group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');

      const val = btn.getAttribute('data-filter'); // all | image | video
      const tiles = $$('.tile', grid);

      tiles.forEach(tile => {
        const show = (val === 'all') || tile.classList.contains(val);
        if(show){ tile.style.display=''; tile.style.animation='fadeUp .35s ease both'; }
        else    { tile.style.display='none'; tile.style.animation=''; }
      });
    });
  });
})();

/* ========================================================================
   5) Lightbox video (pe linkuri embed YouTube/Vimeo)
   ======================================================================== */
/* ========================================================================
   Lightbox unificat (IMAGINE + VIDEO)
   - click pe .tile.image: deschide imagine (href || data-full || img.src)
   - click pe .tile.video: deschide embed (YouTube/Vimeo)
   - suport: next/prev, ESC, click pe fundal, swipe pe mobil
   ======================================================================== */
(() => {
  const grids = $$('.grid-gallery');           // fiecare galerie gestionează propriile item-uri
  if(!grids.length) return;

  // backdrop comun
  let backdrop = $('.lightbox-backdrop');
  if(!backdrop){
    backdrop = document.createElement('div');
    backdrop.className = 'lightbox-backdrop';
    backdrop.innerHTML = `
      <div class="lightbox-shell" role="dialog" aria-modal="true" aria-label="Previzualizare media">
        <button class="lb-close" aria-label="Închide">&times;</button>
        <button class="lb-prev" aria-label="Înapoi">&#10094;</button>
        <button class="lb-next" aria-label="Înainte">&#10095;</button>
        <div class="lb-count" aria-hidden="true"></div>
      </div>`;
    document.body.appendChild(backdrop);
  }
  const shell = $('.lightbox-shell', backdrop);
  const btnClose = $('.lb-close', shell);
  const btnPrev  = $('.lb-prev', shell);
  const btnNext  = $('.lb-next', shell);
  const badge    = $('.lb-count', shell);

  let items = [];       // [{type:'image'|'video', url, gridIndex}]
  let index = 0;

  function getItemsFromGrid(grid){
    // extrage numai elementele vizibile (display != 'none') ca să respecte filtrele
    return $$('.tile', grid)
      .filter(el => (getComputedStyle(el).display !== 'none'))
      .map(el => {
        const isVideo = el.classList.contains('video');
        if(isVideo){
          return { type:'video', url: el.getAttribute('href'), el };
        }else{
          const a = el;                       // <a class="tile image">
          const img = $('img', a);
          const big = a.getAttribute('data-full') || a.getAttribute('href') || (img ? img.src : '');
          return { type:'image', url: big, el };
        }
      });
  }

  function render() {
    // șterge media existentă
    const old = $('.lightbox-media', shell);
    if(old) old.remove();

    const cur = items[index];
    if(!cur) return;

    let node;
    if(cur.type === 'video'){
      node = document.createElement('iframe');
      node.className = 'lightbox-media';
      node.allow = 'autoplay; encrypted-media';
      node.allowFullscreen = true;
      node.src = cur.url;
      node.title = 'Video';
    } else {
      node = document.createElement('img');
      node.className = 'lightbox-media';
      node.alt = 'Imagine';
      node.src = cur.url;
    }
    shell.appendChild(node);
    badge.textContent = `${index+1} / ${items.length}`;
  }

  function open(grid, startEl){
    items = getItemsFromGrid(grid);
    index = Math.max(0, items.findIndex(i => i.el === startEl));
    if(items.length === 0) return;

    render();
    backdrop.classList.add('active');
    document.body.classList.add('nav-open');  // blochează scrollul din spate
  }

  function close(){
    backdrop.classList.remove('active');
    document.body.classList.remove('nav-open');
    const media = $('.lightbox-media', shell);
    if(media){ media.remove(); }              // oprește video/curăță imaginea
  }

  function prev(){ index = (index-1 + items.length) % items.length; render(); }
  function next(){ index = (index+1) % items.length; render(); }

  // Evenimente globale
  btnClose.addEventListener('click', close);
  btnPrev .addEventListener('click', prev);
  btnNext .addEventListener('click', next);
  backdrop.addEventListener('click', e => { if(!e.target.closest('.lightbox-shell')) close(); });
  document.addEventListener('keydown', e => {
    if(!backdrop.classList.contains('active')) return;
    if(e.key === 'Escape') close();
    if(e.key === 'ArrowLeft') prev();
    if(e.key === 'ArrowRight') next();
  });

  // Swipe (mobil)
  let sx=0, sy=0;
  shell.addEventListener('touchstart', e => { const t=e.touches[0]; sx=t.clientX; sy=t.clientY; }, {passive:true});
  shell.addEventListener('touchend', e => {
    if(!sx && !sy) return;
    const t=e.changedTouches[0]; const dx=t.clientX - sx; const dy=t.clientY - sy;
    if(Math.abs(dx) > 40 && Math.abs(dy) < 60) (dx>0 ? prev() : next());
    sx=sy=0;
  });

  // Click pe iteme din fiecare grilă
  grids.forEach(grid => {
    grid.addEventListener('click', e => {
      const a = e.target.closest('.tile');
      if(!a) return;

      // tipul
      const isVideo = a.classList.contains('video');
      const isImage = a.classList.contains('image');

      // Determină URL (pentru imagini preferă data-full || href || img.src)
      if(isVideo){
        const href = a.getAttribute('href') || '';
        if(!/youtube|vimeo|embed/i.test(href)) return;  // lăsăm linkurile non-embed
        e.preventDefault();
        open(grid, a);
      } else if(isImage){
        e.preventDefault();
        open(grid, a);
      }
    });
  });
})();
