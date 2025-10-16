// Yönetici giriş modalı ve sekme yönetimi

document.addEventListener('DOMContentLoaded', function() {
    // Yönetici giriş butonuna tıklandığında sadece modalı aç
    const adminBtn = document.getElementById('adminLoginBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'login.html';
        });
    }
    // Modal kapatma
    const closeBtn = document.querySelector('.admin-close');
    if (closeBtn) {
        closeBtn.onclick = function() {
            document.getElementById('adminModal').style.display = 'none';
        };
    }
    window.onclick = function(e) {
        const modal = document.getElementById('adminModal');
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
});
