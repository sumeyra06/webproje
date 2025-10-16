import { supabase } from './supabaseClient.js';

export async function renderSupportPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2>Destek Mesajları</h2>
        <button id="refreshSupport" class="btn btn-sm btn-outline-secondary">Yenile</button>
      </div>
      <div class="alert alert-info">Yalnızca adminler burayı görebilir.</div>
      <div id="supportList">Yükleniyor...</div>
    </section>
  `;
  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .order('created_at', { ascending: false });
  const list = document.getElementById('supportList');
  if (error) {
    list.innerHTML = `<div class='alert alert-danger'>Liste yüklenemedi: ${error.message}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    list.innerHTML = `<div class='alert alert-warning'>Mesaj bulunamadı.</div>`;
    return;
  }
  // Fetch user names/emails if message rows don't have them
  const ids = Array.from(new Set(data.map(m => m.user_id).filter(Boolean)));
  let userMap = new Map();
  if (ids.length) {
    const { data: users, error: ue } = await supabase.from('users').select('id, full_name, email').in('id', ids);
    if (!ue && Array.isArray(users)) {
      users.forEach(u => userMap.set(u.id, u));
    }
  }
  let html = `<div class='list-group'>`;
  data.forEach(m => {
    const u = userMap.get(m.user_id) || {};
    const displayName = m.user_full_name || u.full_name || u.email || m.user_email || m.user_id;
    const displayEmail = m.user_email || u.email || '';
    html += `<div class='list-group-item'>
      <div class='d-flex justify-content-between'><div>
        <div class='fw-bold'>${displayName}</div>
        <div class='small text-muted'>${displayEmail}</div>
      </div>
      <div class='text-end small text-muted'>${new Date(m.created_at).toLocaleString('tr-TR')}</div></div>
      ${m.subject ? `<div class='mt-1'><span class='badge bg-secondary me-2'>Konu</span>${m.subject}</div>` : ''}
      <div class='mt-2'>${m.message}</div>
      <div class='mt-2'>
        <select class='form-select form-select-sm d-inline w-auto me-2 statusSel' data-id='${m.id}'>
          ${['open','in-progress','closed'].map(s=>`<option value='${s}' ${m.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
        <button class='btn btn-sm btn-primary saveStatus' data-id='${m.id}'>Kaydet</button>
      </div>
    </div>`;
  });
  html += `</div>`;
  list.innerHTML = html;

  list.querySelectorAll('.saveStatus').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = e.currentTarget.getAttribute('data-id');
    const sel = list.querySelector(`.statusSel[data-id='${id}']`);
    const status = sel.value;
    const { error } = await supabase.from('support_messages').update({ status }).eq('id', id);
    if (error) alert('Durum güncellenemedi: ' + error.message);
  }));

  document.getElementById('refreshSupport').addEventListener('click', renderSupportPanel);
}
