import { supabase } from './supabaseClient.js';

const uid = () => { try { return JSON.parse(localStorage.getItem('sessionUser'))?.id || null; } catch { return null; } };

export async function renderCashBanksPanel() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <style>
      .kpi-card { border:0; color:#fff; background:linear-gradient(135deg,#667eea,#764ba2); box-shadow:0 6px 16px rgba(0,0,0,.08); }
      .kpi-card.alt1 { background:linear-gradient(135deg,#43cea2,#185a9d); }
      .kpi-card.alt2 { background:linear-gradient(135deg,#f7971e,#ffd200); color:#222; }
      .kpi-card .label { font-size:12px; opacity:.9; }
      .kpi-card .value { font-size:22px; font-weight:800; letter-spacing:.2px; }
      .account-card { transition:all .2s ease; border:1px solid #eef1f5; }
      .account-card:hover { transform:translateY(-2px); box-shadow:0 10px 24px rgba(0,0,0,.08); }
      .account-icon { width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:12px; }
      .icon-cash { background:#e7f5ff; color:#1971c2; }
      .icon-bank { background:#e6fcf5; color:#2b8a3e; }
      .balance { font-size:18px; font-weight:700; }
      .subtle { color:#6c757d; font-size:12px; }
      .table thead th { position:sticky; top:0; background:#fff; z-index:1; }
      .badge-in { background:#e6fcf5; color:#2b8a3e; }
      .badge-out { background:#fff5f5; color:#c92a2a; }
      .badge-transfer { background:#e7f5ff; color:#1c7ed6; }
      .toolbar .btn { border-radius:8px; }
      .search-input { max-width:260px; }
      .empty-state { text-align:center; padding:32px; color:#6c757d; }
    </style>
    <section class="container py-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 class="fw-bold mb-1">Kasa ve Bankalar</h2>
          <div class="text-muted">Nakitlerinizi ve banka hesaplarınızı tek yerden yönetin</div>
        </div>
        <div class="toolbar d-flex gap-2">
          <button class="btn btn-light" id="btnNewAccount"><i class="bi bi-plus-lg me-1"></i>Yeni Hesap</button>
          <button class="btn btn-success" id="btnMoneyIn"><i class="bi bi-arrow-down-left me-1"></i>Para Girişi</button>
          <button class="btn btn-danger" id="btnMoneyOut"><i class="bi bi-arrow-up-right me-1"></i>Para Çıkışı</button>
          <button class="btn btn-primary" id="btnTransfer"><i class="bi bi-arrow-left-right me-1"></i>Transfer</button>
        </div>
      </div>

      <div id="cashStats" class="row g-3 mb-4"></div>

      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card p-2">
            <div class="d-flex align-items-center justify-content-between px-2 pt-2">
              <div class="fw-semibold">Hesaplar</div>
              <input id="accountSearch" placeholder="Hesap ara..." class="form-control form-control-sm search-input" />
            </div>
            <div class="row row-cols-1 g-2 p-2" id="accountsList"></div>
          </div>
        </div>
        <div class="col-lg-8">
          <div class="card">
            <div class="card-header py-2">
              <div class="row g-2 align-items-center">
                <div class="col-md-3">
                  <label class="subtle mb-1">Tür</label>
                  <select id="fltType" class="form-select form-select-sm">
                    <option value="">Tümü</option>
                    <option value="in">Giriş</option>
                    <option value="out">Çıkış</option>
                    <option value="transfer_in">Transfer (Giriş)</option>
                    <option value="transfer_out">Transfer (Çıkış)</option>
                  </select>
                </div>
                <div class="col-md-3">
                  <label class="subtle mb-1">Başlangıç</label>
                  <input id="fltFrom" type="date" class="form-control form-select-sm" />
                </div>
                <div class="col-md-3">
                  <label class="subtle mb-1">Bitiş</label>
                  <input id="fltTo" type="date" class="form-control form-select-sm" />
                </div>
                <div class="col-md-3 text-end">
                  <label class="subtle d-block mb-1">&nbsp;</label>
                  <button class="btn btn-sm btn-outline-secondary" id="btnExportCsv"><i class="bi bi-download me-1"></i>CSV</button>
                </div>
              </div>
            </div>

            <div class="table-responsive" style="max-height: 60vh; overflow:auto;">
              <table class="table table-hover align-middle mb-0" id="trxTable">
                <thead class="table-light"><tr><th>Tarih</th><th>Tür</th><th>Tutar</th><th>Açıklama</th><th>Karşı Taraf</th><th>Hesap</th></tr></thead>
                <tbody></tbody>
              </table>
              <div id="trxEmpty" class="empty-state d-none">Kayıt bulunamadı</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    ${modalsTpl}
  `;

  // Handlers
  document.getElementById('btnNewAccount').onclick = openNewAccountModal;
  document.getElementById('btnMoneyIn').onclick = openMoneyInModal;
  document.getElementById('btnMoneyOut').onclick = openMoneyOutModal;
  document.getElementById('btnTransfer').onclick = openTransferModal;
  document.getElementById('btnExportCsv').onclick = exportCsv;

  // Filters
  document.getElementById('fltType').onchange = () => loadTransactions(__STATE.selectedAccountId);
  document.getElementById('fltFrom').onchange = () => loadTransactions(__STATE.selectedAccountId);
  document.getElementById('fltTo').onchange = () => loadTransactions(__STATE.selectedAccountId);
  const accSearch = document.getElementById('accountSearch');
  accSearch.oninput = () => renderAccounts(__STATE.accounts || [], __STATE.selectedAccountId, accSearch.value.trim());

  await loadData();
}

const __STATE = { accounts: [], selectedAccountId: null };

async function loadData(selectedAccountId=null){
  const owner = uid();
  const { data: accounts } = await supabase.from('cash_accounts').select('*').eq('owner_id', owner).order('type');
  __STATE.accounts = accounts || [];
  __STATE.selectedAccountId = selectedAccountId || null;
  renderStats(__STATE.accounts);
  renderAccounts(__STATE.accounts, __STATE.selectedAccountId);
  await loadTransactions(__STATE.selectedAccountId);
}

function formatMoney(n, c='TRY'){ return `${Number(n||0).toFixed(2)} ${c}`; }

function renderStats(accounts){
  const el = document.getElementById('cashStats');
  const sum = (list, pred) => list.filter(pred).reduce((s,a)=>s+Number(a.balance||0),0);
  const totalTRY = sum(accounts, a=>a.currency==='TRY');
  const totalCash = sum(accounts, a=>a.type==='cash');
  const totalBank = sum(accounts, a=>a.type==='bank');
  el.innerHTML = `
    <div class="col-12 col-md-3">
      <div class="card kpi-card">
        <div class="card-body">
          <div class="label">Toplam TRY</div>
          <div class="value">${formatMoney(totalTRY,'TRY')}</div>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-3">
      <div class="card kpi-card alt1">
        <div class="card-body">
          <div class="label">Toplam KASA</div>
          <div class="value">${formatMoney(totalCash)}</div>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-3">
      <div class="card kpi-card alt2">
        <div class="card-body">
          <div class="label">Toplam BANKA</div>
          <div class="value">${formatMoney(totalBank)}</div>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-3">
      <div class="card kpi-card" style="background:linear-gradient(135deg,#ff6a88,#ff99ac);">
        <div class="card-body">
          <div class="label">Hesap Sayısı</div>
          <div class="value">${accounts.length}</div>
        </div>
      </div>
    </div>`;
}

function renderAccounts(accounts, selected, search=''){
  const ul = document.getElementById('accountsList');
  ul.innerHTML = '';
  const needle = (search||'').toLowerCase();
  accounts
    .filter(a => !needle || (a.name||'').toLowerCase().includes(needle) || (a.iban||'').toLowerCase().includes(needle))
    .forEach(a => {
      const col = document.createElement('div'); col.className='col';
      const isCash = a.type === 'cash';
      col.innerHTML = `
        <div class="card account-card p-2 ${selected===a.id?'border-primary':''}" role="button">
          <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center gap-2">
              <div class="account-icon ${isCash?'icon-cash':'icon-bank'}">
                <i class="bi ${isCash?'bi-wallet2':'bi-bank2'}"></i>
              </div>
              <div>
                <div class="fw-semibold">${a.name}</div>
                <div class="subtle">${a.type.toUpperCase()} • ${a.currency}${a.iban?` • ${a.iban}`:''}</div>
              </div>
            </div>
            <div class="text-end">
              <div class="balance">${Number(a.balance||0).toFixed(2)}</div>
              <div class="subtle">${a.currency}</div>
            </div>
          </div>
        </div>`;
      col.querySelector('.account-card').onclick = async () => { __STATE.selectedAccountId = a.id; await loadTransactions(a.id); renderAccounts(accounts, a.id, search); };
      ul.appendChild(col);
    });
}

async function loadTransactions(accountId=null){
  const owner = uid();
  let q = supabase.from('cash_transactions').select('*, cash_accounts(name)').eq('owner_id', owner).order('trx_date', { ascending: false }).limit(500);
  if (accountId) q = q.eq('account_id', accountId);
  // Filters
  const t = document.getElementById('fltType')?.value || '';
  const f = document.getElementById('fltFrom')?.value || '';
  const to = document.getElementById('fltTo')?.value || '';
  if (t) q = q.eq('trx_type', t);
  if (f) q = q.gte('trx_date', f);
  if (to) q = q.lte('trx_date', to);
  const { data } = await q;
  const tbody = document.querySelector('#trxTable tbody');
  tbody.innerHTML = '';
  const rows = data||[];
  const emptyEl = document.getElementById('trxEmpty');
  if (!rows.length) { emptyEl.classList.remove('d-none'); } else { emptyEl.classList.add('d-none'); }
  rows.forEach(t => {
    const tr = document.createElement('tr');
    const badgeCls = t.trx_type==='in'?'badge-in':(t.trx_type==='out'?'badge-out':'badge-transfer');
    const typeLabel = t.trx_type==='in'?'Giriş':(t.trx_type==='out'?'Çıkış':(t.trx_type==='transfer_in'?'Transfer (Giriş)':'Transfer (Çıkış)'));
    tr.innerHTML = `
      <td>${t.trx_date}</td>
      <td><span class="badge ${badgeCls}">${typeLabel}</span></td>
      <td class="fw-semibold">${Number(t.amount||0).toFixed(2)} ${t.currency}</td>
      <td>${t.description||''}</td>
      <td>${t.counterparty||''}</td>
      <td>${t.cash_accounts?.name||''}</td>`;
    tbody.appendChild(tr);
  });
}

// Modals
function openNewAccountModal(){
  const m = new bootstrap.Modal(document.getElementById('newAccountModal'));
  document.getElementById('naName').value = '';
  document.getElementById('naType').value = 'cash';
  document.getElementById('naCurrency').value = 'TRY';
  document.getElementById('naIban').value = '';
  document.getElementById('naNotes').value = '';
  m.show();
}

async function saveNewAccount(){
  const payload = {
    owner_id: uid(),
    name: document.getElementById('naName').value.trim(),
    type: document.getElementById('naType').value,
    currency: document.getElementById('naCurrency').value,
    iban: document.getElementById('naIban').value.trim() || null,
    notes: document.getElementById('naNotes').value.trim() || null
  };
  if (!payload.name) { alert('Hesap adı zorunlu'); return; }
  const { error } = await supabase.from('cash_accounts').insert([payload]);
  if (error) return alert('Hesap eklenemedi: ' + error.message);
  bootstrap.Modal.getInstance(document.getElementById('newAccountModal')).hide();
  await loadData();
}

function openMoneyInModal(){
  fillAccountsSelect('miAccount');
  document.getElementById('miAmount').value = '';
  document.getElementById('miDesc').value = '';
  document.getElementById('miDate').value = new Date().toISOString().slice(0,10);
  new bootstrap.Modal(document.getElementById('moneyInModal')).show();
}

function openMoneyOutModal(){
  fillAccountsSelect('moAccount');
  document.getElementById('moAmount').value = '';
  document.getElementById('moDesc').value = '';
  document.getElementById('moDate').value = new Date().toISOString().slice(0,10);
  new bootstrap.Modal(document.getElementById('moneyOutModal')).show();
}

function openTransferModal(){
  fillAccountsSelect('trFrom');
  fillAccountsSelect('trTo');
  document.getElementById('trAmount').value = '';
  document.getElementById('trDesc').value = '';
  document.getElementById('trDate').value = new Date().toISOString().slice(0,10);
  new bootstrap.Modal(document.getElementById('transferModal')).show();
}

async function fillAccountsSelect(selectId){
  const owner = uid();
  const { data: accounts } = await supabase.from('cash_accounts').select('id,name,type,currency').eq('owner_id', owner).order('type');
  const sel = document.getElementById(selectId);
  sel.innerHTML = '';
  (accounts||[]).forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.name} • ${a.type.toUpperCase()} • ${a.currency}`;
    sel.appendChild(opt);
  });
}

async function doMoneyIn(){
  const account = document.getElementById('miAccount').value;
  const amount = Number(document.getElementById('miAmount').value||0);
  const desc = document.getElementById('miDesc').value.trim();
  const date = document.getElementById('miDate').value || null;
  if (!account || amount <= 0) return alert('Hesap ve tutar zorunlu');
  const { error } = await supabase.rpc('cash_in', { p_account: account, p_amount: amount, p_desc: desc || null, p_date: date, p_owner: uid() });
  if (error) return alert('Para girişi hatası: ' + error.message);
  bootstrap.Modal.getInstance(document.getElementById('moneyInModal')).hide();
  await loadData(account);
}

async function doMoneyOut(){
  const account = document.getElementById('moAccount').value;
  const amount = Number(document.getElementById('moAmount').value||0);
  const desc = document.getElementById('moDesc').value.trim();
  const date = document.getElementById('moDate').value || null;
  if (!account || amount <= 0) return alert('Hesap ve tutar zorunlu');
  const { error } = await supabase.rpc('cash_out', { p_account: account, p_amount: amount, p_desc: desc || null, p_date: date, p_owner: uid() });
  if (error) return alert('Para çıkışı hatası: ' + error.message);
  bootstrap.Modal.getInstance(document.getElementById('moneyOutModal')).hide();
  await loadData(account);
}

async function doTransfer(){
  const from = document.getElementById('trFrom').value;
  const to = document.getElementById('trTo').value;
  const amount = Number(document.getElementById('trAmount').value||0);
  const desc = document.getElementById('trDesc').value.trim();
  const date = document.getElementById('trDate').value || null;
  if (!from || !to || from === to || amount <= 0) return alert('Hesaplar farklı olmalı ve tutar > 0');
  const { error } = await supabase.rpc('cash_transfer', { p_from: from, p_to: to, p_amount: amount, p_desc: desc || null, p_date: date, p_owner: uid() });
  if (error) return alert('Transfer hatası: ' + error.message);
  bootstrap.Modal.getInstance(document.getElementById('transferModal')).hide();
  await loadData(to);
}

function exportCsv(){
  const rows = [['Tarih','Tür','Tutar','Açıklama','Karşı Taraf','Hesap']];
  document.querySelectorAll('#trxTable tbody tr').forEach(tr => {
    const cols = Array.from(tr.children).map(td => (td.textContent||'').trim());
    rows.push(cols);
  });
  const csv = rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'cash-transactions.csv'; a.click();
  URL.revokeObjectURL(url);
}

const modalsTpl = `
<div class="modal" id="newAccountModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
  <div class="modal-header"><h5 class="modal-title">Yeni Hesap</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
  <div class="modal-body">
    <div class="row g-2">
      <div class="col-md-6"><label class="form-label">Ad</label><input id="naName" class="form-control"></div>
      <div class="col-md-3"><label class="form-label">Tür</label><select id="naType" class="form-select"><option value="cash">KASA</option><option value="bank">BANKA</option></select></div>
      <div class="col-md-3"><label class="form-label">Döviz</label><input id="naCurrency" value="TRY" class="form-control"></div>
      <div class="col-12"><label class="form-label">IBAN</label><input id="naIban" class="form-control" placeholder="Opsiyonel"></div>
      <div class="col-12"><label class="form-label">Not</label><textarea id="naNotes" class="form-control" rows="2"></textarea></div>
    </div>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary" onclick="window.__saveNewAccount()">Kaydet</button></div>
</div></div></div>

<div class="modal" id="moneyInModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
  <div class="modal-header"><h5 class="modal-title">Para Girişi</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
  <div class="modal-body">
    <div class="row g-2">
      <div class="col-md-6"><label class="form-label">Hesap</label><select id="miAccount" class="form-select"></select></div>
      <div class="col-md-3"><label class="form-label">Tarih</label><input id="miDate" type="date" class="form-control"></div>
      <div class="col-md-3"><label class="form-label">Tutar</label><input id="miAmount" type="number" step="0.01" class="form-control"></div>
      <div class="col-12"><label class="form-label">Açıklama</label><input id="miDesc" class="form-control"></div>
    </div>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-success" onclick="window.__doMoneyIn()">Ekle</button></div>
</div></div></div>

<div class="modal" id="moneyOutModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
  <div class="modal-header"><h5 class="modal-title">Para Çıkışı</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
  <div class="modal-body">
    <div class="row g-2">
      <div class="col-md-6"><label class="form-label">Hesap</label><select id="moAccount" class="form-select"></select></div>
      <div class="col-md-3"><label class="form-label">Tarih</label><input id="moDate" type="date" class="form-control"></div>
      <div class="col-md-3"><label class="form-label">Tutar</label><input id="moAmount" type="number" step="0.01" class="form-control"></div>
      <div class="col-12"><label class="form-label">Açıklama</label><input id="moDesc" class="form-control"></div>
    </div>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-danger" onclick="window.__doMoneyOut()">Çıkar</button></div>
</div></div></div>

<div class="modal" id="transferModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">
  <div class="modal-header"><h5 class="modal-title">Transfer</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>
  <div class="modal-body">
    <div class="row g-2">
      <div class="col-md-6"><label class="form-label">Çıkış Hesabı</label><select id="trFrom" class="form-select"></select></div>
      <div class="col-md-6"><label class="form-label">Giriş Hesabı</label><select id="trTo" class="form-select"></select></div>
      <div class="col-md-4"><label class="form-label">Tarih</label><input id="trDate" type="date" class="form-control"></div>
      <div class="col-md-4"><label class="form-label">Tutar</label><input id="trAmount" type="number" step="0.01" class="form-control"></div>
      <div class="col-md-4"><label class="form-label">Açıklama</label><input id="trDesc" class="form-control"></div>
    </div>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Vazgeç</button><button class="btn btn-primary" onclick="window.__doTransfer()">Transfer Et</button></div>
</div></div></div>
`;

// Expose modal actions
window.__saveNewAccount = () => saveNewAccount();
window.__doMoneyIn = () => doMoneyIn();
window.__doMoneyOut = () => doMoneyOut();
window.__doTransfer = () => doTransfer();
