import { supabase } from './supabaseClient.js';

const uid = () => { try { return JSON.parse(localStorage.getItem('sessionUser'))?.id || null; } catch { return null; } };

export async function renderCashBankReportPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <style>
      .kpi-card { border:0; color:#fff; background:linear-gradient(135deg,#00c6ff,#0072ff); box-shadow:0 6px 16px rgba(0,0,0,.08); }
      .kpi-card.alt1 { background:linear-gradient(135deg,#11998e,#38ef7d); }
      .kpi-card.alt2 { background:linear-gradient(135deg,#f7971e,#ffd200); color:#222; }
      .kpi-card.alt3 { background:linear-gradient(135deg,#ff758c,#ff7eb3); }
      .kpi-card .label { font-size:12px; opacity:.9; }
      .kpi-card .value { font-size:22px; font-weight:800; }
      .toolbar .btn { border-radius:8px; }
      .table thead th { position:sticky; top:0; background:#fff; z-index:1; }
      .empty-state { text-align:center; padding:32px; color:#6c757d; }
    </style>
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 class="fw-bold mb-1">Kasa / Banka Raporu</h2>
          <div class="text-muted">Son hareketleri analiz edin, nakit akışınızı takip edin</div>
        </div>
        <div class="toolbar d-flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" id="btnExportCsv"><i class="bi bi-download me-1"></i>CSV</button>
        </div>
      </div>

      <div class="card mb-3">
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-3">
              <label class="form-label small text-muted mb-1">Hesap</label>
              <select id="fltAccount" class="form-select form-select-sm"><option value="">Tümü</option></select>
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted mb-1">Tür</label>
              <select id="fltType" class="form-select form-select-sm">
                <option value="">Tümü</option>
                <option value="in">Giriş</option>
                <option value="out">Çıkış</option>
                <option value="transfer_in">Transfer (Giriş)</option>
                <option value="transfer_out">Transfer (Çıkış)</option>
              </select>
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted mb-1">Para Birimi</label>
              <select id="fltCurrency" class="form-select form-select-sm"><option value="">Tümü</option></select>
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted mb-1">Başlangıç</label>
              <input id="fltFrom" type="date" class="form-control form-select-sm" />
            </div>
            <div class="col-md-2">
              <label class="form-label small text-muted mb-1">Bitiş</label>
              <input id="fltTo" type="date" class="form-control form-select-sm" />
            </div>
            <div class="col-md-1 d-flex align-items-end">
              <button class="btn btn-sm btn-primary w-100" id="btnApply">Uygula</button>
            </div>
          </div>
        </div>
      </div>

      <div id="kpis" class="row g-3 mb-3"></div>

      <div class="row g-3">
        <div class="col-lg-7">
          <div class="card">
            <div class="card-header py-2">Günlük Nakit Akışı</div>
            <div class="card-body"><canvas id="chartDaily" height="200"></canvas></div>
          </div>
        </div>
        <div class="col-lg-5">
          <div class="card">
            <div class="card-header py-2">Türlere Göre Dağılım</div>
            <div class="card-body"><canvas id="chartTypes" height="200"></canvas></div>
          </div>
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-header py-2">Hareketler</div>
        <div class="table-responsive" style="max-height:60vh; overflow:auto;">
          <table class="table table-hover align-middle mb-0" id="tbl">
            <thead class="table-light"><tr><th>Tarih</th><th>Tür</th><th>Tutar</th><th>Para Birimi</th><th>Hesap</th><th>Açıklama</th></tr></thead>
            <tbody></tbody>
          </table>
          <div id="empty" class="empty-state d-none">Kayıt bulunamadı</div>
        </div>
      </div>
    </section>
  `;

  document.getElementById('btnExportCsv').onclick = exportCsv;
  document.getElementById('btnApply').onclick = () => load();

  // Defaults: last 30 days
  const today = new Date();
  const from = new Date(); from.setDate(today.getDate()-30);
  document.getElementById('fltFrom').value = from.toISOString().slice(0,10);
  document.getElementById('fltTo').value = today.toISOString().slice(0,10);

  await hydrateFilters();
  await load();
}

async function hydrateFilters(){
  const owner = uid();
  const { data: accounts } = await supabase.from('cash_accounts').select('id,name,currency').eq('owner_id', owner).order('name');
  const accSel = document.getElementById('fltAccount');
  const curSel = document.getElementById('fltCurrency');
  const currencies = new Set();
  (accounts||[]).forEach(a => {
    const opt = document.createElement('option'); opt.value = a.id; opt.textContent = a.name; accSel.appendChild(opt);
    currencies.add(a.currency||'TRY');
  });
  Array.from(currencies).sort().forEach(c => {
    const opt = document.createElement('option'); opt.value = c; opt.textContent = c; curSel.appendChild(opt);
  });
}

async function load(){
  const owner = uid();
  // build query
  let q = supabase.from('cash_transactions').select('trx_date,trx_type,amount,currency, cash_accounts(name)').eq('owner_id', owner).order('trx_date');
  const acc = document.getElementById('fltAccount').value;
  const t = document.getElementById('fltType').value;
  const cur = document.getElementById('fltCurrency').value;
  const from = document.getElementById('fltFrom').value;
  const to = document.getElementById('fltTo').value;
  if (acc) q = q.eq('account_id', acc);
  if (t) q = q.eq('trx_type', t);
  if (cur) q = q.eq('currency', cur);
  if (from) q = q.gte('trx_date', from);
  if (to) q = q.lte('trx_date', to);
  const { data, error } = await q.limit(2000);
  if (error) return console.error('report load error', error);

  renderTable(data||[]);
  renderKPIs(data||[]);
  renderCharts(data||[]);
}

function renderTable(rows){
  const tbody = document.querySelector('#tbl tbody');
  const empty = document.getElementById('empty');
  tbody.innerHTML = '';
  if (!rows.length) empty.classList.remove('d-none'); else empty.classList.add('d-none');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const typeLabel = r.trx_type==='in'?'Giriş':(r.trx_type==='out'?'Çıkış':(r.trx_type==='transfer_in'?'Transfer (Giriş)':'Transfer (Çıkış)'));
    tr.innerHTML = `<td>${r.trx_date}</td><td>${typeLabel}</td><td class="fw-semibold">${Number(r.amount||0).toFixed(2)}</td><td>${r.currency}</td><td>${r.cash_accounts?.name||''}</td><td>${r.description||''}</td>`;
    tbody.appendChild(tr);
  });
}

function renderKPIs(rows){
  const el = document.getElementById('kpis');
  const sum = (pred) => rows.filter(pred).reduce((s,r)=>s+Number(r.amount||0),0);
  const inSum = sum(r=>r.trx_type==='in' || r.trx_type==='transfer_in');
  const outSum = sum(r=>r.trx_type==='out' || r.trx_type==='transfer_out');
  const net = inSum - outSum;
  el.innerHTML = `
    <div class="col-12 col-md-4">
      <div class="card kpi-card alt1"><div class="card-body">
        <div class="label">Toplam Giriş</div>
        <div class="value">${inSum.toFixed(2)}</div>
      </div></div>
    </div>
    <div class="col-12 col-md-4">
      <div class="card kpi-card alt2"><div class="card-body">
        <div class="label">Toplam Çıkış</div>
        <div class="value">${outSum.toFixed(2)}</div>
      </div></div>
    </div>
    <div class="col-12 col-md-4">
      <div class="card kpi-card alt3"><div class="card-body">
        <div class="label">Net</div>
        <div class="value">${net.toFixed(2)}</div>
      </div></div>
    </div>`;
}

let _chartDaily, _chartTypes;
function renderCharts(rows){
  const byDate = new Map();
  rows.forEach(r => {
    const d = r.trx_date;
    if (!byDate.has(d)) byDate.set(d, { in:0, out:0 });
    if (r.trx_type==='in' || r.trx_type==='transfer_in') byDate.get(d).in += Number(r.amount||0);
    if (r.trx_type==='out' || r.trx_type==='transfer_out') byDate.get(d).out += Number(r.amount||0);
  });
  const labels = Array.from(byDate.keys()).sort();
  const dataIn = labels.map(d => byDate.get(d).in);
  const dataOut = labels.map(d => byDate.get(d).out);

  const ctx1 = document.getElementById('chartDaily');
  if (_chartDaily) _chartDaily.destroy();
  _chartDaily = new Chart(ctx1, {
    type: 'bar',
    data: { labels, datasets: [
      { label:'Giriş', data: dataIn, backgroundColor: 'rgba(40, 167, 69, .7)' },
      { label:'Çıkış', data: dataOut, backgroundColor: 'rgba(220, 53, 69, .7)' }
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'top' } }, scales:{ x:{ stacked:false }, y:{ beginAtZero:true } } }
  });

  const byType = [
    {k:'Giriş', v: rows.filter(r=>r.trx_type==='in' || r.trx_type==='transfer_in').reduce((s,r)=>s+Number(r.amount||0),0)},
    {k:'Çıkış', v: rows.filter(r=>r.trx_type==='out' || r.trx_type==='transfer_out').reduce((s,r)=>s+Number(r.amount||0),0)}
  ];
  const ctx2 = document.getElementById('chartTypes');
  if (_chartTypes) _chartTypes.destroy();
  _chartTypes = new Chart(ctx2, {
    type: 'doughnut',
    data: { labels: byType.map(x=>x.k), datasets:[{ data: byType.map(x=>x.v), backgroundColor:['#28a745','#dc3545'] }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
  });
}

function exportCsv(){
  const rows = [['Tarih','Tür','Tutar','Para Birimi','Hesap','Açıklama']];
  document.querySelectorAll('#tbl tbody tr').forEach(tr => {
    rows.push(Array.from(tr.children).map(td => (td.textContent||'').trim()));
  });
  const csv = rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'cash-bank-report.csv'; a.click();
  URL.revokeObjectURL(url);
}
