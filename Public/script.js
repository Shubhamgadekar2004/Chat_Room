// Socket.IO connection
const socket = io();

// DOM elements
const joinModal = new bootstrap.Modal(document.getElementById('joinModal'));
const joinForm = document.getElementById('joinForm');
const usernameInput = document.getElementById('usernameInput');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const currentUserSpan = document.getElementById('currentUser');
const userCountSpan = document.getElementById('userCount');
const typingIndicator = document.getElementById('typingIndicator');
const typingUsers = document.getElementById('typingUsers');
const connectionStatus = document.getElementById('connectionStatus');

// State variables
let username = '';
let typingTimer;
let isTyping = false;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    joinModal.show();
    usernameInput.focus();
});

// Join form submission
joinForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const enteredUsername = usernameInput.value.trim();
    
    if (enteredUsername.length < 2) {
        showAlert('Username must be at least 2 characters long', 'danger');
        return;
    }
    
    if (enteredUsername.length > 20) {
        showAlert('Username must be less than 20 characters', 'danger');
        return;
    }
    
    username = enteredUsername;
    currentUserSpan.textContent = username;
    
    // Join the chat room
    socket.emit('join', username);
    
    // Hide modal and show chat
    joinModal.hide();
    chatContainer.style.display = 'block';
    messageInput.focus();
});

// Message form submission
messageForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const message = messageInput.value.trim();
    
    if (message) {
        socket.emit('chat_message', { message: message });
        messageInput.value = '';
        
        // Stop typing indicator
        if (isTyping) {
            socket.emit('typing', false);
            isTyping = false;
        }
    }
});

// Typing indicator
messageInput.addEventListener('input', function() {
    if (!isTyping) {
        socket.emit('typing', true);
        isTyping = true;
    }
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        socket.emit('typing', false);
        isTyping = false;
    }, 1000);
});

// Socket event listeners
socket.on('connect', function() {
    showConnectionStatus('Connected', 'success');
});

socket.on('disconnect', function() {
    showConnectionStatus('Disconnected - Reconnecting...', 'warning');
});

socket.on('connect_error', function() {
    showConnectionStatus('Connection Error', 'danger');
});

socket.on('chat_history', function(history) {
    chatMessages.innerHTML = '';
    history.forEach(item => {
        if (item.type === 'message') {
            addMessage(item.username, item.message, item.timestamp);
        } else if (item.type === 'notification') {
            addNotification(item.message, item.timestamp);
        }
    });
    scrollToBottom();
});

socket.on('chat_message', function(data) {
    addMessage(data.username, data.message, data.timestamp);
    scrollToBottom();
    
    // Show notification if page is not visible
    if (document.hidden && data.username !== username) {
        showNotification(`${data.username}: ${data.message}`);
    }
});

socket.on('user_joined', function(data) {
    addNotification(data.message, data.timestamp);
    scrollToBottom();
});

socket.on('user_left', function(data) {
    addNotification(data.message, data.timestamp);
    scrollToBottom();
});

socket.on('user_count', function(count) {
    userCountSpan.textContent = count;
});

socket.on('typing_update', function(users) {
    updateTypingIndicator(users);
});

// Functions
function addMessage(sender, message, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const isOwnMessage = sender === username;
    const bubbleClass = isOwnMessage ? 'message-bubble border-primary' : 'message-bubble';
    
    messageDiv.innerHTML = `
        <div class="${bubbleClass}">
            <div class="message-header">
                <span class="username">${escapeHtml(sender)}</span>
                <span class="timestamp">${formatTime(timestamp)}</span>
            </div>
            <p class="message-text">${escapeHtml(message)}</p>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
}

function addNotification(message, timestamp) {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = 'notification';
    
    notificationDiv.innerHTML = `
        <div class="notification-bubble">
            <i class="fas fa-info-circle me-1"></i>
            ${escapeHtml(message)}
            <small class="ms-2">${formatTime(timestamp)}</small>
        </div>
    `;
    
    chatMessages.appendChild(notificationDiv);
}

function updateTypingIndicator(users) {
    if (users.length === 0) {
        typingIndicator.style.display = 'none';
        return;
    }
    
    let typingText = '';
    if (users.length === 1) {
        typingText = `${users[0]} is typing`;
    } else if (users.length === 2) {
        typingText = `${users[0]} and ${users[1]} are typing`;
    } else {
        typingText = `${users.length} people are typing`;
    }
    
    typingUsers.textContent = typingText;
    typingIndicator.style.display = 'block';
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Insert at the top of the modal body
    const modalBody = document.querySelector('#joinModal .modal-body');
    modalBody.insertBefore(alertDiv, modalBody.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

function showConnectionStatus(message, type) {
    // Remove existing status alerts
    const existingAlerts = connectionStatus.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());
    
    const statusDiv = document.createElement('div');
    statusDiv.className = `alert alert-${type} alert-connection`;
    statusDiv.innerHTML = `
        <i class="fas fa-wifi me-2"></i>
        ${message}
    `;
    
    connectionStatus.appendChild(statusDiv);
    
    // Auto-dismiss success messages
    if (type === 'success') {
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.remove();
            }
        }, 3000);
    }
}

function showNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Message', {
            body: message,
            icon: '/favicon.ico',
            tag: 'chat-message'
        });
    }
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        // Page became visible, focus on input
        if (username) {
            messageInput.focus();
        }
    }
});

// Auto-focus on message input when modal is hidden
document.getElementById('joinModal').addEventListener('hidden.bs.modal', function() {
    if (username) {
        messageInput.focus();
    }
});

// Handle keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Focus on message input when typing (if not already focused)
    if (!document.getElementById('joinModal').classList.contains('show') && 
        e.target !== messageInput && 
        e.target !== usernameInput &&
        e.key.length === 1 && 
        !e.ctrlKey && 
        !e.altKey && 
        !e.metaKey) {
        messageInput.focus();
    }
});