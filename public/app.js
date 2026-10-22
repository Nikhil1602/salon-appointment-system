// Minimal vanilla-JS frontend that exercises the backend APIs.
'use strict';

const $ = (sel) => document.querySelector(sel);
let token = localStorage.getItem('token') || null;
let me = JSON.parse(localStorage.getItem('me') || 'null');
let selectedSlot = null;

// --- API helper ------------------------------------------------------------
async function api(path, method = 'GET', body) {
  const opt = { method, headers: {} };
  if (body) {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body);
  }
  if (token) opt.headers.Authorization = 'Bearer ' + token;
  const res = await fetch('/api' + path, opt);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function toast(msg, isErr) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (isErr ? ' err' : '');
  setTimeout(() => (t.className = 'toast hidden'), 2600);
}

// --- auth ------------------------------------------------------------------
document.querySelectorAll('.tab').forEach((b) =>
  b.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    $('#login-form').classList.toggle('hidden', b.dataset.tab !== 'login');
    $('#register-form').classList.toggle('hidden', b.dataset.tab !== 'register');
  })
);

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    const r = await api('/auth/login', 'POST', f);
    setSession(r.token, r.user);
  } catch (err) {
    toast(err.message, true);
  }
});

$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    const r = await api('/auth/register', 'POST', f);
    setSession(r.token, r.user);
    toast('Welcome, ' + r.user.name);
  } catch (err) {
    toast(err.message, true);
  }
});

function setSession(t, user) {
  token = t;
  me = user;
  localStorage.setItem('token', t);
  localStorage.setItem('me', JSON.stringify(user));
  render();
}
function logout() {
  token = me = null;
  localStorage.clear();
  render();
}

// --- navigation ------------------------------------------------------------
const VIEWS = [
  { id: 'book', label: 'Book', roles: ['customer', 'staff', 'admin'] },
  { id: 'appointments', label: 'Appointments', roles: ['customer', 'staff', 'admin'] },
  { id: 'profile', label: 'Profile', roles: ['customer', 'staff', 'admin'] },
  { id: 'admin', label: 'Admin', roles: ['admin'] },
];

function showView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  $('#view-' + id).classList.remove('hidden');
  document.querySelectorAll('#nav button').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === id)
  );
  if (id === 'book') loadBookingOptions();
  if (id === 'appointments') loadAppointments();
  if (id === 'profile') loadProfile();
  if (id === 'admin') loadAdmin();
}

function render() {
  const loggedIn = !!token;
  $('#auth').classList.toggle('hidden', loggedIn);
  $('#app').classList.toggle('hidden', !loggedIn);
  $('#whoami').innerHTML = loggedIn
    ? `${me.name} <span class="badge">${me.role}</span> <button class="small ghost" id="logout">Logout</button>`
    : '';
  if (!loggedIn) return;
  $('#logout').addEventListener('click', logout);

  const nav = $('#nav');
  nav.innerHTML = '';
  VIEWS.filter((v) => v.roles.includes(me.role)).forEach((v) => {
    const b = document.createElement('button');
    b.textContent = v.label;
    b.dataset.view = v.id;
    b.addEventListener('click', () => showView(v.id));
    nav.appendChild(b);
  });
  showView('book');
}

// --- booking ---------------------------------------------------------------
async function loadBookingOptions() {
  const [services, staff] = await Promise.all([api('/services'), api('/staff')]);
  $('#book-service').innerHTML = services
    .map((s) => `<option value="${s.id}">${s.name} — ${s.duration_min}min, $${s.price}</option>`)
    .join('');
  window._staff = staff;
  refreshStaffOptions();
  $('#book-service').onchange = refreshStaffOptions;
  if (!$('#book-date').value) $('#book-date').value = new Date().toISOString().slice(0, 10);
}

function refreshStaffOptions() {
  const serviceId = Number($('#book-service').value);
  const able = (window._staff || []).filter((st) => st.services.some((s) => s.id === serviceId));
  $('#book-staff').innerHTML = able.length
    ? able.map((st) => `<option value="${st.id}">${st.name} — ${st.specialization || ''}</option>`).join('')
    : '<option value="">No staff for this service</option>';
}

$('#load-slots').addEventListener('click', async () => {
  selectedSlot = null;
  const q = new URLSearchParams({
    staff_id: $('#book-staff').value,
    service_id: $('#book-service').value,
    date: $('#book-date').value,
  });
  try {
    const { slots } = await api('/appointments/slots?' + q);
    $('#slots').innerHTML = slots.length
      ? slots.map((s) => `<span class="slot" data-t="${s}">${s.slice(11)}</span>`).join('')
      : '<p class="hint">No free times that day.</p>';
    document.querySelectorAll('.slot').forEach((el) =>
      el.addEventListener('click', () => {
        document.querySelectorAll('.slot').forEach((x) => x.classList.remove('sel'));
        el.classList.add('sel');
        selectedSlot = el.dataset.t;
        book();
      })
    );
  } catch (err) {
    toast(err.message, true);
  }
});

async function book() {
  if (!selectedSlot) return;
  try {
    await api('/appointments', 'POST', {
      staff_id: Number($('#book-staff').value),
      service_id: Number($('#book-service').value),
      start_time: selectedSlot,
      pay: $('#book-pay').checked,
    });
    toast('Appointment booked!');
    $('#load-slots').click();
  } catch (err) {
    toast(err.message, true);
  }
}

// --- my appointments -------------------------------------------------------
async function loadAppointments() {
  const list = await api('/appointments');
  $('#appointments').innerHTML =
    list
      .map(
        (a) => `<div class="row">
      <b>${a.service_name}</b> with ${a.staff_name}
      <span class="badge ${a.status}">${a.status}</span>
      <span class="badge ${a.payment_status === 'paid' ? 'paid' : ''}">${a.payment_status}</span>
      <div class="meta">${a.start_time.replace('T', ' ')} • $${a.price}</div>
      ${
        a.status === 'booked'
          ? `<div class="actions">
               <button class="small danger" onclick="cancelAppt(${a.id})">Cancel</button>
               <button class="small ghost" onclick="reschedule(${a.id})">Reschedule</button>
               <button class="small ghost" onclick="review(${a.id})">Review</button>
             </div>`
          : ''
      }
    </div>`
      )
      .join('') || '<p class="hint">No appointments yet.</p>';
}

window.cancelAppt = async (id) => {
  try {
    await api('/appointments/' + id, 'DELETE');
    toast('Cancelled');
    loadAppointments();
  } catch (e) {
    toast(e.message, true);
  }
};
window.reschedule = async (id) => {
  const t = prompt('New start time (YYYY-MM-DDTHH:MM):');
  if (!t) return;
  try {
    await api('/appointments/' + id + '/reschedule', 'PUT', { start_time: t });
    toast('Rescheduled');
    loadAppointments();
  } catch (e) {
    toast(e.message, true);
  }
};
window.review = async (id) => {
  const rating = Number(prompt('Rating 1-5:'));
  if (!rating) return;
  const comment = prompt('Comment (optional):') || '';
  try {
    await api('/reviews', 'POST', { appointment_id: id, rating, comment });
    toast('Thanks for the review!');
  } catch (e) {
    toast(e.message, true);
  }
};

// --- profile ---------------------------------------------------------------
async function loadProfile() {
  const p = await api('/profile');
  const f = $('#profile-form');
  f.name.value = p.name || '';
  f.phone.value = p.phone || '';
  f.preferences.value = p.preferences || '';
}
$('#profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    const u = await api('/profile', 'PUT', f);
    me.name = u.name;
    localStorage.setItem('me', JSON.stringify(me));
    toast('Profile saved');
    render();
    showView('profile');
  } catch (err) {
    toast(err.message, true);
  }
});

// --- admin -----------------------------------------------------------------
async function loadAdmin() {
  const [appts, users] = await Promise.all([api('/admin/appointments'), api('/admin/users')]);
  $('#admin-appointments').innerHTML =
    appts
      .map(
        (a) => `<div class="row"><b>${a.service_name}</b> — ${a.customer_name} with ${a.staff_name}
      <span class="badge ${a.status}">${a.status}</span>
      <div class="meta">${a.start_time.replace('T', ' ')}</div></div>`
      )
      .join('') || '<p class="hint">None.</p>';
  $('#admin-users').innerHTML = users
    .map(
      (u) => `<div class="row">${u.name} — ${u.email} <span class="badge">${u.role}</span></div>`
    )
    .join('');
}
$('#service-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  try {
    await api('/services', 'POST', {
      name: f.name,
      duration_min: Number(f.duration_min),
      price: Number(f.price),
    });
    toast('Service added');
    e.target.reset();
  } catch (err) {
    toast(err.message, true);
  }
});

render();
