console.log('offers-panel.js yüklendi');
// offers-panel.js
// Teklifler Paneli (Kayıt ekleme dahil)
import { supabase } from './supabaseClient.js';
const getCurrentUserId = () => {
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
};

async function renderOffersPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold text-primary">Teklifler</h2>
        <button class="btn btn-success" id="addOfferBtn">Yeni Teklif</button>
      </div>
      <div id="offersList">Yükleniyor...</div>
    </section>
    <!-- Modal -->
    <div class="modal fade" id="offerModal" tabindex="-1" aria-labelledby="offerModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <form id="offerForm">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title" id="offerModalLabel">Yeni Teklif</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Kapat"></button>
            </div>
            <div class="modal-body">
              <div class="row gy-3">
                <div class="col-md-6">
                  <label for="offerName" class="form-label">Teklif İsmi</label>
                  <input type="text" class="form-control" id="offerName" required>
                </div>
                <div class="col-md-6">
                  <label for="customerName" class="form-label">Müşteri</label>
                  <input list="customersDatalist" class="form-control" id="customerName" placeholder="Kayıtlı bir müşteri seçin veya yeni isim yazın">
                  <datalist id="customersDatalist"></datalist>
                </div>
                <div class="col-md-4">
                  <label for="editDate" class="form-label">Düzenleme Tarihi</label>
                  <input type="date" class="form-control" id="editDate" value="${new Date().toISOString().slice(0,10)}">
                </div>
                <div class="col-md-4">
                  <label for="dueOption" class="form-label">Vade</label>
                  <select id="dueOption" class="form-select">
                    <option value="0">AYNI GÜN</option>
                    <option value="7">7 GÜN</option>
                    <option value="14">14 GÜN</option>
                    <option value="30">30 GÜN</option>
                    <option value="60">60 GÜN</option>
                  </select>
                </div>
                <div class="col-md-4">
                  <label for="dueDate" class="form-label">Vade Tarihi</label>
                  <input type="date" class="form-control" id="dueDate" value="${new Date().toISOString().slice(0,10)}">
                </div>
                <div class="col-md-4">
                  <label for="currency" class="form-label">Döviz</label>
                  <input type="text" class="form-control" id="currency" value="TRY">
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
                          <th style="width:40%">Hizmet / Ürün</th>
                          <th style="width:10%">Miktar</th>
                          <th style="width:10%">Birim</th>
                          <th style="width:15%">Br. Fiyat</th>
                          <th style="width:10%">Vergi %</th>
                          <th style="width:15%">Toplam</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody></tbody>
                    </table>
                  </div>
                </div>
                <input type="hidden" id="offerId">
                <div class="col-12">
                  <label class="form-label">Teklif Koşulları</label>
                  <textarea id="terms" class="form-control" rows="3" placeholder="Ödeme şartları, geçerlilik süresi vb."></textarea>
                </div>
                <div class="col-md-4 offset-md-8">
                  <div class="d-flex justify-content-between"><div>Ara Toplam</div><div id="subtotalText">0,00</div></div>
                  <div class="d-flex justify-content-between"><div>Toplam KDV</div><div id="taxTotalText">0,00</div></div>
                  <div class="d-flex justify-content-between fw-bold mt-2"><div>GENEL TOPLAM</div><div id="grandTotalText">0,00</div></div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">VAZGEÇ</button>
              <button type="submit" class="btn btn-primary">KAYDET</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  await loadOffers();
  // Modal açma
  document.getElementById('addOfferBtn').onclick = () => {
    prepareOfferForm();
    const modal = new bootstrap.Modal(document.getElementById('offerModal'));
    modal.show();
  };
  // Kayıt ekleme
  document.getElementById('offerForm').onsubmit = async function(e) {
    e.preventDefault();
    const offerId = document.getElementById('offerId').value;
    const name = document.getElementById('offerName').value.trim();
    const customer_name = document.getElementById('customerName').value.trim();
    const edit_date = document.getElementById('editDate').value;
    const due_date = document.getElementById('dueDate').value;
    const currency = document.getElementById('currency') ? document.getElementById('currency').value : 'TRY';
    const terms = document.getElementById('terms').value;
    // collect items
    const items = [];
    document.querySelectorAll('#itemsTable tbody tr').forEach(row => {
      const desc = row.querySelector('.item-desc').value.trim();
      const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
      const unit = row.querySelector('.item-unit').value.trim();
      const price = parseFloat(row.querySelector('.item-price').value) || 0;
      const tax = parseFloat(row.querySelector('.item-tax').value) || 0;
      const lineTotal = qty * price;
      items.push({ desc, qty, unit, price, tax, lineTotal });
    });
    const subtotal = parseFloat(document.getElementById('subtotalText').textContent.replace(/,/g,'')) || 0;
    const taxTotal = parseFloat(document.getElementById('taxTotalText').textContent.replace(/,/g,'')) || 0;
    const grandTotal = parseFloat(document.getElementById('grandTotalText').textContent.replace(/,/g,'')) || 0;

    const payload = {
      name,
      customer_name,
      edit_date,
      due_date,
      currency,
      terms,
      items,
      subtotal,
      tax_total: taxTotal,
      total: grandTotal
    };
    let error = null;
    if (offerId) {
      const res = await supabase.from('offers').update(payload).eq('id', offerId).eq('owner_id', getCurrentUserId());
      error = res.error;
    } else {
      const owner_id = getCurrentUserId();
      const res = await supabase.from('offers').insert([{ ...payload, owner_id }]);
      error = res.error;
    }
    if (error) {
      alert('Kayıt eklenemedi: ' + error.message);
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById('offerModal')).hide();
    await loadOffers();
  };
}

async function loadOffers() {
  const { data, error } = await supabase.from('offers').select('*').eq('owner_id', getCurrentUserId()).order('id', { ascending: false }).limit(50);
  const offersList = document.getElementById('offersList');
  if (error) {
    offersList.innerHTML = `<div class='alert alert-danger'>Teklifler yüklenemedi: ${error.message}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    offersList.innerHTML = `<div class='alert alert-warning'>Hiç teklif bulunamadı.</div>`;
    return;
  }
  let html = `<div class='list-group'>`;
  for (const offer of data) {
    const subtotal = offer.subtotal ? Number(offer.subtotal).toFixed(2) : '-';
    const total = offer.total ? Number(offer.total).toFixed(2) : '-';
    html += `<div class='list-group-item'>
      <div class='d-flex justify-content-between align-items-center'>
        <div>
          <strong>${offer.name || 'İsimsiz Teklif'}</strong>
          <div class='small text-muted'>${offer.customer_name || ''}</div>
        </div>
        <div class='text-end'>
          <div class='text-muted small'>${offer.edit_date ? new Date(offer.edit_date).toLocaleDateString() : ''}</div>
          <div class='fw-bold'>${offer.currency || ''} ${total}</div>
        </div>
      </div>
      <div class="mt-2 d-flex gap-2">
        <button class="btn btn-sm btn-outline-primary view-offer" data-id="${offer.id}">Görüntüle</button>
        <button class="btn btn-sm btn-outline-secondary edit-offer" data-id="${offer.id}">Düzenle</button>
        <button class="btn btn-sm btn-outline-danger delete-offer" data-id="${offer.id}">Sil</button>
      </div>
    </div>`;
  }
  html += `</div>`;
  offersList.innerHTML = html;
  // attach actions
  document.querySelectorAll('.view-offer').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.id;
  const { data } = await supabase.from('offers').select('*').eq('id', id).eq('owner_id', getCurrentUserId()).single();
    showOfferDetail(data);
  });
  document.querySelectorAll('.edit-offer').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.id;
  const { data } = await supabase.from('offers').select('*').eq('id', id).eq('owner_id', getCurrentUserId()).single();
    openOfferForEdit(data);
  });
  document.querySelectorAll('.delete-offer').forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.id;
    if (!confirm('Bu teklifi silmek istediğinize emin misiniz?')) return;
  const { error } = await supabase.from('offers').delete().eq('id', id).eq('owner_id', getCurrentUserId());
    if (error) return alert('Silme başarısız: ' + error.message);
    await loadOffers();
  });
}

// view detail modal
function showOfferDetail(offer) {
  let html = `<div class="p-3">`;
  html += `<h5>${offer.name}</h5><div class='small text-muted mb-2'>${offer.customer_name || ''}</div>`;
  html += `<div>Düzenleme: ${offer.edit_date ? new Date(offer.edit_date).toLocaleDateString() : ''}</div>`;
  html += `<div>Vade: ${offer.due_date ? new Date(offer.due_date).toLocaleDateString() : ''}</div>`;
  html += `<hr>`;
  if (Array.isArray(offer.items)) {
    html += `<table class='table table-sm'><thead><tr><th>Ürün</th><th>Miktar</th><th>Birim</th><th>Birim Fiyat</th><th>KDV</th><th>Toplam</th></tr></thead><tbody>`;
    offer.items.forEach(it => html += `<tr><td>${it.desc}</td><td>${it.qty}</td><td>${it.unit}</td><td>${it.price}</td><td>${it.tax}%</td><td>${(it.lineTotal+(it.lineTotal*(it.tax/100))).toFixed(2)}</td></tr>`);
    html += `</tbody></table>`;
  }
  html += `<div class='mt-2'><strong>Ara Toplam:</strong> ${offer.subtotal || 0}</div>`;
  html += `<div><strong>Toplam KDV:</strong> ${offer.tax_total || 0}</div>`;
  html += `<div class='fw-bold'><strong>GENEL TOPLAM:</strong> ${offer.total || 0}</div>`;
  html += `</div>`;
  // create/show bootstrap modal
  let detailEl = document.getElementById('offerDetailModal');
  if (!detailEl) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal fade" id="offerDetailModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header bg-secondary text-white">
              <h5 class="modal-title">Teklif Detayı</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" id="offerDetailBody"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrapper);
    detailEl = document.getElementById('offerDetailModal');
  }
  document.getElementById('offerDetailBody').innerHTML = html;
  const modal = new bootstrap.Modal(detailEl);
  modal.show();
}

function openOfferForEdit(offer) {
  prepareOfferForm();
  document.getElementById('offerId').value = offer.id;
  document.getElementById('offerName').value = offer.name || '';
  document.getElementById('customerName').value = offer.customer_name || '';
  document.getElementById('editDate').value = offer.edit_date ? offer.edit_date.slice(0,10) : new Date().toISOString().slice(0,10);
  document.getElementById('dueDate').value = offer.due_date ? offer.due_date.slice(0,10) : document.getElementById('dueDate').value;
  document.getElementById('currency').value = offer.currency || 'TRY';
  document.getElementById('terms').value = offer.terms || '';
  // populate items
  const tbody = document.querySelector('#itemsTable tbody');
  tbody.innerHTML = '';
  if (Array.isArray(offer.items)) {
    offer.items.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input class="form-control form-control-sm item-desc" value="${(it.desc||'')}"></td>
        <td><input class="form-control form-control-sm item-qty" type="number" min="0" step="0.01" value="${it.qty||0}"></td>
        <td><input class="form-control form-control-sm item-unit" value="${(it.unit||'Adet')}"></td>
        <td><input class="form-control form-control-sm item-price" type="number" min="0" step="0.01" value="${it.price||0}"></td>
        <td><input class="form-control form-control-sm item-tax" type="number" min="0" step="0.01" value="${it.tax||0}"></td>
        <td class="text-end align-middle"><span class="line-total">0.00</span></td>
        <td><button type="button" class="btn btn-sm btn-outline-danger remove-row">Sil</button></td>
      `;
      tbody.appendChild(tr);
      tr.querySelectorAll('.item-qty, .item-price, .item-tax').forEach(inp => inp.addEventListener('input', recalcTotals));
      tr.querySelector('.remove-row').onclick = () => { tr.remove(); recalcTotals(); };
    });
  }
  addItemRow();
  recalcTotals();
  const modal = new bootstrap.Modal(document.getElementById('offerModal'));
  modal.show();
}

// --- helper functions for offer modal ---
async function prepareOfferForm() {
  // reset form
  const form = document.getElementById('offerForm');
  form.reset();
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
  // due date calculation
  const editDateInput = document.getElementById('editDate');
  const dueOption = document.getElementById('dueOption');
  function updateDue() {
    const ed = new Date(editDateInput.value);
    const days = parseInt(dueOption.value, 10) || 0;
    ed.setDate(ed.getDate() + days);
    document.getElementById('dueDate').value = ed.toISOString().slice(0,10);
  }
  editDateInput.onchange = updateDue;
  dueOption.onchange = updateDue;
  updateDue();

  // items table: ensure one empty row
  const tbody = document.querySelector('#itemsTable tbody');
  tbody.innerHTML = '';
  addItemRow();
  // row events
  document.getElementById('addRowBtn').onclick = () => addItemRow();
}

function addItemRow() {
  const tbody = document.querySelector('#itemsTable tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="form-control form-control-sm item-desc" placeholder="Hizmet / Ürün adı"></td>
    <td><input class="form-control form-control-sm item-qty" type="number" min="0" step="0.01" value="1"></td>
    <td><input class="form-control form-control-sm item-unit" value="Adet"></td>
    <td><input class="form-control form-control-sm item-price" type="number" min="0" step="0.01" value="0.00"></td>
    <td><input class="form-control form-control-sm item-tax" type="number" min="0" step="0.01" value="0"></td>
    <td class="text-end align-middle"><span class="line-total">0.00</span></td>
    <td><button type="button" class="btn btn-sm btn-outline-danger remove-row">Sil</button></td>
  `;
  tbody.appendChild(tr);
  // wire events
  ['input'].forEach(ev => {
    tr.querySelectorAll('.item-qty, .item-price, .item-tax').forEach(inp => inp.addEventListener(ev, recalcTotals));
    tr.querySelector('.remove-row').onclick = () => { tr.remove(); recalcTotals(); };
  });
  recalcTotals();
}

function recalcTotals() {
  let subtotal = 0;
  let taxTotal = 0;
  document.querySelectorAll('#itemsTable tbody tr').forEach(tr => {
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.item-price').value) || 0;
    const tax = parseFloat(tr.querySelector('.item-tax').value) || 0;
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

export { renderOffersPanel };
