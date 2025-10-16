// E-Ticaret > Entegrasyonlar Paneli
// Amaç: Pazaryeri API bilgilerini (ör. Trendyol) lokal olarak tutmak ve temel test çağrıları yapmak.
// Not: Bu panel, hassas bilgileri localStorage'da saklar; üretimde bir backend aracılığıyla güvenli saklama önerilir.

export function renderEcommerceIntegrationsPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  // Helper: resolve backend base URL. Only fall back to localhost in local dev.
  function getBase() {
    const envBase = (typeof window !== 'undefined' && window.ENV && window.ENV.MP_BACKEND_URL) ? window.ENV.MP_BACKEND_URL : null;
    if (envBase) return envBase;
    try {
      const host = (typeof location !== 'undefined') ? location.hostname : '';
      const isLocal = host === 'localhost' || host === '127.0.0.1' || /\.local$/i.test(host);
      return isLocal ? 'http://127.0.0.1:500' : null;
    } catch { return null; }
  }
  const saved = JSON.parse(localStorage.getItem('trendyolApiInfo') || '{}');
  const isActive = saved.isActive === true;
  main.innerHTML = `
    <section class="container py-4">
      <h2 class="mb-3">Pazaryeri Entegrasyonları</h2>
      <div class="row g-3">
        <div class="col-12 col-lg-7">
          <div class="card shadow-sm">
            <div class="card-header bg-dark text-white">Trendyol API Bilgileri</div>
            <div class="card-body">
              <div class="mb-2">
                <label class="form-label">API Key</label>
                <input id="tyApiKey" class="form-control" placeholder="Trendyol API Key" value="${saved.apiKey || ''}"/>
              </div>
              <div class="mb-2">
                <label class="form-label">API Secret</label>
                <input id="tyApiSecret" class="form-control" placeholder="Trendyol API Secret" value="${saved.apiSecret || ''}"/>
              </div>
              <div class="mb-3">
                <label class="form-label">Supplier ID</label>
                <input id="tySupplierId" class="form-control" placeholder="Supplier ID" value="${saved.supplierId || ''}"/>
              </div>
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="tyActive" ${isActive ? 'checked' : ''}>
                <label class="form-check-label" for="tyActive">Etkin</label>
              </div>
              <div class="d-flex gap-2">
                <button id="tySaveBtn" class="btn btn-primary">Kaydet</button>
                <button id="tyTestBtn" class="btn btn-outline-secondary">Test Çağrısı</button>
                <button id="tyClearBtn" class="btn btn-outline-danger">Sil</button>
              </div>
              <div id="tyMsg" class="small mt-2"></div>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-5">
          <div class="card h-100 shadow-sm">
            <div class="card-header">Bilgi</div>
            <div class="card-body">
              <ul>
                <li>Bilgiler tarayıcıda localStorage'da tutulur.</li>
                <li>Üretimde bu bilgileri sunucuda saklayıp imzalı istekler önerilir.</li>
                <li>Trendyol için istekleri bir backend üzerinden proxy etmek daha güvenlidir.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const $ = (id) => document.getElementById(id);
  const msg = $('tyMsg');
  $('tySaveBtn').onclick = () => {
    const apiKey = $('tyApiKey').value.trim();
    const apiSecret = $('tyApiSecret').value.trim();
    const supplierId = $('tySupplierId').value.trim();
    const isActive = $('tyActive').checked;
    const payload = { apiKey, apiSecret, supplierId, isActive, updatedAt: new Date().toISOString() };
    try { localStorage.setItem('trendyolApiInfo', JSON.stringify(payload)); } catch {}
    msg.textContent = 'Kaydedildi';
    msg.className = 'small text-success';
  };
  $('tyClearBtn').onclick = () => {
    try { localStorage.removeItem('trendyolApiInfo'); } catch {}
    $('tyApiKey').value = '';
    $('tyApiSecret').value = '';
    $('tySupplierId').value = '';
    $('tyActive').checked = false;
    msg.textContent = 'Silindi';
    msg.className = 'small text-warning';
  };
  $('tyTestBtn').onclick = async () => {
    msg.textContent = 'Test ediliyor...';
    msg.className = 'small text-muted';
    try {
      const info = JSON.parse(localStorage.getItem('trendyolApiInfo') || '{}');
      if (!info.apiKey || !info.apiSecret || !info.supplierId) throw new Error('Eksik bilgi');
      const base = getBase();
      if (!base) {
        throw new Error('Canlı ortamda API adresi tanımlı değil. Lütfen backend’i yayınlayıp window.ENV.MP_BACKEND_URL olarak ayarlayın.');
      }
      // Real validation via orders endpoint with minimal page size
      const payload = { apiKey: info.apiKey, apiSecret: info.apiSecret, supplierId: info.supplierId, page: 0, size: 1, status: 'Created' };
      const resp = await fetch(`${base}/trendyol/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      let json;
      try { json = await resp.json(); } catch { json = {}; }
      if (resp.ok && json.ok) {
        const count = Array.isArray(json.items) ? json.items.length : 0;
        msg.textContent = `Kimlik bilgileri geçerli. Örnek sorgu başarılı (kayıt sayısı: ${count}).`;
        msg.className = 'small text-success';
      } else {
        const detail = (json && (json.error || JSON.stringify(json.data || ''))) || `HTTP ${resp.status}`;
        msg.textContent = `Kimlik doğrulama başarısız: ${detail}`;
        msg.className = 'small text-danger';
      }
    } catch (e) {
      msg.textContent = 'Test başarısız: ' + (e?.message || e);
      msg.className = 'small text-danger';
    }
  };
}
