import { supabase } from './supabaseClient.js';

const ROLES = ['user', 'finance', 'sales', 'admin'];

export async function renderUsersManagementPanel() {
  const main = document.getElementById('main');
  if (!main) return;
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex align-items-center justify-content-between mb-3">
        <h2>Kullanıcı Yönetimi</h2>
        <button id="refreshUsers" class="btn btn-sm btn-outline-secondary">Yenile</button>
      </div>
  <div class="alert alert-info">Yalnızca adminler burayı görebilir. Kullanıcı rolleri ve aktif/pasif durumu aşağıdan değiştirilebilir. Değişiklikler otomatik kaydedilir.</div>
      <div id="usersTableWrap" class="table-responsive">
        <table class="table table-striped align-middle">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>E-posta</th>
              <th>Firma Ünvanı</th>
              <th>Telefon</th>
              <th>Rol</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody id="usersTbody">
            <tr><td colspan="6">Yükleniyor...</td></tr>
          </tbody>
        </table>
      </div>
      <div id="usersMsg" class="mt-2"></div>
    </section>
  `;

  async function loadUsers() {
    const tbody = document.getElementById('usersTbody');
    const msg = document.getElementById('usersMsg');
    msg.textContent = '';
    tbody.innerHTML = '<tr><td colspan="6">Yükleniyor...</td></tr>';
    try {
      let hasActiveColumn = true;
      let data = null, error = null;
      let resp = await supabase
        .from('users')
        .select('id, full_name, email, company_title, phone, role, is_active')
        .order('created_at', { ascending: false });
      if (resp.error && resp.error.message && resp.error.message.toLowerCase().includes('is_active')) {
        // Column missing on DB, fallback without it
        hasActiveColumn = false;
        resp = await supabase
          .from('users')
          .select('id, full_name, email, company_title, phone, role')
          .order('created_at', { ascending: false });
        // Inform admin to run migration
        msg.innerHTML = `<div class=\"alert alert-warning\">is_active sütunu veritabanında bulunamadı. Aktif/Pasif anahtarı devre dışı. Lütfen <code>supabase-users-table.sql</code> içindeki ALTER komutunu uygulayın.</div>`;
      }
      data = resp.data; error = resp.error;
      if (error) throw error;
      if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">Kayıt bulunamadı.</td></tr>';
        return;
      }
      tbody.innerHTML = data.map(u => {
        const isActive = (u.hasOwnProperty('is_active')) ? !!u.is_active : true;
        const durumCell = (u.hasOwnProperty('is_active'))
          ? `<div class='form-check form-switch mb-0'>
               <input class='form-check-input activeSwitch' type='checkbox' data-id='${u.id}' ${isActive ? 'checked' : ''} />
               <label class='form-check-label ms-2'>${isActive ? 'Aktif' : 'Pasif'}</label>
             </div>`
          : `<div class='form-check form-switch mb-0' title='is_active sütunu eksik'>
               <input class='form-check-input' type='checkbox' disabled />
               <label class='form-check-label ms-2'>Bilinmiyor</label>
             </div>`;
        return `
        <tr data-id="${u.id}">
          <td>${u.full_name ?? '-'}</td>
          <td>${u.email}</td>
          <td>${u.company_title ?? '-'}</td>
          <td>${u.phone ?? '-'}</td>
          <td>
            <select class="form-select form-select-sm roleSel" data-id="${u.id}">
              ${ROLES.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </td>
          <td>${durumCell}</td>
        </tr>`;
      }).join('');

      // Auto-save role on change
      document.querySelectorAll('.roleSel').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          const id = e.target.getAttribute('data-id');
          const role = e.target.value;
          await updateRole(id, role);
        });
      });

      // Toggle active/passive immediately on switch change with optimistic UI
      document.querySelectorAll('.activeSwitch').forEach(sw => {
        sw.addEventListener('change', async (e) => {
          const id = e.target.getAttribute('data-id');
          const nextState = e.target.checked;
          const label = e.target.parentElement.querySelector('.form-check-label');
          const prevState = !nextState;
          // optimistic UI
          e.target.disabled = true;
          if (label) label.textContent = nextState ? 'Aktif' : 'Pasif';
          const ok = await toggleActive(id, nextState);
          if (!ok) {
            // revert
            e.target.checked = prevState;
            if (label) label.textContent = prevState ? 'Aktif' : 'Pasif';
          }
          e.target.disabled = false;
        });
      });
    } catch (err) {
      console.error('users load error', err);
      tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Liste yüklenemedi: ${err?.message || err}</td></tr>`;
    }
  }

  async function updateRole(id, role) {
    const msg = document.getElementById('usersMsg');
    msg.textContent = 'Güncelleniyor...';
    try {
      const { error } = await supabase.from('users').update({ role }).eq('id', id);
      if (error) throw error;
      msg.textContent = 'Rol güncellendi.';
      msg.className = 'text-success';
    } catch (err) {
      console.error('role update error', err);
      msg.textContent = 'Rol güncellenemedi: ' + (err?.message || err);
      msg.className = 'text-danger';
    }
  }

  async function toggleActive(id, nextState) {
    const msg = document.getElementById('usersMsg');
    msg.textContent = 'Durum güncelleniyor...';
    msg.className = '';
    try {
      const { error } = await supabase.from('users').update({ is_active: nextState }).eq('id', id);
      if (error) throw error;
      msg.textContent = `Kullanıcı ${nextState ? 'aktif' : 'pasif'} yapıldı.`;
      msg.className = 'text-success';
      // Optionally reload list to reflect fresh state; keep it but don't await long
      loadUsers().catch(()=>{});
      return true;
    } catch (err) {
      console.error('toggle active error', err);
      msg.textContent = 'Durum güncellenemedi: ' + (err?.message || err);
      msg.className = 'text-danger';
      return false;
    }
  }

  document.getElementById('refreshUsers').addEventListener('click', loadUsers);
  loadUsers();
}
