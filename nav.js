(()=>{
 const nav=document.querySelector('.canvas-nav,.photo-site-header.site-nav');
 if(!nav)return;
 const menuButton=nav.querySelector('.menu-toggle');
 const contactButton=nav.querySelector('.contact-toggle');
 const menu=document.createElement('div');
 menu.id='page-map';
 menu.className='nav-popover page-map';
 menu.hidden=true;
 menu.innerHTML='<h2>Page map</h2><nav><a href="./index.html">Home</a><a href="./index.html#photography">Photography</a><a href="./index.html#work">Work</a></nav>';
 const contact=document.createElement('div');
 contact.id='contact-panel';
 contact.className='nav-popover contact-panel';
 contact.hidden=true;
 contact.innerHTML='<h2>Contact</h2><p>Contact details coming soon.</p>';
 nav.insertAdjacentElement('afterend',menu);
 nav.insertAdjacentElement('afterend',contact);
 function closeAll(){menu.hidden=true;contact.hidden=true;menuButton.setAttribute('aria-expanded','false');contactButton.setAttribute('aria-expanded','false');}
 menuButton.addEventListener('click',()=>{const open=menu.hidden;closeAll();menu.hidden=!open;menuButton.setAttribute('aria-expanded',String(!menu.hidden));});
 contactButton.addEventListener('click',()=>{const open=contact.hidden;closeAll();contact.hidden=!open;contactButton.setAttribute('aria-expanded',String(!contact.hidden));});
 document.addEventListener('click',event=>{if(!nav.contains(event.target)&&!menu.contains(event.target)&&!contact.contains(event.target))closeAll();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')closeAll();});
})();
