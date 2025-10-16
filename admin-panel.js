import { renderBlogPanel } from './blog-panel.js';
import { renderSalesPanel } from './sales-panel.js';
import { renderSalesReportPanel } from './sales-report-panel.js';
import { renderCollectionsReportPanel } from './collections-report-panel.js';
import { renderVatReportPanel } from './vat-report-panel.js';
import { renderIncomeExpenseReportPanel } from './income-expense-report-panel.js';
import { renderProductTrackingPanel } from './product-tracking-panel.js';
import { renderCustomersPanel } from './musteriler-panel.js';
import { renderProductsPanel } from './products-panel.js';
import { renderMediaPanel } from './media-panel.js';
import { renderTeamPanel } from './team-panel.js';
import { renderOffersPanel } from './offers-panel.js';
import { renderInvoicesPanel } from './invoices-panel.js';
import { renderInvoicesPanelV2 } from './invoices-panel-v2.js';
import { renderDashboardPanel } from './dashboard-panel.js';
import { renderServicesProductsPanel } from './hizmet-ve-urunler-panel.js';
import { renderWarehousesPanel } from './warehouses-panel.js';
import { renderStockProductsReportPanel } from './stock-products-report-panel.js';
import { renderExpensesPanel } from './expenses-panel.js';
import { renderExpensesReportPanel } from './expenses-report-panel.js';
import { renderUsersManagementPanel } from './users-management-panel.js';
import { renderSupportPanel } from './support-panel.js';
import { renderCashBanksPanel } from './cash-banks-panel.js';
import { renderCashBankReportPanel } from './cash-bank-report-panel.js';
import { supabase } from './supabaseClient.js';
// E-Ticaret panelleri
import { renderEcommerceIntegrationsPanel } from './ecommerce-integrations-panel.js';
import { renderEcommerceOrdersPanel } from './ecommerce-orders-panel.js';

console.log('admin-panel.js yüklendi');

// Oturum kontrolü: sadece giriş yapılmış olmalı (rol fark etmez)
let CURRENT_USER = null;
try {
  const raw = localStorage.getItem('sessionUser');
  CURRENT_USER = raw ? JSON.parse(raw) : null;
  if (!CURRENT_USER) {
    console.warn('Oturum bulunamadı, login sayfasına yönlendiriliyor.');
    window.location.href = 'login.html?unauthorized=1';
  }
} catch (e) {
  console.error('Oturum kontrolünde hata:', e);
  window.location.href = 'login.html?unauthorized=1';
}

// Logout button handler
(() => {
  const attach = () => {
    const btn = document.getElementById('logout-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      try { localStorage.removeItem('sessionUser'); } catch {}
      window.location.href = 'login.html';
    });
    const badge = document.getElementById('current-user-badge');
    if (badge && CURRENT_USER) {
      const name = CURRENT_USER.full_name || CURRENT_USER.email || 'Kullanıcı';
      const role = CURRENT_USER.role ? ` • ${CURRENT_USER.role}` : '';
      const chipText = badge.querySelector('.chip-text');
      if (chipText) chipText.textContent = `${name}${role}`;
      else badge.textContent = `${name}${role}`;
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else { attach(); }
})();

// Sadece sol menü ve yönlendirme (pazaryeri başlığı yok)



window.addEventListener('hashchange', () => {
	const hash = window.location.hash.replace('#', '');
	routePanel(hash);
});

function routePanel(panel) {
  console.log('routePanel çağrıldı:', panel);
  // Unimplemented pages should show a stylish "Coming Soon" screen
  const COMING_SOON_TITLES = {
  // 'income-expense-report': 'Gelir Gider Raporu', // now implemented
    'suppliers': 'Tedarikçiler',
    'employees': 'Çalışanlar',
    // 'expenses-report': 'Giderler Raporu', // now implemented
    'payments-report': 'Ödemeler Raporu',
  // 'cash-banks': 'Kasa ve Bankalar', // now implemented
    'cheques': 'Çekler',
  // 'cash-bank-report': 'Kasa / Banka Raporu', // now implemented
    'cash-flow-report': 'Nakit Akışı Raporu',
    'warehouse-transfer': 'Depolar Arası Transfer',
    'outgoing-dispatches': 'Giden İrsaliyeler',
    'incoming-dispatches': 'Gelen İrsaliyeler',
    'price-lists': 'Fiyat Listeleri',
    'stock-history': 'Stok Geçmişi'
  };
  if (COMING_SOON_TITLES[panel]) {
    return renderComingSoon(COMING_SOON_FALLBACK(panel, COMING_SOON_TITLES[panel]));
  }
  switch(panel) {
  case 'cash-banks': return renderCashBanksPanel();
  case 'cash-bank-report': return renderCashBankReportPanel();
  case 'expense-list': return renderExpensesPanel();
  case 'expenses-report': return renderExpensesReportPanel();
    case 'dashboard': renderDashboardPanel(); break;
    case 'users-management':
      if (CURRENT_USER && CURRENT_USER.role === 'admin') {
        renderUsersManagementPanel();
      } else {
        const main = document.getElementById('main');
        if (main) main.innerHTML = `<section class='container py-4'><div class='alert alert-warning'>Bu sayfaya yalnızca yönetici hesapları erişebilir.</div></section>`;
      }
      break;
    case 'support':
      if (CURRENT_USER && CURRENT_USER.role === 'admin') {
        renderSupportPanel();
      } else {
        const main = document.getElementById('main');
        if (main) main.innerHTML = `<section class='container py-4'><div class='alert alert-warning'>Bu sayfaya yalnızca yönetici hesapları erişebilir.</div></section>`;
      }
      break;
    case 'products': renderProductsPanel(); break;
    case 'customers': renderCustomersPanel(); break;
    case 'sales': renderSalesPanel(); break;
    case 'product-tracking': renderProductTrackingPanel(); break;
  case 'offers': renderOffersPanel(); break;
  case 'sales-report': return renderSalesReportPanel();
  case 'income-expense-report': return renderIncomeExpenseReportPanel();
  case 'collections-report': return renderCollectionsReportPanel();
  case 'vat-report': return renderVatReportPanel();
    case 'invoices':
      // Eski rota: v2'ye yönlendir
      window.location.hash = '#invoices-v2';
      break;
    case 'invoices-v2':
      try {
        renderInvoicesPanelV2();
      } catch (e) {
        console.error('Faturalar v2 paneli yüklenemedi:', e);
        const main = document.getElementById('main');
        if (main) main.innerHTML = `<section class='container py-4'><h2>Faturalar (v2)</h2><div class='alert alert-danger'>Panel yüklenemedi: ${e.message}</div></section>`;
      }
      break;
    case 'services-products': renderServicesProductsPanel(); break;
  case 'warehouses': renderWarehousesPanel(); break;
    case 'stock-products-report': renderStockProductsReportPanel(); break;
    case 'blog': renderBlogPanel(); break;
    case 'team': renderTeamPanel(); break;
    case 'media': renderMediaPanel(); break;
    // E-TİCARET
  case 'ecommerce-integrations': renderEcommerceIntegrationsPanel(); break;
  case 'ecommerce-orders': return renderEcommerceOrdersPanel();
    case 'ecommerce-matched-products': return renderComingSoon('Eşleştirilen Ürünler');
    case 'ecommerce-settings': return renderComingSoon('e-Ticaret Ayarları');
    default: renderDashboardPanel();
  }
}

function COMING_SOON_FALLBACK(slug, title) {
  // Helper to build a friendly label
  return title || (slug ? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Sayfa');
}

function renderComingSoon(title) {
  const main = document.getElementById('main');
  const niceTitle = title || 'Sayfa';
  if (!main) return;
  main.innerHTML = `
    <section class="container py-5">
      <div class="coming-soon-card">
        <div class="cs-icon"><i class="bi bi-tools"></i></div>
        <h2 class="cs-title">${niceTitle}</h2>
        <p class="cs-sub">Sayfa Tasarım Aşamasında – Yakında Hizmetinizde!</p>
        <div class="cs-actions">
          <button class="btn btn-sm btn-outline-secondary" id="csBackBtn"><i class="bi bi-arrow-left"></i> Dashboard'a dön</button>
        </div>
      </div>
    </section>
  `;
  const back = document.getElementById('csBackBtn');
  if (back) back.addEventListener('click', () => { window.location.hash = '#dashboard'; });
}

// İlk yüklemede dashboard göster
if (!window.location.hash) window.location.hash = '#dashboard';
else routePanel(window.location.hash.replace('#', ''));

// Support modal handlers
(() => {
  const openModal = () => {
    const m = document.getElementById('supportModal');
    if (!m) return;
    const modal = new bootstrap.Modal(m);
    modal.show();
  };
  const btn = document.getElementById('support-btn');
  if (btn) btn.addEventListener('click', openModal);
  const form = document.getElementById('supportForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subject = document.getElementById('supportSubject').value.trim() || null;
      const message = document.getElementById('supportMessage').value.trim();
      const info = document.getElementById('supportMsg');
      if (!message) { info.textContent = 'Mesaj giriniz.'; info.className='text-danger small'; return; }
      try {
        const payload = {
          user_id: CURRENT_USER?.id || null,
          user_email: CURRENT_USER?.email || null,
          user_full_name: CURRENT_USER?.full_name || null,
          subject,
          message,
          status: 'open'
        };
        const { error } = await supabase.from('support_messages').insert([payload]);
        if (error) throw error;
        info.textContent = 'Mesajınız alındı. Teşekkürler!';
        info.className = 'text-success small';
        form.reset();
        setTimeout(() => { try { bootstrap.Modal.getInstance(document.getElementById('supportModal')).hide(); } catch {} }, 900);
      } catch (err) {
        console.error('support insert error', err);
        info.textContent = 'Mesaj gönderilemedi: ' + (err?.message||err);
        info.className = 'text-danger small';
      }
    });
  }
})();
