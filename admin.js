/* Staff page: see who is coming, add a phone or walk-in booking, cancel a booking.
   Uses the same browser-local store as the customer pages. */
(() => {
  'use strict';
  const Store = window.BaeReservationStore;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  if (!Store) return;

  /* ---------- Plain-language formatting ---------- */
  const SLOT_MINUTES = 90;
  function timeLabel(time) {
    const [h, m] = time.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }
  function minutes(time) { const [h, m] = time.split(':').map(Number); return h * 60 + m; }
  function dateObj(date) { return new Date(`${date}T12:00:00Z`); }
  function longDate(date) {
    return new Intl.DateTimeFormat('en-SG', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(dateObj(date));
  }
  function shortDate(date) {
    return new Intl.DateTimeFormat('en-SG', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(dateObj(date));
  }
  function dayName(date) {
    const today = Store.localNow().date;
    if (date === today) return 'Today';
    if (date === Store.addDays(today, 1)) return 'Tomorrow';
    return new Intl.DateTimeFormat('en-SG', { timeZone: 'UTC', weekday: 'long' }).format(dateObj(date));
  }
  function tableLabel(tableId) { return `Table ${Number(tableId.slice(1))}`; }
  function tablesOf(seats) { return Store.TABLES.filter(t => seats.some(s => s.startsWith(t.id + '-'))); }
  function tablesText(seats) { return tablesOf(seats).map(t => tableLabel(t.id)).join(' + '); }
  function people(n) { return `${n} ${n === 1 ? 'person' : 'people'}`; }
  function guestName(record) { return record.guest?.name || 'Online booking'; }
  function slotStarted(date, time) { const now = Store.localNow(); return date === now.date && now.time >= time; }
  function slotOver(date, time) {
    const now = Store.localNow();
    return date === now.date && minutes(now.time) >= minutes(time) + SLOT_MINUTES;
  }

  /* ---------- Data ---------- */
  function readAll() {
    try { const records = Store.read(); $('#error').hidden = true; return records; }
    catch (error) { $('#error').textContent = error.message; $('#error').hidden = false; return null; }
  }
  function bookingsAt(records, date, time, room) {
    return records.filter(r => r.status !== 'cancelled' && r.date === date && r.time === time && (!room || r.room === room));
  }
  function freeSeats(records, date, time, room) {
    const taken = Store.occupied(records, { date, time, room });
    return Store.allSeats.filter(seat => !taken.has(seat));
  }

  /* Pick seats for a party in one room.
     1) the table staff tapped, 2) one empty table, 3) empty tables pushed together,
     4) a table that already has guests, 5) any free seats. */
  function pickSeats(records, date, time, room, count, preferredTable) {
    const taken = Store.occupied(records, { date, time, room });
    const info = Store.TABLES.map(table => {
      const seats = Array.from({ length: table.capacity }, (_, i) => `${table.id}-S${i + 1}`);
      const free = seats.filter(s => !taken.has(s));
      return { table, free, empty: free.length === table.capacity };
    });
    const take = list => {
      const seats = [];
      for (const item of list) for (const seat of item.free) if (seats.length < count) seats.push(seat);
      return seats.length === count ? seats : null;
    };
    const preferred = info.find(i => i.table.id === preferredTable);
    if (preferred && preferred.free.length >= count) return take([preferred]);
    const singleEmpty = info.filter(i => i.empty && i.free.length >= count).sort((a, b) => a.free.length - b.free.length)[0];
    if (singleEmpty) return take([singleEmpty]);
    const empties = info.filter(i => i.empty);
    let best = null;
    for (let mask = 1; mask < 1 << empties.length; mask++) {
      const group = empties.filter((_, i) => mask & (1 << i));
      const size = group.reduce((sum, i) => sum + i.free.length, 0);
      if (size < count) continue;
      if (!best || size < best.size || (size === best.size && group.length < best.group.length)) best = { group, size };
    }
    if (best) return take(best.group);
    const shared = info.filter(i => i.free.length >= count).sort((a, b) => a.free.length - b.free.length)[0];
    if (shared) return take([shared]);
    return take([...info].sort((a, b) => b.free.length - a.free.length));
  }

  /* ---------- Main view state ---------- */
  function defaultTime(date) {
    if (date !== Store.localNow().date) return Store.TIMES[0];
    return Store.TIMES.find(time => !slotOver(date, time)) || Store.TIMES[Store.TIMES.length - 1];
  }
  let day = Store.localNow().date;
  let time = defaultTime(day);
  let toastTimer = null;

  function toast(text) {
    const el = $('#toast');
    el.textContent = text; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 8000);
  }

  function clampDay() {
    const b = Store.bounds();
    if (day < b.min) { day = b.min; time = defaultTime(day); }
    if (day > b.max) day = b.max;
  }

  function renderClock() {
    const now = new Date();
    $('#adm-clock').textContent = new Intl.DateTimeFormat('en-SG', {
      timeZone: Store.ZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true
    }).format(now).replace(/\b(am|pm)\b/, m => m.toUpperCase());
  }

  function render() {
    clampDay();
    renderClock();
    const b = Store.bounds();
    $('#day-name').textContent = dayName(day);
    $('#day-date').textContent = longDate(day);
    $('#day-prev').disabled = day <= b.min;
    $('#day-next').disabled = day >= b.max;
    $('#day-today').hidden = day === b.min;

    const records = readAll();
    const list = records || [];

    // Time buttons
    const times = Store.TIMES.map(t => {
      const count = bookingsAt(list, day, t).reduce((sum, r) => sum + r.seats.length, 0);
      const btn = make('button', 'adm-time');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(t === time));
      btn.append(make('strong', '', timeLabel(t)));
      let note = count ? `${people(count)} booked` : 'No bookings';
      if (slotOver(day, t)) note += ' · finished';
      else if (slotStarted(day, t)) note += ' · now';
      btn.append(make('span', '', note));
      btn.addEventListener('click', () => { time = t; render(); $('#time-buttons [aria-pressed="true"]').focus(); });
      return btn;
    });
    $('#time-buttons').replaceChildren(...times);

    $('#pending-summary').textContent = `${bookingsAt(list, day, time).filter(r => r.status === 'pending').length} awaiting confirmation · selected time`;
    $('#slot-heading').textContent = `${dayName(day)}, ${timeLabel(time)}`;

    // Room cards
    const rooms = Store.ROOMS.map(room => {
      const here = bookingsAt(list, day, time, room.id);
      const bookedSeats = here.reduce((sum, r) => sum + r.seats.length, 0);
      const card = make('article', 'adm-room');
      const head = make('header', 'adm-room-head');
      head.append(make('h2', '', room.name), make('p', '', `${bookedSeats} of ${Store.allSeats.length} seats booked`));
      const grid = make('div', 'adm-tables');
      Store.TABLES.forEach(table => {
        const onTable = here.filter(r => r.seats.some(s => s.startsWith(table.id + '-')));
        const used = onTable.reduce((sum, r) => sum + r.seats.filter(s => s.startsWith(table.id + '-')).length, 0);
        const tile = make('button', `adm-table ${used ? 'is-booked' : 'is-free'}`);
        tile.type = 'button';
        tile.append(make('strong', '', tableLabel(table.id)), make('small', '', `${table.capacity} seats`));
        if (!used) {
          tile.append(make('span', 'adm-table-state', 'FREE'));
          tile.setAttribute('aria-label', `${room.name}, ${tableLabel(table.id)}, free. Tap to book.`);
          tile.addEventListener('click', () => openFlow({ date: day, time, room: room.id, table: table.id }));
          tile.disabled = !records || slotOver(day, time);
        } else {
          const who = onTable.length === 1 ? guestName(onTable[0]) : `${onTable.length} bookings`;
          tile.append(make('span', 'adm-table-state', who));
          if (used < table.capacity) tile.append(make('span', 'adm-table-sub', `${used} of ${table.capacity} seats used`));
          tile.setAttribute('aria-label', `${room.name}, ${tableLabel(table.id)}, booked by ${who}. Tap for details.`);
          tile.addEventListener('click', () => openDetail(onTable[0].id));
        }
        grid.append(tile);
      });
      const ul = make('ul', 'adm-list');
      if (!here.length) ul.append(make('li', 'adm-list-empty', 'No bookings in this room.'));
      here.sort((a, b) => a.seats[0].localeCompare(b.seats[0])).forEach(r => {
        const li = make('li');
        const row = make('button', 'adm-row');
        row.type = 'button';
        const main = make('span', 'adm-row-main');
        main.append(make('span', `adm-status ${r.status}`, r.status === 'pending' ? 'AWAITING CONFIRMATION' : 'CONFIRMED'), make('strong', '', guestName(r)), make('span', '', `${people(r.seats.length)} · ${tablesText(r.seats)}`));
        if (r.guest?.phone) main.append(make('span', 'adm-row-phone', `Tel: ${r.guest.phone}`));
        row.append(main, make('span', 'adm-row-go', 'Details →'));
        row.addEventListener('click', () => openDetail(r.id));
        li.append(row); ul.append(li);
      });
      card.append(head, grid, ul);
      return card;
    });
    $('#rooms').replaceChildren(...rooms);
    $('#new-booking').disabled = !records;
    const cancelled = list.filter(r => r.status === 'cancelled' && r.date === day);
    $('#cancelled-heading').textContent = `Cancelled bookings for this day (${cancelled.length})`;
    $('#cancelled-list').replaceChildren(...cancelled.map(r => {
      const row = make('button', 'adm-row', `${guestName(r)} · ${timeLabel(r.time)} · ${Store.roomName(r.room)} · ${r.id}`);
      row.type = 'button'; row.addEventListener('click', () => openDetail(r.id)); return row;
    }));
    if (!cancelled.length) $('#cancelled-list').append(make('p', '', 'No cancelled bookings for this day.'));
  }

  $('#day-prev').addEventListener('click', () => { day = Store.addDays(day, -1); time = defaultTime(day); render(); });
  $('#day-next').addEventListener('click', () => { day = Store.addDays(day, 1); time = defaultTime(day); render(); });
  $('#day-today').addEventListener('click', () => { day = Store.localNow().date; time = defaultTime(day); render(); });

  /* ---------- Booking details and cancel ---------- */
  const detail = $('#detail');
  let detailId = null, detailRecord = null, busy = false;

  function openDetail(id) {
    const records = readAll(); if (!records) return;
    const r = records.find(item => item.id === id); if (!r) return;
    detailId = id; detailRecord = r;
    $('#staff-edit').hidden = true; $('#detail-list').hidden = false;
    $('#detail-title').textContent = guestName(r);
    const rows = [
      ['When', `${dayName(r.date)}, ${shortDate(r.date)} · ${timeLabel(r.time)}`],
      ['Where', `${Store.roomName(r.room)} · ${tablesText(r.seats)}`],
      ['People', people(r.seats.length)],
      ['Status', r.status === 'pending' ? 'Awaiting confirmation' : r.status === 'cancelled' ? 'Cancelled' : 'Confirmed (demo)'],
      ['Seats', Store.seatSummary(r.seats)]
    ];
    rows.push(['Phone', r.guest?.phone || 'Not provided']);
    if (r.guest?.note) rows.push(['Note', r.guest.note]);
    rows.push(['Booked by', r.source === 'staff' ? 'Staff (phone or walk-in)' : 'Customer, on the website']);
    rows.push(['Booking no.', r.id]);
    $('#detail-list').replaceChildren(...rows.flatMap(([k, v]) => [make('dt', '', k), make('dd', '', v)]));
    $('#detail-error').hidden = true;
    showDetailButtons(false);
    if (!detail.open) detail.showModal();
  }

  function showDetailButtons(asking) {
    $('#detail-ask').hidden = !asking;
    const buttons = [];
    if (!asking) {
      const close = make('button', 'adm-btn adm-btn-plain', 'Close');
      close.type = 'button'; close.addEventListener('click', () => detail.close());
      const cancel = make('button', 'adm-btn adm-btn-red', 'Cancel this booking');
      cancel.type = 'button'; cancel.addEventListener('click', () => { showDetailButtons(true); });
      if (detailRecord.status === 'pending') {
        const confirm = make('button', 'adm-btn adm-btn-teal', 'Confirm booking');
        confirm.type = 'button'; confirm.addEventListener('click', confirmBooking); buttons.push(confirm);
      }
      if (detailRecord.status !== 'cancelled') {
        const edit = make('button', 'adm-btn adm-btn-plain', 'Edit booking');
        edit.type = 'button'; edit.addEventListener('click', openEdit); buttons.push(edit, cancel);
      }
      buttons.push(close);
    } else {
      const keep = make('button', 'adm-btn adm-btn-teal', 'No, keep it');
      keep.type = 'button'; keep.addEventListener('click', () => showDetailButtons(false));
      const yes = make('button', 'adm-btn adm-btn-red', 'Yes, cancel it');
      yes.type = 'button'; yes.addEventListener('click', confirmCancel);
      buttons.push(keep, yes);
    }
    $('#detail-buttons').replaceChildren(...buttons);
    buttons[0].focus();
  }

  async function confirmCancel() {
    if (busy) return;
    const r = detailRecord;
    if (!r) return;
    busy = true;
    try {
      await Store.cancel(r.id, r.revision);
      detail.close();
      toast(`Cancelled: ${guestName(r)}, ${timeLabel(r.time)}. ${r.seats.length} seats are free again.`);
    } catch (error) {
      $('#detail-error').textContent = error.message; $('#detail-error').hidden = false;
    } finally { busy = false; render(); }
  }

  async function confirmBooking() {
    if (busy) return;
    busy = true;
    try {
      const record = await Store.confirm(detailRecord.id, detailRecord.revision);
      openDetail(record.id); toast(`Confirmed for the demo: ${guestName(record)}.`);
    } catch (error) { $('#detail-error').textContent = error.message; $('#detail-error').hidden = false; }
    finally { busy = false; render(); }
  }

  // Edit exact seats and guest details without making a replacement booking.
  function openEdit() {
    const record = detailRecord, form = $('#staff-edit');
    form.replaceChildren(); form.hidden = false; $('#detail-list').hidden = true;
    $('#detail-buttons').replaceChildren(); $('#detail-error').hidden = true;
    const fields = {};
    function field(key, label, type, value, options) {
      const wrap = make('label', '', label), input = make(options ? 'select' : 'input');
      if (options) options.forEach(([id, name]) => { const option = make('option', '', name); option.value = id; input.append(option); });
      else input.type = type;
      input.name = key; input.value = value || ''; input.required = ['name','date','time','room'].includes(key);
      wrap.append(input); form.append(wrap); fields[key] = input; return input;
    }
    field('name', 'Guest name', 'text', record.guest?.name).maxLength = 60;
    field('phone', 'Phone (optional)', 'tel', record.guest?.phone).maxLength = 24;
    field('note', 'Special requests (optional)', 'text', record.guest?.note).maxLength = 140;
    const date = field('date', 'Date (Singapore)', 'date', record.date);
    const bounds = Store.bounds(); date.min = bounds.min; date.max = bounds.max;
    field('time', 'Dinner time', '', record.time, Store.TIMES.map(t => [t, timeLabel(t)]));
    field('room', 'Room', '', record.room, Store.ROOMS.map(r => [r.id, r.name]));
    const seats = make('fieldset', 'staff-seats'), legend = make('legend', '', 'Select seats'); seats.append(legend);
    const grid = make('div', 'staff-seat-grid'); seats.append(grid); form.append(seats);
    function drawSeats(preserve = []) {
      let records;
      try { records = Store.read(); } catch (error) { $('#detail-error').textContent = error.message; $('#detail-error').hidden = false; return; }
      const blocked = Store.occupied(records, {date: fields.date.value, time: fields.time.value, room: fields.room.value}, record.id);
      grid.replaceChildren(...Store.TABLES.map(table => {
        const group = make('div', 'staff-seat-table'); group.append(make('strong', '', table.name));
        Store.allSeats.filter(seat => seat.startsWith(table.id + '-')).forEach(seat => {
          const label = make('label'), input = make('input'); input.type = 'checkbox'; input.name = 'seat'; input.value = seat;
          input.checked = preserve.includes(seat) && !blocked.has(seat); input.disabled = blocked.has(seat);
          label.append(input, make('span', '', seat.split('-')[1] + (input.disabled ? ' · taken' : ''))); group.append(label);
        }); return group;
      }));
    }
    ['date','time','room'].forEach(key => fields[key].addEventListener('change', () => drawSeats()));
    drawSeats(record.seats);
    form.append(make('p', 'staff-edit-hint', 'Changing date, time, or room clears selected seats. Saving keeps the same booking reference.'));
    const actions = make('div', 'detail-buttons'), save = make('button', 'adm-btn adm-btn-teal', 'Save changes'), discard = make('button', 'adm-btn adm-btn-plain', 'Discard changes');
    save.type = 'submit'; discard.type = 'button'; discard.addEventListener('click', () => { if (!busy) openDetail(record.id); }); actions.append(save, discard); form.append(actions);
    form.onsubmit = async event => {
      event.preventDefault(); if (busy) return;
      if (!fields.name.value.trim()) { fields.name.focus(); return; }
      busy = true; save.disabled = true;
      try {
        const updated = await Store.save({date: fields.date.value, time: fields.time.value, room: fields.room.value,
          seats: [...form.querySelectorAll('[name=seat]:checked')].map(input => input.value),
          guest: {name: fields.name.value, phone: fields.phone.value, note: fields.note.value}}, record.id, record.revision, {staff: true});
        day = updated.date; time = updated.time; openDetail(updated.id); toast('Booking details updated.');
      } catch (error) { $('#detail-error').textContent = error.message; $('#detail-error').hidden = false; }
      finally { busy = false; save.disabled = false; render(); }
    };
    fields.name.focus();
  }
  detail.addEventListener('close', () => $('#slot-heading').focus({preventScroll: true}));
  $('#slot-heading').tabIndex = -1;

  /* ---------- New booking, one question at a time ---------- */
  const flow = $('#flow');
  const STEPS = ['day', 'time', 'people', 'room', 'guest', 'check'];
  let data = {}, step = 'day', history = [];

  function openFlow(preset = {}) {
    data = { date: preset.date || null, time: preset.time || null, room: preset.room || null, table: preset.table || null, count: null, seats: null, name: '', phone: '' };
    history = [];
    step = preset.room ? 'people' : 'day';
    $('#flow-error').hidden = true;
    drawStep();
    flow.showModal();
  }
  function go(next) { history.push(step); step = next; $('#flow-error').hidden = true; drawStep(); }
  function flowError(text) { $('#flow-error').textContent = text; $('#flow-error').hidden = false; }

  $('#new-booking').addEventListener('click', () => openFlow({ date: day }));
  $('#flow-close').addEventListener('click', () => flow.close());
  $('#flow-back').addEventListener('click', () => {
    if (!history.length) { flow.close(); return; }
    step = history.pop(); $('#flow-error').hidden = true; drawStep();
  });

  function bigChoice(title, sub, onPick, { selected = false, disabled = false, className = '' } = {}) {
    const btn = make('button', `flow-choice ${className}`);
    btn.type = 'button';
    btn.append(make('strong', '', title));
    if (sub) btn.append(make('span', '', sub));
    btn.disabled = disabled;
    if (selected) btn.classList.add('is-selected');
    btn.addEventListener('click', onPick);
    return btn;
  }

  function drawStep() {
    const records = readAll() || [];
    const body = $('#flow-body');
    const index = STEPS.indexOf(step);
    $('#flow-step').textContent = step === 'done' ? '' : `Step ${index + 1} of ${STEPS.length}`;
    $('#flow-back').hidden = step === 'done';
    body.className = `flow-body flow-${step}`;
    let question = '', help = '', items = [];

    if (step === 'day') {
      question = 'Which day?';
      const b = Store.bounds();
      for (let d = b.min; d <= b.max; d = Store.addDays(d, 1)) {
        const date = d;
        items.push(bigChoice(dayName(date), shortDate(date), () => { data.date = date; data.time = null; go('time'); }, { selected: date === data.date }));
      }
    }

    if (step === 'time') {
      question = 'What time?';
      help = `${dayName(data.date)}, ${longDate(data.date)}`;
      items = Store.TIMES.map(t => {
        const free = Store.ROOMS.reduce((sum, room) => sum + freeSeats(records, data.date, t, room.id).length, 0);
        const over = slotOver(data.date, t);
        const sub = over ? 'Finished' : free ? `${free} seats free` : 'Full';
        return bigChoice(timeLabel(t), sub, () => { data.time = t; go('people'); }, { selected: t === data.time, disabled: over || !free });
      });
    }

    if (step === 'people') {
      question = 'How many people?';
      const roomFree = Store.ROOMS.map(room => freeSeats(records, data.date, data.time, room.id).length);
      const most = Math.max(...(data.room ? [freeSeats(records, data.date, data.time, data.room).length] : roomFree));
      help = `${dayName(data.date)} · ${timeLabel(data.time)}${data.room ? ` · ${Store.roomName(data.room)}` : ''}`;
      for (let n = 1; n <= 20; n++) {
        const count = n;
        items.push(bigChoice(String(n), '', () => {
          data.count = count;
          if (data.room) {
            data.seats = pickSeats(records, data.date, data.time, data.room, count, data.table);
            if (data.seats) { go('guest'); return; }
          }
          data.room = null; data.table = null; go('room');
        }, { selected: n === data.count, disabled: n > most, className: 'flow-number' }));
      }
      if (most < 20) help += ` · Up to ${most} can fit`;
    }

    if (step === 'room') {
      question = 'Which room?';
      help = `${people(data.count)} · ${dayName(data.date)} · ${timeLabel(data.time)}`;
      items = Store.ROOMS.map(room => {
        const seats = pickSeats(records, data.date, data.time, room.id, data.count);
        const free = freeSeats(records, data.date, data.time, room.id).length;
        const sub = seats ? `${tablesText(seats)} · ${free} seats free` : 'Not enough space';
        return bigChoice(room.name, sub, () => { data.room = room.id; data.seats = seats; go('guest'); }, { selected: room.id === data.room, disabled: !seats });
      });
    }

    if (step === 'guest') {
      question = "Guest's name and phone";
      help = 'Name is needed. Phone is helpful if plans change.';
      const form = make('form', 'flow-form');
      const nameLabel = make('label', '', 'Name');
      const name = make('input'); name.type = 'text'; name.autocomplete = 'off'; name.maxLength = 60; name.value = data.name; name.id = 'guest-name';
      nameLabel.append(name);
      const phoneLabel = make('label', '', 'Phone (optional)');
      const phone = make('input'); phone.type = 'tel'; phone.inputMode = 'tel'; phone.autocomplete = 'off'; phone.maxLength = 24; phone.value = data.phone; phone.id = 'guest-phone';
      phoneLabel.append(phone);
      const next = make('button', 'adm-btn adm-btn-teal adm-btn-wide', 'Next →'); next.type = 'submit';
      form.append(nameLabel, phoneLabel, next);
      form.addEventListener('submit', event => {
        event.preventDefault();
        data.name = name.value.trim(); data.phone = phone.value.trim();
        if (!data.name) { flowError("Please write the guest's name."); name.focus(); return; }
        go('check');
      });
      items = [form];
      requestAnimationFrame(() => name.focus());
    }

    if (step === 'check') {
      question = 'Is this correct?';
      const card = make('dl', 'flow-summary');
      [['Name', data.name], ['Phone', data.phone || '—'], ['Day', `${dayName(data.date)}, ${longDate(data.date)}`], ['Time', timeLabel(data.time)],
       ['People', people(data.count)], ['Room', Store.roomName(data.room)], ['Table', tablesText(data.seats)]]
        .forEach(([k, v]) => card.append(make('dt', '', k), make('dd', '', v)));
      const save = make('button', 'adm-btn adm-btn-teal adm-btn-wide', 'Yes, save booking ✓');
      save.type = 'button';
      save.addEventListener('click', async () => {
        if (busy) return; busy = true; save.disabled = true; save.textContent = 'Saving…';
        try {
          await Store.save({ date: data.date, time: data.time, room: data.room, seats: data.seats, guest: { name: data.name, phone: data.phone } }, null, null, { staff: true });
          day = data.date; time = data.time;
          step = 'done'; drawStep(); render();
        } catch (error) {
          flowError(`${error.message} Press Back to choose again.`);
          save.disabled = false; save.textContent = 'Yes, save booking ✓';
        } finally { busy = false; }
      });
      items = [card, save];
    }

    if (step === 'done') {
      question = 'Booking saved ✓';
      help = `${data.name} · ${people(data.count)} · ${dayName(data.date)} ${timeLabel(data.time)} · ${Store.roomName(data.room)}, ${tablesText(data.seats)}`;
      const done = make('button', 'adm-btn adm-btn-teal adm-btn-wide', 'Done');
      done.type = 'button'; done.addEventListener('click', () => flow.close());
      const another = make('button', 'adm-btn adm-btn-plain adm-btn-wide', '+ Add another booking');
      another.type = 'button'; another.addEventListener('click', () => openFlow({ date: data.date }));
      items = [done, another];
      requestAnimationFrame(() => done.focus());
    }

    $('#flow-question').textContent = question;
    $('#flow-help').textContent = help;
    $('#flow-help').hidden = !help;
    body.replaceChildren(...items);
    if (step !== 'guest' && step !== 'done') requestAnimationFrame(() => (body.querySelector('.is-selected') || body.querySelector('button:not(:disabled)'))?.focus());
  }

  $('#load-samples').addEventListener('click', async () => {
    if (busy) return; busy = true; $('#load-samples').disabled = true;
    let added = 0;
    try {
      const slot = Store.defaultSlot(); day = slot.date; time = slot.time;
      const samples = [
        {name:'Alex Tan (sample)', phone:'Sample contact', note:'Birthday dinner', room:'private', count:4},
        {name:'Jamie Lee (sample)', phone:'Sample contact', note:'A table near the window, please', room:'lobby', count:2},
        {name:'Sam Kim (sample)', phone:'Sample contact', note:'Family dinner', room:'room3', count:6}
      ];
      for (const sample of samples) {
        const records = Store.read();
        if (records.some(r => r.guest?.name === sample.name)) continue;
        const seats = pickSeats(records, day, time, sample.room, sample.count);
        if (!seats) continue;
        await Store.save({date:day, time, room:sample.room, seats, guest:sample}); added++;
      }
      toast(added ? `${added} sample bookings added. Select Details to confirm, edit, or cancel.` : 'Sample bookings have already been loaded, or this time is full.');
    } catch (error) { $('#error').textContent = error.message; $('#error').hidden = false; }
    finally { busy = false; $('#load-samples').disabled = false; render(); }
  });

  /* ---------- Print the whole day ---------- */
  function buildPrint() {
    const records = readAll() || [];
    const sheet = $('#print-sheet');
    const parts = [make('h1', '', `Bae Sik Dang — bookings for ${longDate(day)}`)];
    Store.TIMES.forEach(t => {
      parts.push(make('h2', '', timeLabel(t)));
      const rows = bookingsAt(records, day, t).sort((a, b) => a.room.localeCompare(b.room) || a.seats[0].localeCompare(b.seats[0]));
      if (!rows.length) { parts.push(make('p', '', 'No bookings.')); return; }
      const table = make('table');
      const head = make('tr');
      ['Room', 'Table', 'Name', 'People', 'Phone', 'Status', '✓'].forEach(h => head.append(make('th', '', h)));
      table.append(head);
      rows.forEach(r => {
        const tr = make('tr');
        [Store.roomName(r.room), tablesText(r.seats), guestName(r), String(r.seats.length), r.guest?.phone || '', r.status, ''].forEach(v => tr.append(make('td', '', v)));
        table.append(tr);
      });
      parts.push(table);
    });
    sheet.replaceChildren(...parts);
  }
  $('#print-list').addEventListener('click', () => { buildPrint(); window.print(); });
  addEventListener('beforeprint', buildPrint);

  /* ---------- Stay up to date ---------- */
  function refresh() {
    if (flow.open && step !== 'done' && step !== 'guest') drawStep();
    if (detail.open && detailId) {
      const r = (readAll() || []).find(item => item.id === detailId);
      if (!r) detail.close();
      else if ($('#staff-edit').hidden) openDetail(r.id);
    }
    render();
  }
  addEventListener('storage', event => { if (event.key === Store.KEY || event.key === null) refresh(); });
  addEventListener('bsd:reservations-changed', () => { if (!busy) refresh(); });
  addEventListener('focus', render);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  setInterval(render, 60000);
  render();
})();
