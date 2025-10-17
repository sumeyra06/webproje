// price-lists-panel.js
// Şık ve modern Fiyat Listeleri paneli
import { supabase } from './supabaseClient.js';

export function renderPriceListsPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  const sessionUser = (()=>{ try { return JSON.parse(localStorage.getItem('sessionUser')||'null'); } catch { return null; } })();
  main.innerHTML = `
    <style>
      /* Şık kart efektleri */
      .pl-card { border-radius:16px; overflow:hidden; transition: all .2s ease; cursor: pointer; }
      .pl-card:hover { transform: translateY(-3px); box-shadow: 0 0.75rem 1.5rem rgba(0,0,0,0.08); }
      .pl-card .pl-ribbon { height: 6px; background: linear-gradient(90deg, #f84343, #fb923c); }
      .pl-card .card-body { background: linear-gradient(180deg, rgba(248,67,67,0.04), rgba(0,0,0,0)); }
      .pl-actions .btn { pointer-events: auto; }
      .pl-actions { pointer-events: none; }
    </style>
    <section class="container py-4">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 class="mb-0" style="font-weight:900; letter-spacing:-0.5px;">Fiyat Listeleri</h2>
          <div class="text-muted" style="font-weight:700;">Ürün ve hizmetleriniz için çoklu fiyat listeleri</div>
        </div>
        <div class="d-flex gap-2">
          <button id="btnCreatePriceList" class="btn btn-sm btn-primary"><i class="bi bi-plus-lg"></i> Yeni Liste</button>
          <button id="btnExportPriceLists" class="btn btn-sm btn-outline-secondary"><i class="bi bi-download"></i> Dışa Aktar</button>
        </div>
      </div>

      <div class="card shadow-sm" style="border-radius:16px;">
        <div class="card-body">
          ${!sessionUser ? `<div class="alert alert-warning mb-3">Fiyat listelerini görmek için lütfen giriş yapın.</div>` : ''}
          <div class="row g-3 align-items-end">
            <div class="col-md-4">
              <label class="form-label fw-bold">Liste Adı</label>
              <input id="filterName" class="form-control" placeholder="Örn: Bayi, Perakende, İhracat"/>
            </div>
            <div class="col-md-4">
              <label class="form-label fw-bold">Durum</label>
              <select id="filterStatus" class="form-select">
                <option value="">Tümü</option>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
            <div class="col-md-4 d-flex gap-2">
              <button id="btnFilter" class="btn btn-dark w-100"><i class="bi bi-funnel"></i> Filtrele</button>
              <button id="btnClear" class="btn btn-outline-secondary w-100">Temizle</button>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3 mt-3" id="priceListsGrid"></div>
    </section>

    <!-- Create/Edit Modal -->
    <div class="modal fade" id="priceListModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <form id="priceListForm">
            <div class="modal-header bg-dark text-white">
              <h5 class="modal-title" id="priceListModalTitle">Yeni Fiyat Listesi</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label fw-bold">Liste Adı</label>
                  <input id="plName" class="form-control" required placeholder="Örn: Bayi"/>
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold">Durum</label>
                  <select id="plStatus" class="form-select">
                    <option value="active">Aktif</option>
                    <option value="inactive">Pasif</option>
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label fw-bold">Açıklama</label>
                  <textarea id="plDesc" class="form-control" rows="2" placeholder="Opsiyonel"></textarea>
                </div>
              </div>

              <hr/>
              <div>
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <strong>Kalemler</strong>
                  <div>
                    <button type="button" id="btnAddRow" class="btn btn-sm btn-outline-primary"><i class="bi bi-plus"></i> Satır Ekle</button>
                  </div>
                </div>
                <div class="table-responsive">
                  <table class="table align-middle">
                    <thead>
                      <tr>
                        <th style="min-width:220px;">Ürün/Hizmet</th>
                        <th style="width:130px;">Birim Fiyat</th>
                        <th style="width:130px;">Para Birimi</th>
                        <th style="width:130px;">İskonto (%)</th>
                        <th style="width:60px;"></th>
                      </tr>
                    </thead>
                    <tbody id="plItems"></tbody>
                  </table>
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
    
    <!-- Details Modal -->
    <div class="modal fade" id="priceListDetailsModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header bg-light">
            <div>
              <h5 class="modal-title" id="plDetailsTitle">Fiyat Listesi</h5>
              <div class="small text-muted" id="plDetailsMeta"></div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p class="mb-3" id="plDetailsDesc"></p>
            <div class="table-responsive">
              <table class="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Ürün/Hizmet</th>
                    <th class="text-end">Birim Fiyat</th>
                    <th>Para Birimi</th>
                    <th class="text-end">İskonto (%)</th>
                  </tr>
                </thead>
                <tbody id="plDetailsItems"></tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-danger" id="btnDeleteFromDetails"><i class="bi bi-trash"></i> Sil</button>
            <button type="button" class="btn btn-primary" id="btnEditFromDetails"><i class="bi bi-pencil"></i> Düzenle</button>
          </div>
        </div>
      </div>
    </div>
  `;

  attachPriceListsPanel();
}

function attachPriceListsPanel() {
  const nameInput = document.getElementById('filterName');
  const statusSel = document.getElementById('filterStatus');
  document.getElementById('btnFilter')?.addEventListener('click', () => loadLists(nameInput.value.trim(), statusSel.value));
  document.getElementById('btnClear')?.addEventListener('click', () => {
    nameInput.value=''; statusSel.value=''; loadLists('', '');
  });
  document.getElementById('btnCreatePriceList')?.addEventListener('click', openCreateModal);
  document.getElementById('btnExportPriceLists')?.addEventListener('click', exportListsCSV);
  loadLists('', '');
}

async function loadLists(nameLike, status) {
  const grid = document.getElementById('priceListsGrid');
  if (!grid) return;
  grid.innerHTML = `<div class="text-center py-3 text-muted">Yükleniyor...</div>`;
  try {
    const sessionUser = (()=>{ try { return JSON.parse(localStorage.getItem('sessionUser')||'null'); } catch { return null; } })();
    const ownerId = sessionUser?.id || null;
    if (!ownerId) {
      grid.innerHTML = `<div class='alert alert-info'>Giriş yapmadığınız için liste bulunmuyor.</div>`;
      return;
    }
    let q = supabase.from('price_lists')
      .select('id, name, status, description, updated_at, price_list_items(count)')
      .order('updated_at', { ascending: false });
    q = q.eq('owner_id', ownerId);
    if (nameLike) q = q.ilike('name', `%${nameLike}%`);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    const shaped = (data||[]).map(r => ({
      id: r.id,
      name: r.name,
      status: r.status,
      desc: r.description,
      items: (r.price_list_items?.[0]?.count) || 0,
      updated_at: (r.updated_at||'').slice(0,10)
    }));

    grid.innerHTML = shaped.map(renderListCard).join('') || `<div class='text-center py-3 text-muted'>Kayıt bulunamadı</div>`;
    // Kart tıklayınca detay aç, butonlarda propagasyonu durdur
    grid.querySelectorAll('[data-pl-id] .pl-card')?.forEach(card => {
      card.addEventListener('click', (e) => {
        // Buton tıklamaları kart tıklamasını tetiklemesin
        const target = e.target;
        if (target.closest && (target.closest('.btn-edit') || target.closest('.btn-delete'))) return;
        const id = parseInt(card.closest('[data-pl-id]').dataset.plId);
        openDetailsModal(id);
      });
    });
    grid.querySelectorAll('[data-pl-id] .btn-edit')?.forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(parseInt(btn.closest('[data-pl-id]').dataset.plId));
    }));
    grid.querySelectorAll('[data-pl-id] .btn-delete')?.forEach(btn => btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.closest('[data-pl-id]').dataset.plId);
      await deleteList(id);
    }));
  } catch (e) {
    console.error('loadLists error', e);
    grid.innerHTML = `<div class='alert alert-danger'>Listeler yüklenemedi: ${e.message}</div>`;
  }
}

function renderListCard(x) {
  const badge = x.status==='active' ? `<span class='badge bg-success'>Aktif</span>` : `<span class='badge bg-secondary'>Pasif</span>`;
  return `
  <div class="col-12 col-md-6 col-xl-4" data-pl-id="${x.id}">
    <div class="card h-100 shadow-sm pl-card">
      <div class="pl-ribbon"></div>
      <div class="card-body d-flex flex-column">
        <div class="d-flex align-items-start justify-content-between mb-1">
          <div>
            <h5 class="mb-1" style="font-weight:900;">${x.name} ${badge}</h5>
            <div class="text-muted small">${x.desc||''}</div>
          </div>
          <div class="pl-actions d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary btn-edit" title="Düzenle"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger btn-delete" title="Sil"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        <div class="mt-auto d-flex align-items-center justify-content-between small text-muted">
          <span><i class="bi bi-list-ul"></i> ${x.items} kalem</span>
          <span><i class="bi bi-clock"></i> Güncellendi: ${x.updated_at}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function openCreateModal() {
  const m = new bootstrap.Modal(document.getElementById('priceListModal'));
  document.getElementById('priceListModalTitle').textContent = 'Yeni Fiyat Listesi';
  document.getElementById('plName').value = '';
  document.getElementById('plStatus').value = 'active';
  document.getElementById('plDesc').value = '';
  document.getElementById('plItems').innerHTML = '';
  addRow();
  m.show();
  attachFormSubmit(null);
}

function openEditModal(id) {
  const sessionUser = (()=>{ try { return JSON.parse(localStorage.getItem('sessionUser')||'null'); } catch { return null; } })();
  const ownerId = sessionUser?.id || null;
  if (!ownerId) { alert('Giriş yapınız.'); return; }
  const m = new bootstrap.Modal(document.getElementById('priceListModal'));
  document.getElementById('priceListModalTitle').textContent = 'Fiyat Listesi Düzenle';
  // DB'den getir
  (async () => {
    const { data, error } = await supabase
      .from('price_lists')
      .select('id, name, status, description, price_list_items(id, product_id, product_name, price, currency, discount)')
      .eq('id', id)
      .eq('owner_id', ownerId)
      .single();
    if (error || !data) { alert('Liste bulunamadı veya erişim yok.'); return; }
    document.getElementById('plName').value = data.name || '';
    document.getElementById('plStatus').value = data.status || 'active';
    document.getElementById('plDesc').value = data.description || '';
    const tbody = document.getElementById('plItems');
    tbody.innerHTML = '';
    (data.price_list_items||[]).forEach(it => addRow({ product_name: it.product_name, price: it.price, currency: it.currency, discount: it.discount }));
    if (!data.price_list_items || !data.price_list_items.length) addRow();
    m.show();
    attachFormSubmit(id);
  })();
}

function addRow(prefill) {
  const tbody = document.getElementById('plItems');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="form-control" placeholder="Ürün/Hizmet adı" value="${prefill?.product_name||''}"></td>
    <td><input type="number" step="0.01" class="form-control text-end" placeholder="0.00" value="${prefill?.price||''}"></td>
    <td>
      <select class="form-select">
        <option value="TRY" ${prefill?.currency==='TRY'?'selected':''}>TRY</option>
        <option value="USD" ${prefill?.currency==='USD'?'selected':''}>USD</option>
        <option value="EUR" ${prefill?.currency==='EUR'?'selected':''}>EUR</option>
      </select>
    </td>
    <td><input type="number" step="0.01" class="form-control text-end" placeholder="0" value="${prefill?.discount||0}"></td>
    <td><button type="button" class="btn btn-sm btn-outline-danger btn-del"><i class="bi bi-x"></i></button></td>
  `;
  tbody.appendChild(tr);
  tr.querySelector('.btn-del')?.addEventListener('click', () => tr.remove());
}

function attachFormSubmit(id) {
  const form = document.getElementById('priceListForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const sessionUser = (()=>{ try { return JSON.parse(localStorage.getItem('sessionUser')||'null'); } catch { return null; } })();
    const ownerId = sessionUser?.id || null;
    if (!ownerId) { alert('Giriş yapınız.'); return; }
    const name = document.getElementById('plName').value.trim();
    const status = document.getElementById('plStatus').value;
    const desc = document.getElementById('plDesc').value.trim();
    const rows = Array.from(document.querySelectorAll('#plItems tr')).map(tr => {
      const tds = tr.querySelectorAll('td');
      return {
        product_name: tds[0].querySelector('input').value.trim(),
        price: parseFloat(tds[1].querySelector('input').value) || 0,
        currency: tds[2].querySelector('select').value,
        discount: parseFloat(tds[3].querySelector('input').value) || 0
      };
    }).filter(x => x.product_name);

    if (!name) return alert('Liste adı zorunludur.');
    if (!rows.length) return alert('En az bir satır ekleyiniz.');

    try {
      if (!id) {
        const { data, error } = await supabase.from('price_lists').insert([{ name, status, description: desc, owner_id: ownerId }]).select('id').single();
        if (error) throw error;
        const plId = data.id;
        if (rows.length) {
          const itemsPayload = rows.map(r => ({ price_list_id: plId, product_name: r.product_name, price: r.price, currency: r.currency, discount: r.discount }));
          const { error: e2 } = await supabase.from('price_list_items').insert(itemsPayload);
          if (e2) throw e2;
        }
      } else {
        // Ownership guard on update
        const { error: e1 } = await supabase.from('price_lists').update({ name, status, description: desc }).eq('id', id).eq('owner_id', ownerId);
        if (e1) throw e1;
        // Basit strateji: mevcut kalemleri sil ve yeniden ekle
        const { error: eDel } = await supabase.from('price_list_items').delete().eq('price_list_id', id);
        if (eDel) throw eDel;
        if (rows.length) {
          const itemsPayload = rows.map(r => ({ price_list_id: id, product_name: r.product_name, price: r.price, currency: r.currency, discount: r.discount }));
          const { error: eIns } = await supabase.from('price_list_items').insert(itemsPayload);
          if (eIns) throw eIns;
        }
      }
      bootstrap.Modal.getInstance(document.getElementById('priceListModal'))?.hide();
      await loadLists('', '');
    } catch (e) {
      alert('Kaydedilemedi: ' + (e?.message||e));
    }
  };
  document.getElementById('btnAddRow')?.addEventListener('click', () => addRow());
}

function exportListsCSV() {
  (async () => {
    const { data, error } = await supabase
      .from('price_lists')
      .select('name, status, updated_at, price_list_items(count)');
    if (error) { alert('Dışa aktarma başarısız: ' + error.message); return; }
    const rows = [ ['Ad','Durum','Kalem Sayısı','Güncelleme'] ]
      .concat((data||[]).map(r => [ r.name, r.status==='active'?'Aktif':'Pasif', (r.price_list_items?.[0]?.count)||0, (r.updated_at||'').slice(0,10) ]));
    const csv = rows.map(r=>r.map(cell => '"'+String(cell).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fiyat-listeleri.csv'; a.click();
    URL.revokeObjectURL(url);
  })();
}

async function deleteList(id) {
  if (!id) return;
  const sessionUser = (()=>{ try { return JSON.parse(localStorage.getItem('sessionUser')||'null'); } catch { return null; } })();
  const ownerId = sessionUser?.id || null;
  if (!ownerId) { alert('Giriş yapınız.'); return; }
  const ok = confirm('Bu fiyat listesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.');
  if (!ok) return;
  try {
    // Delete guarded by owner_id
    const { error } = await supabase.from('price_lists').delete().eq('id', id).eq('owner_id', ownerId);
    if (error) throw error;
    await loadLists('', '');
  } catch (e) {
    alert('Silinemedi: ' + (e?.message||e));
  }
}

function openDetailsModal(id) {
  const m = new bootstrap.Modal(document.getElementById('priceListDetailsModal'));
  // Başlık varsayılan
  document.getElementById('plDetailsTitle').textContent = 'Fiyat Listesi';
  document.getElementById('plDetailsMeta').textContent = '';
  document.getElementById('plDetailsDesc').textContent = '';
  document.getElementById('plDetailsItems').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Yükleniyor...</td></tr>';

  (async () => {
    const sessionUser = (()=>{ try { return JSON.parse(localStorage.getItem('sessionUser')||'null'); } catch { return null; } })();
    const ownerId = sessionUser?.id || null;
    if (!ownerId) { alert('Giriş yapınız.'); return; }
    const { data, error } = await supabase
      .from('price_lists')
      .select('id, name, status, description, updated_at, price_list_items(product_name, price, currency, discount)')
      .eq('id', id)
      .eq('owner_id', ownerId)
      .single();
    if (error || !data) { alert('Detaylar yüklenemedi veya erişim yok.'); return; }
    const badge = data.status==='active' ? 'Aktif' : 'Pasif';
    document.getElementById('plDetailsTitle').innerHTML = `${data.name} <span class="badge ${data.status==='active'?'bg-success':'bg-secondary'}">${badge}</span>`;
    document.getElementById('plDetailsMeta').textContent = `Güncellendi: ${(data.updated_at||'').slice(0,10)}`;
    document.getElementById('plDetailsDesc').textContent = data.description || '';
    const tbody = document.getElementById('plDetailsItems');
    const items = data.price_list_items || [];
    tbody.innerHTML = items.length ? items.map(it => `
      <tr>
        <td>${it.product_name}</td>
        <td class="text-end">${Number(it.price||0).toFixed(2)}</td>
        <td>${it.currency}</td>
        <td class="text-end">${Number(it.discount||0).toFixed(2)}</td>
      </tr>
    `).join('') : '<tr><td colspan="4" class="text-center text-muted">Kalem yok</td></tr>';

    // Modal alt butonlarını bağla
    const btnEdit = document.getElementById('btnEditFromDetails');
    const btnDelete = document.getElementById('btnDeleteFromDetails');
    btnEdit.onclick = () => { m.hide(); openEditModal(id); };
    btnDelete.onclick = async () => { await deleteList(id); m.hide(); };
  })();

  m.show();
}
