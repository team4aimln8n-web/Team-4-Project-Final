/****************************************************
 * SIMPLE CLIENT-SIDE CACHE (ZERO COST)
 ****************************************************/

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// In-memory cache (fastest)
const memoryCache = {};

// localStorage fallback (persists across reloads)
const storageCache = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota errors
    }
  },
  remove(key) {
    localStorage.removeItem(key);
  }
};


async function fetchWithCache(url, options = {}) {
  const cacheKey = `cache_${url}`;
  const now = Date.now();

  // 1️⃣ Check memory cache
  if (memoryCache[cacheKey]) {
    const { data, timestamp } = memoryCache[cacheKey];
    if (now - timestamp < CACHE_DURATION) {
      console.log('⚡ Memory cache hit:', url);
      return data;
    }
  }

  // 2️⃣ Check localStorage cache
  const stored = storageCache.get(cacheKey);
  if (stored && now - stored.timestamp < CACHE_DURATION) {
    console.log('📦 Storage cache hit:', url);
    memoryCache[cacheKey] = stored; // hydrate memory
    return stored.data;
  }

  // 3️⃣ Cache MISS → fetch from network
  console.log('🌐 Fetching from network:', url);

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  const record = { data, timestamp: now };

  // Save to both caches
  memoryCache[cacheKey] = record;
  storageCache.set(cacheKey, record);

  return data;
}


/****************************************************
 * GLOBAL ERROR ABSTRACTION
 * - Devs get details (console)
 * - Users get friendly messages
 ****************************************************/

function translateErrorForUser(error, context) {

    // Definitely offline
    if (!navigator.onLine) {
        return "You appear to be offline. Please check your internet connection.";
    }

    // Fetch failed while online (ambiguous case)
    if (error instanceof TypeError) {
        return "Unable to connect at the moment. Please check your connection or try again shortly.";
    }

    // HTTP errors with response (optional future-proofing)
    if (error.message && error.message.includes('HTTP')) {
        return "Our servers are temporarily unavailable. Please try again shortly.";
    }

    // Fallback
    return "Something went wrong. Please try again.";
}




// ==============================================
// SUPABASE INITIALIZATION
// ==============================================
const SUPABASE_URL = 'https://nfzpywnjqwwmwoincvem.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5menB5d25qcXd3bXdvaW5jdmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDg3MjMsImV4cCI6MjA4MDQyNDcyM30.aKErDJpSz9oJhbEp9W5JigJPfkBi9Gy5rcU_t6LzHc0';

let supabaseClient = null;
let supabaseInitialized = false;

// Initialize Supabase with promise to track when it's ready
const initSupabase = async () => {
    if (typeof supabase !== 'undefined') {
        const { createClient } = supabase;
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Wait for initial session to be established
        await supabaseClient.auth.getSession();
        supabaseInitialized = true;
        
        console.log('✅ Supabase initialized successfully');
        return supabaseClient;
    } else {
        console.warn('⚠️ Supabase library not loaded');
        return null;
    }
};

// ==============================================
// API CONFIGURATION
// ==============================================
const API_ENDPOINTS = {
    // Customer Endpoints
   
    GET_PRODUCTS: 'https://team4n8n.app.n8n.cloud/webhook/get-products',                                
    GET_PRODUCT_DETAILS: 'https://team4n8n.app.n8n.cloud/webhook/get-product',                          
    ADD_TO_CART: 'https://team4n8n.app.n8n.cloud/webhook/add-to-cart',                                  
    VIEW_CART: 'https://team4n8n.app.n8n.cloud/webhook/view-cart',                                      
    UPDATE_CART_ITEM: 'https://team4n8n.app.n8n.cloud/webhook/update-cart-item',                        
    REMOVE_FROM_CART: 'https://team4n8n.app.n8n.cloud/webhook/update-cart-item',                        
    PLACE_ORDER: 'https://team4n8n.app.n8n.cloud/webhook/place-order-cod',                              
    GET_USER_ORDERS: 'https://team4n8n.app.n8n.cloud/webhook/get-user-orders',                          
    GET_ORDER_DETAILS: 'https://team4n8n.app.n8n.cloud/webhook/get-order-details',                      
    
    // Admin Endpoints
    ADMIN_ADD_PRODUCT: 'https://team4n8n.app.n8n.cloud/webhook/admin-add-product-and-image',           
    ADMIN_UPLOAD_IMAGES: 'https://team4n8n.app.n8n.cloud/webhook/admin-add-product-and-image',          
    ADMIN_GET_ALL_ORDERS: 'https://team4n8n.app.n8n.cloud/webhook/admin-get-all-orders',                
    ADMIN_UPDATE_ORDER_STATUS: 'https://team4n8n.app.n8n.cloud/webhook/admin-update-order-status'       
};

// ==============================================
// ADMIN CONFIGURATION
// ==============================================

// 🔐 ADMIN EMAILS - Add your admin email(s) here
const ADMIN_EMAILS = [
    'team4.aiml.prj@gmail.com',           // Replace with your actual admin email
];

// Check if current user is admin
async function isAdmin() {
    const user = await getCurrentUser();
    if (!user) return false;
    
    const isAdminUser = ADMIN_EMAILS.includes(user.email.toLowerCase());
    console.log('🔍 Admin check:', user.email, '→', isAdminUser ? '✅ IS ADMIN' : '❌ NOT ADMIN');
    return isAdminUser;
}

// Protect admin pages - redirect if not admin
async function protectAdminPage() {
    console.log('🔒 Checking admin access...');
    
    // First check if user is logged in
    const user = await getCurrentUser();
    if (!user) {
        alert('⚠️ Please login to access admin pages');
        window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
        return false;
    }
    
    // Then check if user is admin
    const admin = await isAdmin();
    if (!admin) {
        alert('🚫 Access Denied: Admin privileges required');
        window.location.href = 'index.html';
        return false;
    }
    
    console.log('✅ Admin access granted');
    return true;
}

// ==============================================
// AUTHENTICATION FUNCTIONS
// ==============================================

// Wait for Supabase to be ready
async function waitForSupabase() {
    if (supabaseInitialized) return supabaseClient;
    
    // Wait up to 3 seconds for Supabase to initialize
    for (let i = 0; i < 30; i++) {
        if (supabaseInitialized) return supabaseClient;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.warn('⚠️ Supabase initialization timeout');
    return supabaseClient;
}

// Get current user ID
async function getCurrentUserId() {
    await waitForSupabase();
    
    if (supabaseClient) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const userId = session?.user?.id || null;
            console.log('getCurrentUserId() returning:', userId);
            return userId;
        } catch (error) {
            console.error('Error getting user ID:', error);
            return null;
        }
    }
    // Fallback to localStorage if Supabase not initialized
    const fallbackId = localStorage.getItem('user_id');
    console.log('getCurrentUserId() fallback from localStorage:', fallbackId);
    return fallbackId;
}

// Get current user session
async function getCurrentSession() {
    await waitForSupabase();
    
    if (supabaseClient) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            return session;
        } catch (error) {
            console.error('Error getting session:', error);
            return null;
        }
    }
    return null;
}

// Get current user data
async function getCurrentUser() {
    await waitForSupabase();
    
    if (supabaseClient) {
        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            return user;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }
    return null;
}

// Save user ID (for backward compatibility)
function saveUserId(userId) {
    localStorage.setItem('user_id', userId);
}

// Logout user
async function logoutUser() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    localStorage.clear();
    window.location.href = 'login.html';
}

// ==============================================
// AUTHENTICATION PROTECTION
// ==============================================

// List of pages that require authentication
const PROTECTED_PAGES = [
    'cart.html',
    'checkout.html',
    'orders.html',
    'order-details.html',
    'order-confirmation.html'
];

// Check if current page requires authentication
function isProtectedPage() {
    const currentPage = window.location.pathname.split('/').pop();
    return PROTECTED_PAGES.includes(currentPage);
}

// Check if current page is an admin page
function isAdminPage() {
    const currentPage = window.location.pathname.split('/').pop();
    return currentPage.startsWith('admin-');
}

// Check authentication and redirect if needed
async function checkAuth(showAlertMessage = true) {
    await waitForSupabase();
    
    const session = await getCurrentSession();
    
    if (!session) {
        if (showAlertMessage) {
            alert('Please login to access this page');
        }
        // Redirect to login with return URL
        const currentUrl = window.location.href;
        window.location.href = `login.html?redirect=${encodeURIComponent(currentUrl)}`;
        return false;
    }
    return true;
}

// Protect page on load (call this in protected pages)
async function protectPage() {
    if (isProtectedPage()) {
        const isAuthenticated = await checkAuth(true);
        if (!isAuthenticated) {
            // Page will redirect, stop execution
            return false;
        }
    }
    return true;
}

// ==============================================
// NAVIGATION - SHOW/HIDE ADMIN LINKS
// ==============================================

// Update navigation to show admin links only for admins
async function updateNavigation() {
    const user = await getCurrentUser();
    const admin = await isAdmin();
    
    // Get or create admin menu container
    let adminNav = document.querySelector('.admin-nav-links');
    
    if (!adminNav && admin) {
        // Create admin section in navigation
        const navMenu = document.querySelector('.nav-menu');
        if (navMenu) {
            // Add separator
            const separator = document.createElement('li');
            separator.innerHTML = '<span style="color: #666; margin: 0 10px;">|</span>';
            navMenu.appendChild(separator);
            
            // Add admin links
            const adminLinks = [
                { href: 'admin-add-product.html', text: '➕ Add Product' },
                { href: 'admin-orders.html', text: '📦 Orders' }
            ];
            
            adminLinks.forEach(link => {
                const li = document.createElement('li');
                li.className = 'admin-nav-links';
                li.innerHTML = `<a href="${link.href}" style="color: #ffc107; font-weight: 600;">${link.text}</a>`;
                navMenu.appendChild(li);
            });
            
            console.log('✅ Admin navigation added');
        }
    }
    
    // Update user display
    const loginLink = document.getElementById('login-link');
    const userLink = document.getElementById('user-link');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (user) {
        if (loginLink) loginLink.style.display = 'none';
        if (userLink) {
            userLink.style.display = 'block';
            userLink.title = admin ? `👑 Admin: ${user.email}` : user.email;
            // Add crown emoji for admins
            if (admin) {
                userLink.textContent = '👑';
            }
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'block';
            logoutBtn.onclick = logoutUser;
        }
    } else {
        if (loginLink) loginLink.style.display = 'block';
        if (userLink) userLink.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}

// ==============================================
// ADMIN DASHBOARD ACCESS
// ==============================================

// Create a simple admin dashboard button on home page
async function addAdminDashboardButton() {
    const admin = await isAdmin();
    if (!admin) return;
    
    // Check if we're on index.html
    if (!window.location.pathname.includes('index.html') && 
        window.location.pathname !== '/') return;
    
    // Find container (hero section or main container)
    const hero = document.querySelector('.hero');
    if (!hero) return;
    
    // Check if button already exists
    if (document.getElementById('admin-dashboard-btn')) return;
    
    // Create admin dashboard button
    const dashboardBtn = document.createElement('a');
    dashboardBtn.id = 'admin-dashboard-btn';
    dashboardBtn.href = 'admin-orders.html';
    dashboardBtn.className = 'hero-btn';
    dashboardBtn.style.cssText = `
        background: linear-gradient(135deg, #ffc107, #ff9800);
        color: #000;
        margin-left: 15px;
        display: inline-block;
    `;
    dashboardBtn.innerHTML = '👑 Admin Dashboard';
    
    // Add after the main hero button
    const mainBtn = hero.querySelector('.hero-btn');
    if (mainBtn) {
        mainBtn.insertAdjacentElement('afterend', dashboardBtn);
        console.log('✅ Admin dashboard button added');
    }
}

// ==============================================
// ADMIN-SPECIFIC FUNCTIONS
// ==============================================

// Get admin token from localStorage (for n8n requests)
function getStoredAdminToken() {
    return localStorage.getItem('admin_token') || '';
}

// Save admin token to localStorage
function saveAdminToken(token) {
    localStorage.setItem('admin_token', token);
    console.log('✅ Admin token saved');
}

// Pre-fill admin token in forms if available
function prefillAdminToken() {
    const tokenInput = document.getElementById('admin-token');
    if (tokenInput) {
        const savedToken = getStoredAdminToken();
        if (savedToken) {
            tokenInput.value = savedToken;
            console.log('✅ Admin token pre-filled');
        }
    }
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

// Show loading spinner
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    }
}

// Hide loading spinner
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '';
    }
}

// Format price
function formatPrice(price) {
    return `$${parseFloat(price).toFixed(2)}`;
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Update cart badge
async function updateCartBadge() {
    const userId = await getCurrentUserId();
    if (!userId) {
        const badge = document.getElementById('cart-badge');
        if (badge) {
            badge.style.display = 'none';
        }
        return;
    }

    try {
        const response = await fetch(`${API_ENDPOINTS.VIEW_CART}?user_id=${userId}`);
        const cart = await response.json();
        
        const badge = document.getElementById('cart-badge');
        if (badge) {
            const itemCount = cart.items?.length || 0;
            badge.textContent = itemCount;
            badge.style.display = itemCount > 0 ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Error updating cart badge:', error);
    }
}

// Show alert message
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '90px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    alertDiv.style.animation = 'slideIn 0.3s ease';
    alertDiv.textContent = message;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            alertDiv.remove();
        }, 300);
    }, 4000);
}

// Add to cart function
async function addToCart(productId, quantity = 1) {
    console.log('🛒 addToCart called with productId:', productId, 'quantity:', quantity);
    
    // Get userId and WAIT for it
    const userId = await getCurrentUserId();
    console.log('🛒 Got userId:', userId, 'type:', typeof userId);
    
    if (!userId) {
        console.log('❌ No userId - redirecting to login');
        showAlert('Please login to add items to cart', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }

    console.log('✅ User authenticated, preparing request...');
    
    const requestBody = {
        user_id: userId,
        product_id: productId,
        quantity: quantity
    };
    
    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    try {
        const response = await fetch(API_ENDPOINTS.ADD_TO_CART, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('📥 Response status:', response.status);
        const result = await response.json();
        console.log('📥 Response data:', result);

        if (result.success) {
            showAlert('Product added to cart!', 'success');
            updateCartBadge();
        } else {
            showAlert('Failed to add to cart: ' + (result.message || 'Unknown error'), 'error');
        }

    } catch (error) {
        console.error('❌ Error adding to cart:', error);
        showAlert('Failed to add to cart. Please try again.', 'error');
    }
}

// Initialize page
async function initializePage() {
    await waitForSupabase();
    await updateCartBadge();
    
    // Update navigation with admin links
    await updateNavigation();
    
    // Add admin dashboard button if on home page
    await addAdminDashboardButton();
    
    console.log('✅ Page initialized');
}

// Get URL parameter
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Truncate text
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Validate email
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate phone number
function validatePhone(phone) {
    const re = /^[\d\s\-\+\(\)]+$/;
    return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ==============================================
// INITIALIZATION ON PAGE LOAD
// ==============================================

// Initialize Supabase first, then run page initialization
(async function() {
    console.log('🚀 Initializing application...');
    
    // Initialize Supabase first
    await initSupabase();
    
    // Check if current page is an admin page
    if (isAdminPage()) {
        console.log('🔒 Admin page detected, checking access...');
        await protectAdminPage();
    }
    
    // Check if page needs regular protection
    if (isProtectedPage() && !isAdminPage()) {
        console.log('🔒 Protected page detected, checking authentication...');
        await protectPage();
    }
    
    // Initialize page UI
    await initializePage();
    
    // Pre-fill admin token if on admin page
    if (isAdminPage()) {
        prefillAdminToken();
    }
    
    console.log('✅ Application initialized');
})();

// Also initialize when DOM is fully loaded (backup)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await waitForSupabase();
        await initializePage();
    });
}

function showError(container, error, context) {
    const userMessage = translateErrorForUser(error, context);

    container.innerHTML = `
        <div class="alert alert-error" style="grid-column: 1 / -1;">
            <span>⚠️</span>
            <span>${userMessage}</span>
        </div>
    `;
}


// ==============================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// ==============================================
window.API_ENDPOINTS = API_ENDPOINTS;
window.getCurrentUserId = getCurrentUserId;
window.getCurrentSession = getCurrentSession;
window.getCurrentUser = getCurrentUser;
window.saveUserId = saveUserId;
window.logoutUser = logoutUser;
window.checkAuth = checkAuth;
window.protectPage = protectPage;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.formatPrice = formatPrice;
window.formatDate = formatDate;
window.updateCartBadge = updateCartBadge;
window.showAlert = showAlert;
window.addToCart = addToCart;
window.getUrlParameter = getUrlParameter;
window.truncateText = truncateText;
window.validateEmail = validateEmail;
window.validatePhone = validatePhone;
window.supabaseClient = supabaseClient;
window.waitForSupabase = waitForSupabase;
window.isAdmin = isAdmin;
window.protectAdminPage = protectAdminPage;
window.updateNavigation = updateNavigation;
window.getStoredAdminToken = getStoredAdminToken;
window.saveAdminToken = saveAdminToken;

window.prefillAdminToken = prefillAdminToken;


