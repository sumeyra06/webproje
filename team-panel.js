// team-panel.js
// Ekip Paneli
import { supabase } from './supabaseClient.js';

async function renderTeamPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <h2>Ekip</h2>
    <div id="teamList">Yükleniyor...</div>
  `;
  const { data, error } = await supabase.from('team_members').select('*').order('name');
  if (error) {
  document.getElementById('teamList').textContent = 'Veri alınamadı: ' + error.message;
    return;
  }
  if (!data || data.length === 0) {
  document.getElementById('teamList').textContent = 'Hiç ekip üyesi bulunamadı.';
    return;
  }
  let html = `<table class="admin-table"><thead><tr><th>ID</th><th>Ad</th><th>Pozisyon</th><th>LinkedIn</th><th>GitHub</th></tr></thead><tbody>`;
  for (const member of data) {
    html += `<tr><td>${member.id}</td><td>${member.name}</td><td>${member.position}</td><td>${member.linkedin ? `<a href="${member.linkedin}" target="_blank">Link</a>` : ''}</td><td>${member.github ? `<a href="${member.github}" target="_blank">Link</a>` : ''}</td></tr>`;
  }
  html += '</tbody></table>';
  document.getElementById('teamList').innerHTML = html;
}
export { renderTeamPanel };
