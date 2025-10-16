# Canlıya Alma (Deployment) Rehberi

Bu proje saf HTML/CSS/JS tabanlıdır (build gerektirmez). Aşağıdaki seçeneklerden biriyle kolayca canlıya alabilirsiniz.

## 1) Netlify (önerilen, hızlı kurulum)
- Netlify hesabı açın ve New site from Git ile GitHub reposuna bağlayın.
- Build command boş bırakın, Publish directory olarak `.` girin.
- Kökteki `netlify.toml` Netlify’a yapılandırmayı sağlar.
- Özel alan adı (Custom domain) eklemek isterseniz DNS’i Netlify’a yönlendirin.

## 2) Vercel
- Vercel hesabıyla GitHub reposunu import edin.
- Framework: Other, build yok. `vercel.json` bu repo kökünde var.
- Deploy sonrası verilen URL’den doğrulayın.

## 3) Cloudflare Pages
- Cloudflare Pages’te Create a project → Git’ten bağlayın.
- Build Command boş, Output directory `.`.
- CDN üzerinden hızlı dağıtım sağlar.

## 4) Kendi Ubuntu Sunucunuz (Nginx)
### A) Dosyaları sunucuya kopyalayın
- Sunucuda bir klasör oluşturun: `/var/www/aksa` (örnek)
- Tüm proje dosyalarını bu klasöre kopyalayın.

### B) Nginx sanal host
`/etc/nginx/sites-available/aksa` dosyası:

```
server {
    listen 80;
    server_name ornekalanadiniz.com www.ornekalanadiniz.com;

    root /var/www/aksa;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Statik varlıkları uzun süre cacheleyin
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }
}
```

- Etkinleştir: `ln -s /etc/nginx/sites-available/aksa /etc/nginx/sites-enabled/`
- Test: `sudo nginx -t` ve `sudo systemctl reload nginx`
- HTTPS için Let’s Encrypt:
  - `sudo apt install certbot python3-certbot-nginx`
  - `sudo certbot --nginx -d ornekalanadiniz.com -d www.ornekalanadiniz.com`

## Supabase ve Güvenlik
- `supabaseClient.js` içinde anon key kullanılıyor; yalnızca RLS (Row Level Security) ile izin verdiğiniz sorgulara yetki verin.
- Üretimde hassas işlemler için arka uç (server) katmanı önerilir.
- CORS ve rate limit için ters proxy (Nginx) seviyesinde kısıtlar eklenebilir.

## SEO ve Performans İpuçları
- `index.html` için meta title/description’ı zenginleştirin.
- Görselleri (assets) optimize edin, mümkünse `webp/avif` sürümleri ekleyin.
- Uzun vadeli cache için `assets` altında dosya adı versiyonlama uygulayın.

## Sorun Giderme
- Boş sayfa: Yolların göreceli olduğundan emin olun (kökten çalışıyor).
- 404: Nginx’te `try_files` kuralı `=404` olacak; SPA routing yok.
- Supabase hataları: Konsoldaki hata mesajlarına bakın; tablo/kolon/RLS uyumsuzluklarını SQL dosyalarından güncelleyin.
