// stock-products-report-panel.js
import { supabase } from './supabaseClient.js';
const getCurrentUserId = () => { try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; } };

export async function renderStockProductsReportPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <section class="container-fluid py-4">
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h2 class="fw-bold text-primary mb-0"><i class="bi bi-clipboard-data me-2"></i> Stoktaki Ürünler Raporu</h2>
        <div class="d-flex gap-2">
          <button id="exportCsvBtn" class="btn btn-outline-secondary btn-sm"><i class="bi bi-download me-1"></i>CSV İndir</button>
          <button id="refreshBtn" class="btn btn-outline-primary btn-sm"><i class="bi bi-arrow-clockwise me-1"></i>Yenile</button>
        </div>
      </div>
      <div id="totalsRow" class="row g-3 mb-3">
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <div class="text-muted small">Stok Değeri (Alış) - KDV Hariç</div>
              <div class="h4 mb-0" id="totalStockCost">0,00</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <div class="text-muted small">Tahmini Satış Değeri - KDV Hariç</div>
              <div class="h4 mb-0" id="totalSaleValue">0,00</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <div class="text-muted small">Toplam Net Kar (KDV Sonrası)</div>
              <div class="h4 mb-0" id="totalSalesProfit">0,00</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <div class="text-muted small">Toplam Stok KDV</div>
              <div class="h4 mb-0" id="totalStockVat">0,00</div>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card shadow-sm border-0">
            <div class="card-body">
              <div class="text-muted small">Toplam KDV Gideri (Alış)</div>
              <div class="h4 mb-0" id="totalStockPurchaseVat">0,00</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm border-0">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <div class="input-group" style="max-width:420px;">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input id="searchInput" type="text" class="form-control" placeholder="Ürün adı veya kodu ile ara...">
            </div>
            <div class="d-flex align-items-center gap-2">
              <label class="text-muted small">Sırala</label>
              <select id="sortSelect" class="form-select form-select-sm">
                <option value="name_asc">Ada göre (A-Z)</option>
                <option value="name_desc">Ada göre (Z-A)</option>
                <option value="stock_desc">Stok (yüksekten)</option>
                <option value="stock_asc">Stok (düşükten)</option>
                <option value="profit_desc">Kar (yüksekten)</option>
                <option value="profit_asc">Kar (düşükten)</option>
              </select>
            </div>
          </div>
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle">
              <thead class="table-light">
                <tr>
                  <th>Ürün Adı ve Kodu</th>
                  <th class="text-end">Stok Miktarı</th>
                  <th class="text-end">Alış Fiyatı (KDV Dahil)</th>
                  <th class="text-end">Satış Fiyatı (KDV Dahil)</th>
                  <th class="text-end">Birim KDV Tutarı (Satış)</th>
                  <th class="text-end">Net Kar (KDV Sonrası)</th>
                  <th class="text-end">Kar Oranı (%)</th>
                </tr>
              </thead>
              <tbody id="reportBody">
                <tr><td colspan="7" class="text-center p-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Yükleniyor...</span></div></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `;

  const fmt = (n) => new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n||0));

  async function loadData() {
    // Totals
    // We can approximate totals client-side by summing filtered rows, so skip global totals view

    document.getElementById('totalStockCost').textContent = '0,00';
    document.getElementById('totalSaleValue').textContent = '0,00';
    document.getElementById('totalSalesProfit').textContent = '0,00';
  document.getElementById('totalStockVat').textContent = '0,00';
  const totalStockPurchaseVatEl = document.getElementById('totalStockPurchaseVat');
  if (totalStockPurchaseVatEl) totalStockPurchaseVatEl.textContent = '0,00';

    // Rows
    const { data: rows, error } = await supabase
      .from('stock_report_view')
      .select('*');
    const body = document.getElementById('reportBody');
    if (error) {
      body.innerHTML = `<tr><td colspan="7"><div class="alert alert-danger">Rapor verisi yüklenemedi: ${error.message}</div></td></tr>`;
      return [];
    }
    const { data: ownedProducts } = await supabase.from('products').select('id').eq('owner_id', getCurrentUserId());
    const ownedSet = new Set((ownedProducts||[]).map(p => p.id));
    const filtered = (rows||[]).filter(r => ownedSet.has(r.id));
    // Compute totals client-side (Net Kar KDV sonrası)
    const totals = filtered.reduce((acc, r) => {
      const saleVat = Number(r.stock_vat_total||0);
      const purchaseVat = Number(r.stock_purchase_vat_total || r.purchase_vat_total || 0);
      // Net Kar (KDV Sonrası) = Net Kar (KDV Hariç) - (Çıkan KDV - İndirilecek KDV)
      const netProfitAfterVat = Number(r.sales_profit||0) - (saleVat - purchaseVat);
      acc.total_stock_cost += Number(r.stock_cost||0);
      acc.total_sale_value += Number(r.sale_value||0);
      acc.total_sales_profit += netProfitAfterVat;
      acc.total_stock_vat += saleVat;
      acc.total_stock_purchase_vat += purchaseVat;
      return acc;
    }, { total_stock_cost:0, total_sale_value:0, total_sales_profit:0, total_stock_vat:0, total_stock_purchase_vat:0 });
    document.getElementById('totalStockCost').textContent = fmt(totals.total_stock_cost);
    document.getElementById('totalSaleValue').textContent = fmt(totals.total_sale_value);
    document.getElementById('totalSalesProfit').textContent = fmt(totals.total_sales_profit);
    document.getElementById('totalStockVat').textContent = fmt(totals.total_stock_vat);
    if (totalStockPurchaseVatEl) totalStockPurchaseVatEl.textContent = fmt(totals.total_stock_purchase_vat);
    return filtered;
  }

  // State & handlers
  const state = { rows: [], search: '', sort: 'name_asc' };

  function getNetProfitAfterVat(r){
    const saleVat = Number(r.stock_vat_total||0);
    const purchaseVat = Number(r.stock_purchase_vat_total || r.purchase_vat_total || 0);
    // Net Kar (KDV Sonrası) = Net Kar (KDV Hariç) - (Çıkan KDV - İndirilecek KDV)
    return Number(r.sales_profit||0) - (saleVat - purchaseVat);
  }

  function applyFilters() {
    let items = [...state.rows];
    if (state.search) {
      const s = state.search.toLowerCase();
      items = items.filter(r => (r.product_name||'').toLowerCase().includes(s) || (r.product_code||'').toLowerCase().includes(s));
    }
    switch (state.sort) {
      case 'name_asc': items.sort((a,b)=> (a.product_name||'').localeCompare(b.product_name||'', 'tr')); break;
      case 'name_desc': items.sort((a,b)=> (b.product_name||'').localeCompare(a.product_name||'', 'tr')); break;
      case 'stock_desc': items.sort((a,b)=> (b.stock_quantity||0) - (a.stock_quantity||0)); break;
      case 'stock_asc': items.sort((a,b)=> (a.stock_quantity||0) - (b.stock_quantity||0)); break;
      case 'profit_desc': items.sort((a,b)=> (getNetProfitAfterVat(b) - getNetProfitAfterVat(a))); break;
      case 'profit_asc': items.sort((a,b)=> (getNetProfitAfterVat(a) - getNetProfitAfterVat(b))); break;
    }
    return items;
  }

  function renderTable(items) {
    const body = document.getElementById('reportBody');
    if (!items.length) {
      body.innerHTML = `<tr><td colspan="10" class="text-center text-muted">Veri bulunamadı</td></tr>`;
      return;
    }
    body.innerHTML = items.map(r => `
      <tr>
        <td>
          <div class="fw-semibold">${r.product_name || '-'}</div>
          <div class="text-muted small">${r.product_code || ''}</div>
        </td>
    <td class="text-end">${fmt(r.stock_quantity)}</td>
    <td class="text-end">${fmt((r.purchase_price_incl ?? r.purchase_price_excl ?? r.purchase_price))}</td>
    <td class="text-end">${fmt((r.sale_price_incl ?? r.sale_price_excl ?? r.sale_price))}</td>
        <td class="text-end">${fmt(r.unit_vat_from_sale || 0)}</td>
        <td class="text-end ${getNetProfitAfterVat(r) < 0 ? 'text-danger' : 'text-success'}">${fmt(getNetProfitAfterVat(r))}</td>
        <td class="text-end">${Number(r.profit_margin_pct ?? 0).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  // Initial load
  state.rows = await loadData();
  renderTable(applyFilters());

  // Events
  document.getElementById('refreshBtn').onclick = async () => {
  document.getElementById('reportBody').innerHTML = `<tr><td colspan="7" class="text-center p-4"><div class="spinner-border text-primary" role="status"></div></td></tr>`;
    state.rows = await loadData();
    renderTable(applyFilters());
  };
  let sDeb;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.search = e.target.value.trim();
    clearTimeout(sDeb);
    sDeb = setTimeout(() => renderTable(applyFilters()), 250);
  });
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderTable(applyFilters());
  });

  // CSV export (istemci tarafı)
  document.getElementById('exportCsvBtn').onclick = () => {
  const header = ['Ürün Adı','Ürün Kodu','Stok','Alış Fiyatı (KDV Dahil)','Satış Fiyatı (KDV Dahil)','Birim KDV Tutarı (Satış)','Net Kar (KDV Sonrası)','Kar Oranı (%)'];
    const rows = applyFilters().map(r => [
      (r.product_name||'').replaceAll(';', ','),
    (r.product_code||'').replaceAll(';', ','),
    r.stock_quantity||0,
    Number((r.purchase_price_incl ?? r.purchase_price_excl ?? r.purchase_price) || 0).toFixed(2),
    Number((r.sale_price_incl ?? r.sale_price_excl ?? r.sale_price) || 0).toFixed(2),
      Number(r.unit_vat_from_sale||0).toFixed(2),
      Number(getNetProfitAfterVat(r)).toFixed(2),
      Number(r.profit_margin_pct??0).toFixed(2)
    ]);
    const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stok-raporu_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
}
