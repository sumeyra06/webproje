console.log('invoices-panel-v2.js yüklendi');
import { supabase } from './supabaseClient.js';

const getCurrentUserId = () => { try { return JSON.parse(localStorage.getItem('sessionUser'))?.id || null; } catch { return null; } };

export async function renderInvoicesPanelV2() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold text-primary">Satış Faturaları (v2)</h2>
        <button class="btn btn-success" id="addInvoiceBtn">Yeni Fatura</button>
      </div>
      <div id="invoicesList">Yükleniyor...</div>
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
                <div class="col-md-6"><label class="form-label">Müşteri</label><input id="invCustomer" class="form-control" list="customersDatalistV2"><datalist id="customersDatalistV2"></datalist></div>
                <div class="col-md-6"><label class="form-label">Etiketler</label><input id="invTags" class="form-control" placeholder="etiket1, etiket2"></div>
                <div class="col-md-3"><label class="form-label">Tahsilat Durumu</label><select id="invCollect" class="form-select"><option value="pending">TAHSİL EDİLECEK</option><option value="collected">TAHSİL EDİLDİ</option></select></div>
                <div class="col-md-3"><label class="form-label">Düzenleme Tarihi</label><input type="date" id="invEdit" class="form-control" value="${new Date().toISOString().slice(0,10)}"></div>
                <div class="col-md-3"><label class="form-label">Vade Tarihi</label><input type="date" id="invDue" class="form-control" value="${new Date().toISOString().slice(0,10)}"></div>
                <div class="col-md-3"><label class="form-label">Döviz</label><input id="invCurr" class="form-control" value="TRY"></div>
                <div class="col-md-12">
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">Hizmet / Ürün Satırları</h6>
                    <button class="btn btn-sm btn-outline-primary" type="button" id="addRowV2">YENİ SATIR</button>
                  </div>
                  <div class="table-responsive">
                    <table class="table table-sm align-middle" id="itemsTableV2">
                      <thead><tr><th style="width:40%">Açıklama</th><th style="width:10%">Miktar</th><th style="width:10%">Birim</th><th style="width:15%">Br. Fiyat</th><th style="width:10%">KDV%</th><th style="width:10%">Toplam</th><th></th></tr></thead>
                      <tbody></tbody>
                    </table>
                  </div>
                </div>
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
}

async function loadInvoicesV2() {
  const listEl = document.getElementById('invoicesList');
  const { data, error } = await supabase
    .from('invoices_v2')
    .select('id, invoice_no, customer_name, currency, total, edit_date, collection_status')
    .eq('owner_id', getCurrentUserId())
    .order('id', { ascending: false })
    .limit(100);
  if (error) { listEl.innerHTML = `<div class='alert alert-danger'>${error.message}</div>`; return; }
  if (!data?.length) { listEl.innerHTML = `<div class='alert alert-warning'>Hiç fatura yok.</div>`; return; }
  listEl.innerHTML = data.map(inv => `
    <div class='list-group-item'>
      <div class='d-flex justify-content-between align-items-center flex-wrap gap-2'>
        <div>
          <span class='badge bg-secondary me-2'>${inv.invoice_no||''}</span>
          <strong>${inv.customer_name||'Müşteri'}</strong>
        </div>
        <div class='text-end'>
          <div class='text-muted small'>${inv.edit_date ? new Date(inv.edit_date).toLocaleDateString() : ''}</div>
          <div class='fw-bold'>${inv.currency||''} ${(Number(inv.total||0)).toFixed(2)}</div>
        </div>
      </div>
      <div class='mt-2 d-flex gap-2 flex-wrap'>
        <button class='btn btn-sm btn-outline-secondary' data-id='${inv.id}' data-act='edit'>Düzenle</button>
        <button class='btn btn-sm btn-outline-danger' data-id='${inv.id}' data-act='del'>Sil</button>
      </div>
    </div>`).join('');
  listEl.querySelectorAll('button[data-act="edit"]').forEach(b => b.onclick = () => openEditV2(b.dataset.id));
  listEl.querySelectorAll('button[data-act="del"]').forEach(b => b.onclick = () => deleteV2(b.dataset.id));
}

function addRowV2(values={}) {
  const tbody = document.querySelector('#itemsTableV2 tbody');
  const tr = document.createElement('tr');
  const qty = Number(values.qty ?? 1);
  const price = Number(values.unit_price ?? 0);
  const tax = Number(values.tax_rate ?? 0);
  const gross = (qty*price)*(1+(tax/100));
  tr.innerHTML = `
    <td><input class='form-control form-control-sm item-desc' value='${values.description||''}'></td>
    <td><input class='form-control form-control-sm item-qty' type='number' step='0.01' min='0' value='${qty}'></td>
    <td><input class='form-control form-control-sm item-unit' value='${values.unit||'Adet'}'></td>
    <td><input class='form-control form-control-sm item-price' type='number' step='0.01' min='0' value='${price.toFixed(2)}'></td>
    <td><input class='form-control form-control-sm item-tax' type='number' step='0.01' min='0' value='${tax}'></td>
    <td class='text-end align-middle'><span class='line-total'>${gross.toFixed(2)}</span></td>
    <td><button type='button' class='btn btn-sm btn-outline-danger remove-row'>Sil</button></td>
  `;
  tbody.appendChild(tr);
  const onChange = () => recalcV2();
  tr.querySelectorAll('.item-qty,.item-price,.item-tax').forEach(i => i.addEventListener('input', onChange));
  tr.querySelector('.remove-row').onclick = () => { tr.remove(); recalcV2(); };
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
  new bootstrap.Modal(document.getElementById('invoiceModalV2')).show();
}

async function openEditV2(id) {
  const owner = getCurrentUserId();
  const { data: inv, error } = await supabase.from('invoices_v2').select('*').eq('owner_id', owner).eq('id', id).single();
  if (error || !inv) return alert('Fatura bulunamadı');
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

  // Fill items
  const tbody = document.querySelector('#itemsTableV2 tbody');
  tbody.innerHTML = '';
  const { data: items } = await supabase.from('invoice_items_v2').select('*').eq('owner_id', owner).eq('invoice_id', inv.id).order('sort_order', { ascending: true });
  if (items?.length) {
    for (const it of items) addRowV2(it);
  } else {
    addRowV2();
  }
  // Prefill totals from DB
  if (typeof inv.subtotal === 'number') document.getElementById('subTextV2').textContent = inv.subtotal.toFixed(2);
  if (typeof inv.tax_total === 'number') document.getElementById('taxTextV2').textContent = inv.tax_total.toFixed(2);
  if (typeof inv.total === 'number') document.getElementById('grandTextV2').textContent = inv.total.toFixed(2);

  document.querySelector('#invoiceModalV2 .modal-title').textContent = 'Fatura Düzenle';
  document.getElementById('submitV2').textContent = 'GÜNCELLE';
  new bootstrap.Modal(document.getElementById('invoiceModalV2')).show();
}

async function onSubmitV2(e) {
  e.preventDefault();
  const owner = getCurrentUserId();
  const id = document.getElementById('invId').value;
  const payloadBase = {
    owner_id: owner,
    name: document.getElementById('invName').value.trim() || null,
    invoice_no: document.getElementById('invNo').value.trim() || null,
    category: document.getElementById('invCategory').value.trim() || null,
    customer_name: document.getElementById('invCustomer').value.trim() || null,
    tags: (document.getElementById('invTags').value||'').split(',').map(x=>x.trim()).filter(Boolean),
    collection_status: document.getElementById('invCollect').value,
    edit_date: document.getElementById('invEdit').value || null,
    due_date: document.getElementById('invDue').value || null,
    currency: document.getElementById('invCurr').value || 'TRY',
  };

  // Collect items and compute totals
  const items = [];
  let sub = 0, taxSum = 0;
  document.querySelectorAll('#itemsTableV2 tbody tr').forEach((tr, idx) => {
    const qty = Number(tr.querySelector('.item-qty').value||0);
    const price = Number(tr.querySelector('.item-price').value||0);
    const tax = Number(tr.querySelector('.item-tax').value||0);
    const unit = tr.querySelector('.item-unit').value || 'Adet';
    const description = tr.querySelector('.item-desc').value || '';
    const line = qty*price; const ltax = line*(tax/100);
    sub += line; taxSum += ltax;
    items.push({ owner_id: owner, qty, unit_price: price, tax_rate: tax, unit, description, line_subtotal: line, line_tax: ltax, line_total: line+ltax, sort_order: idx });
  });
  const payload = { ...payloadBase, subtotal: sub, tax_total: taxSum, total: sub + taxSum };

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

  bootstrap.Modal.getInstance(document.getElementById('invoiceModalV2')).hide();
  await loadInvoicesV2();
}

async function deleteV2(id) {
  if (!confirm('Faturayı silmek istiyor musunuz?')) return;
  const owner = getCurrentUserId();
  const { error } = await supabase.from('invoices_v2').delete().eq('owner_id', owner).eq('id', id);
  if (error) { alert('Silme başarısız: '+error.message); return; }
  await loadInvoicesV2();
}
