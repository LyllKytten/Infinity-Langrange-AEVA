/* Fleet Architect — no build tools, account login or dependencies. */
(() => {
  'use strict';
  const STORAGE_KEY = 'fleet-architect-v1';
  const RESET_BACKUP_KEY = 'fleet-architect-pre-reset';
  const AIR_TYPES = new Set(['Fighter', 'Corvette']);
  const TYPES = ['Frigate','Destroyer','Cruiser','Battlecruiser','Carrier','Fighter','Corvette'];
  const ROWS = ['Front','Middle','Back','Aircraft'];
  const CONFIG = {
    offensive: {label:'OFFENSIVE STRIKE', w:{atk:5,tank:1.35,aa:1.15,support:.7}},
    balanced: {label:'BALANCED OPERATIONS', w:{atk:3,tank:2.8,aa:2.0,support:1.6}},
    defensive: {label:'DEFENSIVE HOLD', w:{atk:1.65,tank:4.5,aa:3.5,support:2.65}}
  };
  const $ = (selector,root=document) => root.querySelector(selector);
  const $$ = (selector,root=document) => [...root.querySelectorAll(selector)];
  const clone = x => JSON.parse(JSON.stringify(x));
  const int = (n,fallback=0,min=0,max=2000) => Number.isFinite(Number(n)) ? Math.max(min,Math.min(max,Math.round(Number(n)))) : fallback;
  const clampRating = n => int(n,2,1,5);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initial = () => ({version:1,settings:{cp:240,strategy:'balanced',airThreat:true,preferAircraft:true},ships:[]});
  let state;
  try {
    const local = JSON.parse(localStorage.getItem(STORAGE_KEY));
    state = local && Array.isArray(local.ships) ? normalizeState(local) : initial();
  } catch { state=initial(); }
  let lastFleet = null;
  let editingId = null;
  const selectedVariants = new Map();
  const expandedStats = new Set();
  let toastTimeout;

  function normalizeShip(ship,i){
    if (!ship || typeof ship!=='object' || !String(ship.name||'').trim()) return null;
    const type = TYPES.includes(ship.type) ? ship.type : 'Frigate';
    const row = AIR_TYPES.has(type) ? 'Aircraft' : ROWS.slice(0,3).includes(ship.row) ? ship.row : 'Middle';
    return {
      id:String(ship.id||`imported-${i}`).slice(0,90), name:String(ship.name).trim().slice(0,80),
      variant:String(ship.variant||'').slice(0,80),type,row,
      cp:AIR_TYPES.has(type)?0:int(ship.cp,5,0,200),
      owned:Boolean(ship.owned),qty:int(ship.qty,1,0,99),
      atk:clampRating(ship.atk),tank:clampRating(ship.tank),aa:clampRating(ship.aa),support:clampRating(ship.support),
      fighterSlots:int(ship.fighterSlots,0,0,60),largeFighterSlots:int(ship.largeFighterSlots,0,0,60),
      corvetteSlots:int(ship.corvetteSlots,0,0,60),size:ship.size==='Large'?'Large':'Medium',
      notes:String(ship.notes||'').slice(0,700)
    };
  }
  function normalizeState(raw){
    const s=raw.settings||{};
    const ships=(raw.ships||[]).slice(0,500).map(normalizeShip).filter(Boolean);
    const taken=new Set();
    ships.forEach((ship,i)=>{if(taken.has(ship.id))ship.id=`${ship.id}-${i}`;taken.add(ship.id)});
    return {version:1,settings:{cp:int(s.cp,240,10,2000),strategy:CONFIG[s.strategy]?s.strategy:'balanced',airThreat:s.airThreat!==false,preferAircraft:s.preferAircraft!==false},ships};
  }
  function save(){
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
    catch {toast('Browser storage is unavailable. Export a JSON backup to save your work.');}
  }
  function toast(message){
    const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimeout);
    toastTimeout=setTimeout(()=>el.classList.remove('show'),3600);
  }
  function isAir(ship){return AIR_TYPES.has(ship.type)}
  function shipScore(ship,settings){
    const w=CONFIG[settings.strategy].w;
    const aaWeight=w.aa*(settings.airThreat?1.6:0.75);
    return ship.atk*w.atk + ship.tank*w.tank + ship.aa*aaWeight + ship.support*w.support;
  }
  function shipName(ship){return ship.name + (ship.variant?` · ${ship.variant}`:'')}
  function buildFleet(){
    const {cp:limit}=state.settings;
    const owned=state.ships.filter(s=>s.owned&&s.qty>0);
    const nonAir=owned.filter(s=>!isAir(s)&&s.cp>0);
    const availableAir=owned.filter(isAir);
    const remaining=new Map(nonAir.map(s=>[s.id,s.qty]));
    const roster=new Map();let spent=0, iterations=0;
    const hasFighter=availableAir.some(s=>s.type==='Fighter');
    const hasLargeFighter=availableAir.some(s=>s.type==='Fighter'&&s.size==='Large');
    const hasCorvette=availableAir.some(s=>s.type==='Corvette');
    function count(id){return roster.get(id)||0}
    function take(ship){roster.set(ship.id,count(ship.id)+1);remaining.set(ship.id,remaining.get(ship.id)-1);spent+=ship.cp}
    function choose(onlyFront=false){
      let best=null,bestScore=-Infinity;
      for(const ship of nonAir){
        if((remaining.get(ship.id)||0)<=0||spent+ship.cp>limit)continue;
        if(onlyFront&&ship.row!=='Front')continue;
        let score=shipScore(ship,state.settings)/Math.pow(ship.cp,.63);
        const current=count(ship.id);
        score*=1/(1+current*.12); // spread the roster rather than endlessly stacking a single hull
        if(ship.row==='Front'&&frontCp()<limit*.22)score+=2.2;
        if(ship.aa>=4&&state.settings.airThreat)score+=1.5;
        if(state.settings.preferAircraft){
          const fighterFits=hasFighter&&ship.fighterSlots>0&&(!hasLargeFighter||ship.largeFighterSlots>0||availableAir.some(a=>a.type==='Fighter'&&a.size!=='Large'));
          const corvetteFits=hasCorvette&&ship.corvetteSlots>0;
          if(fighterFits||corvetteFits){
            const hangarAlready=hangars();
            const needF=Math.max(0,availableAir.filter(a=>a.type==='Fighter').reduce((n,a)=>n+a.qty,0)-hangarAlready.f);
            const needC=Math.max(0,availableAir.filter(a=>a.type==='Corvette').reduce((n,a)=>n+a.qty,0)-hangarAlready.c);
            if((fighterFits&&needF>0)||(corvetteFits&&needC>0))score+=4;
          }
        }
        if(score>bestScore){best=ship;bestScore=score;}
      }
      return best;
    }
    function frontCp(){let v=0;for(const [id,qty] of roster){const s=nonAir.find(x=>x.id===id);if(s&&s.row==='Front')v+=s.cp*qty;}return v;}
    function hangars(){let f=0,c=0,l=0;for(const [id,qty] of roster){const s=nonAir.find(x=>x.id===id);if(!s)continue;f+=(s.fighterSlots||0)*qty;c+=(s.corvetteSlots||0)*qty;l+=Math.min(s.largeFighterSlots||0,s.fighterSlots||0)*qty;}return {f,c,l}}
    // Reserve a reasonable frontline when any eligible front-row hulls exist.
    while(iterations++<50&&frontCp()<limit*.18){const ship=choose(true);if(!ship)break;take(ship)}
    // Ensure at least one suitable aircraft host if requested and affordable.
    if(state.settings.preferAircraft&&availableAir.length){
      const fit=nonAir.filter(s=>remaining.get(s.id)>0&&spent+s.cp<=limit&&((hasCorvette&&s.corvetteSlots>0)||(hasFighter&&s.fighterSlots>0&&(!hasLargeFighter||s.largeFighterSlots>0||availableAir.some(a=>a.type==='Fighter'&&a.size!=='Large')))));
      const already=hangars();
      if(!already.f&&!already.c&&fit.length){fit.sort((a,b)=>shipScore(b,state.settings)/b.cp-shipScore(a,state.settings)/a.cp);take(fit[0]);}
    }
    iterations=0;
    while(iterations++<350){const ship=choose();if(!ship)break;take(ship)}
    const hulls=[...roster].map(([id,qty])=>({ship:nonAir.find(s=>s.id===id),qty})).filter(x=>x.ship);
    const capacity=hangars();
    let fighters=capacity.f,large=capacity.l,corvettes=capacity.c;
    let assignments=[];
    const fighterPool=availableAir.filter(s=>s.type==='Fighter').sort((a,b)=>{
      if(a.size!==b.size)return a.size==='Large'?-1:1;return shipScore(b,state.settings)-shipScore(a,state.settings);
    });
    for(const ship of fighterPool){
      let count=ship.size==='Large'?Math.min(ship.qty,fighters,large):Math.min(ship.qty,fighters);
      if(count>0){assignments.push({ship,qty:count});fighters-=count;if(ship.size==='Large')large-=count;}
    }
    const corvettePool=availableAir.filter(s=>s.type==='Corvette').sort((a,b)=>shipScore(b,state.settings)-shipScore(a,state.settings));
    for(const ship of corvettePool){const count=Math.min(ship.qty,corvettes);if(count>0){assignments.push({ship,qty:count});corvettes-=count;}}
    return {limit,spent,hulls,assignments,capacity,owned,nonAir,availableAir,missingAircraft:availableAir.reduce((n,s)=>n+s.qty,0)-assignments.reduce((n,a)=>n+a.qty,0)};
  }
  function totals(fleet){
    const ts={atk:0,tank:0,aa:0,support:0};
    for(const {ship,qty} of [...fleet.hulls,...fleet.assignments])for(const key of Object.keys(ts))ts[key]+=ship[key]*qty*(isAir(ship)?.7:1);
    return ts;
  }
  function diagnostics(fleet){
    const notes=[];
    const totalHull=fleet.hulls.reduce((n,x)=>n+x.qty,0);
    const front=fleet.hulls.filter(x=>x.ship.row==='Front').reduce((n,x)=>n+x.qty,0);
    const back=fleet.hulls.filter(x=>x.ship.row==='Back').reduce((n,x)=>n+x.qty,0);
    if(!fleet.owned.length) return [{level:'warning',message:'No owned blueprints selected. Visit My Blueprints to choose your ships.'}];
    if(!totalHull) return [{level:'danger',message:'No deployable hulls fit the CP limit. Check CP values and available copies.'}];
    if(front===0)notes.push({level:'warning',message:'No front-row hulls. Direct-fire threats may reach your middle and back rows sooner.'});
    else notes.push({level:'ok',message:`Front line: ${front} hull${front===1?'':'s'} available to absorb incoming direct-fire pressure.`});
    if(state.settings.airThreat){
      const a = totals(fleet).aa/Math.max(1,totalHull+fleet.assignments.reduce((n,x)=>n+x.qty,0)*.7);
      if(a<2)notes.push({level:'warning',message:'Limited anti-air coverage. Consider AA hulls or fighter interceptors.'});
      else notes.push({level:'ok',message:'AA capability is represented, but firing priority and range still determine actual protection.'});
    }
    if(fleet.missingAircraft>0)notes.push({level:'warning',message:`${fleet.missingAircraft} aircraft not assigned. Check host capacity and fighter-size compatibility.`});
    if(back>0&&front===0)notes.push({level:'warning',message:'Back-row aircraft hosts are exposed without a frontline.'});
    if(fleet.hulls.some(x=>x.ship.id==='storm'))notes.push({level:'warning',message:'Eternal Storm occupies the middle row; hostile aircraft may bypass your front line. AA screening is not a guaranteed shield.'});
    if(fleet.spent<fleet.limit*.65)notes.push({level:'info',message:'Substantial CP remains unused. You may need more buildable hulls or adjusted CP values.'});
    if(notes.length===0)notes.push({level:'ok',message:'Basic formation checks pass. Test the composition against real battle reports.'});
    return notes.slice(0,6);
  }
  function fleetMarkup(fleet){
    const rows=['Front','Middle','Back'];
    $('#formation-rows').innerHTML=rows.map(row=>{
      const ships=fleet.hulls.filter(x=>x.ship.row===row).sort((a,b)=>b.qty-a.qty);
      const total=ships.reduce((n,x)=>n+x.qty,0);
      return `<div class="row-block"><div class="row-heading"><span>${row.toUpperCase()} ROW</span><strong>${total} HULL${total===1?'':'S'}</strong></div><div class="ship-chips">${ships.length?ships.map(({ship,qty})=>`<div class="ship-chip"><span class="ship-symbol">${row==='Front'?'⬡':row==='Middle'?'✧':'◇'}</span><span><b>${esc(ship.name)}</b><br><small>${esc(ship.variant)}</small></span><strong>×${qty}</strong></div>`).join(''):'<div class="empty-row">No ships assigned to this row.</div>'}</div></div>`;
    }).join('');
    $('#aircraft-list').innerHTML=fleet.assignments.length?fleet.assignments.map(({ship,qty})=>`<span class="aircraft-pill">${ship.type==='Fighter'?'✦':'◆'} ${esc(ship.name)} ×${qty}</span>`).join(''):'<span class="empty-row">No aircraft loaded into the available hangars.</span>';
  }
  function renderReadouts(fleet){
    const notes=diagnostics(fleet);
    $('#readouts').innerHTML=notes.map(x=>`<div class="readout ${x.level==='ok'?'':esc(x.level)}"><span class="readout-icon">${x.level==='ok'?'✓':x.level==='danger'?'✕':x.level==='warning'?'⚠':'ⓘ'}</span><span>${esc(x.message)}</span></div>`).join('');
    const t=totals(fleet);
    const highest=Math.max(1,...Object.values(t));
    $('#role-bars').innerHTML=[['atk','Attack'],['tank','Defense'],['aa','Anti-air'],['support','Support']].map(([key,label])=>`<div class="role-item"><div><span>${label}</span><strong>${Math.round(t[key])} pts</strong></div><div class="role-track"><span style="width:${t[key]/highest*100}%"></span></div></div>`).join('');
  }
  function renderFleet(){
    const fleet=buildFleet();lastFleet=fleet;
    const count=fleet.hulls.reduce((n,x)=>n+x.qty,0);
    const aircraft=fleet.assignments.reduce((n,x)=>n+x.qty,0);
    const empty=state.ships.every(s=>!s.owned);
    $('#fleet-empty-state').hidden=!empty;
    $('#fleet-workspace').hidden=empty;
    $('#stat-cp').innerHTML=`${fleet.spent} <span>/ ${fleet.limit}</span>`;
    $('#cp-fill').style.width=`${Math.min(100,fleet.spent/fleet.limit*100)}%`;
    $('#stat-ships').textContent=count;
    $('#stat-aircraft').textContent=aircraft;
    $('#aircraft-sub').textContent=`${fleet.capacity.f} fighter / ${fleet.capacity.c} corvette slots`;
    const status=count===0?'NO FLEET':fleet.missingAircraft>0?'REVIEW':'PLANNED';
    $('#stat-status').textContent=status;
    $('#stat-status').style.color=count===0?'var(--red)':fleet.missingAircraft>0?'var(--amber)':'var(--aqua)';
    $('#status-sub').textContent=count===0?'Check your inventory':`${Math.round(fleet.spent/fleet.limit*100)}% budget allocated`;
    fleetMarkup(fleet);renderReadouts(fleet);
    renderUpgrades();
  }
  function familyKey(ship){return `${ship.type}::${ship.name.trim().toLocaleLowerCase()}`;}
  function getActiveVariant(key, variants){
    return variants.find(ship=>ship.id===selectedVariants.get(key)) || variants.find(ship=>ship.owned) || variants[0];
  }
  function statsEditorField(ship, key, title, min=0, max=200){
    return `<label class="inline-stat-field">${title}<input type="number" min="${min}" max="${max}" value="${ship[key]}" data-stat-id="${esc(ship.id)}" data-stat-field="${key}" aria-label="${title} for ${esc(shipName(ship))}"></label>`;
  }

  function cardForShip(s){
    const open=expandedStats.has(s.id);
    const measures=[['CP cost',s.cp],['Battle row',s.row],['Attack',`${s.atk}/5`],['Defense',`${s.tank}/5`],['Anti-air',`${s.aa}/5`],['Support',`${s.support}/5`],['Fighter slots',s.fighterSlots],['Large fighter slots',s.largeFighterSlots],['Corvette slots',s.corvetteSlots],['Aircraft size',isAir(s)?s.size:'N/A']];
    return `<article class="inventory-row ${s.owned?'is-owned':'not-owned'}">
      <div class="inventory-line">
        <div class="inventory-identity"><strong>${esc(s.name)}</strong><span class="inventory-variant">${esc(s.variant||'Base variant')}</span><span class="inventory-class">${esc(s.type)}</span></div>
        <label class="inventory-owned"><input type="checkbox" data-owned-id="${esc(s.id)}" ${s.owned?'checked':''}/><span>Owned</span></label>
        <button type="button" class="inventory-expand-button" data-expand-id="${esc(s.id)}" aria-expanded="${open}" aria-controls="inventory-body-${esc(s.id)}">${open?'Hide stats ▲':'View stats ▼'}</button>
      </div>
      <div class="inventory-detail-body" id="inventory-body-${esc(s.id)}" ${open?'':'hidden'}>
        <div class="ship-metrics" aria-label="Stats for ${esc(shipName(s))}">
          ${measures.map(([label,value])=>`<div class="ship-metric"><small>${label}</small><strong>${esc(value)}</strong></div>`).join('')}
          <div class="ship-metric quantity-metric"><label for="quantity-${esc(s.id)}">Available copies</label><input id="quantity-${esc(s.id)}" type="number" min="0" max="99" value="${s.qty}" data-quantity-id="${esc(s.id)}"></div>
        </div>
        ${s.notes?`<p class="ship-note">${esc(s.notes)}</p>`:''}
        <p class="stats-caveat">Role ratings are planning estimates, not verified game statistics.</p>
        <details class="inline-details"><summary>Adjust stats <span class="details-hint">Optional · saves automatically</span></summary>
          <div class="inline-fields">
            <label class="inline-stat-field">Battle row<select data-stat-id="${esc(s.id)}" data-stat-field="row" ${isAir(s)?'disabled':''}>${['Front','Middle','Back','Aircraft'].map(x=>`<option ${x===s.row?'selected':''}>${x}</option>`).join('')}</select></label>
            <label class="inline-stat-field">Aircraft size<select data-stat-id="${esc(s.id)}" data-stat-field="size">${['Medium','Large'].map(x=>`<option ${x===s.size?'selected':''}>${x}</option>`).join('')}</select></label>
            ${statsEditorField(s,'cp','CP cost',0,200)}
            ${statsEditorField(s,'atk','Attack',1,5)}
            ${statsEditorField(s,'tank','Defense',1,5)}
            ${statsEditorField(s,'aa','Anti-air',1,5)}
            ${statsEditorField(s,'support','Support',1,5)}
            ${statsEditorField(s,'fighterSlots','Fighter slots',0,60)}
            ${statsEditorField(s,'largeFighterSlots','Large fighter slots',0,60)}
            ${statsEditorField(s,'corvetteSlots','Corvette slots',0,60)}
            <label class="inline-stat-field full">Notes<textarea maxlength="700" rows="2" data-stat-id="${esc(s.id)}" data-stat-field="notes">${esc(s.notes)}</textarea></label>
          </div>
        </details>
      </div>
    </article>`;
  }
  function renderRegistry(){
    const q=$('#ship-search').value.trim().toLowerCase(),cls=$('#ship-class-filter').value,ownedOnly=$('#owned-filter').checked;
    const list=state.ships.filter(s=>(!ownedOnly||s.owned)&&(cls==='all'||s.type===cls)&&(!q||`${s.name} ${s.variant} ${s.type}`.toLowerCase().includes(q)));
    list.sort((a,b)=>Number(b.owned)-Number(a.owned)||a.name.localeCompare(b.name)||a.variant.localeCompare(b.variant));
    const noOwned=state.ships.every(s=>!s.owned);
    const pristine=noOwned&&ownedOnly&&!q&&cls==='all';
    $('#ship-grid').innerHTML=list.length?list.map(cardForShip).join(''):pristine?
      '<div class="inventory-empty"><span class="welcome-icon" aria-hidden="true">▦</span><h3>Your inventory is empty</h3><p>Add ships from the catalog to build your fleet.</p><button id="add-first-blueprint" type="button" class="button primary">+ Add your first blueprint</button></div>':
      '<div class="empty-note">No matching blueprints. Adjust the search or filters.</div>';
    $('#reset-inventory').disabled=state.ships.length===0;
    $('#registry-summary').textContent=`${list.length} blueprints shown · ${state.ships.filter(s=>s.owned).length} owned · ${state.ships.length} in workspace`;
    $('#nav-owned').textContent=state.ships.filter(s=>s.owned).length;
  }
  function updateBlueprintAfterInlineChange(ship){
    save();renderRegistry();renderFleet();
  }
  function updateInlineField(input){
    const ship=state.ships.find(s=>s.id===input.dataset.statId);if(!ship)return;
    const field=input.dataset.statField;
    if(field==='variant'){
      const value=input.value.trim();
      if(!value){toast('Variant name cannot be empty.');renderRegistry();return;}
      const already=state.ships.some(s=>s.id!==ship.id&&familyKey(s)===familyKey(ship)&&s.variant.toLocaleLowerCase()===value.toLocaleLowerCase());
      if(already){toast('This ship already has a variant with that name.');renderRegistry();return;}
      ship.variant=value.slice(0,80);
    } else if(field==='notes'){ship.notes=input.value.slice(0,700);}
    else if(field==='row' && !isAir(ship) && ['Front','Middle','Back'].includes(input.value)){ship.row=input.value;}
    else if(field==='size'){ship.size=input.value==='Large'?'Large':'Medium';}
    else if(['cp','atk','tank','aa','support','fighterSlots','largeFighterSlots','corvetteSlots'].includes(field)){
      const min=['atk','tank','aa','support'].includes(field)?1:0;
      const max=field==='cp'?200:['fighterSlots','largeFighterSlots','corvetteSlots'].includes(field)?60:5;
      ship[field]=int(input.value,ship[field],min,max);
      if(isAir(ship))ship.cp=0;
      ship.largeFighterSlots=Math.min(ship.largeFighterSlots,ship.fighterSlots);
    } else return;
    updateBlueprintAfterInlineChange(ship);
  }
  function upgradeAdvice(ship){
    const doctrine=state.settings.strategy;
    const advice=[];
    const carrier=(ship.fighterSlots>0||ship.corvetteSlots>0);
    if(carrier){advice.push('Hangar system: aircraft operating efficiency, launch / return-to-base cycle, then survivability.');}
    if(ship.type==='Fighter'||ship.type==='Corvette'){
      advice.push(ship.aa>=4?'Interceptor role: hit rate and anti-air damage, then cooldown.':'Aircraft weapon system: hit rate, then damage and cooldown.');
    } else if(doctrine==='defensive'){
      advice.push(ship.tank>=3?'Hull/armor or evasion upgrades according to its defensive system.':'Protect the critical weapon or support system before maximizing raw damage.');
      if(ship.aa>=3)advice.push('AA system: target acquisition / hit rate before secondary damage bonuses.');
    } else if(doctrine==='offensive'){
      advice.push('Main weapon: hit rate, then cooldown and damage; tailor choices to the actual weapon system.');
      if(ship.tank>=4)advice.push('Add enough survivability to keep the damage platform in combat.');
    } else {
      advice.push('Primary system: improve hit consistency and cooldown before lower-impact secondary modules.');
      if(ship.tank>=4)advice.push('Strengthen the front-line mitigation or evasion system.');
      if(ship.aa>=4)advice.push('AA tracking and hit-rate upgrades improve interception reliability.');
    }
    if(ship.id==='storm')advice.push('Eternal Storm: review anti-air coverage and nearby fleet composition. Front-line tanks cannot block every fighter attack.');
    if(ship.id==='vitas')advice.push('Vitas-B010: use a host that supports large fighter squadrons; Ceres is not compatible.');
    if(ship.id==='ac721')advice.push('AC721 aircraft: validate its corvette dock and improve hangar efficiency; empty slots add no value.');
    if(ship.id==='ceres')advice.push('Ceres aircraft: restrict the assignment to medium/small fighter squadrons.');
    return advice.slice(0,4);
  }
  function renderUpgrades(){
    const fleet=lastFleet||buildFleet();
    const all=[...fleet.hulls,...fleet.assignments];
    const sorted=all.map(({ship,qty})=>({ship,qty,value:shipScore(ship,state.settings)*Math.sqrt(qty)*(ship.row==='Front'&&state.settings.strategy==='defensive'?1.2:1)})).sort((a,b)=>b.value-a.value);
    $('#upgrade-summary').innerHTML=`<div class="info-tile"><small>DOCTRINE</small><strong>${esc(state.settings.strategy.toUpperCase())}</strong></div><div class="info-tile"><small>UNIQUE BLUEPRINTS</small><strong>${sorted.length}</strong></div><div class="info-tile"><small>PLANNING BASIS</small><strong>HEURISTIC</strong></div>`;
    $('#upgrade-list').innerHTML=sorted.length?sorted.map(({ship,qty},i)=>`<article class="upgrade-card"><span class="priority-num">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(ship.name)}</h3><div class="meta">${esc(ship.variant)} · ${esc(ship.type)} · ${qty} assigned</div><ul>${upgradeAdvice(ship).map(a=>`<li>${esc(a)}</li>`).join('')}</ul></div><span class="impact-tag">PRIORITY ${i<3?'HIGH':i<7?'MEDIUM':'LATER'}</span></article>`).join(''):'<div class="empty-note">No formation exists yet. Go to Fleet Builder, select owned ships, and generate a fleet to see upgrade priorities.</div>';
  }
  function renderGuide(){
    $('#reference-links').innerHTML=(window.FLEET_REFERENCES||[]).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join('');
  }
  function renderSettings(){
    $('#cp-limit').value=state.settings.cp;
    $('#air-threat').checked=state.settings.airThreat;
    $('#prefer-aircraft').checked=state.settings.preferAircraft;
    $$('.strategy').forEach(btn=>{const active=btn.dataset.strategy===state.settings.strategy;btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active));});
  }
  function renderAll(){renderSettings();renderRegistry();renderFleet();renderGuide();}
  const PAGES={blueprints:['YOUR INVENTORY','My Blueprints'],fleet:['FLEET PLANNING','Build Fleet'],upgrades:['UPGRADES','Upgrade Planner'],guide:['HELP & BACKUP','Help & Data']};
  function navigate(tab){
    if(!PAGES[tab])return;
    $$('.nav-link').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
    $$('.screen').forEach(el=>el.classList.toggle('active',el.id===`screen-${tab}`));
    $('#page-eyebrow').textContent=PAGES[tab][0];$('#page-title').textContent=PAGES[tab][1];
    if(tab==='upgrades')renderUpgrades();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  const blueprintCatalog=clone(window.FLEET_STARTERS||[]).map(normalizeShip).filter(Boolean);
  function populateCatalogShips(){
    const names=[...new Set(blueprintCatalog.map(s=>s.name))].sort((a,b)=>a.localeCompare(b));
    $('#catalog-ship').innerHTML='<option value="">Select a ship...</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
    $('#catalog-variant').innerHTML='<option value="">Select a ship first...</option>';
    $('#catalog-variant').disabled=true;
    $('#catalog-preview').textContent='Choose a ship and variant to load the catalog statistics.';
  }
  function populateCatalogVariants(){
    const list=blueprintCatalog.filter(s=>s.name===$('#catalog-ship').value).sort((a,b)=>a.variant.localeCompare(b.variant));
    $('#catalog-variant').disabled=!list.length;
    $('#catalog-variant').innerHTML='<option value="">Select a variant...</option>'+list.map(s=>`<option value="${esc(s.id)}">${esc(s.variant||'Base variant')}</option>`).join('');
    $('#catalog-preview').textContent='Choose a variant to view its preloaded statistics.';
  }
  function previewCatalogBlueprint(){
    const s=blueprintCatalog.find(x=>x.id===$('#catalog-variant').value);
    if(!s){$('#catalog-preview').textContent='Choose a variant to view its preloaded statistics.';return;}
    const existing=state.ships.find(x=>familyKey(x)===familyKey(s)&&x.variant.toLowerCase()===s.variant.toLowerCase());
    $('#catalog-copies').value=existing?existing.qty:1;
    $('#catalog-owned').checked=true;
    $('#catalog-preview').innerHTML=`<strong>${esc(shipName(s))}</strong><div class="catalog-preview-facts"><span>${esc(s.type)}</span><span>${esc(s.row)} row</span><span>CP ${s.cp}</span><span>Attack ${s.atk}/5</span><span>Defense ${s.tank}/5</span><span>AA ${s.aa}/5</span><span>Support ${s.support}/5</span><span>Fighter slots ${s.fighterSlots}</span><span>Corvette slots ${s.corvetteSlots}</span></div><small>${existing?'Already in workspace: preserves your custom stats.':'Stats loaded from built-in catalog.'} Ratings are estimates, not official game values.</small>`;
  }
  function showEditor(){
    populateCatalogShips();
    $('#catalog-copies').value=1;$('#catalog-owned').checked=true;
    $('#editor-modal').showModal();
  }
  function saveEditor(e){
    e.preventDefault();
    const base=blueprintCatalog.find(s=>s.id===$('#catalog-variant').value&&s.name===$('#catalog-ship').value);
    if(!base){toast('Select a ship and variant from the catalog.');return;}
    const qty=int($('#catalog-copies').value,1,0,99),owned=$('#catalog-owned').checked;
    let ship=state.ships.find(s=>familyKey(s)===familyKey(base)&&s.variant.toLowerCase()===base.variant.toLowerCase());
    if(ship){ship.qty=qty;ship.owned=owned;}
    else {
      if(state.ships.length>=500){toast('Catalog limit of 500 blueprints reached.');return;}
      ship=normalizeShip({...base,id:state.ships.some(s=>s.id===base.id)?`catalog-${base.id}-${Date.now()}`:base.id,qty,owned},state.ships.length);
      state.ships.push(ship);
    }
    $('#owned-filter').checked=true;
    save();renderAll();$('#editor-modal').close();toast(`${shipName(ship)} saved to your inventory.`);
  }
  function exportData(){
    const contents=JSON.stringify({app:'Fleet Architect',version:1,exportedAt:new Date().toISOString(),...state},null,2);
    const blob=new Blob([contents],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`fleet-architect-${new Date().toISOString().slice(0,10)}.json`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('JSON backup exported.');
  }
  async function importData(file){
    if(!file)return;
    if(file.size>2_000_000){toast('File too large (maximum 2 MB).');return}
    try {
      const obj=JSON.parse(await file.text());
      if(!obj||!Array.isArray(obj.ships)||obj.ships.length>500)throw new Error('Expected a Fleet Architect JSON object with up to 500 ships.');
      const next=normalizeState(obj);
      if(!window.confirm(`Import ${next.ships.length} blueprints? This replaces the current locally saved data.`))return;
      state=next;save();renderAll();toast('Fleet Architect data imported successfully.');
    } catch(err){toast(`Import failed: ${err.message}`)}
    finally{$('#import-file').value='';}
  }
  $$('.nav-link').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.tab)));
  $$('.strategy').forEach(btn=>btn.addEventListener('click',()=>{state.settings.strategy=btn.dataset.strategy;save();renderSettings();renderFleet();toast('Strategy updated. Fleet regenerated.');}));
  $('#cp-limit').addEventListener('change',e=>{state.settings.cp=int(e.target.value,240,10,2000);save();renderSettings();renderFleet();});
  $('#air-threat').addEventListener('change',e=>{state.settings.airThreat=e.target.checked;save();renderFleet();});
  $('#prefer-aircraft').addEventListener('change',e=>{state.settings.preferAircraft=e.target.checked;save();renderFleet();});
  $('#generate-btn').addEventListener('click',()=>{renderFleet();toast('Fleet generated from your current inventory.');});
  $('#ship-search').addEventListener('input',renderRegistry);$('#ship-class-filter').addEventListener('change',renderRegistry);$('#owned-filter').addEventListener('change',renderRegistry);

  $('#ship-grid').addEventListener('click',e=>{
    if(e.target.closest('#add-first-blueprint')){showEditor();return;}
    const btn=e.target.closest('button[data-expand-id]');if(!btn)return;
    const id=btn.dataset.expandId,body=$('.inventory-detail-body',btn.closest('.inventory-row'));
    if(expandedStats.has(id))expandedStats.delete(id);else expandedStats.add(id);
    body.hidden=!expandedStats.has(id);btn.setAttribute('aria-expanded',String(!body.hidden));
    btn.textContent=body.hidden?'View stats ▼':'Hide stats ▲';
  });
  $('#ship-grid').addEventListener('change',e=>{
    const target=e.target;
    if(target.matches('[data-owned-id]')){
      const ship=state.ships.find(s=>s.id===target.dataset.ownedId);if(!ship)return;
      ship.owned=target.checked;save();renderRegistry();renderFleet();return;
    }
    if(target.matches('[data-quantity-id]')){
      const ship=state.ships.find(s=>s.id===target.dataset.quantityId);if(!ship)return;
      ship.qty=int(target.value,ship.qty,0,99);updateBlueprintAfterInlineChange(ship);return;
    }
    if(target.matches('[data-stat-field]'))updateInlineField(target);
  });
  $('#add-blueprint').addEventListener('click',showEditor);
  $('#editor-form').addEventListener('submit',saveEditor);
  $('#catalog-ship').addEventListener('change',populateCatalogVariants);
  $('#catalog-variant').addEventListener('change',previewCatalogBlueprint);
  $('#close-modal').addEventListener('click',()=>$('#editor-modal').close());
  $('#cancel-modal').addEventListener('click',()=>$('#editor-modal').close());
  $('#goto-upgrades').addEventListener('click',()=>navigate('upgrades'));$('#back-fleet').addEventListener('click',()=>navigate('fleet'));
  $('#export-btn').addEventListener('click',exportData);$('#import-btn').addEventListener('click',()=>$('#import-file').click());$('#import-file').addEventListener('change',e=>importData(e.target.files[0]));
  $('#reset-inventory').addEventListener('click',()=>{
    if(!state.ships.length)return;
    $('#reset-count').textContent=state.ships.length+' blueprint '+(state.ships.length===1?'entry':'entries');
    $('#reset-dialog').showModal();
  });
  $('#cancel-reset').addEventListener('click',()=>$('#reset-dialog').close());
  $('#backup-before-reset').addEventListener('click',exportData);
  $('#confirm-reset').addEventListener('click',()=>{
    try{localStorage.setItem(RESET_BACKUP_KEY,JSON.stringify(state.ships));}catch{}
    state.ships=[];expandedStats.clear();
    $('#ship-search').value='';$('#ship-class-filter').value='all';$('#owned-filter').checked=true;
    $('#reset-dialog').close();save();renderAll();navigate('blueprints');
    toast('Inventory cleared. Add a blueprint to begin.');
  });
  $('#fleet-add-first').addEventListener('click',()=>{navigate('blueprints');showEditor();});
  $('#edit-inventory').addEventListener('click',()=>navigate('blueprints'));
  renderAll();navigate(state.ships.some(s=>s.owned)?'fleet':'blueprints');
})();