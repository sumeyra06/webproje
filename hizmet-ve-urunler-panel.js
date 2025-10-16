// hizmet-ve-urunler-panel.js
import { supabase } from './supabaseClient.js';
const getCurrentUserId = () => {
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
};

async function renderServicesProductsPanel() {
  const main = document.getElementById('main');

  main.innerHTML = `
    <section class="container-fluid py-4">
      <div class="d-flex flex-column flex-lg-row justify-content-between align-items-stretch align-items-lg-center mb-3 gap-3">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <h2 class="mb-0 fw-bold text-primary"><i class="bi bi-box-seam me-2"></i> Hizmet ve Ürünler</h2>
          <div id="activeFilters" class="d-flex flex-wrap gap-2"></div>
        </div>
        <div class="toolbar d-flex flex-wrap gap-2 align-items-center w-100 w-lg-auto">
          <div class="position-relative">
            <input type="text" class="form-control ps-5" id="productSearchInput" placeholder="Ara: isim, kategori..." style="min-width:220px;">
            <i class="bi bi-search position-absolute top-50 translate-middle-y ms-3 text-muted"></i>
            <button class="btn btn-sm btn-light position-absolute top-50 end-0 translate-middle-y me-1 d-none" id="clearSearchBtn"><i class="bi bi-x"></i></button>
          </div>
          <select class="form-select" id="categoryFilterSelect" style="min-width:170px;">
            <option value="">Tüm Kategoriler</option>
          </select>
          <select class="form-select" id="sortSelect" style="min-width:160px;">
            <option value="name_asc">Ad A-Z</option>
            <option value="name_desc">Ad Z-A</option>
            <option value="price_asc">Fiyat Artan</option>
            <option value="price_desc">Fiyat Azalan</option>
            <option value="stock_desc">Stok Azalan</option>
            <option value="stock_asc">Stok Artan</option>
          </select>
          <div class="btn-group" role="group" aria-label="Görünüm">
            <button class="btn btn-outline-secondary active" id="viewGridBtn" title="Kart Görünümü"><i class="bi bi-grid"></i></button>
            <button class="btn btn-outline-secondary" id="viewListBtn" title="Liste Görünümü"><i class="bi bi-list"></i></button>
          </div>
          <button class="btn btn-outline-secondary" id="resetFiltersBtn" title="Filtreleri Sıfırla"><i class="bi bi-arrow-counterclockwise"></i></button>
          <button class="btn btn-success shadow-sm" id="addProductBtn"><i class="bi bi-plus-circle me-1"></i> Ekle</button>
        </div>
      </div>
      <div class="mb-2 small text-muted" id="summaryBar"></div>
      <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2" id="paginationBar" style="display:none;">
        <div class="d-flex align-items-center gap-2 small">
          <label class="text-muted">Sayfa Boyutu</label>
          <select id="pageSizeSelect" class="form-select form-select-sm" style="width:auto;">
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="48">48</option>
            <option value="100">100</option>
          </select>
        </div>
        <nav>
          <ul class="pagination pagination-sm mb-0" id="pagination"></ul>
        </nav>
      </div>
      <div id="servicesProductsTableWrapper">
        <div class="text-center my-4">
          <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Yükleniyor...</span></div>
        </div>
      </div>
    </section>
    <!-- Ürün Ekle/Güncelle Modalı -->
    <div class="modal fade" id="productModal" tabindex="-1" aria-labelledby="productModalLabel" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="productForm">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title" id="productModalLabel">Ürün Ekle</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Kapat"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="productId">
              <div class="row g-2">
                <div class="col-12">
                  <label for="productName" class="form-label">Ürün/Hizmet Adı</label>
                  <input type="text" class="form-control" id="productName" required>
                </div>
                <div class="col-md-6">
                  <label for="productCode" class="form-label">Ürün / Stok Kodu</label>
                  <input type="text" class="form-control" id="productCode" placeholder="Boş bırakılırsa otomatik atanır (PRD-000001)">
                  <div class="form-text">Boş bırakırsanız sistem otomatik bir kod atar.</div>
                </div>
                <div class="col-md-6">
                  <label for="productBarcode" class="form-label">Barkod Numarası</label>
                  <input type="text" class="form-control" id="productBarcode" placeholder="EAN/UPC">
                </div>
                <div class="col-md-6">
                  <label for="productCategory" class="form-label">Kategori</label>
                  <input type="text" class="form-control" id="productCategory" placeholder="Kategori">
                </div>
                <div class="col-md-6">
                  <label for="productUnit" class="form-label">Alış / Satış Birimi</label>
                  <select id="productUnit" class="form-select">
                    <option value="Adet" selected>Adet</option>
                    <option value="Kg">Kg</option>
                    <option value="Lt">Lt</option>
                    <option value="Paket">Paket</option>
                    <option value="Koli">Koli</option>
                  </select>
                  <div class="form-text">Birim değişikliği geriye dönük faturalara yansır.</div>
                </div>
                <div class="col-12">
                  <label for="productPhotoUrl" class="form-label">Ürün Fotoğrafı (URL)</label>
                  <input type="url" class="form-control" id="productPhotoUrl" placeholder="https://...">
                </div>
                <div class="col-md-6">
                  <label for="productGtip" class="form-label">GTİP Kodu</label>
                  <input type="text" id="productGtip" class="form-control" placeholder="GTİP">
                </div>
                <div class="col-md-6 d-flex align-items-end">
                  <div class="form-check form-switch">
                    <input class="form-check-input" type="checkbox" id="stockTrackingSwitch" checked>
                    <label class="form-check-label" for="stockTrackingSwitch">Stok Takibi Yapılsın</label>
                  </div>
                </div>
              </div>

              <hr>
              <div class="mb-2 fw-semibold">Başlangıç Stok Miktarı</div>
              <div id="warehouseStockContainer" class="row g-2">
                <div class="col-12 text-muted small">Depolar yükleniyor...</div>
              </div>
              <div class="mt-2">
                <label class="form-label">Kritik Stok Uyarısı</label>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="criticalMode" id="critTotal" value="total" checked>
                  <label class="form-check-label" for="critTotal">Toplam ürün miktarı için belirle</label>
                </div>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="criticalMode" id="critPerWh" value="per_wh">
                  <label class="form-check-label" for="critPerWh">Depo bazında ürün miktarı için belirle</label>
                </div>
                <div id="criticalTotalRow" class="mt-2">
                  <input type="number" class="form-control" id="criticalTotal" placeholder="Toplam kritik seviye (örn. 5)">
                </div>
              </div>

              <hr>
              <div class="mb-2 fw-semibold">Fiyatlar ve Vergiler</div>
              <div class="row g-2">
                <div class="col-md-3">
                  <label class="form-label">KDV (%)</label>
                  <input type="number" id="vatRate" class="form-control" step="0.01" value="20">
                </div>
                <div class="col-md-9 d-flex align-items-end">
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="priceMode" id="priceModeExcl" value="excl" checked>
                    <label class="form-check-label" for="priceModeExcl">Fiyat Girişi: KDV Hariç</label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input class="form-check-input" type="radio" name="priceMode" id="priceModeIncl" value="incl">
                    <label class="form-check-label" for="priceModeIncl">Fiyat Girişi: KDV Dahil</label>
                  </div>
                </div>
                <!-- KDV Hariç giriş alanları -->
                <div id="groupExcl" class="col-12">
                  <div class="row g-2">
                    <div class="col-md-6">
                      <label class="form-label">Alış Fiyatı (KDV Hariç)</label>
                      <input type="number" id="purchaseExcl" class="form-control" step="0.01" value="0">
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Satış Fiyatı (KDV Hariç)</label>
                      <input type="number" id="saleExcl" class="form-control" step="0.01" value="0">
                    </div>
                  </div>
                </div>
                <!-- KDV Dahil giriş alanları -->
                <div id="groupIncl" class="col-12" style="display:none;">
                  <div class="row g-2">
                    <div class="col-md-6">
                      <label class="form-label">Alış Fiyatı (KDV Dahil)</label>
                      <input type="number" id="purchaseIncl" class="form-control" step="0.01" value="0">
                    </div>
                    <div class="col-md-6">
                      <label class="form-label">Satış Fiyatı (KDV Dahil)</label>
                      <input type="number" id="saleIncl" class="form-control" step="0.01" value="0">
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
              <button type="submit" class="btn btn-primary">Kaydet</button>
            </div>
          </form>
        </div>
      </div>
    </div>
    <!-- Silme Onay Modalı -->
    <div class="modal fade" id="deleteModal" tabindex="-1" aria-labelledby="deleteModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-danger text-white">
            <h5 class="modal-title" id="deleteModalLabel">Ürünü Sil</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Kapat"></button>
          </div>
          <div class="modal-body">
            <p>Bu ürünü silmek istediğinize emin misiniz?</p>
            <input type="hidden" id="deleteProductId">
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button>
            <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Sil</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Ürünleri çek
  const { data, error } = await supabase.from('products').select('*').eq('owner_id', getCurrentUserId());
  const wrapper = document.getElementById('servicesProductsTableWrapper');

  // Liste durumu
  const state = {
    raw: data || [],
    search: '',
    category: '',
    sort: 'name_asc',
    view: 'grid',
    page: 1,
    pageSize: 12,
    skeleton: false
  };

  // Eğer hiç ürün yoksa yine de modal ekleme vb. çalışsın diye state hazırlandıktan sonra kontrol
  if (!data || data.length === 0) {
    document.getElementById('paginationBar').style.display = 'none';
    wrapper.innerHTML = `<div class="alert alert-warning">Hiç ürün bulunamadı. <button class='btn btn-sm btn-success ms-2' id='emptyAddBtn'><i class="bi bi-plus-circle me-1"></i>Ürün Ekle</button></div>`;
    document.getElementById('emptyAddBtn').onclick = () => openProductModal();
  }

  // Kategorileri doldur (adet rozetli)
  const counts = data.reduce((acc, item) => {
    if (item.category) acc[item.category] = (acc[item.category]||0)+1; else acc['_YOK_'] = (acc['_YOK_']||0)+1;
    return acc;
  }, {});
  const categorySelect = document.getElementById('categoryFilterSelect');
  Object.entries(counts)
    .filter(([k]) => k !== '_YOK_')
    .sort((a,b)=> a[0].localeCompare(b[0],'tr'))
    .forEach(([cat, c]) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${cat} (${c})`;
      categorySelect.appendChild(opt);
    });

  function applyFiltersAndSort() {
    let items = [...state.raw];
    if (state.search) {
      const s = state.search.toLowerCase();
      items = items.filter(it => (it.name||'').toLowerCase().includes(s) || (it.category||'').toLowerCase().includes(s));
    }
    if (state.category) {
      items = items.filter(it => it.category === state.category);
    }
    switch(state.sort) {
      case 'name_asc': items.sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'tr')); break;
      case 'name_desc': items.sort((a,b)=> (b.name||'').localeCompare(a.name||'', 'tr')); break;
      case 'price_asc': items.sort((a,b)=> (a.price||0) - (b.price||0)); break;
      case 'price_desc': items.sort((a,b)=> (b.price||0) - (a.price||0)); break;
      case 'stock_asc': items.sort((a,b)=> (a.stock||0) - (b.stock||0)); break;
      case 'stock_desc': items.sort((a,b)=> (b.stock||0) - (a.stock||0)); break;
    }
    return items;
  }

  function updateSummary(filtered) {
    const summary = document.getElementById('summaryBar');
    const start = (state.page - 1) * state.pageSize + 1;
    const end = Math.min(state.page * state.pageSize, filtered.length);
    summary.textContent = `${filtered.length} kayıt | Gösterilen: ${filtered.length === 0 ? 0 : start + '-' + end}` + (state.search ? ` | Arama: "${state.search}"` : '') + (state.category ? ` | Kategori: ${state.category}` : '');
  }

  function renderPagination(total) {
    const bar = document.getElementById('paginationBar');
    const ul = document.getElementById('pagination');
    const totalPages = Math.ceil(total / state.pageSize) || 1;
    if (totalPages <= 1) { bar.style.display='none'; return; }
    bar.style.display='flex';
    if (state.page > totalPages) state.page = totalPages; // guard
    let html = '';
    const createLi = (p, label, disabled = false, active = false) => {
      return `<li class="page-item ${disabled?'disabled':''} ${active?'active':''}"><a class="page-link" href="#" data-page="${p}">${label}</a></li>`;
    };
    html += createLi(state.page-1, '&laquo;', state.page===1);
    // Sayfa numaraları (dinamik kısaltma)
    const maxShown = 5;
    let startPage = Math.max(1, state.page - Math.floor(maxShown/2));
    let endPage = startPage + maxShown - 1;
    if (endPage > totalPages) { endPage = totalPages; startPage = Math.max(1, endPage - maxShown + 1); }
    if (startPage > 1) html += createLi(1, '1');
    if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    for (let p = startPage; p <= endPage; p++) html += createLi(p, p, false, p===state.page);
    if (endPage < totalPages -1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    if (endPage < totalPages) html += createLi(totalPages, totalPages);
    html += createLi(state.page+1, '&raquo;', state.page===totalPages);
    ul.innerHTML = html;
    ul.querySelectorAll('a[data-page]').forEach(a => {
      a.onclick = (e) => { e.preventDefault(); const p = Number(a.dataset.page); if (!isNaN(p)) { state.page = p; syncAndRender(false); window.scrollTo({top:0, behavior:'smooth'}); } };
    });
  }

  function renderActiveFilters() {
    const c = document.getElementById('activeFilters');
    const chips = [];
    if (state.search) chips.push(`<span class='badge rounded-pill bg-light text-dark border'>Arama: ${state.search} <button type='button' class='btn-close btn-close-white ms-1 filter-chip' data-filter='search'></button></span>`);
    if (state.category) chips.push(`<span class='badge rounded-pill bg-secondary'>Kategori: ${state.category} <button type='button' class='btn-close btn-close-white ms-1 filter-chip' data-filter='category'></button></span>`);
    c.innerHTML = chips.join('');
    c.querySelectorAll('.filter-chip').forEach(btn => {
      btn.onclick = () => {
        const f = btn.dataset.filter;
        if (f === 'search') { state.search=''; document.getElementById('productSearchInput').value=''; }
        if (f === 'category') { state.category=''; categorySelect.value=''; }
        syncAndRender();
      };
    });
  }

  function skeletonCards() {
    let html = '<div class="row g-4">';
    for (let i=0;i<Math.min(state.pageSize,6);i++) {
      html += `<div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100 shadow-sm border-0 placeholder-glow">
          <div class="card-body">
            <h5 class="card-title"><span class="placeholder col-8"></span></h5>
            <p class="card-text"><span class="placeholder col-4"></span></p>
            <p class="card-text"><span class="placeholder col-6"></span></p>
            <div class='d-flex gap-2 mt-3'>
              <span class="btn btn-sm btn-outline-secondary disabled placeholder col-3"></span>
              <span class="btn btn-sm btn-outline-secondary disabled placeholder col-3"></span>
            </div>
          </div>
        </div>
      </div>`;
    }
    html += '</div>';
    wrapper.innerHTML = html;
  }

  function renderGridOrList(items) {
    if (state.skeleton) { skeletonCards(); return; }
    if (items.length === 0) {
      wrapper.innerHTML = `<div class='alert alert-info mt-3'>Filtrelere uygun ürün bulunamadı.</div>`;
      return;
    }
    // Pagination slice
    const total = items.length;
    const startIndex = (state.page -1) * state.pageSize;
    const paged = items.slice(startIndex, startIndex + state.pageSize);
    if (state.view === 'list') {
      let html = `<div class='table-responsive'><table class='table table-sm table-hover align-middle'><thead><tr><th>Ad</th><th>Kategori</th><th>Stok</th><th>Satış Fiyatı</th><th></th></tr></thead><tbody>`;
      paged.forEach(it => {
        html += `<tr>
          <td>${it.name||'-'}</td>
          <td>${it.category||'<span class="text-muted">Yok</span>'}</td>
          <td>${it.stock ?? '-'}</td>
          <td>${(it.sale_price ?? it.price) ? (it.sale_price ?? it.price) + ' ₺' : '-'}</td>
          <td class='text-end'>
            <div class='btn-group btn-group-sm'>
              <button class='btn btn-outline-primary edit-product-btn' data-id='${it.id}' data-name='${it.name||''}' data-category='${it.category||''}' data-stock='${it.stock??''}' data-price='${it.price??''}' title='Düzenle'><i class='bi bi-pencil'></i></button>
              <button class='btn btn-outline-danger delete-product-btn' data-id='${it.id}' title='Sil'><i class='bi bi-trash'></i></button>
            </div>
          </td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
      wrapper.innerHTML = html;
      attachRowActions();
    } else {
      let grid = `<div class="row g-4">`;
      paged.forEach(it => {
        grid += `<div class="col-12 col-md-6 col-lg-4">
          <div class="card h-100 shadow-sm border-0">
            <div class="card-body d-flex flex-column justify-content-between">
              <div>
                <div class='d-flex justify-content-between align-items-start mb-2'>
                  <h5 class="card-title fw-bold text-dark mb-0">${it.name || '-'} </h5>
                  <span class='badge bg-light text-dark border'>${it.stock ?? 0} stk</span>
                </div>
                <div class="mb-2"><span class="badge bg-secondary">${it.category || 'Kategori Yok'}</span></div>
                <div class="text-muted small mb-2">Satış Fiyatı: <strong>${(it.sale_price ?? it.price) ? (it.sale_price ?? it.price) + ' ₺' : '-'}</strong></div>
              </div>
              <div class="mt-2 d-flex flex-wrap gap-2">
                <button class='btn btn-sm btn-outline-primary edit-product-btn' data-id='${it.id}' data-name='${it.name||''}' data-category='${it.category||''}' data-stock='${it.stock??''}' data-price='${it.price??''}' title='Düzenle'><i class='bi bi-pencil'></i></button>
                <button class='btn btn-sm btn-outline-danger delete-product-btn' data-id='${it.id}' title='Sil'><i class='bi bi-trash'></i></button>
              </div>
            </div>
          </div>
        </div>`;
      });
      grid += '</div>';
      wrapper.innerHTML = grid;
      attachRowActions();
    }
    renderPagination(total);
  }

  function attachRowActions() {
    document.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.onclick = () => openProductModal({ id: btn.dataset.id });
    });
    document.querySelectorAll('.delete-product-btn').forEach(btn => btn.onclick = () => openDeleteModal(btn.dataset.id));
  }

  function syncAndRender(showSkeleton = true) {
    const filtered = applyFiltersAndSort();
    // Sayfa sınırı: filtre değişince ilk sayfaya dön
    if (state.page !== 1 && showSkeleton) state.page = 1;
    renderActiveFilters();
    if (showSkeleton) {
      state.skeleton = true;
      renderGridOrList(filtered);
      setTimeout(()=> { state.skeleton = false; renderGridOrList(filtered); updateSummary(filtered); document.getElementById('clearSearchBtn').classList.toggle('d-none', !state.search); }, 300);
    } else {
      state.skeleton = false;
      renderGridOrList(filtered);
      updateSummary(filtered);
      document.getElementById('clearSearchBtn').classList.toggle('d-none', !state.search);
    }
  }

  // İlk render
  syncAndRender();

  // --- Events ---
  let searchDebounce;
  document.getElementById('productSearchInput').addEventListener('input', function() {
    state.search = this.value.trim();
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(()=>syncAndRender(), 300);
  });
  document.getElementById('clearSearchBtn').onclick = () => { state.search=''; document.getElementById('productSearchInput').value=''; syncAndRender(); };
  categorySelect.addEventListener('change', function() { state.category = this.value.replace(/ \(.*\)$/,''); syncAndRender(); });
  document.getElementById('sortSelect').addEventListener('change', function(){ state.sort = this.value; syncAndRender(); });
  document.getElementById('viewGridBtn').onclick = () => { state.view='grid'; document.getElementById('viewGridBtn').classList.add('active'); document.getElementById('viewListBtn').classList.remove('active'); syncAndRender(false); };
  document.getElementById('viewListBtn').onclick = () => { state.view='list'; document.getElementById('viewListBtn').classList.add('active'); document.getElementById('viewGridBtn').classList.remove('active'); syncAndRender(false); };
  document.getElementById('resetFiltersBtn').onclick = () => { state.search=''; state.category=''; state.sort='name_asc'; state.view='grid'; state.page=1; document.getElementById('productSearchInput').value=''; categorySelect.value=''; document.getElementById('sortSelect').value='name_asc'; document.getElementById('viewGridBtn').classList.add('active'); document.getElementById('viewListBtn').classList.remove('active'); syncAndRender(); };
  document.getElementById('pageSizeSelect').addEventListener('change', function(){ state.pageSize = Number(this.value)||12; state.page=1; syncAndRender(false); });

  // Satış modali ve ilgili akış kaldırıldı: satışlar Faturalar panelinden yapılır.

  // Satış butonu/akışı kaldırıldı

  // Satış formu/handler kaldırıldı

  // Buton eventleri
  document.getElementById('addProductBtn').onclick = () => openProductModal();
  document.querySelectorAll('.edit-product-btn').forEach(btn => {
    btn.onclick = () => openProductModal({ id: btn.dataset.id });
  });
  document.querySelectorAll('.delete-product-btn').forEach(btn => {
    btn.onclick = () => openDeleteModal(btn.dataset.id);
  });

  // Modal fonksiyonları
  async function openProductModal(product = null) {
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
    document.getElementById('productForm').reset();
    // Eğer sadece id geldiyse, veritabanından tam ürünü çek
    if (product && product.id && (!product.name || !('barcode' in product))) {
      const { data: full, error: prodErr } = await supabase.from('products').select('*').eq('id', product.id).single();
      if (!prodErr && full) {
        product = full;
      }
    }
    document.getElementById('productId').value = product?.id || '';
    document.getElementById('productName').value = product?.name || '';
    document.getElementById('productCode').value = product?.code || '';
    document.getElementById('productBarcode').value = product?.barcode || '';
    document.getElementById('productCategory').value = product?.category || '';
    document.getElementById('productUnit').value = product?.unit || 'Adet';
    document.getElementById('productPhotoUrl').value = product?.photo_url || '';
    document.getElementById('productGtip').value = product?.gtip_code || '';
    document.getElementById('stockTrackingSwitch').checked = (product?.stock_tracking ?? true) ? true : false;
  // KDV oranı ve fiyat alanlarını doldur
  document.getElementById('vatRate').value = product?.vat_rate ?? 20;
  const vatFactor = 1 + ((product?.vat_rate ?? 20) / 100);
  const pEx = Number(product?.purchase_price ?? 0);
  const sEx = Number((product?.sale_price ?? product?.price) ?? 0);
  // KDV hariç alanlar
  const purchaseExclEl = document.getElementById('purchaseExcl');
  const saleExclEl = document.getElementById('saleExcl');
  purchaseExclEl.value = pEx.toFixed(2);
  saleExclEl.value = sEx.toFixed(2);
  // KDV dahil alanlar (gösterge amaçlı)
  const purchaseInclEl = document.getElementById('purchaseIncl');
  const saleInclEl = document.getElementById('saleIncl');
  purchaseInclEl.value = (pEx * vatFactor).toFixed(2);
  saleInclEl.value = (sEx * vatFactor).toFixed(2);
  // Varsayılan giriş modu: yeni kayıtta KDV Hariç, düzenlemede de KDV Hariç kalsın
  document.getElementById('priceModeExcl').checked = true;
  document.getElementById('groupExcl').style.display = '';
  document.getElementById('groupIncl').style.display = 'none';
    document.getElementById('criticalTotal').value = product?.critical_stock_total ?? '';
  document.getElementById('critTotal').checked = true;
  document.getElementById('criticalTotalRow').style.display = '';
    document.getElementById('productModalLabel').textContent = product ? 'Ürünü Güncelle' : 'Ürün Ekle';
    // Depoları yükle ve başlangıç stok alanlarını oluştur
    loadWarehousesIntoForm(product);
  // Fiyat modu değişimi (KDV Hariç / KDV Dahil)
  const toggleGroups = () => {
    const mode = document.querySelector('input[name="priceMode"]:checked')?.value || 'excl';
    const vatRate = Number(document.getElementById('vatRate').value) || 0;
    const f = 1 + (vatRate/100);
    if (mode === 'excl') {
      document.getElementById('groupExcl').style.display = '';
      document.getElementById('groupIncl').style.display = 'none';
      // KDV dahil alanları KDV hariç değerlerden güncelle (önizleme için)
      const p = Number(document.getElementById('purchaseExcl').value) || 0;
      const s = Number(document.getElementById('saleExcl').value) || 0;
      document.getElementById('purchaseIncl').value = (p * f).toFixed(2);
      document.getElementById('saleIncl').value = (s * f).toFixed(2);
    } else {
      document.getElementById('groupExcl').style.display = 'none';
      document.getElementById('groupIncl').style.display = '';
      // KDV hariç alanları KDV dahil değerlerden güncelle
      const p = Number(document.getElementById('purchaseIncl').value) || 0;
      const s = Number(document.getElementById('saleIncl').value) || 0;
      document.getElementById('purchaseExcl').value = (p / f).toFixed(2);
      document.getElementById('saleExcl').value = (s / f).toFixed(2);
    }
  };
  document.getElementById('priceModeExcl').addEventListener('change', toggleGroups);
  document.getElementById('priceModeIncl').addEventListener('change', toggleGroups);
  // KDV oranı veya giriş alanları değişince karşı alanları güncelle
  ['vatRate','purchaseExcl','saleExcl','purchaseIncl','saleIncl'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', toggleGroups);
  });
  toggleGroups();
    modal.show();
  }
  function openDeleteModal(id) {
    document.getElementById('deleteProductId').value = id;
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
  }

  // Form submit (ekle/güncelle)
  document.getElementById('productForm').onsubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;
  const vatRate = Number(document.getElementById('vatRate').value) || 0;
  const f = 1 + (vatRate/100);
  const priceMode = document.querySelector('input[name="priceMode"]:checked')?.value || 'excl';
  const pIncl = Number(document.getElementById('purchaseIncl').value) || 0;
  const sIncl = Number(document.getElementById('saleIncl').value) || 0;
  const pExcl = Number(document.getElementById('purchaseExcl').value) || 0;
  const sExcl = Number(document.getElementById('saleExcl').value) || 0;
  const payload = {
      name: document.getElementById('productName').value?.trim(),
      code: document.getElementById('productCode').value?.trim() || null,
      barcode: document.getElementById('productBarcode').value?.trim() || null,
      category: document.getElementById('productCategory').value?.trim() || null,
      unit: document.getElementById('productUnit').value || 'Adet',
      photo_url: document.getElementById('productPhotoUrl').value?.trim() || null,
      gtip_code: document.getElementById('productGtip').value?.trim() || null,
      stock_tracking: document.getElementById('stockTrackingSwitch').checked,
      vat_rate: vatRate,
      other_taxes: null,
      purchase_price: Number((priceMode === 'incl' ? (pIncl / f) : pExcl).toFixed(2)),
      sale_price: Number((priceMode === 'incl' ? (sIncl / f) : sExcl).toFixed(2)),
      critical_stock_total: document.querySelector('input[name="criticalMode"]:checked')?.value === 'total' ? (Number(document.getElementById('criticalTotal').value) || null) : null
    };
    if (!payload.name) return alert('Ürün adı zorunlu.');

    // Kod benzersizlik kontrolü (insert ve update için)
    if (payload.code) {
      const { data: codeRows, error: codeErr } = await supabase
        .from('products')
        .select('id')
        .eq('code', payload.code);
      if (!codeErr) {
        const existsOther = (codeRows || []).some(r => String(r.id) !== String(id || ''));
        if (existsOther) {
          alert('Bu stok/ürün kodu zaten kayıtlı. Lütfen farklı bir kod girin.');
          document.getElementById('productCode').focus();
          return;
        }
      }
    }

    let productId = id || null;
    if (id) {
  const { error: upErr } = await supabase.from('products').update(payload).eq('id', id).eq('owner_id', getCurrentUserId());
      if (upErr) return alert('Güncelleme hatası: ' + upErr.message);
      productId = id;
      // Depo bazlı stok güncelle (varsa)
      try {
        const whInputs = document.querySelectorAll('#warehouseStockContainer input.warehouse-stock-input');
        const critInputs = document.querySelectorAll('#warehouseStockContainer input.warehouse-crit-input');
        const perWh = document.getElementById('critPerWh').checked;
        const rows = [];
        whInputs.forEach((inp, idx) => {
          const qty = Number(inp.value) || 0;
          const whId = Number(inp.dataset.warehouseId);
          const crit = perWh ? (Number(critInputs[idx]?.value) || null) : null;
          if (!isNaN(whId) && (qty > 0 || crit !== null)) {
            rows.push({ product_id: productId, warehouse_id: whId, quantity: qty, critical_threshold: crit });
          } else if (!isNaN(whId) && qty === 0 && perWh) {
            // kritik eşik girilmiş olabilir; qty 0 da olsa yazalım
            rows.push({ product_id: productId, warehouse_id: whId, quantity: 0, critical_threshold: crit });
          }
        });
        if (rows.length) {
          const { error: psErr } = await supabase.from('product_stocks').upsert(rows);
          if (psErr) {
            const totalQty = rows.reduce((sum, r) => sum + (Number(r.quantity)||0), 0);
            await supabase.from('products').update({ stock: totalQty }).eq('id', productId);
            alert('Uyarı: Depo bazlı stoklar güncellenemedi, toplam stok ürün tablosuna yazıldı.\nDetay: ' + psErr.message);
          } else {
            const totalQty = rows.reduce((sum, r) => sum + (Number(r.quantity)||0), 0);
            await supabase.from('products').update({ stock: totalQty }).eq('id', productId);
          }
        } else {
          const totalInp = document.getElementById('initialTotalStock');
          if (totalInp) {
            const totalQty = Number(totalInp.value) || 0;
            await supabase.from('products').update({ stock: totalQty }).eq('id', productId);
          }
        }
      } catch (e) {
        const totalInp = document.getElementById('initialTotalStock');
        if (totalInp) {
          const totalQty = Number(totalInp.value) || 0;
          await supabase.from('products').update({ stock: totalQty }).eq('id', productId);
        }
        console.warn('Stok güncelleme (update) hatası:', e);
      }
    } else {
      // Insert new product
  const owner_id = getCurrentUserId();
  const { data: insData, error: insErr } = await supabase.from('products').insert([{ ...payload, owner_id }]).select('id').single();
      if (insErr) {
        if (insErr.code === '23505') {
          alert('Ekleme hatası: Bu stok/ürün kodu zaten kayıtlı. Lütfen farklı bir kod girin.');
        } else {
          alert('Ekleme hatası: ' + insErr.message);
        }
        return;
      }
      productId = insData.id;
      // Başlangıç stoklarını product_stocks tablosuna yaz (depolar varsa)
      try {
        const whInputs = document.querySelectorAll('#warehouseStockContainer input.warehouse-stock-input');
        const critInputs = document.querySelectorAll('#warehouseStockContainer input.warehouse-crit-input');
        const perWh = document.getElementById('critPerWh').checked;
        const rows = [];
        whInputs.forEach((inp, idx) => {
          const qty = Number(inp.value) || 0;
          const whId = Number(inp.dataset.warehouseId);
          const crit = perWh ? (Number(critInputs[idx]?.value) || null) : null;
          if (!isNaN(whId) && (qty > 0 || crit !== null)) {
            rows.push({ product_id: productId, warehouse_id: whId, quantity: qty, critical_threshold: crit });
          }
        });
        if (rows.length) {
          const { error: psErr } = await supabase.from('product_stocks').upsert(rows);
          if (psErr) {
            // Tablo yoksa veya erişimde hata varsa: toplam stoğu doğrudan products.tablosuna yaz
            const totalQty = rows.reduce((sum, r) => sum + (Number(r.quantity)||0), 0);
            await supabase.from('products').update({ stock: totalQty }).eq('id', productId);
            alert('Uyarı: Depo bazlı stok tablosuna kaydedilemedi, toplam stok ürün tablosuna yazıldı.\nDetay: ' + psErr.message);
          } else {
            // Fallback: toplam stoğu doğrudan products tablosuna yaz (trigger yoksa)
            const totalQty = rows.reduce((sum, r) => sum + (Number(r.quantity)||0), 0);
            await supabase.from('products').update({ stock: totalQty }).eq('id', productId);
          }
        } else {
          // Depo bulunmuyorsa veya hiç miktar girilmediyse genel başlangıç stok alanını kullan
          const totalInp = document.getElementById('initialTotalStock');
          if (totalInp) {
            const totalQty = Number(totalInp.value) || 0;
            await supabase.from('products').update({ stock: totalQty }).eq('id', productId);
          }
        }
      } catch (e) {
        // Son çare: genel başlangıç stok alanı varsa onu yazmayı dene
        const totalInp = document.getElementById('initialTotalStock');
        if (totalInp) {
          const totalQty = Number(totalInp.value) || 0;
          await supabase.from('products').update({ stock: totalQty }).eq('id', productId);
        }
        alert('Başlangıç stoklarını kaydederken hata oluştu. Toplam stok ürün tablosuna yazılmaya çalışıldı.\nDetay: ' + (e?.message || e));
      }
    }

    bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
    renderServicesProductsPanel();
  };

  // Silme işlemi
  document.getElementById('confirmDeleteBtn').onclick = async function() {
    const id = document.getElementById('deleteProductId').value;
    try {
  await supabase.from('products').delete().eq('id', id).eq('owner_id', getCurrentUserId());
    } catch (err) {
      alert('Silme işlemi sırasında hata oluştu: ' + (err?.message || err));
    }
    bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
    renderServicesProductsPanel();
  };

  // --- Yardımcılar: Depoları yükle & fiyat hesapla ---
  async function loadWarehousesIntoForm(product) {
    const container = document.getElementById('warehouseStockContainer');
    container.innerHTML = `<div class="col-12 text-muted small">Depolar yükleniyor...</div>`;
  const { data: whs, error: whErr } = await supabase.from('warehouses').select('*').eq('owner_id', getCurrentUserId()).order('id');
    if (whErr) {
      container.innerHTML = `<div class="col-12"><div class="alert alert-warning">Depolar yüklenemedi: ${whErr.message}</div></div>`;
      return;
    }
    if (!whs || whs.length === 0) {
      container.innerHTML = `
        <div class="col-12">
          <div class="alert alert-info py-2">
            Tanımlı depo bulunamadı. Depo bazlı stok girişi için önce <strong>Depolar</strong> sayfasından depo ekleyin.
          </div>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label">Genel Başlangıç Stok</label>
          <input type="number" class="form-control" id="initialTotalStock" step="0.01" placeholder="Örn. 10">
        </div>
      `;
      return;
    }
    const perWh = document.getElementById('critPerWh');
    const critTotalRow = document.getElementById('criticalTotalRow');

    // Düzenleme modunda mevcut depo stoklarını çek
    let prodStocks = [];
    if (product && product.id) {
      const { data: ps, error: psErr } = await supabase
        .from('product_stocks')
        .select('warehouse_id, quantity, critical_threshold')
        .eq('product_id', product.id);
      if (!psErr && Array.isArray(ps)) prodStocks = ps;
    }

    // Kritik modunu mevcut verilere göre ayarla
    const hasPerWhCrit = prodStocks.some(r => r.critical_threshold !== null && r.critical_threshold !== undefined);
    if (hasPerWhCrit) {
      perWh.checked = true;
      critTotalRow.style.display = 'none';
    } else {
      // Toplam kritik değer varsa total modda kalsın (default zaten total)
      critTotalRow.style.display = '';
    }
    const renderRows = () => {
      const perMode = perWh.checked;
      critTotalRow.style.display = perMode ? 'none' : '';
      let html = '';
      whs.forEach(w => {
        const row = prodStocks.find(r => String(r.warehouse_id) === String(w.id));
        const qtyVal = row ? Number(row.quantity) || 0 : '';
        const critVal = row && perMode ? (row.critical_threshold ?? '') : '';
        html += `
          <div class="col-12 col-md-6">
            <label class="form-label">${w.name}</label>
            <div class="input-group input-group-sm">
              <span class="input-group-text">Miktar</span>
              <input type="number" class="form-control warehouse-stock-input" data-warehouse-id="${w.id}" step="0.01" value="${qtyVal}">
              ${perMode ? `<span class="input-group-text">Kritik</span><input type="number" class="form-control warehouse-crit-input" step="0.01" value="${critVal}">` : ''}
            </div>
          </div>`;
      });
      container.innerHTML = html;
    };
    renderRows();
    document.getElementById('critPerWh').addEventListener('change', renderRows);
    document.getElementById('critTotal').addEventListener('input', ()=>{});
  }

  function handleVatOrInclusiveChange() {
    // Nothing to recompute in UI; excl values are derived on submit.
    // This keeps consistency if future validations are added.
    return;
  }
  ['vatRate','purchaseIncl','saleIncl'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', handleVatOrInclusiveChange);
  });
}

export { renderServicesProductsPanel };
