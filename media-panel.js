// media-panel.js
// Medya Paneli
import { supabase } from './supabaseClient.js';
const getCurrentUserId = () => { try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; } };

async function renderMediaPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <h2>Medya</h2>
    <div id="mediaList">Yükleniyor...</div>
  `;
  const { data, error } = await supabase.from('media').select('*').eq('owner_id', getCurrentUserId()).order('created_at', { ascending: false }).limit(100);
  if (error) {
  document.getElementById('mediaList').textContent = 'Veri alınamadı: ' + error.message;
    return;
  }
  if (!data || data.length === 0) {
  document.getElementById('mediaList').textContent = 'Hiç medya bulunamadı.';
    return;
  }
  let html = `<table class="admin-table"><thead><tr><th>ID</th><th>Başlık</th><th>Tür</th><th>URL</th><th>Tarih</th></tr></thead><tbody>`;
  for (const media of data) {
    html += `<tr><td>${media.id}</td><td>${media.title}</td><td>${media.type}</td><td><a href="${media.url}" target="_blank">Link</a></td><td>${new Date(media.created_at).toLocaleDateString()}</td></tr>`;
  }
  html += '</tbody></table>';
  document.getElementById('mediaList').innerHTML = html;
}
export { renderMediaPanel };
