// ==========================================
// 1. STATE & LOCAL STORAGE (OFFLINE FIRST)
// ==========================================
const STORE_TICKETS = 'mancup_tickets_v3';
const STORE_LOGS = 'mancup_activations_v3';
const STORE_COUNTER = 'mancup_counter_v3';

let tickets = JSON.parse(localStorage.getItem(STORE_TICKETS) || '{}');
let activations = JSON.parse(localStorage.getItem(STORE_LOGS) || '[]');
let counter = parseInt(localStorage.getItem(STORE_COUNTER) || '1', 10);

const saveState = () => {
  localStorage.setItem(STORE_TICKETS, JSON.stringify(tickets));
  localStorage.setItem(STORE_LOGS, JSON.stringify(activations));
  localStorage.setItem(STORE_COUNTER, String(counter));
};

// ==========================================
// 2. UTILITIES & TOAST UI
// ==========================================
const $ = id => document.getElementById(id);
$('year').textContent = new Date().getFullYear();

const showToast = (msg, type = 'info') => {
  const toast = $('toast');
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  const colors = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-slate-800', warning: 'bg-amber-500' };
  
  toast.className = `fixed bottom-6 right-6 z-50 px-6 py-4 rounded-xl text-white font-bold shadow-2xl transform transition-all duration-300 flex items-center gap-3 ${colors[type]}`;
  toast.innerHTML = `<span class="text-xl">${icon}</span> <span>${msg}</span>`;
  toast.classList.remove('translate-y-24', 'opacity-0');
  
  setTimeout(() => { toast.classList.add('translate-y-24', 'opacity-0'); }, 3000);
};

const wibKey = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const wibFormat = (date) => new Date(date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
const isSameWIBDay = (a, b) => wibKey(a) === wibKey(b);

// ==========================================
// 3. LOADING SCREEN 10 DETIK & NAVIGASI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = $('loading-screen');
  const statusText = $('loading-status');
  const thankYouText = $('loading-thanks');
  const bodyContainer = $('body-container');

  // Timeline animasi
  setTimeout(() => { statusText.innerText = "Memeriksa Database Perangkat..."; }, 3000);
  setTimeout(() => { statusText.innerText = "Sistem Siap"; }, 6000);
  setTimeout(() => { 
      statusText.innerText = "Selamat Bertugas!";
      thankYouText.classList.remove('opacity-0'); 
  }, 8000);

  // Tutup layar tepat di 10 detik
  setTimeout(() => {
      loadingScreen.classList.add('opacity-0');
      bodyContainer.classList.remove('overflow-hidden');
      setTimeout(() => { 
          loadingScreen.style.display = 'none'; 
          initSystem();
      }, 1000);
  }, 10000); 
});

function initSystem() {
  switchSection('sec-activation', 'nav-activation');
  $('export-date').value = wibKey();
  refreshAllData();
  showToast('Sistem MANCUP berjalan optimal', 'success');
}

// Logika Navigasi
const sections = ['sec-activation', 'sec-create', 'sec-dashboard'];
const navIds = ['nav-activation', 'nav-create', 'nav-dashboard'];

navIds.forEach((id, idx) => {
  $(id).addEventListener('click', () => switchSection(sections[idx], id));
});

function switchSection(secId, navId) {
  sections.forEach(s => $(s).classList.add('hidden'));
  navIds.forEach(n => $(n).classList.remove('active'));
  
  $(secId).classList.remove('hidden');
  $(navId).classList.add('active');

  if (secId === 'sec-activation') refreshActivationStats();
  if (secId === 'sec-dashboard') refreshAllData();
}

// ==========================================
// 4. PEMBUATAN TIKET (MANUAL & CSV)
// ==========================================
function getNextId() {
  let i = counter;
  while (tickets['FT' + String(i).padStart(4, '0')]) i++;
  const id = 'FT' + String(i).padStart(4, '0');
  counter = i + 1;
  return id;
}

$('form-create').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('reg-name').value.trim();
  const type = $('reg-type').value;
  const maxDays = parseInt($('reg-days').value, 10);
  const team = $('reg-team').value.trim();
  const note = $('reg-note').value.trim();

  const id = getNextId();
  tickets[id] = {
    id, name, type, maxDays, team, note,
    usedDays: 0, createdAt: new Date().toISOString(), deactivated: false, history: []
  };
  saveState();

  const res = $('create-result');
  res.innerHTML = `Tiket <strong>${name}</strong> berhasil. ID: <strong class="text-xl ml-2">${id}</strong>`;
  res.classList.remove('hidden');
  $('form-create').reset();
  showToast(`Berhasil generate ID: ${id}`, 'success');
});

// Import Massal (CSV)
$('btn-dl-template').addEventListener('click', () => {
  const header = 'Nama Pembeli,Jenis Tiket,Max Hari,Tim Favorit,Catatan\n';
  const sample = 'Siswa Dummy,Siswa MAN Kapuas,7,-,-\nTamu VIP,VIP,14,-,Gate A';
  downloadCSV(header + sample, 'Template_Import_MANCUP.csv');
});

$('btn-process-csv').addEventListener('click', () => {
  const file = $('csv-file').files[0];
  if (!file) return showToast('Pilih file CSV terlebih dahulu', 'warning');

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const lines = e.target.result.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length <= 1) return showToast('CSV kosong', 'warning');

      const created = [];
      let errors = 0;

      for (let i = 1; i < lines.length; i++) {
        // Regex untuk membaca CSV dengan aman (menghormati tanda kutip)
        const fields = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(f => f.replace(/^"(.*)"$/,'$1').trim());
        const [name, type, maxD, team = '', note = ''] = fields;

        if (!name || !type || !maxD || isNaN(parseInt(maxD, 10))) {
          errors++; continue;
        }

        const id = getNextId();
        tickets[id] = {
          id, name, type, maxDays: parseInt(maxD, 10), team, note,
          usedDays: 0, createdAt: new Date().toISOString(), deactivated: false, history: []
        };
        created.push({ id, name, type });
      }

      saveState();
      renderImportSummary(created, errors);
      $('csv-file').value = '';
      showToast(`Selesai! ${created.length} Tiket berhasil dibuat.`, 'success');
    } catch (err) {
      showToast('Gagal memproses file. Pastikan format benar.', 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
});

function renderImportSummary(created, errors) {
  const box = $('import-summary');
  box.innerHTML = `
    <div class="font-bold text-slate-800 mb-2">Ringkasan Eksekusi:</div>
    <div class="flex gap-4 mb-4">
      <div class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded text-sm font-bold">Sukses: ${created.length}</div>
      <div class="bg-rose-100 text-rose-700 px-3 py-1 rounded text-sm font-bold">Gagal/Dilewati: ${errors}</div>
    </div>
    <div class="max-h-32 overflow-y-auto text-xs space-y-1 text-slate-600 custom-scrollbar pr-2">
      ${created.slice(0, 30).map(t => `<div class="border-b border-slate-200 pb-1">${t.id} - ${t.name}</div>`).join('')}
      ${created.length > 30 ? `<div>...dan ${created.length - 30} lainnya.</div>` : ''}
    </div>
  `;
  box.classList.remove('hidden');
}

// ==========================================
// 5. VALIDASI & PENCARIAN TIKET
// ==========================================
$('btn-search').addEventListener('click', () => processSearch());
$('search-id').addEventListener('keypress', (e) => { if(e.key === 'Enter') processSearch(); });

function processSearch() {
  const id = $('search-id').value.trim().toUpperCase();
  if(!id) return showToast('Masukkan ID Tiket', 'warning');
  renderTicketDetail(id);
}

function renderTicketDetail(id) {
  const box = $('search-result');
  const t = tickets[id];

  if (!t) {
    box.innerHTML = `<div class="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-bold text-center">Tiket ${id} Tidak Ditemukan.</div>`;
    box.classList.remove('hidden');
    return;
  }

  const todayUsed = t.history.some(h => isSameWIBDay(new Date(h.date), new Date()));
  const isExhausted = t.usedDays >= t.maxDays;
  const isDead = t.deactivated;
  
  let statusBadge = '';
  if(isDead) statusBadge = '<span class="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold">DINONAKTIFKAN</span>';
  else if(isExhausted) statusBadge = '<span class="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">HABIS</span>';
  else if(t.usedDays > 0) statusBadge = '<span class="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">AKTIF</span>';
  else statusBadge = '<span class="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">BARU</span>';

  const lastAct = t.history.length > 0 ? wibFormat(t.history[t.history.length-1].date) : '-';
  const disableBtnAction = isDead ? `toggleStatus('${id}')` : (isExhausted || todayUsed ? `activateManual('${id}')` : `activateManual('${id}')`); // simplify logic below

  box.innerHTML = `
    <div class="p-6 border border-slate-200 rounded-xl bg-slate-50 transition-all">
      <div class="flex flex-col md:flex-row justify-between gap-4 mb-4">
        <div>
          <div class="text-sm font-bold text-slate-400">ID TIKET</div>
          <div class="text-3xl font-extrabold text-slate-800">${t.id}</div>
          <div class="mt-1">${statusBadge}</div>
        </div>
        <div class="flex-1 grid grid-cols-2 gap-3 text-sm">
          <div><div class="text-slate-400 font-semibold">Nama</div><div class="font-bold text-slate-800">${t.name}</div></div>
          <div><div class="text-slate-400 font-semibold">Jenis</div><div class="font-bold text-slate-800">${t.type}</div></div>
          <div class="col-span-2"><div class="text-slate-400 font-semibold">Aktivasi Terakhir</div><div class="font-bold text-slate-800">${lastAct}</div></div>
        </div>
      </div>
      
      <div class="mb-5">
        <div class="flex justify-between text-xs font-bold text-slate-500 mb-1">
          <span>PROGRESS</span>
          <span>${t.usedDays} / ${t.maxDays} HARI</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${(t.usedDays/t.maxDays)*100}%"></div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 border-t border-slate-200 pt-5">
        <button onclick="activateManual('${id}')" class="px-6 py-2.5 rounded-lg font-bold text-white transition shadow-sm ${(isDead || isExhausted || todayUsed) ? 'bg-slate-300 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700'}" ${(isDead || isExhausted || todayUsed) ? 'disabled' : ''}>
          Sahkan Kehadiran (Hari Ini)
        </button>
        <button onclick="toggleStatus('${id}')" class="px-6 py-2.5 rounded-lg font-bold transition shadow-sm ${isDead ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}">
          ${isDead ? 'Aktifkan Kembali' : 'Nonaktifkan Tiket'}
        </button>
      </div>
      ${todayUsed ? `<div class="mt-3 text-sm font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">⚠️ Tiket ini sudah disahkan untuk hari ini (WIB).</div>` : ''}
    </div>
  `;
  box.classList.remove('hidden');
}

window.activateManual = function(id) {
  const t = tickets[id];
  if (!t || t.deactivated || t.usedDays >= t.maxDays) return;
  if (t.history.some(h => isSameWIBDay(new Date(h.date), new Date()))) return;

  t.usedDays++;
  const entry = { id: t.id, name: t.name, type: t.type, date: new Date().toISOString() };
  t.history.push(entry);
  activations.push(entry);
  saveState();

  showToast(`Tiket ${id} Sah (Hari ke-${t.usedDays})`, 'success');
  renderTicketDetail(id);
  refreshActivationStats();
};

window.toggleStatus = function(id) {
  if(!tickets[id]) return;
  tickets[id].deactivated = !tickets[id].deactivated;
  saveState();
  showToast(`Status tiket diperbarui`, 'info');
  renderTicketDetail(id);
};

function refreshActivationStats() {
  const today = wibKey();
  const todayActs = activations.filter(a => wibKey(new Date(a.date)) === today);
  const uniqueIds = new Set(todayActs.map(a => a.id));

  $('quick-today').textContent = todayActs.length;
  $('quick-unique').textContent = uniqueIds.size;

  const rList = $('recent-list');
  const recentActs = todayActs.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  
  if (recentActs.length === 0) {
    rList.innerHTML = '<div class="text-center text-slate-400 py-8 font-medium">Belum ada aktivasi tiket hari ini</div>';
    return;
  }

  rList.innerHTML = recentActs.map(a => `
    <div class="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition" onclick="$('search-id').value='${a.id}'; processSearch();">
      <div>
        <div class="font-extrabold text-slate-800 text-sm">${a.id}</div>
        <div class="text-xs font-medium text-slate-500">${a.name}</div>
      </div>
      <div class="text-xs font-bold text-slate-600 bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
        ${wibFormat(a.date).split(' ')[1]}
      </div>
    </div>
  `).join('');
}

// ==========================================
// 6. DASHBOARD, CHART, & TABLE
// ==========================================
function refreshAllData() {
  const list = Object.values(tickets);
  const todayCount = activations.filter(a => isSameWIBDay(new Date(a.date), new Date())).length;
  
  $('stat-total').textContent = list.length;
  $('stat-today').textContent = todayCount;
  $('stat-active').textContent = list.filter(t => !t.deactivated && t.usedDays > 0 && t.usedDays < t.maxDays).length;
  $('stat-expired').textContent = list.filter(t => !t.deactivated && t.usedDays >= t.maxDays).length;
  $('stat-disabled').textContent = list.filter(t => t.deactivated).length;

  renderChart();
  renderTable();
}

function renderChart() {
  const chart = $('chart-bars');
  chart.innerHTML = '';
  const data = [];
  const base = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base); d.setDate(d.getDate() - i);
    const count = activations.filter(a => wibKey(new Date(a.date)) === wibKey(d)).length;
    data.push({ label: d.toLocaleDateString('id-ID', { weekday: 'short' }), count });
  }
  
  const max = Math.max(1, ...data.map(d => d.count));
  data.forEach(d => {
    const h = Math.max(10, (d.count / max) * 100);
    chart.innerHTML += `
      <div class="flex flex-col items-center w-full group relative">
        <div class="absolute -top-6 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none">${d.count}</div>
        <div class="chart-bar w-full max-w-[28px] rounded-t-md" style="height: ${h}px"></div>
        <div class="text-[10px] font-bold text-slate-400 mt-2 uppercase">${d.label}</div>
      </div>
    `;
  });
}

function renderTable() {
  const tbody = $('db-table');
  const q = $('db-search').value.toLowerCase();
  const f = $('db-filter').value;

  const filtered = Object.values(tickets).filter(t => {
    const matchStr = t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
    if (!matchStr) return false;
    if (f === 'disabled') return t.deactivated;
    if (f === 'unused') return !t.deactivated && t.usedDays === 0;
    if (f === 'active') return !t.deactivated && t.usedDays > 0 && t.usedDays < t.maxDays;
    if (f === 'expired') return !t.deactivated && t.usedDays >= t.maxDays;
    return true;
  }).sort((a,b) => a.id.localeCompare(b.id));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 font-medium">Tidak ada data sesuai kriteria</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => {
    let status = 'BARU', sColor = 'bg-slate-100 text-slate-600';
    if(t.deactivated) { status = 'NONAKTIF'; sColor = 'bg-rose-100 text-rose-700'; }
    else if(t.usedDays >= t.maxDays) { status = 'HABIS'; sColor = 'bg-amber-100 text-amber-700'; }
    else if(t.usedDays > 0) { status = 'AKTIF'; sColor = 'bg-emerald-100 text-emerald-700'; }

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-50">
        <td class="py-3 px-4 font-extrabold text-slate-700">${t.id}</td>
        <td class="py-3 px-4 font-semibold text-slate-800 truncate max-w-[150px]">${t.name}</td>
        <td class="py-3 px-4 text-xs font-semibold text-slate-500">${t.type}</td>
        <td class="py-3 px-4 text-xs font-bold text-slate-600">${t.usedDays} / ${t.maxDays}</td>
        <td class="py-3 px-4"><span class="px-2 py-1 rounded text-[10px] font-bold tracking-wide ${sColor}">${status}</span></td>
        <td class="py-3 px-4 text-center">
          <button onclick="switchSection('sec-activation', 'nav-activation'); $('search-id').value='${t.id}'; processSearch();" class="text-[10px] font-bold bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700 transition">CEK</button>
        </td>
      </tr>
    `;
  }).join('');
}

$('db-search').addEventListener('input', renderTable);
$('db-filter').addEventListener('change', renderTable);
$('btn-refresh').addEventListener('click', refreshAllData);

// ==========================================
// 7. EXPORT & PEMELIHARAAN (DANGER ZONE)
// ==========================================
function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

$('btn-export-daily').addEventListener('click', () => {
  const targetDate = $('export-date').value ? new Date($('export-date').value) : new Date();
  const dKey = wibKey(targetDate);
  const rows = activations.filter(a => wibKey(new Date(a.date)) === dKey);
  
  let out = `LAPORAN HARIAN (WIB: ${targetDate.toLocaleDateString('id-ID')})\nTotal: ${rows.length}\n\n`;
  out += 'Waktu,ID,Nama,Jenis\n';
  out += rows.map(a => `"${wibFormat(a.date)}","${a.id}","${a.name}","${a.type}"`).join('\n');
  downloadCSV(out, `Aktivasi_Harian_${dKey}.csv`);
  showToast('Export harian berhasil', 'success');
});

$('btn-export-all').addEventListener('click', () => {
  let out = 'Waktu (WIB),ID Tiket,Nama,Jenis\n';
  out += activations.map(a => `"${wibFormat(a.date)}","${a.id}","${a.name}","${a.type}"`).join('\n');
  downloadCSV(out, `Semua_Riwayat_Aktivasi.csv`);
  showToast('Export semua riwayat berhasil', 'success');
});

$('btn-export-db').addEventListener('click', () => {
  let out = 'ID,Nama,Jenis,Maks Hari,Terpakai,Dinonaktifkan,Dibuat (WIB)\n';
  out += Object.values(tickets).map(t => `"${t.id}","${t.name}","${t.type}",${t.maxDays},${t.usedDays},${t.deactivated?"Ya":"Tidak"},"${wibFormat(t.createdAt)}"`).join('\n');
  downloadCSV(out, `Database_Tiket_Lokal.csv`);
  showToast('Export database berhasil', 'success');
});

// Fungsi untuk menggantikan confirm() bawaan browser
function showConfirm(title, msg, onConfirm) {
  const modal = $('custom-modal');
  $('modal-title').textContent = title;
  $('modal-msg').textContent = msg;
  
  modal.classList.remove('hidden');
  
  // Event Batal
  $('modal-cancel').onclick = () => modal.classList.add('hidden');
  
  // Event Konfirmasi
  $('modal-confirm').onclick = () => {
    modal.classList.add('hidden');
    onConfirm();
  };
}

$('btn-reset-counter').addEventListener('click', () => {
  showConfirm(
    'Reset Penomoran',
    'Yakin ingin mereset penomoran kembali ke FT0001? (Data tidak dihapus).',
    () => { counter = 1; saveState(); showToast('Penomoran direset', 'info'); }
  );
});

$('btn-reset-full').addEventListener('click', () => {
  showConfirm(
    'PERINGATAN BAHAYA!',
    'Anda akan menghapus SELURUH TIKET & RIWAYAT. Tindakan ini permanen.',
    () => { 
      tickets = {}; activations = []; counter = 1; saveState();
      initSystem();
      showToast('Data berhasil diformat', 'success'); 
    }
  );
});