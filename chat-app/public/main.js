const loginPage = document.getElementById('loginPage');
const chatPage = document.getElementById('chatPage');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const chatWithTitle = document.getElementById('chatWith');
const logoutBtn = document.getElementById('menuLogoutBtn');
const messagesContainer = document.getElementById('messagesContainer');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

let username = null;
let chatPartner = null;
let typingTimeout = null;
let isTyping = false;
let selectedMessageId = null;

function addMessageBubble(message, sender, status = '') {
  const bubble = document.createElement('div');
  bubble.classList.add('chat-bubble');
  if (sender === username) {
    bubble.classList.add('sent');
  } else {
    bubble.classList.add('received');
  }
  let content = '';
  if (message.image) {
    content = `<img src="${message.image}" alt="Sent image" class="max-w-xs rounded-lg" />`;
  } else {
    content = `<p>${message.message || message.text}</p>`;
  }
  bubble.innerHTML = `
    ${content}
    <span class="text-xs text-gray-500 flex items-center space-x-1">
      <span>${new Date(message.timestamp).toLocaleTimeString()}</span>
      ${sender === username ? `<span class="message-status">${status === 'seen' ? '<i class="fas fa-check-double text-blue-500"></i>' : '<i class="fas fa-check"></i>'}</span>` : ''}
    </span>
  `;
  bubble.dataset.messageId = message.messageId || '';

  // Add click event to select/deselect message
  bubble.addEventListener('click', () => {
    if (selectedMessageId === bubble.dataset.messageId) {
      bubble.classList.remove('selected');
      selectedMessageId = null;
      deleteButton.style.display = 'none';
    } else {
      // Deselect previous
      const prevSelected = messagesContainer.querySelector('.chat-bubble.selected');
      if (prevSelected) {
        prevSelected.classList.remove('selected');
      }
      bubble.classList.add('selected');
      selectedMessageId = bubble.dataset.messageId;
      // Position delete button near selected message
      const rect = bubble.getBoundingClientRect();
      deleteButton.style.top = `${rect.top + window.scrollY - 40}px`;
      deleteButton.style.left = `${rect.right - 40}px`;
      deleteButton.style.display = 'block';
    }
  });

  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Create delete button
const deleteButton = document.createElement('button');
deleteButton.textContent = 'Delete';
deleteButton.style.position = 'absolute';
deleteButton.style.display = 'none';
deleteButton.style.backgroundColor = '#ef4444'; // red-500
deleteButton.style.color = 'white';
deleteButton.style.border = 'none';
deleteButton.style.padding = '0.25rem 0.5rem';
deleteButton.style.borderRadius = '0.375rem';
deleteButton.style.cursor = 'pointer';
deleteButton.style.zIndex = '1000';
document.body.appendChild(deleteButton);

deleteButton.addEventListener('click', () => {
  if (selectedMessageId) {
    socket.emit('deleteMessage', { messageId: selectedMessageId, to: chatPartner });
    // Remove message locally
    const bubble = messagesContainer.querySelector(`[data-message-id="${selectedMessageId}"]`);
    if (bubble) {
      bubble.remove();
    }
    selectedMessageId = null;
    deleteButton.style.display = 'none';
  }
});

loginPage.classList.remove('hidden');
chatPage.classList.add('hidden');

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const enteredUsername = usernameInput.value.trim();
  const enteredPassword = passwordInput.value;
  if (enteredUsername === 'user1' || enteredUsername === 'user2') {
    username = enteredUsername;
    chatPartner = username === 'user1' ? 'user2' : 'user1';
    socket.emit('login', { username, password: enteredPassword });
  } else {
    alert('Please enter a valid user ID: user1 or user2');
  }
});

const socket = io();

const renderedMessageIds = new Set();

socket.on('loginSuccess', (user) => {
  loginPage.classList.add('hidden');
  chatPage.classList.remove('hidden');
  chatWithTitle.textContent = `Chat with ${chatPartner}`;
});

socket.on('receiveMessage', (data) => {
  if (renderedMessageIds.has(data.messageId)) {
    return;
  }
  renderedMessageIds.add(data.messageId);
  addMessageBubble(data, data.from, 'seen');
  socket.emit('messageSeen', { messageId: data.messageId, to: data.from });
});

socket.on('messageSeen', ({ messageId }) => {
  const bubbles = messagesContainer.querySelectorAll(`[data-message-id="${messageId}"]`);
  bubbles.forEach((bubble) => {
    const statusSpan = bubble.querySelector('.message-status');
    if (statusSpan) {
      statusSpan.innerHTML = '<i class="fas fa-check-double text-blue-500"></i>';
    }
  });
});

socket.on('deleteMessage', ({ messageId }) => {
  const bubble = messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
  if (bubble) {
    bubble.remove();
  }
});

socket.on('errorMessage', (msg) => {
  alert(msg);
});

// Typing indicator UI
const typingIndicator = document.createElement('div');
typingIndicator.textContent = '';
typingIndicator.classList.add('text-sm', 'italic', 'text-gray-500', 'ml-2');
messagesContainer.parentNode.insertBefore(typingIndicator, messagesContainer.nextSibling);

function sendTypingStatus(isTyping) {
  if (chatPartner) {
    socket.emit('typing', { to: chatPartner, isTyping });
  }
}

messageInput.addEventListener('input', () => {
  if (!isTyping) {
    isTyping = true;
    sendTypingStatus(true);
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    sendTypingStatus(false);
  }, 1000);
});

socket.on('typing', ({ from, isTyping }) => {
  if (from === chatPartner) {
    typingIndicator.textContent = isTyping ? `${from} is typing...` : '';
  }
});

messageForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const messageText = messageInput.value.trim();
  const imageFile = document.getElementById('imageInput').files[0];

  if (!messageText && !imageFile) {
    return;
  }

  if (imageFile) {
    try {
      const resizedImageData = await resizeImage(imageFile);
      const message = {
        to: chatPartner,
        image: resizedImageData,
      };
      socket.emit('sendMessage', message);
      addMessageBubble({ image: resizedImageData, timestamp: new Date(), messageId: null }, username, 'sent');
    } catch (error) {
      alert('Failed to process image.');
    }
    messageInput.value = '';
    document.getElementById('imageInput').value = '';
  } else if (messageText) {
    const message = {
      to: chatPartner,
      message: messageText,
    };
    socket.emit('sendMessage', message);
    addMessageBubble({ text: messageText, timestamp: new Date(), messageId: null }, username, 'sent');
    messageInput.value = '';
  }
});

// Resize image to max dimension 800px and compress to jpeg quality 0.7
function resizeImage(file, maxDimension = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          const reader2 = new FileReader();
          reader2.onload = () => {
            resolve(reader2.result);
          };
          reader2.onerror = reject;
          reader2.readAsDataURL(blob);
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

logoutBtn.addEventListener('click', () => {
  loginPage.classList.remove('hidden');
  chatPage.classList.add('hidden');
});
