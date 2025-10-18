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
  // Debug: log invoice object for troubleshooting prefilling issues (use console.info so it's visible)
  try { console.info('openEditV2 - invoice object', inv); } catch (e) {}
  // Fill header with tolerant field mapping (support multiple DB column name variants)
  const headerSet = {
    id: inv.id,
    name: firstOf(inv, ['name','invoice_name','title','label']) || '',
    invoice_no: firstOf(inv, ['invoice_no','invoiceNo','no','number','invoice_number']) || '',
    category: firstOf(inv, ['category','cat','type']) || '',
    customer_name: firstOf(inv, ['customer_name','customer','customerFullName','buyer','customer_name_raw']) || '',
    tags: firstOf(inv, ['tags','labels','etiketler']) || inv.tags || [],
    collection_status: firstOf(inv, ['collection_status','status','state']) || 'pending',
    edit_date: firstOf(inv, ['edit_date','date','created_at','updated_at']) || new Date().toISOString().slice(0,10),
    due_date: firstOf(inv, ['due_date','vade','due']) || '',
    currency: firstOf(inv, ['currency','curr']) || 'TRY',
    stock_tracking_mode: firstOf(inv, ['stock_tracking_mode','stock_mode','stockMode']) || inv.stock_tracking_mode || null,
  };
  const invIdEl = document.getElementById('invId'); if (invIdEl) invIdEl.value = headerSet.id || '';
  const setIf = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; else console.warn('openEditV2: missing element', id); };
  setIf('invName', headerSet.name);
  setIf('invNo', headerSet.invoice_no);
  setIf('invCategory', headerSet.category);
  setIf('invCustomer', headerSet.customer_name);
  // tags may be array or comma string
  const tagsVal = Array.isArray(headerSet.tags) ? headerSet.tags.join(', ') : (typeof headerSet.tags === 'string' ? headerSet.tags : '');
  setIf('invTags', tagsVal);
  setIf('invCollect', headerSet.collection_status || 'pending');
  setIf('invEdit', headerSet.edit_date);
  // keep existing value for invDue if fallback
  const invDueEl = document.getElementById('invDue'); if (invDueEl) invDueEl.value = headerSet.due_date || invDueEl.value;
  setIf('invCurr', headerSet.currency || 'TRY');
  // Stock radios
  try {
    const yes = document.getElementById('stockOutYesV2');
    const no = document.getElementById('stockOutNoV2');
    if (headerSet.stock_tracking_mode === 'noout') { if (no) no.checked = true; else if (yes) yes.checked = false; }
    else { if (yes) yes.checked = true; }
  } catch (e) { console.warn('openEditV2 stock radio set failed', e); }
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
  // Primary fetch: items scoped to owner
  const { data: items, error: itemsErr } = await supabase.from('invoice_items_v2').select('*').eq('owner_id', owner).eq('invoice_id', inv.id).order('sort_order', { ascending: true });
  try { console.info('openEditV2 - invoice items from DB (scoped to owner)', items, 'err', itemsErr); } catch (e) {}
  // expose last fetched objects for easier debugging in browser console
  try { window.__LAST_OPEN_EDIT = { owner, invoiceId: inv.id, invoice: inv, items }; } catch (e) {}
  if (items && Array.isArray(items) && items.length) {
    for (const it of items) {
      const payload = {
        qty: firstOf(it, ['qty','quantity','miktar','adet','count','quantity_ordered','qty_ordered']) ?? it.qty ?? 0,
        unit_price: firstOf(it, ['unit_price','price','unitPrice','net_price','price_net','brutFiyat','fiyat']) ?? it.unit_price ?? 0,
        tax_rate: firstOf(it, ['tax_rate','vat_rate','kdv','kdv_orani','tax']) ?? it.tax_rate ?? 0,
        unit: firstOf(it, ['unit','birim','uom']) || it.unit || 'Adet',
        description: firstOf(it, ['description','desc','product_name','name','title']) || it.description || '',
        product_id: it.product_id ?? it.productId ?? null,
      };
      payload.qty = parseNumberLoose(payload.qty);
      payload.unit_price = parseNumberLoose(payload.unit_price);
      payload.tax_rate = parseNumberLoose(payload.tax_rate);
      addRowV2(payload);
    }
  } else {
    // If no items found with owner filter, attempt fallback fetch without owner (possible owner_id mismatch)
    try {
      const { data: itemsFallback, error: fallbackErr } = await supabase.from('invoice_items_v2').select('*').eq('invoice_id', inv.id).order('sort_order', { ascending: true });
      try { console.info('openEditV2 - fallback invoice items (no owner filter)', itemsFallback, 'err', fallbackErr); } catch (e) {}
      try { window.__LAST_OPEN_EDIT.fallbackItems = itemsFallback; } catch (e) {}
      if (itemsFallback && Array.isArray(itemsFallback) && itemsFallback.length) {
        for (const it of itemsFallback) {
          const payload = {
            qty: firstOf(it, ['qty','quantity','miktar','adet','count','quantity_ordered','qty_ordered']) ?? it.qty ?? 0,
            unit_price: firstOf(it, ['unit_price','price','unitPrice','net_price','price_net','brutFiyat','fiyat']) ?? it.unit_price ?? 0,
            tax_rate: firstOf(it, ['tax_rate','vat_rate','kdv','kdv_orani','tax']) ?? it.tax_rate ?? 0,
            unit: firstOf(it, ['unit','birim','uom']) || it.unit || 'Adet',
            description: firstOf(it, ['description','desc','product_name','name','title']) || it.description || '',
            product_id: it.product_id ?? it.productId ?? null,
          };
          payload.qty = parseNumberLoose(payload.qty);
          payload.unit_price = parseNumberLoose(payload.unit_price);
          payload.tax_rate = parseNumberLoose(payload.tax_rate);
          addRowV2(payload);
        }
      } else {
        // Try silent legacy import from `invoices` table using invoice_no (no UI prompt)
        try {
          if (inv.invoice_no) {
            // use maybeSingle to avoid PostgREST error when no rows
            const { data: legacy, error: errLegacy } = await supabase
              .from('invoices')
              .select('items')
              .eq('owner_id', owner)
              .eq('invoice_no', inv.invoice_no)
              .maybeSingle();
            try { console.info('openEditV2 - legacy items fetch (maybeSingle)', legacy, 'err', errLegacy); } catch (e) {}
            const parsed = legacy && legacy.items ? parseLegacyItems(legacy.items) : [];
            try { window.__LAST_OPEN_EDIT.legacyParsed = parsed; } catch (e) {}
            if (Array.isArray(parsed) && parsed.length) {
              // Map legacy items tolerant and add rows
              for (const it of parsed) {
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

                const savedNet = parseNumberLoose(firstOf(it, ['lineTotal','line_total','satirToplam','total','netTotal','net_total','lineNet','line_amount_net','amount_net']));
                const savedGross = parseNumberLoose(firstOf(it, ['grossTotal','totalWithTax','toplamKdvDahil','satirToplamKdvDahil','line_total_with_tax','total_gross','lineGross','amountWithTax','amount_with_tax']));

                if (!Number.isFinite(qty)) qty = null;
                if (!Number.isFinite(price)) price = null;
                if (!Number.isFinite(tax)) tax = null;

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
                if ((!Number.isFinite(qty) || qty === null) && Number.isFinite(price) && price > 0) {
                  if (Number.isFinite(savedNet) && price > 0) {
                    qty = savedNet / price;
                  } else if (Number.isFinite(savedGross) && price > 0) {
                    const denom = Number.isFinite(tax) ? price * (1 + (tax/100)) : price;
                    if (denom > 0) qty = savedGross / denom;
                  }
                }

                qty = Number.isFinite(qty) ? qty : 0;
                price = Number.isFinite(price) ? price : 0;
                tax = Number.isFinite(tax) ? tax : 0;

                const payload = { qty, unit_price: price, tax_rate: tax, unit, description };
                if (it.product_id) payload.product_id = it.product_id;
                addRowV2(payload);
              }
              recalcV2();
              try { console.info('openEditV2 - legacy items imported silently'); } catch (e) {}
            } else {
              // No items found anywhere: show a neutral info message and one empty row for editing
              const modalBody = document.querySelector('#invoiceModalV2 .modal-body');
              if (modalBody && !modalBody.querySelector('.no-items-info')) {
                const info = document.createElement('div');
                info.className = 'alert alert-info no-items-info';
                info.textContent = 'Bu faturaya ait kayıtlı kalem bulunamadı. Yeni satır ekleyerek fatura içeriğini oluşturabilirsiniz.';
                modalBody.prepend(info);
              }
              addRowV2();
            }
          } else {
            addRowV2();
          }
        } catch (e) {
          console.warn('openEditV2 - silent legacy import failed', e);
          addRowV2();
        }
      }
    } catch (e) {
      console.warn('openEditV2 - fallback items fetch failed', e);
      addRowV2();
    }
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
  const trs = Array.from(document.querySelectorAll('#itemsTableV2 tbody tr'));
  for (let idx = 0; idx < trs.length; idx++) {
    const tr = trs[idx];
    const qty = Number(tr.querySelector('.item-qty').value||0);
    const price = Number(tr.querySelector('.item-price').value||0);
    const tax = Number(tr.querySelector('.item-tax').value||0);
    const unit = tr.querySelector('.item-unit').value || 'Adet';
    const description = tr.querySelector('.item-desc').value || '';
    const line = qty*price; const ltax = line*(tax/100);
    sub += line; taxSum += ltax;
    const rawProductId = tr.dataset.productId ? String(tr.dataset.productId) : null;
    // Attempt to resolve canonical product id from PRODUCTS_CACHE_V2 so we preserve the DB-side id type
    let product_id = null;
    if (rawProductId) {
      if (!PRODUCTS_CACHE_V2) await preloadProductsV2();
      const foundInCache = (PRODUCTS_CACHE_V2||[]).find(p => String(p.id) === rawProductId || String(p.code) === rawProductId);
      if (foundInCache) {
        product_id = foundInCache.id;
      } else {
        // fallback: if it's strictly numeric, use Number, otherwise keep as string (may match uuid)
        product_id = /^\d+$/.test(rawProductId) ? Number(rawProductId) : rawProductId;
      }
    }
    items.push({ owner_id: owner, qty, unit_price: price, tax_rate: tax, unit, description, product_id, line_subtotal: line, line_tax: ltax, line_total: line+ltax, sort_order: idx });
  if (product_id && stockMode === 'out' && qty > 0) itemsForStock.push({ product_id, qty, description, rawProductId });
  }
  const payload = { ...payloadBase, subtotal: sub, tax_total: taxSum, total: sub + taxSum };

  // Pre-check stock before saving when mode is 'out'
  let prevItemsForStock = [];
  let netDiffs = [];
  if (stockMode === 'out' && itemsForStock.length) {
    if (id) {
      // For updates, fetch previous items so we can check net requirements (new - old)
      try {
        const { data: prevItems, error: prevErr } = await supabase.from('invoice_items_v2').select('product_id, qty').eq('owner_id', owner).eq('invoice_id', id);
        if (!prevErr && Array.isArray(prevItems)) {
          prevItemsForStock = prevItems.map(p => ({ product_id: p.product_id, qty: Number(p.qty || 0) }));
        }
      } catch (e) {
        console.warn('Could not fetch previous invoice items for stock delta', e);
      }
      // Compute net differences: newQty - prevQty per product id (can be positive or negative)
      const needMap = new Map();
      for (const it of itemsForStock) {
        const key = String(it.product_id);
        needMap.set(key, (needMap.get(key) || 0) + Number(it.qty || 0));
      }
      for (const p of prevItemsForStock) {
        const key = String(p.product_id);
        needMap.set(key, (needMap.get(key) || 0) - Number(p.qty || 0));
      }
      // Build arrays for precheck (only positive needs) and for actual apply (signed diffs)
      const netNeeds = [];
      netDiffs = [];
      for (const [k, v] of needMap.entries()) {
        const num = Number(v || 0);
        if (num > 0) netNeeds.push({ product_id: k, qty: num });
        if (num !== 0) netDiffs.push({ product_id: k, qty: num });
      }
      const ok = await precheckStockV2(netNeeds);
      if (!ok) return; // Abort save; user was alerted
    } else {
      const ok = await precheckStockV2(itemsForStock);
      if (!ok) return; // Abort save; user was alerted
    }
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
      const delRes = await supabase.from('invoice_items_v2').delete().eq('owner_id', owner).eq('invoice_id', id);
      if (delRes.error) console.warn('invoice items delete error', delRes.error);
      const rows = items.map(it => {
        const { /*product_uuid,*/ ...rest } = it;
        // sanitize product_id for DB: invoice_items_v2.product_id is bigint in schema
        if (rest.product_id !== undefined && rest.product_id !== null) {
          if (typeof rest.product_id === 'string') {
            if (/^\d+$/.test(rest.product_id)) rest.product_id = Number(rest.product_id);
            else rest.product_id = null;
          } else if (typeof rest.product_id === 'number') {
            // ok
          } else {
            rest.product_id = null;
          }
        }
        return { ...rest, invoice_id: Number(id) };
      });
      if (rows.length) {
        const ins = await supabase.from('invoice_items_v2').insert(rows);
        if (ins.error) {
          console.error('invoice_items_v2 insert error', ins.error, 'payload sample', rows[0]);
          alert('Kalemler kaydedilemedi: ' + (ins.error.message || JSON.stringify(ins.error)));
        }
      }
      // After replace, adjust stock based on net differences computed earlier
      try {
        if (stockMode === 'out') {
          if (netDiffs && netDiffs.length) {
            console.info('Updating stock for invoice update, netDiffs:', netDiffs);
            const toDecrease = netDiffs.filter(d => Number(d.qty) > 0).map(d => ({ product_id: d.product_id, qty: Number(d.qty) }));
            const toIncrease = netDiffs.filter(d => Number(d.qty) < 0).map(d => ({ product_id: d.product_id, qty: Math.abs(Number(d.qty)) }));
            if (toDecrease.length) await applyStockOutV2(toDecrease);
            if (toIncrease.length) await applyStockRestockV2(toIncrease);
          } else if (itemsForStock && itemsForStock.length) {
            // fallback: if netDiffs not computed, apply full out for new items
            console.info('Updating stock for invoice update (fallback full out), itemsForStock:', itemsForStock);
            await applyStockOutV2(itemsForStock);
          }
        }
      } catch (se) { console.warn('Stock adjustment after update failed:', se?.message||se); }
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
      const rows = items.map(it => {
        const { /*product_uuid,*/ ...rest } = it;
        if (rest.product_id !== undefined && rest.product_id !== null) {
          if (typeof rest.product_id === 'string') {
            if (/^\d+$/.test(rest.product_id)) rest.product_id = Number(rest.product_id);
            else rest.product_id = null;
          } else if (typeof rest.product_id === 'number') {
            // ok
          } else {
            rest.product_id = null;
          }
        }
        return { ...rest, invoice_id: invId };
      });
      if (rows.length) {
        const ins = await supabase.from('invoice_items_v2').insert(rows);
        if (ins.error) {
          console.error('invoice_items_v2 insert error (create path)', ins.error, 'payload sample', rows[0]);
          alert('Kalemler kaydedilemedi: ' + (ins.error.message || JSON.stringify(ins.error)));
        }
      }
      // After create, apply stock out (new invoice)
      try { if (stockMode === 'out' && itemsForStock.length) await applyStockOutV2(itemsForStock); } catch (se) { console.warn('Stock adjustment after create failed:', se?.message||se); }
    }
  }

  if (err) { alert('Kaydetme başarısız: '+err.message); return; }

  // Stock updates are handled in the create/update branches (applyStockOutV2/applyStockRestockV2)

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
  // Try a bulk fetch; PostgREST may coerce types, but fall back to per-id lookups if necessary
  let rows = [];
  try {
    let res = await supabase.from('products').select('id, name, stock').in('id', ids).eq('owner_id', getCurrentUserId());
    if (res.error || !res.data || res.data.length === 0) {
      // try without owner filter
      res = await supabase.from('products').select('id, name, stock').in('id', ids);
    }
    if (!res.error && res.data) rows = res.data;
  } catch (e) {
    console.warn('bulk product lookup failed, will fallback to per-item lookup', e);
  }
  // If bulk lookup returned nothing, try per-id queries (handles mixed types)
  if (!rows || rows.length === 0) {
    rows = [];
    for (const id of ids) {
      try {
        let res = await supabase.from('products').select('id, name, stock').eq('id', id).eq('owner_id', getCurrentUserId()).maybeSingle();
        if (!res || res.error || !res.data) {
          // try numeric coercion
          if (/^\d+$/.test(String(id))) {
            res = await supabase.from('products').select('id, name, stock').eq('id', Number(id)).eq('owner_id', getCurrentUserId()).maybeSingle();
            if (!res || res.error || !res.data) {
              res = await supabase.from('products').select('id, name, stock').eq('id', Number(id)).maybeSingle();
            }
          } else {
            res = await supabase.from('products').select('id, name, stock').eq('id', id).maybeSingle();
          }
        }
        if (res && !res.error && res.data) rows.push(res.data);
      } catch (e) {
        console.warn('per-id product lookup failed for', id, e?.message||e);
      }
    }
  }
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
    const pid = it.product_id;
    if (!pid) continue;
    try {
      // Try finding product by id as-is; if not found try numeric coercion and ownerless fallback
      let res = await supabase.from('products').select('id, stock').eq('id', pid).eq('owner_id', getCurrentUserId()).maybeSingle();
      if ((!res || res.error || !res.data) && /^\d+$/.test(String(pid))) {
        res = await supabase.from('products').select('id, stock').eq('id', Number(pid)).eq('owner_id', getCurrentUserId()).maybeSingle();
      }
      if ((!res || res.error || !res.data)) {
        // final fallback: try without owner filter
        res = await supabase.from('products').select('id, stock').eq('id', pid).maybeSingle();
      }
      let prod = res && res.data ? res.data : null;
      // If not found in DB, try client-side cache lookup (handles cases where id was stored differently)
      if (!prod) {
        try {
          if (!PRODUCTS_CACHE_V2) await preloadProductsV2();
          const cache = PRODUCTS_CACHE_V2 || [];
          const byId = cache.find(p => String(p.id) === String(pid));
          const byCode = cache.find(p => String(p.code) === String(pid));
          if (byId) prod = byId;
          else if (byCode) prod = byCode;
        } catch (e) {
          // ignore cache lookup errors
        }
      }
      // If still not found, and description exists, try resolving by description/name
      if (!prod && it.description) {
        try {
          const resolved = await resolveProductV2(it.description);
          if (resolved) prod = resolved;
        } catch (e) {}
      }
      const current = Number(prod?.stock || 0);
      const qty = Number(it.qty || 0);
      const next = Math.max(0, current - qty);
      console.info('applyStockOutV2 - attempting update', { product_id: pid, prodId: prod?.id, current, qty, next });
      if (!prod || !prod.id) {
        console.warn('applyStockOutV2 - product not found, skipping', pid);
        continue;
      }
      // Use .select to receive updated rows so we can inspect result
      let upd = await supabase.from('products').update({ stock: next }).eq('id', prod.id).eq('owner_id', getCurrentUserId()).select('id,stock');
      if (upd.error) console.warn('applyStockOutV2 update error (with owner filter)', upd.error);
      const updatedRows = Array.isArray(upd.data) ? upd.data.length : 0;
      // If update didn't affect rows, retry without owner filter
      if (updatedRows === 0) {
        const retry = await supabase.from('products').update({ stock: next }).eq('id', prod.id).select('id,stock');
        if (retry.error) console.warn('applyStockOutV2 retry update error (no owner filter)', retry.error);
        else if (Array.isArray(retry.data) && retry.data.length) console.info('applyStockOutV2 retry succeeded for', prod.id);
        else console.warn('applyStockOutV2 retry did not update any rows for', prod.id);
      } else {
        console.info('applyStockOutV2 update affected rows', updatedRows, 'for', prod.id);
      }
    } catch (e) {
      console.warn('Stock update failed for product', it.product_id, e?.message||e);
    }
  }
}

async function applyStockRestockV2(items) {
  // Reverse of applyStockOutV2: increment stock by qty
  for (const it of items) {
    const pid = it.product_id;
    if (!pid) continue;
    try {
      let res = await supabase.from('products').select('id, stock').eq('id', pid).eq('owner_id', getCurrentUserId()).maybeSingle();
      if ((!res || res.error || !res.data) && /^\d+$/.test(String(pid))) {
        res = await supabase.from('products').select('id, stock').eq('id', Number(pid)).eq('owner_id', getCurrentUserId()).maybeSingle();
      }
      if ((!res || res.error || !res.data)) {
        res = await supabase.from('products').select('id, stock').eq('id', pid).maybeSingle();
      }
      let prod = res && res.data ? res.data : null;
      if (!prod) {
        try {
          if (!PRODUCTS_CACHE_V2) await preloadProductsV2();
          const cache = PRODUCTS_CACHE_V2 || [];
          const byId = cache.find(p => String(p.id) === String(pid));
          const byCode = cache.find(p => String(p.code) === String(pid));
          if (byId) prod = byId;
          else if (byCode) prod = byCode;
        } catch (e) {}
      }
      const current = Number(prod?.stock || 0);
      const qty = Number(it.qty || 0);
      const next = Math.max(0, current + qty);
      console.info('applyStockRestockV2 - attempting update', { product_id: pid, prodId: prod?.id, current, qty, next });
      if (!prod || !prod.id) {
        console.warn('applyStockRestockV2 - product not found, skipping', pid);
        continue;
      }
      let upd = await supabase.from('products').update({ stock: next }).eq('id', prod.id).eq('owner_id', getCurrentUserId()).select('id,stock');
      if (upd.error) console.warn('applyStockRestockV2 update error (with owner filter)', upd.error);
      const updatedRows = Array.isArray(upd.data) ? upd.data.length : 0;
      if (updatedRows === 0) {
        const retry = await supabase.from('products').update({ stock: next }).eq('id', prod.id).select('id,stock');
        if (retry.error) console.warn('applyStockRestockV2 retry update error (no owner filter)', retry.error);
        else if (Array.isArray(retry.data) && retry.data.length) console.info('applyStockRestockV2 retry succeeded for', prod.id);
        else console.warn('applyStockRestockV2 retry did not update any rows for', prod.id);
      } else {
        console.info('applyStockRestockV2 update affected rows', updatedRows, 'for', prod.id);
      }
    } catch (e) {
      console.warn('Stock restock failed for product', it.product_id, e?.message||e);
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
