import { api } from '../api.js';
import { auth } from '../auth.js';

let stats = null;
let apiSettings = null;
let smtpSettings = null;
let models = [];
let users = [];
let editingModelId = null;

export async function renderAdminPage(container) {
  // Check if admin
  const user = auth.getUser();
  if (!user || user.role !== 'admin') {
    container.innerHTML = `
      <div class="max-w-5xl mx-auto p-4 md:p-6">
        <div class="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-200">
          <div class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-700 mb-2">无权限访问</h3>
          <p class="text-sm text-gray-400">需要管理员权限</p>
          <a href="#home" class="text-purple-600 hover:text-purple-700 text-sm mt-4 inline-block">← 返回首页</a>
        </div>
      </div>
    `;
    return;
  }

  try {
    [stats, apiSettings, smtpSettings, models, users] = await Promise.all([
      api.adminStats(),
      api.getApiSettings(),
      api.getSMTPSettings(),
      api.getModels(),
      api.getUsers(),
    ]);
  } catch {
    stats = null;
    apiSettings = null;
    smtpSettings = null;
    models = [];
    users = [];
  }
  render(container);
}

function render(container) {
  if (!stats) {
    container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin w-8 h-8 border-4 border-purple-200 border-t-purple-500 rounded-full"></div></div>';
    return;
  }

  container.innerHTML = `
    <!-- Navbar -->
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <span class="font-bold text-gray-900 text-lg">管理后台</span>
        </div>
        <div class="flex items-center gap-4">
          <a href="#home" class="text-sm text-gray-500 hover:text-gray-700">← 返回首页</a>
          <button id="logout-btn" class="text-sm text-gray-500 hover:text-red-500">退出</button>
        </div>
      </div>
    </nav>

    <div class="max-w-6xl mx-auto p-4 md:p-6">

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p class="text-sm text-gray-500 mb-1">用户总数</p>
          <p class="text-3xl font-bold text-gray-900">${stats.userCount}</p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p class="text-sm text-gray-500 mb-1">今日生成次数</p>
          <p class="text-3xl font-bold text-gray-900">${stats.todayGenerations}</p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p class="text-sm text-gray-500 mb-1">总生成次数</p>
          <p class="text-3xl font-bold text-gray-900">${stats.totalGenerations}</p>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p class="text-sm text-gray-500 mb-1">每日免费次数</p>
          <div class="flex items-center gap-2 mt-1">
            <input id="daily-limit-input" type="number" value="${stats.dailyLimit}" min="0" max="999"
              class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-xl font-bold text-center focus:ring-2 focus:ring-purple-500 outline-none">
            <button id="save-daily-limit" class="text-sm bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700">保存</button>
          </div>
        </div>
      </div>

      <!-- User List -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">用户列表 (${users.length})</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-gray-500 border-b border-gray-100">
                <th class="pb-3 font-medium">邮箱</th>
                <th class="pb-3 font-medium">角色</th>
                <th class="pb-3 font-medium">注册时间</th>
                <th class="pb-3 font-medium">今日已用</th>
                <th class="pb-3 font-medium">总生成</th>
              </tr>
            </thead>
            <tbody>
              ${users.length === 0 ? `
                <tr><td colspan="5" class="py-8 text-center text-gray-400">暂无用户</td></tr>
              ` : users.map(u => {
                const today = new Date().toISOString().slice(0, 10);
                const usedToday = u.last_free_date === today ? (u.free_count_today || 0) : 0;
                return `
                <tr class="border-b border-gray-50 hover:bg-gray-50">
                  <td class="py-3 text-gray-900">${escapeHtml(u.email)}</td>
                  <td class="py-3">${u.role === 'admin' ? '<span class="text-red-600 font-medium">管理员</span>' : '<span class="text-gray-500">用户</span>'}</td>
                  <td class="py-3 text-gray-500">${(u.created_at || '').substring(0, 10)}</td>
                  <td class="py-3 text-gray-900">${usedToday}</td>
                  <td class="py-3 text-gray-900">${u.total_generations || 0}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Settings Row -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">系统设置</h2>
        <div class="flex items-center justify-between py-2">
          <div>
            <p class="font-medium text-gray-900">注册邮箱验证</p>
            <p class="text-sm text-gray-500">开启后，注册时需要邮箱验证码；关闭则直接注册</p>
          </div>
          <button id="toggle-email-verification"
            class="relative w-12 h-6 rounded-full transition-colors ${stats.emailVerificationEnabled ? 'bg-purple-600' : 'bg-gray-300'}">
            <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${stats.emailVerificationEnabled ? 'translate-x-6' : ''}"></span>
          </button>
        </div>
      </div>

      <!-- SMTP Settings -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">邮件服务配置 (SMTP)</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">SMTP 服务器</label>
            <input id="smtp-host" type="text" value="${escapeHtml(smtpSettings?.host || '')}" placeholder="smtp.qq.com"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">端口</label>
            <input id="smtp-port" type="number" value="${smtpSettings?.port || 465}" placeholder="465"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">发件邮箱</label>
            <input id="smtp-user" type="text" value="${escapeHtml(smtpSettings?.user || '')}" placeholder="your@qq.com"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">授权码</label>
            <input id="smtp-pass" type="password" value="${escapeHtml(smtpSettings?.pass || '')}" placeholder="QQ邮箱授权码"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm">
          </div>
        </div>
        <button id="save-smtp-settings" class="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium">保存 SMTP 配置</button>
      </div>

      <!-- API Settings -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">API 配置</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input id="api-key-input" type="text" value="${escapeHtml(apiSettings?.apiKey || '')}" placeholder="输入 Grsai API Key"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">API 地址（5个可用地址，按优先级使用）</label>
            <div class="space-y-2">
              ${(apiSettings?.urls || []).map((url, i) => `
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-400 w-16">地址 #${i + 1}</span>
                  <input id="api-url-${i}" type="text" value="${escapeHtml(url || '')}" placeholder="https://grsai.dakka.com.cn"
                    class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm">
                </div>
              `).join('')}
            </div>
          </div>
          <button id="save-api-settings" class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium">保存 API 配置</button>
        </div>
      </div>

      <!-- Model Management -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">模型管理</h2>
          <button id="show-add-model-btn" class="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">+ 添加模型</button>
        </div>

        <!-- Add/Edit Model Form -->
        <div id="model-form" class="hidden border border-purple-200 bg-purple-50 rounded-xl p-4 mb-4">
          <h3 id="model-form-title" class="font-medium text-gray-900 mb-3">添加模型</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">模型标识名</label>
              <input id="model-name" type="text" placeholder="如: nano-banana-fast"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">显示名称</label>
              <input id="model-display-name" type="text" placeholder="如: Nano Banana Fast"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">接口路径 (endpoint)</label>
              <input id="model-endpoint" type="text" placeholder="如: /v1/draw/nano-banana"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm">
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">使用 API 地址 #</label>
              <select id="model-url-index" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm bg-white">
                <option value="0">地址 #1</option>
                <option value="1">地址 #2</option>
                <option value="2">地址 #3</option>
                <option value="3">地址 #4</option>
                <option value="4">地址 #5</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">排序</label>
              <input id="model-sort-order" type="number" value="0" min="0"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm">
            </div>
          </div>
          <div class="flex gap-3 mt-4">
            <button id="save-model-btn" class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium">保存</button>
            <button id="cancel-model-btn" class="text-gray-600 border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50 text-sm">取消</button>
          </div>
        </div>

        <!-- Models Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-left text-gray-500">
                <th class="pb-3 font-medium">标识名</th>
                <th class="pb-3 font-medium">显示名</th>
                <th class="pb-3 font-medium">接口路径</th>
                <th class="pb-3 font-medium">地址#</th>
                <th class="pb-3 font-medium">排序</th>
                <th class="pb-3 font-medium">状态</th>
                <th class="pb-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              ${models.length === 0 ? `
                <tr><td colspan="7" class="py-8 text-center text-gray-400">暂无模型，请添加</td></tr>
              ` : models.map(m => `
                <tr class="border-b border-gray-100 ${m.is_active ? '' : 'opacity-50'}">
                  <td class="py-3 font-medium text-gray-900">${escapeHtml(m.name)}</td>
                  <td class="py-3 text-gray-700">${escapeHtml(m.display_name)}</td>
                  <td class="py-3 text-gray-500 font-mono text-xs">${escapeHtml(m.endpoint)}</td>
                  <td class="py-3 text-gray-500">#${m.url_index}</td>
                  <td class="py-3 text-gray-500">${m.sort_order}</td>
                  <td class="py-3">
                    <span class="text-xs px-2 py-0.5 rounded-full ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${m.is_active ? '启用' : '禁用'}</span>
                  </td>
                  <td class="py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button data-edit-model="${m.id}" class="text-xs text-purple-600 hover:text-purple-700 edit-model-btn">编辑</button>
                      <button data-toggle-model="${m.id}" class="text-xs ${m.is_active ? 'text-orange-500 hover:text-orange-700' : 'text-green-500 hover:text-green-700'} toggle-model-btn">${m.is_active ? '禁用' : '启用'}</button>
                      <button data-delete-model="${m.id}" class="text-xs text-red-500 hover:text-red-700 delete-model-btn">删除</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Announcements Management -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">公告管理</h2>
          <button id="create-announcement-btn" class="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">+ 新建公告</button>
        </div>

        <div id="announcements-list">
          ${stats.announcements.length === 0 ? `
            <p class="text-sm text-gray-400 text-center py-8">暂无公告</p>
          ` : `
            <div class="space-y-3">
              ${stats.announcements.map(a => `
                <div class="border border-gray-200 rounded-lg p-4 ${a.is_active ? 'border-l-4 border-l-green-500' : 'opacity-60'}">
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <h4 class="font-medium text-gray-900">${escapeHtml(a.title)}</h4>
                      <p class="text-sm text-gray-500 mt-1">${escapeHtml(a.content).substring(0, 100)}${a.content.length > 100 ? '...' : ''}</p>
                      <p class="text-xs text-gray-400 mt-2">${a.created_at} ${a.is_active ? '<span class="text-green-600 ml-2">● 启用中</span>' : '<span class="text-gray-400 ml-2">○ 已禁用</span>'}</p>
                    </div>
                    <div class="flex items-center gap-2 ml-4">
                      <button data-toggle="${a.id}" data-active="${a.is_active ? 0 : 1}"
                        class="text-xs ${a.is_active ? 'text-orange-500 hover:text-orange-700' : 'text-green-500 hover:text-green-700'} toggle-announcement-btn">
                        ${a.is_active ? '禁用' : '启用'}
                      </button>
                      <button data-delete="${a.id}" class="text-xs text-red-500 hover:text-red-700 delete-announcement-btn">删除</button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>

      <!-- Create Announcement Modal (hidden by default, shown by JS) -->
    </div>

    <!-- Hidden create announcement form (shown inline when clicking create) -->
    <div id="create-announcement-form" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;display:none;align-items:center;justify-content:center;">
      <div class="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <h3 class="text-lg font-bold mb-4">新建公告</h3>
        <input id="new-title" placeholder="公告标题" class="w-full px-4 py-3 border border-gray-300 rounded-xl mb-3 focus:ring-2 focus:ring-purple-500 outline-none">
        <textarea id="new-content" rows="5" placeholder="公告内容（支持换行）" class="w-full px-4 py-3 border border-gray-300 rounded-xl mb-4 focus:ring-2 focus:ring-purple-500 outline-none resize-none"></textarea>
        <div class="flex gap-3">
          <button id="submit-announcement" class="gradient-btn flex-1 py-3 text-white font-medium rounded-xl">发布公告</button>
          <button id="cancel-announcement" class="flex-1 py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50">取消</button>
        </div>
      </div>
    </div>
  `;

  bindEvents(container);
}

async function refreshData(container) {
  try {
    [stats, apiSettings, models] = await Promise.all([
      api.adminStats(),
      api.getApiSettings(),
      api.getModels(),
    ]);
  } catch {}
  render(container);
}

function bindEvents(container) {
  document.getElementById('logout-btn')?.addEventListener('click', () => auth.logout());

  // Daily limit
  document.getElementById('save-daily-limit')?.addEventListener('click', async () => {
    const val = document.getElementById('daily-limit-input')?.value;
    if (val === '' || parseInt(val) < 0) { alert('请输入有效的数字'); return; }
    try {
      await api.updateSetting('daily_free_limit', val);
      stats.dailyLimit = val;
      alert('已保存');
    } catch (err) {
      alert(err.message);
    }
  });

  // Email verification toggle
  document.getElementById('toggle-email-verification')?.addEventListener('click', async () => {
    const newVal = stats.emailVerificationEnabled ? '0' : '1';
    try {
      await api.updateSetting('email_verification_enabled', newVal);
      stats.emailVerificationEnabled = !stats.emailVerificationEnabled;
      render(container);
    } catch (err) {
      alert(err.message);
    }
  });

  // SMTP Settings save
  document.getElementById('save-smtp-settings')?.addEventListener('click', async () => {
    const host = document.getElementById('smtp-host')?.value?.trim() || '';
    const port = parseInt(document.getElementById('smtp-port')?.value) || 465;
    const user = document.getElementById('smtp-user')?.value?.trim() || '';
    const pass = document.getElementById('smtp-pass')?.value || '';
    try {
      await api.updateSMTPSettings({ host, port, user, pass });
      smtpSettings = { host, port, user, pass };
      alert('SMTP 配置已保存');
    } catch (err) {
      alert(err.message);
    }
  });

  // API Settings save
  document.getElementById('save-api-settings')?.addEventListener('click', async () => {
    const apiKey = document.getElementById('api-key-input')?.value || '';
    const urls = [];
    for (let i = 0; i < 5; i++) {
      urls.push(document.getElementById(`api-url-${i}`)?.value || '');
    }
    const btn = document.getElementById('save-api-settings');
    btn.disabled = true;
    btn.textContent = '保存中...';
    try {
      await api.updateApiSettings(apiKey, urls);
      apiSettings = { apiKey, urls };
      alert('API 配置已保存');
    } catch (err) {
      alert(err.message);
    }
    btn.disabled = false;
    btn.textContent = '保存 API 配置';
  });

  // Model form - show add
  document.getElementById('show-add-model-btn')?.addEventListener('click', () => {
    editingModelId = null;
    const form = document.getElementById('model-form');
    if (form) {
      form.classList.remove('hidden');
      document.getElementById('model-form-title').textContent = '添加模型';
      document.getElementById('model-name').value = '';
      document.getElementById('model-display-name').value = '';
      document.getElementById('model-endpoint').value = '';
      document.getElementById('model-url-index').value = '0';
      document.getElementById('model-sort-order').value = '0';
    }
  });

  // Model form - cancel
  document.getElementById('cancel-model-btn')?.addEventListener('click', () => {
    editingModelId = null;
    document.getElementById('model-form')?.classList.add('hidden');
  });

  // Model form - save
  document.getElementById('save-model-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('model-name')?.value?.trim();
    const display_name = document.getElementById('model-display-name')?.value?.trim();
    const endpoint = document.getElementById('model-endpoint')?.value?.trim();
    const url_index = parseInt(document.getElementById('model-url-index')?.value || '0');
    const sort_order = parseInt(document.getElementById('model-sort-order')?.value || '0');

    if (!name || !display_name || !endpoint) { alert('请填写模型标识名、显示名称和接口路径'); return; }

    try {
      if (editingModelId) {
        await api.updateModel(editingModelId, { name, display_name, endpoint, url_index, sort_order });
      } else {
        await api.createModel({ name, display_name, endpoint, url_index, sort_order });
      }
      editingModelId = null;
      document.getElementById('model-form')?.classList.add('hidden');
      await refreshData(container);
    } catch (err) {
      alert(err.message);
    }
  });

  // Model - edit
  container.querySelectorAll('.edit-model-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.editModel);
      const m = models.find(x => x.id === id);
      if (!m) return;
      editingModelId = id;
      const form = document.getElementById('model-form');
      if (form) {
        form.classList.remove('hidden');
        document.getElementById('model-form-title').textContent = '编辑模型';
        document.getElementById('model-name').value = m.name;
        document.getElementById('model-display-name').value = m.display_name;
        document.getElementById('model-endpoint').value = m.endpoint;
        document.getElementById('model-url-index').value = String(m.url_index);
        document.getElementById('model-sort-order').value = String(m.sort_order);
      }
    });
  });

  // Model - toggle
  container.querySelectorAll('.toggle-model-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.toggleModel);
      try {
        await api.toggleModel(id);
        await refreshData(container);
      } catch (err) {
        alert(err.message);
      }
    });
  });

  // Model - delete
  container.querySelectorAll('.delete-model-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('确定要删除这个模型吗？')) return;
      try {
        await api.deleteModel(parseInt(btn.dataset.deleteModel));
        await refreshData(container);
      } catch (err) {
        alert(err.message);
      }
    });
  });

  // Create announcement
  const createForm = document.getElementById('create-announcement-form');
  document.getElementById('create-announcement-btn')?.addEventListener('click', () => {
    if (createForm) createForm.style.display = 'flex';
  });
  document.getElementById('cancel-announcement')?.addEventListener('click', () => {
    if (createForm) createForm.style.display = 'none';
  });
  document.getElementById('submit-announcement')?.addEventListener('click', async () => {
    const title = document.getElementById('new-title')?.value?.trim();
    const content = document.getElementById('new-content')?.value?.trim();
    if (!title || !content) { alert('标题和内容不能为空'); return; }
    try {
      await api.createAnnouncement(title, content);
      if (createForm) createForm.style.display = 'none';
      stats = await api.adminStats();
      render(container);
    } catch (err) {
      alert(err.message);
    }
  });

  // Toggle / Delete announcements
  container.querySelectorAll('.toggle-announcement-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggle;
      const active = parseInt(btn.dataset.active);
      try {
        await api.updateAnnouncement(id, { is_active: active });
        stats = await api.adminStats();
        render(container);
      } catch (err) {
        alert(err.message);
      }
    });
  });

  container.querySelectorAll('.delete-announcement-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('确定要删除这条公告吗？')) return;
      try {
        await api.deleteAnnouncement(btn.dataset.delete);
        stats = await api.adminStats();
        render(container);
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
