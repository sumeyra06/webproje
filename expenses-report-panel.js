// expenses-report-panel.js
// Giderler Raporu: filtreler, KPI'lar, aylık gider grafiği, kategori dağılımı ve CSV export
import { supabase } from './supabaseClient.js';

async function resolveOwnerId() {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch {}
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
}

function toYMD(d) { return d.toISOString().slice(0,10); }
function fmt(n) { return Number(n||0).toFixed(2); }
function monthKey(d) { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`; }

export async function renderExpensesReportPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="m-0">Giderler Raporu</h2>
        <div class="d-flex gap-2">
          <button id="exrepExport" class="btn btn-outline-primary">CSV İndir</button>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-12 col-md-3">
              <label class="form-label">Başlangıç</label>
              <input id="exrepStart" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Bitiş</label>
              <input id="exrepEnd" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Ödeme Durumu</label>
              <select id="exrepPay" class="form-select">
                <option value="ALL">Hepsi</option>
                <option value="paid">Ödendi</option>
                <option value="pending">Ödenecek</option>
                <option value="partial">Kısmi</option>
              </select>
            </div>
            <div class="col-12 col-md-3 d-flex align-items-end">
              <button id="exrepApply" class="btn btn-primary w-100">Uygula</button>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-6 col-md-3">
          <div class="card kpi"><div class="card-body"><div class="text-muted small">Toplam Matrah</div><div id="kpiSubtotal" class="fs-4 fw-bold">0,00</div></div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card kpi"><div class="card-body"><div class="text-muted small">Toplam KDV</div><div id="kpiVat" class="fs-4 fw-bold">0,00</div></div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card kpi"><div class="card-body"><div class="text-muted small">Toplam Tutar</div><div id="kpiTotal" class="fs-4 fw-bold">0,00</div></div></div>
        </div>
        <div class="col-6 col-md-3">
          <div class="card kpi"><div class="card-body"><div class="text-muted small">Kayıt Sayısı</div><div id="kpiCount" class="fs-4 fw-bold">0</div></div></div>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-lg-7">
          <div class="card h-100"><div class="card-body">
            <h6 class="mb-3">Aylık Gider Toplamı</h6>
            <canvas id="exrepMonthly"></canvas>
          </div></div>
        </div>
        <div class="col-12 col-lg-5">
          <div class="card h-100"><div class="card-body">
            <h6 class="mb-3">Kategoriye Göre Dağılım</h6>
            <canvas id="exrepCategory"></canvas>
          </div></div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-hover m-0">
              <thead><tr>
                <th>Tarih</th><th>Gider</th><th>Kategori</th><th>Durum</th>
                <th>Para Birimi</th><th class="text-end">Matrah</th>
                <th class="text-end">KDV</th><th class="text-end">Toplam</th>
              </tr></thead>
              <tbody id="exrepRows"><tr><td colspan="8" class="text-center py-4">Veri yükleniyor...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `;

  // Defaults (son 90 gün)
  const end = new Date();
  const start = new Date(); start.setDate(end.getDate() - 90);
  document.getElementById('exrepStart').value = toYMD(start);
  document.getElementById('exrepEnd').value = toYMD(end);

  document.getElementById('exrepApply').onclick = load;
  document.getElementById('exrepExport').onclick = exportCSV;

  let monthlyChart = null;
  let categoryChart = null;

  async function load() {
    const rows = document.getElementById('exrepRows');
    rows.innerHTML = `<tr><td colspan="8" class="text-center py-4">Yükleniyor...</td></tr>`;
    const ownerId = await resolveOwnerId();

    let q = supabase.from('expenses').select('*');
    if (ownerId) q = q.eq('owner_id', ownerId);
    const start = document.getElementById('exrepStart').value;
    const end = document.getElementById('exrepEnd').value;
    const pay = document.getElementById('exrepPay').value;
    if (start) q = q.gte('expense_date', start);
    if (end) q = q.lte('expense_date', end);
    if (pay && pay !== 'ALL') q = q.eq('payment_status', pay);
    q = q.order('expense_date', { ascending: true }).limit(2000);
    const { data, error } = await q;

    if (error) {
      rows.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Hata: ${error.message}</td></tr>`;
      return;
    }

    // KPIs
    const count = data?.length || 0;
    const subtotal = (data||[]).reduce((s,x)=> s + Number(x.amount||0), 0);
    const vat = (data||[]).reduce((s,x)=> s + Number(x.tax_amount||0), 0);
    const total = (data||[]).reduce((s,x)=> s + Number(x.total||0), 0);
    document.getElementById('kpiSubtotal').textContent = fmt(subtotal);
    document.getElementById('kpiVat').textContent = fmt(vat);
    document.getElementById('kpiTotal').textContent = fmt(total);
    document.getElementById('kpiCount').textContent = count;

    // Aylık seri
    const months = {};
    for (const x of (data||[])) {
      const key = x.expense_date ? monthKey(x.expense_date) : 'Bilinmiyor';
      months[key] = (months[key]||0) + Number(x.total||0);
    }
    const labels = Object.keys(months).sort();
    const values = labels.map(k => months[k]);

    // Kategori dağılımı
    const catMap = {};
    for (const x of (data||[])) {
      const c = x.category || 'Diğer';
      catMap[c] = (catMap[c]||0) + Number(x.total||0);
    }
    const catLabels = Object.keys(catMap).sort();
    const catValues = catLabels.map(k => catMap[k]);

    // Charts
    renderMonthly(labels, values);
    renderCategory(catLabels, catValues);

    // Table
    if (!data || !data.length) {
      rows.innerHTML = `<tr><td colspan="8" class="text-center py-4">Kayıt bulunamadı</td></tr>`;
    } else {
      rows.innerHTML = data.map(x => `
        <tr>
          <td>${x.expense_date ? new Date(x.expense_date).toLocaleDateString() : ''}</td>
          <td>${x.title || '-'}</td>
          <td>${x.category || '-'}</td>
          <td>${labelPay(x.payment_status)}</td>
          <td>${x.currency || 'TRY'}</td>
          <td class="text-end">${fmt(x.amount)}</td>
          <td class="text-end">${fmt(x.tax_amount)}</td>
          <td class="text-end">${fmt(x.total)}</td>
        </tr>
      `).join('');
    }
  }

  function labelPay(v) {
    if (v === 'paid') return 'Ödendi';
    if (v === 'partial') return 'Kısmi';
    return 'Ödenecek';
  }

  function renderMonthly(labels, values) {
    const ctx = document.getElementById('exrepMonthly');
    if (!ctx) return;
    if (monthlyChart) { try { monthlyChart.destroy(); } catch {} }
    monthlyChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Toplam', data: values, borderColor: '#0d6efd', backgroundColor: 'rgba(13,110,253,.2)', tension: .25, fill: true }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  }

  function renderCategory(labels, values) {
    const ctx = document.getElementById('exrepCategory');
    if (!ctx) return;
    if (categoryChart) { try { categoryChart.destroy(); } catch {} }
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: labels.map((_,i)=>`hsl(${(i*47)%360} 70% 60%)`) }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }

  function exportCSV() {
    const body = document.querySelectorAll('#exrepRows tr');
    if (!body || !body.length) return;
    const header = ['Tarih','Gider','Kategori','Durum','Para Birimi','Matrah','KDV','Toplam'];
    const rows = [header];
    body.forEach(tr => {
      const tds = Array.from(tr.children).map(td => td.textContent.trim());
      if (tds.length >= 8) rows.push(tds.slice(0,8));
    });
    const csv = rows.map(r => r.map(c => '"'+c.replaceAll('"','""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'giderler_raporu.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  await load();
}

export default renderExpensesReportPanel;
