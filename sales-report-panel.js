// sales-report-panel.js
// Detailed Sales Report using invoices data from Supabase
import { supabase } from './supabaseClient.js';

function getCurrentUserId() {
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
}

export async function renderSalesReportPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="m-0">Satışlar Raporu</h2>
        <div class="d-flex gap-2">
          <button id="srRefresh" class="btn btn-sm btn-outline-secondary">Yenile</button>
          <button id="srExport" class="btn btn-sm btn-outline-primary">CSV İndir</button>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-12 col-md-3">
              <label class="form-label">Başlangıç</label>
              <input id="srStart" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Bitiş</label>
              <input id="srEnd" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Tahsilat Durumu</label>
              <select id="srCollection" class="form-select">
                <option value="ALL">Hepsi</option>
                <option value="collected">Tahsil Edildi</option>
                <option value="pending">Tahsil Edilecek</option>
              </select>
            </div>
            <div class="col-12 col-md-3 d-flex align-items-end">
              <button id="srApply" class="btn btn-primary w-100">Uygula</button>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-md-3">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">Toplam Ciro</div>
            <div id="kpiRevenue" class="kpi-value">-</div>
            <div id="kpiRevenueCount" class="kpi-sub">Fatura adedi: -</div>
          </div></div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">Tahsil Edilen</div>
            <div id="kpiCollected" class="kpi-value">-</div>
            <div id="kpiCollectedCount" class="kpi-sub">Adet: -</div>
          </div></div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">Bekleyen Tahsilat</div>
            <div id="kpiPending" class="kpi-value">-</div>
            <div id="kpiPendingCount" class="kpi-sub">Adet: -</div>
          </div></div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">KDV Toplamı</div>
            <div id="kpiVAT" class="kpi-value">-</div>
            <div id="kpiAvgTicket" class="kpi-sub">Ortalama Sepet: -</div>
          </div></div>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <h6 class="mb-3">Aylık Ciro</h6>
          <canvas id="srMonthlyChart" height="90"></canvas>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-hover m-0">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Fatura No</th>
                  <th>Müşteri</th>
                  <th>Kategori</th>
                  <th>Durum</th>
                  <th>Para Birimi</th>
                  <th class="text-end">Ara Toplam</th>
                  <th class="text-end">KDV</th>
                  <th class="text-end">Genel Toplam</th>
                </tr>
              </thead>
              <tbody id="srRows"><tr><td colspan="9" class="text-center py-4">Veri yükleniyor...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `;

  // default dates: last 90 days
  (function prefillDates(){
    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - 90);
    const toYMD = d => d.toISOString().slice(0,10);
    document.getElementById('srStart').value = toYMD(start);
    document.getElementById('srEnd').value = toYMD(end);
  })();

  document.getElementById('srApply').onclick = load;
  document.getElementById('srRefresh').onclick = load;
  document.getElementById('srExport').onclick = exportCSV;

  let chart;
  async function load() {
    const rows = document.getElementById('srRows');
    rows.innerHTML = `<tr><td colspan="9" class="text-center py-4">Yükleniyor...</td></tr>`;
    const owner_id = getCurrentUserId();
    const start = document.getElementById('srStart').value;
    const end = document.getElementById('srEnd').value;
    const collection = document.getElementById('srCollection').value;

  let q = supabase.from('invoices_v2').select('*').eq('owner_id', owner_id);
    if (start) q = q.gte('edit_date', start);
    if (end) q = q.lte('edit_date', end);
    if (collection && collection !== 'ALL') q = q.eq('collection_status', collection);
    q = q.order('edit_date', { ascending: false }).limit(1000);
    const { data, error } = await q;
    if (error) {
      rows.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-danger">Hata: ${error.message}</td></tr>`;
      return;
    }
    if (!data || !data.length) {
      rows.innerHTML = `<tr><td colspan="9" class="text-center py-4">Kayıt bulunamadı</td></tr>`;
    } else {
      rows.innerHTML = data.map(inv => `
        <tr>
          <td>${inv.edit_date ? new Date(inv.edit_date).toLocaleDateString() : ''}</td>
          <td>${inv.invoice_no || '-'}</td>
          <td>${inv.customer_name || '-'}</td>
          <td>${inv.category || '-'}</td>
          <td>${inv.collection_status === 'collected' ? 'Tahsil Edildi' : 'Tahsil Edilecek'}</td>
          <td>${inv.currency || 'TRY'}</td>
          <td class="text-end">${Number(inv.subtotal || 0).toFixed(2)}</td>
          <td class="text-end">${Number(inv.tax_total || 0).toFixed(2)}</td>
          <td class="text-end">${Number(inv.total || 0).toFixed(2)}</td>
        </tr>
      `).join('');
    }

    // KPIs
    const sum = (arr, key) => arr.reduce((a,b) => a + Number(b[key] || 0), 0);
    const total = sum(data || [], 'total');
    const subtotal = sum(data || [], 'subtotal');
    const vat = sum(data || [], 'tax_total');
    const collectedList = (data || []).filter(d => d.collection_status === 'collected');
    const pendingList = (data || []).filter(d => d.collection_status !== 'collected');
    const collected = sum(collectedList, 'total');
    const pending = sum(pendingList, 'total');
    const avgTicket = data && data.length ? (total / data.length) : 0;
    document.getElementById('kpiRevenue').textContent = currencyFormat(total, guessCurrency(data));
    document.getElementById('kpiRevenueCount').textContent = `Fatura adedi: ${data?.length || 0}`;
    document.getElementById('kpiCollected').textContent = currencyFormat(collected, guessCurrency(data));
    document.getElementById('kpiCollectedCount').textContent = `Adet: ${collectedList.length}`;
    document.getElementById('kpiPending').textContent = currencyFormat(pending, guessCurrency(data));
    document.getElementById('kpiPendingCount').textContent = `Adet: ${pendingList.length}`;
    document.getElementById('kpiVAT').textContent = currencyFormat(vat, guessCurrency(data));
    document.getElementById('kpiAvgTicket').textContent = `Ortalama Sepet: ${currencyFormat(avgTicket, guessCurrency(data))}`;

    // Monthly chart
    const monthly = groupByMonth(data || []);
    const labels = Object.keys(monthly).sort();
    const revenues = labels.map(k => monthly[k].reduce((a,b)=>a+Number(b.total||0),0));
    const ctx = document.getElementById('srMonthlyChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Ciro', data: revenues, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,.1)', fill: true }] },
      options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
    });
  }

  function groupByMonth(list) {
    const map = {};
    for (const inv of list) {
      const d = inv.edit_date ? new Date(inv.edit_date) : new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; // YYYY-MM
      if (!map[key]) map[key] = [];
      map[key].push(inv);
    }
    return map;
  }

  function guessCurrency(data) {
    if (!data || !data.length) return 'TRY';
    return data[0].currency || 'TRY';
  }

  function currencyFormat(amount, cur='TRY') {
    try {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur }).format(Number(amount||0));
    } catch { return `${Number(amount||0).toFixed(2)} ${cur}`; }
  }

  function exportCSV() {
    const rows = Array.from(document.querySelectorAll('#srRows tr'))
      .map(tr => Array.from(tr.children).map(td => td.textContent.replace(/\s+/g,' ').trim()));
    if (!rows.length) return;
    const header = ['Tarih','Fatura No','Müşteri','Kategori','Durum','Para Birimi','Ara Toplam','KDV','Genel Toplam'];
    const csv = [header, ...rows].map(r => r.map(cell => `"${cell.replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'satislar_raporu.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  await load();
}

export default renderSalesReportPanel;
