/* Shared, browser-local reservation model. No requests are sent to the restaurant. */
(() => {
  'use strict';
  const KEY = 'bae-sik-dang-reservations-v1';
  const ZONE = 'Asia/Singapore';
  const ROOMS = [
    {id:'private', name:'Private Room'},
    {id:'lobby', name:'Main Lobby'},
    {id:'room3', name:'Room 3'}
  ];
  const TABLES = [
    {id:'T1', name:'Table 01', capacity:6},
    {id:'T2', name:'Table 02', capacity:6},
    {id:'T3', name:'Table 03', capacity:4},
    {id:'T4', name:'Table 04', capacity:4}
  ];
  const TIMES = ['18:00','19:30','21:00'];
  const allSeats = TABLES.flatMap(table => Array.from({length:table.capacity},(_,i)=>`${table.id}-S${i+1}`));
  const seatSet = new Set(allSeats);
  function localNow() {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const p = Object.fromEntries(parts.map(part=>[part.type,part.value]));
    return {date:`${p.year}-${p.month}-${p.day}`, time:`${p.hour}:${p.minute}`};
  }
  function addDays(date, days) { const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10); }
  function bounds() {const today=localNow().date;return {min:today,max:addDays(today,7)};}
  function isDate(date) {return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(`${date}T12:00:00Z`))&&new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)===date;}
  function validDate(date) {const b=bounds();return isDate(date)&&date>=b.min&&date<=b.max;}
  function validTime(date,time) {const now=localNow();return validDate(date)&&TIMES.includes(time)&&(date!==now.date||time>now.time);}
  function validStaffTime(date,time) {return validDate(date)&&TIMES.includes(time);}
  function defaultSlot() {const now=localNow();const time=TIMES.find(value=>value>now.time);return {date:time?now.date:addDays(now.date,1),time:time||TIMES[0]};}
  function roomName(id) {return ROOMS.find(room=>room.id===id)?.name||'Unknown room';}
  function formatDate(date) {return new Intl.DateTimeFormat('en-SG',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${date}T12:00:00Z`));}
  function seatSummary(seats) {return TABLES.filter(table=>seats.some(seat=>seat.startsWith(table.id+'-'))).map(table=>`${table.name}: ${seats.filter(seat=>seat.startsWith(table.id+'-')).map(seat=>seat.split('-')[1]).join(', ')}`).join(' · ');}
  function cleanRecord(item) {
    if(!item||typeof item!=='object'||!/^BSD-[A-Z0-9]{8}$/.test(item.id)||!ROOMS.some(room=>room.id===item.room)||!isDate(item.date)||!TIMES.includes(item.time)||!['pending','confirmed','cancelled'].includes(item.status)||!Number.isInteger(item.revision)||item.revision<1||!Array.isArray(item.seats)||item.seats.length<1||item.seats.length>20||new Set(item.seats).size!==item.seats.length||!item.seats.every(seat=>seatSet.has(seat))||typeof item.createdAt!=='string'||typeof item.updatedAt!=='string')throw new Error('Saved reservations could not be read. Nothing has been changed. Please check this browser’s saved site data.');
    const record={id:item.id,room:item.room,date:item.date,time:item.time,seats:allSeats.filter(seat=>item.seats.includes(seat)),status:item.status,revision:item.revision,createdAt:item.createdAt,updatedAt:item.updatedAt,source:item.source==='staff'?'staff':'online'};
    const guest=cleanGuest(item.guest);if(guest)record.guest=guest;
    return record;
  }
  // Optional guest details shared by the customer and staff previews.
  function cleanGuest(guest) {
    if(!guest||typeof guest!=='object')return null;
    const text=(value,max)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
    const clean={name:text(guest.name,60),phone:text(guest.phone,24),note:text(guest.note,140)};
    return clean.name||clean.phone||clean.note?clean:null;
  }
  function read() {
    let raw;try{raw=localStorage.getItem(KEY);}catch{throw new Error('Browser storage is unavailable. Enable site storage to save and manage demo reservations on this device.');}
    if(!raw)return [];
    let records;try{records=JSON.parse(raw);}catch{throw new Error('Saved reservations could not be read. Nothing has been changed.');}
    if(!Array.isArray(records)||records.length>500)throw new Error('Saved reservation data is not valid. Nothing has been changed.');
    const clean=records.map(cleanRecord);
    if(new Set(clean.map(record=>record.id)).size!==clean.length)throw new Error('Duplicate reservation records were found. Nothing has been changed.');
    return clean;
  }
  function write(records) {
    try{localStorage.setItem(KEY,JSON.stringify(records));}catch{throw new Error('The reservation could not be saved. Browser storage may be full or blocked. Your selection is still here; nothing was confirmed.');}
    window.dispatchEvent(new Event('bsd:reservations-changed'));
  }
  function occupied(records,slot,excludeId=null) {
    return new Set(records.filter(record=>record.status!=='cancelled'&&record.id!==excludeId&&record.room===slot.room&&record.date===slot.date&&record.time===slot.time).flatMap(record=>record.seats));
  }
  function validate(input,staff=false) {
    if(!ROOMS.some(room=>room.id===input.room))throw new Error('Choose a valid room.');
    if(!validDate(input.date))throw new Error('Choose a date from today through seven days ahead (Singapore time).');
    if(!(staff?validStaffTime:validTime)(input.date,input.time))throw new Error('Choose an available dinner time. Past time slots cannot be reserved.');
    if(!Array.isArray(input.seats)||input.seats.length<1||input.seats.length>20||new Set(input.seats).size!==input.seats.length||!input.seats.every(seat=>seatSet.has(seat)))throw new Error('Select at least one available seat.');
  }
  // Web Locks serialize same-origin tabs; every mutation re-reads and revalidates availability.
  function locked(action) {return navigator.locks?.request?navigator.locks.request(KEY,action):Promise.resolve().then(action);}
  function save(input,editId=null,expectedRevision=null,options={}) {return locked(()=>{
    const staff=options.staff===true;
    validate(input,staff);const records=read(),existing=editId?records.find(record=>record.id===editId):null;
    if(editId&&(!existing||existing.status==='cancelled'))throw new Error('This reservation is no longer available to edit. Return to your reservations.');
    if(existing&&existing.revision!==expectedRevision)throw new Error('This reservation changed in another tab. Reopen it from your reservations before editing again.');
    const unavailable=occupied(records,input,editId);
    if(input.seats.some(seat=>unavailable.has(seat)))throw new Error('Some selected seats were just reserved. Choose available seats and try again.');
    if(!existing&&records.length>=500)throw new Error('This browser has reached the demo reservation limit.');
    const now=new Date().toISOString();
    const id=existing?.id||`BSD-${(crypto.randomUUID?crypto.randomUUID().replaceAll('-',''):Math.random().toString(36).slice(2).padEnd(8,'0')).slice(0,8).toUpperCase()}`;
    if(!existing&&records.some(record=>record.id===id))throw new Error('Please try again to generate a new reservation reference.');
    const record={id,room:input.room,date:input.date,time:input.time,seats:allSeats.filter(seat=>input.seats.includes(seat)),status:staff?(existing?.status||'confirmed'):'pending',revision:(existing?.revision||0)+1,createdAt:existing?.createdAt||now,updatedAt:now,source:existing?.source||(staff?'staff':'online')};
    const guest=input.guest!==undefined?cleanGuest(input.guest):existing?.guest;if(guest)record.guest=guest;
    write(existing?records.map(item=>item.id===id?record:item):[...records,record]);return record;
  });}
  function cancel(id,expectedRevision) {return locked(()=>{
    const records=read(),record=records.find(item=>item.id===id);
    if(!record||record.status==='cancelled')throw new Error('This reservation is already cancelled or no longer available.');
    if(record.revision!==expectedRevision)throw new Error('This reservation changed in another tab. Review the updated details before cancelling.');
    const changed={...record,status:'cancelled',revision:record.revision+1,updatedAt:new Date().toISOString()};
    write(records.map(item=>item.id===id?changed:item));return changed;
  });}
  // Demo confirmation only: no messages or real restaurant requests are sent.
  function confirm(id,expectedRevision) {return locked(()=>{
    const records=read(),record=records.find(item=>item.id===id);
    if(!record||record.status!=='pending')throw new Error('This booking is no longer awaiting confirmation. Reopen its details.');
    if(record.revision!==expectedRevision)throw new Error('This booking changed. Reopen its details before confirming.');
    const changed={...record,status:'confirmed',revision:record.revision+1,updatedAt:new Date().toISOString()};
    write(records.map(item=>item.id===id?changed:item));return changed;
  });}
  window.BaeReservationStore=Object.freeze({KEY,ZONE,ROOMS,TABLES,TIMES,allSeats,bounds,localNow,addDays,validDate,validTime,validStaffTime,defaultSlot,roomName,formatDate,seatSummary,read,occupied,save,cancel,confirm});
})();
