
(()=>{
 const root=document.getElementById('camera-portfolio');
 const track=root.querySelector('.track'),camera=root.querySelector('.camera'),entry=root.querySelector('.entry'),back=root.querySelector('.back'),home=root.querySelector('.home'),photos=root.querySelector('.photos'),status=root.querySelector('.status');
 const viewport=root.querySelector('.viewport'),brand=root.querySelector('.page-brand');
 const homeLogo=root.querySelector('.home-logo'),homeContent=root.querySelector('.home-content');
 const work=root.querySelector('.work'),workLogo=root.querySelector('.work-logo'),workEntry=root.querySelector('.work-entry'),workBack=root.querySelector('.work-back'),workContent=root.querySelector('.work-content');
 const canvasNavTitle=root.querySelector('.canvas-nav-title'),canvasNavMenu=root.querySelector('.menu-toggle');
 const ctx=root.querySelector('.cover').getContext('2d');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const upperSrc='./assets/lens-cover-upper.png',lowerSrc='./assets/lens-cover-lower.png';
 const aperture=new Path2D('M89 0 L258 0 Q346 0 346 87 L346 189 Q346 284 257 284 L89 284 Q0 284 0 195 L0 88 Q0 0 89 0 Z');
 let upper,lower,progress=0,target=0,frame=0,logoFrame=0,ready=false,returnScroll=0,homeExpansion=0,logoStateAnimating=false;
 const clamp=x=>Math.max(0,Math.min(1,x));const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
 const LOGO_MIN=120,LOGO_MAX=420,CONTENT_MIN=720,MOBILE_FLOOR=480,CAMERA_RATIO=1250/2048;
 const targetFromHash=()=>location.hash==='#photography'?1:location.hash==='#work'?-1:0;
 function syncHash(next){const hash=next===1?'#photography':next===-1?'#work':'';history.replaceState(null,'',location.pathname+location.search+hash);}
 function openInitialCanvas(){
  home.scrollTo({top:0,behavior:'instant'});photos.scrollTo({top:0,behavior:'instant'});work.scrollTo({top:0,behavior:'instant'});
  const initialTarget=targetFromHash();if(initialTarget!==0)go(initialTarget);
 }
 function load(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
 function panel(img,d,p){ctx.save();ctx.scale(346/400,284/400);const pivot=d<0?[380,16]:[20,384];ctx.translate(pivot[0]-d*63*p,pivot[1]+d*385*p);ctx.rotate(p*.065);ctx.translate(-pivot[0],-pivot[1]);ctx.drawImage(img,0,0);ctx.restore();}


 function placeCamera(p){
  const vw=viewport.clientWidth;
  const vh=viewport.clientHeight;
  const heightLimitedMax=Math.min(LOGO_MAX,Math.max(LOGO_MIN,(vh-130)/CAMERA_RATIO));
  const fullWidth=Math.min(vw-32,heightLimitedMax,Math.max(LOGO_MIN,vw*.4));
  const fullHeight=fullWidth*CAMERA_RATIO;
  const safeContentWidth=vw*.6;
  const mobileRange=Math.max(1,CONTENT_MIN-MOBILE_FLOOR*.6);
  const mobileProgress=clamp((CONTENT_MIN-safeContentWidth)/mobileRange);
  // Reach the compact state sooner through tablet and narrow-laptop widths.
  // The narrow-phone endpoint remains exactly half width and half height.
  const compactProgress=ease(clamp(mobileProgress*1.35));
  const compactScale=1-.5*compactProgress;
  const compactWidth=fullWidth*compactScale;
  const compactHeight=fullHeight*compactScale;
  const desktopGutter=vw*.2;
  const mobileGutter=Math.max(20,Math.min(32,vw*.055));
  const interpolatedGutter=desktopGutter+(mobileGutter-desktopGutter)*ease(mobileProgress);
  // Keep a full ten-percent lane between each visible half-logo and content.
  // This also absorbs the scroll bar without allowing text to touch a logo.
  const edgeLogoGuard=compactWidth/2+vw*.1+6;
  const contentGutter=Math.max(interpolatedGutter,edgeLogoGuard);
  const contentWidth=Math.max(0,vw-contentGutter*2);
  const startY=Math.min(vw<=380?220:230,Math.max(80,vh*.28));
  const centerY=startY+fullHeight/2;
  const logoWidth=Math.min(72,fullWidth);
  const logoHeight=logoWidth*CAMERA_RATIO;
  const navigationHeight=photos.querySelector('header').offsetHeight;
  const cameraDockInset=(navigationHeight-logoHeight)/2;
  const dockDistance=Math.max(1,startY+fullHeight+32-navigationHeight);
  const photoDockProgress=p===1?ease(photos.scrollTop/dockDistance):0;
  const dockScroll=Math.min(photos.scrollTop,dockDistance);
  const travel=vw/2;

  const homeContentVisible=mobileProgress===0||homeExpansion>=.999;
  root.classList.toggle('is-mobile-canvas',mobileProgress>0);
  root.classList.toggle('is-narrow-content',contentWidth<560);
  root.classList.toggle('is-home-canvas',Math.abs(p)<.001);
  root.classList.toggle('is-home-expanded',homeExpansion>.001);
  root.classList.toggle('is-home-content-visible',homeContentVisible);
  homeContent.inert=!homeContentVisible;
  homeContent.setAttribute('aria-hidden',String(!homeContentVisible));
  root.style.setProperty('--canvas-content-width',contentWidth+'px');
  root.style.setProperty('--canvas-gutter',contentGutter+'px');
  root.style.setProperty('--mobile-progress',String(mobileProgress));
  track.style.width='200%';
  track.style.setProperty('--view-width',vw+'px');
  track.style.setProperty('--travel',travel+'px');
  const workProgress=clamp(-p);
  const pan=p>=0?ease(p):-ease(-p);
  const canvasOffset=-travel*(1-pan);
  const workCenter=vw/2+2*travel;
  track.style.transform='translateX('+canvasOffset+'px)';

  // Home is compact by default only when space is constrained. Expanding it
  // grows from its center while the two edge logos shrink from theirs.
  const activeHomeWidth=compactWidth+(fullWidth-compactWidth)*homeExpansion;
  const activeHomeHeight=compactHeight+(fullHeight-compactHeight)*homeExpansion;
  const homeBaseWidth=p===0?activeHomeWidth:compactWidth;
  const homeBaseHeight=p===0?activeHomeHeight:compactHeight;
  const homeBaseBottom=centerY+homeBaseHeight/2;
  const homeDockDistance=Math.max(1,homeBaseBottom+32-navigationHeight);
  const homeLogoDockProgress=p===0?ease(home.scrollTop/homeDockDistance):0;
  const renderedHomeLogoWidth=homeBaseWidth+(logoWidth-homeBaseWidth)*homeLogoDockProgress;
  const renderedHomeLogoHeight=homeBaseHeight+(logoHeight-homeBaseHeight)*homeLogoDockProgress;
  const homeLogoCenter=canvasOffset+travel+vw/2;
  const homeDockScroll=Math.min(home.scrollTop,homeDockDistance);
  homeLogo.style.left=(homeLogoCenter-renderedHomeLogoWidth/2)+'px';
  homeLogo.style.top=(p===0
   ? homeBaseBottom-homeDockScroll-renderedHomeLogoHeight+cameraDockInset*(homeDockScroll/homeDockDistance)
   : centerY-homeBaseHeight/2)+'px';
  homeLogo.style.width=renderedHomeLogoWidth+'px';
  homeLogo.style.height=renderedHomeLogoHeight+'px';
  homeLogo.style.fontSize=Math.max(16,Math.min(48,renderedHomeLogoWidth*.115))+'px';
  homeLogo.setAttribute('aria-pressed',String(p===0&&homeExpansion>.5));
  homeLogo.setAttribute('aria-label',p===0
   ? mobileProgress>0?(homeExpansion>.5?'Use compact Home navigation':'Expand Home Canvas'):'Home Canvas'
   : 'Return to Home Canvas');

  const edgeWidth=fullWidth+(compactWidth-fullWidth)*homeExpansion;
  const edgeHeight=fullHeight+(compactHeight-fullHeight)*homeExpansion;
  const workBaseWidth=p===0?edgeWidth:fullWidth;
  const workBaseHeight=p===0?edgeHeight:fullHeight;
  const workBaseBottom=centerY+workBaseHeight/2;
  const workDockDistance=Math.max(1,workBaseBottom+32-navigationHeight);
  const workLogoDockProgress=p===-1?ease(work.scrollTop/workDockDistance):0;
  const renderedWorkLogoWidth=workBaseWidth+(logoWidth-workBaseWidth)*workLogoDockProgress;
  const renderedWorkLogoHeight=workBaseHeight+(logoHeight-workBaseHeight)*workLogoDockProgress;
  const workDockScroll=Math.min(work.scrollTop,workDockDistance);
  workLogo.style.left=(canvasOffset+workCenter-renderedWorkLogoWidth/2)+'px';
  workLogo.style.top=(p===-1
   ? workBaseBottom-workDockScroll-renderedWorkLogoHeight+cameraDockInset*(workDockScroll/workDockDistance)
   : centerY-workBaseHeight/2)+'px';
  workLogo.style.width=renderedWorkLogoWidth+'px';
  workLogo.style.height=renderedWorkLogoHeight+'px';
  workLogo.style.fontSize=Math.max(16,Math.min(48,renderedWorkLogoWidth*.115))+'px';
  workLogo.style.visibility='visible';
  workLogo.style.opacity='1';
  workLogo.style.pointerEvents='auto';
  workLogo.tabIndex=0;

  const visibleEdgeWidth=Math.max(44,edgeWidth/2);
  const edgeLabelSize=Math.max(13,Math.min(30,edgeWidth*.075));
  const edgeLabelShift=Math.max(0,visibleEdgeWidth*.18-4);
  root.style.setProperty('--edge-label-size',edgeLabelSize+'px');
  entry.style.left='0px';entry.style.right='auto';entry.style.width=visibleEdgeWidth+'px';entry.style.top=(centerY+edgeHeight/2+12)+'px';
  workEntry.style.left='auto';workEntry.style.right='0px';workEntry.style.width=visibleEdgeWidth+'px';workEntry.style.top=(centerY+edgeHeight/2+12)+'px';
  entry.style.textIndent=(-edgeLabelShift)+'px';
  workEntry.style.textIndent=edgeLabelShift+'px';
  homeContent.style.paddingTop=(startY+fullHeight+72)+'px';
  workContent.style.paddingTop=(startY+fullHeight+32-navigationHeight)+'px';

  // The camera uses the same centered scaling as the other logos. On the
  // Photography canvas its bottom continues to track scrolling one-for-one.
  const photographyMode=p===1;
  const cameraBaseWidth=p===0?edgeWidth:fullWidth;
  const cameraBaseHeight=p===0?edgeHeight:fullHeight;
  const renderedCameraWidth=photographyMode?fullWidth+(logoWidth-fullWidth)*photoDockProgress:cameraBaseWidth;
  const renderedCameraHeight=renderedCameraWidth*CAMERA_RATIO;
  const cameraBottom=startY+fullHeight-dockScroll;
  const yInset=cameraDockInset*(dockScroll/dockDistance);
  const cameraX=canvasOffset+vw/2-renderedCameraWidth/2;
  const cameraY=photographyMode?cameraBottom-renderedCameraHeight+yInset:centerY-cameraBaseHeight/2;
  camera.style.left='0px';camera.style.top='0px';
  camera.style.width=fullWidth+'px';camera.style.height=fullHeight+'px';
  camera.style.transform='translate('+cameraX+'px,'+cameraY+'px) scale('+(renderedCameraWidth/fullWidth)+')';
  camera.style.opacity='1';
  camera.style.pointerEvents='auto';
  camera.tabIndex=0;
  root.querySelector('.gallery').style.paddingTop=(startY+fullHeight+32)+'px';
  // Let the active canvas logo take over the center of the sticky bar as its
  // page title fades out. The title returns when scrolling up.
  const navDockProgress=p===1?photoDockProgress:p===0?homeLogoDockProgress:p===-1?workLogoDockProgress:0;
  canvasNavTitle.style.opacity=String(1-navDockProgress);
  const galleryTitle=root.querySelector('.gallery h1');
  const titleFadeDistance=96;
  const galleryTitleFadeStart=Math.max(0,dockDistance-titleFadeDistance);
  const galleryTitleProgress=p===1?ease((photos.scrollTop-galleryTitleFadeStart)/titleFadeDistance):0;
  galleryTitle.style.opacity=String(1-galleryTitleProgress);
  home.style.opacity=String(1-ease(Math.abs(p)/.65));
  home.style.pointerEvents=p===0?'auto':'none';
  home.style.overflowY=p===0&&homeContentVisible?'auto':'hidden';
  entry.style.pointerEvents=p===0?'auto':'none';
  workEntry.style.pointerEvents=p===0?'auto':'none';
  entry.style.opacity=p===0?'1':'0';
  workEntry.style.opacity=p===0?'1':'0';
  photos.style.pointerEvents=p===1?'auto':'none';
  photos.style.overflowY=p===1?'auto':'hidden';
  work.style.opacity=String(ease((workProgress-.65)/.35));
  work.style.pointerEvents=p===-1?'auto':'none';
  work.style.overflowY=p===-1?'auto':'hidden';
  root.querySelector('.photos header').style.opacity=String(ease((p-.35)/.65));
  root.querySelector('.gallery').style.opacity=String(ease(p));
  brand.style.opacity='1';
 }
 function draw(p){
  if(!ready)return;
  const lens=ease(p/.65);
  placeCamera(p);
  ctx.clearRect(0,0,346,284);ctx.save();ctx.clip(aperture);
  if(lens<1 && upper && lower){panel(upper,-1,lens);panel(lower,1,lens);}ctx.restore();
 }
 function finish(){
  syncHash(target);
  canvasNavTitle.textContent=target===1?'Photography':target===-1?'Work':'Home';
  home.inert=target!==0;photos.inert=target!==1;work.inert=target!==-1;
  status.textContent=target===1?'Camera Canvas. Scroll to explore Photography.':target===-1?'Work Canvas':'Home Canvas';
  camera.setAttribute('aria-label',target===1?'Return to Home Canvas':'Open Camera Canvas');
  workLogo.setAttribute('aria-label',target===-1?'Return to Home Canvas':'Open Work Canvas');
  (canvasNavMenu||(target===1?back:target===-1?workBack:homeLogo)).focus({preventScroll:true});
 }
 function go(next){
  if(!ready)return;
  homeExpansion=0;
  target=next;cancelAnimationFrame(frame);home.inert=true;photos.inert=true;work.inert=true;
  photos.style.overflowY='hidden';
  work.style.overflowY='hidden';
  const from=progress,start=performance.now(),duration=1100*Math.abs(target-from);
  returnScroll=photos.scrollTop;
  if(reduced.matches){progress=target;if(!target){photos.scrollTop=0;work.scrollTop=0;}draw(progress);finish();return;}
  status.textContent=target===1?'Opening Camera Canvas':target===-1?'Opening Work Canvas':'Returning to Home Canvas';
  function tick(now){
   const t=clamp((now-start)/Math.max(1,duration));
   if(!target)photos.scrollTop=returnScroll*(1-ease(t));
   progress=from+(target-from)*t;draw(progress);
   if(t<1)frame=requestAnimationFrame(tick);else finish();
  }frame=requestAnimationFrame(tick);
 }
 function animateHomeState(next,onComplete){
  if(logoStateAnimating)return;
  if(reduced.matches){homeExpansion=next;placeCamera(progress);if(onComplete)onComplete();return;}
  logoStateAnimating=true;
  cancelAnimationFrame(logoFrame);
  const from=homeExpansion,start=performance.now(),duration=320*Math.abs(next-from);
  status.textContent=next?'Expanding Home Canvas':'Resetting canvas navigation';
  function tick(now){
   const t=clamp((now-start)/Math.max(1,duration));
   homeExpansion=from+(next-from)*ease(t);
   placeCamera(progress);
   if(t<1)logoFrame=requestAnimationFrame(tick);
   else {homeExpansion=next;logoStateAnimating=false;status.textContent='Home Canvas';if(onComplete)onComplete();}
  }
  logoFrame=requestAnimationFrame(tick);
 }
 let scrollingBack=false;
 function scrollCurrentToTop(onComplete){
  if(!ready||scrollingBack||logoStateAnimating)return;
  const active=target===0?home:target===-1?work:photos;
  if(reduced.matches||active.scrollTop<=0){active.scrollTo({top:0,behavior:'instant'});onComplete();return;}
  scrollingBack=true;
  cancelAnimationFrame(frame);
  const from=active.scrollTop,start=performance.now();
  const duration=Math.min(1200,Math.max(500,from*.65));
  status.textContent='Returning to the top of the current canvas';
  function tick(now){
   const t=clamp((now-start)/duration);
   active.scrollTop=from*(1-ease(t));placeCamera(progress);
   if(t<1)frame=requestAnimationFrame(tick);
   else {active.scrollTo({top:0,behavior:'instant'});scrollingBack=false;onComplete();}
  }
  frame=requestAnimationFrame(tick);
 }
 function navigateTo(next){
  if(!ready||scrollingBack||logoStateAnimating)return;
  const destination=next===0?home:next===-1?work:photos;
  scrollCurrentToTop(()=>{destination.scrollTo({top:0,behavior:'instant'});go(next);});
 }
 function navigateFromDefault(next){
  if(!ready||scrollingBack||logoStateAnimating)return;
  const active=target===0?home:target===-1?work:photos;
  if(active.scrollTop>0){scrollCurrentToTop(()=>navigateFromDefault(next));return;}
  if(homeExpansion>.001){animateHomeState(0,()=>navigateTo(next));return;}
  navigateTo(next);
 }
 function returnHome(){navigateFromDefault(0);}
 camera.addEventListener('click',()=>{
  if(scrollingBack||logoStateAnimating)return;
  if(target===1)navigateFromDefault(0);else navigateFromDefault(1);
 });
 entry.addEventListener('click',()=>navigateFromDefault(1));back.addEventListener('click',returnHome);
  homeLogo.addEventListener('click',()=>{
   if(scrollingBack||logoStateAnimating)return;
   if(target!==0){returnHome();return;}
   if(home.scrollTop>0){navigateFromDefault(0);return;}
   if(!root.classList.contains('is-mobile-canvas'))return;
   animateHomeState(homeExpansion>.5?0:1);
  });
 workLogo.addEventListener('click',()=>{if(scrollingBack||logoStateAnimating)return;if(target===-1)navigateFromDefault(0);else navigateFromDefault(-1);});
 workEntry.addEventListener('click',()=>navigateFromDefault(-1));workBack.addEventListener('click',returnHome);
 root.addEventListener('keydown',e=>{if(e.key==='Escape')returnHome();});
  window.addEventListener('hashchange',()=>{if(ready){const next=targetFromHash();if(next!==target){homeExpansion=0;go(next);}}});
  home.addEventListener('scroll',()=>{if(ready)placeCamera(progress);},{passive:true});
  photos.addEventListener('scroll',()=>{if(ready)placeCamera(progress);},{passive:true});
  work.addEventListener('scroll',()=>{if(ready)placeCamera(progress);},{passive:true});
 const observer=new ResizeObserver(()=>{if(ready)placeCamera(progress);});observer.observe(viewport);
 Promise.all([load(upperSrc),load(lowerSrc)]).then(images=>{[upper,lower]=images;ready=true;draw(0);camera.disabled=false;entry.disabled=false;workLogo.disabled=false;workEntry.disabled=false;status.textContent='Home Canvas';openInitialCanvas();}).catch(()=>{
  // Keep Photography reachable even if a cover texture fails to download.
  ready=true;
  draw(0);
  camera.disabled=false;entry.disabled=false;
  workLogo.disabled=false;workEntry.disabled=false;
  status.textContent='Camera animation unavailable. Photography is still available.';
  openInitialCanvas();
 });
})();
