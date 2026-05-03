import { api } from '../api.js';
import { auth } from '../auth.js';

export function renderLoginPage(container) {
  let step = 'email'; // 'email' | 'code'
  let email = '';
  let countdown = 0;

  function render() {
    container.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 p-4">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 animate-fade-in">
          <div class="text-center mb-8">
            <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900">AI 画图站</h1>
            <p class="text-gray-500 mt-2">AI驱动的在线图片生成平台</p>
          </div>

          <div id="login-form">
            ${step === 'email' ? renderEmailStep() : renderCodeStep()}
          </div>
        </div>
      </div>
    `;

    bindEvents();
  }

  function renderEmailStep() {
    return `
      <div class="animate-fade-in">
        <label class="block text-sm font-medium text-gray-700 mb-2">邮箱地址</label>
        <input id="email-input" type="email" value="${email}" placeholder="请输入您的邮箱"
          class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
        <button id="send-code-btn" class="gradient-btn w-full py-3 mt-4 text-white font-medium rounded-xl">
          发送验证码
        </button>
        <p class="text-xs text-gray-400 text-center mt-4">首次登录将自动注册账号</p>
        <a href="#home" class="block text-center text-sm text-gray-400 hover:text-gray-600 mt-4">← 返回首页</a>
      </div>
    `;
  }

  function renderCodeStep() {
    return `
      <div class="animate-fade-in">
        <p class="text-sm text-gray-600 mb-4">验证码已发送至 <strong>${email}</strong></p>
        <label class="block text-sm font-medium text-gray-700 mb-2">验证码</label>
        <input id="code-input" type="text" maxlength="6" placeholder="请输入6位验证码"
          class="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-2xl tracking-widest focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all">
        <button id="verify-btn" class="gradient-btn w-full py-3 mt-4 text-white font-medium rounded-xl">
          验证并登录
        </button>
        <div class="flex justify-between items-center mt-4">
          <button id="back-btn" class="text-sm text-gray-500 hover:text-gray-700">更换邮箱</button>
          <button id="resend-btn" class="text-sm text-purple-600 hover:text-purple-700 ${countdown > 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${countdown > 0 ? 'disabled' : ''}>
            ${countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送验证码'}
          </button>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    if (step === 'email') {
      const sendBtn = document.getElementById('send-code-btn');
      const emailInput = document.getElementById('email-input');

      sendBtn?.addEventListener('click', async () => {
        email = emailInput.value.trim();
        if (!email || !email.includes('@')) {
          alert('请输入有效的邮箱地址');
          return;
        }

        sendBtn.disabled = true;
        sendBtn.textContent = '发送中...';

        try {
          await api.sendCode(email);
          step = 'code';
          countdown = 60;
          startCountdown();
          render();
        } catch (err) {
          alert(err.message);
          sendBtn.disabled = false;
          sendBtn.textContent = '发送验证码';
        }
      });

      emailInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendBtn?.click();
      });
    }

    if (step === 'code') {
      const verifyBtn = document.getElementById('verify-btn');
      const codeInput = document.getElementById('code-input');
      const backBtn = document.getElementById('back-btn');
      const resendBtn = document.getElementById('resend-btn');

      codeInput?.focus();

      verifyBtn?.addEventListener('click', async () => {
        const code = codeInput.value.trim();
        if (code.length !== 6) {
          alert('请输入6位验证码');
          return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = '验证中...';

        try {
          const data = await api.verifyCode(email, code);
          auth.setSession(data.token, data.user);
          window.location.hash = '#home';
        } catch (err) {
          alert(err.message);
          verifyBtn.disabled = false;
          verifyBtn.textContent = '验证并登录';
        }
      });

      codeInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') verifyBtn?.click();
      });

      backBtn?.addEventListener('click', () => {
        step = 'email';
        render();
      });

      resendBtn?.addEventListener('click', async () => {
        if (countdown > 0) return;
        try {
          await api.sendCode(email);
          countdown = 60;
          startCountdown();
          render();
        } catch (err) {
          alert(err.message);
        }
      });
    }
  }

  function startCountdown() {
    const timer = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(timer);
      }
      // Update resend button
      const resendBtn = document.getElementById('resend-btn');
      if (resendBtn) {
        if (countdown <= 0) {
          resendBtn.textContent = '重新发送验证码';
          resendBtn.className = 'text-sm text-purple-600 hover:text-purple-700';
          resendBtn.disabled = false;
        } else {
          resendBtn.textContent = `重新发送 (${countdown}s)`;
          resendBtn.className = 'text-sm text-purple-600 hover:text-purple-700 opacity-50 cursor-not-allowed';
          resendBtn.disabled = true;
        }
      }
    }, 1000);
  }

  render();
}
