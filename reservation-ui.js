/* Accessible UI shared by the restaurant planner and the separate reservation board. */
(() => {
  'use strict';
  const Store=window.BaeReservationStore;
  const $=(selector,parent=document)=>parent.querySelector(selector);
  const $$=(selector,parent=document)=>[...parent.querySelectorAll(selector)];
  const make=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  const editURL=id=>`index.html?edit=${encodeURIComponent(id)}#booking`;
  try{const mood=localStorage.getItem('bae-sik-dang-retro-mood');if(['lunch','golden','night'].includes(mood))document.documentElement.dataset.mood=mood;}catch{}
  if(!Store)return;

  const planner=$('#reservation-planner');
  if(planner){
    const date=$('#reservation-date'),time=$('#reservation-time'),room=$('#reservation-room'),form=$('#reservation-form'),submit=$('#place-reservation'),message=$('#reservation-message');
    const query=new URLSearchParams(location.search);
    let editId=query.get('edit'),expectedRevision=null,selected=new Set(),saving=false,invalidEdit=false,lastError=false;
    function tell(text,error=false){message.textContent=text;message.classList.toggle('is-error',error);}
    function slot(){return {date:date.value,time:time.value,room:room.value};}
    function limits(){const b=Store.bounds();date.min=b.min;date.max=b.max;$('#date-window').textContent=`Choose ${Store.formatDate(b.min)}–${Store.formatDate(b.max)} (up to 7 days ahead). All times are Singapore time.`;}
    function updateTimes(preserveTime=false){
      limits();for(const option of time.options)option.disabled=!Store.validTime(date.value,option.value);
      if(!preserveTime&&!Store.validTime(date.value,time.value)){const available=[...time.options].find(option=>!option.disabled);time.value=available?.value||'';}
    }
    const start=Store.defaultSlot();date.value=start.date;time.value=start.time;room.value='private';
    if(editId){
      $('#editing-banner').hidden=false;
      try{
        const record=Store.read().find(item=>item.id===editId);
        if(!record||record.status!=='confirmed')throw new Error('This reservation is missing or cancelled. Return to your reservations to choose another one.');
        expectedRevision=record.revision;date.value=record.date;time.value=record.time;room.value=record.room;selected=new Set(record.seats);
        $('#editing-reference').textContent=record.id+' · your original booking stays unchanged until you save.';
        $('#planner-heading').textContent='A little change of plans.';
      }catch(error){invalidEdit=true;$('#editing-reference').textContent='Unable to open this reservation.';tell(error.message,true);}
    }
    updateTimes(Boolean(editId));
    if(editId&&!invalidEdit&&!Store.validTime(date.value,time.value))tell('Choose a future date and time before saving changes to this reservation.',true);
    function render(){
      limits();
      const focused=document.activeElement;
      const focusSeat=focused?.dataset?.seat,focusTable=focused?.dataset?.table;
      let records=[];
      try{records=Store.read();lastError=false;}catch(error){lastError=true;tell(error.message,true);}
      const blocked=Store.occupied(records,slot(),editId);
      let removed=false;for(const seat of selected){if(blocked.has(seat)){selected.delete(seat);removed=true;}}
      if(removed)tell('Availability changed. Seats reserved in another tab were removed from your selection.',true);
      const valid=Store.validDate(date.value)&&Store.validTime(date.value,time.value)&&!invalidEdit&&!lastError;
      $('#room-caption-name').textContent=Store.roomName(room.value).toUpperCase();
      $('#room-tables').setAttribute('aria-label',`${Store.roomName(room.value)} tables and seats`);
      const fragments=Store.TABLES.map(table=>{
        const seats=Array.from({length:table.capacity},(_,i)=>`${table.id}-S${i+1}`);
        const available=seats.filter(seat=>!blocked.has(seat)),count=seats.filter(seat=>selected.has(seat)).length;
        const block=make('div','room-table-block'),model=make('div','table-model');
        block.setAttribute('role','group');block.setAttribute('aria-label',`${table.name}, ${table.capacity} seats`);
        const whole=make('button','table-top');whole.type='button';whole.dataset.table=table.id;
        whole.disabled=!valid||!available.length||saving;
        whole.setAttribute('aria-pressed',count===0?'false':count===available.length?'true':'mixed');
        whole.setAttribute('aria-label',`${table.name}: ${count===available.length&&available.length?'deselect':'select'} all ${available.length} available seats`);
        const label=make('span','table-id',table.id);label.append(make('small','',`${table.capacity} seats`));
        const grill=make('span','grill-model');grill.setAttribute('aria-hidden','true');whole.append(label,grill);
        whole.addEventListener('click',()=>{const all=available.every(seat=>selected.has(seat));available.forEach(seat=>all?selected.delete(seat):selected.add(seat));selectionChanged();});
        const top=make('div','chairs-row chairs-top'),bottom=make('div','chairs-row chairs-bottom');
        seats.forEach((seat,index)=>{
          const button=make('button','seat-button',`S${index+1}`);button.type='button';button.dataset.seat=seat;
          button.disabled=!valid||blocked.has(seat)||saving;button.setAttribute('aria-pressed',String(selected.has(seat)));
          button.setAttribute('aria-label',`${table.name}, seat ${index+1}${blocked.has(seat)?', reserved':selected.has(seat)?', selected':', available'}`);
          button.title=`${table.name} · Seat ${index+1}`;
          button.addEventListener('click',()=>{selected.has(seat)?selected.delete(seat):selected.add(seat);selectionChanged();});
          (index<table.capacity/2?top:bottom).append(button);
        });
        model.append(top,whole,bottom);
        const caption=make('p','model-caption');caption.append(make('strong','',`${table.name} / ${table.capacity} seats`),make('span','',`${count} selected · ${available.length} available`));block.append(model,caption);return block;
      });
      $('#room-tables').replaceChildren(...fragments);
      const selectedTables=Store.TABLES.filter(table=>[...selected].some(seat=>seat.startsWith(table.id+'-'))).length;
      $('#selection-count').textContent=selected.size?`${selected.size} seat${selected.size===1?'':'s'} across ${selectedTables} table${selectedTables===1?'':'s'}`:'No seats selected';
      $('#selection-detail').textContent=selected.size?Store.seatSummary([...selected]):'Select one or more tables, or individual seats.';
      submit.disabled=!valid||!selected.size||saving;
      submit.firstChild.textContent=saving?'Saving… ':editId?'Save changes ':'Place reservation ';
      $('#clear-selection').disabled=!selected.size||saving;
      if(focusSeat)$(`[data-seat="${focusSeat}"]`,planner)?.focus({preventScroll:true});
      else if(focusTable)$(`[data-table="${focusTable}"]`,planner)?.focus({preventScroll:true});
    }
    function selectionChanged(){
      $('#reservation-success').hidden=true;
      tell('');render();document.dispatchEvent(new Event('bsd:seat-selected'));
    }
    function contextChanged(){
      selected.clear();$('#reservation-success').hidden=true;updateTimes();
      if(!Store.validDate(date.value))tell('Choose a date from today through seven days ahead.',true);
      else if(!time.value)tell('There are no remaining dinner slots on this date. Choose another day.',true);
      else tell('Choose seats for this room, date, and time.');
      render();
    }
    date.addEventListener('change',contextChanged);time.addEventListener('change',contextChanged);room.addEventListener('change',contextChanged);
    $('#clear-selection').addEventListener('click',()=>{selected.clear();tell('Seat selection cleared.');render();});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(saving||invalidEdit)return;
      const input={...slot(),seats:[...selected]},wasEdit=Boolean(editId);
      saving=true;tell('');render();
      try{
        const record=await Store.save(input,editId,expectedRevision);
        selected.clear();editId=null;expectedRevision=null;
        $('#editing-banner').hidden=true;$('#planner-heading').textContent='A date. A room. Your people.';
        const url=new URL(location.href);url.searchParams.delete('edit');history.replaceState(null,'',url);
        $('#success-title').textContent=wasEdit?'Demo reservation updated.':'Demo reservation saved.';
        $('#success-details').textContent=`${record.id} · ${Store.formatDate(record.date)} · ${record.time} · ${Store.roomName(record.room)} · ${record.seats.length} seats`;
        $('#success-seats').textContent=Store.seatSummary(record.seats);
        $('#success-edit').href=editURL(record.id);$('#reservation-success').hidden=false;
        tell(wasEdit?'Changes saved to the same reservation.':'Your demo reservation is saved on this device.');
        $('#reservation-success').focus({preventScroll:true});
      }catch(error){tell(error.message,true);}finally{saving=false;render();}
    });
    function refresh(){
      if(saving)return;
      const previousTime=time.value;
      updateTimes(Boolean(editId));
      if(previousTime!==time.value){selected.clear();tell('Dinner times have updated. Choose your seats again.');}
      render();
    }
    addEventListener('storage',event=>{if(event.key===Store.KEY||event.key===null)refresh();});
    addEventListener('bsd:reservations-changed',()=>{if(!saving)render();});
    addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
    addEventListener('pageshow',event=>{if(event.persisted)refresh();});
    render();
  }

  const manager=$('#reservation-manager');
  if(manager){
    const list=$('#reservation-list'),dialog=$('#cancel-dialog'),message=$('#manager-message');
    let filter='confirmed',pending=null,returnFocus=null,cancelling=false;
    const mode=new URLSearchParams(location.search).get('mode');
    if(mode==='cancel'){$('#manager-heading').textContent='A change of plans?';$('#manager-intro').textContent='Choose the reservation you want to cancel below. You can also edit its date, time, room, tables, or seats.';}
    if(mode==='edit'){$('#manager-heading').textContent='Make it your evening.';$('#manager-intro').textContent='Choose a saved reservation to change its date, time, room, tables, or seats. Nothing changes until you save.';}
    function render(){
      let records;
      try{records=Store.read();$('#manager-error').hidden=true;}catch(error){$('#manager-error').textContent=error.message;$('#manager-error').hidden=false;list.replaceChildren();$('#manager-empty').hidden=true;$('#manager-count').textContent='Unable to read reservations';return;}
      const visible=records.filter(record=>filter==='all'||record.status===filter).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      $('#manager-count').textContent=`${visible.length} reservation${visible.length===1?'':'s'}`;
      list.replaceChildren(...visible.map(record=>{
        const cancelled=record.status==='cancelled',ticket=make('article',`reservation-ticket${cancelled?' cancelled':''}`);ticket.dataset.reservation=record.id;
        const top=make('div','ticket-top');top.append(make('span','ticket-reference',record.id),make('span','ticket-status',cancelled?'CANCELLED':'SAVED DEMO'));
        const heading=make('h2','',Store.roomName(record.room));
        const when=make('p','ticket-when',`${Store.formatDate(record.date)} · ${record.time} SGT`);
        const tables=Store.TABLES.filter(table=>record.seats.some(seat=>seat.startsWith(table.id+'-'))).length;
        const count=make('p','ticket-guests',`${record.seats.length} seat${record.seats.length===1?'':'s'} · ${tables} table${tables===1?'':'s'}`);
        const seats=make('p','ticket-seats',Store.seatSummary(record.seats));ticket.append(top,heading,when,count,seats);
        if(!cancelled){
          const actions=make('div','ticket-actions'),edit=make('a','btn btn-outline','Edit reservation'),cancel=make('button','cancel-ticket','Cancel reservation');
          edit.href=editURL(record.id);edit.setAttribute('aria-label',`Edit reservation ${record.id}`);cancel.type='button';cancel.setAttribute('aria-label',`Cancel reservation ${record.id}`);
          cancel.addEventListener('click',()=>{
            pending={id:record.id,revision:record.revision};returnFocus=cancel;
            $('#cancel-details').textContent=`${record.id}\n${Store.roomName(record.room)} · ${Store.formatDate(record.date)} · ${record.time} SGT\n${record.seats.length} seats\n${Store.seatSummary(record.seats)}`;
            $('#cancel-error').hidden=true;$('#confirm-cancel').disabled=false;dialog.showModal();document.body.style.overflow='hidden';
          });actions.append(edit,cancel);ticket.append(actions);
        }
        ticket.append(make('p','ticket-foot',cancelled?'These seats have been released for this room and time.':'Saved on this device only. No real restaurant booking was made.'));return ticket;
      }));
      $('#manager-empty').hidden=visible.length>0;
      $('#empty-title').textContent=filter==='cancelled'?'No cancelled plans.':'Your next evening starts here.';
      $('#empty-copy').textContent=filter==='cancelled'?'Cancelled demo reservations will appear here. Your saved reservations remain in the first tab.':'There are no saved reservations in this view. Choose a date, a room, and your favorite seats to create a demo reservation.';
    }
    $$('.manager-tab').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;$$('.manager-tab').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));render();}));
    $('#keep-reservation').addEventListener('click',()=>{if(!cancelling)dialog.close();});
    dialog.addEventListener('cancel',event=>{if(cancelling)event.preventDefault();});
    dialog.addEventListener('close',()=>{document.body.style.overflow='';if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});else $('.manager-tab[aria-pressed="true"]')?.focus({preventScroll:true});pending=null;});
    $('#confirm-cancel').addEventListener('click',async()=>{
      if(!pending||cancelling)return;cancelling=true;$('#confirm-cancel').disabled=true;$('#keep-reservation').disabled=true;
      try{
        const record=await Store.cancel(pending.id,pending.revision);dialog.close();message.textContent=`Reservation ${record.id} was cancelled. Its ${record.seats.length} seats are available again.`;render();
      }catch(error){$('#cancel-error').textContent=error.message;$('#cancel-error').hidden=false;render();}
      finally{cancelling=false;$('#confirm-cancel').disabled=false;$('#keep-reservation').disabled=false;}
    });
    addEventListener('storage',event=>{if(event.key===Store.KEY||event.key===null)render();});
    addEventListener('bsd:reservations-changed',()=>{if(!cancelling)render();});
    addEventListener('pageshow',event=>{if(event.persisted)render();});render();
  }
})();
