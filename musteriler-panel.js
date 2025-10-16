console.log('musteriler-panel.js yüklendi');

import { supabase } from './supabaseClient.js';

const getCurrentUserId = () => {
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
};

function toCSV(rows, headers) {
  const esc = (v) => {
    const s = (v === undefined || v === null) ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = headers.map(h => esc(h.label)).join(',');
  const body = rows.map(r => headers.map(h => esc(h.get(r))).join(',')).join('\n');
  return head + '\n' + body;
}
function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

async function renderCustomersPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div class="d-flex align-items-center gap-2">
          <h2 class="m-0 fw-bold">Müşteriler</h2>
          <span class="badge rounded-pill text-bg-warning" id="kpiCount">—</span>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary" id="exportCsvBtn"><i class="bi bi-download me-1"></i>CSV</button>
          <button class="btn btn-primary" id="addCustomerBtn"><i class="bi bi-plus-lg me-1"></i>Yeni Müşteri</button>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-12 col-md-4">
              <label class="form-label">Ara</label>
              <input id="fltSearch" class="form-control" placeholder="Unvan, kısa isim, e-posta, telefon..." />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Kategori</label>
              <input id="fltCategory" class="form-control" placeholder="Kategori" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Şehir</label>
              <input id="fltCity" class="form-control" placeholder="İl" />
            </div>
            <div class="col-12 col-md-2 d-flex align-items-end">
              <button id="applyFilters" class="btn btn-dark w-100">Uygula</button>
            </div>
          </div>
        </div>
      </div>

      <div id="customersList" class="card shadow-sm">
        <div class="card-body p-0">
          <div class="table-responsive"><table class="table table-hover table-striped align-middle m-0">
            <thead class="table-light">
              <tr>
                <th>Unvan</th>
                <th>Kısa İsim</th>
                <th>Kategori</th>
                <th>E-posta</th>
                <th>Telefon</th>
                <th>Şehir</th>
                <th>IBAN</th>
                <th style="width:72px;"></th>
              </tr>
            </thead>
            <tbody id="custRows"><tr><td colspan="8" class="text-center py-4">Yükleniyor...</td></tr></tbody>
          </table></div>
        </div>
      </div>
    </section>

    <div class="modal fade" id="customerModal" tabindex="-1" aria-labelledby="customerModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <form id="customerForm">
            <div class="modal-header bg-dark text-white">
              <h5 class="modal-title" id="customerModalLabel">Yeni Müşteri</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Kapat"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Firma Unvanı</label>
                  <input type="text" class="form-control" id="companyTitle" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Kısa İsim</label>
                  <input type="text" class="form-control" id="shortName">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Kategori</label>
                  <input type="text" class="form-control" id="category">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Fiyat Listesi</label>
                  <input type="text" class="form-control" id="priceList">
                </div>
                <div class="col-md-6">
                  <label class="form-label">E-posta</label>
                  <input type="email" class="form-control" id="customerEmail">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Telefon</label>
                  <input type="text" class="form-control" id="customerPhone">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Faks</label>
                  <input type="text" class="form-control" id="faxNumber">
                </div>
                <div class="col-md-6">
                  <label class="form-label">IBAN Numaraları</label>
                  <div id="ibanList"></div>
                  <div class="input-group mb-2">
                    <input type="text" class="form-control" id="ibanInput" placeholder="IBAN">
                    <button type="button" class="btn btn-outline-secondary" id="addIbanBtn">Ekle</button>
                  </div>
                </div>
                <div class="col-12">
                  <label class="form-label">Adres</label>
                  <textarea class="form-control" id="customerAddress" rows="2"></textarea>
                  <div class="form-check mt-1">
                    <input class="form-check-input" type="checkbox" id="foreignAddress">
                    <label class="form-check-label" for="foreignAddress">Adres yurt dışında</label>
                  </div>
                </div>
                <div class="col-md-4">
                  <label class="form-label">Posta Kodu</label>
                  <input type="text" class="form-control" id="postalCode">
                </div>
                <div class="col-md-4">
                  <label class="form-label">İlçe</label>
                  <input type="text" class="form-control" id="district">
                </div>
                <div class="col-md-4">
                  <label class="form-label">İl</label>
                  <input type="text" class="form-control" id="city">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Türü</label>
                  <div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="radio" name="customerType" id="typeLegal" value="Tüzel Kişi" checked>
                      <label class="form-check-label" for="typeLegal">Tüzel Kişi</label>
                    </div>
                    <div class="form-check form-check-inline">
                      <input class="form-check-input" type="radio" name="customerType" id="typeReal" value="Gerçek Kişi">
                      <label class="form-check-label" for="typeReal">Gerçek Kişi</label>
                    </div>
                  </div>
                </div>
                <div class="col-md-6">
                  <label class="form-label">VKN / TCKN</label>
                  <input type="text" class="form-control" id="taxId">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Vergi Dairesi</label>
                  <input type="text" class="form-control" id="taxOffice">
                </div>
                <div class="col-md-6">
                  <label class="form-label">Döviz Kuru</label>
                  <div class="input-group mb-2">
                    <span class="input-group-text">Alış</span>
                    <input type="number" class="form-control" id="exchangeBuy" step="0.0001">
                    <span class="input-group-text">Satış</span>
                    <input type="number" class="form-control" id="exchangeSell" step="0.0001">
                  </div>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Açılış Bakiyesi</label>
                  <input type="number" class="form-control" id="openingBalance" step="0.01">
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button>
              <button type="submit" class="btn btn-primary">Kaydet</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // IBAN dinamik ekleme
  let ibanList = [];
  function renderIbans() {
    const ibanListDiv = document.getElementById('ibanList');
    if (!ibanListDiv) return;
    ibanListDiv.innerHTML = ibanList.map((iban, i) => `<span class='badge bg-info text-dark me-1 mb-1'>${iban} <button type='button' class='btn-close btn-close-sm ms-1' aria-label='Sil' data-index='${i}' style='font-size:10px;'></button></span>`).join('');
    ibanListDiv.querySelectorAll('.btn-close').forEach(btn => {
      btn.onclick = () => { ibanList.splice(btn.dataset.index, 1); renderIbans(); };
    });
  }
  const addIbanBtn = document.getElementById('addIbanBtn');
  if (addIbanBtn) addIbanBtn.onclick = () => {
    const val = document.getElementById('ibanInput')?.value?.trim();
    if (val && !ibanList.includes(val)) {
      ibanList.push(val);
      const input = document.getElementById('ibanInput'); if (input) input.value = '';
      renderIbans();
    }
  };
  renderIbans();

  // Form yardımcıları
  function required(v) { return (v && String(v).trim().length ? String(v).trim() : null); }
  function numOrNull(v, digits = 2) { const n = Number(v); return isNaN(n) ? null : Number(n.toFixed(digits)); }
  function collectPayload() {
    return {
      name: required(document.getElementById('companyTitle').value) || required(document.getElementById('shortName').value),
      company_title: required(document.getElementById('companyTitle').value),
      short_name: required(document.getElementById('shortName').value),
      category: required(document.getElementById('category').value),
      price_list: required(document.getElementById('priceList').value),
      email: required(document.getElementById('customerEmail').value),
      phone: required(document.getElementById('customerPhone').value),
      fax: required(document.getElementById('faxNumber').value),
      ibans: Array.isArray(ibanList) ? ibanList : [],
      address: required(document.getElementById('customerAddress').value),
      foreign_address: !!document.getElementById('foreignAddress').checked,
      postal_code: required(document.getElementById('postalCode').value),
      district: required(document.getElementById('district').value),
      city: required(document.getElementById('city').value),
      type: document.querySelector('input[name="customerType"]:checked')?.value || 'Tüzel Kişi',
      tax_id: required(document.getElementById('taxId').value),
      tax_office: required(document.getElementById('taxOffice').value),
      exchange_buy: numOrNull(document.getElementById('exchangeBuy').value, 4),
      exchange_sell: numOrNull(document.getElementById('exchangeSell').value, 4),
      opening_balance: numOrNull(document.getElementById('openingBalance').value, 2)
    };
  }

  // Yeni müşteri modali
  document.getElementById('addCustomerBtn')?.addEventListener('click', () => {
    document.getElementById('customerForm')?.reset();
    ibanList = []; renderIbans();
    document.getElementById('customerModalLabel').textContent = 'Yeni Müşteri';
    const modal = new bootstrap.Modal(document.getElementById('customerModal'));
    modal.show();
    const form = document.getElementById('customerForm');
    if (form) form.onsubmit = handleCreate;
  });

  async function handleCreate(e) {
    e.preventDefault();
    const payload = collectPayload();
    if (!payload.company_title && !payload.name) {
      alert('Firma Unvanı zorunludur.');
      document.getElementById('companyTitle')?.focus();
      return;
    }
    try {
      const owner_id = getCurrentUserId();
      const { error: insErr } = await supabase.from('customers').insert([{ ...payload, owner_id }]).select('id').single();
      if (insErr) throw insErr;
      bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
      await loadAndRender();
    } catch (err) {
      alert('Müşteri kaydedilemedi: ' + (err?.message || err));
      console.error('customer insert error', err);
    }
  }

  function openEdit(item) {
    document.getElementById('customerModalLabel').textContent = 'Müşteri Düzenle';
    const f = (id,v='') => { const el = document.getElementById(id); if (el) el.value = v||''; };
    f('companyTitle', item.company_title);
    f('shortName', item.short_name);
    f('category', item.category);
    f('priceList', item.price_list);
    f('customerEmail', item.email);
    f('customerPhone', item.phone);
    f('faxNumber', item.fax);
    f('customerAddress', item.address);
    f('postalCode', item.postal_code);
    f('district', item.district);
    f('city', item.city);
    f('taxId', item.tax_id);
    f('taxOffice', item.tax_office);
    const exb = document.getElementById('exchangeBuy'); if (exb) exb.value = item.exchange_buy ?? '';
    const exs = document.getElementById('exchangeSell'); if (exs) exs.value = item.exchange_sell ?? '';
    const opb = document.getElementById('openingBalance'); if (opb) opb.value = item.opening_balance ?? '';
    document.getElementById('typeLegal').checked = (item.type || 'Tüzel Kişi') === 'Tüzel Kişi';
    document.getElementById('typeReal').checked = (item.type || 'Tüzel Kişi') === 'Gerçek Kişi';
    ibanList = Array.isArray(item.ibans) ? [...item.ibans] : []; renderIbans();
    const modal = new bootstrap.Modal(document.getElementById('customerModal')); modal.show();
    const form = document.getElementById('customerForm');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const updated = collectPayload();
        const { error: upErr } = await supabase.from('customers').update(updated).eq('id', item.id).eq('owner_id', getCurrentUserId());
        if (upErr) throw upErr;
        bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
        await loadAndRender();
      } catch (err) {
        alert('Güncellenemedi: ' + (err?.message || err));
      }
    };
  }

  async function confirmDelete(item) {
    if (!confirm(`Silinsin mi?\n${item.company_title || item.name || ''}`)) return;
    try {
      const { error: delErr } = await supabase.from('customers').delete().eq('id', item.id).eq('owner_id', getCurrentUserId());
      if (delErr) throw delErr;
      await loadAndRender();
    } catch (err) {
      alert('Silinemedi: ' + (err?.message || err));
    }
  }

  // Listeleme + filtreleme
  let RAW = [];
  let LAST_LIST = [];
  async function loadAndRender() {
    const rows = document.getElementById('custRows');
    const kpi = document.getElementById('kpiCount');
    rows.innerHTML = `<tr><td colspan="8" class="text-center py-4">Yükleniyor...</td></tr>`;
    const { data, error } = await supabase.from('customers').select('*').eq('owner_id', getCurrentUserId()).order('id', { ascending: false });
    if (error) {
      console.error('customers load error', error);
      rows.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Hata: ${error.message}</td></tr>`;
      kpi.textContent = '0';
      return;
    }
    RAW = Array.isArray(data) ? data : [];
    kpi.textContent = RAW.length.toString();
    applyFilters();
  }

  function applyFilters() {
    const q = (document.getElementById('fltSearch')?.value || '').toLowerCase();
    const cat = (document.getElementById('fltCategory')?.value || '').toLowerCase();
    const city = (document.getElementById('fltCity')?.value || '').toLowerCase();
    let list = RAW;
    if (q) list = list.filter(c => [c.company_title, c.short_name, c.email, c.phone].some(v => (v||'').toLowerCase().includes(q)));
    if (cat) list = list.filter(c => (c.category||'').toLowerCase().includes(cat));
    if (city) list = list.filter(c => (c.city||'').toLowerCase().includes(city));
    LAST_LIST = list;
    renderRows(list);
  }

  function renderRows(list) {
    const rows = document.getElementById('custRows');
    if (!list || list.length === 0) {
      rows.innerHTML = `<tr><td colspan="8" class="py-5"><div class="text-center text-muted">
        <i class="bi bi-people" style="font-size:2rem;"></i><div>Hiç müşteri bulunamadı.</div>
      </div></td></tr>`;
      return;
    }
    rows.innerHTML = list.map(c => `
      <tr>
        <td><div class="fw-bold">${c.company_title||c.name||'-'}</div><div class="text-muted small">${c.tax_id||''}</div></td>
        <td>${c.short_name||''}</td>
        <td><span class="badge rounded-pill text-bg-light">${c.category||'-'}</span></td>
        <td>${c.email||''}</td>
        <td>${c.phone||''}</td>
        <td>${c.city||''}</td>
        <td>${Array.isArray(c.ibans)?c.ibans.map(i=>`<span class='badge bg-secondary-subtle text-dark me-1 mb-1'>${i}</span>`).join(''):''}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" data-act="edit" data-id="${c.id}"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-outline-danger" data-act="del" data-id="${c.id}"><i class="bi bi-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
    rows.querySelectorAll('button[data-act]')?.forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        const item = RAW.find(r => String(r.id) === String(id));
        if (!item) return;
        if (act === 'edit') openEdit(item);
        if (act === 'del') confirmDelete(item);
      });
    });
  }

  document.getElementById('applyFilters')?.addEventListener('click', (e) => { e.preventDefault(); applyFilters(); });
  document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
    const csv = toCSV(LAST_LIST, [
      { label: 'Unvan', get: r => r.company_title || r.name || '' },
      { label: 'Kısa İsim', get: r => r.short_name || '' },
      { label: 'Kategori', get: r => r.category || '' },
      { label: 'E-posta', get: r => r.email || '' },
      { label: 'Telefon', get: r => r.phone || '' },
      { label: 'Şehir', get: r => r.city || '' },
    ]);
    downloadCSV('musteriler.csv', csv);
  });

  await loadAndRender();
}

export { renderCustomersPanel };
