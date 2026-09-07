
(()=>{
 const root=document.getElementById('camera-portfolio');
 const track=root.querySelector('.track'),camera=root.querySelector('.camera'),entry=root.querySelector('.entry'),back=root.querySelector('.back'),home=root.querySelector('.home'),photos=root.querySelector('.photos'),status=root.querySelector('.status');
 const viewport=root.querySelector('.viewport'),brand=root.querySelector('.page-brand');
 track.appendChild(camera);
 const ctx=root.querySelector('.cover').getContext('2d');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const upperSrc='./assets/lens-cover-upper.png',lowerSrc='./assets/lens-cover-lower.png',referenceSrc='./assets/camera-concept-reference.webp';
 const aperture=new Path2D('M89 0 L258 0 Q346 0 346 87 L346 189 Q346 284 257 284 L89 284 Q0 284 0 195 L0 88 Q0 0 89 0 Z');
 let upper,lower,progress=0,target=0,frame=0,ready=false,returnScroll=0;
 const clamp=x=>Math.max(0,Math.min(1,x));const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
 function load(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
 function panel(img,d,p){ctx.save();ctx.scale(346/400,284/400);const pivot=d<0?[380,16]:[20,384];ctx.translate(pivot[0]-d*63*p,pivot[1]+d*385*p);ctx.rotate(p*.065);ctx.translate(-pivot[0],-pivot[1]);ctx.drawImage(img,0,0);ctx.restore();}


 function placeCamera(p){
  const vw=viewport.clientWidth;
  const vh=viewport.clientHeight;
  const startWidth=Math.min(vw-32,vw<=380?380:420,Math.max(120,(vh-130)*2048/1250));
  const startY=Math.min(vw<=380?220:230,Math.max(80,vh*.28));
  const scroll=ease(photos.scrollTop/(startY-16));
  const width=startWidth+(72-startWidth)*scroll;
  const centeredX=(vw-startWidth)/2;
  const travel=centeredX+startWidth*.6;
  // The camera is attached to the same world as the gradient and page content.
  // Only the world translates during entry. Local height and scale stay fixed.
  track.style.width=(vw+travel)+'px';
  track.style.setProperty('--view-width',vw+'px');
  track.style.setProperty('--travel',travel+'px');
  track.style.transform='translateX('+(-travel*(1-ease(p)))+'px)';
  // Match the content's one-pixel-per-pixel scroll until the header catches it.
  const x=(vw-width)/2,y=Math.max(16,startY-photos.scrollTop);
  camera.style.left='0px';camera.style.top='0px';
  camera.style.width=startWidth+'px';camera.style.height=(startWidth*1250/2048)+'px';
  camera.style.transform='translate('+x+'px,'+y+'px) scale('+(width/startWidth)+')';
  root.querySelector('.gallery').style.paddingTop=(startY+startWidth*1250/2048+32)+'px';
  home.style.opacity=String(1-ease(p/.65));
  home.style.pointerEvents=p===0?'auto':'none';
  photos.style.pointerEvents=p===1?'auto':'none';
  photos.style.overflowY=p===1?'auto':'hidden';
  root.querySelector('.photos header').style.opacity=String(ease((p-.35)/.65));
  root.querySelector('.gallery').style.opacity=String(ease(p));
  brand.style.opacity='0';
 }
 function draw(p){
  if(!ready)return;
  const lens=ease(p/.65);
  placeCamera(p);
  ctx.clearRect(0,0,346,284);ctx.save();ctx.clip(aperture);
  if(lens<1 && upper && lower){panel(upper,-1,lens);panel(lower,1,lens);}ctx.restore();
 }
 function finish(){
  home.inert=Boolean(target);photos.inert=!target;
  status.textContent=target?'Photography. Scroll down to turn the camera into the page logo.':'Camera entrance';
  camera.setAttribute('aria-label',target?'Photography — back to top':'Open Photography');
  (target?back:camera).focus({preventScroll:true});
 }
 function go(next){
  if(!ready)return;
  target=next;cancelAnimationFrame(frame);home.inert=false;photos.inert=false;
  photos.style.overflowY='hidden';
  const from=progress,start=performance.now(),duration=1100*Math.abs(target-from);
  returnScroll=photos.scrollTop;
  if(reduced.matches){progress=target;if(!target)photos.scrollTop=0;draw(progress);finish();return;}
  status.textContent=target?'Opening Photography':'Returning';
  function tick(now){
   const t=clamp((now-start)/Math.max(1,duration));
   if(!target)photos.scrollTop=returnScroll*(1-ease(t));
   progress=from+(target-from)*t;draw(progress);
   if(t<1)frame=requestAnimationFrame(tick);else finish();
  }frame=requestAnimationFrame(tick);
 }
 camera.addEventListener('click',()=>{
  if(progress===1&&target===1)photos.scrollTo({top:0,behavior:reduced.matches?'instant':'smooth'});
  else go(1);
 });
 entry.addEventListener('click',()=>go(1));back.addEventListener('click',()=>go(0));
 root.addEventListener('keydown',e=>{if(e.key==='Escape')go(0);});
 photos.addEventListener('scroll',()=>{if(ready)placeCamera(progress);},{passive:true});
 const observer=new ResizeObserver(()=>{if(ready)placeCamera(progress);});observer.observe(viewport);
 Promise.all([load(upperSrc),load(lowerSrc)]).then(images=>{[upper,lower]=images;ready=true;draw(0);camera.disabled=false;entry.disabled=false;status.textContent='Camera entrance';}).catch(()=>{
  // Keep Photography reachable even if a cover texture fails to download.
  ready=true;
  draw(0);
  camera.disabled=false;entry.disabled=false;
  status.textContent='Camera animation unavailable. Photography is still available.';
 });
 load(referenceSrc).then(img=>{const canvases=root.querySelectorAll('.gallery canvas');const crops=[[1348,263,274,314],[1348,588,132,178],[1491,588,132,178]];canvases.forEach((canvas,i)=>{canvas.getContext('2d').drawImage(img,...crops[i],0,0,canvas.width,canvas.height);});}).catch(()=>{status.textContent='Sample photographs could not load.';});
})();
