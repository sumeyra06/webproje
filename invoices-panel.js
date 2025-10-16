console.log('invoices-panel.js yüklendi');
import { supabase } from './supabaseClient.js';
const getCurrentUserId = () => {
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
};

// Eski fatura ve stokları hatırlamak için
let ORIG_INV = null;

// Loose numeric parser: accepts numbers or strings with locale/currency; handles comma or dot decimals
function parseNumberLoose(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    let s = v.trim();
    if (!s) return null;
    // Remove all non numeric separators/currency except digits, dot, comma, minus
    s = s.replace(/[^0-9.,\-]/g, '');
    if (!s) return null;
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
      // Determine decimal by last separator
      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      if (lastComma > lastDot) {
        // comma as decimal -> remove all dots (thousands), replace comma with dot
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // dot as decimal -> remove all commas (thousands)
        s = s.replace(/,/g, '');
      }
    } else if (hasComma && !hasDot) {
      // Only comma present -> treat as decimal
      s = s.replace(',', '.');
    } else {
      // Only dot or none: remove stray commas
      s = s.replace(/,/g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function renderInvoicesPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold text-primary">Satış Faturaları</h2>
        <button class="btn btn-success" id="addInvoiceBtn">Yeni Fatura</button>
      </div>
      <div id="invoicesList">Yükleniyor...</div>
    </section>

    <!-- Modal -->
    <div class="modal fade" id="invoiceModal" tabindex="-1" aria-labelledby="invoiceModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <form id="invoiceForm">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title" id="invoiceModalLabel">Yeni Fatura</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Kapat"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Fatura İsmi</label>
                  <input type="text" class="form-control" id="invoiceName">
                </div>
                <div class="col-md-3">
                  <label class="form-label">Fatura No</label>
                  <input type="text" class="form-control" id="invoiceNo" placeholder="Otomatik bırakabilirsiniz">
                </div>
                <div class="col-md-3">
                  <label class="form-label">Kategori</label>
                  <input type="text" class="form-control" id="invoiceCategory" placeholder="Kategori (opsiyonel)">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Müşteri</label>
                  <input list="customersDatalist" class="form-control" id="customerName" placeholder="Kayıtlı bir müşteri seçebilir veya yeni bir müşteri ismi yazabilirsiniz.">
                  <datalist id="customersDatalist"></datalist>
                </div>
                <!-- Global Products datalist for item rows -->
                <datalist id="productsDatalist"></datalist>
                <div class="col-md-6">
                  <label class="form-label">Etiketler</label>
                  <input type="text" class="form-control" id="invoiceTags" placeholder="Virgülle ayırın: etiket1, etiket2">
                </div>

                <div class="col-md-6">
                  <label class="form-label">Tahsilat Durumu</label>
                  <select id="collectionStatus" class="form-select">
                    <option value="pending">TAHSİL EDİLECEK</option>
                    <option value="collected">TAHSİL EDİLDİ</option>
                  </select>
                </div>

                <div class="col-md-3">
                  <label class="form-label">Düzenleme Tarihi</label>
                  <input type="date" class="form-control" id="editDate" value="${new Date().toISOString().slice(0,10)}">
                </div>
                <div class="col-md-3">
                  <label class="form-label">Vade</label>
                  <select id="dueOption" class="form-select">
                    <option value="0">AYNI GÜN</option>
                    <option value="7">7 GÜN</option>
                    <option value="14">14 GÜN</option>
                    <option value="30" selected>30 GÜN</option>
                    <option value="45">45 GÜN</option>
                    <option value="60">60 GÜN</option>
                    <option value="90">90 GÜN</option>
                    <option value="custom">ÖZEL (manuel)</option>
                  </select>
                </div>
                <div class="col-md-3">
                  <label class="form-label">Vade Tarihi</label>
                  <input type="date" class="form-control" id="dueDate" value="${new Date().toISOString().slice(0,10)}">
                </div>
                <div class="col-md-3">
                  <label class="form-label">Döviz</label>
                  <input type="text" class="form-control" id="currency" value="TRY">
                </div>

                <div class="col-12">
                  <label class="form-label mb-1">Stok Takibi</label>
                  <div class="border rounded p-2">
                    <div class="form-check">
                      <input class="form-check-input" type="radio" name="stockTracking" id="stockOutYes" value="out" checked>
                      <label class="form-check-label" for="stockOutYes">STOK ÇIKIŞI YAPILSIN <span class="text-muted small d-block">Stok çıkışı fatura ile yapılır. Daha sonra faturadan irsaliye oluşturulamaz ve faturayla irsaliye eşleştirilemez.</span></label>
                    </div>
                    <div class="form-check mt-2">
                      <input class="form-check-input" type="radio" name="stockTracking" id="stockOutNo" value="noout">
                      <label class="form-check-label" for="stockOutNo">STOK ÇIKIŞI YAPILMASIN <span class="text-muted small d-block">Stok takibi gerektirmeyen hizmet/ürünler için kullanılır. Daha sonra faturayla ilişkili irsaliye oluşturulabilir.</span></label>
                    </div>
                  </div>
                </div>

                <div class="col-12">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">Hizmet / Ürün Satırları</h6>
                    <button type="button" class="btn btn-sm btn-outline-primary" id="addRowBtn">YENİ SATIR EKLE</button>
                  </div>
                  <div class="table-responsive">
                    <table class="table table-sm align-middle" id="itemsTable">
                      <thead>
                        <tr>
                          <th style="width:40%">Hizmet / Ürün <span class="text-muted small">(ürün seçerseniz stoktan düşer)</span></th>
                          <th style="width:10%">Miktar</th>
                          <th style="width:10%">Birim</th>
                          <th style="width:15%">Br. Fiyat</th>
                          <th style="width:10%">Vergi %</th>
                          <th style="width:10%">Toplam</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody></tbody>
                    </table>
                  </div>
                </div>

                <input type="hidden" id="invoiceId">
                <div class="col-md-4 offset-md-8">
                  <div class="d-flex justify-content-between"><div>Ara Toplam</div><div id="subtotalText">0,00</div></div>
                  <div class="d-flex justify-content-between"><div>Toplam KDV</div><div id="taxTotalText">0,00</div></div>
                  <div class="d-flex justify-content-between fw-bold mt-2"><div>GENEL TOPLAM</div><div id="grandTotalText">0,00</div></div>
                </div>

              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">VAZGEÇ</button>
              <button type="submit" class="btn btn-primary" id="invoiceSubmitBtn">KAYDET</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  await loadInvoices();

  // Modal açma
  document.getElementById('addInvoiceBtn').onclick = () => {
    prepareInvoiceForm();
    // Create mode labels
    const lbl = document.getElementById('invoiceModalLabel'); if (lbl) lbl.textContent = 'Yeni Fatura';
    const sbtn = document.getElementById('invoiceSubmitBtn'); if (sbtn) sbtn.textContent = 'KAYDET';
    const modal = new bootstrap.Modal(document.getElementById('invoiceModal'));
    modal.show();
  };

  // form submit
  document.getElementById('invoiceForm').onsubmit = async function(e) {
    e.preventDefault();
    const invoiceId = document.getElementById('invoiceId').value;
    const name = document.getElementById('invoiceName').value.trim();
  let invoice_no = document.getElementById('invoiceNo').value.trim();
  const category = document.getElementById('invoiceCategory').value.trim();
  const tagsRaw = document.getElementById('invoiceTags').value.trim();
    const customer_name = document.getElementById('customerName').value.trim();
    const edit_date = document.getElementById('editDate').value;
    const due_date = document.getElementById('dueDate').value;
    const currency = document.getElementById('currency').value;
    const collection_status = document.getElementById('collectionStatus').value;
  const stock_tracking_mode = document.querySelector('input[name="stockTracking"]:checked')?.value || 'out';
    const items = [];
    let subtotal = 0, tax_total = 0;
    document.querySelectorAll('#itemsTable tbody tr').forEach(row => {
      const productId = row.dataset.productId || null;
      const desc = row.querySelector('.item-desc').value.trim();
      const qtyRaw = row.querySelector('.item-qty').value;
      const priceRaw = row.querySelector('.item-price').value;
      const taxRaw = row.querySelector('.item-tax').value;
      const qty = Number(parseNumberLoose(qtyRaw) ?? 0);
      const price = Number(parseNumberLoose(priceRaw) ?? 0);
      const tax = Number(parseNumberLoose(taxRaw) ?? 0);
      const unit = row.querySelector('.item-unit').value.trim();
      const line = qty * price;
      const lineTax = line * (tax/100);
      subtotal += line;
      tax_total += lineTax;
      const lineTotal = line; // net line total (without tax)
      items.push({ desc, qty, unit, price, tax, lineTotal, product_id: productId });
    });
    const total = subtotal + tax_total;

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    if (!invoice_no) {
      // basit otomatik numara: INV-YYYYMMDD-HHMMSS
      const now = new Date();
      const pad = n => String(n).padStart(2,'0');
      invoice_no = `INV-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }
    const payload = { name, invoice_no, category, tags, stock_tracking_mode, customer_name, edit_date, due_date, currency, collection_status, items, subtotal, tax_total, total };

    // Pre-check stock if tracking enabled and new invoice
    if (!invoiceId && stock_tracking_mode === 'out') {
      const insufficient = await precheckStock(items);
      if (insufficient.length) {
        const msg = 'Stok yetersiz olan ürünler:\n' + insufficient.map(i => `- ${i.name} (stok: ${i.stock}, istenen: ${i.qty})`).join('\n');
        alert(msg);
        return;
      }
    }
    let error = null;
    if (invoiceId) {
      const res = await supabase.from('invoices').update(payload).eq('id', invoiceId).eq('owner_id', getCurrentUserId());
      error = res.error;
      if (!error) {
        try {
          const oldMode = ORIG_INV?.stock_tracking_mode || 'out';
          const oldMap = ORIG_INV?.itemsMap || new Map();
          const newMap = await normalizeItems(items);
          await adjustStockAfterUpdate(oldMap, newMap, oldMode, stock_tracking_mode);
        } catch (e3) { console.warn('Stok fark uygulama hatası', e3); }
      }
    } else {
      const owner_id = getCurrentUserId();
      const res = await supabase.from('invoices').insert([{ ...payload, owner_id }]);
      error = res.error;
      // On new invoice and stock tracking: decrement stocks
      if (!error && stock_tracking_mode === 'out') {
        try { await applyStockOut(items); } catch (e2) { console.warn('applyStockOut hata', e2); }
      }
    }
    if (error) {
      alert('Kayıt eklenemedi: ' + error.message);
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById('invoiceModal')).hide();
    await loadInvoices();
  };

  document.getElementById('addRowBtn').onclick = () => addItemRow();
}

async function loadInvoices() {
  const { data, error } = await supabase.from('invoices').select('*').eq('owner_id', getCurrentUserId()).order('id', { ascending: false }).limit(100);
  const listEl = document.getElementById('invoicesList');
  if (error) {
    listEl.innerHTML = `<div class='alert alert-danger'>Faturalar yüklenemedi: ${error.message}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    listEl.innerHTML = `<div class='alert alert-warning'>Hiç fatura bulunamadı.</div>`;
    return;
  }
  let html = `<div class='list-group'>`;
  for (const inv of data) {
    const total = inv.total ? Number(inv.total).toFixed(2) : '-';
    const badge = inv.collection_status === 'collected'
      ? `<span class='badge bg-success ms-2'>TAHSİL EDİLDİ</span>`
      : `<span class='badge bg-warning text-dark ms-2'>TAHSİL EDİLECEK</span>`;
    const invNo = inv.invoice_no ? `<span class='badge bg-secondary me-2'>${inv.invoice_no}</span>` : '';
    html += `<div class='list-group-item'>
      <div class='d-flex justify-content-between align-items-center flex-wrap gap-2'>
        <div>
          ${invNo}<strong>${inv.name || 'İsimsiz Fatura'}</strong> ${badge}
          <div class='small text-muted mt-1'>${inv.customer_name || ''}</div>
        </div>
        <div class='text-end'>
          <div class='text-muted small'>${inv.edit_date ? new Date(inv.edit_date).toLocaleDateString() : ''}</div>
          <div class='fw-bold'>${inv.currency || ''} ${total}</div>
        </div>
      </div>
      <div class="mt-2 d-flex gap-2 flex-wrap">
        <button class="btn btn-sm btn-outline-primary view-invoice" data-id="${inv.id}">Görüntüle</button>
        <button class="btn btn-sm btn-outline-secondary edit-invoice" data-id="${inv.id}">Düzenle</button>
        <button class="btn btn-sm btn-outline-danger delete-invoice" data-id="${inv.id}">Sil</button>
      </div>
    </div>`;
  }
  html += `</div>`;
  listEl.innerHTML = html;

  document.querySelectorAll('.view-invoice').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.id;
  const { data } = await supabase.from('invoices').select('*').eq('id', id).eq('owner_id', getCurrentUserId()).single();
    showInvoiceDetail(data);
  });

  document.querySelectorAll('.edit-invoice').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.id;
  const { data } = await supabase.from('invoices').select('*').eq('id', id).eq('owner_id', getCurrentUserId()).single();
    await openInvoiceForEdit(data);
  });

  document.querySelectorAll('.delete-invoice').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.id;
    if (!confirm('Bu faturayı silmek istediğinize emin misiniz?')) return;
  const { error } = await supabase.from('invoices').delete().eq('id', id).eq('owner_id', getCurrentUserId());
    if (error) return alert('Silme başarısız: ' + error.message);
    await loadInvoices();
  });
}

function showInvoiceDetail(inv) {
  // items JSON string olabilir: parse et
  let itemsArr = Array.isArray(inv.items) ? inv.items : (typeof inv.items === 'string' ? (()=>{try{return JSON.parse(inv.items)}catch{return []}})() : []);
  let html = `<div class="p-3">`;
  html += `<div class="d-flex justify-content-end mb-2"><button class="btn btn-sm btn-outline-secondary" id="printInvoiceBtn">Yazdır</button></div>`;
  html += `<h5>${inv.name}</h5><div class='small text-muted mb-2'>${inv.customer_name || ''}</div>`;
  html += `<div class='mb-1'><strong>Fatura No:</strong> ${inv.invoice_no || '-'}</div>`;
  if (inv.category) html += `<div class='mb-1'><strong>Kategori:</strong> ${inv.category}</div>`;
  if (Array.isArray(inv.tags) && inv.tags.length) html += `<div class='mb-1'><strong>Etiketler:</strong> ${inv.tags.map(t=>`<span class='badge bg-info text-dark me-1 mb-1'>${t}</span>`).join('')}</div>`;
  html += `<div class='mb-1'><strong>Stok Takibi:</strong> ${inv.stock_tracking_mode==='out'?'Stok Çıkışı':'Çıkış Yok'}</div>`;
  html += `<div>Düzenleme: ${inv.edit_date ? new Date(inv.edit_date).toLocaleDateString() : ''}</div>`;
  html += `<div>Vade: ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : ''}</div>`;
  html += `<hr>`;
  if (Array.isArray(itemsArr)) {
    html += `<table class='table table-sm'><thead><tr><th>Ürün</th><th>Miktar</th><th>Birim</th><th>Birim Fiyat</th><th>KDV</th><th>Toplam</th></tr></thead><tbody>`;
    itemsArr.forEach(it => {
      const qty = Number(it.qty||0); const price = Number(it.price||0); const tax = Number(it.tax||0);
      const line = qty*price; const total = (line + line*(tax/100)).toFixed(2);
      html += `<tr><td>${it.desc||''}</td><td>${qty}</td><td>${it.unit||''}</td><td>${price}</td><td>${tax}%</td><td>${total}</td></tr>`;
    });
    html += `</tbody></table>`;
  }
  html += `<div class='mt-2'><strong>Ara Toplam:</strong> ${inv.subtotal || 0}</div>`;
  html += `<div><strong>Toplam KDV:</strong> ${inv.tax_total || 0}</div>`;
  html += `<div class='fw-bold'><strong>GENEL TOPLAM:</strong> ${inv.total || 0}</div>`;
  html += `</div>`;

  let detailEl = document.getElementById('invoiceDetailModal');
  if (!detailEl) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal fade" id="invoiceDetailModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-secondary text-white">
              <h5 class="modal-title">Fatura Detayı</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="invoiceDetailBody"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrapper);
    detailEl = document.getElementById('invoiceDetailModal');
  }
  document.getElementById('invoiceDetailBody').innerHTML = html;
  const printBtn = document.getElementById('printInvoiceBtn');
  if (printBtn) printBtn.onclick = () => printInvoice({ ...inv, items: itemsArr });
  const modal = new bootstrap.Modal(detailEl);
  modal.show();
}

async function openInvoiceForEdit(inv) {
  prepareInvoiceForm();
  // Edit mode labels
  const lbl = document.getElementById('invoiceModalLabel'); if (lbl) lbl.textContent = 'Fatura Düzenle';
  const sbtn = document.getElementById('invoiceSubmitBtn'); if (sbtn) sbtn.textContent = 'GÜNCELLE';
  document.getElementById('invoiceId').value = inv.id;
  document.getElementById('invoiceName').value = inv.name || '';
  document.getElementById('invoiceNo').value = inv.invoice_no || '';
  document.getElementById('invoiceCategory').value = inv.category || '';
  document.getElementById('invoiceTags').value = Array.isArray(inv.tags)?inv.tags.join(', '):'';
  document.getElementById('customerName').value = inv.customer_name || '';
  document.getElementById('editDate').value = inv.edit_date ? inv.edit_date.slice(0,10) : new Date().toISOString().slice(0,10);
  document.getElementById('dueDate').value = inv.due_date ? inv.due_date.slice(0,10) : document.getElementById('dueDate').value;
  document.getElementById('currency').value = inv.currency || 'TRY';
  document.getElementById('collectionStatus').value = inv.collection_status || 'pending';
  if (inv.stock_tracking_mode === 'noout') document.getElementById('stockOutNo').checked = true; else document.getElementById('stockOutYes').checked = true;
  // Vade seçimini mevcut tarihlere göre belirle (preset yoksa custom)
  try {
    const dueOption = document.getElementById('dueOption');
    const editDateInput = document.getElementById('editDate');
    const dueDateInput = document.getElementById('dueDate');
    const PRESET_TERMS = [0,7,14,30,45,60,90];
    const d1 = new Date(editDateInput.value);
    const d2 = new Date(dueDateInput.value);
    const diff = Math.round((d2.setHours(0,0,0,0) - d1.setHours(0,0,0,0)) / 86400000);
    if (PRESET_TERMS.includes(diff)) {
      dueOption.value = String(diff);
      dueDateInput.readOnly = true;
      dueDateInput.classList.add('bg-light');
    } else {
      dueOption.value = 'custom';
      dueDateInput.readOnly = false;
      dueDateInput.classList.remove('bg-light');
    }
  } catch {}
  // populate items (items JSON string olabilir)
  const tbody = document.querySelector('#itemsTable tbody');
  tbody.innerHTML = '';
  const parsedItems = Array.isArray(inv.items) ? inv.items : (typeof inv.items === 'string' ? (()=>{try{return JSON.parse(inv.items)}catch{return []}})() : []);
  if (Array.isArray(parsedItems)) {
    if (!PRODUCTS_CACHE) await preloadProducts();
    inv.items = parsedItems; // normalize
    parsedItems.forEach(it => {
      const tr = document.createElement('tr');
      // Backfill from product if missing
      let descVal = it.desc || '';
      let unitVal = it.unit || 'Adet';
      let qtyVal = parseNumberLoose(it.qty);
      let priceVal = parseNumberLoose(it.price);
      let taxVal = parseNumberLoose(it.tax);
      if (!Number.isFinite(qtyVal)) qtyVal = 0;
      if (!Number.isFinite(priceVal)) {
        const lt = parseNumberLoose(it.lineTotal);
        const q = Number.isFinite(qtyVal) ? qtyVal : parseNumberLoose(it.qty);
        const qSafe = Number.isFinite(q) ? q : 0;
        if (Number.isFinite(lt) && qSafe > 0) {
          priceVal = lt / qSafe;
        }
      }
      if (it.product_id && PRODUCTS_CACHE) {
        const p = PRODUCTS_CACHE.find(x => x.id === it.product_id);
        if (p) {
          if (!descVal) descVal = p.name + (p.code?` (${p.code})`:'');
          if (!it.unit && p.unit) unitVal = p.unit;
          if (!Number.isFinite(priceVal) && p.sale_price != null) priceVal = parseNumberLoose(p.sale_price);
          if (!Number.isFinite(taxVal) && p.vat_rate != null) taxVal = parseNumberLoose(p.vat_rate);
        }
      }
      const priceNum = Number.isFinite(priceVal) ? priceVal : 0;
      const taxNum = Number.isFinite(taxVal) ? taxVal : 0;
      tr.innerHTML = `
        <td><input list="productsDatalist" class="form-control form-control-sm item-desc" value="${(descVal)}"></td>
        <td><input class="form-control form-control-sm item-qty" type="number" min="0" step="0.01" value="${Number.isFinite(qtyVal)?qtyVal:0}"></td>
        <td><input class="form-control form-control-sm item-unit" value="${(unitVal)}"></td>
        <td><input class="form-control form-control-sm item-price" type="number" min="0" step="0.01" value="${priceNum.toFixed(2)}"></td>
        <td><input class="form-control form-control-sm item-tax" type="number" min="0" step="0.01" value="${taxNum}"></td>
        <td class="text-end align-middle"><span class="line-total">0.00</span></td>
        <td><button type="button" class="btn btn-sm btn-outline-danger remove-row">Sil</button></td>
      `;
      if (it.product_id) tr.dataset.productId = it.product_id;
      tbody.appendChild(tr);

      // Attach listeners like addItemRow
      tr.querySelectorAll('.item-qty, .item-price, .item-tax').forEach(inp => inp.addEventListener('input', recalcTotals));
      tr.querySelector('.remove-row').onclick = () => { tr.remove(); recalcTotals(); };
      const descInput = tr.querySelector('.item-desc');
      descInput.addEventListener('change', async () => {
        const match = await resolveProduct(descInput.value);
        if (match) {
          tr.dataset.productId = match.id;
          if (match.unit) tr.querySelector('.item-unit').value = match.unit;
          if (match.sale_price != null) {
            const n = parseNumberLoose(match.sale_price);
            tr.querySelector('.item-price').value = Number.isFinite(n) ? n.toFixed(2) : tr.querySelector('.item-price').value;
          }
          if (match.vat_rate != null) {
            const n = parseNumberLoose(match.vat_rate);
            tr.querySelector('.item-tax').value = Number.isFinite(n) ? n : tr.querySelector('.item-tax').value;
          }
          recalcTotals();
        } else {
          delete tr.dataset.productId;
        }
      });
    });
  }
  addItemRow();
  recalcTotals();
  const modal = new bootstrap.Modal(document.getElementById('invoiceModal'));
  modal.show();

  // Eski fatura kalem haritası (stok için)
  try {
    ORIG_INV = {
      stock_tracking_mode: inv.stock_tracking_mode || 'out',
      itemsMap: await normalizeItems(parsedItems || [])
    };
  } catch (e) {
    ORIG_INV = { stock_tracking_mode: inv.stock_tracking_mode || 'out', itemsMap: new Map() };
  }
}

// helper functions
async function prepareInvoiceForm() {
  const form = document.getElementById('invoiceForm');
  form.reset();
  document.getElementById('invoiceId').value = '';
  // varsayılan stok tracking radio
  if (document.getElementById('stockOutYes')) document.getElementById('stockOutYes').checked = true;
  // populate customers datalist
  const { data: customers } = await supabase.from('customers').select('id,company_title,short_name').eq('owner_id', getCurrentUserId());
  const dl = document.getElementById('customersDatalist');
  dl.innerHTML = '';
  if (customers) {
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.company_title || c.short_name || '';
      dl.appendChild(opt);
    });
  }
  // populate products datalist
  await preloadProducts();
  // Vade (due) hesaplama ve kontrol
  const editDateInput = document.getElementById('editDate');
  const dueOption = document.getElementById('dueOption');
  const dueDateInput = document.getElementById('dueDate');
  function setDueReadOnly(lock) {
    try {
      dueDateInput.readOnly = !!lock;
      if (lock) dueDateInput.classList.add('bg-light'); else dueDateInput.classList.remove('bg-light');
    } catch {}
  }
  function updateDue() {
    if (dueOption.value === 'custom') { setDueReadOnly(false); return; }
    const ed = new Date(editDateInput.value);
    const days = parseInt(dueOption.value, 10) || 0;
    if (!isNaN(ed.getTime())) {
      ed.setDate(ed.getDate() + days);
      dueDateInput.value = ed.toISOString().slice(0,10);
    }
    setDueReadOnly(true);
  }
  // Varsayılan 30 gün
  if (dueOption) dueOption.value = '30';
  updateDue();
  editDateInput.onchange = () => { if (dueOption.value !== 'custom') updateDue(); };
  dueOption.onchange = updateDue;
  // Kullanıcı dueDate'i elle değiştirirse otomatik 'custom'a geç
  dueDateInput.onchange = () => { if (dueOption.value !== 'custom') { dueOption.value = 'custom'; setDueReadOnly(false); } };

  // items table: ensure one empty row
  const tbody = document.querySelector('#itemsTable tbody');
  tbody.innerHTML = '';
  addItemRow();
}

function addItemRow() {
  const tbody = document.querySelector('#itemsTable tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <input list="productsDatalist" class="form-control form-control-sm item-desc" placeholder="Hizmet / Ürün adı veya kodu">
      <div class="form-text small">Ürün seçerseniz stoktan düşer; hizmet için boş bırakın.</div>
    </td>
    <td><input class="form-control form-control-sm item-qty" type="number" min="0" step="0.01" value="1"></td>
    <td><input class="form-control form-control-sm item-unit" value="Adet"></td>
    <td><input class="form-control form-control-sm item-price" type="number" min="0" step="0.01" value="0.00"></td>
    <td><input class="form-control form-control-sm item-tax" type="number" min="0" step="0.01" value="0"></td>
    <td class="text-end align-middle"><span class="line-total">0.00</span></td>
    <td><button type="button" class="btn btn-sm btn-outline-danger remove-row">Sil</button></td>
  `;
  tbody.appendChild(tr);
  tr.querySelectorAll('.item-qty, .item-price, .item-tax').forEach(inp => inp.addEventListener('input', recalcTotals));
  tr.querySelector('.remove-row').onclick = () => { tr.remove(); recalcTotals(); };
  // Bind product selection resolution
  const descInput = tr.querySelector('.item-desc');
  descInput.addEventListener('change', async () => {
    const match = await resolveProduct(descInput.value);
    if (match) {
      tr.dataset.productId = match.id;
      // Autofill unit/price/tax if available
      if (match.unit) tr.querySelector('.item-unit').value = match.unit;
      if (match.sale_price != null) tr.querySelector('.item-price').value = Number(match.sale_price).toFixed(2);
      if (match.vat_rate != null) tr.querySelector('.item-tax').value = Number(match.vat_rate).toFixed(2);
      recalcTotals();
    } else {
      delete tr.dataset.productId;
    }
  });
  recalcTotals();
}

function recalcTotals() {
  let subtotal = 0;
  let taxTotal = 0;
  document.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
    const qty = Number(parseNumberLoose(tr.querySelector('.item-qty').value) ?? 0);
    const price = Number(parseNumberLoose(tr.querySelector('.item-price').value) ?? 0);
    const tax = Number(parseNumberLoose(tr.querySelector('.item-tax').value) ?? 0);
    const line = qty * price;
    const lineTax = line * (tax/100);
    subtotal += line;
    taxTotal += lineTax;
    tr.querySelector('.line-total').textContent = (line + lineTax).toFixed(2);
  });
  const grand = subtotal + taxTotal;
  document.getElementById('subtotalText').textContent = subtotal.toFixed(2);
  document.getElementById('taxTotalText').textContent = taxTotal.toFixed(2);
  document.getElementById('grandTotalText').textContent = grand.toFixed(2);
}

export { renderInvoicesPanel };

// Helpers: products cache and stock operations
let PRODUCTS_CACHE = null;
async function preloadProducts() {
  try {
    const owner = getCurrentUserId();
    const { data, error } = await supabase.from('products').select('id,name,code,unit,sale_price,vat_rate,stock,stock_tracking').eq('owner_id', owner).limit(2000);
    if (error) return;
    PRODUCTS_CACHE = data || [];
    const dl = document.getElementById('productsDatalist');
    if (dl) {
      dl.innerHTML = '';
      PRODUCTS_CACHE.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name + (p.code ? ` (${p.code})` : '');
        dl.appendChild(opt);
      });
    }
  } catch {}
}

async function resolveProduct(input) {
  if (!input) return null;
  if (!PRODUCTS_CACHE) await preloadProducts();
  const s = input.trim().toLowerCase();
  const list = (PRODUCTS_CACHE||[]);
  // Exact code match first
  let match = list.find(p => (p.code||'').toLowerCase() === s);
  if (match) return match;
  // Exact name or "name (code)"
  match = list.find(p => (p.name||'').toLowerCase() === s || (p.name + (p.code?` (${p.code})`:'')).toLowerCase() === s);
  if (match) return match;
  // Unique partial match by code or name
  const partial = list.filter(p => (p.code||'').toLowerCase().includes(s) || (p.name||'').toLowerCase().includes(s));
  if (partial.length === 1) return partial[0];
  return null;
}

async function precheckStock(items) {
  if (!PRODUCTS_CACHE) await preloadProducts();
  const problems = [];
  for (const it of items) {
    if (!it.product_id) continue; // hizmet satırı
    const p = (PRODUCTS_CACHE||[]).find(x => x.id === it.product_id);
    if (!p) continue;
    if (p.stock_tracking === false) continue;
    const stock = Number(p.stock||0);
    const qty = Number(it.qty||0);
    if (qty > stock) problems.push({ id: p.id, name: p.name, stock, qty });
  }
  return problems;
}

async function applyStockOut(items) {
  // Basit yaklaşım: products.stock değerini düş
  for (const it of items) {
    if (!it.product_id) continue;
    const qty = Number(it.qty||0);
    if (qty <= 0) continue;
    // Aynı anda yarış koşullarını önlemek için tek tek güncelle
    const { error } = await supabase.rpc('decrement_product_stock', { p_id: it.product_id, p_qty: qty });
    if (error) {
      const msg = (error.message||'').toLowerCase();
      const looksLikeMissingRpc = msg.includes('could not find the function') || msg.includes('schema cache') || msg.includes('function') && msg.includes('not found');
      if (looksLikeMissingRpc) {
        // Fallback: direkt ürün stok güncelleme (geçici, yarışı korumaz)
        try {
          const ownerId = getCurrentUserId();
          const { data: prod, error: selErr } = await supabase.from('products').select('stock, stock_tracking').eq('id', it.product_id).eq('owner_id', ownerId).single();
          if (selErr) throw selErr;
          if (prod && prod.stock_tracking === false) continue;
          const current = Number(prod?.stock||0);
          const next = Math.max(current - qty, 0);
          const { error: updErr } = await supabase.from('products').update({ stock: next }).eq('id', it.product_id).eq('owner_id', ownerId);
          if (updErr) throw updErr;
          continue;
        } catch (fallbackErr) {
          alert('Stok düşürme başarısız (fallback da başarısız): ' + (fallbackErr.message||fallbackErr) + '\nÜrün ID: ' + it.product_id + ' Miktar: ' + qty);
          throw fallbackErr;
        }
      } else {
        alert('Stok düşürme başarısız: ' + error.message + '\nÜrün ID: ' + it.product_id + ' Miktar: ' + qty);
        throw error;
      }
    }
  }
}

// --- Update senaryosu için yardımcılar ---
async function normalizeItems(items) {
  if (!items) return new Map();
  if (!PRODUCTS_CACHE) await preloadProducts();
  const map = new Map();
  for (const it of items) {
    let pid = it.product_id || null;
    if (!pid && it.desc) {
      try {
        const match = await resolveProduct(it.desc);
        if (match) pid = match.id;
      } catch {}
    }
    const qty = Number(it.qty || 0);
    if (pid && qty > 0) {
      map.set(pid, (map.get(pid) || 0) + qty);
    }
  }
  return map;
}

async function adjustStockAfterUpdate(oldMap, newMap, oldMode, newMode) {
  const toDecrement = new Map();
  const toIncrement = new Map();
  const all = new Set([...(oldMap?.keys?.()||[]), ...(newMap?.keys?.()||[])]);

  function addTo(map, key, val) { map.set(key, (map.get(key)||0) + val); }

  if (oldMode === 'out' && newMode === 'out') {
    for (const pid of all) {
      const oldQ = Number(oldMap.get(pid) || 0);
      const newQ = Number(newMap.get(pid) || 0);
      const diff = newQ - oldQ;
      if (diff > 0) addTo(toDecrement, pid, diff);
      else if (diff < 0) addTo(toIncrement, pid, -diff);
    }
  } else if (oldMode !== 'out' && newMode === 'out') {
    // İlk kez stok çıkışı uygulanıyor: tüm yeni miktarlar düş
    for (const [pid, qty] of newMap.entries()) addTo(toDecrement, pid, qty);
  } else if (oldMode === 'out' && newMode !== 'out') {
    // Artık stok çıkışı yapılmayacak: eski miktarları geri ekle
    for (const [pid, qty] of oldMap.entries()) addTo(toIncrement, pid, qty);
  } else {
    // her ikisi de noout: stok değişmez
    return;
  }

  // Uygula: önce increment, sonra decrement
  for (const [pid, qty] of toIncrement.entries()) {
    await incrementStockFor(pid, qty);
  }
  for (const [pid, qty] of toDecrement.entries()) {
    await decrementStockFor(pid, qty);
  }
}

async function decrementStockFor(productId, qty) {
  if (!productId || qty <= 0) return;
  const { error } = await supabase.rpc('decrement_product_stock', { p_id: productId, p_qty: qty });
  if (error) {
    const msg = (error.message||'').toLowerCase();
    const looksLikeMissingRpc = msg.includes('could not find the function') || msg.includes('schema cache') || msg.includes('function') && msg.includes('not found');
    if (looksLikeMissingRpc) {
      try {
        const ownerId = getCurrentUserId();
        const { data: prod, error: selErr } = await supabase.from('products').select('stock, stock_tracking').eq('id', productId).eq('owner_id', ownerId).single();
        if (selErr) throw selErr;
        if (prod && prod.stock_tracking === false) return;
        const current = Number(prod?.stock||0);
        const next = Math.max(current - qty, 0);
        const { error: updErr } = await supabase.from('products').update({ stock: next }).eq('id', productId).eq('owner_id', ownerId);
        if (updErr) throw updErr;
      } catch (fallbackErr) {
        alert('Stok düşürme başarısız (update/fallback): ' + (fallbackErr.message||fallbackErr));
        throw fallbackErr;
      }
    } else {
      alert('Stok düşürme başarısız (update): ' + error.message);
      throw error;
    }
  }
}

async function incrementStockFor(productId, qty) {
  if (!productId || qty <= 0) return;
  const { error } = await supabase.rpc('increment_product_stock', { p_id: productId, p_qty: qty });
  if (error) {
    const msg = (error.message||'').toLowerCase();
    const looksLikeMissingRpc = msg.includes('could not find the function') || msg.includes('schema cache') || msg.includes('function') && msg.includes('not found');
    if (looksLikeMissingRpc) {
      try {
        const ownerId = getCurrentUserId();
        const { data: prod, error: selErr } = await supabase.from('products').select('stock, stock_tracking').eq('id', productId).eq('owner_id', ownerId).single();
        if (selErr) throw selErr;
        if (prod && prod.stock_tracking === false) return;
        const current = Number(prod?.stock||0);
        const next = current + qty;
        const { error: updErr } = await supabase.from('products').update({ stock: next }).eq('id', productId).eq('owner_id', ownerId);
        if (updErr) throw updErr;
      } catch (fallbackErr) {
        alert('Stok iade (increment) başarısız (update/fallback): ' + (fallbackErr.message||fallbackErr));
        throw fallbackErr;
      }
    } else {
      alert('Stok iade (increment) başarısız (update): ' + error.message);
      throw error;
    }
  }
}

// Yazdırma
function printInvoice(inv) {
  const w = window.open('', '_blank');
  if (!w) return;
  const styles = `
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      h2 { margin: 0 0 8px; }
      .muted { color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
      th { background: #f3f3f3; text-align: left; }
      .totals { margin-top: 12px; width: 40%; margin-left: auto; }
      .totals div { display:flex; justify-content: space-between; padding: 4px 0; }
    </style>`;
  const rows = Array.isArray(inv.items)?inv.items.map(it => `
    <tr>
      <td>${it.desc||''}</td>
      <td>${it.qty||0}</td>
      <td>${it.unit||''}</td>
      <td>${it.price||0}</td>
      <td>${it.tax||0}%</td>
      <td>${((it.qty||0)*(it.price||0) * (1 + (it.tax||0)/100)).toFixed(2)}</td>
    </tr>`).join('') : '';
  const html = `
    <html><head><title>Fatura Yazdır</title>${styles}</head><body>
      <h2>${inv.name||'Fatura'}</h2>
      <div class="muted">${inv.customer_name||''}</div>
      <div><strong>Fatura No:</strong> ${inv.invoice_no||'-'}</div>
      <div><strong>Düzenleme:</strong> ${inv.edit_date ? new Date(inv.edit_date).toLocaleDateString() : ''}</div>
      <div><strong>Vade:</strong> ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : ''}</div>
      <div><strong>Stok Takibi:</strong> ${inv.stock_tracking_mode==='out'?'Stok Çıkışı':'Çıkış Yok'}</div>
      <table>
        <thead><tr><th>Ürün</th><th>Miktar</th><th>Birim</th><th>Br. Fiyat</th><th>KDV</th><th>Toplam</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <div><span>Ara Toplam</span><span>${inv.subtotal||0}</span></div>
        <div><span>Toplam KDV</span><span>${inv.tax_total||0}</span></div>
        <div style="font-weight:bold; border-top:1px solid #ddd; margin-top:6px; padding-top:6px;">
          <span>GENEL TOPLAM</span><span>${inv.total||0}</span>
        </div>
      </div>
    </body></html>`;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
