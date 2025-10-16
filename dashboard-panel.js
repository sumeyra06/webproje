// dashboard-panel.js
import { supabase } from './supabaseClient.js';
const getCurrentUserId = () => { try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; } };

const fmtTRY = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });

function toDate(d) {
  return d ? new Date(d) : null;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Pazartesi=0
  d.setDate(d.getDate() - day);
  d.setHours(0,0,0,0);
  return d;
}

function addWeeks(date, w) {
  const d = new Date(date);
  d.setDate(d.getDate() + w * 7);
  return d;
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function labelMonth(key) {
  const [y,m] = key.split('-').map(Number);
  return `${String(m).padStart(2,'0')}.${String(y).slice(-2)}`;
}

async function fetchInvoices() {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, invoice_no, name, customer_name, total, tax_total, collection_status, edit_date, due_date, created_at')
    .eq('owner_id', getCurrentUserId())
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

function computeKPIs(invoices) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
  let collected = 0, pending = 0, vatThisMonth = 0, vatLastMonth = 0, overdue = 0;

  for (const inv of invoices) {
    const total = Number(inv.total || 0);
    const tax = Number(inv.tax_total || 0);
    const ed = toDate(inv.edit_date);
    const dd = toDate(inv.due_date);
    if (inv.collection_status === 'collected') collected += total; else pending += total;
    if (ed) {
      if (ed.getMonth() === thisMonth && ed.getFullYear() === thisYear) vatThisMonth += tax;
      if (ed.getMonth() === lastMonthDate.getMonth() && ed.getFullYear() === lastMonthDate.getFullYear()) vatLastMonth += tax;
    }
    if (inv.collection_status !== 'collected' && dd && dd < now) overdue += total;
  }
  return { collected, pending, vatThisMonth, vatLastMonth, overdue };
}

function computeWeeklyCashflow(invoices) {
  // Next 12 weeks pending receivables by due_date
  const now = new Date();
  const start = startOfWeek(now);
  const weeks = Array.from({ length: 12 }, (_, i) => addWeeks(start, i));
  const labels = weeks.map((d, i) => `${i+1}. Hafta`);
  const values = new Array(12).fill(0);
  for (const inv of invoices) {
    if (inv.collection_status === 'collected') continue;
    const dd = toDate(inv.due_date);
    if (!dd) continue;
    const diffWeeks = Math.floor((startOfWeek(dd) - start) / (7*24*3600*1000));
    if (diffWeeks >= 0 && diffWeeks < 12) {
      values[diffWeeks] += Number(inv.total || 0);
    }
  }
  return { labels, values };
}

function computeMonthlyTrend(invoices) {
  // Last 6 months sales totals by edit_date
  const now = new Date();
  const buckets = new Map();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.set(monthKey(d), 0);
  }
  for (const inv of invoices) {
    const ed = toDate(inv.edit_date) || toDate(inv.created_at);
    if (!ed) continue;
    const key = monthKey(ed);
    if (buckets.has(key)) {
      buckets.set(key, buckets.get(key) + Number(inv.total || 0));
    }
  }
  const labels = Array.from(buckets.keys()).map(labelMonth);
  const values = Array.from(buckets.values());
  return { labels, values };
}

function computeStatusBreakdown(invoices) {
  let pending = 0, collected = 0;
  for (const inv of invoices) {
    if (inv.collection_status === 'collected') collected += Number(inv.total || 0);
    else pending += Number(inv.total || 0);
  }
  return { labels: ['Bekleyen', 'Tahsil Edilen'], values: [pending, collected] };
}

function computeTopCustomers(invoices, limit = 5) {
  const map = new Map();
  for (const inv of invoices) {
    if (inv.collection_status === 'collected') continue;
    const name = inv.customer_name || 'Diğer';
    map.set(name, (map.get(name) || 0) + Number(inv.total || 0));
  }
  const arr = Array.from(map.entries()).sort((a,b) => b[1]-a[1]).slice(0, limit);
  return { labels: arr.map(([n]) => n), values: arr.map(([,v]) => v) };
}

function computeAging(invoices) {
  const now = new Date();
  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  for (const inv of invoices) {
    if (inv.collection_status === 'collected') continue;
    const dd = toDate(inv.due_date);
    if (!dd) continue;
    const days = Math.floor((now - dd) / (24*3600*1000));
    if (days <= 0) continue; // not overdue
    if (days <= 30) buckets['0-30'] += Number(inv.total || 0);
    else if (days <= 60) buckets['31-60'] += Number(inv.total || 0);
    else if (days <= 90) buckets['61-90'] += Number(inv.total || 0);
    else buckets['90+'] += Number(inv.total || 0);
  }
  return { labels: Object.keys(buckets), values: Object.values(buckets) };
}

let charts = [];
function destroyCharts() {
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];
}

async function renderDashboardPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <section class="container-fluid py-4">
      <h2 class="mb-4 fw-bold text-primary"><i class="bi bi-speedometer2 me-2"></i> Genel Bakış</h2>
      <div class="row g-4">
        <div class="col-md-6 col-lg-3">
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <div class="text-muted small mb-1">Tahsilatlar (Toplam)</div>
              <div class="fw-bold fs-4" id="totalCollection">0,00</div>
              <div class="text-success small" id="collectionNote">—</div>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-3">
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <div class="text-muted small mb-1">Bekleyen Tahsilatlar</div>
              <div class="fw-bold fs-4" id="totalPending">0,00</div>
              <div class="text-danger small" id="overdueNote">—</div>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-3">
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <div class="text-muted small mb-1">Bu Ay Oluşan KDV</div>
              <div class="fw-bold fs-4" id="totalVAT">0,00</div>
              <div class="text-warning small" id="lastMonthVAT">(0,00 GEÇEN AY)</div>
            </div>
          </div>
        </div>
        <div class="col-md-6 col-lg-3">
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <div class="text-muted small mb-1">Toplam Bakiye</div>
              <div class="fw-bold fs-4" id="totalBalance">0,00</div>
              <div class="text-primary small">Cari alacak bakiyesi</div>
            </div>
          </div>
        </div>
      </div>

      <div class="row mt-4 g-4">
        <div class="col-12 col-xl-6">
          <div class="card shadow-sm border-0 h-100">
            <div class="card-body">
              <h5 class="card-title mb-3">Önümüzdeki 12 Haftanın Nakit Akışı</h5>
              <canvas id="cashFlowChart" height="140"></canvas>
            </div>
          </div>
        </div>
        <div class="col-12 col-xl-6">
          <div class="card shadow-sm border-0 h-100">
            <div class="card-body">
              <h5 class="card-title mb-3">Aylık Fatura Eğilimi (6 Ay)</h5>
              <canvas id="monthlyTrendChart" height="140"></canvas>
            </div>
          </div>
        </div>
      </div>

      <div class="row mt-4 g-4">
        <div class="col-12 col-lg-4">
          <div class="card shadow-sm border-0 h-100">
            <div class="card-body">
              <h5 class="card-title mb-3">Tahsilat Durumu</h5>
              <canvas id="statusDonut" height="200"></canvas>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card shadow-sm border-0 h-100">
            <div class="card-body">
              <h5 class="card-title mb-3">Vade Geçmiş Alacak Yaşlandırma</h5>
              <canvas id="agingBar" height="200"></canvas>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-4">
          <div class="card shadow-sm border-0 h-100">
            <div class="card-body">
              <h5 class="card-title mb-3">En Çok Alacaklı Müşteriler</h5>
              <canvas id="topCustomersBar" height="200"></canvas>
            </div>
          </div>
        </div>
      </div>

      <div class="row mt-4 g-4">
        <div class="col-12">
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <h5 class="card-title mb-3">Son İşlemler</h5>
              <ul class="list-group list-group-flush" id="recentTransactions">
                <li class="list-group-item text-muted">Yükleniyor…</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  destroyCharts();

  // Data fetch
  let invoices = [];
  try {
    invoices = await fetchInvoices();
  } catch (err) {
    console.error('Invoices fetch error', err);
  }

  // KPIs
  const { collected, pending, vatThisMonth, vatLastMonth, overdue } = computeKPIs(invoices);
  const el = (id) => document.getElementById(id);
  el('totalCollection').textContent = fmtTRY.format(collected);
  el('totalPending').textContent = fmtTRY.format(pending);
  el('totalVAT').textContent = fmtTRY.format(vatThisMonth);
  el('lastMonthVAT').textContent = `(${fmtTRY.format(vatLastMonth)} GEÇEN AY)`;
  el('totalBalance').textContent = fmtTRY.format(pending);
  el('collectionNote').textContent = collected > 0 ? 'Toplam tahsil edilen tutar' : 'TAHSİLAT YOK';
  el('overdueNote').textContent = overdue > 0 ? `Vadesi geçmiş: ${fmtTRY.format(overdue)}` : 'VADESİ GEÇMİŞ ALACAK YOK';

  // Charts
  const cash = computeWeeklyCashflow(invoices);
  const cashCtx = document.getElementById('cashFlowChart').getContext('2d');
  charts.push(new Chart(cashCtx, {
    type: 'line',
    data: {
      labels: cash.labels,
      datasets: [{
        label: 'Beklenen Tahsilat',
        data: cash.values,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,0.12)',
        tension: 0.35,
        fill: true
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  }));

  const trend = computeMonthlyTrend(invoices);
  const trendCtx = document.getElementById('monthlyTrendChart').getContext('2d');
  charts.push(new Chart(trendCtx, {
    type: 'bar',
    data: {
      labels: trend.labels,
      datasets: [{
        label: 'Toplam',
        data: trend.values,
        backgroundColor: 'rgba(245, 158, 11, 0.35)', // amber
        borderColor: '#f59e0b'
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  }));

  const status = computeStatusBreakdown(invoices);
  const statusCtx = document.getElementById('statusDonut').getContext('2d');
  charts.push(new Chart(statusCtx, {
    type: 'doughnut',
    data: {
      labels: status.labels,
      datasets: [{
        data: status.values,
        backgroundColor: ['#ef4444', '#22c55e'],
        borderWidth: 0
      }]
    },
    options: { plugins: { legend: { position: 'bottom' } }, cutout: '58%' }
  }));

  const aging = computeAging(invoices);
  const agingCtx = document.getElementById('agingBar').getContext('2d');
  charts.push(new Chart(agingCtx, {
    type: 'bar',
    data: {
      labels: aging.labels,
      datasets: [{
        label: 'Toplam',
        data: aging.values,
        backgroundColor: 'rgba(239, 68, 68, 0.35)',
        borderColor: '#ef4444'
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  }));

  const top = computeTopCustomers(invoices, 5);
  const topCtx = document.getElementById('topCustomersBar').getContext('2d');
  charts.push(new Chart(topCtx, {
    type: 'bar',
    data: {
      labels: top.labels,
      datasets: [{
        label: 'Bekleyen',
        data: top.values,
        backgroundColor: 'rgba(99, 102, 241, 0.35)',
        borderColor: '#6366f1'
      }]
    },
    options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
  }));

  // Recent transactions
  const recent = invoices.slice(0, 6);
  const recentList = document.getElementById('recentTransactions');
  recentList.innerHTML = '';
  if (recent.length === 0) {
    recentList.innerHTML = '<li class="list-group-item text-muted">Son işlem yok</li>';
  } else {
    for (const inv of recent) {
      const badge = inv.collection_status === 'collected'
        ? '<span class="badge bg-success">Tahsil</span>'
        : '<span class="badge bg-warning text-dark">Bekliyor</span>';
      const dd = inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '-';
      const title = inv.invoice_no || inv.name || 'Fatura';
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `
        <div>
          <div class="fw-semibold">${title} ${badge}</div>
          <div class="text-muted small">Müşteri: ${inv.customer_name || '-'} • Vade: ${dd}</div>
        </div>
        <div class="fw-bold">${fmtTRY.format(Number(inv.total||0))}</div>
      `;
      recentList.appendChild(li);
    }
  }
}

export { renderDashboardPanel };
