// warehouses-panel.js
import { supabase } from './supabaseClient.js';
const getCurrentUserId = () => { try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; } };

async function renderWarehousesPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2 class="fw-bold text-primary">Depolar</h2>
        <button class="btn btn-success" id="addWarehouseBtn">Yeni Depo Ekle</button>
      </div>
      <div id="warehousesList">Yükleniyor...</div>
    </section>

    <!-- Modal -->
    <div class="modal fade" id="warehouseModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog">
        <div class="modal-content">
          <form id="warehouseForm">
            <input type="hidden" id="warehouseId" />
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">Yeni Depo</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <label class="form-label">Depo Adı</label>
                <input id="warehouseName" class="form-control" required />
              </div>
              <div class="mb-3">
                <label class="form-label">Açık Adresi</label>
                <textarea id="warehouseAddress" class="form-control" rows="2"></textarea>
                <div class="form-check mt-1">
                  <input class="form-check-input" type="checkbox" id="warehouseForeign">
                  <label class="form-check-label" for="warehouseForeign">Adres yurt dışında</label>
                </div>
              </div>
              <div class="row g-2">
                <div class="col-md-6">
                  <label class="form-label">İlçe</label>
                  <input id="warehouseDistrict" class="form-control" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">İl</label>
                  <input id="warehouseCity" class="form-control" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button>
              <button type="submit" class="btn btn-primary" id="warehouseSaveBtn">Kaydet</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.getElementById('addWarehouseBtn').onclick = () => {
    document.getElementById('warehouseForm').reset();
    document.getElementById('warehouseId').value = '';
    document.querySelector('#warehouseModal .modal-title').textContent = 'Yeni Depo';
    document.getElementById('warehouseSaveBtn').textContent = 'Kaydet';
    const modal = new bootstrap.Modal(document.getElementById('warehouseModal'));
    modal.show();
  };

  document.getElementById('warehouseForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('warehouseId').value || null;
    const data = {
      name: document.getElementById('warehouseName').value.trim(),
      address: document.getElementById('warehouseAddress').value.trim(),
      foreign_address: document.getElementById('warehouseForeign').checked,
      district: document.getElementById('warehouseDistrict').value.trim(),
      city: document.getElementById('warehouseCity').value.trim()
    };
    if (id) {
      // update
      const { error } = await supabase.from('warehouses').update(data).eq('id', id).eq('owner_id', getCurrentUserId());
      if (error) {
        alert('Depo güncellenemedi: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('warehouses').insert([{ ...data, owner_id: getCurrentUserId() }]);
      if (error) {
        alert('Depo eklenemedi: ' + error.message);
        return;
      }
    }
    bootstrap.Modal.getInstance(document.getElementById('warehouseModal')).hide();
    await loadWarehouses();
  };

  await loadWarehouses();
}

async function loadWarehouses() {
  const { data, error } = await supabase.from('warehouses').select('*').eq('owner_id', getCurrentUserId()).order('id', { ascending: false }).limit(200);
  const wrapper = document.getElementById('warehousesList');
  if (error) return wrapper.innerHTML = `<div class='alert alert-danger'>Yüklenemedi: ${error.message}</div>`;
  if (!data || data.length === 0) return wrapper.innerHTML = `<div class='alert alert-warning'>Hiç depo bulunamadı.</div>`;
  let html = `<div class='row row-cols-1 row-cols-md-2 g-3'>`;
  data.forEach(w => {
    html += `<div class='col'><div class='card shadow-sm h-100' data-id='${w.id}'><div class='card-body d-flex flex-column'><div class='d-flex justify-content-between align-items-start mb-2'><div><h5 class='card-title mb-0'>${w.name}</h5><div class='small text-muted mt-1'>${w.city || ''} / ${w.district || ''}</div></div><div class='dropdown'>
      <button class='btn btn-sm btn-outline-secondary dropdown-toggle' type='button' id='actions-${w.id}' data-bs-toggle='dropdown' aria-expanded='false'>
        <span class='visually-hidden'>Actions</span>
        <i class='bi bi-three-dots-vertical'></i>
      </button>
      <ul class='dropdown-menu dropdown-menu-end' aria-labelledby='actions-${w.id}'>
        <li><button class='dropdown-item btn-edit' data-id='${w.id}'><i class='bi bi-pencil-square me-2'></i>Düzenle</button></li>
        <li><button class='dropdown-item text-danger btn-delete' data-id='${w.id}'><i class='bi bi-trash me-2'></i>Sil</button></li>
      </ul>
    </div></div><div class='flex-grow-1'><div class='mt-2 text-muted'>${w.address || ''}</div></div></div></div></div>`;
  });
  html += `</div>`;
  wrapper.innerHTML = html;

  // Attach handlers
  wrapper.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', (ev) => {
    const id = ev.currentTarget.getAttribute('data-id');
    openWarehouseForEdit(id);
  }));
  wrapper.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', (ev) => {
    const id = ev.currentTarget.getAttribute('data-id');
    deleteWarehouse(id);
  }));
}

async function openWarehouseForEdit(id) {
  const { data, error } = await supabase.from('warehouses').select('*').eq('id', id).eq('owner_id', getCurrentUserId()).single();
  if (error) return alert('Depo yüklenemedi: ' + error.message);
  document.getElementById('warehouseId').value = data.id;
  document.getElementById('warehouseName').value = data.name || '';
  document.getElementById('warehouseAddress').value = data.address || '';
  document.getElementById('warehouseForeign').checked = !!data.foreign_address;
  document.getElementById('warehouseDistrict').value = data.district || '';
  document.getElementById('warehouseCity').value = data.city || '';
  document.querySelector('#warehouseModal .modal-title').textContent = 'Depoyu Düzenle';
  document.getElementById('warehouseSaveBtn').textContent = 'Güncelle';
  const modal = new bootstrap.Modal(document.getElementById('warehouseModal'));
  modal.show();
}

async function deleteWarehouse(id) {
  if (!confirm('Bu depoyu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
  const { error } = await supabase.from('warehouses').delete().eq('id', id).eq('owner_id', getCurrentUserId());
  if (error) return alert('Depo silinemedi: ' + error.message);
  await loadWarehouses();
}

export { renderWarehousesPanel };
