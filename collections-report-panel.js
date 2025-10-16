// collections-report-panel.js
// Collections (Tahsilatlar) Report using invoices data from Supabase
import { supabase } from './supabaseClient.js';

function getCurrentUserId() {
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
}

export async function renderCollectionsReportPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="m-0">Tahsilatlar Raporu</h2>
        <div class="d-flex gap-2">
          <button id="crRefresh" class="btn btn-sm btn-outline-secondary">Yenile</button>
          <button id="crExport" class="btn btn-sm btn-outline-primary">CSV İndir</button>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-12 col-md-3">
              <label class="form-label">Başlangıç</label>
              <input id="crStart" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Bitiş</label>
              <input id="crEnd" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Tahsilat Durumu</label>
              <select id="crCollection" class="form-select">
                <option value="ALL">Hepsi</option>
                <option value="collected">Tahsil Edildi</option>
                <option value="pending">Tahsil Edilecek</option>
              </select>
            </div>
            <div class="col-12 col-md-3 d-flex align-items-end">
              <button id="crApply" class="btn btn-primary w-100">Uygula</button>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-md-3">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">Toplam Tahsilat</div>
            <div id="kpiCollectedSum" class="kpi-value">-</div>
            <div id="kpiCollectedCount" class="kpi-sub">Adet: -</div>
          </div></div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">Bekleyen Tahsilat</div>
            <div id="kpiPendingSum" class="kpi-value">-</div>
            <div id="kpiPendingCount" class="kpi-sub">Adet: -</div>
          </div></div>
        </div>
        <div class="col-12 col-md-6">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">Vade Yaşlandırma (Bekleyen)</div>
            <div id="agingBuckets" class="small">
              <div><strong>0-7 gün:</strong> <span id="age_0_7">-</span></div>
              <div><strong>8-30 gün:</strong> <span id="age_8_30">-</span></div>
              <div><strong>31-60 gün:</strong> <span id="age_31_60">-</span></div>
              <div><strong>60+ gün:</strong> <span id="age_60p">-</span></div>
            </div>
          </div></div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-hover m-0">
              <thead>
                <tr>
                  <th>Düzenleme Tarihi</th>
                  <th>Vade</th>
                  <th>Fatura No</th>
                  <th>Müşteri</th>
                  <th>Durum</th>
                  <th>Para Birimi</th>
                  <th class="text-end">Genel Toplam</th>
                  <th class="text-end">Gün Farkı</th>
                </tr>
              </thead>
              <tbody id="crRows"><tr><td colspan="8" class="text-center py-4">Veri yükleniyor...</td></tr></tbody>
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
    document.getElementById('crStart').value = toYMD(start);
    document.getElementById('crEnd').value = toYMD(end);
  })();

  document.getElementById('crApply').onclick = load;
  document.getElementById('crRefresh').onclick = load;
  document.getElementById('crExport').onclick = exportCSV;

  async function load() {
    const rows = document.getElementById('crRows');
    rows.innerHTML = `<tr><td colspan="8" class="text-center py-4">Yükleniyor...</td></tr>`;
    const owner_id = getCurrentUserId();
    const start = document.getElementById('crStart').value;
    const end = document.getElementById('crEnd').value;
    const collection = document.getElementById('crCollection').value;

    let q = supabase.from('invoices').select('*').eq('owner_id', owner_id);
    if (start) q = q.gte('edit_date', start);
    if (end) q = q.lte('edit_date', end);
    if (collection && collection !== 'ALL') q = q.eq('collection_status', collection);
    q = q.order('edit_date', { ascending: false }).limit(1000);
    const { data, error } = await q;
    if (error) {
      rows.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Hata: ${error.message}</td></tr>`;
      return;
    }
    if (!data || !data.length) {
      rows.innerHTML = `<tr><td colspan="8" class="text-center py-4">Kayıt bulunamadı</td></tr>`;
    } else {
      rows.innerHTML = data.map(inv => {
        const days = dayDiff(inv.due_date, new Date());
        return `
        <tr>
          <td>${inv.edit_date ? new Date(inv.edit_date).toLocaleDateString() : ''}</td>
          <td>${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : ''}</td>
          <td>${inv.invoice_no || '-'}</td>
          <td>${inv.customer_name || '-'}</td>
          <td>${inv.collection_status === 'collected' ? 'Tahsil Edildi' : 'Tahsil Edilecek'}</td>
          <td>${inv.currency || 'TRY'}</td>
          <td class="text-end">${Number(inv.total || 0).toFixed(2)}</td>
          <td class="text-end">${Number(days).toFixed(0)}</td>
        </tr>`;
      }).join('');
    }

    // KPI hesapları
    const sum = (arr, key) => arr.reduce((a,b) => a + Number(b[key] || 0), 0);
    const collectedList = (data || []).filter(d => d.collection_status === 'collected');
    const pendingList = (data || []).filter(d => d.collection_status !== 'collected');
    const collectedSum = sum(collectedList, 'total');
    const pendingSum = sum(pendingList, 'total');
    document.getElementById('kpiCollectedSum').textContent = currencyFormat(collectedSum, guessCurrency(data));
    document.getElementById('kpiCollectedCount').textContent = `Adet: ${collectedList.length}`;
    document.getElementById('kpiPendingSum').textContent = currencyFormat(pendingSum, guessCurrency(data));
    document.getElementById('kpiPendingCount').textContent = `Adet: ${pendingList.length}`;

    // Aging buckets (only pending)
    const aging = { a0_7:0, a8_30:0, a31_60:0, a60p:0 };
    for (const inv of pendingList) {
      const days = dayDiff(inv.due_date, new Date());
      const amount = Number(inv.total || 0);
      if (days <= 7) aging.a0_7 += amount;
      else if (days <= 30) aging.a8_30 += amount;
      else if (days <= 60) aging.a31_60 += amount;
      else aging.a60p += amount;
    }
    document.getElementById('age_0_7').textContent = currencyFormat(aging.a0_7, guessCurrency(data));
    document.getElementById('age_8_30').textContent = currencyFormat(aging.a8_30, guessCurrency(data));
    document.getElementById('age_31_60').textContent = currencyFormat(aging.a31_60, guessCurrency(data));
    document.getElementById('age_60p').textContent = currencyFormat(aging.a60p, guessCurrency(data));
  }

  function dayDiff(dateA, dateB) {
    try { const a = new Date(dateA); const b = new Date(dateB); return Math.round((b - a) / (1000*60*60*24)); } catch { return 0; }
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
    const rows = Array.from(document.querySelectorAll('#crRows tr'))
      .map(tr => Array.from(tr.children).map(td => td.textContent.replace(/\s+/g,' ').trim()));
    if (!rows.length) return;
    const header = ['Düzenleme Tarihi','Vade','Fatura No','Müşteri','Durum','Para Birimi','Genel Toplam','Gün Farkı'];
    const csv = [header, ...rows].map(r => r.map(cell => `"${cell.replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tahsilatlar_raporu.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  await load();
}

export default renderCollectionsReportPanel;
