/*
 * Nav pop-ups. Shared by the root index.html and the pages inside photography/.
 * Builds two small panels ("Page map" and "Contact") and wires their toggle
 * buttons so opening one closes the other, and clicking away / Escape closes
 * both. Buttons keep aria-expanded in sync for screen readers.
 */
(()=>{
 const nav=document.querySelector('.canvas-nav,.photo-site-header.site-nav');
 if(!nav)return;

 // Links point at the site root; add "../" when we're one folder deep.
 const toRoot=/\/photography\//.test(location.pathname)?'../':'./';

 // Builds a hidden pop-up, inserts it after the nav, and returns it.
 function makePopover(id,className,html){
  const el=document.createElement('div');
  el.id=id;
  el.className='nav-popover '+className;
  el.hidden=true;
  el.innerHTML=html;
  nav.insertAdjacentElement('afterend',el);
  return el;
 }

 const menuButton=nav.querySelector('.menu-toggle');
 const contactButton=nav.querySelector('.contact-toggle');
 const menu=makePopover('page-map','page-map',
    '<h2>wizark\'s Portfolio</h2><nav>'+
  '<a href="'+toRoot+'index.html">Home</a>'+
  '<a href="'+toRoot+'index.html#photography">Photography</a>'+
  '<a href="'+toRoot+'index.html#work">Work</a>'+
  '<a href="'+toRoot+'index.html#notes">Notes</a></nav>');
 const contact=makePopover('contact-panel','contact-panel',
  '<h2>Contact</h2><p>Contact details coming soon.</p>');

 function closeAll(){
  menu.hidden=true;
  contact.hidden=true;
  menuButton.setAttribute('aria-expanded','false');
  contactButton.setAttribute('aria-expanded','false');
 }

 // Toggles one panel closed<->open while closing its sibling.
 function wireToggle(button,panel){
  button.addEventListener('click',()=>{
   const shouldOpen=panel.hidden;
   closeAll();
   panel.hidden=!shouldOpen;
   button.setAttribute('aria-expanded',String(!panel.hidden));
  });
 }
 wireToggle(menuButton,menu);
 wireToggle(contactButton,contact);

 document.addEventListener('click',event=>{
  if(!nav.contains(event.target)&&!menu.contains(event.target)&&!contact.contains(event.target))closeAll();
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAll();});
})();
