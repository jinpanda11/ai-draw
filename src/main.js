import { register, initRouter } from './router.js';
import { renderLoginPage } from './pages/login.js';
import { renderHomePage } from './pages/home.js';
import { renderHistoryPage } from './pages/history.js';
import { renderAdminPage } from './pages/admin.js';

// Register pages
register('login', (container) => renderLoginPage(container));
register('home', (container) => renderHomePage(container));
register('history', (container) => renderHistoryPage(container));
register('admin', (container) => renderAdminPage(container));

// Start
initRouter();
