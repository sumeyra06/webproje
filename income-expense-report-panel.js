import { supabase } from './supabaseClient.js';

function getOwnerId() {
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
}
const toYMD = d => d.toISOString().slice(0,10);
const fmt = n => Number(n||0).toFixed(2);

export async function renderIncomeExpenseReportPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  main.innerHTML = `
    <style>
      .kpi-card { border:0; color:#fff; background:linear-gradient(135deg,#00c6ff,#0072ff); box-shadow:0 6px 16px rgba(0,0,0,.08); }
      .kpi-card.in { background:linear-gradient(135deg,#11998e,#38ef7d); }
      .kpi-card.out { background:linear-gradient(135deg,#ff6a6a,#ff3d68); }
      .kpi-card.net-pos { background:linear-gradient(135deg,#667eea,#764ba2); }
      .kpi-card.net-neg { background:linear-gradient(135deg,#ff9966,#ff5e62); }
      .kpi-card .label { font-size:12px; opacity:.9; }
      .kpi-card .value { font-size:22px; font-weight:800; }
      .toolbar .btn { border-radius:8px; }
      .table thead th { position:sticky; top:0; background:#fff; z-index:1; }
      .badge-inc { background:#e6fcf5; color:#2b8a3e; }
      .badge-exp { background:#fff5f5; color:#c92a2a; }
      .empty-state { text-align:center; padding:32px; color:#6c757d; }
    </style>
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 class="fw-bold mb-1">Gelir - Gider Raporu</h2>
          <div class="text-muted">Dönemsellik bazında gelir/gider ve net akış</div>
        </div>
        <div class="toolbar d-flex gap-2">
          <button id="ierExport" class="btn btn-sm btn-outline-secondary"><i class="bi bi-download me-1"></i>CSV</button>
        </div>
      </div>

      <div class="card shadow-sm mb-3"><div class="card-body">
        <div class="row g-2">
          <div class="col-12 col-md-3">
            <label class="form-label">Başlangıç</label>
            <input id="ierStart" type="date" class="form-control" />
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label">Bitiş</label>
            <input id="ierEnd" type="date" class="form-control" />
          </div>
          <div class="col-12 col-md-3">
            <label class="form-label">Para Birimi</label>
            <select id="ierCurrency" class="form-select"><option value="">Tümü</option></select>
          </div>
          <div class="col-12 col-md-3 d-flex align-items-end">
            <button id="ierApply" class="btn btn-primary w-100">Uygula</button>
          </div>
        </div>
      </div></div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-md-4">
          <div class="card kpi-card in">
            <div class="card-body d-flex align-items-center gap-2">
              <i class="bi bi-arrow-down-left-circle fs-3"></i>
              <div>
                <div class="label">Toplam Gelir</div>
                <div id="kpiIncome" class="value">0,00</div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div class="card kpi-card out">
            <div class="card-body d-flex align-items-center gap-2">
              <i class="bi bi-arrow-up-right-circle fs-3"></i>
              <div>
                <div class="label">Toplam Gider</div>
                <div id="kpiExpense" class="value">0,00</div>
              </div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-4">
          <div id="netCard" class="card kpi-card net-pos">
            <div class="card-body d-flex align-items-center gap-2">
              <i class="bi bi-graph-up fs-3"></i>
              <div>
                <div class="label">Net</div>
                <div id="kpiNet" class="value">0,00</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-lg-7">
          <div class="card h-100"><div class="card-body">
            <h6 class="mb-3">Günlük Net</h6>
            <canvas id="ierDaily"></canvas>
          </div></div>
        </div>
        <div class="col-12 col-lg-5">
          <div class="card h-100"><div class="card-body">
            <h6 class="mb-3">Aylık Gelir/Gider</h6>
            <canvas id="ierMonthly"></canvas>
          </div></div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-header py-2">Hareketler</div>
        <div class="table-responsive" style="max-height:60vh; overflow:auto;">
          <table class="table table-hover align-middle m-0">
            <thead class="table-light"><tr>
              <th>Tarih</th><th>Tür</th><th>Açıklama</th><th>Para Birimi</th><th class="text-end">Tutar</th>
            </tr></thead>
            <tbody id="ierRows"><tr><td colspan="5" class="text-center py-4">Veri yükleniyor...</td></tr></tbody>
          </table>
          <div id="ierEmpty" class="empty-state d-none">Kayıt bulunamadı</div>
        </div>
      </div>
    </section>
  `;

  // Defaults
  const end = new Date();
  const start = new Date(); start.setDate(end.getDate() - 90);
  document.getElementById('ierStart').value = toYMD(start);
  document.getElementById('ierEnd').value = toYMD(end);

  document.getElementById('ierApply').onclick = load;
  document.getElementById('ierExport').onclick = exportCSV;

  await hydrateCurrencies();
  await load();

  let dailyChart=null, monthlyChart=null;

  async function hydrateCurrencies(){
    const owner = getOwnerId();
    const curSet = new Set();
  const inv = await supabase.from('invoices_v2').select('currency').eq('owner_id', owner).limit(1);
    (inv.data||[]).forEach(x=>curSet.add(x.currency||'TRY'));
    const exp = await supabase.from('expenses').select('currency').eq('owner_id', owner).limit(1);
    (exp.data||[]).forEach(x=>curSet.add(x.currency||'TRY'));
    if (curSet.size===0) curSet.add('TRY');
    const sel = document.getElementById('ierCurrency');
    Array.from(curSet).sort().forEach(c=>{ const opt=document.createElement('option'); opt.value=c; opt.textContent=c; sel.appendChild(opt); });
  }

  async function load(){
    const owner = getOwnerId();
    const start = document.getElementById('ierStart').value;
    const end = document.getElementById('ierEnd').value;
    const cur = document.getElementById('ierCurrency').value;

    // Income = invoices.total, Expense = expenses.total
  let qi = supabase.from('invoices_v2').select('edit_date,total,currency,invoice_no,customer_name').eq('owner_id', owner);
    if (start) qi = qi.gte('edit_date', start);
    if (end) qi = qi.lte('edit_date', end);
    if (cur) qi = qi.eq('currency', cur);
    qi = qi.order('edit_date', { ascending: true }).limit(2000);

    let qe = supabase.from('expenses').select('expense_date,total,currency,title').eq('owner_id', owner);
    if (start) qe = qe.gte('expense_date', start);
    if (end) qe = qe.lte('expense_date', end);
    if (cur) qe = qe.eq('currency', cur);
    qe = qe.order('expense_date', { ascending: true }).limit(2000);

    const [inv, exp] = await Promise.all([qi, qe]);
    const invoices = inv.data || [];
    const expenses = exp.data || [];

    // KPIs
  const income = invoices.reduce((s,x)=>s+Number(x.total||0),0);
  const expense = expenses.reduce((s,x)=>s+Number(x.total||0),0);
  const net = income - expense;
  const curLabel = cur || 'TRY';
  document.getElementById('kpiIncome').textContent = currencyFormat(income, curLabel);
  document.getElementById('kpiExpense').textContent = currencyFormat(expense, curLabel);
  document.getElementById('kpiNet').textContent = currencyFormat(net, curLabel);
  const netCard = document.getElementById('netCard');
  if (netCard) { netCard.classList.remove('net-pos','net-neg'); netCard.classList.add(net >= 0 ? 'net-pos' : 'net-neg'); }

    // Table data combine
    const rows = document.getElementById('ierRows');
    const combined = [
      ...invoices.map(i=>({ date: i.edit_date, type:'Gelir', desc: (i.invoice_no||'') + (i.customer_name?` • ${i.customer_name}`:''), currency: i.currency||'TRY', amount: Number(i.total||0) })),
      ...expenses.map(e=>({ date: e.expense_date, type:'Gider', desc: e.title||'', currency: e.currency||'TRY', amount: Number(e.total||0) }))
    ].sort((a,b)=> String(a.date).localeCompare(String(b.date)));
    const emptyEl = document.getElementById('ierEmpty');
    if (!combined.length) {
      rows.innerHTML = '';
      emptyEl.classList.remove('d-none');
    } else {
      emptyEl.classList.add('d-none');
      rows.innerHTML = combined.map(r=>{
        const badge = r.type === 'Gelir' ? '<span class="badge badge-inc">Gelir</span>' : '<span class="badge badge-exp">Gider</span>';
        const d = r.date ? new Date(r.date).toLocaleDateString() : '';
        return `<tr><td>${d}</td><td>${badge}</td><td>${r.desc||''}</td><td>${r.currency}</td><td class="text-end">${fmt(r.amount)}</td></tr>`;
      }).join('');
    }

    // Daily net line chart
    const dayMap = new Map();
    combined.forEach(r => {
      const d = r.date || '';
      if (!d) return;
      if (!dayMap.has(d)) dayMap.set(d, { inc:0, exp:0 });
      if (r.type==='Gelir') dayMap.get(d).inc += r.amount; else dayMap.get(d).exp += r.amount;
    });
    const dayLabels = Array.from(dayMap.keys()).sort();
    const dayNet = dayLabels.map(d => (dayMap.get(d).inc - dayMap.get(d).exp));
    renderDaily(dayLabels, dayNet);

    // Monthly stacked chart
    const monMap = new Map();
    const monthKey = d => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`; };
    invoices.forEach(i=>{ if(!i.edit_date) return; const k=monthKey(i.edit_date); if(!monMap.has(k)) monMap.set(k,{inc:0,exp:0}); monMap.get(k).inc += Number(i.total||0); });
    expenses.forEach(e=>{ if(!e.expense_date) return; const k=monthKey(e.expense_date); if(!monMap.has(k)) monMap.set(k,{inc:0,exp:0}); monMap.get(k).exp += Number(e.total||0); });
    const monLabels = Array.from(monMap.keys()).sort();
    const monInc = monLabels.map(k => monMap.get(k).inc);
    const monExp = monLabels.map(k => monMap.get(k).exp);
    renderMonthly(monLabels, monInc, monExp);
  }

  function renderDaily(labels, net){
    const ctx = document.getElementById('ierDaily');
    if (!ctx) return;
    if (dailyChart) { try { dailyChart.destroy(); } catch {} }
    dailyChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Net', data: net, borderColor:'#0d6efd', backgroundColor:'rgba(13,110,253,.15)', fill:true, tension:.25 }] },
      options: { plugins: { legend: { display:false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  function renderMonthly(labels, inc, exp){
    const ctx = document.getElementById('ierMonthly');
    if (!ctx) return;
    if (monthlyChart) { try { monthlyChart.destroy(); } catch {} }
    monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Gelir', data: inc, backgroundColor:'rgba(25,135,84,.8)' },
        { label: 'Gider', data: exp, backgroundColor:'rgba(220,53,69,.8)' }
      ] },
      options: { responsive:true, scales:{ y:{ beginAtZero:true } }, plugins:{ legend:{ position:'top' } } }
    });
  }

  function exportCSV(){
    const rows = Array.from(document.querySelectorAll('#ierRows tr')).map(tr => Array.from(tr.children).map(td => td.textContent.trim()));
    if (!rows.length) return;
    const header = ['Tarih','Tür','Açıklama','Para Birimi','Tutar'];
    const csv = [header, ...rows].map(r => r.map(c => '"'+c.replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gelir_gider_raporu.csv'; a.click();
    URL.revokeObjectURL(url);
  }
}

export default renderIncomeExpenseReportPanel;

function currencyFormat(amount, cur='TRY') {
  try { return new Intl.NumberFormat('tr-TR', { style:'currency', currency: cur }).format(Number(amount||0)); }
  catch { return `${Number(amount||0).toFixed(2)} ${cur}`; }
}
