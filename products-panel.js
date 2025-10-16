// products-panel.js
// Ürünler Paneli - Ayrı bir bölümde, Bootstrap tablo ile Supabase'den ürünleri listeler
import { supabase } from './supabaseClient.js';

async function renderProductsPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="container-fluid py-4">
      <h2 class="mb-4">Ürünler</h2>
      <div class="card shadow-sm">
        <div class="card-body">
          <div id="productsList">Yükleniyor...</div>
        </div>
      </div>
    </div>
  `;
  const getCurrentUserId = () => { try { const u = JSON.parse(localStorage.getItem('sessionUser')); return u?.id || null; } catch { return null; } };
  const { data, error } = await supabase.from('products').select('*').eq('owner_id', getCurrentUserId()).order('id', { ascending: false }).limit(100);
  if (error) {
  document.getElementById('productsList').textContent = 'Veri alınamadı: ' + error.message;
    return;
  }
  if (!data || data.length === 0) {
  document.getElementById('productsList').textContent = 'Hiç ürün bulunamadı.';
    return;
  }
  let html = `<div class="table-responsive"><table class="table table-striped align-middle"><thead><tr><th>ID</th><th>Ad</th><th>Kategori</th><th>Fiyat</th><th>Stok</th><th>Açıklama</th></tr></thead><tbody>`;
  for (const urun of data) {
    html += `<tr><td>${urun.id}</td><td>${urun.name}</td><td>${urun.category || ''}</td><td>${urun.price || ''}</td><td>${urun.stock || ''}</td><td>${urun.description || ''}</td></tr>`;
  }
  html += '</tbody></table></div>';
  document.getElementById('productsList').innerHTML = html;
}
export { renderProductsPanel };
