console.log('musteriler-panel.js yüklendi');

// Modern, sade, SPA uyumlu müşteri paneli
import { supabase } from './supabaseClient.js';
const getCurrentUserId = () => {
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
};

async function renderCustomersPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold text-primary">Müşteriler</h2>
        <button class="btn btn-success" id="addCustomerBtn">Yeni Müşteri</button>
      </div>
      <div id="customersList">Yükleniyor...</div>
    </section>
    <!-- Modal -->
    <div class="modal fade" id="customerModal" tabindex="-1" aria-labelledby="customerModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <form id="customerForm">
            <div class="modal-header bg-primary text-white">
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
      btn.onclick = () => {
        ibanList.splice(btn.dataset.index, 1);
        renderIbans();
      };
    });
  }
  document.getElementById('addIbanBtn').onclick = () => {
    const val = document.getElementById('ibanInput').value.trim();
    if (val && !ibanList.includes(val)) {
      ibanList.push(val);
      document.getElementById('ibanInput').value = '';
      renderIbans();
    }
  };
  renderIbans();

  // Modal açma
  document.getElementById('addCustomerBtn').onclick = () => {
    document.getElementById('customerForm').reset();
    ibanList = [];
    renderIbans();
    document.getElementById('customerModalLabel').textContent = 'Yeni Müşteri';
    const modal = new bootstrap.Modal(document.getElementById('customerModal'));
    modal.show();
  };

  // Kayıt ekleme
  document.getElementById('customerForm').onsubmit = async (e) => {
    e.preventDefault();
    const required = (v) => (v && String(v).trim().length ? String(v).trim() : null);
    const numOrNull = (v, digits = 2) => {
      const n = Number(v);
      return isNaN(n) ? null : Number(n.toFixed(digits));
    };
    const payload = {
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
    if (!payload.company_title && !payload.name) {
      alert('Firma Unvanı zorunludur.');
      document.getElementById('companyTitle').focus();
      return;
    }
    try {
  const owner_id = getCurrentUserId();
  const { error: insErr } = await supabase.from('customers').insert([{ ...payload, owner_id }]).select('id').single();
      if (insErr) throw insErr;
      bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
      renderCustomersPanel();
    } catch (err) {
      alert('Müşteri kaydedilemedi: ' + (err?.message || err));
      console.error('customer insert error', err);
    }
  };

  // Listele
  const { data, error } = await supabase.from('customers').select('*').eq('owner_id', getCurrentUserId()).order('id', { ascending: false });
  if (error) {
    console.error('customers load error', error);
    document.getElementById('customersList').innerHTML = `<div class="alert alert-danger">Müşteriler yüklenirken hata: ${error.message}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    document.getElementById('customersList').innerHTML = `<div class="alert alert-warning">Hiç müşteri bulunamadı.</div>`;
    return;
  }
  let html = `<div class="table-responsive"><table class="table table-striped align-middle"><thead><tr><th>Unvan</th><th>Kısa İsim</th><th>Kategori</th><th>E-posta</th><th>Telefon</th><th>IBAN</th><th></th></tr></thead><tbody>`;
  for (const c of data) {
    html += `<tr><td>${c.company_title||c.name||''}</td><td>${c.short_name||''}</td><td>${c.category||''}</td><td>${c.email||''}</td><td>${c.phone||''}</td><td>${Array.isArray(c.ibans)?c.ibans.join('<br>'):''}</td><td></td></tr>`;
  }
  html += '</tbody></table></div>';
  document.getElementById('customersList').innerHTML = html;
}

export { renderCustomersPanel };
