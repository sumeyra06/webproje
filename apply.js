
import { supabase } from './supabaseClient.js';

// Başvuru modalı ve form işlemleri
document.addEventListener('DOMContentLoaded', () => {
  // Başvuru modalını aç
  document.querySelectorAll('.apply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('applyModal').style.display = 'flex';
    });
  });

  // Modalı kapat
  document.querySelector('.apply-close').onclick = () => {
    document.getElementById('applyModal').style.display = 'none';
    document.getElementById('applySuccess').style.display = 'none';
  };

  // Modal dışına tıklayınca kapat
  window.onclick = (e) => {
    if (e.target === document.getElementById('applyModal')) {
      document.getElementById('applyModal').style.display = 'none';
      document.getElementById('applySuccess').style.display = 'none';
    }
  };

  // Başvuru formu gönderimi
  document.getElementById('applyForm').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const { name, email, phone } = form;
    const { error } = await supabase.from('offers').insert([
      {
        customer_name: name.value,
        email: email.value,
        phone: phone.value,
        status: 'Beklemede',
        requested_service: 'Genel Başvuru',
      }
    ]);
    if (error) {
      alert('Başvuru kaydedilemedi!\n' + error.message);
    } else {
      form.reset();
      document.getElementById('applySuccess').style.display = 'block';
    }
  };
});

// Ürünlerdeki kategori adlarını ve id'lerini categories tablosuna otomatik ekler
export async function syncCategoriesFromProducts() {
  // Tüm ürünleri çek
  const { data: products, error } = await supabase.from('products').select('categories,category_id');
  if (error) {
    alert('Ürünler alınamadı!\n' + error.message);
    return;
  }

  // Tüm kategorileri düzleştir ve benzersiz hale getir
  const allCats = [];
  (products || []).forEach(p => {
    if (Array.isArray(p.categories)) {
      allCats.push(...p.categories);
    } else if (p.categories) {
      allCats.push(p.categories);
    }
    if (p.category_id) {
      allCats.push(String(p.category_id));
    }
  });
  const uniqueCats = [...new Set(allCats.filter(Boolean))];
  if (uniqueCats.length === 0) {
    alert('Ürünlerde hiç kategori bulunamadı.');
    return;
  }

  // Mevcut kategorileri çek
  const { data: existing, error: err2 } = await supabase.from('categories').select('name');
  if (err2) {
    alert('Mevcut kategoriler alınamadı!\n' + err2.message);
    return;
  }
  const existingNames = (existing || []).map(c => c.name);

  // Eksik olanları ekle
  const toInsert = uniqueCats.filter(cat => !existingNames.includes(cat)).map(name => ({ name }));
  if (toInsert.length === 0) {
    alert('Tüm kategoriler zaten ekli.');
    return;
  }
  const { error: err3 } = await supabase.from('categories').insert(toInsert);
  if (err3) {
    alert('Kategori eklenemedi!\n' + err3.message);
  } else {
    alert('Eksik kategoriler başarıyla eklendi!');
  }
}

