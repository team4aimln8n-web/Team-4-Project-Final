// ==============================================
// CHATBOT CONFIGURATION
// ==============================================

const CHATBOT_CONFIG = {
    // 🔗 N8N WEBHOOK URL - PASTE YOUR WEBHOOK URL HERE
    webhookUrl: 'https://team4n8n.app.n8n.cloud/webhook/chatbot',
    
    // Chatbot UI Settings
    botName: 'ShopHub Assistant',
    welcomeMessage: 'Hello! How may I assist you today? 😊',
    placeholderText: 'Type your message here...',
    
    // Feature flags
    enableOrderLookup: true,
    enableCartActions: true,
    enableProductSearch: true
};

// ==============================================
// CHATBOT STATE
// ==============================================

let chatHistory = [];
let isOpen = false;
let isLoading = false;
let currentUserId = null;

// NEW — SESSION ID (persists until page refresh)
let sessionId = crypto.randomUUID();

// NEW — Track if checkout CTA is currently displayed
let checkoutCtaDisplayed = false;

// ==============================================
// WAIT FOR API.JS TO BE READY
// ==============================================

async function waitForAPI() {
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
        if (typeof window.getCurrentUserId === 'function' && 
            typeof window.API_ENDPOINTS === 'object') {
            console.log('✅ API.js is ready, initializing chatbot...');
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    console.warn('⚠️ API.js took too long to initialize');
    return false;
}

// ==============================================
// INITIALIZE CHATBOT
// ==============================================

async function initChatbot() {
    console.log('🤖 Waiting for API.js...');
    
    const apiReady = await waitForAPI();
    if (!apiReady) {
        console.error('❌ Failed to initialize chatbot: API not ready');
        return;
    }

    console.log('🤖 Initializing ShopHub Chatbot...');

    createChatbotUI();
    setupEventListeners();

    try {
        currentUserId = await getCurrentUserId();
        console.log('👤 Current user ID:', currentUserId || 'Not logged in');
    } catch (error) {
        console.error('Error getting user ID:', error);
    }

    console.log('🆔 Chat session ID:', sessionId);
    console.log('✅ Chatbot initialized successfully');
}

// ==============================================
// CREATE CHATBOT UI
// ==============================================

function createChatbotUI() {
    const chatbotHTML = `
        <!-- Chatbot Toggle Button -->
        <div id="chatbot-toggle" class="chatbot-toggle" title="Chat with us">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span class="chatbot-badge" id="chatbot-badge" style="display: none;">1</span>
        </div>

        <!-- Chatbot Window -->
        <div id="chatbot-window" class="chatbot-window" style="display: none;">
            <!-- Header -->
            <div class="chatbot-header">
                <div class="chatbot-header-info">
                    <div class="chatbot-avatar">🤖</div>
                    <div>
                        <div class="chatbot-title">${CHATBOT_CONFIG.botName}</div>
                        <div class="chatbot-status">
                            <span class="status-dot"></span>
                            Online
                        </div>
                    </div>
                </div>
                <button id="chatbot-close" class="chatbot-close" title="Close chat">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <!-- Messages Container -->
            <div id="chatbot-messages" class="chatbot-messages">
            </div>

            <!-- NEW: Checkout CTA Container (appears when checkout is suggested) -->
            <div id="chatbot-checkout-cta" class="chatbot-checkout-cta" style="display: none;">
                <button id="chatbot-checkout-btn" class="chatbot-checkout-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    Proceed to Checkout
                </button>
            </div>

            <!-- Quick Actions -->
            <div id="chatbot-quick-actions" class="chatbot-quick-actions">
                <div class="quick-action-title">Quick Actions:</div>
                <button class="quick-action-btn" onclick="chatbotSendQuickAction('View my orders')">📦 My Orders</button>
                <button class="quick-action-btn" onclick="chatbotSendQuickAction('Check my cart')">🛒 View Cart</button>
                <button class="quick-action-btn" onclick="chatbotSendQuickAction('Browse products')">🔍 Browse Products</button>
                <button class="quick-action-btn" onclick="chatbotSendQuickAction('Track my order')">🚚 Track Order</button>
            </div>

            <!-- Input Area -->
            <div class="chatbot-input-area">
                <textarea 
                    id="chatbot-input" 
                    class="chatbot-input" 
                    placeholder="${CHATBOT_CONFIG.placeholderText}"
                    rows="1"
                ></textarea>
                <button id="chatbot-send" class="chatbot-send-btn" title="Send message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    setTimeout(() => {
        addBotMessage(CHATBOT_CONFIG.welcomeMessage);
    }, 500);
}

// ==============================================
// EVENT LISTENERS
// ==============================================

function setupEventListeners() {
    document.getElementById('chatbot-toggle').addEventListener('click', toggleChat);
    document.getElementById('chatbot-close').addEventListener('click', toggleChat);
    document.getElementById('chatbot-send').addEventListener('click', handleSendMessage);
    
    // NEW: Checkout CTA button handler
    document.getElementById('chatbot-checkout-btn').addEventListener('click', handleCheckoutClick);
    
    document.getElementById('chatbot-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    document.getElementById('chatbot-input').addEventListener('input', autoResizeTextarea);
}

// ==============================================
// NEW: CHECKOUT CTA LOGIC
// ==============================================

/**
 * Detects if the bot message suggests proceeding to checkout
 * Uses safe string matching without modifying chatbot behavior
 */
function shouldShowCheckoutCta(botMessage) {
    const checkoutTriggers = [
        'complete checkout',
        'proceed to checkout',
        'place your order',
        'checkout here',
        'complete your order',
        'finalize your order',
        'checkout.html'
    ];
    
    const messageLower = botMessage.toLowerCase();
    return checkoutTriggers.some(trigger => messageLower.includes(trigger));
}

/**
 * Shows the checkout CTA button below the chat messages
 */
function showCheckoutCta() {
    if (checkoutCtaDisplayed) return; // Already shown
    
    const ctaContainer = document.getElementById('chatbot-checkout-cta');
    if (ctaContainer) {
        ctaContainer.style.display = 'block';
        checkoutCtaDisplayed = true;
        console.log('✅ Checkout CTA displayed');
    }
}

/**
 * Hides the checkout CTA button
 */
function hideCheckoutCta() {
    const ctaContainer = document.getElementById('chatbot-checkout-cta');
    if (ctaContainer) {
        ctaContainer.style.display = 'none';
        checkoutCtaDisplayed = false;
        console.log('ℹ️ Checkout CTA hidden');
    }
}

/**
 * Handles checkout button click
 * Opens checkout page in new tab
 */
function handleCheckoutClick() {
    const checkoutUrl = 'https://team4aimln8n-web.github.io/EcommerceSite/checkout.html';
    
    // Open in new tab
    window.open(checkoutUrl, '_blank');
    
    // Optionally hide the CTA after click
    hideCheckoutCta();
    
    // Add a confirmation message to chat
    addBotMessage('Opening checkout page in a new tab. Please complete your order there! 🛒');
    
    console.log('🛒 Checkout CTA clicked, opened:', checkoutUrl);
}

// ==============================================
// TOGGLE CHAT
// ==============================================

function toggleChat() {
    isOpen = !isOpen;
    const chatWindow = document.getElementById('chatbot-window');
    const toggleBtn = document.getElementById('chatbot-toggle');

    if (isOpen) {
        chatWindow.style.display = 'flex';
        toggleBtn.style.display = 'none';
        document.getElementById('chatbot-input').focus();

        const badge = document.getElementById('chatbot-badge');
        if (badge) badge.style.display = 'none';
    } else {
        chatWindow.style.display = 'none';
        toggleBtn.style.display = 'flex';
        
        // NEW: Hide checkout CTA when chat is closed
        hideCheckoutCta();
    }
}

// ==============================================
// MESSAGE HANDLING
// ==============================================

async function handleSendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();

    if (!message || isLoading) return;

    input.value = '';
    input.style.height = 'auto';

    const quickActions = document.getElementById('chatbot-quick-actions');
    if (quickActions) quickActions.style.display = 'none';

    addUserMessage(message);

    chatHistory.push({
        role: 'user',
        content: message
    });

    // NEW: Hide checkout CTA when user sends a new message
    hideCheckoutCta();

    showLoading();

    await getBotResponse(message);
}

function sendQuickAction(action) {
    const input = document.getElementById('chatbot-input');
    input.value = action;
    handleSendMessage();
}

// ==============================================
// GET BOT RESPONSE
// ==============================================

async function getBotResponse(userMessage) {
    try {
        const userContext = await getUserContext();

        const payload = {
            message: userMessage,
            session_id: sessionId,
            user_id: userContext.userId,
            user_email: userContext.userEmail,
            is_logged_in: userContext.isLoggedIn,
            cart_item_count: userContext.cartItemCount,
            current_page: window.location.pathname.split('/').pop() || 'index.html',
            timestamp: new Date().toISOString()
        };

        console.log('📤 Sending to n8n webhook:', payload);

        const response = await fetch(CHATBOT_CONFIG.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📥 Response from n8n:', data);

        let botMessage = '';
        if (data.message) botMessage = data.message;
        else if (data.response) botMessage = data.response;
        else if (data.text) botMessage = data.text;
        else if (typeof data === 'string') botMessage = data;
        else botMessage = 'I received your message! How else can I help you?';

        hideLoading();
        addBotMessage(botMessage);

        // NEW: Check if checkout CTA should be shown
        if (shouldShowCheckoutCta(botMessage)) {
            showCheckoutCta();
        }

        await executeActionsFromResponse(botMessage, data);

        chatHistory.push({
            role: 'assistant',
            content: botMessage
        });

    } catch (error) {
        console.error('❌ Error getting bot response:', error);
        hideLoading();

        if (error.message.includes('Failed to fetch')) {
            addBotMessage('⚠️ Unable to connect to the chatbot service. Please check your internet connection and try again.');
        } else if (CHATBOT_CONFIG.webhookUrl.includes('YOUR_N8N_INSTANCE')) {
            addBotMessage('⚠️ Chatbot webhook URL not configured.');
        } else {
            addBotMessage('Sorry, I encountered an error. Please try again.');
        }
    }
}

// ==============================================
// GET USER CONTEXT
// ==============================================

async function getUserContext() {
    let userId = null;
    let userEmail = null;
    let cartItemCount = 0;

    try {
        if (typeof getCurrentUserId === 'function') {
            userId = await getCurrentUserId();
        }
    } catch (error) {
        console.error('Error getting user ID:', error);
    }

    try {
        userEmail = localStorage.getItem('user_email');
    } catch (error) {
        console.error('Error getting email:', error);
    }

    if (userId && typeof window.API_ENDPOINTS !== 'undefined') {
        try {
            const response = await fetch(`${API_ENDPOINTS.VIEW_CART}?user_id=${userId}`);
            const cart = await response.json();
            cartItemCount = cart.items?.length || 0;
        } catch (error) {
            console.error('Error fetching cart:', error);
        }
    }

    return {
        userId,
        userEmail,
        isLoggedIn: !!userId,
        cartItemCount
    };
}

// ==============================================
// EXECUTE ACTIONS FROM RESPONSE
// ==============================================

async function executeActionsFromResponse(botMessage, responseData) {
    if (botMessage.includes('[ACTION:view_orders]')) {
        addActionButton('📦 View My Orders', () => {
            window.location.href = 'orders.html';
        });
    }

    if (botMessage.includes('[ACTION:view_cart]')) {
        addActionButton('🛒 View Cart', () => {
            window.location.href = 'cart.html';
        });
    }

    if (botMessage.includes('[ACTION:browse_products]')) {
        addActionButton('🔍 Browse Products', () => {
            window.location.href = 'products.html';
        });
    }

    if (botMessage.includes('[ACTION:login_required]')) {
        addActionButton('🔐 Login Now', () => {
            window.location.href = 'login.html';
        });
    }

    // REMOVED: [ACTION:checkout] handling - now handled by persistent CTA

    if (responseData && responseData.actions && Array.isArray(responseData.actions)) {
        responseData.actions.forEach(action => {
            if (action.type === 'button' && action.text && action.url) {
                addActionButton(action.text, () => {
                    window.location.href = action.url;
                });
            }
        });
    }
}

// ==============================================
// UI HELPER FUNCTIONS
// ==============================================

function addUserMessage(message) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chatbot-message user-message';
    messageDiv.innerHTML = `
        <div class="message-content">${escapeHtml(message)}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function addBotMessage(message) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chatbot-message bot-message';

    const cleanMessage = message.replace(/\[ACTION:[^\]]+\]/g, '').trim();

    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">${escapeHtml(cleanMessage)}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function addActionButton(text, onClick) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'chatbot-message bot-message';
    buttonDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <button class="chatbot-action-btn">${text}</button>
        </div>
    `;

    const button = buttonDiv.querySelector('.chatbot-action-btn');
    button.addEventListener('click', onClick);

    messagesContainer.appendChild(buttonDiv);
    scrollToBottom();
}

function showLoading() {
    isLoading = true;
    const messagesContainer = document.getElementById('chatbot-messages');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'chatbot-loading';
    loadingDiv.className = 'chatbot-message bot-message';
    loadingDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="chatbot-typing">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    messagesContainer.appendChild(loadingDiv);
    scrollToBottom();
}

function hideLoading() {
    isLoading = false;
    const loadingDiv = document.getElementById('chatbot-loading');
    if (loadingDiv) loadingDiv.remove();
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatbot-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function autoResizeTextarea() {
    const textarea = document.getElementById('chatbot-input');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// ==============================================
// NOTIFICATION BADGE
// ==============================================

function showNotificationBadge() {
    const badge = document.getElementById('chatbot-badge');
    if (badge && !isOpen) {
        badge.style.display = 'flex';
    }
}

// ==============================================
// INITIALIZE ON PAGE LOAD
// ==============================================

setTimeout(() => {
    initChatbot().catch(err => {
        console.error('❌ Failed to initialize chatbot:', err);
    });
}, 2000);

window.chatbotToggle = toggleChat;
window.chatbotSendQuickAction = sendQuickAction;

window.chatbotShowNotificationBadge = showNotificationBadge;
