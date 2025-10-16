import { supabase } from './supabaseClient.js';


// Her slider için sadece bir görsel ve başlık göster
async function loadSliderMediaImages() {
  const { data, error } = await supabase.from('media').select('*').eq('category', 'slider').order('uploaded_at', { ascending: false });
  if (error || !data || !data.length) return;
  for (let i = 1; i <= 3; i++) {
    const container = document.getElementById('sliderMediaImages' + i);
    if (container) {
      const media = data[i-1] || data[0];
      container.innerHTML = `
        <div class="slider-media-label">
          <span>${media.title || 'Slider Görseli'}</span>
        </div>
        <img src="${media.file_url}" alt="${media.title || 'Slider Medya'}" class="slider-media-img" />
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSliderMediaImages();
});
