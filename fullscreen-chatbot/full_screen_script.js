const messageArea = document.getElementById("messageArea");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const typingIndicator = document.getElementById("typingIndicator");
const connectingIndicator = document.getElementById("connectingIndicator");
const roomStatusList = document.getElementById("roomStatusList");
const lastUpdateTime = document.getElementById("lastUpdateTime");

// Create and add scroll to bottom button
const scrollToBottomBtn = document.createElement("button");
scrollToBottomBtn.className = "scroll-to-bottom";
scrollToBottomBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
  <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
</svg>`;
messageArea.appendChild(scrollToBottomBtn);

const CHAT_URL =
  "https://ca-icdev-its-n8n.whitefield-8ab9cbcd.southeastasia.azurecontainerapps.io/webhook/40bf3220-f565-4114-a8fc-0a664ddd562b/chat";
const ROOM_STATUS_URL =
  "https://ca-icdev-its-n8n.whitefield-8ab9cbcd.southeastasia.azurecontainerapps.io/webhook/room-status";

// Generate session ID
const sessionId = "session_" + Math.random().toString(36).substring(2, 15);
localStorage.setItem("chatSessionId", sessionId);

function scrollToUserMessage(messageElement, smooth = true) {
  requestAnimationFrame(() => {
    if (messageElement) {
      // Scroll the message to near the top of the container, with a small offset
      const scrollOffset = 20; // pixels from the top
      const scrollPosition = messageElement.offsetTop - scrollOffset;

      messageArea.scrollTo({
        top: scrollPosition,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  });
}

// Find the last user message and the following bot response
function scrollToLastExchange() {
  const allMessages = Array.from(
    messageArea.getElementsByClassName("message-wrapper")
  );
  let lastUserMessage = null;

  // Find the last user message
  for (let i = allMessages.length - 1; i >= 0; i--) {
    if (allMessages[i].classList.contains("user-wrapper")) {
      lastUserMessage = allMessages[i];
      break;
    }
  }

  if (lastUserMessage) {
    scrollToUserMessage(lastUserMessage);
  }
}

// Enhanced markdown parser for bot messages (from chatbot widget)
function parseMarkdown(text) {
  // Check if the text already contains HTML tags
  const containsHTML = /<[^>]+>/.test(text);

  if (containsHTML) {
    // If it's already HTML, we need to be more careful
    let html = text;

    // Add our custom class to existing img tags that don't have it
    html = html.replace(
      /<img([^>]*?)(?<!class="[^"]*bot-message-image[^"]*")([^>]*?)>/g,
      function (match, beforeSrc, afterSrc) {
        // Check if it already has a class attribute
        if (match.includes('class="')) {
          // Add to existing class
          return match.replace(
            /class="([^"]*)"/,
            'class="$1 bot-message-image"'
          );
        } else {
          // Add new class attribute
          return match.replace(
            "<img",
            '<img class="bot-message-image" loading="lazy" onerror="this.style.display=\'none\'"'
          );
        }
      }
    );

    // Process any remaining markdown-style images that might be mixed in
    html = html.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" class="bot-message-image" loading="lazy" onerror="this.style.display=\'none\'">'
    );

    // Process any standalone image URLs that aren't already in img tags
    html = html.replace(
      /(?<!src=["']|<img[^>]*?)(?<!\/)(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|svg|bmp|ico)(?:\?[^\s<>"']*)?)/gi,
      '<img src="$1" alt="Image" class="bot-message-image" loading="lazy" onerror="this.style.display=\'none\'">'
    );

    return html;
  }

  // Enhanced markdown parser with support for tables, lists, blockquotes, etc.
  let html = text;

  // Normalize line endings
  html = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Process fenced code blocks first (with language support)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang ? ` data-language="${escapeHtml(lang)}"` : "";
    return `<pre class="enhanced-md-pre"${language}><code class="enhanced-md-code-block">${escapeHtml(
      code.trim()
    )}</code></pre>`;
  });

  // Process tables
  html = parseMarkdownTables(html);

  // Process blockquotes (multi-line support)
  html = html.replace(/^(> .*(?:\n> .*)*)/gm, (match) => {
    const content = match.replace(/^> /gm, "").trim();
    return `<blockquote class="enhanced-md-blockquote">${parseMarkdownInline(
      content
    )}</blockquote>`;
  });

  // Process lists (ordered and unordered, with nesting)
  html = parseMarkdownLists(html);

  // Process horizontal rules
  html = html.replace(
    /^(-{3,}|\*{3,}|_{3,})$/gm,
    '<hr class="enhanced-md-hr">'
  );

  // Process headings (ATX style)
  html = html.replace(/^#{6}\s+(.*)$/gm, '<h6 class="enhanced-md-h6">$1</h6>');
  html = html.replace(/^#{5}\s+(.*)$/gm, '<h5 class="enhanced-md-h5">$1</h5>');
  html = html.replace(/^#{4}\s+(.*)$/gm, '<h4 class="enhanced-md-h4">$1</h4>');
  html = html.replace(/^#{3}\s+(.*)$/gm, '<h3 class="enhanced-md-h3">$1</h3>');
  html = html.replace(/^#{2}\s+(.*)$/gm, '<h2 class="enhanced-md-h2">$1</h2>');
  html = html.replace(/^#{1}\s+(.*)$/gm, '<h1 class="enhanced-md-h1">$1</h1>');

  // Process inline formatting
  html = parseMarkdownInline(html);

  // Convert remaining line breaks to paragraphs or br tags
  html = processLineBreaks(html);

  return html;
}

// Helper function for inline markdown parsing
function parseMarkdownInline(text) {
  let html = text;

  // Images (before links to avoid conflicts)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g,
    (match, alt, src, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(
        alt
      )}"${titleAttr} class="bot-message-image" loading="lazy" onerror="this.style.display='none'">`;
    }
  );

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g,
    (match, text, url, title) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${escapeHtml(
        url
      )}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
    }
  );

  // Bold (** and __)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic (* and _)
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="enhanced-md-inline-code">$1</code>'
  );

  // Auto-link URLs (avoid double-linking)
  html = html.replace(
    /(?<!href=["']|src=["'])(?<!<a[^>]*>.*?)(https?:\/\/[^\s<>"]+)(?![^<]*<\/a>)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Email addresses
  html = html.replace(
    /(?<!href=["'])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  return html;
}

// Helper function for parsing markdown tables
function parseMarkdownTables(text) {
  const tableRegex = /^(\|.+\|)\n(\|[-\s|:]+\|)\n((?:\|.+\|\n?)+)/gm;
  return text.replace(tableRegex, (match, header, separator, rows) => {
    const headerCells = header
      .split("|")
      .slice(1, -1)
      .map(
        (cell) =>
          `<th class="enhanced-md-th">${parseMarkdownInline(cell.trim())}</th>`
      )
      .join("");
    const rowsHtml = rows
      .trim()
      .split("\n")
      .map((row) => {
        const cells = row
          .split("|")
          .slice(1, -1)
          .map(
            (cell) =>
              `<td class="enhanced-md-td">${parseMarkdownInline(
                cell.trim()
              )}</td>`
          )
          .join("");
        return `<tr class="enhanced-md-tr">${cells}</tr>`;
      })
      .join("");
    return `<table class="enhanced-md-table"><thead><tr class="enhanced-md-tr-header">${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
  });
}

// Helper function for parsing markdown lists
function parseMarkdownLists(text) {
  // Process unordered lists
  text = text.replace(/^(\s*[-*+]\s+.+(?:\n\s*[-*+]\s+.+)*)/gm, (match) => {
    const items = match
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.match(/^[-*+]\s+/)) {
          const content = trimmed.replace(/^[-*+]\s+/, "");
          return `<li class="enhanced-md-li">${parseMarkdownInline(
            content
          )}</li>`;
        }
        return "";
      })
      .filter((item) => item)
      .join("");
    return `<ul class="enhanced-md-ul">${items}</ul>`;
  });

  // Process ordered lists
  text = text.replace(/^(\s*\d+\.\s+.+(?:\n\s*\d+\.\s+.+)*)/gm, (match) => {
    const items = match
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.match(/^\d+\.\s+/)) {
          const content = trimmed.replace(/^\d+\.\s+/, "");
          return `<li class="enhanced-md-li">${parseMarkdownInline(
            content
          )}</li>`;
        }
        return "";
      })
      .filter((item) => item)
      .join("");
    return `<ol class="enhanced-md-ol">${items}</ol>`;
  });

  return text;
}

// Helper function for processing line breaks
function processLineBreaks(text) {
  // Split by double newlines to create paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return "";

      // Don't wrap block elements in paragraphs
      if (trimmed.match(/^<(h[1-6]|blockquote|pre|table|ul|ol|hr)/)) {
        return trimmed;
      }

      // Convert single line breaks to <br> within paragraphs
      const withBreaks = trimmed.replace(/\n/g, "<br>");
      return `<p class="paragraph">${withBreaks}</p>`;
    })
    .filter((p) => p)
    .join("");
}

// Helper function for escaping HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function addMessage(text, sender) {
  const messageWrapper = document.createElement("div");
  messageWrapper.classList.add("message-wrapper", `${sender}-wrapper`);
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", `${sender}-message`);
  // Add the icon class for bot/user messages
  if (sender === "bot") {
    // Parse markdown and clean up HTML
    const markdownParsed = parseMarkdown(text);
    const cleanedText = markdownParsed
      // Remove multiple <br> tags before any table (with or without attributes)
      .replace(/(<br>\s*){2,}<table[^>]*>/gi, "<table$1>")
      .replace(/(<br>\s*){1,}<table[^>]*>/gi, "<table$1>")
      // Remove multiple <br> tags after tables
      .replace(/<\/table>(\s*<br>\s*){2,}/gi, "</table><br>")
      .replace(/<\/table>(\s*<br>\s*){1,}/gi, "</table>")
      // Reduce multiple consecutive <br> to max two
      .replace(/(<br>\s*){4,}/gi, "<br><br>")
      // Clean up any remaining excessive breaks
      .replace(/(<br>\s*){3}/gi, "<br><br>");
    messageDiv.innerHTML = cleanedText;
  } else {
    // Keep user and human messages as plain text
    messageDiv.textContent = text;
  }

  messageWrapper.appendChild(messageDiv);

  // Only create button container for user and bot messages
  if (sender !== "human") {
    const buttonContainer = document.createElement("div");
    buttonContainer.classList.add("button-container");

    const copyButton = document.createElement("button");
    copyButton.classList.add("action-button", "copy-button");
    copyButton.setAttribute(
      "aria-label",
      sender === "user" ? "Copy message to input" : "Copy"
    );
    copyButton.setAttribute(
      "data-tooltip",
      sender === "user" ? "Copy" : "Copy"
    );
    copyButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16 1H4C3 1 2 2 2 3v14h2V3h12V1zm3 4H8C7 5 6 6 6 7v14c0 1 1 2 2 2h11c1 0 2-1 2-2V7c0-1-1-2-2-2zm0 16H8V7h11v14z"/>
    </svg>`;

    // Add like and dislike buttons only for bot messages
    if (sender === "bot") {
      const likeButton = document.createElement("button");
      likeButton.classList.add("action-button", "like-button");
      likeButton.setAttribute("aria-label", "Like message");
      likeButton.setAttribute("data-tooltip", "Like");
      likeButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M9 21h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2zM9 9l4.34-4.34L12 10h9v2l-3 7H9V9zM1 9h4v12H1V9z"/>
      </svg>`;

      const dislikeButton = document.createElement("button");
      dislikeButton.classList.add("action-button", "dislike-button");
      dislikeButton.setAttribute("aria-label", "Dislike message");
      dislikeButton.setAttribute("data-tooltip", "Dislike");
      dislikeButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm0 12l-4.34 4.34L12 14H3v-2l3-7h9v10zm3-12h4v12h-4V3z"/>
      </svg>`; // Add click event listeners for like/dislike
      likeButton.addEventListener("click", async () => {
        if (dislikeButton.classList.contains("active")) {
          dislikeButton.classList.remove("active");
        }
        likeButton.classList.toggle("active");

        // Send like feedback to bot with the bot's response
        if (likeButton.classList.contains("active")) {
          try {
            const feedbackMessage = {
              message: "User_like_jor_nei_gor_output",
              botResponse: text, // Include the bot's response text
              sessionId: sessionId,
            };

            await fetch(CHAT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(feedbackMessage),
            });

            console.log("Like feedback sent to bot");
          } catch (error) {
            console.error("Error sending like feedback:", error);
          }
        }
      });
      dislikeButton.addEventListener("click", async () => {
        if (likeButton.classList.contains("active")) {
          likeButton.classList.remove("active");
        }
        dislikeButton.classList.toggle("active");

        // Send dislike feedback to bot with the bot's response
        if (dislikeButton.classList.contains("active")) {
          try {
            const feedbackMessage = {
              message: "user_dislike_jor_nei_gor_answer",
              botResponse: text, // Include the bot's response text
              sessionId: sessionId,
            };

            await fetch(CHAT_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(feedbackMessage),
            });

            console.log("Dislike feedback sent to bot");
          } catch (error) {
            console.error("Error sending dislike feedback:", error);
          }
        }
      });

      buttonContainer.appendChild(likeButton);
      buttonContainer.appendChild(dislikeButton);
    }
    copyButton.addEventListener("click", () => {
      if (sender === "user") {
        // For user messages, copy to input bar AND clipboard
        userInput.value = text;
        userInput.focus();

        // Also copy to clipboard
        if (navigator.clipboard) {
          navigator.clipboard
            .writeText(text)
            .then(() => {
              copyButton.classList.add("copied");
              setTimeout(() => copyButton.classList.remove("copied"), 1000);
            })
            .catch(() => {
              // Fallback if clipboard API fails
              copyButton.classList.add("copied");
              setTimeout(() => copyButton.classList.remove("copied"), 1000);
            });
        } else {
          // Fallback for browsers without clipboard API
          try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand("copy");
            textArea.remove();
            copyButton.classList.add("copied");
            setTimeout(() => copyButton.classList.remove("copied"), 1000);
          } catch (err) {
            console.error("Failed to copy to clipboard:", err);
            copyButton.classList.add("copied");
            setTimeout(() => copyButton.classList.remove("copied"), 1000);
          }
        }
      } else {
        // For bot messages, copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
          copyButton.classList.add("copied");
          setTimeout(() => copyButton.classList.remove("copied"), 1000);
        });
      }
    });

    buttonContainer.appendChild(copyButton);

    // Add edit button only for user messages
    if (sender === "user") {
      const editButton = document.createElement("button");
      editButton.classList.add("action-button", "edit-button");
      editButton.setAttribute("aria-label", "Edit message");
      editButton.setAttribute("data-tooltip", "Edit");
      editButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
      </svg>`;

      editButton.addEventListener("click", () => {
        const editContainer = document.createElement("div");
        editContainer.classList.add("edit-container");

        const textArea = document.createElement("textarea");
        textArea.classList.add("edit-textarea");
        textArea.value = text;

        const sendButton = document.createElement("button");
        sendButton.classList.add("edit-send-button");
        sendButton.setAttribute("aria-label", "Send edited message");
        sendButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>`;

        editContainer.appendChild(textArea);
        editContainer.appendChild(sendButton);
        messageDiv.replaceWith(editContainer);
        textArea.focus();

        const handleEdit = async () => {
          const newMessage = textArea.value.trim();
          if (newMessage && newMessage !== text) {
            // Keep the original message and revert the edit UI
            editContainer.replaceWith(messageDiv);
            // Add the edited message as a new user message
            addMessage(newMessage, "user");
            // Get and show bot's response
            const response = await sendMessage(newMessage);
            addMessage(response, "bot");
          } else {
            // If no changes, just revert back to the original message
            editContainer.replaceWith(messageDiv);
          }
        };

        const submitEdit = async (e) => {
          if (e) {
            e.preventDefault();
            e.stopPropagation();
          }
          await handleEdit();
        };

        // Handle Enter key in textarea
        textArea.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitEdit(e);
            return false;
          }
        });

        // Handle send button click
        sendButton.addEventListener("click", submitEdit);

        // Handle blur event to cancel edit, but not when clicking the send button
        textArea.addEventListener("blur", (e) => {
          // Add a small delay to allow the send button click to process
          setTimeout(() => {
            if (!e.relatedTarget?.classList.contains("edit-send-button")) {
              editContainer.replaceWith(messageDiv);
            }
          }, 100);
        });
      });

      buttonContainer.appendChild(editButton);
    }

    messageWrapper.appendChild(buttonContainer);
  }
  messageArea.appendChild(messageWrapper);

  // Add click event listeners to images for modal viewing
  if (sender === "bot") {
    const images = messageWrapper.querySelectorAll(".bot-message-image");
    images.forEach((img) => {
      img.addEventListener("click", () => showImageModal(img.src, img.alt));
    });
  }

  setTimeout(() => scrollToLastExchange(), 100);
}

// Image modal functionality
function showImageModal(src, alt) {
  // Create modal if it doesn't exist
  let modal = document.getElementById("imageModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "imageModal";
    modal.className = "image-modal";

    const modalImg = document.createElement("img");
    modalImg.id = "modalImage";

    const closeBtn = document.createElement("button");
    closeBtn.className = "image-modal-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", hideImageModal);

    modal.appendChild(modalImg);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);

    // Close modal when clicking outside the image
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideImageModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("active")) {
        hideImageModal();
      }
    });
  }

  const modalImg = document.getElementById("modalImage");
  modalImg.src = src;
  modalImg.alt = alt;
  modal.classList.add("active");
  document.body.style.overflow = "hidden"; // Prevent background scrolling
}

function hideImageModal() {
  const modal = document.getElementById("imageModal");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = ""; // Restore scrolling
  }
}

async function sendMessage(message) {
  try {
    typingIndicator.classList.add("visible");
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
    });
    const data = await response.json();
    const output = data.output; // Start polling if we receive the specific message
    const responseText = output.trim();
    if (
      responseText.includes("Please wait. Type 'Cancel' to cancel the queue")
    ) {
      console.log("Starting polling due to queue message");
      startPolling();
    } else if (responseText === "Cancelled") {
      console.log("Stopping polling due to cancellation");
      stopPolling();
      hideConnectingIndicator();
    }

    return output || "Sorry, I could not process your request.";
  } catch (error) {
    console.error("Error:", error);
    return "Sorry, there was an error processing your message.";
  } finally {
    typingIndicator.classList.remove("visible");
  }
}

async function handleUserInput() {
  const message = userInput.value.trim();
  if (!message) return;

  userInput.disabled = true;
  sendButton.disabled = true;
  addMessage(message, "user");
  userInput.value = "";
  scrollToLastExchange();

  const response = await sendMessage(message);
  addMessage(response, "bot");
  scrollToLastExchange();

  userInput.disabled = false;
  sendButton.disabled = false;
  userInput.focus();
}

// Function to add suggestion buttons
function addSuggestionButtons() {
  const suggestionsGrid = document.createElement("div");
  suggestionsGrid.classList.add("suggestion-grid");

  const suggestions = [
    "How do I reset my HKU Portal password?",
    "What are the printing costs at HKU?",
    "How do I connect to HKU WiFi?",
    "Give me the availability of Chi Wah Study Room",
  ];

  suggestions.forEach((suggestion) => {
    const button = document.createElement("button");
    button.classList.add("suggestion-button");
    button.textContent = suggestion;

    button.addEventListener("click", async () => {
      // Remove suggestion grid when any button is clicked
      if (document.querySelector(".suggestion-grid")) {
        document.querySelector(".suggestion-grid").remove();
      }

      addMessage(suggestion, "user");
      const response = await sendMessage(suggestion);
      addMessage(response, "bot");
    });

    suggestionsGrid.appendChild(button);
  });
  messageArea.appendChild(suggestionsGrid);
  // No need to scroll for suggestions
}

// Fetch room status
async function fetchRoomStatus() {
  try {
    console.log("Fetching from URL:", ROOM_STATUS_URL);
    const response = await fetch(ROOM_STATUS_URL);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Received data:", data);

    updateRoomStatusDisplay(data);
  } catch (error) {
    console.error("Error fetching room status:", error);
    if (roomStatusList) {
      roomStatusList.innerHTML = `
        <div class="room-status-item error">
          Error loading room status. Please try again later.
        </div>
      `;
    }
  }
}

// Fetch room status for a specific library and date
async function fetchRoomStatusForLibrary(libraryName, dateStr) {
  try {
    console.log(
      "Fetching room status for library:",
      libraryName,
      "date:",
      dateStr
    );
    console.log("Fetching from URL:", ROOM_STATUS_URL);

    // If dateStr is not provided, get it from the date select box
    let dateToSend = dateStr;
    if (!dateToSend) {
      const dateSelect = document.getElementById("libraryDateSelect");
      if (dateSelect) {
        // Get today's and tomorrow's date in YYYY-MM-DD
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        function pad(n) {
          return n < 10 ? "0" + n : n;
        }
        const todayStr = `${today.getFullYear()}-${pad(
          today.getMonth() + 1
        )}-${pad(today.getDate())}`;
        const tomorrowStr = `${tomorrow.getFullYear()}-${pad(
          tomorrow.getMonth() + 1
        )}-${pad(tomorrow.getDate())}`;
        dateToSend = dateSelect.value === "today" ? todayStr : tomorrowStr;
      }
    }

    const response = await fetch(ROOM_STATUS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ location: libraryName, date: dateToSend }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Received data for", libraryName, "on", dateToSend, ":", data);

    updateRoomStatusDisplay(data);
    updateLastUpdateTime();
  } catch (error) {
    console.error("Error fetching room status for library:", error);
    if (roomStatusList) {
      roomStatusList.innerHTML = `
        <div class="room-status-item error">
          Error loading room status for ${libraryName}. Please try again later.
        </div>
      `;
    }
  }
}

// Update room status display with new data format
function updateRoomStatusDisplay(data) {
  if (!roomStatusList) return;

  roomStatusList.innerHTML = ""; // Clear existing items

  // Handle both single object and array responses
  let responseData;
  if (Array.isArray(data) && data.length > 0) {
    responseData = data[0]; // Take first item if it's an array
  } else if (data && typeof data === "object") {
    responseData = data; // Use directly if it's an object
  } else {
    roomStatusList.innerHTML = `
      <div class="room-status-item error">
        No room data available
      </div>`;
    return;
  }

  try {
    console.log("Processing room status data:", responseData);

    // Get the currently selected library for display title
    const librarySelect = document.getElementById("librarySelect");
    const selectedLibrary = librarySelect ? librarySelect.value : "chi-wah";
    const libraryDisplayName = getLibraryDisplayName(selectedLibrary);

    // Check if we have currentstatus field (new format) or fallback to old format
    let currentStatus;
    if (responseData.currentstatus !== undefined) {
      currentStatus = responseData.currentstatus;
    } else if (
      responseData.location &&
      responseData.currentstatus !== undefined
    ) {
      // Old format fallback
      currentStatus = responseData.currentstatus;
    } else {
      roomStatusList.innerHTML = `
        <div class="room-status-item error">
          Invalid data format received
        </div>`;
      return;
    }

    // Display the current status for the library
    const statusContainer = document.createElement("div");
    statusContainer.className = "library-status-display";

    const statusContent = document.createElement("div");
    statusContent.className = "status-content";

    // Parse current status - could be JSON string or object
    let parsedStatus;
    try {
      if (typeof currentStatus === "string") {
        parsedStatus = JSON.parse(currentStatus);
      } else {
        parsedStatus = currentStatus;
      }
    } catch (e) {
      // If parsing fails, treat as plain text
      parsedStatus = currentStatus;
    }

    // Display status based on its format
    if (typeof parsedStatus === "object" && parsedStatus !== null) {
      // Check if it has the nested structure with study_room_availability
      let tableData = null;

      if (
        parsedStatus.study_room_availability &&
        parsedStatus.study_room_availability.time_slots
      ) {
        // Extract the time slots data from the nested structure
        tableData = parsedStatus.study_room_availability.time_slots;
        console.log("Extracted time slots data:", tableData);
      } else if (isTableFormat(parsedStatus)) {
        // Direct table format
        tableData = parsedStatus;
      }

      if (tableData && isTableFormat(tableData)) {
        const tableContainer = createRoomStatusTable(tableData);
        statusContent.appendChild(tableContainer);
      } else {
        // If it's a regular object, display key-value pairs
        Object.entries(parsedStatus).forEach(([key, value]) => {
          const statusItem = document.createElement("div");
          statusItem.className = "status-item";
          statusItem.innerHTML = `
            <span class="status-key">${key}:</span>
            <span class="status-value">${
              typeof value === "object" ? JSON.stringify(value) : value
            }</span>
          `;
          statusContent.appendChild(statusItem);
        });
      }
    } else {
      // If it's a string or other format, display as is
      const statusItem = document.createElement("div");
      statusItem.className = "status-item";
      statusItem.textContent = parsedStatus;
      statusContent.appendChild(statusItem);
    }

    statusContainer.appendChild(statusContent);
    roomStatusList.appendChild(statusContainer);
  } catch (error) {
    console.error("Error processing room status data:", error);
    roomStatusList.innerHTML = `
      <div class="room-status-item error">
        Error processing room status data
      </div>`;
  }
}

// Helper function to update library title based on selection
function updateLibraryTitle(libraryValue) {
  const statusTitle = document.getElementById("statusTitle");
  if (!statusTitle) return;

  const libraryNames = {
    "chi-wah": "Chi Wah Room Status",
    "main-library": "Main Library Room Status",
    "medical-single": "Medical Library (Single) Status",
    "medical-discussion": "Medical Library (Discussion) Status",
    "law-library": "Law Library Room Status",
    "music-library": "Music Library Room Status",
    "dental-library": "Dental Library Room Status",
  };

  statusTitle.textContent = libraryNames[libraryValue] || "Room Status";
}

// Helper function to create a time slot section
function createTimeSlotSection(timeSlotData) {
  const timeSlotSection = document.createElement("div");
  timeSlotSection.className = "time-slot-section";

  // Add time slot header
  const timeHeader = document.createElement("div");
  timeHeader.className = "room-time-header";
  timeHeader.textContent = timeSlotData.timeSlot;
  timeSlotSection.appendChild(timeHeader);

  // Create container for rooms in this time slot
  const roomsContainer = document.createElement("div");
  roomsContainer.className = "rooms-container";

  // Add rooms for this time slot
  timeSlotData.rooms.forEach((room) => {
    const roomElement = document.createElement("div");
    roomElement.className = "room-status-item";

    const statusClass = room.status.toLowerCase().includes("available")
      ? "status-available"
      : "status-booked";

    roomElement.innerHTML = `
      <div class="room-info">
        <div class="room-name">${room.name}</div>
      </div>
      <div class="room-status ${statusClass}">
        ${room.status}
      </div>
    `;

    roomsContainer.appendChild(roomElement);
  });

  timeSlotSection.appendChild(roomsContainer);
  return timeSlotSection;
}

// Fetch room status initially and set up periodic updates
async function updateRoomStatus() {
  // Get the default library selection
  const librarySelect = document.getElementById("librarySelect");
  const defaultLibrary = librarySelect ? librarySelect.value : "chi-wah";
  const defaultLibraryName = getLibraryDisplayName(defaultLibrary);

  await fetchRoomStatusForLibrary(defaultLibraryName);
  updateLastUpdateTime();
}

updateRoomStatus(); // Initial fetch
setInterval(updateRoomStatus, 600000); // Update every 10 minutes (600,000 ms)

// Variable to store polling interval
let pollingInterval = null;
let isConnecting = false;
let lastQueuePosition = null;

// Function to show connecting indicator
function showConnectingIndicator() {
  connectingIndicator.classList.add("visible");
  isConnecting = true;
}

// Function to hide connecting indicator
function hideConnectingIndicator() {
  connectingIndicator.classList.remove("visible");
  isConnecting = false;
}

// Function to start polling
function startPolling() {
  if (!pollingInterval) {
    showConnectingIndicator();
    pollForMessages(); // Initial poll
    pollingInterval = setInterval(pollForMessages, 1000);
    console.log("Polling started");
  }
}

// Function to stop polling
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    lastQueuePosition = null; // Reset queue position when polling stops
    console.log("Polling stopped");
  }
}

// Function to poll for new messages
async function pollForMessages() {
  try {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "-", sessionId }),
    });
    const data = await response.json();
    let message = data.output; // Only show message if it's not "-" and not empty
    if (message && message !== "-") {
      // Keep the message as plain text without any HTML formatting
      message = message.toString().trim();

      // Check if it's a queue position message
      const queuePositionMatch = message.match(/queue position[:\s]*(\d+)/i);
      if (queuePositionMatch) {
        const currentPosition = queuePositionMatch[1];
        // Only show the message if the queue position has changed
        if (lastQueuePosition !== currentPosition) {
          lastQueuePosition = currentPosition;
          addMessage(message, "bot");
          scrollToLastExchange();
        }
        return; // Exit early for queue position messages
      }

      // Check if it's the stop command
      if (message === "/stop") {
        stopPolling();
        addMessage("Staff disconnected", "bot");
        scrollToLastExchange();
      } else if (message === "Cancelled") {
        stopPolling();
        hideConnectingIndicator();
        addMessage("Queue cancelled", "bot");
        scrollToLastExchange();
      } else if (
        message.includes("Please wait. Type 'Cancel' to cancel the queue")
      ) {
        // Don't show "Please wait" message, just keep connecting indicator visible
        console.log(
          "Received queue message during polling, keeping indicator visible"
        );
        if (!isConnecting) {
          showConnectingIndicator();
        }
      } else {
        // First human message received, hide connecting indicator
        hideConnectingIndicator();
        addMessage(message, "human");
        scrollToLastExchange();
      }
    }
  } catch (error) {
    console.error("Error polling for messages:", error);
    hideConnectingIndicator();
  }
}

// Function to send disconnect message when page is refreshed during queue or active chat
function sendDisconnectMessage() {
  try {
    const data = JSON.stringify({
      message: "User disconnected due to page refresh",
      sessionId,
    });

    // Use fetch with keepalive for better compatibility
    fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
      keepalive: true, // Keep request alive during page unload
    })
      .then(() => {
        console.log("Disconnect message sent successfully");
      })
      .catch((error) => {
        console.error("Error sending disconnect message:", error);
      });

    // Also try sendBeacon as backup
    if (navigator.sendBeacon) {
      const formData = new FormData();
      formData.append("message", "User disconnected due to page refresh");
      formData.append("sessionId", sessionId);
      navigator.sendBeacon(CHAT_URL, formData);
      console.log("Disconnect message also sent via sendBeacon");
    }
  } catch (error) {
    console.error("Error sending disconnect message:", error);
  }
}

// Function to check if user is in queue or active chat
function isInActiveSession() {
  return pollingInterval !== null || isConnecting;
}

// Handle page refresh/close during active session
window.addEventListener("beforeunload", (event) => {
  if (isInActiveSession()) {
    // Show confirmation dialog (don't send disconnect message yet)
    event.preventDefault();
    event.returnValue =
      "You are currently in a queue or active chat. Are you sure you want to leave?";
    return event.returnValue;
  }
});

// Send disconnect message only when page is actually being unloaded
window.addEventListener("pagehide", () => {
  if (isInActiveSession()) {
    // Send disconnect message when page is actually being unloaded
    sendDisconnectMessage();
  }
});

// Also listen to unload as fallback
window.addEventListener("unload", () => {
  if (isInActiveSession()) {
    // Send disconnect message when page is actually being unloaded
    sendDisconnectMessage();
  }
});

// Handle page visibility change (when user switches tabs or minimizes)
document.addEventListener("visibilitychange", () => {
  if (document.hidden && isInActiveSession()) {
    console.log("Page hidden during active session");
  } else if (!document.hidden && isInActiveSession()) {
    console.log("Page visible during active session");
  }
});

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  sendButton.addEventListener("click", handleUserInput);
  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleUserInput();
    }
  });

  // Library selector functionality
  const librarySelect = document.getElementById("librarySelect");
  const statusTitle = document.getElementById("statusTitle");
  const dateSelect = document.getElementById("libraryDateSelect");

  if (librarySelect && statusTitle) {
    // Set initial title based on default selection
    updateLibraryTitle(librarySelect.value);

    // Add change event listener
    librarySelect.addEventListener("change", async (e) => {
      const selectedLibrary = e.target.value;
      const libraryDisplayName = getLibraryDisplayName(selectedLibrary);

      updateLibraryTitle(selectedLibrary);

      // Clear current room status and show loading
      if (roomStatusList) {
        roomStatusList.innerHTML =
          '<div style="padding: 1rem; text-align: center; color: #888; font-size: 0.8rem;">Loading room status...</div>';
      }

      // Fetch room status for the selected library from the webhook
      // Use the currently selected date
      let dateToSend = null;
      if (dateSelect) {
        // Get today's and tomorrow's date in YYYY-MM-DD
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        function pad(n) {
          return n < 10 ? "0" + n : n;
        }
        const todayStr = `${today.getFullYear()}-${pad(
          today.getMonth() + 1
        )}-${pad(today.getDate())}`;
        const tomorrowStr = `${tomorrow.getFullYear()}-${pad(
          tomorrow.getMonth() + 1
        )}-${pad(tomorrow.getDate())}`;
        dateToSend = dateSelect.value === "today" ? todayStr : tomorrowStr;
      }
      await fetchRoomStatusForLibrary(libraryDisplayName, dateToSend);
      console.log("Selected library:", selectedLibrary);
    });
  }

  // Date selector functionality
  if (dateSelect) {
    dateSelect.addEventListener("change", async (e) => {
      const selectedDate = e.target.value;
      // Get the currently selected library
      const librarySelect = document.getElementById("librarySelect");
      const selectedLibrary = librarySelect ? librarySelect.value : "chi-wah";
      const libraryDisplayName = getLibraryDisplayName(selectedLibrary);

      // Get the date string in YYYY-MM-DD
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
      function pad(n) {
        return n < 10 ? "0" + n : n;
      }
      const todayStr = `${today.getFullYear()}-${pad(
        today.getMonth() + 1
      )}-${pad(today.getDate())}`;
      const tomorrowStr = `${tomorrow.getFullYear()}-${pad(
        tomorrow.getMonth() + 1
      )}-${pad(tomorrow.getDate())}`;
      const dateToSend = selectedDate === "today" ? todayStr : tomorrowStr;

      // Clear current room status and show loading
      if (roomStatusList) {
        roomStatusList.innerHTML =
          '<div style="padding: 1rem; text-align: center; color: #888; font-size: 0.8rem;">Loading room status...</div>';
      }

      await fetchRoomStatusForLibrary(libraryDisplayName, dateToSend);
      console.log("Selected date:", selectedDate);
    });
  }

  // Email ITS Button
  document.getElementById("emailITSButton").addEventListener("click", () => {
    userInput.value = "Email ITS";
    handleUserInput();
  });

  // Chat With Staff Button
  document
    .getElementById("chatWithStaffButton")
    .addEventListener("click", () => {
      userInput.value = "Chat with ITS Staff";
      handleUserInput();
    });

  // Handle suggestion chips
  document.querySelectorAll(".suggestion-chip").forEach((chip) => {
    chip.addEventListener("click", async () => {
      const message = chip.textContent;
      addMessage(message, "user");
      const response = await sendMessage(message);
      addMessage(response, "bot");
    });
  });

  // Add welcome message
  addMessage("Welcome to HKU ITS Chatbot! How can I assist you today?", "bot");

  // Add suggestion buttons
  addSuggestionButtons();
});

// Function to format the last update time
function updateLastUpdateTime() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  lastUpdateTime.textContent = `Last updated: ${hours}:${minutes}`;
}

// Initial last update time set
updateLastUpdateTime();
// Update last update time every minute
setInterval(updateLastUpdateTime, 60000);

// Sidebar toggle functionality
const sidebar = document.querySelector(".room-status-sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const floatingToggle = document.getElementById("floatingToggle");

function toggleSidebar() {
  sidebar.classList.toggle("collapsed");
}

if (sidebarToggle) {
  sidebarToggle.addEventListener("click", toggleSidebar);
}

if (floatingToggle) {
  floatingToggle.addEventListener("click", toggleSidebar);
}

// Auto-collapse sidebar on small screens only
window.addEventListener("resize", () => {
  // If window width is less than 768px (mobile), force collapse sidebar
  if (window.innerWidth <= 768) {
    sidebar.classList.add("collapsed");
  }
  // Don't auto-expand on larger screens - let user control it
});

// Initial check for mobile devices
if (window.innerWidth <= 768) {
  sidebar.classList.add("collapsed");
}

// Scroll to bottom functionality
function scrollToBottom() {
  messageArea.scrollTo({
    top: messageArea.scrollHeight,
    behavior: "smooth",
  });
}

// Check if user is at bottom of messages
function isAtBottom() {
  const threshold = 100; // pixels from bottom
  return (
    messageArea.scrollTop + messageArea.clientHeight >=
    messageArea.scrollHeight - threshold
  );
}

// Show/hide scroll to bottom button based on scroll position
function toggleScrollButton() {
  if (isAtBottom()) {
    scrollToBottomBtn.classList.remove("visible");
  } else {
    scrollToBottomBtn.classList.add("visible");
  }
}

// Event listeners for scroll to bottom functionality
scrollToBottomBtn.addEventListener("click", scrollToBottom);
messageArea.addEventListener("scroll", toggleScrollButton);

// Helper function to get library display name for bot messages
function getLibraryDisplayName(libraryValue) {
  const libraryDisplayNames = {
    "chi-wah": "Chi Wah",
    "main-library": "Main Library",
    "medical-single": "Medical Library (Single)",
    "medical-discussion": "Medical Library (Discussion)",
    "law-library": "Law Library",
    "music-library": "Music Library",
    "dental-library": "Dental Library",
  };

  return libraryDisplayNames[libraryValue] || libraryValue;
}

// Helper function to detect if data is in table format
function isTableFormat(data) {
  // Check if data has the structure of a room status table
  // Expected formats:
  // 1. Object with time slots as keys and rooms data as values
  // 2. Object with a "timeSlots" array or similar structure
  // 3. Object where values are objects containing room information
  // 4. Array of objects with time and room information

  console.log("Checking if data is table format:", data);

  if (!data || typeof data !== "object") {
    console.log("Not table format: not an object");
    return false;
  }

  // Check for array format first
  if (Array.isArray(data)) {
    const result =
      data.length > 0 &&
      typeof data[0] === "object" &&
      (data[0].hasOwnProperty("time") || data[0].hasOwnProperty("timeSlot"));
    console.log("Array format check result:", result);
    return result;
  }

  // Check if it looks like time slots with room data
  const keys = Object.keys(data);
  console.log("Data keys:", keys);

  if (keys.length === 0) {
    console.log("Not table format: no keys");
    return false;
  }

  // Look for patterns that suggest table structure:
  // - Keys that look like time slots (e.g., "09:00-10:00", "9-10", etc.)
  // - Values that are objects with room information
  const firstKey = keys[0];
  const firstValue = data[firstKey];

  console.log("First key:", firstKey, "First value:", firstValue);

  // Check if first value is an object that could contain room data
  if (typeof firstValue === "object" && firstValue !== null) {
    // Check if it has room-like properties
    const valueKeys = Object.keys(firstValue);
    console.log("Value keys:", valueKeys);

    // Look for room identifiers or status information
    const hasRoomLikeData = valueKeys.some(
      (key) =>
        key.toLowerCase().includes("room") ||
        key.toLowerCase().includes("study") ||
        key.toLowerCase().includes("available") ||
        key.toLowerCase().includes("booked") ||
        key.match(/^[A-Z]{2,}\d+/i) || // Pattern like "ALG28", "BLD205" (2+ letters + numbers)
        key.match(/^[A-Z]\d+/i) || // Pattern like "A101", "B205" (1 letter + numbers)
        key.match(/^\d+$/) || // Just numbers
        key.match(/^room\s*\d+/i) || // "Room 1", "room1", etc.
        key.match(/^study\s*room\s*\d+/i) // "Study Room 1", etc.
    );

    // If we don't find obvious room patterns, check if we have multiple consistent keys
    // that could be room identifiers (at least 2 keys, all strings)
    const couldBeRoomKeys =
      !hasRoomLikeData &&
      valueKeys.length >= 2 &&
      valueKeys.every(
        (key) => typeof key === "string" && key.trim().length > 0
      );

    console.log("Has room-like data:", hasRoomLikeData);
    console.log("Could be room keys:", couldBeRoomKeys);
    if (hasRoomLikeData || couldBeRoomKeys) return true;
  }

  // Check if first key looks like a time slot
  const timePatterns = [
    /^\d{1,2}:\d{2}[-\s]?\d{1,2}:\d{2}$/, // 09:00-10:00 or 09:00 10:00
    /^\d{1,2}[-\s]\d{1,2}$/, // 9-10 or 9 10
    /^\d{1,2}:\d{2}$/, // 09:00
    /^\d{1,2}(am|pm)[-\s]\d{1,2}(am|pm)$/i, // 9am-10am
    /^(morning|afternoon|evening)/i, // morning, afternoon, evening
  ];

  const isTimeKey = timePatterns.some((pattern) => pattern.test(firstKey));
  console.log("Is time key:", isTimeKey, "for key:", firstKey);

  // Also check if we have a reasonable number of entries (2-20 time slots typically)
  const reasonableTimeSlotCount = keys.length >= 2 && keys.length <= 30;
  console.log(
    "Reasonable time slot count:",
    reasonableTimeSlotCount,
    "count:",
    keys.length
  );

  const result = isTimeKey && reasonableTimeSlotCount;
  console.log("Final table format result:", result);
  return result;
}

// Helper function to create room status table
function createRoomStatusTable(data) {
  console.log("Creating room status table from data:", data);

  const tableContainer = document.createElement("div");
  tableContainer.className = "room-status-table-container";

  const table = document.createElement("div");
  table.className = "room-status-table";

  let timeSlots = [];
  let allRooms = new Set();
  let processedData = {};

  // Handle different data formats
  if (Array.isArray(data)) {
    // Array format: convert to object format
    data.forEach((item) => {
      const timeKey = item.time || item.timeSlot || item.slot;
      if (timeKey) {
        processedData[timeKey] = item;
        Object.keys(item).forEach((key) => {
          if (key !== "time" && key !== "timeSlot" && key !== "slot") {
            allRooms.add(key);
          }
        });
      }
    });
    timeSlots = Object.keys(processedData).sort();
  } else {
    // Object format: use directly
    processedData = data;
    timeSlots = Object.keys(data).sort();

    // Collect all unique room identifiers
    timeSlots.forEach((timeSlot) => {
      const roomData = data[timeSlot];
      if (typeof roomData === "object" && roomData !== null) {
        Object.keys(roomData).forEach((room) => allRooms.add(room));
      }
    });
  }

  const rooms = Array.from(allRooms).sort((a, b) => {
    // Sort rooms: try to put numbered rooms in order
    const aNum = a.match(/\d+/);
    const bNum = b.match(/\d+/);
    if (aNum && bNum) {
      return parseInt(aNum[0]) - parseInt(bNum[0]);
    }
    return a.localeCompare(b);
  });

  if (rooms.length === 0 || timeSlots.length === 0) {
    // Fallback to simple display if structure is unexpected
    const errorDiv = document.createElement("div");
    errorDiv.className = "status-item";
    errorDiv.textContent = "No room data available in expected format";
    return errorDiv;
  }

  // Create header row
  const headerRow = document.createElement("div");
  headerRow.className = "table-header-row";

  // Time column header
  const timeHeader = document.createElement("div");
  timeHeader.className = "table-cell time-header";
  timeHeader.textContent = "Time";
  headerRow.appendChild(timeHeader);

  // Room headers
  rooms.forEach((room) => {
    const roomHeader = document.createElement("div");
    roomHeader.className = "table-cell room-header";

    // Extract room number from various formats
    let displayName = room;

    // Extract number from different room naming patterns
    const patterns = [
      /study\s*room\s*(\d+)/i, // "study room 1", "study_room_1"
      /discussion\s*room\s*(\d+)/i, // "discussion room 1", "discussion_room_1"
      /room\s*(\d+)/i, // "room 1", "room_1"
      /([a-z]+)(\d+)/i, // "ALG28", "BLG12", etc.
      /(\d+)$/, // Just numbers at the end
    ];

    let roomNumber = null;
    for (const pattern of patterns) {
      const match = room.match(pattern);
      if (match) {
        roomNumber = match[match.length - 1]; // Get the last capture group (the number)
        break;
      }
    }

    // Use the extracted number or fallback to shortened original name
    if (roomNumber) {
      displayName = roomNumber;
    } else {
      // Fallback: just show first 4 characters if no number found
      displayName = room.length > 4 ? room.substring(0, 4) : room;
    }

    roomHeader.textContent = displayName;
    roomHeader.title = `${room}`; // Tooltip with full name
    headerRow.appendChild(roomHeader);
  });

  table.appendChild(headerRow);

  // Create data rows for each time slot
  timeSlots.forEach((timeSlot) => {
    const dataRow = document.createElement("div");
    dataRow.className = "table-data-row";

    // Time cell
    const timeCell = document.createElement("div");
    timeCell.className = "table-cell time-cell";

    // Clean up time display
    let displayTime = timeSlot;
    if (displayTime.length > 7) {
      // Truncate very long time strings
      displayTime = displayTime.substring(0, 7);
    }

    timeCell.textContent = displayTime;
    timeCell.title = timeSlot; // Full time in tooltip
    dataRow.appendChild(timeCell);

    // Status cells for each room
    rooms.forEach((room) => {
      const statusCell = document.createElement("div");
      statusCell.className = "table-cell status-cell";

      const roomData = processedData[timeSlot];
      let status = "no-data";
      let displayText = "?";

      if (
        roomData &&
        typeof roomData === "object" &&
        roomData[room] !== undefined
      ) {
        const roomStatus = roomData[room];
        const statusStr = String(roomStatus).toLowerCase();

        if (
          statusStr.includes("available") ||
          statusStr.includes("free") ||
          statusStr === "0"
        ) {
          status = "available";
          displayText = "✓";
        } else if (
          statusStr.includes("booked") ||
          statusStr.includes("occupied") ||
          statusStr.includes("busy") ||
          statusStr === "1"
        ) {
          status = "booked";
          displayText = "✗";
        } else {
          // For other values, show abbreviated version
          if (roomStatus.toString().length > 2) {
            displayText = roomStatus.toString().substring(0, 2);
          } else {
            displayText = roomStatus.toString();
          }
        }
      }

      statusCell.classList.add(status);
      statusCell.textContent = displayText;
      statusCell.title = `${room} at ${timeSlot}: ${
        roomData?.[room] || "No data"
      }`;

      dataRow.appendChild(statusCell);
    });

    table.appendChild(dataRow);
  });

  tableContainer.appendChild(table);
  return tableContainer;
}
