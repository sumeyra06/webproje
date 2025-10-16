import { supabase } from './supabaseClient.js';

async function loadServicesToHome() {
  const container = document.getElementById('dynamicServices');
  if (!container) return;
  container.innerHTML = '<p>Yükleniyor...</p>';
  const { data, error } = await supabase.from('services').select('*').order('title');
  if (error || !data.length) {
    container.innerHTML = '<p>Hizmet bulunamadı.</p>';
    return;
  }
  container.innerHTML = data.map(service => `
    <div class="service eleks-service">
      <h3>${service.title}</h3>
      <p>${service.description}</p>
      ${service.price ? `<span class='service-price'>${service.price}</span>` : ''}
      ${service.is_featured ? `<span class='service-featured'>⭐</span>` : ''}
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadServicesToHome);
