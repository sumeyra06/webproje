// expenses-panel.js
// Gider Listesi paneli: Supabase 'expenses' tablosu üzerinden CRUD + filtreler
import { supabase } from './supabaseClient.js';

function getCurrentUserId() {
  try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; }
}

async function resolveOwnerId() {
  // Prefer Supabase Auth user for RLS compliance; fall back to legacy local session
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch {}
  return getCurrentUserId();
}

export async function renderExpensesPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="m-0">Gider Listesi</h2>
        <div class="d-flex gap-2">
          <button id="exNew" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#expenseModal">Yeni Gider</button>
          <button id="exExport" class="btn btn-outline-primary">CSV İndir</button>
        </div>
      </div>

      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="row g-2">
            <div class="col-12 col-md-3">
              <label class="form-label">Başlangıç</label>
              <input id="exStart" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Bitiş</label>
              <input id="exEnd" type="date" class="form-control" />
            </div>
            <div class="col-12 col-md-3">
              <label class="form-label">Ödeme Durumu</label>
              <select id="exPayStatus" class="form-select">
                <option value="ALL">Hepsi</option>
                <option value="paid">Ödendi</option>
                <option value="pending">Ödenecek</option>
                <option value="partial">Kısmi Ödeme</option>
              </select>
            </div>
            <div class="col-12 col-md-3 d-flex align-items-end">
              <button id="exApply" class="btn btn-primary w-100">Uygula</button>
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
                  <th>Tarih</th>
                  <th>Gider</th>
                  <th>Kategori</th>
                  <th>Tedarikçi</th>
                  <th>Durum</th>
                  <th>Para Birimi</th>
                  <th class="text-end">Matrah</th>
                  <th class="text-end">KDV</th>
                  <th class="text-end">Toplam</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="exRows"><tr><td colspan="10" class="text-center py-4">Veri yükleniyor...</td></tr></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <!-- Modal: Yeni/Düzenle Gider -->
    <div class="modal fade" id="expenseModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <form id="expenseForm">
            <div class="modal-header bg-dark text-white">
              <h5 class="modal-title">Gider</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="exId">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Gider Adı</label>
                  <input id="exTitle" class="form-control" placeholder="Örn. Kargo, Kira, Ofis malzemeleri" required>
                </div>
                <div class="col-md-3">
                  <label class="form-label">Kategori</label>
                  <input id="exCategory" class="form-control" placeholder="Örn. Genel, Pazarlama">
                </div>
                <div class="col-md-3">
                  <label class="form-label">Gider Tarihi</label>
                  <input id="exDate" type="date" class="form-control" value="${new Date().toISOString().slice(0,10)}" required>
                </div>

                <div class="col-md-4">
                  <label class="form-label">Tedarikçi</label>
                  <input id="exSupplier" class="form-control" placeholder="Firma/İsim">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Çalışan</label>
                  <input id="exEmployee" class="form-control" placeholder="Opsiyonel">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Para Birimi</label>
                  <input id="exCurrency" class="form-control" value="TRY">
                </div>

                <div class="col-md-4">
                  <label class="form-label">Matrah Tutar</label>
                  <input id="exAmount" type="number" min="0" step="0.01" class="form-control" value="0.00">
                </div>
                <div class="col-md-4">
                  <label class="form-label">KDV %</label>
                  <input id="exVatRate" type="number" min="0" step="0.01" class="form-control" value="0">
                </div>
                <div class="col-md-4">
                  <label class="form-label">Ödeme Durumu</label>
                  <select id="exPayState" class="form-select">
                    <option value="pending">ÖDENECEK</option>
                    <option value="paid">ÖDENDİ</option>
                    <option value="partial">KISMİ</option>
                  </select>
                </div>

                <div class="col-md-4">
                  <label class="form-label">Ödeme Tarihi</label>
                  <input id="exPayDate" type="date" class="form-control">
                </div>
                <div class="col-md-8">
                  <label class="form-label">Etiketler</label>
                  <input id="exTags" class="form-control" placeholder="etiket1, etiket2">
                </div>

                <div class="col-12">
                  <label class="form-label">Notlar</label>
                  <textarea id="exNotes" class="form-control" rows="3" placeholder="Açıklama / Notlar"></textarea>
                </div>

                <div class="col-md-4 offset-md-8">
                  <div class="d-flex justify-content-between"><div>Matrah</div><div id="exSubtotalText">0,00</div></div>
                  <div class="d-flex justify-content-between"><div>KDV</div><div id="exVatText">0,00</div></div>
                  <div class="d-flex justify-content-between fw-bold mt-2"><div>TOPLAM</div><div id="exTotalText">0,00</div></div>
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

  // Defaults
  (function prefillDates(){
    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - 90);
    const toYMD = d => d.toISOString().slice(0,10);
    document.getElementById('exStart').value = toYMD(start);
    document.getElementById('exEnd').value = toYMD(end);
  })();

  document.getElementById('exApply').onclick = load;
  document.getElementById('exExport').onclick = exportCSV;
  document.getElementById('exNew').onclick = openNewModal;
  let isEditing = false;

  // Ensure form resets even when opened via data attributes
  (function bindModalShow(){
    const el = document.getElementById('expenseModal');
    if (!el) return;
    el.addEventListener('show.bs.modal', () => {
      try {
        // Only auto-prepare for brand new entries; don't wipe edit data
        if (!isEditing) prepareForm();
      } catch (e) { console.warn('prepareForm on show failed', e); }
    });
  })();

  // Modal form events
  document.addEventListener('input', (e) => {
    if (['exAmount','exVatRate'].includes(e.target.id)) recalcModalTotals();
  });
  document.getElementById('expenseForm').onsubmit = saveExpense;

  async function load() {
    const rows = document.getElementById('exRows');
    rows.innerHTML = `<tr><td colspan="10" class="text-center py-4">Yükleniyor...</td></tr>`;
    const owner_id = await resolveOwnerId();
    const start = document.getElementById('exStart').value;
    const end = document.getElementById('exEnd').value;
    const pay = document.getElementById('exPayStatus').value;

    let q = supabase.from('expenses').select('*');
    if (owner_id) q = q.eq('owner_id', owner_id);
    if (start) q = q.gte('expense_date', start);
    if (end) q = q.lte('expense_date', end);
    if (pay && pay !== 'ALL') q = q.eq('payment_status', pay);
    q = q.order('expense_date', { ascending: false }).limit(500);
    const { data, error } = await q;
    if (error) {
      rows.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-danger">Hata: ${error.message}</td></tr>`;
      return;
    }
    if (!data || !data.length) {
      rows.innerHTML = `<tr><td colspan="10" class="text-center py-4">Kayıt bulunamadı</td></tr>`;
    } else {
      rows.innerHTML = data.map(x => `
        <tr>
          <td>${x.expense_date ? new Date(x.expense_date).toLocaleDateString() : ''}</td>
          <td>${x.title || '-'}</td>
          <td>${x.category || '-'}</td>
          <td>${x.supplier_name || '-'}</td>
          <td>${labelPay(x.payment_status)}</td>
          <td>${x.currency || 'TRY'}</td>
          <td class="text-end">${num(x.amount)}</td>
          <td class="text-end">${num(x.tax_amount)}</td>
          <td class="text-end">${num(x.total)}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary ex-edit" data-id="${x.id}">Düzenle</button>
              <button class="btn btn-outline-danger ex-del" data-id="${x.id}">Sil</button>
            </div>
          </td>
        </tr>
      `).join('');
      document.querySelectorAll('.ex-edit').forEach(btn => btn.onclick = () => openEditModal(btn.dataset.id));
      document.querySelectorAll('.ex-del').forEach(btn => btn.onclick = () => deleteExpense(btn.dataset.id));
    }
  }

  function labelPay(v) {
    if (v === 'paid') return 'Ödendi';
    if (v === 'partial') return 'Kısmi';
    return 'Ödenecek';
  }
  function num(n) { return Number(n||0).toFixed(2); }

  function recalcModalTotals() {
    const amt = Number(document.getElementById('exAmount').value || 0);
    const rate = Number(document.getElementById('exVatRate').value || 0);
    const vat = amt * (rate/100);
    const total = amt + vat;
    document.getElementById('exSubtotalText').textContent = amt.toFixed(2);
    document.getElementById('exVatText').textContent = vat.toFixed(2);
    document.getElementById('exTotalText').textContent = total.toFixed(2);
  }

  function openNewModal() {
    isEditing = false;
    prepareForm();
    const Modal = window.bootstrap?.Modal;
    if (!Modal) {
      console.error('Bootstrap Modal bulunamadı. window.bootstrap.Modal erişilemiyor.');
      alert('Modal bileşeni yüklenemedi. Lütfen sayfayı yenileyin.');
      return;
    }
    const m = new Modal(document.getElementById('expenseModal'));
    m.show();
  }

  async function openEditModal(id) {
    isEditing = true;
    const ownerId = await resolveOwnerId();
    let query = supabase.from('expenses').select('*').eq('id', id);
    if (ownerId) query = query.eq('owner_id', ownerId);
    const { data, error } = await query.single();
    if (error) return alert('Kayıt bulunamadı: ' + error.message);
    prepareForm(data);
    const Modal = window.bootstrap?.Modal;
    if (!Modal) {
      console.error('Bootstrap Modal bulunamadı. window.bootstrap.Modal erişilemiyor.');
      alert('Modal bileşeni yüklenemedi. Lütfen sayfayı yenileyin.');
      return;
    }
    const m = new Modal(document.getElementById('expenseModal'));
    m.show();
  }

  async function saveExpense(e) {
    e.preventDefault();
    const id = document.getElementById('exId').value;
    const payload = collectForm();
    // Prefer Supabase Auth user id for RLS compatibility; fall back to sessionUser
    const ownerId = await resolveOwnerId();

    // If there is still no owner id, inserting will violate RLS. Inform the user clearly.
    if (!ownerId) {
      alert('Giriş bulunamadı: Lütfen Supabase hesabınızla giriş yapın. (Güvenlik için RLS, kimliği doğrulanmamış eklemelere izin vermez)');
      return;
    }

    let err;
    if (id) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', id).eq('owner_id', ownerId);
      err = error;
    } else {
      const { error } = await supabase.from('expenses').insert([{ ...payload, owner_id: ownerId }]);
      err = error;
    }
    if (err) return alert('Kayıt başarısız: ' + err.message);
    try {
      const Modal = window.bootstrap?.Modal;
      if (Modal) Modal.getInstance(document.getElementById('expenseModal'))?.hide();
    } catch {}
    isEditing = false;
    await load();
  }

  async function deleteExpense(id) {
    if (!confirm('Bu gideri silmek istiyor musunuz?')) return;
    const ownerId = await resolveOwnerId();
    const { error } = await supabase.from('expenses').delete().eq('id', id).eq('owner_id', ownerId);
    if (error) return alert('Silme başarısız: ' + error.message);
    await load();
  }

  function prepareForm(data) {
    document.getElementById('expenseForm').reset();
    document.getElementById('exId').value = data?.id || '';
    document.getElementById('exTitle').value = data?.title || '';
    document.getElementById('exCategory').value = data?.category || '';
    document.getElementById('exDate').value = (data?.expense_date || new Date().toISOString().slice(0,10));
    document.getElementById('exSupplier').value = data?.supplier_name || '';
    document.getElementById('exEmployee').value = data?.employee_name || '';
    document.getElementById('exCurrency').value = data?.currency || 'TRY';
    document.getElementById('exAmount').value = (data?.amount != null ? data.amount : 0).toFixed ? data.amount.toFixed(2) : data?.amount || 0;
    document.getElementById('exVatRate').value = data?.tax_rate || 0;
    document.getElementById('exPayState').value = data?.payment_status || 'pending';
    document.getElementById('exPayDate').value = data?.payment_date || '';
    document.getElementById('exTags').value = Array.isArray(data?.tags) ? data.tags.join(', ') : '';
    document.getElementById('exNotes').value = data?.notes || '';
    recalcModalTotals();
  }

  function collectForm() {
    const amt = Number(document.getElementById('exAmount').value || 0);
    const rate = Number(document.getElementById('exVatRate').value || 0);
    const vat = amt * (rate/100);
    const total = amt + vat;
    const tagsRaw = document.getElementById('exTags').value.trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
    return {
      title: document.getElementById('exTitle').value.trim(),
      category: document.getElementById('exCategory').value.trim() || null,
      expense_date: document.getElementById('exDate').value,
      supplier_name: document.getElementById('exSupplier').value.trim() || null,
      employee_name: document.getElementById('exEmployee').value.trim() || null,
      currency: document.getElementById('exCurrency').value.trim() || 'TRY',
      amount: amt,
      tax_rate: rate,
      tax_amount: vat,
      total: total,
      payment_status: document.getElementById('exPayState').value,
      payment_date: document.getElementById('exPayDate').value || null,
      tags,
      notes: document.getElementById('exNotes').value.trim() || null
    };
  }

  function exportCSV() {
    const rows = Array.from(document.querySelectorAll('#exRows tr'))
      .map(tr => Array.from(tr.children).map(td => td.textContent.replace(/\s+/g,' ').trim()));
    if (!rows.length) return;
    const header = ['Tarih','Gider','Kategori','Tedarikçi','Durum','Para Birimi','Matrah','KDV','Toplam'];
    const csv = [header, ...rows.map(r => r.slice(0,9))].map(r => r.map(c => `"${c.replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gider_listesi.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  await load();
}

export default renderExpensesPanel;
