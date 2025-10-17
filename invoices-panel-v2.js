console.log('invoices-panel-v2.js yüklendi');
import { supabase } from './supabaseClient.js';

const getCurrentUserId = () => { try { return JSON.parse(localStorage.getItem('sessionUser'))?.id || null; } catch { return null; } };

// Helpers: tolerant numeric parser and legacy items parser (array or JSON string)
function parseNumberLoose(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    let s = v.trim(); if (!s) return null;
    s = s.replace(/[^0-9.,\-]/g, '');
    const hasDot = s.includes('.'); const hasComma = s.includes(',');
    if (hasDot && hasComma) {
      const lastDot = s.lastIndexOf('.'); const lastComma = s.lastIndexOf(',');
      if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
    } else if (hasComma && !hasDot) s = s.replace(',', '.'); else s = s.replace(/,/g, '');
    const n = Number(s); return Number.isFinite(n) ? n : null;
  }
  return null;
}

function firstOf(obj, keys) {
  if (!obj) return undefined; for (const k of keys) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k]; }
  return undefined;
}

function parseLegacyItems(raw) {
  try {
    if (Array.isArray(raw)) return raw;
    let val = raw;
    for (let i=0; i<3 && typeof val === 'string'; i++) {
      try { val = JSON.parse(val); } catch {
        try { const fixed = val.replace(/'(.*?)'/g, '"$1"'); val = JSON.parse(fixed); } catch { break; }
      }
    }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (Array.isArray(val.items)) return val.items;
      if (Array.isArray(val.data)) return val.data;
      if (Array.isArray(val.lines)) return val.lines;
      const keys = Object.keys(val);
      if (keys.length && keys.every(k => /^\d+$/.test(k))) return keys.sort((a,b)=>Number(a)-Number(b)).map(k=>val[k]);
    }
    return Array.isArray(val) ? val : [];
  } catch { return []; }
}

export async function renderInvoicesPanelV2() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex flex-column flex-lg-row gap-3 justify-content-between align-items-lg-end mb-3">
        <div>
          <h2 class="fw-bold text-primary mb-1">Satış Faturaları</h2>
          <div class="text-muted small">Faturalarınızı arayın, filtreleyin ve yönetin</div>
        </div>
        <div class="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label class="form-label small mb-1">Ara</label>
            <input id="invSearch" class="form-control form-control-sm" placeholder="Müşteri veya Fatura No">
          </div>
          <div>
            <label class="form-label small mb-1">Durum</label>
            <select id="invStatus" class="form-select form-select-sm">
              <option value="">Tümü</option>
              <option value="pending">Tahsil Edilecek</option>
              <option value="collected">Tahsil Edildi</option>
            </select>
          </div>
          <div>
            <label class="form-label small mb-1">Tarih (Başlangıç)</label>
            <input type="date" id="invDateFrom" class="form-control form-control-sm">
          </div>
          <div>
            <label class="form-label small mb-1">Tarih (Bitiş)</label>
            <input type="date" id="invDateTo" class="form-control form-control-sm">
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-outline-secondary btn-sm" id="invRefreshBtn"><i class="bi bi-arrow-repeat"></i></button>
            <button class="btn btn-success btn-sm" id="addInvoiceBtn"><i class="bi bi-plus-lg me-1"></i>Yeni Fatura</button>
          </div>
        </div>
      </div>
      <div id="invoicesSummary" class="mb-2 text-muted small"></div>
      <div id="invoicesList" class="row g-3">
        <div class="d-flex align-items-center text-muted small">
          <div class="spinner-border spinner-border-sm me-2" role="status"></div> Yükleniyor...
        </div>
      </div>
    </section>

    <div class="modal fade" id="invoiceModalV2" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <form id="invoiceFormV2">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">Yeni Fatura</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Fatura İsmi</label><input id="invName" class="form-control"></div>
                <div class="col-md-3"><label class="form-label">Fatura No</label><input id="invNo" class="form-control" placeholder="Otomatik"></div>
                <div class="col-md-3"><label class="form-label">Kategori</label><input id="invCategory" class="form-control"></div>
                <div class="col-md-6"><label class="form-label">Müşteri</label><input id="invCustomer" class="form-control" list="customersDatalistV2" placeholder="Kayıtlı müşteri seçin veya yazın"><datalist id="customersDatalistV2"></datalist></div>
                <div class="col-md-6"><label class="form-label">Etiketler</label><input id="invTags" class="form-control" placeholder="etiket1, etiket2"></div>
                <div class="col-md-3"><label class="form-label">Tahsilat Durumu</label><select id="invCollect" class="form-select"><option value="pending">TAHSİL EDİLECEK</option><option value="collected">TAHSİL EDİLDİ</option></select></div>
                <div class="col-md-3"><label class="form-label">Düzenleme Tarihi</label><input type="date" id="invEdit" class="form-control" value="${new Date().toISOString().slice(0,10)}"></div>
                <div class="col-md-3"><label class="form-label">Vade Tarihi</label><input type="date" id="invDue" class="form-control" value="${new Date().toISOString().slice(0,10)}"></div>
                <div class="col-md-3"><label class="form-label">Döviz</label><input id="invCurr" class="form-control" value="TRY"></div>
                <div class="col-12">
                  <label class="form-label mb-1">Stok Takibi</label>
                  <div class="border rounded p-2">
                    <div class="form-check">
                      <input class="form-check-input" type="radio" name="stockTrackingV2" id="stockOutYesV2" value="out" checked>
                      <label class="form-check-label" for="stockOutYesV2">STOK ÇIKIŞI YAPILSIN <span class="text-muted small d-block">Ürün seçilen satırlar stoktan düşer.</span></label>
                    </div>
                    <div class="form-check mt-2">
                      <input class="form-check-input" type="radio" name="stockTrackingV2" id="stockOutNoV2" value="noout">
                      <label class="form-check-label" for="stockOutNoV2">STOK ÇIKIŞI YAPILMASIN <span class="text-muted small d-block">Hizmetler veya stok takibi gerekmeyen kalemler için.</span></label>
                    </div>
                  </div>
                </div>
                <div class="col-md-12">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">Hizmet / Ürün Satırları</h6>
                    <button class="btn btn-sm btn-outline-primary" type="button" id="addRowV2">YENİ SATIR</button>
                  </div>
                  <div class="table-responsive">
                    <table class="table table-sm align-middle" id="itemsTableV2">
                      <thead><tr><th style="width:40%">Hizmet / Ürün <span class="text-muted small">(ürün seçerseniz stoktan düşer)</span></th><th style="width:10%">Miktar</th><th style="width:10%">Birim</th><th style="width:15%">Br. Fiyat</th><th style="width:10%">KDV%</th><th style="width:10%">Toplam</th><th></th></tr></thead>
                      <tbody></tbody>
                    </table>
                  </div>
                </div>
                <!-- Global datalist for products -->
                <datalist id="productsDatalistV2"></datalist>
                <input type="hidden" id="invId">
                <div class="col-md-4 offset-md-8">
                  <div class="d-flex justify-content-between"><div>Ara Toplam</div><div id="subTextV2">0,00</div></div>
                  <div class="d-flex justify-content-between"><div>Toplam KDV</div><div id="taxTextV2">0,00</div></div>
                  <div class="d-flex justify-content-between fw-bold mt-2"><div>GENEL TOPLAM</div><div id="grandTextV2">0,00</div></div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">VAZGEÇ</button>
              <button type="submit" class="btn btn-primary" id="submitV2">KAYDET</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  await loadInvoicesV2();

  document.getElementById('addInvoiceBtn').onclick = () => openCreateV2();
  document.getElementById('addRowV2').onclick = () => addRowV2();
  document.getElementById('invoiceFormV2').onsubmit = onSubmitV2;
  // Preload base lists once
  try { await Promise.all([preloadCustomersV2(), preloadProductsV2()]); } catch {}

  // Filters: wire events
  const debounced = debounce(loadInvoicesV2, 300);
  document.getElementById('invSearch')?.addEventListener('input', debounced);
  document.getElementById('invStatus')?.addEventListener('change', loadInvoicesV2);
  document.getElementById('invDateFrom')?.addEventListener('change', loadInvoicesV2);
  document.getElementById('invDateTo')?.addEventListener('change', loadInvoicesV2);
  document.getElementById('invRefreshBtn')?.addEventListener('click', (e)=>{ e.preventDefault(); loadInvoicesV2(); });
}

async function loadInvoicesV2() {
  const listEl = document.getElementById('invoicesList');
  const summaryEl = document.getElementById('invoicesSummary');
  if (listEl) listEl.innerHTML = `<div class="d-flex align-items-center text-muted small"><div class="spinner-border spinner-border-sm me-2" role="status"></div> Yükleniyor...</div>`;
  const owner = getCurrentUserId();
  let q = supabase
    .from('invoices_v2')
    .select('id, invoice_no, customer_name, currency, total, edit_date, collection_status, category')
    .eq('owner_id', owner)
    .order('id', { ascending: false })
    .limit(100);
  // Filters
  const termRaw = document.getElementById('invSearch')?.value || '';
  const term = termRaw.trim();
  if (term) {
    const safe = term.replace(/%/g, '').replace(/,/g, '');
    q = q.or(`invoice_no.ilike.%${safe}%,customer_name.ilike.%${safe}%`);
  }
  const st = document.getElementById('invStatus')?.value || '';
  if (st) q = q.eq('collection_status', st);
  const df = document.getElementById('invDateFrom')?.value || '';
  const dt = document.getElementById('invDateTo')?.value || '';
  if (df) q = q.gte('edit_date', df);
  if (dt) q = q.lte('edit_date', dt);

  const { data, error } = await q;
  if (error) {
    if (listEl) listEl.innerHTML = `<div class='alert alert-danger'>${error.message}</div>`;
    if (summaryEl) summaryEl.textContent = '';
    return;
  }
  if (!data?.length) {
    if (listEl) listEl.innerHTML = `<div class='alert alert-info w-100'>Kriterlere uyan fatura bulunamadı.</div>`;
    if (summaryEl) summaryEl.textContent = '0 kayıt';
    return;
  }

  // Summary
  const totalSum = data.reduce((s, x) => s + Number(x.total || 0), 0);
  const fmt = (amt, cur) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: (cur||'TRY') }).format(Number(amt||0));
  if (summaryEl) summaryEl.textContent = `${data.length} kayıt • Toplam: ${fmt(totalSum, data[0]?.currency||'TRY')}`;

  // Overview removed from invoices page; metrics are shown on dashboard now.

  // Render cards
  const statusBadge = (st) => st === 'collected' ? '<span class="badge bg-success">TAHSİL EDİLDİ</span>' : '<span class="badge bg-warning text-dark">TAHSİL EDİLECEK</span>';
  const dateStr = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '';
  const rows = data.map(inv => {
    const amount = fmt(inv.total, inv.currency);
    const cat = inv.category ? `<span class='badge bg-light text-secondary border ms-1'>${inv.category}</span>` : '';
    return `
      <div class="col-12 col-md-6 col-xl-4">
        <div class="card shadow-sm h-100">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <div class="small text-muted">${inv.invoice_no || ''}</div>
                <div class="fw-semibold">${inv.customer_name || 'Müşteri'}</div>
              </div>
              <div class="text-end">
                ${statusBadge(inv.collection_status)}
              </div>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="text-muted small">${dateStr(inv.edit_date)}</div>
              <div class="fw-bold">${amount}</div>
            </div>
            <div class="mt-auto d-flex gap-2 flex-wrap">
              <button class='btn btn-sm btn-outline-secondary' data-id='${inv.id}' data-act='edit'><i class="bi bi-pencil"></i> Güncelle</button>
              <button class='btn btn-sm btn-outline-danger' data-id='${inv.id}' data-act='del'><i class="bi bi-trash"></i> Sil</button>
              ${cat}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  if (listEl) listEl.innerHTML = rows;
  listEl.querySelectorAll('button[data-act="edit"]').forEach(b => b.onclick = () => openEditV2(b.dataset.id));
  listEl.querySelectorAll('button[data-act="del"]').forEach(b => b.onclick = () => deleteV2(b.dataset.id));
}

// Small debounce helper
function debounce(fn, wait=250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), wait); };
}

function addRowV2(values={}) {
  const tbody = document.querySelector('#itemsTableV2 tbody');
  const tr = document.createElement('tr');
  const qty = Number(values.qty ?? 1);
  const price = Number(values.unit_price ?? 0);
  const tax = Number(values.tax_rate ?? 0);
  const gross = (qty*price)*(1+(tax/100));
  tr.innerHTML = `
    <td>
      <input list="productsDatalistV2" class='form-control form-control-sm item-desc' placeholder='Hizmet / Ürün adı veya kodu' value='${values.description||''}'>
      <div class="form-text small">Ürün seçerseniz stoktan düşer; hizmet için boş bırakın.</div>
    </td>
    <td><input class='form-control form-control-sm item-qty' type='number' step='0.01' min='0' value='${qty}'></td>
    <td><input class='form-control form-control-sm item-unit' value='${values.unit||'Adet'}'></td>
    <td><input class='form-control form-control-sm item-price' type='number' step='0.01' min='0' value='${price.toFixed(2)}'></td>
    <td><input class='form-control form-control-sm item-tax' type='number' step='0.01' min='0' value='${tax}'></td>
    <td class='text-end align-middle'><span class='line-total'>${gross.toFixed(2)}</span></td>
    <td><button type='button' class='btn btn-sm btn-outline-danger remove-row'>Sil</button></td>
  `;
  tbody.appendChild(tr);
  if (values.product_id) tr.dataset.productId = values.product_id;
  const onChange = () => recalcV2();
  tr.querySelectorAll('.item-qty,.item-price,.item-tax').forEach(i => i.addEventListener('input', onChange));
  tr.querySelector('.remove-row').onclick = () => { tr.remove(); recalcV2(); };
  // Bind product resolution on change
  const descInput = tr.querySelector('.item-desc');
  const resolveAndFill = async () => {
    const found = await resolveProductV2(descInput.value);
    if (found) {
      tr.querySelector('.item-unit').value = found.unit || found.default_unit || 'Adet';
      const p = Number(found.sale_price ?? found.price ?? found.unit_price ?? found.net_price ?? 0);
      tr.querySelector('.item-price').value = (Number.isFinite(p) ? p : 0).toFixed(2);
      const tax = Number(found.vat_rate ?? found.tax_rate ?? found.kdv_orani ?? 0);
      tr.querySelector('.item-tax').value = Number.isFinite(tax) ? tax : 0;
      tr.dataset.productId = found.id;
      recalcV2();
    } else {
      delete tr.dataset.productId;
    }
  };
  descInput.addEventListener('change', resolveAndFill);
  descInput.addEventListener('blur', resolveAndFill);
}

function recalcV2() {
  let sub = 0, taxSum = 0;
  document.querySelectorAll('#itemsTableV2 tbody tr').forEach(tr => {
    const qty = Number(tr.querySelector('.item-qty').value||0);
    const price = Number(tr.querySelector('.item-price').value||0);
    const tax = Number(tr.querySelector('.item-tax').value||0);
    const line = qty*price;
    const ltax = line*(tax/100);
    sub += line; taxSum += ltax;
    tr.querySelector('.line-total').textContent = (line+ltax).toFixed(2);
  });
  const grand = sub + taxSum;
  document.getElementById('subTextV2').textContent = sub.toFixed(2);
  document.getElementById('taxTextV2').textContent = taxSum.toFixed(2);
  document.getElementById('grandTextV2').textContent = grand.toFixed(2);
}

function openCreateV2() {
  const form = document.getElementById('invoiceFormV2');
  form.reset();
  document.getElementById('invId').value = '';
  const tbody = document.querySelector('#itemsTableV2 tbody');
  tbody.innerHTML = '';
  addRowV2();
  document.querySelector('#invoiceModalV2 .modal-title').textContent = 'Yeni Fatura';
  document.getElementById('submitV2').textContent = 'KAYDET';
  // Defaults
  const yes = document.getElementById('stockOutYesV2'); if (yes) yes.checked = true;
  new bootstrap.Modal(document.getElementById('invoiceModalV2')).show();
}

async function openEditV2(id) {
  const owner = getCurrentUserId();
  const { data: inv, error } = await supabase.from('invoices_v2').select('*').eq('owner_id', owner).eq('id', id).single();
  if (error || !inv) return alert('Fatura bulunamadı');
  // Debug: log raw totals and types to help diagnose prefilling issues
  try { console.debug('openEditV2 - raw totals', { subtotal: inv.subtotal, tax_total: inv.tax_total, total: inv.total, types: [typeof inv.subtotal, typeof inv.tax_total, typeof inv.total] }); } catch (e) {}
  // Fill header
  document.getElementById('invId').value = inv.id;
  document.getElementById('invName').value = inv.name || '';
  document.getElementById('invNo').value = inv.invoice_no || '';
  document.getElementById('invCategory').value = inv.category || '';
  document.getElementById('invCustomer').value = inv.customer_name || '';
  document.getElementById('invTags').value = Array.isArray(inv.tags) ? inv.tags.join(', ') : '';
  document.getElementById('invCollect').value = inv.collection_status || 'pending';
  document.getElementById('invEdit').value = inv.edit_date || new Date().toISOString().slice(0,10);
  document.getElementById('invDue').value = inv.due_date || document.getElementById('invDue').value;
  document.getElementById('invCurr').value = inv.currency || 'TRY';
  // Stock tracking radios
  try {
    const yes = document.getElementById('stockOutYesV2');
    const no = document.getElementById('stockOutNoV2');
    if (inv.stock_tracking_mode === 'noout') { if (no) no.checked = true; else if (yes) yes.checked = false; }
    else { if (yes) yes.checked = true; }
  } catch {}

  // Fill items
  const tbody = document.querySelector('#itemsTableV2 tbody');
  tbody.innerHTML = '';
  const { data: items } = await supabase.from('invoice_items_v2').select('*').eq('owner_id', owner).eq('invoice_id', inv.id).order('sort_order', { ascending: true });
  if (items?.length) {
    for (const it of items) addRowV2(it);
  } else {
    // Legacy import hint if possible
    const box = document.createElement('div');
    box.className = 'alert alert-warning d-flex justify-content-between align-items-center';
    box.innerHTML = `<div>Bu faturanın kalemleri bulunamadı. Eski faturalar tablosundan (invoice_no ile) kalemleri içe aktarmayı deneyebilirsiniz.</div>
      <button type='button' class='btn btn-sm btn-outline-secondary' id='importLegacyBtn'>Eski kalemleri içe aktar</button>`;
    document.querySelector('#invoiceModalV2 .modal-body')?.prepend(box);
    const btn = box.querySelector('#importLegacyBtn');
    btn?.addEventListener('click', async () => {
      try {
        if (!inv.invoice_no) throw new Error('invoice_no yok');
        const { data: legacy, error: errLegacy } = await supabase
          .from('invoices')
          .select('items')
          .eq('owner_id', owner)
          .eq('invoice_no', inv.invoice_no)
          .single();
        if (errLegacy || !legacy) throw errLegacy || new Error('Eski kayıt yok');
  const parsed = parseLegacyItems(legacy.items);
  try { console.debug('importLegacy - parsed items preview', parsed.slice ? parsed.slice(0,5) : parsed); } catch (e) {}
        if (!Array.isArray(parsed) || !parsed.length) throw new Error('Eski kalemler boş');
        const tbody = document.querySelector('#itemsTableV2 tbody');
        tbody.innerHTML = '';
        parsed.forEach((it) => {
          // Broad alias list (mirror v1) and tolerant parsing/derivation
          const qtyKeys = ['qty','quantity','miktar','adet','count','adet_sayisi','adetSayisi','sayi','quantityOrdered','qty_ordered','countQty'];
          const priceKeys = ['price','unit_price','unitPrice','brutFiyat','fiyat','netFiyat','net_price','birim_fiyat','birimFiyat','price_net','priceNet','netAmount','unit_price_net','unitPriceNet','priceWithoutTax','unit_net'];
          const taxKeys = ['tax','vat','vat_rate','kdv','kdv_orani','kdvOrani','tax_percent','taxPercent','taxRate','tax_rate_percent','kdvYuzde','kdv_oran','tax_rate'];
          const descKeys = ['desc','description','aciklama','product_name','name','title','productName'];
          const unitKeys = ['unit','birim','uom'];

          let qty = parseNumberLoose(firstOf(it, qtyKeys));
          let price = parseNumberLoose(firstOf(it, priceKeys));
          let tax = parseNumberLoose(firstOf(it, taxKeys));
          const unit = firstOf(it, unitKeys) || 'Adet';
          const description = firstOf(it, descKeys) || '';

          // Saved totals that may help derive missing values
          const savedNet = parseNumberLoose(firstOf(it, ['lineTotal','line_total','satirToplam','total','netTotal','net_total','lineNet','line_amount_net','amount_net']));
          const savedGross = parseNumberLoose(firstOf(it, ['grossTotal','totalWithTax','toplamKdvDahil','satirToplamKdvDahil','line_total_with_tax','total_gross','lineGross','amountWithTax','amount_with_tax']));

          if (!Number.isFinite(qty)) qty = null;
          if (!Number.isFinite(price)) price = null;
          if (!Number.isFinite(tax)) tax = null;

          // Derive missing price from saved totals and qty
          if (!Number.isFinite(price)) {
            const qBase = Number.isFinite(qty) ? qty : parseNumberLoose(firstOf(it, ['qty','quantity','miktar','adet']));
            const qSafe = Number.isFinite(qBase) ? qBase : 0;
            if (Number.isFinite(savedNet) && qSafe > 0) {
              price = savedNet / qSafe;
            } else if (Number.isFinite(savedGross) && qSafe > 0) {
              if (Number.isFinite(tax)) price = savedGross / (qSafe * (1 + (tax/100)));
              else price = savedGross / qSafe;
            }
          }
          // Derive missing qty from saved totals and price
          if ((!Number.isFinite(qty) || qty === null) && Number.isFinite(price) && price > 0) {
            if (Number.isFinite(savedNet) && price > 0) {
              qty = savedNet / price;
            } else if (Number.isFinite(savedGross) && price > 0) {
              const denom = Number.isFinite(tax) ? price * (1 + (tax/100)) : price;
              if (denom > 0) qty = savedGross / denom;
            }
          }

          // Final fallbacks
          qty = Number.isFinite(qty) ? qty : 0;
          price = Number.isFinite(price) ? price : 0;
          tax = Number.isFinite(tax) ? tax : 0;

          // If product_id present in legacy item, pass through
          const payload = { qty, unit_price: price, tax_rate: tax, unit, description };
          if (it.product_id) payload.product_id = it.product_id;
          addRowV2(payload);
        });
        recalcV2();
        box.remove();
      } catch (e) {
        alert('İçe aktarma başarısız: ' + (e?.message||e));
      }
    });
    addRowV2();
  }
  // Prefill totals from DB: Postgres `numeric` often comes back as string, so parse loosely
  const subDb = parseNumberLoose(inv.subtotal);
  const taxDb = parseNumberLoose(inv.tax_total);
  const grandDb = parseNumberLoose(inv.total);
  if (Number.isFinite(subDb) || Number.isFinite(taxDb) || Number.isFinite(grandDb)) {
    if (Number.isFinite(subDb)) document.getElementById('subTextV2').textContent = subDb.toFixed(2);
    if (Number.isFinite(taxDb)) document.getElementById('taxTextV2').textContent = taxDb.toFixed(2);
    if (Number.isFinite(grandDb)) document.getElementById('grandTextV2').textContent = grandDb.toFixed(2);
  } else {
    // If DB doesn't have numeric totals, compute from rows
    recalcV2();
  }

  document.querySelector('#invoiceModalV2 .modal-title').textContent = 'Fatura Güncelle';
  document.getElementById('submitV2').textContent = 'GÜNCELLE';
  new bootstrap.Modal(document.getElementById('invoiceModalV2')).show();
}

async function onSubmitV2(e) {
  e.preventDefault();
  const owner = getCurrentUserId();
  const id = document.getElementById('invId').value;
  const stockMode = document.getElementById('stockOutYesV2')?.checked ? 'out' : 'noout';
  // Resolve customer_id if possible from datalist cache
  const customerInput = document.getElementById('invCustomer').value.trim();
  const customerMatch = await resolveCustomerV2(customerInput);
  const customer_id = customerMatch?.id || null;

  const payloadBase = {
    owner_id: owner,
    name: document.getElementById('invName').value.trim() || null,
    invoice_no: document.getElementById('invNo').value.trim() || null,
    category: document.getElementById('invCategory').value.trim() || null,
    customer_id,
    customer_name: customerInput || null,
    tags: (document.getElementById('invTags').value||'').split(',').map(x=>x.trim()).filter(Boolean),
    collection_status: document.getElementById('invCollect').value,
    edit_date: document.getElementById('invEdit').value || null,
    due_date: document.getElementById('invDue').value || null,
    currency: document.getElementById('invCurr').value || 'TRY',
    stock_tracking_mode: stockMode,
  };

  // Collect items and compute totals
  const items = [];
  let sub = 0, taxSum = 0;
  const itemsForStock = [];
  document.querySelectorAll('#itemsTableV2 tbody tr').forEach((tr, idx) => {
    const qty = Number(tr.querySelector('.item-qty').value||0);
    const price = Number(tr.querySelector('.item-price').value||0);
    const tax = Number(tr.querySelector('.item-tax').value||0);
    const unit = tr.querySelector('.item-unit').value || 'Adet';
    const description = tr.querySelector('.item-desc').value || '';
    const line = qty*price; const ltax = line*(tax/100);
    sub += line; taxSum += ltax;
    const product_id = tr.dataset.productId ? tr.dataset.productId : null;
    items.push({ owner_id: owner, qty, unit_price: price, tax_rate: tax, unit, description, product_id, line_subtotal: line, line_tax: ltax, line_total: line+ltax, sort_order: idx });
    if (product_id && stockMode === 'out' && qty > 0) itemsForStock.push({ product_id, qty });
  });
  const payload = { ...payloadBase, subtotal: sub, tax_total: taxSum, total: sub + taxSum };

  // Pre-check stock before saving when mode is 'out'
  if (stockMode === 'out' && itemsForStock.length) {
    const ok = await precheckStockV2(itemsForStock);
    if (!ok) return; // Abort save; user was alerted
  }

  let err = null, invId = id;
  if (id) {
    // UPDATE with fallback if 'name' column missing in schema cache
    let res = await supabase.from('invoices_v2').update(payload).eq('owner_id', owner).eq('id', id);
    err = res.error;
    if (err && /name.+schema/i.test(err.message||'')) {
      const { name, ...withoutName } = payload;
      res = await supabase.from('invoices_v2').update(withoutName).eq('owner_id', owner).eq('id', id);
      err = res.error;
    }
    if (!err) {
      // Replace items: simplest correct approach
      await supabase.from('invoice_items_v2').delete().eq('owner_id', owner).eq('invoice_id', id);
      const rows = items.map(it => ({ ...it, invoice_id: Number(id) }));
      if (rows.length) await supabase.from('invoice_items_v2').insert(rows);
    }
  } else {
    // INSERT with fallback if 'name' column missing in schema cache
    const ensureNo = (p) => {
      if (p.invoice_no) return p;
      const now = new Date(); const pad=n=>String(n).padStart(2,'0');
      return { ...p, invoice_no: `INV-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}` };
    };
    let toSend = ensureNo(payload);
    let res = await supabase.from('invoices_v2').insert([toSend]).select('id').single();
    err = res.error; invId = res.data?.id;
    if (err && /name.+schema/i.test(err.message||'')) {
      const { name, ...withoutName } = toSend;
      res = await supabase.from('invoices_v2').insert([withoutName]).select('id').single();
      err = res.error; invId = res.data?.id;
    }
    if (!err && invId) {
      const rows = items.map(it => ({ ...it, invoice_id: invId }));
      if (rows.length) await supabase.from('invoice_items_v2').insert(rows);
    }
  }

  if (err) { alert('Kaydetme başarısız: '+err.message); return; }

  // If stock mode is 'out', apply stock decrement
  try { if (itemsForStock.length && stockMode === 'out') await applyStockOutV2(itemsForStock); } catch (se) { console.warn('Stok düşümü uyarı:', se?.message||se); }

  bootstrap.Modal.getInstance(document.getElementById('invoiceModalV2')).hide();
  await loadInvoicesV2();
}

// --- Helpers: customers/products preload and resolvers ---
let CUSTOMERS_CACHE_V2 = null;
async function preloadCustomersV2() {
  try {
    const { data, error } = await supabase.from('customers').select('id, company_title, short_name').eq('owner_id', getCurrentUserId());
    if (error) throw error; CUSTOMERS_CACHE_V2 = data || [];
    const dl = document.getElementById('customersDatalistV2');
    if (dl) {
      dl.innerHTML = '';
      (CUSTOMERS_CACHE_V2||[]).forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.company_title || c.short_name || '';
        dl.appendChild(opt);
      });
    }
  } catch {}
}

let PRODUCTS_CACHE_V2 = null;
async function preloadProductsV2() {
  try {
    let query = supabase.from('products').select('id, code, name, unit, sale_price, price, vat_rate, barcode, stock');
    // Try owner filter; if it errors (missing column) or returns empty, fallback without filter
    let { data, error } = await query.eq('owner_id', getCurrentUserId());
    if (error) {
      ({ data, error } = await query);
    }
    if (!error && (!data || data.length === 0)) {
      ({ data, error } = await query);
    }
    if (error) throw error; PRODUCTS_CACHE_V2 = data || [];
    const dl = document.getElementById('productsDatalistV2');
    if (dl) {
      dl.innerHTML = '';
      (PRODUCTS_CACHE_V2||[]).forEach(p => {
        const opt = document.createElement('option');
        const label = p.code ? `${p.name} (${p.code})` : p.name;
        opt.value = label;
        if (p.barcode) opt.label = `${label} · ${p.barcode}`;
        dl.appendChild(opt);
      });
    }
  } catch {}
}

async function resolveProductV2(input) {
  if (!input) return null;
  if (!PRODUCTS_CACHE_V2) await preloadProductsV2();
  const s = input.trim().toLowerCase();
  const list = (PRODUCTS_CACHE_V2||[]);
  // Exact code match
  let match = list.find(p => (p.code||'').toLowerCase() === s);
  if (match) return match;
  // Exact name or "name (code)"
  match = list.find(p => (p.name||'').toLowerCase() === s || (p.code ? `${p.name} (${p.code})` : p.name).toLowerCase() === s);
  if (match) return match;
  // Barcode exact
  match = list.find(p => (p.barcode||'').toLowerCase() === s);
  if (match) return match;
  // Unique partial by code/name
  const partial = list.filter(p => (p.code||'').toLowerCase().includes(s) || (p.name||'').toLowerCase().includes(s));
  if (partial.length === 1) return partial[0];
  return null;
}

// Validate stock availability before save
async function precheckStockV2(items) {
  // Aggregate required qty per product
  const need = new Map();
  for (const it of items) {
    const id = String(it.product_id);
    const q = Number(it.qty||0);
    need.set(id, (need.get(id)||0) + q);
  }
  const ids = Array.from(need.keys());
  if (!ids.length) return true;
  let q = supabase.from('products').select('id, name, stock').in('id', ids).eq('owner_id', getCurrentUserId());
  let res = await q;
  if (res.error) {
    // Fallback without owner filter
    res = await supabase.from('products').select('id, name, stock').in('id', ids);
  }
  if (res.error) { console.warn('Stok kontrolü okunamadı:', res.error?.message||res.error); return true; }
  const rows = res.data || [];
  const insufficient = [];
  for (const id of ids) {
    const row = rows.find(r => String(r.id) === String(id));
    const have = Number(row?.stock||0);
    const req = Number(need.get(id)||0);
    if (req > have) insufficient.push({ id, name: row?.name||`Ürün ${id}`, have, req });
  }
  if (insufficient.length) {
    const msg = 'Stok yetersiz ürün(ler):\n' + insufficient.map(x => `- ${x.name}: Var ${x.have}, Gerekli ${x.req}`).join('\n');
    alert(msg);
    return false;
  }
  return true;
}

async function applyStockOutV2(items) {
  // Safe approach: read current stock and update
  for (const it of items) {
    if (!it.product_id) continue;
    try {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', it.product_id).eq('owner_id', getCurrentUserId()).single();
      const current = Number(prod?.stock || 0);
      const next = Math.max(0, current - Number(it.qty||0));
      await supabase.from('products').update({ stock: next }).eq('id', it.product_id).eq('owner_id', getCurrentUserId());
    } catch (e) {
      console.warn('Stock update failed for product', it.product_id, e?.message||e);
    }
  }
}

async function resolveCustomerV2(input) {
  if (!input) return null;
  if (!CUSTOMERS_CACHE_V2) await preloadCustomersV2();
  const s = input.trim().toLowerCase();
  const list = (CUSTOMERS_CACHE_V2||[]);
  let match = list.find(c => (c.company_title||'').toLowerCase() === s);
  if (match) return match;
  match = list.find(c => (c.short_name||'').toLowerCase() === s);
  if (match) return match;
  const partial = list.filter(c => (c.company_title||'').toLowerCase().includes(s) || (c.short_name||'').toLowerCase().includes(s));
  if (partial.length === 1) return partial[0];
  return null;
}

async function deleteV2(id) {
  if (!confirm('Faturayı silmek istiyor musunuz?')) return;
  const owner = getCurrentUserId();
  const { error } = await supabase.from('invoices_v2').delete().eq('owner_id', owner).eq('id', id);
  if (error) { alert('Silme başarısız: '+error.message); return; }
  await loadInvoicesV2();
}
