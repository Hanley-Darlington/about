// World page: a 3D globe on which every country visited is unlocked.
// index.html imports this file the first time World is opened; the styles, the map and the globe library load from here.

const CDN='https://cdn.jsdelivr.net/npm/';
const V=new URL(import.meta.url).search;      // version tag from index.html, passed on to world.css and uk.json
const TOTAL=199;                              // 195 countries, with the United Kingdom counted as its four nations, plus Guernsey
const HOME={lat:46.8,lng:8.2,altitude:1.9};   // starting view and Recenter target: Switzerland

// Everywhere visited: name (lower-case) -> [country, pin lat, pin lng, display name]
// A line here unlocks its country straight away. Once a travels folder with the same name holds photos, it becomes an album.
// A travels folder named exactly after a country works without a line; any other folder without one is listed, but stays off the globe.
const PLACES={
  australia:['Australia',-25.3,133.8],
  austria:['Austria',47.6,14.1],
  bali:['Indonesia',-8.4,115.2],
  belgium:['Belgium',50.6,4.6],
  bordeaux:['France',44.84,-0.58],
  bosnia:['Bosnia',44,17.8],
  croatia:['Croatia',45.1,15.2],
  dubai:['United Arab Emirates',25.2,55.27,'Dubai'],
  england:['England',51.51,-0.12],
  galapagos:['Ecuador',-0.6,-90.5],
  germany:['Germany',51.1,10.4],
  greece:['Greece',38.3,23.3],
  guernsey:['Guernsey',49.45,-2.58],
  hawaii:['United States of America',20.8,-156.9],
  holland:['Holland',52.2,5.3],
  'isle of wight':['England',50.69,-1.3],
  italy:['Italy',41.9,12.5],
  la:['United States of America',34.05,-118.24,'LA'],
  maldives:['Maldives',3.2,73.2],
  'new zealand':['New Zealand',-41.3,173.5],
  norway:['Norway',61.5,9],
  philippines:['Philippines',14.6,121],
  qatar:['Qatar',25.3,51.2],
  scotland:['Scotland',56.8,-4.2],
  seychelles:['Seychelles',-4.68,55.49],
  singapore:['Singapore',1.35,103.82],
  'south africa':['South Africa',-29,24.5],
  spain:['Spain',40.2,-3.7],
  'sri lanka':['Sri Lanka',7.6,80.7],
  sweden:['Sweden',62,15],
  switzerland:['Switzerland',46.8,8.2],
  tanzania:['Tanzania',-6.4,34.9],
  tenerife:['Spain',28.29,-16.63,'Tenerife'],
  turkey:['Turkey',39,35.2],
  wales:['Wales',52.3,-3.7]
};
// atlas names shown under a different name
const NAMES={'Netherlands':'Holland','Bosnia and Herz.':'Bosnia'};

const LOCK='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const TEMPLATE=`
  <div class="world">
    <div class="world-stage">
      <div id="globe"></div>
      <p class="world-hint" id="worldHint">Loading…</p>
      <div class="world-tools hidden" id="worldTools">
        <button class="chip" type="button" data-zoom="1.45" aria-label="Zoom out">−</button>
        <button class="chip" type="button" id="worldHome">Recenter</button>
        <button class="chip" type="button" data-zoom="0.69" aria-label="Zoom in">+</button>
      </div>
    </div>
    <aside class="world-panel hidden" id="worldPanel">
      <div class="world-card world-detail" id="worldDetail"></div>
      <div class="world-card"><div class="world-count" id="worldCount"></div><div class="world-bar"><i id="worldBar"></i></div><div class="world-list" id="worldList"></div></div>
    </aside>
  </div>`;

const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const avg=(arr,k)=>arr.reduce((s,a)=>s+a[k],0)/arr.length;
const loadScript=src=>new Promise((res,rej)=>{const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(Error('Failed to load '+src)); document.head.appendChild(s);});
const css=new Promise((res,rej)=>{const l=document.createElement('link'); l.rel='stylesheet'; l.href=new URL('world.css'+V,import.meta.url); l.onload=res; l.onerror=()=>rej(Error('Failed to load world.css')); document.head.appendChild(l);});
// rough centre of a country: the average corner of its largest outline
const centre=f=>{const c=f.geometry.coordinates, ring=(f.geometry.type==='Polygon'?[c]:c).map(p=>p[0]).sort((a,b)=>b.length-a.length)[0].map(([lng,lat])=>({lat,lng})); return [avg(ring,'lat'),avg(ring,'lng')];};

export default function createWorld({$,fetchJSON,mapFile,imgNode,vidNode}){
  const still=matchMedia('(prefers-reduced-motion:reduce)').matches;
  let by=null, g=null, boot=null, active=false, seen=true, sel=null, hover=null, hold=false, timer=0;

  // places grouped by country, keyed by the lower-cased country name; a place whose travels folder has files is an album
  const groups=m=>{if(by) return by; by={};
    const folders=Object.fromEntries(Object.keys(m.travels).map(f=>[f.toLowerCase(),f]));
    const add=(folder,p)=>{const k=p[0].toLowerCase(), c=by[k]||(by[k]={name:p[0],places:[]});
      c.places.push({folder,title:p[3]||folder||p[0],lat:p[1],lng:p[2],files:(m.travels[folder]||[]).map(mapFile)});};
    Object.entries(PLACES).forEach(([k,p])=>add(folders[k],p));
    Object.entries(folders).forEach(([k,f])=>{if(!PLACES[k]) add(f,[f]);});
    Object.values(by).forEach(c=>{c.albums=c.places.filter(a=>a.files.length);});
    return by;};
  const country=name=>by[String(name||'').toLowerCase()];
  const isOpen=f=>!!country(f.properties.name);

  // One picture per country: a single album opens directly, several open the country's own page.
  const card=(href,lead,title,sub)=>{const a=document.createElement('a'); a.className='place'; a.href=href;
    a.appendChild(lead.type==='video'?vidNode(lead.src):imgNode(lead.src,title));
    const ov=document.createElement('div'); ov.className='overlay'; ov.innerHTML='<h4>'+esc(title)+'</h4><p>'+esc(sub)+'</p><span class="chip">View</span>';
    a.appendChild(ov); return a;};
  const albumCard=a=>card('#/travel/'+encodeURIComponent(a.folder),a.files[0],a.title,a.files.length+' files');
  const countryCard=c=>c.albums.length>1?card('#/world/'+encodeURIComponent(c.name),c.albums[0].files[0],c.albums.length+' albums',c.albums.map(a=>a.title).join(' · ')):albumCard(c.albums[0]);

  const showCountry=name=>{const c=country(name), grid=$('countryGrid'); $('countryTitle').textContent=c?c.name:name; grid.textContent='';
    if(c&&c.albums.length) c.albums.forEach(a=>grid.appendChild(albumCard(a)));
    else{const p=document.createElement('p'); p.textContent='Nothing yet.'; p.style.color='#9aa7bd'; grid.appendChild(p);}};

  // The globe only animates while its page is open and it is on screen; it only spins when nobody is touching it and no country is open.
  const sync=()=>{if(g) (active&&seen?g.resumeAnimation():g.pauseAnimation());};
  const spin=()=>{if(g) g.controls().autoRotate=!still&&!hold&&!country(sel);};
  const fit=()=>{const el=$('globe'); if(g&&el.clientWidth) g.width(el.clientWidth).height(el.clientHeight);};
  const paint=()=>g
    .polygonAltitude(f=>isOpen(f)?(f===hover||f.properties.name===sel?.05:.02):.006)
    .polygonCapColor(f=>isOpen(f)?(f.properties.name===sel?'#a78bfa':f===hover?'#67e8f9':'rgba(34,211,238,.8)'):(f===hover?'rgba(148,163,184,.32)':'rgba(148,163,184,.13)'));

  // at: where to fly to (the spot clicked, or a pin); defaults to the country's first album
  const select=(name,at)=>{
    const c=country(name), d=$('worldDetail'); sel=c?c.name:name||null; d.textContent='';
    [...$('worldList').children].forEach(b=>b.classList.toggle('on',b.textContent===sel));
    if(!sel) d.innerHTML='<p>Glowing countries are unlocked. Click one to see its photos.</p>';
    else if(!c) d.innerHTML='<h3>'+LOCK+esc(sel)+'</h3><p>Locked. No photos from here yet.</p>';
    else{
      const h=document.createElement('h3'); h.textContent=sel; d.appendChild(h);
      if(c.albums.length) d.appendChild(countryCard(c)); else d.insertAdjacentHTML('beforeend','<p>Unlocked. Photos coming soon.</p>');
      at=at||c.albums.find(a=>a.lat!=null)||c.places.find(a=>a.lat!=null);
      if(g&&at) g.pointOfView({lat:at.lat,lng:at.lng,altitude:1.25},900);
      if(matchMedia('(max-width:900px)').matches) d.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
    if(g) paint(); spin();
  };

  // a solid pin opens its album; a hollow one marks a place whose photos are not up yet
  const pin=a=>{const b=document.createElement('button'), n=a.files.length; b.type='button'; b.className=n?'g-pin':'g-pin soon'; b.setAttribute('aria-label',a.title);
    b.innerHTML='<span>'+esc(a.title)+(n?' · '+n+' files':'')+'</span>';
    b.onclick=()=>{if(n) location.hash='#/travel/'+encodeURIComponent(a.folder); else select(a.country,a);}; return b;};

  const init=async()=>{
    $('world').innerHTML=TEMPLATE;
    const [topo,uk]=await Promise.all([fetchJSON(CDN+'world-atlas@2.0.2/countries-110m.json'),fetchJSON(new URL('uk.json'+V,import.meta.url)),
      loadScript(CDN+'topojson-client@3.1.0/dist/topojson-client.min.js'),loadScript(CDN+'globe.gl@2.46.2/dist/globe.gl.min.js')]);
    // the atlas draws the United Kingdom as one shape; uk.json replaces it with England, Scotland, Wales and Northern Ireland
    const feats=topojson.feature(topo,topo.objects.countries).features.filter(f=>f.properties.name!=='Antarctica'&&f.properties.name!=='United Kingdom').concat(uk.features);
    feats.forEach(f=>{f.properties.name=NAMES[f.properties.name]||f.properties.name;});
    // it also draws French Guiana as part of France; give it its own shape so that France stays in Europe
    const fr=feats.find(f=>f.properties.name==='France'), overseas=p=>p[0][0][0]<-30;
    feats.push({type:'Feature',properties:{name:'French Guiana'},geometry:{type:'MultiPolygon',coordinates:fr.geometry.coordinates.filter(overseas)}});
    fr.geometry.coordinates=fr.geometry.coordinates.filter(p=>!overseas(p));

    const byName=Object.fromEntries(feats.map(f=>[f.properties.name.toLowerCase(),f]));
    Object.entries(by).forEach(([k,c])=>{const f=byName[k]; if(f) c.name=f.properties.name;
      c.places.forEach(a=>{a.country=c.name; if(a.lat==null&&f) [a.lat,a.lng]=centre(f);
        // a country that has a shape on the globe only gets a pin once it has photos
        a.pin=a.lat!=null&&(a.files.length>0||!f||a.title!==c.name);});
      c.placed=c.places.some(a=>a.lat!=null);});

    const list=Object.values(by).sort((a,b)=>a.name.localeCompare(b.name)), count=list.filter(c=>c.placed).length;
    $('worldCount').innerHTML=count+' <small>of '+TOTAL+' countries unlocked</small>';
    $('worldBar').style.width=(count/TOTAL*100)+'%';
    list.forEach(c=>{const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=c.name; b.onclick=()=>select(c.name===sel?null:c.name); $('worldList').appendChild(b);});
    $('worldPanel').classList.remove('hidden'); select(null);

    try{
      g=new Globe($('globe'))
        .backgroundColor('rgba(0,0,0,0)').atmosphereColor('#22d3ee').atmosphereAltitude(.17).showGraticules(true)
        .polygonsData(feats).polygonsTransitionDuration(250)
        .polygonSideColor(f=>isOpen(f)?'rgba(34,211,238,.28)':'rgba(0,0,0,0)')
        .polygonStrokeColor(f=>isOpen(f)?'#cffafe':'rgba(148,163,184,.3)')
        .polygonLabel(f=>{const n=f.properties.name, c=country(n), k=c&&c.albums.length; return '<b>'+esc(n)+'</b><br>'+(k?k+(k>1?' albums':' album')+' · click to open':c?'Photos coming soon':LOCK+' Locked');})
        .onPolygonHover(f=>{hover=f; paint();})
        .onPolygonClick((f,e,at)=>select(f.properties.name,at))
        .onGlobeClick(()=>select(null))
        .showPointerCursor((type,d)=>type==='polygon'&&isOpen(d))
        .htmlElementsData(list.flatMap(c=>c.places).filter(a=>a.pin)).htmlElement(pin).htmlAltitude(.03)
        .pointOfView(HOME);
    }catch(e){$('worldHint').textContent='3D is not available in this browser. Use the list instead.'; return;}
    const mat=g.globeMaterial(); mat.color.set('#0c1526'); mat.emissive.set('#0a1730'); mat.shininess=6;
    const ctl=g.controls(); ctl.autoRotateSpeed=.55; ctl.enablePan=false; ctl.enableZoom=false;   // no scroll or pinch zoom: the − and + buttons do it
    paint(); spin(); fit(); new ResizeObserver(fit).observe($('globe'));
    const stage=$('globe').parentNode;
    stage.addEventListener('pointerenter',()=>{clearTimeout(timer); hold=true; spin();});
    stage.addEventListener('pointerleave',()=>{timer=setTimeout(()=>{hold=false; spin();},1200);});
    new IntersectionObserver(([e])=>{seen=e.isIntersecting; sync();}).observe(stage);
    $('worldHome').onclick=()=>{select(null); g.pointOfView(HOME,900);};
    // the − and + buttons step the camera in and out, between a close-up and the whole globe
    $('worldTools').querySelectorAll('[data-zoom]').forEach(b=>{b.onclick=()=>g.pointOfView({altitude:Math.min(3.3,Math.max(.4,g.pointOfView().altitude*b.dataset.zoom))},300);});
    $('worldTools').classList.remove('hidden');
    $('worldHint').textContent='Drag to spin';
  };

  // open(m) shows the globe; open(m,'England') fills the country page with that country's albums
  const open=(m,name)=>{
    active=!name; sync(); groups(m);
    css.then(()=>name?showCountry(name):(boot||(boot=init())).then(()=>{fit(); sync();}))
      .catch(()=>{boot=null; ($('worldHint')||$('world')).textContent='Could not load the globe. Check your connection and try again.';});
  };
  const close=()=>{active=false; sync();};
  return {open,close};
}
