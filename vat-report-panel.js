// vat-report-panel.js
// VAT (KDV) Report based on invoices data in Supabase
import { supabase } from './supabaseClient.js';

function getCurrentUserId() {
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
}

export async function renderVatReportPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="m-0">KDV Raporu</h2>
        <div class="d-flex gap-2">
          <button id="vrRefresh" class="btn btn-sm btn-outline-secondary">Yenile</button>
          <button id="vrExport" class="btn btn-sm btn-outline-primary">CSV İndir</button>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-12 col-md-3">
              <label class="form-label">Başlangıç</label>
              <input id="vrStart" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Bitiş</label>
              <input id="vrEnd" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3 d-flex align-items-end">
              <button id="vrApply" class="btn btn-primary w-100">Uygula</button>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-md-3">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">Toplam KDV</div>
            <div id="kpiVatTotal" class="kpi-value">-</div>
            <div id="kpiCount" class="kpi-sub">Fatura adedi: -</div>
          </div></div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">Matrah (Ara Toplam)</div>
            <div id="kpiSubtotal" class="kpi-value">-</div>
          </div></div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">Brüt (Genel Toplam)</div>
            <div id="kpiGross" class="kpi-value">-</div>
          </div></div>
        </div>
        <div class="col-12 col-md-3">
          <div class="card kpi"><div class="card-body">
            <div class="kpi-title">Ortalama KDV Oranı</div>
            <div id="kpiAvgRate" class="kpi-value">-</div>
          </div></div>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <h6 class="mb-3">Aylık KDV</h6>
          <canvas id="vrMonthlyChart" height="90"></canvas>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-hover m-0">
              <thead>
                <tr>
                  <th>KDV Oranı</th>
                  <th class="text-end">Matrah</th>
                  <th class="text-end">KDV</th>
                  <th class="text-end">Brüt</th>
                </tr>
              </thead>
              <tbody id="vrRateRows"><tr><td colspan="4" class="text-center py-4">Veri yükleniyor...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-sm table-hover m-0">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Fatura No</th>
                  <th>Müşteri</th>
                  <th>Para Birimi</th>
                  <th class="text-end">Matrah</th>
                  <th class="text-end">KDV</th>
                  <th class="text-end">Brüt</th>
                </tr>
              </thead>
              <tbody id="vrRows"><tr><td colspan="7" class="text-center py-4">Veri yükleniyor...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `;

  // Default last 90 days
  (function prefillDates(){
    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - 90);
    const toYMD = d => d.toISOString().slice(0,10);
    document.getElementById('vrStart').value = toYMD(start);
    document.getElementById('vrEnd').value = toYMD(end);
  })();

  document.getElementById('vrApply').onclick = load;
  document.getElementById('vrRefresh').onclick = load;
  document.getElementById('vrExport').onclick = exportCSV;

  let chart;
  async function load() {
    const owner_id = getCurrentUserId();
    const start = document.getElementById('vrStart').value;
    const end = document.getElementById('vrEnd').value;

    const rows = document.getElementById('vrRows');
    const rateRows = document.getElementById('vrRateRows');
    rows.innerHTML = `<tr><td colspan="7" class="text-center py-4">Yükleniyor...</td></tr>`;
    rateRows.innerHTML = `<tr><td colspan="4" class="text-center py-4">Yükleniyor...</td></tr>`;

  let q = supabase.from('invoices_v2').select('*').eq('owner_id', owner_id);
    if (start) q = q.gte('edit_date', start);
    if (end) q = q.lte('edit_date', end);
    q = q.order('edit_date', { ascending: false }).limit(1000);
    const { data, error } = await q;
    if (error) {
      rows.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Hata: ${error.message}</td></tr>`;
      rateRows.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-danger">Hata</td></tr>`;
      return;
    }

    // Fill details table
    if (!data || !data.length) {
      rows.innerHTML = `<tr><td colspan="7" class="text-center py-4">Kayıt bulunamadı</td></tr>`;
    } else {
      rows.innerHTML = data.map(inv => `
        <tr>
          <td>${inv.edit_date ? new Date(inv.edit_date).toLocaleDateString() : ''}</td>
          <td>${inv.invoice_no || '-'}</td>
          <td>${inv.customer_name || '-'}</td>
          <td>${inv.currency || 'TRY'}</td>
          <td class="text-end">${Number(inv.subtotal || 0).toFixed(2)}</td>
          <td class="text-end">${Number(inv.tax_total || 0).toFixed(2)}</td>
          <td class="text-end">${Number(inv.total || 0).toFixed(2)}</td>
        </tr>
      `).join('');
    }

    // KPIs
    const sum = (arr, key) => arr.reduce((a,b) => a + Number(b[key] || 0), 0);
    const subtotal = sum(data || [], 'subtotal');
    const vat = sum(data || [], 'tax_total');
    const gross = sum(data || [], 'total');
    const avgRate = subtotal ? (vat / subtotal) * 100 : 0;
    const cur = guessCurrency(data);
    setText('kpiSubtotal', currencyFormat(subtotal, cur));
    setText('kpiVatTotal', currencyFormat(vat, cur));
    setText('kpiGross', currencyFormat(gross, cur));
    setText('kpiCount', `Fatura adedi: ${data?.length || 0}`);
    setText('kpiAvgRate', `${avgRate.toFixed(2)}%`);

    // Breakdown by tax rate using invoice_items_v2 within the same date range
    const byRate = {};
    try {
      const invIds = (data || []).map(d => d.id);
      if (invIds.length) {
        let qi = supabase.from('invoice_items_v2')
          .select('tax_rate, qty, unit_price')
          .eq('owner_id', owner_id)
          .in('invoice_id', invIds)
          .limit(10000);
        const { data: itemsData, error: itemsErr } = await qi;
        if (!itemsErr && Array.isArray(itemsData)) {
          for (const it of itemsData) {
            const rate = Number(it.tax_rate || 0);
            const matrah = Number((it.qty || 0) * (it.unit_price || 0));
            const kdv = matrah * (rate / 100);
            const brut = matrah + kdv;
            if (!byRate[rate]) byRate[rate] = { matrah:0, kdv:0, brut:0 };
            byRate[rate].matrah += matrah;
            byRate[rate].kdv += kdv;
            byRate[rate].brut += brut;
          }
        }
      }
    } catch (e) {
      console.warn('KDV dağılımı okunamadı', e?.message || e);
    }
    const rateKeys = Object.keys(byRate).sort((a,b)=>Number(a)-Number(b));
    if (!rateKeys.length) {
      rateRows.innerHTML = `<tr><td colspan="4" class="text-center py-4">KDV satırı bulunamadı</td></tr>`;
    } else {
      rateRows.innerHTML = rateKeys.map(k => `
        <tr>
          <td>%${k}</td>
          <td class="text-end">${Number(byRate[k].matrah).toFixed(2)}</td>
          <td class="text-end">${Number(byRate[k].kdv).toFixed(2)}</td>
          <td class="text-end">${Number(byRate[k].brut).toFixed(2)}</td>
        </tr>
      `).join('');
    }

    // Monthly VAT chart
    const monthly = {};
    for (const inv of (data || [])) {
      const d = inv.edit_date ? new Date(inv.edit_date) : new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!monthly[key]) monthly[key] = 0;
      monthly[key] += Number(inv.tax_total || 0);
    }
    const labels = Object.keys(monthly).sort();
    const values = labels.map(k => monthly[k]);
    const ctx = document.getElementById('vrMonthlyChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'KDV', data: values, backgroundColor: 'rgba(25, 135, 84, .6)' }] },
      options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
    });
  }

  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
  function guessCurrency(data) { if (!data || !data.length) return 'TRY'; return data[0].currency || 'TRY'; }
  function currencyFormat(amount, cur='TRY') { try { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: cur }).format(Number(amount||0)); } catch { return `${Number(amount||0).toFixed(2)} ${cur}`; } }
  function exportCSV() {
    const rows = Array.from(document.querySelectorAll('#vrRows tr'))
      .map(tr => Array.from(tr.children).map(td => td.textContent.replace(/\s+/g,' ').trim()));
    if (!rows.length) return;
    const header = ['Tarih','Fatura No','Müşteri','Para Birimi','Matrah','KDV','Brüt'];
    const csv = [header, ...rows].map(r => r.map(cell => `"${cell.replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'kdv_raporu.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  await load();
}

export default renderVatReportPanel;
