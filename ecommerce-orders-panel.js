// E-Ticaret > Siparişler Paneli
// Lists marketplace orders from backend with basic filters and paging.

export function renderEcommerceOrdersPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="m-0">Siparişler</h2>
        <div>
          <button id="ecRefresh" class="btn btn-sm btn-outline-secondary">Yenile</button>
        </div>
      </div>
      
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-12 col-md-3">
              <label class="form-label">Durum</label>
              <select id="ecStatus" class="form-select">
                <option value="Created">Yeni</option>
                <option value="Shipped">Taşımada</option>
              </select>
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Başlangıç</label>
              <input id="ecStart" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Bitiş</label>
              <input id="ecEnd" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3 d-flex align-items-end">
              <button id="ecApply" class="btn btn-primary w-100">Uygula</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-striped table-hover m-0">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Durum</th>
                  <th>Müşteri</th>
                  <th>Tutar</th>
                  <th>Tarih</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="ecRows">
                <tr><td colspan="6" class="text-center py-4">Veri yükleniyor...</td></tr>
              </tbody>
            </table>
          </div>
          <div class="d-flex justify-content-between align-items-center p-2">
            <div id="ecInfo" class="small text-muted"></div>
            <div class="btn-group">
              <button id="ecPrev" class="btn btn-sm btn-outline-secondary">Önceki</button>
              <button id="ecNext" class="btn btn-sm btn-outline-secondary">Sonraki</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const state = { page: 0, size: 20 };
  const $ = (id) => document.getElementById(id);
  function getBase() {
    const envBase = (typeof window !== 'undefined' && window.ENV && window.ENV.MP_BACKEND_URL) ? window.ENV.MP_BACKEND_URL : null;
    if (envBase) return envBase;
    try {
      const host = (typeof location !== 'undefined') ? location.hostname : '';
      const isLocal = host === 'localhost' || host === '127.0.0.1' || /\.local$/i.test(host);
      return isLocal ? 'http://127.0.0.1:500' : null;
    } catch { return null; }
  }
  function getCreds() { return JSON.parse(localStorage.getItem('trendyolApiInfo') || '{}'); }

  // Prefill default date range (last 30 days)
  (function prefillDates(){
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const toYMD = (d) => d.toISOString().slice(0,10);
    const ecStart = $('ecStart');
    const ecEnd = $('ecEnd');
    if (ecStart && !ecStart.value) ecStart.value = toYMD(start);
    if (ecEnd && !ecEnd.value) ecEnd.value = toYMD(end);
  })();

  // Default status to "Created" (Yeni)
  (function defaultStatus(){
    const sel = $('ecStatus');
    if (sel && !sel.value) sel.value = 'Created';
  })();

  async function load() {
    const rows = $('ecRows');
    rows.innerHTML = `<tr><td colspan="6" class="text-center py-4">Yükleniyor...</td></tr>`;
    const info = $('ecInfo');
    const creds = getCreds();
    if (!creds.apiKey || !creds.apiSecret || !creds.supplierId) {
      rows.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Trendyol API bilgileri eksik. Lütfen Entegrasyonlar sayfasından kaydedin.</td></tr>`;
      info.textContent = '';
      return;
    }
    const base = getBase();
    if (!base) {
      rows.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-warning">Canlı ortamda API adresi tanımlı değil. Backend yayınlandığında Ayarlar/Entegrasyonlar kısmından window.ENV.MP_BACKEND_URL tanımlayın.</td></tr>`;
      info.textContent = '';
      return;
    }
    const payload = {
      apiKey: creds.apiKey,
      apiSecret: creds.apiSecret,
      supplierId: creds.supplierId,
      page: state.page,
      size: state.size,
      status: $('ecStatus').value,
      startDate: $('ecStart').value ? new Date($('ecStart').value).toISOString() : null,
      endDate: $('ecEnd').value ? new Date($('ecEnd').value).toISOString() : null
    };
    try {
      const resp = await fetch(`${base}/trendyol/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      let json;
      try { json = await resp.json(); }
      catch { // Non-JSON (e.g., HTML 404)
        const text = await resp.text();
        throw new Error(`Sunucu beklenmeyen yanıt döndürdü (HTTP ${resp.status}): ${text?.slice(0,200)}`);
      }
      if (!resp.ok || !json.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      let items = json.items || [];
      // Defensive client-side filter: if a specific status is selected, filter rows
      const want = $('ecStatus').value;
      if (want && want !== 'ALL') {
        items = items.filter(o => (o.status || '').toLowerCase() === want.toLowerCase());
      }
      if (items.length === 0) {
        rows.innerHTML = `<tr><td colspan="6" class="text-center py-4">Kayıt bulunamadı</td></tr>`;
      } else {
        rows.innerHTML = items.map(o => `
          <tr>
            <td>${o.orderNumber || o.id}</td>
            <td>${o.status}</td>
            <td>${o.customer || '-'}</td>
            <td>${(o.totalPrice ?? 0)} ${(o.currency || 'TRY')}</td>
            <td>${new Date(o.createdAt).toLocaleString()}</td>
            <td><button class="btn btn-sm btn-outline-primary" data-oid="${o.id}">Detay</button></td>
          </tr>
        `).join('');
      }
      info.textContent = `Sayfa ${state.page + 1}, Boyut ${state.size} (Toplam ~${json.total ?? '?'})`;
      // Hook detail buttons (mock modal)
      rows.querySelectorAll('button[data-oid]').forEach(btn => btn.addEventListener('click', () => {
        alert(`Sipariş Detay (mock)\nID: ${btn.getAttribute('data-oid')}`);
      }));
    } catch (e) {
      rows.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Hata: ${e.message}</td></tr>`;
      info.textContent = '';
    }
  }

  $('ecApply').addEventListener('click', () => { state.page = 0; load(); });
  $('ecRefresh').addEventListener('click', load);
  $('ecPrev').addEventListener('click', () => { state.page = Math.max(0, state.page - 1); load(); });
  $('ecNext').addEventListener('click', () => { state.page = state.page + 1; load(); });

  // Quick status tabs removed per request

  load();
}
