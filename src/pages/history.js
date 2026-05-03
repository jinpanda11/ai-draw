import { api } from '../api.js';
import { auth } from '../auth.js';

let items = [];
let loading = true;

export async function renderHistoryPage(container) {
  if (!auth.isLoggedIn()) {
    renderLoginPrompt(container);
    return;
  }

  loading = true;
  items = [];
  render(container);

  try {
    items = await api.getHistory();
  } catch (err) {
    console.error(err);
  } finally {
    loading = false;
    render(container);
  }
}

function renderLoginPrompt(container) {
  container.innerHTML = `
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <span class="font-bold text-gray-900 text-lg">AI画图站</span>
        </div>
        <a href="#home" class="text-sm text-purple-600 hover:text-purple-700 font-medium">← 返回首页</a>
      </div>
    </nav>
    <div class="max-w-5xl mx-auto p-4 md:p-6">
      <div class="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-200">
        <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-700 mb-2">请先登录</h3>
        <p class="text-sm text-gray-400 mb-6">登录后可查看您的历史生成记录</p>
        <a href="#home" class="gradient-btn px-8 py-3 text-white font-medium rounded-xl inline-block">返回首页登录</a>
      </div>
    </div>
  `;
}

function render(container) {
  container.innerHTML = `
    <!-- Navbar -->
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <span class="font-bold text-gray-900 text-lg">AI画图站</span>
        </div>
        <div class="flex items-center gap-4">
          <a href="#home" class="text-sm text-purple-600 hover:text-purple-700 font-medium">← 返回生成</a>
          <button id="logout-btn" class="text-sm text-gray-500 hover:text-red-500">退出</button>
        </div>
      </div>
    </nav>

    <div class="max-w-5xl mx-auto p-4 md:p-6">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">历史记录</h1>

      ${loading ? `
        <div class="flex justify-center py-20">
          <div class="animate-spin w-8 h-8 border-4 border-purple-200 border-t-purple-500 rounded-full"></div>
        </div>
      ` : items.length === 0 ? `
        <div class="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-200">
          <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          </div>
          <p class="text-gray-500">暂无生成记录</p>
          <a href="#home" class="text-purple-600 hover:text-purple-700 text-sm mt-2 inline-block">去生成第一张图片</a>
        </div>
      ` : `
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          ${items.map(item => renderItem(item)).join('')}
        </div>
        <p class="text-xs text-gray-400 text-center mt-6">最多保留最近 20 条记录</p>
      `}
    </div>

    <!-- Image Modal -->
    <div id="image-modal" class="modal-overlay hidden">
      <div class="relative max-w-4xl w-full mx-4">
        <button id="close-image-modal" class="absolute -top-10 right-0 text-white text-2xl">&times;</button>
        <img id="image-modal-img" src="" class="w-full rounded-2xl shadow-2xl" style="max-height:85vh;object-fit:contain;">
      </div>
    </div>
  `;

  bindEvents(container);
}

function renderItem(item) {
  const date = new Date(item.created_at + 'Z').toLocaleString('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  const thumbUrl = item.image_urls && item.image_urls.length > 0 ? item.image_urls[0] : '';
  const prompt = item.prompt || '';

  return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow">
      <div class="aspect-square bg-gray-100 relative cursor-pointer" onclick="window._openImageModal('${escapeAttr(thumbUrl)}')">
        ${thumbUrl
          ? `<img src="${thumbUrl}" class="w-full h-full object-cover" loading="lazy">`
          : `<div class="flex items-center justify-center h-full text-gray-400">无图片</div>`
        }
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
      </div>
      <div class="p-3">
        <p class="text-xs text-gray-700 line-clamp-2 mb-2">${escapeHtml(prompt.substring(0, 80))}${prompt.length > 80 ? '...' : ''}</p>
        <div class="flex items-center justify-between">
          <span class="text-xs text-gray-400">${date} · ${escapeHtml(item.model)}</span>
          <button data-delete="${item.id}" class="delete-btn text-red-400 hover:text-red-600 text-xs">删除</button>
        </div>
      </div>
    </div>
  `;
}

function bindEvents(container) {
  document.getElementById('logout-btn')?.addEventListener('click', () => auth.logout());

  // Delete buttons
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('确定要删除这条记录吗？')) return;
      const id = btn.dataset.delete;
      try {
        await api.deleteHistory(id);
        items = items.filter(i => String(i.id) !== id);
        render(container);
      } catch (err) {
        alert(err.message);
      }
    });
  });

  // Image modal
  document.getElementById('close-image-modal')?.addEventListener('click', () => {
    document.getElementById('image-modal')?.classList.add('hidden');
  });
  document.getElementById('image-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('image-modal')) {
      document.getElementById('image-modal')?.classList.add('hidden');
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

window._openImageModal = function(url) {
  const modal = document.getElementById('image-modal');
  const img = document.getElementById('image-modal-img');
  if (modal && img) {
    img.src = url;
    modal.classList.remove('hidden');
  }
};
