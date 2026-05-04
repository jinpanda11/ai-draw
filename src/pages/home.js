import { api } from '../api.js';
import { auth } from '../auth.js';

// State
let state = {
  prompt: '',
  negativePrompt: '',
  model: 'gpt-image-2',
  aspectRatio: '1:1',
  quality: 'auto',
  referenceUrls: [],
  generating: false,
  results: [],
  showAdvanced: false,
  user: auth.getUser(),
  announcement: null,
  announcementDismissed: false,
  showLoginModal: false,
  showExhaustedModal: false,
  loginMode: 'login',
  loginStep: 'email',
  loginEmail: '',
  loginPassword: '',
  loginConfirmPassword: '',
  loginCode: '',
  loginCountdown: 0,
  verificationEnabled: true,
  models: [],
  modelsLoaded: false,
  dailyLimit: 10,
};

export async function renderHomePage(container) {
  // Refresh user info if logged in
  if (auth.isLoggedIn()) {
    try {
      const user = await auth.refreshUser();
      if (user) {
        state.user = user;
        state.dailyLimit = user.dailyLimit || state.dailyLimit;
      }
    } catch {}
  } else {
    state.user = null;
  }

  // Load public config for daily limit (works without login)
  try {
    const config = await api.getPublicConfig();
    if (config.dailyLimit) state.dailyLimit = config.dailyLimit;
  } catch {}

  // Load models if not loaded
  if (!state.modelsLoaded) {
    try {
      state.models = await api.getActiveModels();
      state.modelsLoaded = true;
      // Default to first active model if current model not found
      if (state.models.length > 0 && !state.models.find(m => m.name === state.model)) {
        state.model = state.models[0].name;
      }
    } catch { state.models = []; }
  }

  // Check announcement
  await checkAnnouncement();

  render();
  bindEvents();
}

function render() {
  const { user, generating, results, showAdvanced, announcement, announcementDismissed, showLoginModal, loginEmail, loginCountdown } = state;
  const isLoggedIn = !!user;
  const remaining = user?.remaining ?? 0;
  const dailyLimit = state.dailyLimit;
  const previewUrls = state.referenceUrls;

  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <!-- Announcement Modal -->
    ${announcement && !announcementDismissed ? (() => {
      const size = announcement.display_size || 'md';
      const sizeMap = { sm: ['py-2', 'text-xs'], md: ['py-3', 'text-sm'], lg: ['py-4', 'text-base'] };
      const [modalPy, textSize] = sizeMap[size] || sizeMap.md;
      return `
    <div class="modal-overlay" id="announcement-modal">
      <div class="modal-content max-w-lg w-full animate-fade-in">
        <h3 class="text-lg font-bold mb-4">${escapeHtml(announcement.title)}</h3>
        <p class="text-gray-600 whitespace-pre-wrap ${textSize}">${linkify(escapeHtml(announcement.content))}</p>
        <button id="dismiss-announcement" class="gradient-btn w-full mt-4 ${modalPy} text-white font-medium rounded-lg">我知道了</button>
      </div>
    </div>
    `})() : ''}

    <!-- Login Modal -->
    ${showLoginModal ? `
    <div class="modal-overlay" id="login-modal">
      <div class="modal-content max-w-md w-full animate-fade-in">
        <div class="flex items-center justify-between mb-4">
          <div class="flex gap-0 bg-gray-100 rounded-lg p-1">
            <button id="login-tab-btn" class="px-6 py-2 rounded-md text-sm font-medium transition-all
              ${state.loginMode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">登录</button>
            <button id="register-tab-btn" class="px-6 py-2 rounded-md text-sm font-medium transition-all
              ${state.loginMode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}">注册</button>
          </div>
          <button id="close-login-modal" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <p class="text-sm text-gray-500 mb-4">
          ${state.loginMode === 'register' ? '注册后可生成图片，每日免费' + dailyLimit + '次' : '登录后继续使用AI画图'}
        </p>

        ${state.loginMode === 'login' ? `
          <div class="animate-fade-in">
            <label class="block text-sm font-medium text-gray-700 mb-2">邮箱地址</label>
            <input id="login-email-input" type="email" value="${escapeHtml(loginEmail)}" placeholder="请输入您的邮箱"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
            <label class="block text-sm font-medium text-gray-700 mb-2 mt-3">密码</label>
            <input id="login-password-input" type="password" placeholder="请输入密码"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
            <button id="login-submit-btn" class="gradient-btn w-full py-3 mt-4 text-white font-medium rounded-xl">
              登录
            </button>
          </div>
        ` : state.loginMode === 'register' && state.loginStep === 'email' && state.verificationEnabled ? `
          <div class="animate-fade-in">
            <label class="block text-sm font-medium text-gray-700 mb-2">邮箱地址</label>
            <input id="login-email-input" type="email" value="${escapeHtml(loginEmail)}" placeholder="请输入您的邮箱"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
            <button id="register-send-code-btn" class="gradient-btn w-full py-3 mt-4 text-white font-medium rounded-xl">
              发送验证码
            </button>
            <p class="text-xs text-gray-400 text-center mt-3">注册即表示同意服务条款，每日免费${dailyLimit}次</p>
          </div>
        ` : state.loginMode === 'register' && state.loginStep === 'code' && state.verificationEnabled ? `
          <div class="animate-fade-in">
            <p class="text-sm text-gray-600 mb-4">验证码已发送至 <strong>${escapeHtml(loginEmail)}</strong></p>
            <label class="block text-sm font-medium text-gray-700 mb-2">验证码</label>
            <input id="login-code-input" type="text" maxlength="6" placeholder="请输入6位验证码"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-widest focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
            <label class="block text-sm font-medium text-gray-700 mb-2 mt-3">设置密码</label>
            <input id="login-password-input" type="password" placeholder="请设置密码（至少6位）"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
            <label class="block text-sm font-medium text-gray-700 mb-2 mt-3">确认密码</label>
            <input id="login-confirm-password-input" type="password" placeholder="请再次输入密码"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
            <button id="register-submit-btn" class="gradient-btn w-full py-3 mt-4 text-white font-medium rounded-xl">
              注册
            </button>
            <div class="flex justify-between items-center mt-3">
              <button id="register-back-btn" class="text-sm text-gray-500 hover:text-gray-700">更换邮箱</button>
              <button id="register-resend-btn" class="text-sm text-purple-600 hover:text-purple-700 ${loginCountdown > 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${loginCountdown > 0 ? 'disabled' : ''}>
                ${loginCountdown > 0 ? `重新发送 (${loginCountdown}s)` : '重新发送验证码'}
              </button>
            </div>
          </div>
        ` : `
          <div class="animate-fade-in">
            <label class="block text-sm font-medium text-gray-700 mb-2">邮箱地址</label>
            <input id="login-email-input" type="email" value="${escapeHtml(loginEmail)}" placeholder="请输入您的邮箱"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
            <label class="block text-sm font-medium text-gray-700 mb-2 mt-3">设置密码</label>
            <input id="login-password-input" type="password" placeholder="请设置密码（至少6位）"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
            <label class="block text-sm font-medium text-gray-700 mb-2 mt-3">确认密码</label>
            <input id="login-confirm-password-input" type="password" placeholder="请再次输入密码"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
            <button id="register-submit-btn" class="gradient-btn w-full py-3 mt-4 text-white font-medium rounded-xl">
              注册
            </button>
            <p class="text-xs text-gray-400 text-center mt-3">注册即表示同意服务条款，每日免费${dailyLimit}次</p>
          </div>
        `}
      </div>
    </div>
    ` : ''}

    <!-- Exhausted Quota Modal -->
    ${state.showExhaustedModal ? `
    <div class="modal-overlay" id="exhausted-modal">
      <div class="modal-content max-w-sm w-full animate-fade-in text-center">
        <h3 class="text-lg font-bold text-gray-900 mb-2">今日免费次数已用完</h3>
        <p class="text-sm text-gray-500 mb-6">感谢使用AI画图站，请明天再来生成更多作品</p>
        <button id="close-exhausted-modal" class="gradient-btn w-full py-2.5 text-white font-medium rounded-xl">
          知道了
        </button>
      </div>
    </div>
    ` : ''}

    <!-- Navbar -->
    <nav class="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <span class="font-bold text-gray-900 text-lg">AI画图站</span>
        </div>

        <div class="flex items-center gap-3">
          ${isLoggedIn ? `
            <span class="text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full font-medium">
              剩余 <span id="quota-display" class="font-bold">${remaining}</span> / ${dailyLimit} 次
            </span>
            <a href="#history" class="text-sm text-gray-600 hover:text-gray-900">历史记录</a>
            ${user.role === 'admin' ? `<a href="#admin" class="text-sm text-red-500 hover:text-red-700 font-medium">后台</a>` : ''}
            <span class="text-xs text-gray-400">${escapeHtml(user.email)}</span>
            <button id="logout-btn" class="text-sm text-gray-500 hover:text-red-500">退出</button>
          ` : `
            <span class="text-xs text-gray-400">每日免费 ${dailyLimit} 次</span>
            <button id="nav-login-btn" class="text-sm bg-purple-600 text-white px-4 py-1.5 rounded-full hover:bg-purple-700 transition-colors font-medium">登录</button>
          `}
        </div>
      </div>
    </nav>

    <!-- Announcement Banner -->
    ${announcement ? (() => {
      const size = announcement.display_size || 'md';
      const sizeMap = { sm: ['py-1.5', 'text-xs'], md: ['py-3', 'text-sm'], lg: ['py-4', 'text-base'] };
      const [py, textSize] = sizeMap[size] || sizeMap.md;
      return `
    <div id="announcement-banner" class="bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200">
      <div class="max-w-7xl mx-auto px-4 ${py} flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0">
          <svg class="w-5 h-5 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
          </svg>
          <p class="${textSize} text-purple-700 font-medium truncate">
            <span class="font-semibold">${escapeHtml(announcement.title)}：</span>${linkify(escapeHtml(announcement.content))}
          </p>
        </div>
        <!-- 公告栏不可关闭 -->
      </div>
    </div>
    `})() : ''}

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto p-4 md:p-6">
      <div class="flex flex-col lg:flex-row gap-6">

        <!-- Left Panel -->
        <div class="w-full lg:w-[420px] flex-shrink-0">
          <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-5 sticky top-20">

            <!-- Prompt -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">描述你想生成的画面</label>
              <textarea id="prompt-input" rows="3"
                placeholder="例如：一只可爱的橘猫在阳光下的草地上打盹，旁边有几朵小花，柔和的自然光线，浅景深效果..."
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-all text-sm">${escapeHtml(state.prompt)}</textarea>
            </div>

            <!-- Model Selection -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">模型</label>
              <select id="model-select" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-sm">
                ${state.models.length === 0 ? `
                  <option value="">无可用模型</option>
                ` : state.models.map(m => `
                  <option value="${escapeHtml(m.name)}" ${state.model === m.name ? 'selected' : ''}>${escapeHtml(m.display_name)}</option>
                `).join('')}
              </select>
            </div>

            <!-- Aspect Ratio -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">画面比例</label>
              <div class="grid grid-cols-5 gap-2">
                ${['1:1','3:2','2:3','16:9','9:16'].map(ratio => `
                  <button data-ratio="${ratio}"
                    class="ratio-btn py-2 rounded-lg text-xs font-medium border transition-all
                    ${state.aspectRatio === ratio ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}">
                    ${ratio}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Quality -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">质量</label>
              <select id="quality-select" class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white text-sm">
                <option value="auto" ${state.quality === 'auto' ? 'selected' : ''}>自动 (推荐)</option>
                <option value="low" ${state.quality === 'low' ? 'selected' : ''}>低质量 (更快)</option>
                <option value="medium" ${state.quality === 'medium' ? 'selected' : ''}>中等</option>
                <option value="high" ${state.quality === 'high' ? 'selected' : ''}>高质量 (更慢)</option>
              </select>
            </div>

            <!-- Reference Images Upload -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-2">
                参考图片 <span class="text-gray-400 font-normal">(可选，支持多张)</span>
              </label>
              <div class="flex flex-wrap gap-2 mb-2" id="preview-container">
                ${previewUrls.map((url, i) => `
                  <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                    <img src="${url}" class="w-full h-full object-cover">
                    <button data-remove-ref="${i}" class="absolute top-0 right-0 bg-red-500 text-white w-5 h-5 flex items-center justify-center text-xs rounded-bl-lg remove-ref-btn">&times;</button>
                  </div>
                `).join('')}
              </div>
              <div id="upload-area" class="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-purple-400 transition-colors cursor-pointer">
                <input type="file" id="ref-upload" accept="image/*" multiple class="hidden">
                <svg class="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                </svg>
                <p class="text-xs text-gray-500">点击上传参考图片</p>
              </div>
            </div>

            <!-- Advanced Options Toggle -->
            <button id="toggle-advanced" class="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1">
              <svg class="w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}" id="advanced-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 5 7 7-7 7"/>
              </svg>
              高级选项 (负面提示词)
            </button>

            <!-- Advanced: Negative Prompt -->
            ${showAdvanced ? `
            <div class="animate-fade-in">
              <label class="block text-sm font-semibold text-gray-700 mb-2">负面提示词 <span class="text-gray-400 font-normal">(不想要的内容)</span></label>
              <textarea id="negative-prompt-input" rows="2"
                placeholder="例如：模糊、低质量、变形的手指、额外的肢体、水印、文字..."
                class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none transition-all text-sm">${escapeHtml(state.negativePrompt)}</textarea>
            </div>
            ` : ''}

            <!-- Generate Button -->
            <button id="generate-btn"
              class="gradient-btn w-full py-3.5 text-white font-semibold rounded-xl"
              ${generating ? 'disabled' : ''}>
              ${generating
                ? '<span class="flex items-center justify-center gap-2"><svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>AI 正在创作中...</span>'
                : '✨ 开始生成'
              }
            </button>
            ${isLoggedIn && remaining <= 0 ? '<p class="text-xs text-red-500 text-center">今日免费次数已用完，请明天再来</p>' : ''}
          </div>
        </div>

        <!-- Right Panel: Results -->
        <div class="flex-1">
          ${generating ? `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center min-h-[400px]">
              <div class="relative w-20 h-20 mb-6">
                <div class="absolute inset-0 rounded-full border-4 border-purple-100"></div>
                <div class="absolute inset-0 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
              </div>
              <p class="text-lg font-medium text-gray-700">AI 正在创作中...</p>
              <p class="text-sm text-gray-400 mt-2">这可能需要几秒到几分钟</p>
            </div>
          ` : results.length > 0 ? `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
              <h3 class="font-semibold text-gray-900 mb-4">生成结果</h3>
              <div class="grid grid-cols-2 gap-3">
                ${results.map((url, i) => `
                  <div class="relative group">
                    <img src="${url}" alt="生成结果 ${i+1}"
                      class="image-preview w-full cursor-pointer"
                      data-image-url="${escapeAttr(url)}">
                    <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <a href="${url}" download class="bg-white/90 hover:bg-white rounded-lg p-2 shadow text-gray-700 text-xs" title="下载">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      </a>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 flex flex-col items-center justify-center min-h-[400px] text-center">
              <div class="w-24 h-24 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mb-6">
                <svg class="w-12 h-12 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-700 mb-2">开始创作</h3>
              <p class="text-sm text-gray-400 max-w-sm">在左侧输入描述词、选择模型和参数，然后点击生成按钮，AI将为你创作独特的图片</p>
            </div>
          `}
        </div>
      </div>
    </div>

    <!-- Image Modal -->
    <div id="image-modal" class="modal-overlay hidden">
      <div class="relative max-w-4xl w-full mx-4">
        <button id="close-image-modal" class="absolute -top-10 right-0 text-white text-2xl">&times;</button>
        <img id="image-modal-img" src="" class="w-full rounded-2xl shadow-2xl" style="max-height:85vh;object-fit:contain;">
      </div>
    </div>
  `;

  // Re-bind all events after DOM recreation
  bindEvents();
}

function bindEvents() {
  // Navbar login button
  document.getElementById('nav-login-btn')?.addEventListener('click', () => {
    state.showLoginModal = true;
    state.loginMode = 'login';
    state.loginStep = 'email';
    state.loginEmail = '';
    state.loginPassword = '';
    state.loginConfirmPassword = '';
    state.loginCode = '';
    state.loginCountdown = 0;

    render();
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    auth.logout();
    state.user = null;
    state.results = [];
    render();
  });

  // Login modal - close
  document.getElementById('close-login-modal')?.addEventListener('click', () => {
    state.showLoginModal = false;
    render();
  });

  // Exhausted modal - close
  document.getElementById('close-exhausted-modal')?.addEventListener('click', () => {
    state.showExhaustedModal = false;
    render();
  });

  // Exhausted modal - click outside to close
  document.getElementById('exhausted-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('exhausted-modal')) {
      state.showExhaustedModal = false;
      render();
    }
  });

  // Login modal - tab switching
  document.getElementById('login-tab-btn')?.addEventListener('click', () => {
    state.loginMode = 'login';
    state.loginStep = 'email';
    state.loginPassword = '';
    state.loginConfirmPassword = '';
    state.loginCode = '';
    state.loginCountdown = 0;
    render();
  });
  document.getElementById('register-tab-btn')?.addEventListener('click', async () => {
    state.loginMode = 'register';
    state.loginStep = 'email';
    state.loginPassword = '';
    state.loginConfirmPassword = '';
    state.loginCode = '';
    state.loginCountdown = 0;
    // Load verification setting
    try {
      const setting = await api.getVerificationSetting();
      state.verificationEnabled = setting.enabled;
    } catch { state.verificationEnabled = true; }
    render();
  });

  // Login modal - submit
  document.getElementById('login-submit-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email-input')?.value?.trim() || '';
    const password = document.getElementById('login-password-input')?.value || '';
    if (!email || !email.includes('@')) { alert('请输入有效的邮箱地址'); return; }
    if (!password) { alert('请输入密码'); return; }

    state.loginEmail = email;
    const btn = document.getElementById('login-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '登录中...'; }

    try {
      const data = await api.login(email, password);
      auth.setSession(data.token, data.user);
      state.user = data.user;
      state.showLoginModal = false;
      state.loginEmail = '';
      state.loginPassword = '';
      render();
    } catch (err) {
      alert(err.message);
      if (btn) { btn.disabled = false; btn.textContent = '登录'; }
    }
  });

  // Register modal - send code (step 1)
  document.getElementById('register-send-code-btn')?.addEventListener('click', async () => {
    const emailInput = document.getElementById('login-email-input');
    const email = emailInput?.value?.trim() || '';
    if (!email || !email.includes('@')) { alert('请输入有效的邮箱地址'); return; }

    state.loginEmail = email;
    const btn = document.getElementById('register-send-code-btn');
    if (btn) { btn.disabled = true; btn.textContent = '发送中...'; }

    try {
      await api.sendCode(email);
      state.loginStep = 'code';
      state.loginCountdown = 60;
      startCountdown();
      render();
    } catch (err) {
      alert(err.message);
      if (btn) { btn.disabled = false; btn.textContent = '发送验证码'; }
    }
  });

  // Register modal - back to email step
  document.getElementById('register-back-btn')?.addEventListener('click', () => {
    state.loginStep = 'email';
    state.loginCode = '';
    state.loginCountdown = 0;
    render();
  });

  // Register modal - resend code
  document.getElementById('register-resend-btn')?.addEventListener('click', async () => {
    if (state.loginCountdown > 0) return;
    try {
      await api.sendCode(state.loginEmail);
      state.loginCountdown = 60;
      startCountdown();
      render();
    } catch (err) {
      alert(err.message);
    }
  });

  // Register modal - submit (with code + password)
  document.getElementById('register-submit-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email-input')?.value?.trim() || state.loginEmail;
    const code = state.verificationEnabled ? (document.getElementById('login-code-input')?.value?.trim() || '') : '';
    const password = document.getElementById('login-password-input')?.value || '';
    const confirm = document.getElementById('login-confirm-password-input')?.value || '';
    if (!email || !email.includes('@')) { alert('请输入有效的邮箱地址'); return; }
    if (state.verificationEnabled && !code) { alert('请输入验证码'); return; }
    if (!password || password.length < 6) { alert('密码至少6位'); return; }
    if (password !== confirm) { alert('两次密码不一致'); return; }

    state.loginEmail = email;
    const btn = document.getElementById('register-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '注册中...'; }

    try {
      const data = await api.register(email, code, password);
      auth.setSession(data.token, data.user);
      state.user = data.user;
      state.showLoginModal = false;
      state.loginMode = 'login';
      state.loginStep = 'email';
      state.loginEmail = '';
      state.loginPassword = '';
      state.loginConfirmPassword = '';
      state.loginCode = '';
      render();
    } catch (err) {
      alert(err.message);
      if (btn) { btn.disabled = false; btn.textContent = '注册'; }
    }
  });

  // Login modal - enter key support
  document.getElementById('login-email-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (state.loginMode === 'register' && state.loginStep === 'email' && state.verificationEnabled) {
        document.getElementById('register-send-code-btn')?.click();
      } else if (state.loginMode === 'register') {
        document.getElementById('register-submit-btn')?.click();
      } else {
        document.getElementById('login-submit-btn')?.click();
      }
    }
  });
  document.getElementById('login-password-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (state.loginMode === 'register') {
        document.getElementById('register-submit-btn')?.click();
      } else {
        document.getElementById('login-submit-btn')?.click();
      }
    }
  });
  document.getElementById('login-confirm-password-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('register-submit-btn')?.click();
  });
  document.getElementById('login-code-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('register-submit-btn')?.click();
  });

  // Announcement — only dismiss per session, no persistence
  document.getElementById('dismiss-announcement')?.addEventListener('click', () => {
    state.announcementDismissed = true;
    render();
  });

  // Ratio buttons
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.aspectRatio = btn.dataset.ratio;
      render();
    });
  });

  // Model select
  document.getElementById('model-select')?.addEventListener('change', (e) => { state.model = e.target.value; });

  // Quality select
  document.getElementById('quality-select')?.addEventListener('change', (e) => { state.quality = e.target.value; });

  // Advanced toggle
  document.getElementById('toggle-advanced')?.addEventListener('click', () => {
    state.showAdvanced = !state.showAdvanced;
    render();
  });

  // File upload
  document.getElementById('upload-area')?.addEventListener('click', () => {
    if (!auth.isLoggedIn()) {
      state.showLoginModal = true;
      state.loginMode = 'login';
      state.loginStep = 'email';
      state.loginEmail = '';
      state.loginPassword = '';
      state.loginCode = '';
      state.loginCountdown = 0;
  
      render();
      return;
    }
    document.getElementById('ref-upload')?.click();
  });
  document.getElementById('ref-upload')?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    for (const file of files) {
      try {
        const data = await api.upload(file);
        state.referenceUrls.push(data.url);
      } catch (err) {
        alert('图片上传失败: ' + err.message);
      }
    }
    render();
  });

  // Remove reference images
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-ref-btn');
    if (btn) {
      state.referenceUrls.splice(parseInt(btn.dataset.removeRef), 1);
      render();
    }
  });

  // Generate button
  document.getElementById('generate-btn')?.addEventListener('click', () => {
    if (!auth.isLoggedIn()) {
      state.showLoginModal = true;
      state.loginMode = 'login';
      state.loginStep = 'email';
      state.loginEmail = '';
      state.loginPassword = '';
      state.loginCode = '';
      state.loginCountdown = 0;
  
      render();
      return;
    }
    if (auth.getUser() && auth.getUser().remaining <= 0) {
      state.showExhaustedModal = true;
      render();
      return;
    }
    doGenerate();
  });

  // Read back values from inputs
  document.getElementById('prompt-input')?.addEventListener('input', (e) => { state.prompt = e.target.value; });
  document.getElementById('negative-prompt-input')?.addEventListener('input', (e) => { state.negativePrompt = e.target.value; });

  // Image preview click (delegated, uses data attribute instead of inline onclick)
  document.addEventListener('click', (e) => {
    const img = e.target.closest('.image-preview');
    if (img && img.dataset.imageUrl) {
      window._openImageModal(img.dataset.imageUrl);
    }
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

function startCountdown() {
  const timer = setInterval(() => {
    state.loginCountdown--;
    if (state.loginCountdown <= 0) {
      clearInterval(timer);
    }
    const btn = document.getElementById('register-resend-btn');
    if (btn) {
      if (state.loginCountdown <= 0) {
        btn.textContent = '重新发送验证码';
        btn.className = 'text-sm text-purple-600 hover:text-purple-700';
        btn.disabled = false;
      } else {
        btn.textContent = `重新发送 (${state.loginCountdown}s)`;
        btn.className = 'text-sm text-purple-600 hover:text-purple-700 opacity-50 cursor-not-allowed';
        btn.disabled = true;
      }
    }
  }, 1000);
}

async function doGenerate() {
  if (state.generating) return;

  const promptInput = document.getElementById('prompt-input');
  const negativeInput = document.getElementById('negative-prompt-input');
  if (promptInput) state.prompt = promptInput.value;
  if (negativeInput) state.negativePrompt = negativeInput.value;

  if (!state.prompt.trim()) {
    alert('请输入画面描述');
    return;
  }

  state.generating = true;
  state.results = [];
  render();

  try {
    const result = await api.generate({
      model: state.model,
      prompt: state.prompt,
      negativePrompt: state.negativePrompt,
      aspectRatio: state.aspectRatio,
      quality: state.quality,
      referenceUrls: state.referenceUrls,
    });

    if (result.images && result.images.length > 0) {
      state.results = result.images;
    } else if (result.taskId) {
      state.results = [];
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await api.getResult(result.taskId);
        if (poll && poll.status === 'succeeded' && poll.results) {
          state.results = poll.results.map(r => r.url);
          break;
        }
        if (poll && poll.status === 'failed') {
          alert('生成失败: ' + (poll.failure_reason || poll.error || '未知错误'));
          break;
        }
      }
    }

    const user = await auth.refreshUser();
    if (user) state.user = user;
  } catch (err) {
    if (err.message && err.message.includes('次数已用完')) {
      state.showExhaustedModal = true;
      render();
    } else {
      alert(err.message);
    }
  } finally {
    state.generating = false;
    render();
  }
}

async function checkAnnouncement() {
  try {
    const data = await api.getActiveAnnouncement();
    if (data && data.id) {
      // Always show banner and force popup on every page load
      state.announcement = data;
      state.announcementDismissed = false;
    } else {
      state.announcement = null;
      state.announcementDismissed = true;
    }
  } catch {}
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function linkify(text) {
  if (!text) return '';
  const urlRe = /(https?:\/\/[^\s<]+)/g;
  return text.replace(urlRe, '<a href="$1" target="_blank" rel="noopener" class="text-purple-600 underline hover:text-purple-800">$1</a>');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window._openImageModal = function(url) {
  const modal = document.getElementById('image-modal');
  const img = document.getElementById('image-modal-img');
  if (modal && img) {
    img.src = url;
    modal.classList.remove('hidden');
  }
};
