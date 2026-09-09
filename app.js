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
 const DOCK_TRAVEL_FACTOR=.44;       // adjacent dock titles sit near the viewport edges
 const TITLE_BIG_FACTOR=.16,TITLE_BIG_MIN=30,TITLE_BIG_MAX=64; // title size under the logo
 const COLLAPSE_DIST=240;            // px of scroll to fully collapse/expand (scroll-paced)
 const TRANSITION_DELTA_MAX=64;       // cap a single wheel jump while keeping expansion responsive
 const TRANSITION_SETTLE_MS=450;      // pause before an incomplete transition snaps back
 const TRANSITION_COMMIT_EXPANSION=.5;  // settle to whichever endpoint is nearest
 const TRANSITION_COOLDOWN_MS=420;      // ignore queued wheel input after a snap settles
 const COLLAPSE_DOCK_FRAC=1;         // title reaches the dock exactly as the logo finishes shrinking (in sync)
 const DETAIL_BOTTOM_PAD=90;         // extra room so the end remains reachable after docking
 const TOUCH_VERTICAL_INTENT=5;      // vertical scrolling locks quickly for a responsive canvas
 const TOUCH_HORIZONTAL_INTENT=18;   // horizontal navigation needs a more deliberate gesture
 const TOUCH_VERTICAL_AXIS_RATIO=1.05; // slight vertical dominance is enough to keep scrolling
 const TOUCH_HORIZONTAL_AXIS_RATIO=1.75; // horizontal direction must be unmistakable
 const TOUCH_SWIPE_DRAG_FRACTION=.5; // mobile finger travel for a full handoff
 const TOUCH_RELEASE_PROJECT_MS=140; // short follow-through when a finger releases / leaves the screen
 const TOUCH_RELEASE_MAX_FRACTION=.22; // cap projected travel so release momentum cannot skip unexpectedly
 const TOUCH_VELOCITY_MAX_AGE=120;   // ignore stale movement before release
 const SWIPE_DRAG_FRACTION=.4;       // desktop wheel/trackpad travel for a full handoff
 const SWIPE_DRAG_MAX=520;            // keep very wide desktop gestures within a usable range
 const SWIPE_COMMIT_PROGRESS=.7;      // 30% rollback / 70% commit behavior
 const SWIPE_HANDOFF_FRACTION=.45;  // collapse completes early while ring travel begins immediately
 const SWIPE_ROLLBACK_MS=420;        // incomplete gestures settle back without a long input tail
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
 let upper,lower,ready=false,frame=0,logoFrame=0,handoffFrame=0,expansion=1,logoStateAnimating=false,scrollingBack=false,handoffAnimating=false;
 let navigationPending=false;
 let lastLens=-1;
 let currentId='home';                 // the canvas we rest on / are heading to
 let viewportWidth=0,viewportHeight=0; // cached by ResizeObserver; never measure layout in the gesture hot path
 let activeLogoDock=0;                 // 0..1 — how far the current logo has docked into the nav (scroll)
 let pos=CANVASES.home.index;          // continuous ring position the screen is centred on
 const readingPositions=Object.create(null);
 const swipe={preview:false,progress:0,travel:0,rawTravel:0,target:null,startPos:0,startExpansion:0,startScroll:0,startNavDock:0,handoffRequired:false,panStarted:false,settling:false};

 const clamp=x=>Math.max(0,Math.min(1,x));
 const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
 const ringIndex=i=>((i%N)+N)%N;
 const setStyle=(el,property,value)=>{if(el.style[property]!==value)el.style[property]=value;};
 const setAttr=(el,name,value)=>{if(el.getAttribute(name)!==value)el.setAttribute(name,value);};
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
   // it does not fade). Detail scrolling begins the dock motion immediately so
   // marker, title, and content travel together.
   // S is 0 while panning, so this only engages on scroll.
   const baseBottom=m.centerY+baseH/2;
   const dockDistance=Math.max(1,baseBottom+GAP-m.navHeight);
   const dockProgress=ease(S/dockDistance);
   activeLogoDock=dockProgress;
   const dockScroll=Math.min(S,dockDistance);
   w=baseW+(m.logoWidth-baseW)*dockProgress;
   h=baseH+(m.logoHeight-baseH)*dockProgress;
   left=centerX-w/2;
   top=baseBottom-dockScroll-h+m.cameraDockInset*(dockScroll/dockDistance);
  }
  // Neighbours stay put — scrolling the current canvas doesn't move or fade them.

  if(c.kind==='camera'){
   setStyle(c.marker,'left','0px');
   setStyle(c.marker,'top','0px');
   setStyle(c.marker,'width',m.fullWidth+'px');
   setStyle(c.marker,'height',m.fullHeight+'px');
   setStyle(c.marker,'transform','translate('+left+'px,'+top+'px) scale('+(w/m.fullWidth)+')');
  }else{
   setStyle(c.marker,'left',left+'px');
   setStyle(c.marker,'top',top+'px');
   setStyle(c.marker,'width',w+'px');
   setStyle(c.marker,'height',h+'px');
   setStyle(c.marker,'fontSize',Math.max(LOGO_FONT_MIN,Math.min(LOGO_FONT_MAX,w*LOGO_FONT_FACTOR))+'px');
  }
  setStyle(c.marker,'visibility','visible');
  setStyle(c.marker,'opacity',String(vis));
  setStyle(c.marker,'pointerEvents',vis>.05?'auto':'none');
  c.marker.tabIndex=vis>.05?0:-1;

  // Title. Every title is a slot on a strip that pans (translateX by `rel`) so
  // it slides in sync with the logos. The CURRENT canvas's title (rel≈0) also
  // sits under its logo and animates up into the dock as navDock→1; the two
  // NEIGHBOURS' titles only show in the dock, fading in with navDock. At
  // navDock=1 the two cases coincide, so panning is seamless.
  if(c.entry){
   const dockShift=rel*m.dockTravel;
   // Titles stay on a full-width visual strip so long labels remain centred
   // and unclipped. Dock click routing resolves the intended label by x-position.
   setStyle(c.entry,'left','0px');
   setStyle(c.entry,'right','auto');
   setStyle(c.entry,'width',m.vw+'px');
   setStyle(c.entry,'textAlign','center');
   setStyle(c.entry,'textIndent','0');
   setStyle(c.entry,'clipPath','none');
   if(Math.abs(rel)<.5){
    setStyle(c.entry,'top',(m.titleY0-(m.titleY0-m.dockY)*m.navDock)+'px');
    setStyle(c.entry,'fontSize',(m.bigFs-(m.bigFs-DOCK_FS)*m.navDock)+'px');
    setStyle(c.entry,'transform','translateX('+(dockShift*m.navDock)+'px)');
    setStyle(c.entry,'opacity',swipe.preview&&c.id===currentId?String(1-.35*swipe.progress):'1');
    setStyle(c.entry,'pointerEvents','auto');
   }else if(Math.abs(rel)<1.5){
    setStyle(c.entry,'top',m.dockY+'px');
    setStyle(c.entry,'fontSize',DOCK_FS+'px');
    setStyle(c.entry,'transform','translateX('+dockShift+'px)');
    setStyle(c.entry,'opacity',String(m.navDock));
    setStyle(c.entry,'pointerEvents',m.navDock>.5?'auto':'none');
   }else{
    setStyle(c.entry,'opacity','0');
    setStyle(c.entry,'pointerEvents','none');
   }
  }
 }

 function placeView(){
  // ---- Metrics: derive every size from the current viewport -----------------
  const vw=viewportWidth||(viewportWidth=viewport.clientWidth);
  const vh=viewportHeight||(viewportHeight=viewport.clientHeight);
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
  const y0=centerY+heroH/2+titleGap;                    // current logo's lower edge, used for content spacing
  const titleY0=centerY+fullHeight/2+Math.max(10,fullHeight*.05); // fixed full-logo title origin; collapse moves it only upward
  const dockY=navHeight+DOCK_H/2-DOCK_FS*.7;            // title's Y once in the dock
  const bigFs=Math.max(TITLE_BIG_MIN,Math.min(TITLE_BIG_MAX,heroW*TITLE_BIG_FACTOR));  // shrinks with the logo
  const scrollDock=clamp(scroll/Math.max(1,y0-dockY));  // title rises with the same scroll that moves content
  const collapseDock=clamp((1-expansion)/COLLAPSE_DOCK_FRAC);   // title docks early in the collapse
  const swipeDock=swipe.preview?swipe.startNavDock:0;
  const navDock=Math.max(scrollDock,collapseDock,swipeDock);
  const dockTravel=vw*DOCK_TRAVEL_FACTOR;               // spacing of the three dock titles / their pan distance (hug the edges)
  const m={vw,vh,travelX,fullWidth,fullHeight,compactWidth,centerY,logoWidth,logoHeight,navHeight,cameraDockInset,scroll,y0,titleY0,dockY,bigFs,navDock,dockTravel};

  // ---- Root state flags and shared CSS variables ----------------------------
  const homeContentVisible=mobileProgress===0||expansion>1e-4;
  root.classList.toggle('is-mobile-canvas',mobileProgress>0);
  root.classList.toggle('is-narrow-content',contentWidth<560);
  root.classList.toggle('is-home-canvas',Math.abs(ringRel(CANVASES.home.index))<.001);
  root.classList.toggle('is-home-expanded',expansion>.001);
  root.classList.toggle('is-home-content-visible',homeContentVisible);
  const contentWidthPx=contentWidth+'px';
  const contentGutterPx=contentGutter+'px';
  const viewWidthPx=vw+'px';
  if(root.style.getPropertyValue('--canvas-content-width')!==contentWidthPx)root.style.setProperty('--canvas-content-width',contentWidthPx);
  if(root.style.getPropertyValue('--canvas-gutter')!==contentGutterPx)root.style.setProperty('--canvas-gutter',contentGutterPx);
  if(root.style.getPropertyValue('--mobile-progress')!==String(mobileProgress))root.style.setProperty('--mobile-progress',String(mobileProgress));
  setStyle(track,'width','200%');
  if(track.style.getPropertyValue('--view-width')!==viewWidthPx)track.style.setProperty('--view-width',viewWidthPx);
  setStyle(track,'transform','none');

  // ---- Position each section along the ring via transform (compositor-only,
  // so panning stays smooth — no per-frame layout of full-viewport sections).
  ALL.forEach(c=>{
   setStyle(c.el,'left','0px');
   setStyle(c.el,'top','0px');
   setStyle(c.el,'transform','translate3d('+(ringRel(c.index)*travelX)+'px,0,0)');
  });

  // ---- Markers: the centre is the active page, its two neighbours peek ------
  activeLogoDock=0;
  ALL.forEach(c=>placeMarker(c,m));
  setAttr(homeLogo,'aria-pressed',String(onHome&&expansion>EXPANDED));
  setAttr(homeLogo,'aria-label',onHome
   ? (mobileProgress>0?(expansion>EXPANDED?'Use compact Home navigation':'Expand Home Canvas'):'Home Canvas')
   : 'Return to Home Canvas');

  // ---- Content top padding: leave room for the logo + the under-logo title --
  const detailBigFs=Math.max(TITLE_BIG_MIN,Math.min(TITLE_BIG_MAX,fullWidth*TITLE_BIG_FACTOR));
  const contentTop=startY+fullHeight+detailBigFs*1.4+GAP;
  const contentTopPx=contentTop+'px';
  ALL.forEach(c=>{
   setStyle(c.content,'paddingTop',contentTopPx);
   setStyle(c.content,'paddingBottom',DETAIL_BOTTOM_PAD+'px');
  });

  // ---- The dock bar shows with navDock (hidden when the title is under the logo).
  setStyle(canvasDock,'opacity',String(navDock));

  // ---- Watermark: the current page's name, big and faded, fills the empty page
  // body while the logo is collapsed (shrunk). Hidden when expanded or panning.
  const watermarkSections=CANVASES[currentId].sections;
  for(let i=0;i<canvasWatermarkItems.length;i++)canvasWatermarkItems[i].textContent=watermarkSections[i];
  // Bird-eye labels share the continuous expansion fade; do not wait for an
  // endpoint or they visibly pop in after the marker has already moved.
  const watermarkOpacity=resting&&!navigationPending?ease(1-expansion):0;
  setStyle(canvasWatermark,'opacity',String(watermarkOpacity));

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
   setStyle(dot,'transform','translate('+dx+'px,'+dy+'px) scale('+sc+')');
   setStyle(dot,'opacity',String(.3+depth*.7));
   setStyle(dot,'zIndex',String(Math.round(depth*20)));
  }
  setStyle(canvasDots,'opacity',String(1-activeLogoDock)); // whole ring fades as the logo docks in

  // ---- Per-canvas content visibility, scrolling and pointer events ----------
  ALL.forEach(c=>{
   const active=c.id===currentId&&(resting||handoffAnimating);
   // Content shows only on the active, expanded canvas — so it's hidden during
   // pans (the "collapse then animate" that keeps the pan light) and on collapse.
   // Content follows the same continuous expansion state as the marker. This
   // avoids a final-frame text pop on entry, cancellation, or restoration.
   const contentOpacity=active?ease(expansion):0;
   applyContentState(c,active,contentOpacity);
  });
  setStyle(brand,'opacity','1');

  // ---- Camera lens cover: redraw every frame so it tracks the camera's size.
  // The lens opens only when the camera is the big centred hero; it closes
  // (covers) as the camera collapses. Scrolling may dock the camera, but does
  // not close its lens while Photos remains in the detail view.
  if(ctx){
   // Lens is open ONLY while resting on Photos in the detail view (tracks
   // `expansion`). It stays open when the logo docks on scroll, and stays closed
   // in the bird-eye view and during any pan (so it never flashes open mid-pan).
   const cameraOpen=(currentId==='photos'&&(resting||swipe.settling))?expansion:0;
   const lens=ease(clamp(1-Math.abs(ringRel(CANVASES.photos.index)))/PAN_SPLIT)*cameraOpen;
   if(Math.abs(lens-lastLens)>=1e-4){
    lastLens=lens;
    ctx.clearRect(0,0,346,284);
    ctx.save();
    ctx.clip(aperture);
    if(lens<1&&upper&&lower){panel(upper,-1,lens);panel(lower,1,lens);}
    ctx.restore();
   }
  }
 }

 function draw(){
  if(!ready)return;
  placeView();
 }

 function applyContentState(c,active,contentOpacity){
  const opacity=String(contentOpacity);
  const visible=contentOpacity>.001;
  const usable=visible&&expansion>=.999&&!swipe.preview&&!swipe.settling&&!handoffAnimating;
  setStyle(c.el,'opacity',opacity);
  setStyle(c.content,'opacity',opacity);
  setStyle(c.content,'visibility',visible?'visible':'hidden');
  setStyle(c.el,'pointerEvents',usable?'auto':'none');
  setStyle(c.el,'overflowY',usable?'auto':'hidden');
  setStyle(c.content,'transform',active?'translate3d(0,0,0)':'none');
  c.content.inert=!usable;
  setAttr(c.content,'aria-hidden',String(!usable));
 }

 function finish(){
  const revealAfterNavigation=navigationPending;
  pos=CANVASES[currentId].index;       // land exactly on the ring slot
  navigationPending=false;
  syncHash(currentId);
  ALL.forEach(c=>{c.el.inert=c.id!==currentId;});
  status.textContent=CANVASES[currentId].ready;
  SPOKES.forEach(c=>setAttr(c.marker,'aria-label',currentId===c.id?c.returnLabel:c.openLabel));
  // The menu button is always present on this page; the rest is a fallback.
  (canvasNavMenu||CANVASES[currentId].back||homeLogo).focus({preventScroll:true});
  if(revealAfterNavigation){
   requestAnimationFrame(()=>{
    canvasWatermark.style.transition='';
    requestAnimationFrame(placeView);
   });
  }
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
  ALL.forEach(c=>{c.el.inert=true;setStyle(c.el,'overflowY','hidden');});
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
   placeView();
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
  navigationPending=true;
  // A committed navigation must not carry the outgoing watermark into the pan.
  // Disable its normal fade for this suppression; restore it after landing.
  canvasWatermark.style.transition='none';
  canvasWatermark.style.opacity='0';
  const active=CANVASES[currentId].el;
  if(active.scrollTop>0){scrollCurrentToTop(()=>navigateFromDefault(next));return;}  // 1) to the top
  if(expansion>.001){navigateFromSwipe(next);return;}                               // 2) shared shrink + movement handoff
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
 // Expand into the detail view at a natural, unoffset scroll position.
 function enterDetail(){
  const restore=readingPositions[currentId];
  animateExpansion(1,()=>{
   CANVASES[currentId].el.scrollTop=restore>0?restore:0;
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
   if(CANVASES[c.id].el.scrollTop>0){scrollCurrentToTop(()=>{});return;}  // scrolled into content → top first
   if(expansion>EXPANDED)collapseHere();else enterDetail();               // else collapse / expand
  }else{
   navigateFromDefault(c.id);
  }
 }
 function entryClick(c,event){
  const active=CANVASES[currentId];
  const docked=active.el.scrollTop>0||expansion<.999;
  if(docked){
   const rect=viewport.getBoundingClientRect();
   const x=event.clientX-rect.left;
   const offset=Math.max(-1,Math.min(1,Math.round((x-rect.width/2)/(rect.width*DOCK_TRAVEL_FACTOR))));
   markerClick(CANVASES[ORDER[ringIndex(active.index+offset)]]);
   return;
  }
  markerClick(c);
 }
 ALL.forEach(c=>{
  c.marker.addEventListener('click',()=>markerClick(c));
  if(c.entry)c.entry.addEventListener('click',event=>entryClick(c,event));
  if(c.back)c.back.addEventListener('click',returnHome);
 });
 // Tapping the orbit ring collapses the current page (raising the dock / nav
 // view); if the page is scrolled it returns to the top first. Tap again to expand.
 canvasDots.addEventListener('click',()=>{
  if(!ready||logoStateAnimating||scrollingBack)return;
  if(CANVASES[currentId].el.scrollTop>0){scrollCurrentToTop(()=>{});return;}
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
 // Native scroll changes docking geometry; coalesce it into the shared renderer.
 ALL.forEach(c=>c.el.addEventListener('scroll',schedulePlace,{passive:true}));
 new ResizeObserver(entries=>{
  const rect=entries[0].contentRect;
  viewportWidth=rect.width;
  viewportHeight=rect.height;
  schedulePlace();
 }).observe(viewport);

 // Markers overlay the scroll container but aren't inside it, so forward
 // wheel/touch over a marker to whichever canvas is currently open.
 function activeScroller(){
  if(!(ready&&!scrollingBack&&!logoStateAnimating&&!handoffAnimating&&!swipe.preview&&!swipe.settling&&atRest()))return null;
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
   const delta=touchY-y;
   touchY=y;
   if(delta<0&&sc.scrollTop<=1)return;   // preserve native pull-to-refresh at the true top
   sc.scrollTop+=delta;
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
  const atTop=el.scrollTop<=1;                              // collapse only at the true top
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
 function beginSwipePreview(){
  if(!ready||scrollingBack||logoStateAnimating||handoffAnimating||!atRest())return false;
  const active=CANVASES[currentId].el;
  swipe.preview=true;
  swipe.progress=0;
  swipe.travel=0;
  swipe.rawTravel=0;
  swipe.target=null;
  swipe.startPos=pos;
  swipe.startExpansion=expansion;
  swipe.startScroll=active.scrollTop;
  swipe.startNavDock=Math.max(activeLogoDock,1-expansion);
  swipe.handoffRequired=swipe.startExpansion>1e-4||swipe.startScroll>0;
  swipe.panStarted=!swipe.handoffRequired;
  swipe.settling=false;
  handoffAnimating=true;
  root.classList.add('is-swiping');
  ALL.forEach(c=>{
   c.el.style.overflowY='hidden';
   c.content.inert=true;
   c.content.setAttribute('aria-hidden','true');
  });
  return true;
 }
 function renderSwipePan(panTravel){
  const panTargetOffset=Math.round(panTravel);
  swipe.target=ORDER[ringIndex(CANVASES[currentId].index+panTargetOffset)];
  swipe.travel=panTravel;
  swipe.progress=clamp(Math.abs(panTravel));
  pos=swipe.startPos+panTravel;
  placeView();
 }
 function updateSwipeTravel(travel){
  if(!swipe.preview||swipe.settling)return;
  swipe.rawTravel=travel;
  const active=CANVASES[currentId].el;
  if(swipe.handoffRequired){
   const handoffProgress=clamp(Math.abs(travel)/SWIPE_HANDOFF_FRACTION);
   expansion=swipe.startExpansion*(1-ease(handoffProgress));
   active.scrollTop=swipe.startScroll*(1-ease(handoffProgress));
   if(handoffProgress>=1){
    expansion=0;
    active.scrollTop=0;
   }
  }else{
   expansion=0;
   active.scrollTop=0;
  }
  swipe.panStarted=Math.abs(travel)>1e-4;
  renderSwipePan(travel);
 }
 function updateSwipePreview(dx){
  const swipeDistance=Math.max(1,viewportWidth*TOUCH_SWIPE_DRAG_FRACTION);
  updateSwipeTravel(-dx/swipeDistance); // ring moves opposite the finger
 }
 function updateDesktopSwipePreview(dx){
  const swipeDistance=Math.max(1,Math.min(SWIPE_DRAG_MAX,viewportWidth*SWIPE_DRAG_FRACTION));
  updateSwipeTravel(dx/swipeDistance);
 }
 function finishSwipePreview(){
  if(!swipe.preview)return false;
  const active=CANVASES[currentId].el;
  const target=swipe.target;
  const startPos=swipe.startPos;
  const startExpansion=swipe.startExpansion;
  const startScroll=swipe.startScroll;
  const progress=swipe.progress;
  const currentExpansion=expansion;
  const currentScroll=active.scrollTop;
  const currentPos=pos;
  const targetOffset=Math.round(swipe.travel);
  const commitTarget=targetOffset
   ?ORDER[ringIndex(CANVASES[currentId].index+targetOffset)]
   :target;
  if(progress>=SWIPE_COMMIT_PROGRESS&&commitTarget){
   swipe.preview=false;
   readingPositions[currentId]=startScroll;
   expansion=0;
   active.scrollTop=0;
   handoffAnimating=false;
   root.classList.remove('is-swiping');
   const commitPos=swipe.startPos+targetOffset;
   go(commitTarget,commitPos);
   return true;
  }
  swipe.settling=true;
  runTween(SWIPE_ROLLBACK_MS,t=>{
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
   swipe.settling=false;
   swipe.preview=false;
   root.classList.remove('is-swiping');
   placeView();
  },id=>{handoffFrame=id;});
  return true;
 }
 let snapTimer=0,transitionCooldownUntil=0;
 let desktopSwipeDistance=0,desktopSwipeReset=0,desktopSwipeFrame=0,desktopSwipePending=false;
 function flushDesktopSwipe(){
  desktopSwipeFrame=0;
  if(!swipe.preview||!desktopSwipePending)return;
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
   if(!atRest()&&!swipe.preview)return;
   if(handoffAnimating&&!swipe.preview)return;
   const startingSwipe=!swipe.preview;
   if(startingSwipe){
    desktopSwipeDistance=0;
    desktopSwipePending=false;
    if(!beginSwipePreview())return;
   }
   desktopSwipeDistance-=horizontal;    // wheel delta is content motion; invert to match touch displacement
   clearTimeout(desktopSwipeReset);
   if(startingSwipe)updateDesktopSwipePreview(desktopSwipeDistance);
   desktopSwipePending=true;
   if(!desktopSwipeFrame)desktopSwipeFrame=requestAnimationFrame(flushDesktopSwipe);
   const settleDelay=DESKTOP_SWIPE_SETTLE_MS;
   desktopSwipeReset=setTimeout(()=>{
    finishSwipePreview();
    desktopSwipeDistance=0;
   },settleDelay);
   return;
  }
  const d=e.deltaMode===1?vertical*16:vertical;
  if(!d)return;
  if(applyTransitionScroll(d)){e.preventDefault();clearTimeout(snapTimer);snapTimer=setTimeout(snapExpansion,TRANSITION_SETTLE_MS);}
 },{passive:false});
 let gestureX=null,gestureY=null,gestureLastX=null,gestureLastTime=0,gestureVelocityX=0,gestureAxis=null,gestureActive=false;
 let touchSwipeFrame=0,touchSwipePendingDx=0;
 function scheduleTouchSwipe(dx){
  touchSwipePendingDx=dx;
  if(touchSwipeFrame)return;
  touchSwipeFrame=requestAnimationFrame(()=>{
   touchSwipeFrame=0;
   updateSwipePreview(touchSwipePendingDx);
  });
 }
 function resetTouchGesture(){
  cancelAnimationFrame(touchSwipeFrame);
  touchSwipeFrame=0;
  touchSwipePendingDx=0;
  gestureX=gestureY=gestureLastX=null;
  gestureLastTime=0;
  gestureVelocityX=0;
  gestureAxis=null;
  gestureActive=false;
 }
 viewport.addEventListener('touchstart',e=>{
  if(e.touches.length!==1){resetTouchGesture();return;}
  const touch=e.touches[0];
  gestureX=gestureLastX=touch.clientX;
  gestureY=touch.clientY;
  gestureLastTime=performance.now();
  gestureVelocityX=0;
  gestureAxis=null;
  gestureActive=false;
 },{passive:true});
 viewport.addEventListener('touchmove',e=>{
  if(gestureX===null||gestureY===null||e.touches.length!==1)return;
  const x=e.touches[0].clientX;
  const y=e.touches[0].clientY;
  const dx=x-gestureX;
  const dy=y-gestureY;
  const now=performance.now();
  const sampleMs=now-gestureLastTime;
  if(sampleMs>0&&sampleMs<80){
   const sampleVelocity=(x-gestureLastX)/sampleMs;
   gestureVelocityX=gestureVelocityX*.65+sampleVelocity*.35;
  }
  gestureLastX=x;
  gestureLastTime=now;
  if(!gestureAxis){
   const ax=Math.abs(dx);
   const ay=Math.abs(dy);
   // Bias ambiguous diagonal movement toward vertical scrolling. A horizontal
   // canvas swipe only locks after a longer, clearly sideways gesture.
   if(ay>=TOUCH_VERTICAL_INTENT&&ay>=ax*TOUCH_VERTICAL_AXIS_RATIO)gestureAxis='vertical';
   else if(ax>=TOUCH_HORIZONTAL_INTENT&&ax>=ay*TOUCH_HORIZONTAL_AXIS_RATIO)gestureAxis='horizontal';
  }
  if(gestureAxis==='horizontal'){
   e.preventDefault();
   gestureActive=true;
   if(!swipe.preview&&!beginSwipePreview())return;
   scheduleTouchSwipe(dx);
   return;
  }
  const d=gestureY-y;                    // +down, −up
  gestureY=y;
  if(applyTransitionScroll(d)){gestureActive=true;e.preventDefault();}
 },{passive:false});
 function finishTouchGesture(e){
  if(swipe.preview&&gestureAxis==='horizontal'&&gestureX!==null){
   const endTouch=e.changedTouches&&e.changedTouches[0];
   const endX=endTouch?endTouch.clientX:gestureLastX;
   let releaseTravel=0;
   if(performance.now()-gestureLastTime<=TOUCH_VELOCITY_MAX_AGE){
    const releaseLimit=viewportWidth*TOUCH_RELEASE_MAX_FRACTION;
    releaseTravel=Math.max(-releaseLimit,Math.min(releaseLimit,gestureVelocityX*TOUCH_RELEASE_PROJECT_MS));
   }
   cancelAnimationFrame(touchSwipeFrame);
   touchSwipeFrame=0;
   updateSwipePreview(endX-gestureX+releaseTravel);
   finishSwipePreview();
  }else if(swipe.preview){
   finishSwipePreview();
  }else if(gestureActive){
   snapExpansion();
  }
  resetTouchGesture();
 }
 // Capture the end above the viewport so an edge release or browser-generated
 // cancellation cannot strand the horizontal preview in its active state.
 window.addEventListener('touchend',finishTouchGesture,{capture:true,passive:true});
 window.addEventListener('touchcancel',finishTouchGesture,{capture:true,passive:true});

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
