# HKU Chatbot Widget (TypeScript)

This project is a TypeScript port of the HKU Chatbot Widget, designed for seamless integration into any website. It provides a modern, responsive chat interface that connects users to a backend chatbot service, supporting advanced markdown, polling, queueing, suggestion/action buttons, and robust UI/UX behaviors.

## How It Works

- **Widget Initialization:**
  - The widget injects a floating chat button (toggle) into the page, typically in the bottom corner.
  - Clicking the toggle opens a chat window overlay with a header, message area, input bar, and action buttons.
  - The widget can auto-initialize or be controlled via the global `window.HKUChatbotWidget` API, allowing programmatic open/close and message sending.

- **Core Functions:**
  - **Conversational Interface:** Users can chat with the bot in real time. The widget manages message history, displays both user and bot messages, and supports staff (human) responses.
  - **Backend Communication:** Messages are sent to a backend endpoint. The widget polls the backend every second for new messages, queue position, and status updates, ensuring timely updates and queue management.
  - **Queueing & Polling:** If the bot is busy, users are placed in a queue and shown their position. The widget displays connecting and typing indicators for a realistic chat experience.
  - **Markdown Rendering:** Bot messages support advanced markdown, including tables, lists, images, links, code blocks, blockquotes, and more, for rich and clear responses.
  - **Suggestion & Action Buttons:** The bot can provide quick-reply suggestion buttons and custom action buttons for user convenience.
  - **Message Actions:** Users can copy messages, like/dislike bot responses, and interact with message-level controls.
  - **Smart Scrolling:** The chat auto-scrolls to the latest message, with a scroll-to-bottom button for long conversations.
  - **Responsive Design:** The widget and toggle button scale smoothly for all devices, from desktop to small mobile screens, always remaining accessible and visually appealing.
  - **Robust UX:** Features include click-outside-to-close, page refresh/disconnect warnings, focus management, and prevention of accidental closure during text selection or drag.
  - **Customizable & Extensible:** The widget exposes a global API for advanced integration, supports theme and position options, and can be easily styled or extended.

- **Security & Compatibility:**
  - The widget is browser-compatible, works without external dependencies, and is designed for secure embedding in any web page.

## Structure

- `src/chatbot-widget-final.ts`: Main TypeScript source file (edit here)
- `dist/chatbot-widget-final.js`: Compiled output for use in HTML

## Scripts

- `npm run build` — Compile TypeScript to JavaScript
- `npm run watch` — Watch for changes and recompile automatically

## Setup

1. Place your TypeScript code in `src/chatbot-widget-final.ts`.
2. Run `npm run build` to generate the output in `dist/`.
3. Reference `dist/chatbot-widget-final.js` in your HTML as before.

## Development

- Edit and refactor your code in TypeScript for better maintainability and type safety.
- Test in `test.html` or `comparison-test.html` for feature and style parity.
- The widget is browser-compatible and exposes a global API for advanced integration.
