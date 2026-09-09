/*
 * Camera portfolio — a looping 1-D canvas ring.
 *
 * The canvases sit on a ring, in this order, wrapping around:
 *
 *      ... Photography -- Home -- Work -- Notes -- Photography ...
 *
 * `pos` is the continuous ring position the screen is centred on (an integer
 * centres that canvas). Panning moves `pos` along the ring by the SHORTEST way
 * round, so it loops seamlessly. For each canvas we compute `ringRel` — its
 * signed distance from `pos` in (-N/2, N/2] — and place it from there:
 *   rel 0  = centred, the full open page;
 *   rel ±1 = the two neighbours, peeking as logos at the left / right edges;
 *   |rel| ≥ 2 = off-screen (fades as it wraps around the far side).
 *
 * The centred canvas's marker docks into the nav on scroll. Tapping a neighbour
 * pans to it, horizontal gestures move around the ring, and Back/Escape returns
 * Home.
 *
 * To add a canvas: add a row to CANVASES, insert its id into ORDER, add its
 * <section> + marker + title-entry elements. No layout maths change.
 */
(()=>{
 // Tunable timings and sizes (durations in ms).
 const GO_MS_PER_UNIT=1500;          // slide speed, per ring step
 const HOME_STATE_MS_PER_UNIT=120;   // Home-logo expand / collapse speed
 const SCROLL_TOP_MIN=500,SCROLL_TOP_MAX=1200,SCROLL_TOP_FACTOR=.65; // return-to-top
 const GAP=32;                       // breathing room below a marker before the nav
 const DOCK_H=44;                    // height of the dock (the title bar)
 const DOCK_FS=18;                   // title font size in the dock
 const TITLE_BIG_FACTOR=.16,TITLE_BIG_MIN=30,TITLE_BIG_MAX=64; // title size under the logo
 const COLLAPSE_DIST=320;            // px of scroll to fully collapse/expand (scroll-paced)
 const TRANSITION_DELTA_MAX=42;       // cap a single wheel jump so mouse expansion stays readable
 const TRANSITION_SETTLE_MS=650;      // pause before an incomplete transition snaps back
 const TRANSITION_COMMIT_EXPANSION=.25; // crossed transitions finish detail entry on idle
 const TRANSITION_COOLDOWN_MS=420;      // ignore queued wheel input after a snap settles
 const COLLAPSE_DOCK_FRAC=1;         // title reaches the dock exactly as the logo finishes shrinking (in sync)
 const SCROLL_BUFFER=90;             // px the logo/title hold at full before docking (register the detail view)
 const TOUCH_INTENT=8;               // px before a touch gesture chooses an axis
 const SWIPE_DRAG_FRACTION=.4;        // viewport fraction of horizontal drag for a full handoff
 const SWIPE_DRAG_MAX=520;            // keep very wide desktop gestures within a usable range
 const SWIPE_COMMIT_PROGRESS=.7;      // complete a horizontal swipe after 70% travel
 const SWIPE_COLLAPSE_SHARE=.5;       // first part of a swipe collapses the current canvas
 const SWIPE_HANDOFF_MS=360;         // shared detail-to-ring handoff before a pan
 const SWIPE_TEXT_DELAY_MS=180;       // reveal content shortly after the ring settles
 const DESKTOP_SWIPE_SETTLE_MS=280;   // idle time that ends a horizontal wheel gesture
 const PAN_SPLIT=.65;                // fraction of a slide spent opening the lens
 const EXPANDED=.5;                  // expansion above this counts as "expanded"
 const PEEK_SCALE=.6;                // neighbour logo size relative to the centred one
 const LOGO_FONT_FACTOR=.115,LOGO_FONT_MIN=16,LOGO_FONT_MAX=48;
 const LOGO_MIN=120,LOGO_MAX=420,CONTENT_MIN=720,MOBILE_FLOOR=480,CAMERA_RATIO=1250/2048;

 // Elements.
 const root=document.getElementById('camera-portfolio');
 const track=root.querySelector('.track');
 const camera=root.querySelector('.camera');
 const entry=root.querySelector('.entry');
 const back=root.querySelector('.back');
 const home=root.querySelector('.home');
 const photos=root.querySelector('.photos');
 const status=root.querySelector('.status');
 const viewport=root.querySelector('.viewport');
 const brand=root.querySelector('.page-brand');
 const gallery=root.querySelector('.gallery');
 const photosHeader=photos.querySelector('header');
 const homeLogo=root.querySelector('.home-logo');
 const homeContent=root.querySelector('.home-content');
 const work=root.querySelector('.work');
 const workLogo=root.querySelector('.work-logo');
 const workEntry=root.querySelector('.work-entry');
 const workBack=root.querySelector('.work-back');
 const workContent=root.querySelector('.work-content');
 const notes=root.querySelector('.notes');
 const notesLogo=root.querySelector('.notes-logo');
 const notesEntry=root.querySelector('.notes-entry');
 const notesBack=root.querySelector('.notes-back');
 const notesContent=root.querySelector('.notes-content');
 const homeEntry=root.querySelector('.home-entry');
 const canvasDock=root.querySelector('.canvas-dock');
 const canvasWatermark=root.querySelector('.canvas-watermark');
 const canvasWatermarkItems=Array.from(canvasWatermark.querySelectorAll('.canvas-watermark-list span'));
 const canvasDots=root.querySelector('.canvas-dots');
 const canvasDotItems=Array.from(root.querySelectorAll('.canvas-dots i'));   // one per canvas, in ring-index order
 const canvasNavMenu=root.querySelector('.menu-toggle');
 const ctx=root.querySelector('.cover').getContext('2d');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');

 // Every canvas as data. `kind` selects marker rendering: 'hub' (compact,
 // expandable), 'camera' (image + lens, scaled via transform), 'spoke' (a plain
 // logo box). ORDER defines the ring; each canvas's index is its ring slot.
 const CANVASES={
  home:  {id:'home',   title:'Home',        sections:['About me','Selected notes','Things happening','More'], hash:'',              kind:'hub',    el:home,   marker:homeLogo,  entry:homeEntry, content:homeContent, ready:'Home Canvas'},
  photos:{id:'photos', title:'Photography', sections:['Visual studies','Selected work','Quiet observations','Photo archive'], hash:'#photography',  kind:'camera', el:photos, marker:camera,   entry:entry,      back:back,     content:gallery,      openLabel:'Open Photography Canvas', returnLabel:'Return to Home Canvas', opening:'Opening Photography Canvas', ready:'Photography. Scroll to explore.'},
  work:  {id:'work',   title:'Work',       sections:['Projects','Experiments','Things in progress','Collaborations'], hash:'#work',         kind:'spoke',  el:work,   marker:workLogo,  entry:workEntry,  back:workBack, content:workContent,  openLabel:'Open Work Canvas',   returnLabel:'Return to Home Canvas', opening:'Opening Work Canvas',   ready:'Work Canvas'},
  notes: {id:'notes',  title:'Notes',      sections:['Fragments','Questions','Things to return to','Loose ends'], hash:'#notes',        kind:'spoke',  el:notes,  marker:notesLogo, entry:notesEntry, back:notesBack,content:notesContent, openLabel:'Open Notes Canvas',  returnLabel:'Return to Home Canvas', opening:'Opening Notes Canvas',  ready:'Notes Canvas'},
 };
 const ORDER=['photos','home','work','notes'];
 const N=ORDER.length;
 ORDER.forEach((id,i)=>{CANVASES[id].index=i;});
 const ALL=ORDER.map(id=>CANVASES[id]);
 const SPOKES=ALL.filter(c=>c.kind!=='hub');

 const upperSrc='./assets/camera/lens-cover-upper.png',lowerSrc='./assets/camera/lens-cover-lower.png';
 const aperture=new Path2D('M89 0 L258 0 Q346 0 346 87 L346 189 Q346 284 257 284 L89 284 Q0 284 0 195 L0 88 Q0 0 89 0 Z');

 // State.
 let upper,lower,ready=false,frame=0,logoFrame=0,handoffFrame=0,expansion=1,logoStateAnimating=false,scrollingBack=false,handoffAnimating=false,swipeTextHidden=false,swipeTextRevealTimer=0;
 let currentId='home';                 // the canvas we rest on / are heading to
 let activeLogoDock=0;                 // 0..1 — how far the current logo has docked into the nav (scroll)
 let pos=CANVASES.home.index;          // continuous ring position the screen is centred on
 const readingPositions=Object.create(null);

 const clamp=x=>Math.max(0,Math.min(1,x));
 const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
 // Signed shortest distance from `pos` to ring index i, in (-N/2, N/2].
 const ringRel=i=>{let d=((i-pos)%N+N)%N;if(d>N/2)d-=N;return d;};
 const atRest=()=>Math.abs(ringRel(CANVASES[currentId].index))<1e-6;

 const targetFromHash=()=>{const c=ALL.find(c=>c.hash&&c.hash===location.hash);return c?c.id:'home';};
 function syncHash(id){
  history.replaceState(null,'',location.pathname+location.search+CANVASES[id].hash);
 }
 function openInitialCanvas(){
  ALL.forEach(c=>c.el.scrollTo({top:0,behavior:'instant'}));
  const initial=targetFromHash();
  if(initial!=='home')go(initial);
 }
 function load(src){
  return new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>resolve(img);
   img.onerror=reject;
   img.src=src;
  });
 }

 // Runs a rAF tween. onFrame(t) gets t in 0..1 each frame; onDone fires once at
 // the end. setFrame stores the rAF id so callers can cancel. Callers handle
 // prefers-reduced-motion themselves (their end states differ).
 function runTween(duration,onFrame,onDone,setFrame){
  const start=performance.now();
  setFrame(requestAnimationFrame(function tick(now){
   const t=clamp((now-start)/Math.max(1,duration));
   onFrame(t);
   if(t<1)setFrame(requestAnimationFrame(tick));
   else if(onDone)onDone();
  }));
 }

 // Draws one lens-cover panel opening from its pivot. direction is -1 (upper)
 // or +1 (lower); openAmount is 0 (closed) .. 1 (fully open).
 function panel(img,direction,openAmount){
  ctx.save();
  ctx.scale(346/400,284/400);
  const pivot=direction<0?[380,16]:[20,384];
  ctx.translate(pivot[0]-direction*63*openAmount,pivot[1]+direction*385*openAmount);
  ctx.rotate(openAmount*.065);
  ctx.translate(-pivot[0],-pivot[1]);
  ctx.drawImage(img,0,0);
  ctx.restore();
 }

 // Positions one canvas's marker (and its dock title) from its ring position.
 function placeMarker(c,m){
  const rel=ringRel(c.index);
  const centerX=m.vw/2+rel*m.travelX;
  const centeredness=clamp(1-Math.abs(rel));
  const S=m.scroll;                                    // the current canvas's scroll
  // Size: the centred logo runs compact→full by `expansion` (tap to collapse);
  // neighbours are shrunk, and grow back as the centre collapses (nav view).
  const heroW=m.compactWidth+(m.fullWidth-m.compactWidth)*expansion;
  const neighborW=m.fullWidth*(PEEK_SCALE+(1-PEEK_SCALE)*(1-expansion));
  const baseW=neighborW+(heroW-neighborW)*centeredness;
  const baseH=baseW*CAMERA_RATIO;
  const active=c.id===currentId;
  let w=baseW,h=baseH,left=centerX-baseW/2,top=m.centerY-baseH/2,vis=Math.min(1,Math.max(0,2-Math.abs(rel)));
  if(active){
   // Scroll SHRINKS the current logo up into the sticky nav (it stays visible —
   // it does not fade). A SCROLL_BUFFER lets the logo hold at full size for the
   // first bit of scroll (so entering the detail view registers) before docking.
   // S is 0 while panning, so this only engages on scroll.
   const Sd=Math.max(0,S-SCROLL_BUFFER);
   const baseBottom=m.centerY+baseH/2;
   const dockDistance=Math.max(1,baseBottom+GAP-m.navHeight);
   const dockProgress=ease(Sd/dockDistance);
   activeLogoDock=dockProgress;
   const dockScroll=Math.min(Sd,dockDistance);
   w=baseW+(m.logoWidth-baseW)*dockProgress;
   h=baseH+(m.logoHeight-baseH)*dockProgress;
   left=centerX-w/2;
   top=baseBottom-dockScroll-h+m.cameraDockInset*(dockScroll/dockDistance);
  }
  // Neighbours stay put — scrolling the current canvas doesn't move or fade them.

  if(c.kind==='camera'){
   c.marker.style.left='0px';
   c.marker.style.top='0px';
   c.marker.style.width=m.fullWidth+'px';
   c.marker.style.height=m.fullHeight+'px';
   c.marker.style.transform='translate('+left+'px,'+top+'px) scale('+(w/m.fullWidth)+')';
  }else{
   c.marker.style.left=left+'px';
   c.marker.style.top=top+'px';
   c.marker.style.width=w+'px';
   c.marker.style.height=h+'px';
   c.marker.style.fontSize=Math.max(LOGO_FONT_MIN,Math.min(LOGO_FONT_MAX,w*LOGO_FONT_FACTOR))+'px';
  }
  c.marker.style.visibility='visible';
  c.marker.style.opacity=String(vis);
  c.marker.style.pointerEvents=vis>.05?'auto':'none';
  c.marker.tabIndex=vis>.05?0:-1;

  // Title. Every title is a slot on a strip that pans (translateX by `rel`) so
  // it slides in sync with the logos. The CURRENT canvas's title (rel≈0) also
  // sits under its logo and animates up into the dock as navDock→1; the two
  // NEIGHBOURS' titles only show in the dock, fading in with navDock. At
  // navDock=1 the two cases coincide, so panning is seamless.
  if(c.entry){
   const dockShift=rel*m.dockTravel;
   c.entry.style.left='0px';c.entry.style.right='auto';c.entry.style.width=m.vw+'px';c.entry.style.textAlign='center';c.entry.style.textIndent='0';
   if(Math.abs(rel)<.5){
    c.entry.style.top=(m.y0-(m.y0-m.dockY)*m.navDock)+'px';
    c.entry.style.fontSize=(m.bigFs-(m.bigFs-DOCK_FS)*m.navDock)+'px';
    c.entry.style.transform='translateX('+(dockShift*m.navDock)+'px)';   // slides only once docked
    c.entry.style.opacity=swipePreview&&c.id===currentId?String(1-.35*swipeProgress):'1';
    c.entry.style.pointerEvents='auto';   // current title always tappable (collapse/expand/top)
   }else if(Math.abs(rel)<1.5){
    c.entry.style.top=m.dockY+'px';
    c.entry.style.fontSize=DOCK_FS+'px';
    c.entry.style.transform='translateX('+dockShift+'px)';
    c.entry.style.opacity=String(m.navDock);
    c.entry.style.pointerEvents=m.navDock>.5?'auto':'none';
   }else{
    c.entry.style.opacity='0';
    c.entry.style.pointerEvents='none';
   }
  }
 }

 function placeView(){
  // ---- Metrics: derive every size from the current viewport -----------------
  const vw=viewport.clientWidth;
  const vh=viewport.clientHeight;
  const heightLimitedMax=Math.min(LOGO_MAX,Math.max(LOGO_MIN,(vh-130)/CAMERA_RATIO));
  const fullWidth=Math.min(vw-32,heightLimitedMax,Math.max(LOGO_MIN,vw*.4));
  const fullHeight=fullWidth*CAMERA_RATIO;
  const safeContentWidth=vw*.6;
  const mobileRange=Math.max(1,CONTENT_MIN-MOBILE_FLOOR*.6);
  const mobileProgress=clamp((CONTENT_MIN-safeContentWidth)/mobileRange);
  const compactProgress=ease(clamp(mobileProgress*1.35));
  const compactScale=1-.5*compactProgress;
  const compactWidth=fullWidth*compactScale;
  const desktopGutter=vw*.2;
  const mobileGutter=Math.max(20,Math.min(32,vw*.055));
  const interpolatedGutter=desktopGutter+(mobileGutter-desktopGutter)*ease(mobileProgress);
  const edgeLogoGuard=compactWidth/2+vw*.1+6;
  const contentGutter=Math.max(interpolatedGutter,edgeLogoGuard);
  const contentWidth=Math.max(0,vw-contentGutter*2);
  const startY=Math.min(vw<=380?220:230,Math.max(80,vh*.28));
  const centerY=startY+fullHeight/2;
  const logoWidth=Math.min(72,fullWidth);
  const logoHeight=logoWidth*CAMERA_RATIO;
  const navHeight=76;                               // shared sticky nav height; avoid forced layout in the frame loop
  const cameraDockInset=(navHeight-logoHeight)/2;
  const travelX=vw/2;
  const resting=atRest();
  const fastPreview=swipePreview;
  const onHome=currentId==='home'&&resting;
  const scroll=resting?CANVASES[currentId].el.scrollTop:0;   // active canvas scroll (0 while panning)
  // navDock: 0 = current title sits under its logo (detail view, at top); 1 =
  // title docked in the nav bar. Raised by scrolling into content, and by
  // COLLAPSING — the title reaches the dock exactly as the logo finishes
  // shrinking (in sync, COLLAPSE_DOCK_FRAC=1). In the bird-eye view (expansion 0)
  // it's pinned at 1, so the nav bar / dock is ALWAYS visible there.
  const heroW=compactWidth+(fullWidth-compactWidth)*expansion;   // current logo width (shrinks on collapse)
  const heroH=heroW*CAMERA_RATIO;
  const titleGap=Math.max(10,heroH*.05);
  const y0=centerY+heroH/2+titleGap;                    // title's resting Y under the (current) logo
  const dockY=navHeight+DOCK_H/2-DOCK_FS*.7;            // title's Y once in the dock
  const bigFs=Math.max(TITLE_BIG_MIN,Math.min(TITLE_BIG_MAX,heroW*TITLE_BIG_FACTOR));  // shrinks with the logo
  const scrollDock=clamp((scroll-SCROLL_BUFFER)/Math.max(1,y0-dockY));  // scroll raises the title into the dock (after the buffer)
  const collapseDock=clamp((1-expansion)/COLLAPSE_DOCK_FRAC);   // title docks early in the collapse
  const navDock=Math.max(scrollDock,collapseDock);
  const dockTravel=vw*.44;                              // spacing of the three dock titles / their pan distance (hug the edges)
  const m={vw,vh,travelX,fullWidth,fullHeight,compactWidth,centerY,logoWidth,logoHeight,navHeight,cameraDockInset,scroll,y0,dockY,bigFs,navDock,dockTravel};

  // ---- Root state flags and shared CSS variables ----------------------------
  const homeContentVisible=mobileProgress===0||expansion>=.999;
  root.classList.toggle('is-mobile-canvas',mobileProgress>0);
  root.classList.toggle('is-narrow-content',contentWidth<560);
  root.classList.toggle('is-home-canvas',Math.abs(ringRel(CANVASES.home.index))<.001);
  root.classList.toggle('is-home-expanded',expansion>.001);
  root.classList.toggle('is-home-content-visible',homeContentVisible);
  homeContent.inert=!homeContentVisible;
  homeContent.setAttribute('aria-hidden',String(!homeContentVisible));
  root.style.setProperty('--canvas-content-width',contentWidth+'px');
  root.style.setProperty('--canvas-gutter',contentGutter+'px');
  root.style.setProperty('--mobile-progress',String(mobileProgress));
  track.style.width='200%';
  track.style.setProperty('--view-width',vw+'px');
  track.style.transform='none';

  // ---- Position each section along the ring via transform (compositor-only,
  // so panning stays smooth — no per-frame layout of full-viewport sections).
  ALL.forEach(c=>{
   c.el.style.left='0px';
   c.el.style.top='0px';
   c.el.style.transform='translate3d('+(ringRel(c.index)*travelX)+'px,0,0)';
  });

  // ---- Markers: the centre is the active page, its two neighbours peek ------
  activeLogoDock=0;
  ALL.forEach(c=>placeMarker(c,m));
  homeLogo.setAttribute('aria-pressed',String(onHome&&expansion>EXPANDED));
  homeLogo.setAttribute('aria-label',onHome
   ? (mobileProgress>0?(expansion>EXPANDED?'Use compact Home navigation':'Expand Home Canvas'):'Home Canvas')
   : 'Return to Home Canvas');

  // ---- Content top padding: leave room for the logo + the under-logo title --
  const detailBigFs=Math.max(TITLE_BIG_MIN,Math.min(TITLE_BIG_MAX,fullWidth*TITLE_BIG_FACTOR));
  const contentTop=startY+fullHeight+detailBigFs*1.4+GAP;
  if(!fastPreview){
   homeContent.style.paddingTop=contentTop+'px';
   gallery.style.paddingTop=contentTop+'px';
   workContent.style.paddingTop=contentTop+'px';
   notesContent.style.paddingTop=contentTop+'px';
  }
  // During the buffer the content holds too (offset down to cancel the scroll);
  // the extra bottom padding keeps the end reachable past the offset.
  const bufferHold=Math.min(scroll,SCROLL_BUFFER);
  if(!fastPreview)homeContent.style.paddingBottom=gallery.style.paddingBottom=workContent.style.paddingBottom=notesContent.style.paddingBottom=SCROLL_BUFFER+'px';

  // ---- The dock bar shows with navDock (hidden when the title is under the logo).
  canvasDock.style.opacity=String(navDock);

  // ---- Watermark: the current page's name, big and faded, fills the empty page
  // body while the logo is collapsed (shrunk). Hidden when expanded or panning.
  const watermarkSections=CANVASES[currentId].sections;
  for(let i=0;i<canvasWatermarkItems.length;i++)canvasWatermarkItems[i].textContent=watermarkSections[i];
  canvasWatermark.style.opacity=String(resting?clamp(1-expansion):0);

  // ---- Orbit-ring indicator: N coloured dots ride a tilted ring (a flat
  // ellipse in perspective) that spins with `pos`. The current canvas's dot sits
  // at the front (nearest, biggest, brightest); the others recede to the back
  // (smaller, fainter). Panning turns the ring 360°/N per canvas, so it loops.
  const ringRx=72,ringRy=13,step=2*Math.PI/N;           // dots are placed as offsets from the ring's centre
  for(let k=0;k<canvasDotItems.length;k++){
   const a=(k-pos)*step;                                // 0 = at the front
   const depth=(Math.cos(a)+1)/2;                       // 0 = back, 1 = front
   const dx=ringRx*Math.sin(a);
   const dy=ringRy*Math.cos(a);
   const sc=.55+depth*.85;                              // perspective size (front bigger)
   const dot=canvasDotItems[k];
   dot.style.transform='translate('+dx+'px,'+dy+'px) scale('+sc+')';
   dot.style.opacity=String(.3+depth*.7);
   dot.style.zIndex=String(Math.round(depth*20));
  }
  canvasDots.style.opacity=String(1-activeLogoDock);   // whole ring fades as the logo docks in

  // ---- Per-canvas content visibility, scrolling and pointer events ----------
  ALL.forEach(c=>{
   const active=c.id===currentId&&(resting||handoffAnimating);
   // Content shows only on the active, expanded canvas — so it's hidden during
   // pans (the "collapse then animate" that keeps the pan light) and on collapse.
   c.el.style.opacity=String(active?expansion:0);
   const usable=active&&expansion>.5;
   c.el.style.pointerEvents=usable?'auto':'none';
   // Content scrolls only in the FULL detail view; while collapsing/expanding it's
   // locked so the scroll-paced transition owns the wheel/touch.
  if(!fastPreview){
   c.el.style.overflowY=(active&&expansion>=.999)?'auto':'hidden';
   c.content.style.transform=active?'translate3d(0,'+bufferHold+'px,0)':'none';   // hold across the buffer
   const contentAvailable=active&&expansion>=.999;
   c.content.inert=!contentAvailable;
   c.content.setAttribute('aria-hidden',String(!contentAvailable));
  }
  });
  brand.style.opacity='1';

  // ---- Camera lens cover: redraw every frame so it tracks the camera's size.
  // The lens opens only when the camera is the big centred hero; it closes
  // (covers) as the camera collapses. Scrolling may dock the camera, but does
  // not close its lens while Photos remains in the detail view.
  if(ctx&&!fastPreview){
   // Lens is open ONLY while resting on Photos in the detail view (tracks
   // `expansion`). It stays open when the logo docks on scroll, and stays closed
   // in the bird-eye view and during any pan (so it never flashes open mid-pan).
   const cameraOpen=(currentId==='photos'&&resting)?expansion:0;
   const lens=ease(clamp(1-Math.abs(ringRel(CANVASES.photos.index)))/PAN_SPLIT)*cameraOpen;
   ctx.clearRect(0,0,346,284);
   ctx.save();
   ctx.clip(aperture);
   if(lens<1&&upper&&lower){panel(upper,-1,lens);panel(lower,1,lens);}
   ctx.restore();
  }
 }

 function draw(){
  if(!ready)return;
  placeView();
 }

 function finish(){
  pos=CANVASES[currentId].index;       // land exactly on the ring slot
  syncHash(currentId);
  ALL.forEach(c=>{c.el.inert=c.id!==currentId;});
  status.textContent=CANVASES[currentId].ready;
  SPOKES.forEach(c=>c.marker.setAttribute('aria-label',currentId===c.id?c.returnLabel:c.openLabel));
  // The menu button is always present on this page; the rest is a fallback.
  (canvasNavMenu||CANVASES[currentId].back||homeLogo).focus({preventScroll:true});
  scheduleSwipeTextReveal();
 }

 function scheduleSwipeTextReveal(){
  if(!swipeTextHidden)return;
  clearTimeout(swipeTextRevealTimer);
  swipeTextRevealTimer=setTimeout(()=>{
   ALL.forEach(c=>{c.content.style.visibility='visible';});
   swipeTextHidden=false;
   placeView();
  },SWIPE_TEXT_DELAY_MS);
 }

 function go(toId,forcedToPos){
  if(!ready)return;
  const fromId=currentId;
  const fromPos=pos;
  currentId=toId;
  // Travel the SHORTEST way around the ring (so Notes → Photography wraps).
  let d=((CANVASES[toId].index-pos)%N+N)%N;
  if(d>N/2)d-=N;
  const toPos=forcedToPos===undefined?pos+d:forcedToPos;
  cancelAnimationFrame(frame);
  ALL.forEach(c=>{c.el.inert=true;c.el.style.overflowY='hidden';});
  const fromScroll=CANVASES[fromId].el.scrollTop;
  if(reduced.matches){
   pos=CANVASES[toId].index;
   CANVASES[fromId].el.scrollTop=0;
   draw();
   finish();
   return;
  }
  status.textContent=CANVASES[toId].opening;
  runTween(GO_MS_PER_UNIT*(Math.abs(d)||1),t=>{
   const e=ease(t);
   pos=fromPos+(toPos-fromPos)*e;
   CANVASES[fromId].el.scrollTop=fromScroll*(1-e);
   draw();
  },finish,id=>{frame=id;});
 }

 // Collapses / expands the centred canvas's logo (0 = compact, 1 = full).
 function animateExpansion(next,onComplete){
  if(logoStateAnimating)return;
  if(reduced.matches){
   expansion=next;
   if(!next)CANVASES[currentId].el.scrollTop=0;
   placeView();
   if(onComplete)onComplete();
   return;
  }
  logoStateAnimating=true;
  cancelAnimationFrame(logoFrame);
  const from=expansion;
  status.textContent=next?'Expanding canvas':'Collapsing canvas';
  runTween(HOME_STATE_MS_PER_UNIT*Math.abs(next-from),t=>{
   expansion=from+(next-from)*ease(t);
   placeView();
  },()=>{
   expansion=next;
   if(!next)CANVASES[currentId].el.scrollTop=0;
   logoStateAnimating=false;
   status.textContent=next?CANVASES[currentId].title+' detail view ready':CANVASES[currentId].ready;
   if(onComplete)onComplete();
  },id=>{logoFrame=id;});
 }

 function scrollCurrentToTop(onComplete){
  if(!ready||scrollingBack||logoStateAnimating)return;
  const active=CANVASES[currentId].el;
  if(reduced.matches||active.scrollTop<=0){
   active.scrollTo({top:0,behavior:'instant'});
   onComplete();
   return;
  }
  scrollingBack=true;
  cancelAnimationFrame(frame);
  const from=active.scrollTop;
  const duration=Math.min(SCROLL_TOP_MAX,Math.max(SCROLL_TOP_MIN,from*SCROLL_TOP_FACTOR));
  status.textContent='Returning to the top of the current canvas';
  runTween(duration,t=>{
   active.scrollTop=from*(1-ease(t));
   placeView();
  },()=>{
   active.scrollTo({top:0,behavior:'instant'});
   scrollingBack=false;
   onComplete();
  },id=>{frame=id;});
 }

 // Navigation from a resting canvas: to the top, collapse the current canvas,
 // then pan to the target, which arrives collapsed and stays in bird-eye view.
 function navigateFromDefault(next){
  if(!ready||scrollingBack||logoStateAnimating||handoffAnimating)return;
  const active=CANVASES[currentId].el;
  if(active.scrollTop>0){scrollCurrentToTop(()=>navigateFromDefault(next));return;}  // 1) to the top
  if(expansion>.001){animateExpansion(0,()=>go(next));return;}                       // 2) collapse, then
  go(next);                                                                          // 3) pan
 }
 function navigateFromSwipe(next){
  if(!ready||scrollingBack||logoStateAnimating||handoffAnimating||!atRest())return;
  const active=CANVASES[currentId].el;
  const fromScroll=active.scrollTop;
  readingPositions[currentId]=fromScroll;
  const fromExpansion=expansion;
  const fromPos=pos;
  let d=((CANVASES[next].index-pos)%N+N)%N;
  if(d>N/2)d-=N;
  if(reduced.matches){
   expansion=0;
   active.scrollTop=0;
   go(next);
   return;
  }
  if(fromScroll<=0&&fromExpansion<=.001){go(next);return;}
  handoffAnimating=true;
  cancelAnimationFrame(handoffFrame);
  status.textContent='Preparing '+CANVASES[next].title+' Canvas';
  runTween(SWIPE_HANDOFF_MS,t=>{
   const e=ease(t);
   expansion=fromExpansion*(1-e);
   active.scrollTop=fromScroll*(1-e);
   pos=fromPos+d*.35*e;
   placeView();
  },()=>{
   expansion=0;
   active.scrollTop=0;
   handoffAnimating=false;
   go(next);
  },id=>{handoffFrame=id;});
 }
 function returnHome(){navigateFromDefault('home');}

 // ---- Wiring ----------------------------------------------------------------
 // Tapping the CENTRED canvas's own logo collapses/expands it (like Home) — it
 // does not navigate. Tapping a NEIGHBOUR's peeking logo/label pans to it.
 // Back button / Escape return Home.
 // Expand into the detail view, landing at the END of the scroll buffer so a
 // click skips the "hold" (which is meant for scroll entry) and is ready to scroll.
 function enterDetail(){                 // expand, then sit at the END of the buffer (skip the hold)
  const restore=readingPositions[currentId];
  animateExpansion(1,()=>{
   CANVASES[currentId].el.scrollTop=restore>SCROLL_BUFFER?restore:SCROLL_BUFFER;
   delete readingPositions[currentId];
  });
 }
 function collapseHere(){               // collapse to the bird-eye view, at the true top
  CANVASES[currentId].el.scrollTop=0;
  animateExpansion(0);
 }
 function markerClick(c){
  if(scrollingBack||logoStateAnimating)return;
  if(Math.abs(ringRel(c.index))<.5){
   if(CANVASES[c.id].el.scrollTop>SCROLL_BUFFER){scrollCurrentToTop(()=>{});return;}  // scrolled into content → top first
   if(expansion>EXPANDED)collapseHere();else enterDetail();               // else collapse / expand
  }else{
   navigateFromDefault(c.id);
  }
 }
 ALL.forEach(c=>{
  c.marker.addEventListener('click',()=>markerClick(c));
  if(c.entry)c.entry.addEventListener('click',()=>markerClick(c));   // title/logo behave alike
  if(c.back)c.back.addEventListener('click',returnHome);
 });
 // Tapping the orbit ring collapses the current page (raising the dock / nav
 // view); if the page is scrolled it returns to the top first. Tap again to expand.
 canvasDots.addEventListener('click',()=>{
  if(!ready||logoStateAnimating||scrollingBack)return;
  if(CANVASES[currentId].el.scrollTop>SCROLL_BUFFER){scrollCurrentToTop(()=>{});return;}
  if(expansion>EXPANDED)collapseHere();else enterDetail();
 });
 root.addEventListener('keydown',e=>{if(e.key==='Escape')returnHome();});
 window.addEventListener('hashchange',()=>{
  if(!ready)return;
  const next=targetFromHash();
  if(next!==currentId)go(next);
 });

 // Coalesce bursts of scroll/resize events into one placeView() per frame.
 let placeScheduled=false;
 function schedulePlace(){
  if(!ready||placeScheduled)return;
  placeScheduled=true;
  requestAnimationFrame(()=>{placeScheduled=false;placeView();});
 }
 // Apply the buffer hold SYNCHRONOUSLY on scroll (same frame) so the content
 // doesn't jitter a frame behind the native scroll; placeView keeps the rest in sync.
 ALL.forEach(c=>c.el.addEventListener('scroll',()=>{
  if(c.id===currentId&&atRest())c.content.style.transform='translateY('+Math.min(c.el.scrollTop,SCROLL_BUFFER)+'px)';
  schedulePlace();
 },{passive:true}));
 new ResizeObserver(schedulePlace).observe(viewport);

 // Markers overlay the scroll container but aren't inside it, so forward
 // wheel/touch over a marker to whichever canvas is currently open.
 function activeScroller(){
  if(!(ready&&!scrollingBack&&!logoStateAnimating&&atRest()))return null;
  const el=CANVASES[currentId].el;
  return el.style.overflowY==='auto'?el:null;
 }
 function forwardScroll(el){
  el.addEventListener('wheel',e=>{
   const sc=activeScroller();
   if(!sc||e.ctrlKey)return;
   sc.scrollTop+=e.deltaMode===1?e.deltaY*16:e.deltaY;
   e.preventDefault();
  },{passive:false});
  let touchY=null;
  el.addEventListener('touchstart',e=>{touchY=e.touches[0].clientY;},{passive:true});
  el.addEventListener('touchmove',e=>{
   const sc=activeScroller();
   if(!sc||touchY===null)return;
   const y=e.touches[0].clientY;
   sc.scrollTop+=touchY-y;
   touchY=y;
   e.preventDefault();
  },{passive:false});
 }
 // Forward over the markers AND the titles, so the cursor sitting on either
 // still scrolls the page.
 ALL.forEach(c=>{forwardScroll(c.marker);if(c.entry)forwardScroll(c.entry);});

 // Scroll PACES the collapse/expand transition between the detail view
 // (expanded) and the bird-eye view (collapsed). Scrolling drives `expansion`
 // directly (not a fixed tween): scroll up at the top of the detail view
 // collapses; scroll down in the bird-eye view expands. The title reaches the
 // dock in sync with the logo (see navDock in placeView). On
 // idle / touch-end it snaps to the nearer end.
 function applyTransitionScroll(d){      // d = px, + down (expand), − up (collapse)
  if(!ready||scrollingBack||logoStateAnimating||performance.now()<transitionCooldownUntil||!atRest())return false;
  const el=CANVASES[currentId].el;
  const atTop=el.scrollTop<=SCROLL_BUFFER;                  // the buffer zone counts as "top"
  const inZone=(expansion>1e-4&&expansion<1-1e-4)          // already mid-transition
    ||(expansion>=1-1e-4&&atTop&&d<0)                       // detail, at top, scrolling up
    ||(expansion<=1e-4&&d>0);                               // bird-eye, scrolling down
  if(!inZone)return false;
  const transitionDelta=Math.max(-TRANSITION_DELTA_MAX,Math.min(TRANSITION_DELTA_MAX,d));
  expansion=clamp(expansion+transitionDelta/COLLAPSE_DIST);
  if(expansion<=1e-4)el.scrollTop=0;                        // land the bird-eye view at the true top
  if(expansion>=.999)status.textContent=CANVASES[currentId].title+' detail view ready';
  placeView();
  return true;
 }
 function snapExpansion(){
  if(ready&&!logoStateAnimating&&!scrollingBack&&expansion>1e-4&&expansion<1-1e-4){
   animateExpansion(expansion>=TRANSITION_COMMIT_EXPANSION?1:0,()=>{transitionCooldownUntil=performance.now()+TRANSITION_COOLDOWN_MS;});
  }
 }
 function beginSwipePreview(mode){
  if(!ready||scrollingBack||logoStateAnimating||handoffAnimating||!atRest())return false;
  const active=CANVASES[currentId].el;
  swipePreview=true;
  swipeMode=mode||'touch';
  swipeProgress=0;
  swipeTravel=0;
  swipeTarget=null;
  swipeStartPos=pos;
  swipeStartExpansion=expansion;
  swipeStartScroll=active.scrollTop;
  handoffAnimating=true;
  swipeTextHidden=true;
  ALL.forEach(c=>{c.content.style.visibility='hidden';});
  return true;
 }
 function updateSwipePreview(dx){
  if(!swipePreview)return;
  const direction=dx<0?1:-1;
  const targetIndex=(CANVASES[currentId].index+direction+N)%N;
  swipeTarget=ORDER[targetIndex];
  const swipeDistance=Math.max(1,Math.min(SWIPE_DRAG_MAX,viewport.clientWidth*SWIPE_DRAG_FRACTION));
  swipeProgress=clamp(Math.abs(dx)/swipeDistance);
  const collapseShare=swipeStartExpansion>1e-4?SWIPE_COLLAPSE_SHARE:0;
  const collapseProgress=collapseShare?clamp(swipeProgress/collapseShare):1;
  const panProgress=collapseShare
   ?clamp((swipeProgress-collapseShare)/(1-collapseShare))
   :swipeProgress;
  let distance=((CANVASES[swipeTarget].index-swipeStartPos)%N+N)%N;
  if(distance>N/2)distance-=N;
  expansion=swipeStartExpansion*(1-collapseProgress);
  CANVASES[currentId].el.scrollTop=swipeStartScroll*(1-collapseProgress);
  pos=swipeStartPos+distance*panProgress;
  placeView();
 }
 function updateDesktopSwipePreview(dx){
  if(!swipePreview)return;
  const swipeDistance=Math.max(1,Math.min(SWIPE_DRAG_MAX,viewport.clientWidth*SWIPE_DRAG_FRACTION));
  const travel=dx/swipeDistance;
  const targetOffset=Math.round(travel);
  const targetIndex=(CANVASES[currentId].index+targetOffset+N)%N;
  swipeTarget=ORDER[targetIndex];
  swipeTravel=travel;
  swipeProgress=clamp(Math.abs(travel));
  const collapseShare=swipeStartExpansion>1e-4?SWIPE_COLLAPSE_SHARE:0;
  const collapseProgress=collapseShare?clamp(Math.abs(travel)/collapseShare):1;
  expansion=swipeStartExpansion*(1-collapseProgress);
  CANVASES[currentId].el.scrollTop=swipeStartScroll*(1-collapseProgress);
  pos=swipeStartPos+travel;
  placeView();
 }
 function finishSwipePreview(){
  if(!swipePreview)return false;
  const active=CANVASES[currentId].el;
  const target=swipeTarget;
  const startPos=swipeStartPos;
  const startExpansion=swipeStartExpansion;
  const startScroll=swipeStartScroll;
  const progress=swipeProgress;
  const currentExpansion=expansion;
  const currentScroll=active.scrollTop;
  const currentPos=pos;
  swipePreview=false;
  const desktopTargetOffset=Math.round(swipeTravel);
  const wasDesktopSwipe=swipeMode==='desktop';
  const commitTarget=swipeMode==='desktop'&&desktopTargetOffset
   ?ORDER[(CANVASES[currentId].index+desktopTargetOffset+N)%N]
   :target;
  swipeMode=null;
  if(progress>=SWIPE_COMMIT_PROGRESS&&commitTarget){
   readingPositions[currentId]=startScroll;
   expansion=0;
   active.scrollTop=0;
   handoffAnimating=false;
   const commitPos=wasDesktopSwipe?swipeStartPos+desktopTargetOffset:undefined;
   go(commitTarget,commitPos);
   return true;
  }
  runTween(300,t=>{
   const e=ease(t);
    expansion=currentExpansion+(startExpansion-currentExpansion)*e;
    active.scrollTop=currentScroll+(startScroll-currentScroll)*e;
    pos=currentPos+(startPos-currentPos)*e;
   placeView();
  },()=>{
   expansion=startExpansion;
   active.scrollTop=startScroll;
   pos=startPos;
   handoffAnimating=false;
   placeView();
   scheduleSwipeTextReveal();
  },id=>{handoffFrame=id;});
  return true;
 }
 let snapTimer=0,transitionCooldownUntil=0;
 let desktopSwipeDistance=0,desktopSwipeReset=0,desktopSwipeFrame=0,desktopSwipePending=false;
 function flushDesktopSwipe(){
  desktopSwipeFrame=0;
  if(!swipePreview||!desktopSwipePending)return;
  desktopSwipePending=false;
  updateDesktopSwipePreview(desktopSwipeDistance);
 }
 viewport.addEventListener('wheel',e=>{
  if(e.ctrlKey)return;
  const horizontal=e.shiftKey?e.deltaY:e.deltaX;
  const vertical=e.shiftKey?0:e.deltaY;
  if(Math.abs(horizontal)>Math.abs(vertical)&&horizontal){
   if(!ready||scrollingBack||logoStateAnimating)return;
   e.preventDefault();
   if(!atRest()&&!swipePreview)return;
   if(handoffAnimating&&!swipePreview)return;
   const startingSwipe=!swipePreview;
   if(startingSwipe&&!beginSwipePreview('desktop'))return;
   desktopSwipeDistance-=horizontal;    // wheel delta is content motion; invert to match touch displacement
   clearTimeout(desktopSwipeReset);
   if(startingSwipe)updateSwipePreview(desktopSwipeDistance);
    desktopSwipePending=true;
    if(!desktopSwipeFrame)desktopSwipeFrame=requestAnimationFrame(flushDesktopSwipe);
    desktopSwipeReset=setTimeout(()=>{
     finishSwipePreview();
     desktopSwipeDistance=0;
    },DESKTOP_SWIPE_SETTLE_MS);
   return;
  }
  const d=e.deltaMode===1?vertical*16:vertical;
  if(!d)return;
  if(applyTransitionScroll(d)){e.preventDefault();clearTimeout(snapTimer);snapTimer=setTimeout(snapExpansion,TRANSITION_SETTLE_MS);}
 },{passive:false});
 let gestureX=null,gestureY=null,gestureCurrentX=null,gestureAxis=null,gestureActive=false,swipePreview=false,swipeMode=null,swipeProgress=0,swipeTravel=0,swipeTarget=null,swipeStartPos=0,swipeStartExpansion=0,swipeStartScroll=0;
 viewport.addEventListener('touchstart',e=>{
  if(e.touches.length!==1){gestureX=gestureY=gestureCurrentX=null;gestureAxis=null;gestureActive=false;return;}
  gestureX=e.touches[0].clientX;
  gestureY=e.touches[0].clientY;
  gestureCurrentX=gestureX;
  gestureAxis=null;
  gestureActive=false;
 },{passive:true});
 viewport.addEventListener('touchmove',e=>{
  if(gestureX===null||gestureY===null||e.touches.length!==1)return;
  const x=e.touches[0].clientX;
  const y=e.touches[0].clientY;
  const dx=x-gestureX;
  const dy=y-gestureY;
  gestureCurrentX=x;
  if(!gestureAxis&&(Math.abs(dx)>=TOUCH_INTENT||Math.abs(dy)>=TOUCH_INTENT)){
   gestureAxis=Math.abs(dx)>Math.abs(dy)?'horizontal':'vertical';
  }
  if(gestureAxis==='horizontal'){
   e.preventDefault();
   gestureActive=true;
   if(!swipePreview&&!beginSwipePreview('touch'))return;
   updateSwipePreview(dx);
   return;
  }
  const d=gestureY-y;                    // +down, −up
  gestureY=y;
  if(applyTransitionScroll(d)){gestureActive=true;e.preventDefault();}
 },{passive:false});
 function finishTouchGesture(){
  if(swipePreview){
   finishSwipePreview();
  }else if(gestureAxis==='horizontal'&&gestureActive&&!scrollingBack&&!logoStateAnimating&&!handoffAnimating&&atRest()){
   const direction=gestureCurrentX-gestureX<0?1:-1;
   const nextIndex=(CANVASES[currentId].index+direction+N)%N;
   navigateFromSwipe(ORDER[nextIndex]);
  }else if(gestureActive){
   snapExpansion();
  }
  gestureX=gestureY=gestureCurrentX=null;
  gestureAxis=null;
  gestureActive=false;
 }
 viewport.addEventListener('touchend',finishTouchGesture);
 viewport.addEventListener('touchcancel',finishTouchGesture);

 function enableControls(){SPOKES.forEach(c=>{c.marker.disabled=false;if(c.entry)c.entry.disabled=false;});homeEntry.disabled=false;}

 Promise.all([load(upperSrc),load(lowerSrc)]).then(images=>{
  [upper,lower]=images;
  ready=true;
  draw();
  enableControls();
  status.textContent='Home Canvas';
  openInitialCanvas();
 }).catch(()=>{
  ready=true;
  draw();
  enableControls();
  status.textContent='Camera animation unavailable. Photography is still available.';
  openInitialCanvas();
 });
})();
