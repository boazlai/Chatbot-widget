// HKU Chatbot Widget - TypeScript version
// Converted from chatbot-widget.js

(function () {
  "use strict";

  // Prevent multiple instances
  if ((window as any).HKUChatbotWidget) {
    return;
  }

  interface HKUChatbotWidgetOptions {
    chatUrl?: string;
    fullscreenUrl?: string;
    position?: string;
    theme?: string;
    debug?: boolean;
    apiKey?: string;
    autoOpen?: boolean;
    showWelcome?: boolean;
  }

  class HKUChatbotWidget {
    private options: HKUChatbotWidgetOptions;
    private config: any;
    private isOpen: boolean;
    private sessionId: string;
    private pollingInterval: number | null;
    private isConnecting: boolean;
    private lastQueuePosition: string | null;
    private widget: HTMLElement | null = null;
    private elements: any = {};

    constructor(options: HKUChatbotWidgetOptions = {}) {
      const globalConfig = (window as any).HKUChatbotConfig
        ? (window as any).HKUChatbotConfig.getEnvironmentConfig()
        : {};

      this.options = Object.assign(
        {
          chatUrl:
            options.chatUrl ||
            globalConfig.chatUrl ||
            "https://ca-icdev-its-n8n.whitefield-8ab9cbcd.southeastasia.azurecontainerapps.io/webhook/40bf3220-f565-4114-a8fc-0a664ddd562b/chat",
          fullscreenUrl:
            options.fullscreenUrl ||
            globalConfig.fullscreenUrl ||
            "./fullscreen-chatbot/full_screen_index.html",
          position: options.position || globalConfig.position || "bottom-right",
          theme: options.theme || globalConfig.theme || "dark",
          debug:
            options.debug !== undefined
              ? options.debug
              : globalConfig.debug || false,
          apiKey: options.apiKey || globalConfig.apiKey || "",
          autoOpen:
            options.autoOpen !== undefined
              ? options.autoOpen
              : globalConfig.autoOpen || false,
          showWelcome:
            options.showWelcome !== undefined
              ? options.showWelcome
              : globalConfig.showWelcome !== undefined
                ? globalConfig.showWelcome
                : true,
        },
        options
      );

      this.config = (window as any).HKUChatbotConfig || null;
      this.isOpen = false;
      this.sessionId = "session_" + Math.random().toString(36).substring(2, 15);
      this.pollingInterval = null;
      this.isConnecting = false;
      this.lastQueuePosition = null;
      this.init();
    }

    private init() {
      this.injectStyles();
      this.createWidget();
      this.bindEvents();
      localStorage.setItem("chatSessionId", this.sessionId);
      if (this.options.debug) {
        console.log(
          "HKU Chatbot Widget initialized with options:",
          this.options
        );
        console.log("Session ID:", this.sessionId);
        if (this.config) {
          console.log("Global config detected:", this.config);
        }
      }
      if (this.options.autoOpen) {
        setTimeout(() => this.openChat(), 1000);
      }
    }

    private injectStyles() {
      const styleSheet = document.createElement("style");
      styleSheet.textContent = `
        /* HKU Chatbot Widget Styles */
        .hku-chatbot-widget {
          --primary-color: #171717;
          --bg-gradient: linear-gradient(135deg, #181818 0%, #1d1d1d 50%, #202020 100%);
          --text-color: #ffffff;
          --text-secondary: #888888;
          --border-radius: 20px;
          --message-bg: rgba(26, 26, 26, 0.6);
          --shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          --header-bg: rgba(23, 23, 23, 0.8);
          --input-bg: #313131;
          --button-bg: #282828;
          --gradient-primary: linear-gradient(90deg, #4776e6, #8e54e9, #4776e6);
          font-family: "Inter", "Segoe UI", Arial, sans-serif;
          position: fixed;
          z-index: 999999;
          pointer-events: none;
        }

        .hku-chatbot-widget * {
          box-sizing: border-box;
        }

        /* Toggle Button */
        .hku-chatbot-toggle {
          position: fixed;
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #4776e6, #8e54e9);
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(71, 118, 230, 0.3);
          transition: all 0.3s ease;
          z-index: 1000000;
          pointer-events: all;
        }

        .hku-chatbot-toggle:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(71, 118, 230, 0.4);
        }

        .hku-chatbot-toggle:active {
          transform: translateY(0);
        }

        /* Position variants */
        .hku-chatbot-widget.bottom-right .hku-chatbot-toggle {
          bottom: 20px;
          right: 20px;
        }

        .hku-chatbot-widget.bottom-left .hku-chatbot-toggle {
          bottom: 20px;
          left: 20px;
        }

        /* Chat Container */
        .hku-chatbot-container {
          position: fixed;
          width: 400px;
          height: 600px;
          max-height: calc(100vh - 120px);
          background: var(--bg-gradient);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
          z-index: 999999;
          opacity: 0;
          transform: translateY(20px) scale(0.95);
          pointer-events: none;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .hku-chatbot-container.show {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: all;
        }

        /* Position variants for container */
        .hku-chatbot-widget.bottom-right .hku-chatbot-container {
          bottom: 90px;
          right: 20px;
        }

        .hku-chatbot-widget.bottom-left .hku-chatbot-container {
          bottom: 90px;
          left: 20px;
        }

        /* Header */
        .hku-chatbot-header {
          background: linear-gradient(to bottom, rgba(28, 28, 28, 0.95), rgba(25, 25, 25, 0.9));
          padding: 0.75rem 1rem;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: var(--shadow);
          backdrop-filter: blur(10px);
          border-radius: 20px 20px 0 0;
        }

        .hku-chatbot-header h1 {
          color: var(--text-color);
          font-size: 1.1rem;
          font-weight: 600;
          margin: 0;
          text-align: center;
          grid-column: 2;
        }

        .hku-chatbot-header-buttons {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 0.4rem;
          grid-column: 3;
        }

        .hku-chatbot-header-button {
          padding: 0.5rem 0.8rem;
          background-color: #161a20;
          border: none;
          color: #ffffff;
          border-radius: 100px;
          font-family: "Inter", "Segoe UI", sans-serif;
          font-weight: 500;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: all 0.3s ease;
          z-index: 1;
          font-size: 0.8rem;
          white-space: nowrap;
          line-height: 1;
          min-width: 80px;
        }

        .hku-chatbot-header-button::before {
          content: "";
          position: absolute;
          inset: 0;
          padding: 2px;
          background: var(--gradient-primary);
          border-radius: 100px;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          animation: hku-rotate-gradient 3s linear infinite;
        }

        .hku-chatbot-header-button::after {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--gradient-primary);
          border-radius: 100px;
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }

        .hku-chatbot-header-button:hover::after {
          opacity: 1;
        }

        .hku-chatbot-fullscreen-button {
          width: 24px;
          height: 24px;
          background: var(--input-bg);
          border: none;
          border-radius: 8px;
          color: var(--text-color);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          margin-left: 0.3rem;
          min-width: auto;
          padding: 0;
        }

        .hku-chatbot-fullscreen-button:hover {
          background: #3a3a3a;
          transform: scale(1.05);
        }

        /* Messages */
        .hku-chatbot-messages {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          scroll-behavior: smooth;
          max-width: 100%;
          padding: 0.5rem;
          padding-bottom: 0.5rem;
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          -ms-overflow-style: none;
          box-sizing: border-box;
        }

        .hku-chatbot-messages::-webkit-scrollbar {
          width: 6px;
        }

        .hku-chatbot-messages::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        .hku-chatbot-messages::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .hku-chatbot-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* Firefox scrollbar styling */
        .hku-chatbot-messages {
          scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
        }

        /* Message Styles */
        .hku-chatbot-message-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          opacity: 0;
          animation: hku-fade-in 0.3s ease forwards;
          max-width: 100%;
          box-sizing: border-box;
        }

        .hku-chatbot-message {
          max-width: 100%;
          padding: 0.4rem 0.8rem;
          border-radius: var(--border-radius);
          position: relative;
          line-height: 1.4;
          font-size: 0.8rem;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: break-word;
          hyphens: auto;
          padding-left: 36px;
          box-sizing: border-box;
        }

        .hku-chatbot-bot-wrapper {
          align-self: flex-start;
          max-width: 85%;
          width: 100%;
          box-sizing: border-box;
        }

        .hku-chatbot-bot-message {
          color: var(--text-color);
          align-self: flex-start;
          border-bottom-left-radius: 4px;
          margin: 0;
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }

        .hku-chatbot-user-wrapper {
          align-self: flex-end;
          max-width: 85%;
          width: 100%;
          box-sizing: border-box;
        }

        .hku-chatbot-user-message {
          background-color: var(--input-bg);
          color: var(--text-color);
          align-self: flex-end;
          border-bottom-right-radius: 4px;
          box-shadow: var(--shadow);
          margin: 0;
          text-align: right;
          padding-left: 0.8rem;
          margin-right: 0.8rem;
        }

        /* Input Area */
        .hku-chatbot-input-area {
          position: relative;
          width: 100%;
          background-color: transparent;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 0;
        }

        .hku-chatbot-input-container {
          display: flex;
          gap: 0.4rem;
          background-color: var(--input-bg);
          padding: 0.3rem;
          border-radius: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
          align-items: center;
          width: 100%;
          max-width: 100%;
          margin: 0;
        }

        .hku-chatbot-input {
          flex: 1;
          padding: 0.6rem 1rem;
          border: none;
          font-size: 0.8rem;
          background-color: transparent;
          color: var(--text-color);
          transition: all 0.2s;
          outline: none;
          font-family: inherit;
        }

        .hku-chatbot-input::placeholder {
          color: var(--text-secondary);
        }

        .hku-chatbot-send-button {
          padding: 0.6rem 1.2rem;
          background-color: var(--button-bg);
          border: none;
          color: #ffffff;
          border-radius: 16px;
          font-family: "Inter", "Segoe UI", sans-serif;
          font-weight: 500;
          font-size: 0.8rem;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          cursor: pointer;
          transition: all 0.3s ease;
          z-index: 1;
        }

        /* Typing Indicator */
        .hku-chatbot-typing-indicator {
          display: none;
          align-self: flex-start;
          padding: 0.25rem 1.5rem;
          border-radius: var(--border-radius);
          border-bottom-left-radius: 4px;
          color: var(--text-color);
          font-size: 0.8rem;
          animation: hku-fade-in 0.3s ease;
          max-width: 75%;
          width: auto;
          margin: 0.25rem 0;
        }

        .hku-chatbot-typing-indicator.visible {
          display: flex;
          align-items: center;
        }

        .hku-chatbot-typing-indicator .dots {
          display: flex;
          gap: 2px;
        }

        .hku-chatbot-typing-indicator .dots span {
          font-size: 0.55rem;
          line-height: 0.7;
          color: white;
          animation: hku-bounce 1s ease infinite;
          display: inline-block;
        }

        .hku-chatbot-typing-indicator .dots span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .hku-chatbot-typing-indicator .dots span:nth-child(3) {
          animation-delay: 0.4s;
        }

        /* Suggestion buttons */
        .hku-chatbot-suggestion-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
          padding: 1rem;
          margin: 1rem 0;
          max-width: 700px;
          width: 100%;
          align-self: center;
        }

        .hku-chatbot-suggestion-button {
          background-color: var(--input-bg);
          color: var(--text-color);
          border: none;
          border-radius: var(--border-radius);
          padding: 1rem 1.25rem;
          font-size: 0.8rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: var(--shadow);
          height: 4.5rem;
          line-height: 1.4;
          white-space: normal;
          display: flex;
          align-items: center;
          width: 100%;
          font-family: inherit;
        }

        /* Action buttons */
        .hku-chatbot-button-container {
          display: flex;
          gap: 0px;
          margin-top: 4px;
        }

        .hku-chatbot-bot-wrapper .hku-chatbot-button-container {
          align-self: flex-start;
        }

        .hku-chatbot-user-wrapper .hku-chatbot-button-container {
          align-self: flex-end;
        }

        .hku-chatbot-action-button {
          background: none;
          border: none;
          padding: 6px;
          cursor: pointer;
          color: var(--text-color);
          opacity: 0.7;
          border-radius: 6px;
          transition: transform 0.2s ease, background-color 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hku-chatbot-action-button:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.1);
        }

        .hku-chatbot-action-button.active,
        .hku-chatbot-action-button.copied {
          opacity: 1;
          color: #4776e6;
        }

        .hku-chatbot-action-button:active {
          transform: scale(0.95);
          color: #4776e6;
        }

        .hku-chatbot-action-button svg {
          transition: transform 0.2s ease, color 0.1s ease;
        }

        .hku-chatbot-action-button:hover svg {
          transform: scale(1.1);
        }

        .hku-chatbot-action-button.copied svg,
        .hku-chatbot-action-button.active svg {
          color: #4776e6;
          transition: color 0.1s ease;
        }

        /* Scroll to bottom button */
        .hku-chatbot-scroll-to-bottom {
          position: absolute;
          bottom: 80px;
          right: 20px;
          width: 40px;
          height: 40px;
          background-color: var(--button-bg);
          border: none;
          border-radius: 50%;
          color: var(--text-color);
          cursor: pointer;
          box-shadow: var(--shadow);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: translateY(10px);
          pointer-events: none;
          z-index: 10;
        }

        .hku-chatbot-scroll-to-bottom.visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: all;
        }

        .hku-chatbot-scroll-to-bottom:hover {
          background-color: var(--input-bg);
          transform: translateY(-2px);
        }

        /* Chat container main */
        .hku-chatbot-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .hku-chatbot-chat-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        /* Connecting Indicator */
        .hku-chatbot-connecting-indicator {
          display: none;
          align-self: flex-start;
          padding: 0.25rem 0.5rem;
          border-radius: var(--border-radius);
          border-bottom-left-radius: 4px;
          color: var(--text-color);
          font-size: 0.8rem;
          animation: hku-fade-in 0.3s ease;
          max-width: 75%;
          width: auto;
          margin: 0.25rem 0;
        }

        .hku-chatbot-connecting-indicator.visible {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .hku-chatbot-connecting-indicator .dots {
          display: flex;
          gap: 2px;
        }

        .hku-chatbot-connecting-indicator .dots span {
          font-size: 0.7rem;
          line-height: 0.7;
          color: white;
          animation: hku-bounce 1s ease infinite;
          display: inline-block;
        }

        .hku-chatbot-connecting-indicator .dots span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .hku-chatbot-connecting-indicator .dots span:nth-child(3) {
          animation-delay: 0.4s;
        }

        /* Code blocks and inline code */
        .hku-code-block {
          background-color: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 1rem;
          margin: 0.5rem 0;
          overflow-x: auto;
          font-family: 'Courier New', monospace;
          font-size: 0.75rem;
          line-height: 1.4;
          white-space: pre-wrap;
          word-break: break-all;
          max-width: 100%;
          box-sizing: border-box;
        }

        .hku-inline-code {
          background-color: rgba(255, 255, 255, 0.1);
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 0.85em;
          word-break: break-all;
          overflow-wrap: break-word;
        }

        /* Links in bot messages */
        .hku-chatbot-bot-message a {
          color: #4a9eff;
          text-decoration: none;
          border-bottom: 1px solid rgba(74, 158, 255, 0.3);
          transition: all 0.2s ease;
          padding: 0 1px;
          word-break: break-all;
          overflow-wrap: break-word;
          hyphens: auto;
        }

        .hku-chatbot-bot-message a:hover {
          color: #66b3ff;
          border-bottom-color: #66b3ff;
          background-color: rgba(74, 158, 255, 0.1);
        }

        /* Message icons */
        .hku-chatbot-message::before {
          content: "";
          position: absolute;
          left: 6px;
          top: 50%;
          transform: translateY(-50%);
          width: 20px;
          height: 20px;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          filter: brightness(0) invert(1);
        }

        .hku-chatbot-bot-message::before {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M14 2C14 2.74028 13.5978 3.38663 13 3.73244V4H20C21.6569 4 23 5.34315 23 7V19C23 20.6569 21.6569 22 20 22H4C2.34315 22 1 20.6569 1 19V7C1 5.34315 2.34315 4 4 4H11V3.73244C10.4022 3.38663 10 2.74028 10 2C10 0.895431 10.8954 0 12 0C13.1046 0 14 0.895431 14 2ZM4 6H11H13H20C20.5523 6 21 6.44772 21 7V19C21 19.5523 20.5523 20 20 20H4C3.44772 20 3 19.5523 3 19V7C3 6.44772 3.44772 6 4 6ZM15 11.5C15 10.6716 15.6716 10 16.5 10C17.3284 10 18 10.6716 18 11.5C18 12.3284 17.3284 13 16.5 13C15.6716 13 15 12.3284 15 11.5ZM16.5 8C14.567 8 13 9.567 13 11.5C13 13.433 14.567 15 16.5 15C18.433 15 20 13.433 20 11.5C20 9.567 18.433 8 16.5 8ZM7.5 10C6.67157 10 6 10.6716 6 11.5C6 12.3284 6.67157 13 7.5 13C8.32843 13 9 12.3284 9 11.5C9 10.6716 8.32843 10 7.5 10ZM4 11.5C4 9.567 5.567 8 7.5 8C9.433 8 11 9.567 11 11.5C11 13.433 9.433 15 7.5 15C5.567 15 4 13.433 4 11.5ZM10.8944 16.5528C10.6474 16.0588 10.0468 15.8586 9.55279 16.1056C9.05881 16.3526 8.85858 16.9532 9.10557 17.4472C9.68052 18.5971 10.9822 19 12 19C13.0178 19 14.3195 18.5971 14.8944 17.4472C15.1414 16.9532 14.9412 16.3526 14.4472 16.1056C13.9532 15.8586 13.3526 16.0588 13.1056 16.5528C13.0139 16.7362 12.6488 17 12 17C11.3512 17 10.9861 16.7362 10.8944 16.5528Z' fill='white'/%3E%3C/svg%3E");
          opacity: 0.6;
          top: auto;
          bottom: 6px;
          transform: none;
        }

        .hku-chatbot-human-wrapper {
          align-self: flex-start;
        }

        .hku-chatbot-human-message {
          background-color: var(--input-bg);
          color: var(--text-color);
          align-self: flex-start;
          border-bottom-left-radius: 4px;
          box-shadow: var(--shadow);
          margin: 0;
          text-align: left;
        }

        .hku-chatbot-human-message::before {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='12' cy='8' r='5' fill='white'/%3E%3Cpath d='M20 21a8 8 0 1 0-16 0h16z' fill='white'/%3E%3C/svg%3E");
          opacity: 0.6;
          top: auto;
          bottom: 6px;
          transform: none;
        }

        /* Send button gradient animation */
        .hku-chatbot-send-button::before {
          content: "";
          position: absolute;
          inset: 0;
          padding: 2px;
          background: var(--gradient-primary);
          border-radius: 100px;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          animation: hku-rotate-gradient 3s linear infinite;
        }

        .hku-chatbot-send-button::after {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--gradient-primary);
          border-radius: 100px;
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }

        .hku-chatbot-send-button:hover::after {
          opacity: 1;
        }

        @keyframes hku-rotate-gradient {
          0% { background: linear-gradient(0deg, #4776e6, #8e54e9, #4776e6); }
          25% { background: linear-gradient(90deg, #8e54e9, #4776e6, #8e54e9); }
          50% { background: linear-gradient(180deg, #4776e6, #8e54e9, #4776e6); }
          75% { background: linear-gradient(270deg, #8e54e9, #4776e6, #8e54e9); }
          100% { background: linear-gradient(360deg, #4776e6, #8e54e9, #4776e6); }
        }

        /* Animations */
        @keyframes hku-fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes hku-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        /* Mobile and responsive design */
        /* Tablet and small laptop screens */
        @media (max-width: 1024px) {
          .hku-chatbot-container {
            width: 360px;
            height: 550px;
            max-height: calc(100vh - 100px);
          }

          .hku-chatbot-toggle {
            width: 56px;
            height: 56px;
          }

          .hku-chatbot-header h1 {
            font-size: 1.05rem;
          }

          .hku-chatbot-header-button {
            padding: 0.45rem 0.75rem;
            font-size: 0.75rem;
            min-width: 75px;
          }

          .hku-chatbot-input-area {
            padding: 0.45rem;
          }
        }

        /* Small tablets and large phones in landscape */
        @media (max-width: 768px) {
          .hku-chatbot-container {
            width: 340px;
            height: 500px;
            max-height: calc(100vh - 80px);
          }

          .hku-chatbot-toggle {
            width: 52px;
            height: 52px;
          }

          .hku-chatbot-header {
            padding: 0.65rem 0.9rem;
          }

          .hku-chatbot-header h1 {
            font-size: 1rem;
          }

          .hku-chatbot-header-button {
            padding: 0.4rem 0.7rem;
            font-size: 0.72rem;
            min-width: 70px;
          }

          .hku-chatbot-fullscreen-button {
            width: 22px;
            height: 22px;
          }

          .hku-chatbot-input-area {
            padding: 0.4rem;
          }
        }

        /* Large phones */
        @media (max-width: 600px) {
          .hku-chatbot-container {
            width: 320px;
            height: 480px;
            max-height: calc(100vh - 70px);
          }

          .hku-chatbot-widget.bottom-right .hku-chatbot-container {
            bottom: 80px;
            right: 10px;
          }

          .hku-chatbot-widget.bottom-left .hku-chatbot-container {
            bottom: 80px;
            left: 10px;
          }

          .hku-chatbot-toggle {
            width: 48px;
            height: 48px;
          }

          .hku-chatbot-widget.bottom-right .hku-chatbot-toggle {
            bottom: 15px;
            right: 15px;
          }

          .hku-chatbot-widget.bottom-left .hku-chatbot-toggle {
            bottom: 15px;
            left: 15px;
          }

          .hku-chatbot-header {
            padding: 0.6rem 0.8rem;
          }

          .hku-chatbot-header h1 {
            font-size: 0.95rem;
          }

          .hku-chatbot-header-button {
            padding: 0.35rem 0.65rem;
            font-size: 0.7rem;
            min-width: 65px;
          }

          .hku-chatbot-fullscreen-button {
            width: 20px;
            height: 20px;
          }

          .hku-chatbot-input-area {
            padding: 0.35rem;
          }
        }

        /* Mobile phones */
        @media (max-width: 480px) {
          .hku-chatbot-container {
            width: calc(100vw - 16px);
            height: calc(100vh - 120px);
            max-height: calc(100vh - 120px);
          }

          .hku-chatbot-widget.bottom-right .hku-chatbot-container {
            bottom: 80px;
            right: 8px;
            left: 8px;
          }

          .hku-chatbot-widget.bottom-left .hku-chatbot-container {
            bottom: 80px;
            left: 8px;
            right: 8px;
          }

          .hku-chatbot-toggle {
            width: 44px;
            height: 44px;
          }

          .hku-chatbot-widget.bottom-right .hku-chatbot-toggle {
            bottom: 12px;
            right: 12px;
          }

          .hku-chatbot-widget.bottom-left .hku-chatbot-toggle {
            bottom: 12px;
            left: 12px;
          }

          .hku-chatbot-header {
            padding: 0.55rem 0.75rem;
          }

          .hku-chatbot-header h1 {
            font-size: 0.9rem;
          }

          .hku-chatbot-header-button {
            padding: 0.3rem 0.6rem;
            font-size: 0.68rem;
            min-width: 60px;
          }

          .hku-chatbot-fullscreen-button {
            width: 18px;
            height: 18px;
          }

          .hku-chatbot-input-area {
            padding: 0.3rem;
          }
        }

        /* Very small screens */
        @media (max-width: 360px) {
          .hku-chatbot-container {
            width: calc(100vw - 12px);
            height: calc(100vh - 110px);
            max-height: calc(100vh - 110px);
          }

          .hku-chatbot-widget.bottom-right .hku-chatbot-container,
          .hku-chatbot-widget.bottom-left .hku-chatbot-container {
            bottom: 70px;
            right: 6px;
            left: 6px;
          }

          .hku-chatbot-toggle {
            width: 40px;
            height: 40px;
          }

          .hku-chatbot-widget.bottom-right .hku-chatbot-toggle {
            bottom: 10px;
            right: 10px;
          }

          .hku-chatbot-widget.bottom-left .hku-chatbot-toggle {
            bottom: 10px;
            left: 10px;
          }

          .hku-chatbot-header {
            padding: 0.5rem 0.75rem;
          }

          .hku-chatbot-header h1 {
            font-size: 0.85rem;
          }

          .hku-chatbot-header-button {
            padding: 0.25rem 0.5rem;
            font-size: 0.65rem;
            min-width: 55px;
          }

          .hku-chatbot-fullscreen-button {
            width: 16px;
            height: 16px;
          }

          .hku-chatbot-input-area {
            padding: 0.25rem;
          }

          .hku-chatbot-messages {
            padding: 0.4rem;
          }
        }

        /* Enhanced Markdown Styles */
        .hku-chatbot-message .hku-blockquote {
          border-left: 4px solid #ddd;
          padding-left: 12px;
          margin: 12px 0;
          color: #666;
          font-style: italic;
        }

        .hku-chatbot-message .hku-hr {
          border: none;
          border-top: 1px solid #ddd;
          margin: 16px 0;
        }

        .hku-chatbot-message .hku-h1,
        .hku-chatbot-message .hku-h2,
        .hku-chatbot-message .hku-h3,
        .hku-chatbot-message .hku-h4,
        .hku-chatbot-message .hku-h5,
        .hku-chatbot-message .hku-h6 {
          margin: 16px 0 8px 0;
          font-weight: bold;
          line-height: 1.2;
        }

        .hku-chatbot-message .hku-h1 { font-size: 1.8em; }
        .hku-chatbot-message .hku-h2 { font-size: 1.6em; }
        .hku-chatbot-message .hku-h3 { font-size: 1.4em; }
        .hku-chatbot-message .hku-h4 { font-size: 1.2em; }
        .hku-chatbot-message .hku-h5 { font-size: 1.1em; }
        .hku-chatbot-message .hku-h6 { font-size: 1em; }

        .hku-chatbot-message .hku-table {
          width: 100%;
          margin: 1em 0;
          border-collapse: collapse;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.2);
          max-width: 100%;
          table-layout: fixed;
          overflow-wrap: break-word;
        }

        .hku-chatbot-message .hku-table-wrapper {
          overflow-x: auto;
          max-width: 100%;
          margin: 12px 0;
        }

        .hku-chatbot-message .hku-table-header {
          background: rgba(71, 118, 230, 0.2);
          padding: 0.75em;
          text-align: left;
          font-weight: 600;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .hku-chatbot-message .hku-table-cell {
          padding: 0.75em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .hku-chatbot-message .hku-table-row:last-child .hku-table-cell {
          border-bottom: none;
        }

        .hku-chatbot-message .hku-table-row:nth-child(even) {
          background: rgba(255, 255, 255, 0.05);
        }

        .hku-chatbot-message .hku-list,
        .hku-chatbot-message .hku-ordered-list {
          margin: 12px 0;
          padding-left: 20px;
        }

        .hku-chatbot-message .hku-list-item {
          margin: 4px 0;
        }

        .hku-chatbot-message .hku-paragraph {
          margin: 8px 0;
          line-height: 1.4;
        }

        /* Responsive table and content styles */
        @media (max-width: 1024px) {
          .hku-chatbot-input-container {
            padding: 0.25rem;
          }

          .hku-chatbot-input {
            padding: 0.55rem 0.9rem;
            font-size: 0.78rem;
          }

          .hku-chatbot-send-button {
            padding: 0.55rem 1.1rem;
            font-size: 0.78rem;
          }
        }

        @media (max-width: 768px) {
          .hku-chatbot-message {
            font-size: 0.75rem;
          }

          .hku-chatbot-message .hku-table {
            font-size: 0.75rem;
          }
          
          .hku-chatbot-message .hku-table-header,
          .hku-chatbot-message .hku-table-cell {
            padding: 0.5rem 0.3rem;
          }

          .hku-chatbot-suggestion-button {
            padding: 0.8rem 1rem;
            font-size: 0.75rem;
            height: 4rem;
          }

          .hku-chatbot-input-container {
            padding: 0.25rem;
          }

          .hku-chatbot-input {
            padding: 0.5rem 0.85rem;
            font-size: 0.76rem;
          }

          .hku-chatbot-send-button {
            padding: 0.5rem 1.05rem;
            font-size: 0.76rem;
          }
        }

        @media (max-width: 600px) {
          .hku-chatbot-input-container {
            padding: 0.22rem;
          }

          .hku-chatbot-input {
            padding: 0.45rem 0.8rem;
            font-size: 0.74rem;
          }

          .hku-chatbot-send-button {
            padding: 0.45rem 1rem;
            font-size: 0.74rem;
          }
        }

        @media (max-width: 480px) {
          .hku-chatbot-message {
            font-size: 0.7rem;
            padding: 0.3rem 0.6rem;
            padding-left: 30px;
          }

          .hku-chatbot-message::before {
            width: 18px;
            height: 18px;
            left: 4px;
          }

          .hku-chatbot-message .hku-table {
            font-size: 0.65rem;
          }
          
          .hku-chatbot-message .hku-table-header,
          .hku-chatbot-message .hku-table-cell {
            padding: 0.4rem 0.2rem;
          }

          .hku-chatbot-suggestion-grid {
            padding: 0.75rem;
            gap: 0.5rem;
          }

          .hku-chatbot-suggestion-button {
            padding: 0.7rem 0.8rem;
            font-size: 0.7rem;
            height: 3.5rem;
          }

          .hku-chatbot-input-container {
            padding: 0.2rem;
          }

          .hku-chatbot-input {
            font-size: 0.72rem;
            padding: 0.4rem 0.75rem;
          }

          .hku-chatbot-send-button {
            padding: 0.4rem 0.9rem;
            font-size: 0.72rem;
          }
        }

        @media (max-width: 360px) {
          .hku-chatbot-message {
            font-size: 0.65rem;
            padding: 0.25rem 0.5rem;
            padding-left: 26px;
          }

          .hku-chatbot-message::before {
            width: 16px;
            height: 16px;
            left: 3px;
          }

          .hku-chatbot-suggestion-button {
            padding: 0.6rem 0.7rem;
            font-size: 0.65rem;
            height: 3rem;
          }

          .hku-chatbot-input-container {
            padding: 0.18rem;
          }

          .hku-chatbot-input {
            font-size: 0.68rem;
            padding: 0.35rem 0.65rem;
          }

          .hku-chatbot-send-button {
            padding: 0.35rem 0.75rem;
            font-size: 0.68rem;
          }
        }
      `;
      document.head.appendChild(styleSheet);
    }

    private createWidget(): void {
      const widget = document.createElement("div");
      widget.className = `hku-chatbot-widget ${this.options.position}`;
      widget.innerHTML = `
        <button class="hku-chatbot-toggle" id="hku-chatbot-toggle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3c5.5 0 10 3.58 10 8s-4.5 8-10 8c-1.24 0-2.43-.18-3.53-.5L5 21l1.53-3.47C5.01 16.74 2 14.49 2 11c0-4.42 4.5-8 10-8z"/>
          </svg>
        </button>
        <div class="hku-chatbot-container" id="hku-chatbot-container">
          <div class="hku-chatbot-header">
            <div></div>
            <h1>HKU ITS Chatbot</h1>
            <div class="hku-chatbot-header-buttons">
              <button class="hku-chatbot-header-button" id="hku-chatbot-email-btn">Email ITS</button>
              <button class="hku-chatbot-header-button" id="hku-chatbot-staff-btn">Chat With Staff</button>
              <button class="hku-chatbot-fullscreen-button" id="hku-chatbot-fullscreen-btn" title="Open in fullscreen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="hku-chatbot-main">
            <div class="hku-chatbot-chat-container">
              <div class="hku-chatbot-messages" id="hku-chatbot-messages"></div>
              <button class="hku-chatbot-scroll-to-bottom" id="hku-chatbot-scroll-to-bottom">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                </svg>
              </button>
              <div class="hku-chatbot-typing-indicator" id="hku-chatbot-typing">
                <div class="dots"><span>● </span><span>● </span><span>● </span></div>
              </div>
              <div class="hku-chatbot-connecting-indicator" id="hku-chatbot-connecting">
                Connecting
                <div class="dots"><span>. </span><span>. </span><span>. </span></div>
              </div>
              <div class="hku-chatbot-input-area">
                <div class="hku-chatbot-input-container">
                  <input type="text" class="hku-chatbot-input" id="hku-chatbot-input" placeholder="Ask me anything..." maxlength="500" autocomplete="off" />
                  <button class="hku-chatbot-send-button" id="hku-chatbot-send">Send</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(widget);
      this.widget = widget;

      this.elements = {
        toggle: widget.querySelector("#hku-chatbot-toggle"),
        container: widget.querySelector("#hku-chatbot-container"),
        messages: widget.querySelector("#hku-chatbot-messages"),
        input: widget.querySelector("#hku-chatbot-input"),
        sendButton: widget.querySelector("#hku-chatbot-send"),
        scrollToBottomBtn: widget.querySelector(
          "#hku-chatbot-scroll-to-bottom"
        ),
        typingIndicator: widget.querySelector("#hku-chatbot-typing"),
        connectingIndicator: widget.querySelector("#hku-chatbot-connecting"),
        emailButton: widget.querySelector("#hku-chatbot-email-btn"),
        staffButton: widget.querySelector("#hku-chatbot-staff-btn"),
        fullscreenButton: widget.querySelector("#hku-chatbot-fullscreen-btn"),
      };
    }

    private isInActiveSession(): boolean {
      return this.pollingInterval !== null || this.isConnecting;
    }

    private bindEvents(): void {
      this.elements.toggle.addEventListener("click", () => this.toggle());
      this.elements.fullscreenButton.addEventListener("click", () =>
        this.openFullscreen()
      );
      this.elements.sendButton.addEventListener("click", () =>
        this.sendMessage()
      );

      this.elements.input.addEventListener("keypress", (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      this.elements.emailButton.addEventListener("click", () => {
        this.elements.input.value = "Email ITS";
        this.elements.input.focus();
        this.sendMessage();
      });

      this.elements.staffButton.addEventListener("click", () => {
        this.elements.input.value = "Chat with ITS Staff";
        this.elements.input.focus();
        this.sendMessage();
      });

      this.elements.scrollToBottomBtn.addEventListener("click", () => {
        this.scrollToBottom();
        this.elements.scrollToBottomBtn.classList.remove("visible");
      });

      this.elements.messages.addEventListener("scroll", () => {
        const { scrollTop, scrollHeight, clientHeight } =
          this.elements.messages;
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;

        if (isNearBottom) {
          this.elements.scrollToBottomBtn.classList.remove("visible");
        } else {
          this.elements.scrollToBottomBtn.classList.add("visible");
        }
      });

      // Click outside to close functionality with improved detection
      let mouseDownTarget: HTMLElement | null = null;
      let mouseDownTime = 0;

      // Track where the mouse was pressed down
      document.addEventListener("mousedown", (e: MouseEvent) => {
        mouseDownTarget = e.target as HTMLElement;
        mouseDownTime = Date.now();
      });

      // Only close on click (mousedown + mouseup in same general area)
      document.addEventListener("mouseup", (e: MouseEvent) => {
        if (!this.isOpen || !mouseDownTarget) return;

        const mouseUpTarget = e.target as HTMLElement;
        const timeDiff = Date.now() - mouseDownTime;

        // Don't close if:
        // 1. Mouse was held down for too long (likely text selection)
        // 2. Mouse down and up targets are very different (dragging)
        // 3. There's currently selected text
        const hasSelection = window.getSelection()?.toString().length! > 0;
        const isLongPress = timeDiff > 300; // 300ms threshold
        const isDragAction =
          mouseDownTarget !== mouseUpTarget &&
          !mouseDownTarget.contains(mouseUpTarget) &&
          !mouseUpTarget.contains(mouseDownTarget);

        if (hasSelection || isLongPress || isDragAction) {
          return;
        }

        // Check if both mousedown and mouseup were outside the widget
        const isMouseDownOutside =
          !this.elements.container?.contains(mouseDownTarget) &&
          !this.elements.toggle?.contains(mouseDownTarget);
        const isMouseUpOutside =
          !this.elements.container?.contains(mouseUpTarget) &&
          !this.elements.toggle?.contains(mouseUpTarget);

        if (isMouseDownOutside && isMouseUpOutside) {
          // Add a small delay to allow other events to process
          setTimeout(() => {
            if (this.isOpen) {
              this.closeChat();
            }
          }, 50);
        }

        // Reset tracking
        mouseDownTarget = null;
        mouseDownTime = 0;
      });

      // Handle page refresh/close during active session
      window.addEventListener("beforeunload", (event) => {
        if (this.isInActiveSession()) {
          // Show confirmation dialog (don't send disconnect message yet)
          event.preventDefault();
          event.returnValue =
            "You are currently in a queue or active chat. Are you sure you want to leave?";
          return event.returnValue;
        }
      });

      // Send disconnect message only when page is actually being unloaded
      window.addEventListener("pagehide", () => {
        if (this.isInActiveSession()) {
          // Send disconnect message when page is actually being unloaded
          this.sendDisconnectMessage();
        }
      });

      // Also listen to unload as fallback
      window.addEventListener("unload", () => {
        if (this.isInActiveSession()) {
          // Send disconnect message when page is actually being unloaded
          this.sendDisconnectMessage();
        }
      });
    }

    private openChat(): void {
      this.isOpen = true;
      this.elements.container.classList.add("show");
      this.elements.input.focus();

      if (
        this.elements.messages.children.length === 0 &&
        this.options.showWelcome
      ) {
        const welcomeMessage =
          this.config && this.config.getMessage
            ? this.config.getMessage("welcome") ||
              "Hello! I'm the HKU ITS virtual assistant. How can I help you today?"
            : "Hello! I'm the HKU ITS virtual assistant. How can I help you today?";

        this.addMessage(welcomeMessage, "bot");

        if (
          !this.config ||
          (this.config.isFeatureEnabled &&
            this.config.isFeatureEnabled("suggestionButtons"))
        ) {
          this.addSuggestionButtons();
        }
      }
    }

    private closeChat(): void {
      this.isOpen = false;
      this.elements.container.classList.remove("show");
      this.stopPolling();
      this.hideConnectingIndicator();
    }

    private toggle(): void {
      if (this.isOpen) {
        this.closeChat();
      } else {
        this.openChat();
      }
    }

    private async sendMessage(): Promise<void> {
      const message = this.elements.input.value.trim();
      if (!message) return;

      this.elements.input.value = "";
      this.elements.sendButton.disabled = true;
      this.addMessage(message, "user");
      this.showTypingIndicator();

      try {
        if (this.options.debug) {
          console.log("Sending message:", message);
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (this.options.apiKey) {
          headers["Authorization"] = `Bearer ${this.options.apiKey}`;
        }

        const response = await fetch(this.options.chatUrl!, {
          method: "POST",
          headers,
          body: JSON.stringify({ message, sessionId: this.sessionId }),
        });

        if (this.options.debug) {
          console.log("Response status:", response.status);
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (this.options.debug) {
          console.log("API Response:", data);
        }

        this.hideTypingIndicator();

        const botResponse =
          data.output ||
          data.response ||
          data.message ||
          (this.config && this.config.getMessage
            ? this.config.getMessage("error")
            : null) ||
          "Sorry, I encountered an error. Please try again.";

        if (
          botResponse.includes("Please wait. Type 'Cancel' to cancel the queue")
        ) {
          if (this.options.debug) {
            console.log("Queue message detected - starting polling");
          }
          this.startPolling();
        } else if (botResponse === "Cancelled") {
          if (this.options.debug) {
            console.log("Stopping polling due to cancellation");
          }
          this.stopPolling();
          this.hideConnectingIndicator();
        }

        this.addMessage(botResponse, "bot");
      } catch (error) {
        console.error("Error sending message:", error);
        this.hideTypingIndicator();

        const errorMessage =
          this.config && this.config.getMessage
            ? this.config.getMessage("error") ||
              "Sorry, I encountered an error. Please try again later."
            : "Sorry, I encountered an error. Please try again later.";

        this.addMessage(errorMessage, "bot");
      } finally {
        this.elements.sendButton.disabled = false;
      }
    }

    // Additional methods need to be implemented...
    private addMessage(text: string, sender: "user" | "bot" | "human"): void {
      if (!this.elements || !this.elements.messages) return;

      const messageWrapper = document.createElement("div");
      messageWrapper.className = `hku-chatbot-message-wrapper hku-chatbot-${sender}-wrapper`;

      const messageDiv = document.createElement("div");
      messageDiv.className = `hku-chatbot-message hku-chatbot-${sender}-message`;

      // Parse markdown for bot messages
      if (sender === "bot") {
        messageDiv.innerHTML = this.parseMarkdown(text);
      } else {
        messageDiv.textContent = text;
      }

      messageWrapper.appendChild(messageDiv);

      // Only create button container for user and bot messages (not human staff messages)
      if (sender !== "human") {
        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("hku-chatbot-button-container");

        // Copy button for all messages
        const copyButton = document.createElement("button");
        copyButton.classList.add(
          "hku-chatbot-action-button",
          "hku-chatbot-copy-button"
        );
        copyButton.setAttribute(
          "aria-label",
          sender === "user" ? "Copy message to input" : "Copy"
        );
        copyButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4C3 1 2 2 2 3v14h2V3h12V1zm3 4H8C7 5 6 6 6 7v14c0 1 1 2 2 2h11c1 0 2-1 2-2V7c0-1-1-2-2-2zm0 16H8V7h11v14z"/>
        </svg>`;

        copyButton.addEventListener("click", (e: MouseEvent) => {
          e.stopPropagation(); // Prevent event bubbling
          if (sender === "user") {
            // For user messages, copy to input bar
            this.elements.input.value = text;
            this.elements.input.focus();
          }
          // Copy to clipboard
          if (navigator.clipboard) {
            navigator.clipboard
              .writeText(text)
              .then(() => {
                copyButton.classList.add("copied");
                setTimeout(() => copyButton.classList.remove("copied"), 1000);
              })
              .catch(() => {
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
            }
          }
        });

        buttonContainer.appendChild(copyButton);

        // Add like/dislike buttons for bot messages
        if (sender === "bot") {
          const likeButton = document.createElement("button");
          likeButton.classList.add(
            "hku-chatbot-action-button",
            "hku-chatbot-like-button"
          );
          likeButton.setAttribute("aria-label", "Like message");
          likeButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 21h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1 1 2 2 2zM9 9l4.34-4.34L12 10h9v2l-3 7H9V9zM1 9h4v12H1V9z"/>
          </svg>`;

          const dislikeButton = document.createElement("button");
          dislikeButton.classList.add(
            "hku-chatbot-action-button",
            "hku-chatbot-dislike-button"
          );
          dislikeButton.setAttribute("aria-label", "Dislike message");
          dislikeButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm0 12l-4.34 4.34L12 14H3v-2l3-7h9v10zm3-12h4v12h-4V3z"/>
          </svg>`;

          likeButton.addEventListener("click", async (e: MouseEvent) => {
            e.stopPropagation(); // Prevent event bubbling
            if (dislikeButton.classList.contains("active")) {
              dislikeButton.classList.remove("active");
            }
            likeButton.classList.toggle("active");
            if (likeButton.classList.contains("active")) {
              try {
                await fetch(this.options.chatUrl!, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    message: "User_like_jor_nei_gor_output",
                    botResponse: text,
                    sessionId: this.sessionId,
                  }),
                });
                console.log("Like feedback sent to bot");
              } catch (error) {
                console.error("Error sending like feedback:", error);
              }
            }
          });

          dislikeButton.addEventListener("click", async (e: MouseEvent) => {
            e.stopPropagation(); // Prevent event bubbling
            if (likeButton.classList.contains("active")) {
              likeButton.classList.remove("active");
            }
            dislikeButton.classList.toggle("active");
            if (dislikeButton.classList.contains("active")) {
              try {
                await fetch(this.options.chatUrl!, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    message: "user_dislike_jor_nei_gor_answer",
                    botResponse: text,
                    sessionId: this.sessionId,
                  }),
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

        messageWrapper.appendChild(buttonContainer);
      }

      this.elements.messages.appendChild(messageWrapper);
      this.smartScroll(sender, messageWrapper);
    }

    private parseMarkdown(text: string): string {
      // Enhanced markdown parser with support for tables, lists, blockquotes, etc.
      let html = text;

      // Normalize line endings
      html = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

      // Process fenced code blocks first (with language support)
      html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const language = lang
          ? ` data-language="${this.escapeHtml(lang)}"`
          : "";
        return `<pre class="hku-code-block"${language}><code>${this.escapeHtml(code.trim())}</code></pre>`;
      });

      // Process tables
      html = this.parseMarkdownTables(html);

      // Process blockquotes (multi-line support)
      html = html.replace(/^(> .*(?:\n> .*)*)/gm, (match) => {
        const content = match.replace(/^> /gm, "").trim();
        return `<blockquote class="hku-blockquote">${this.parseMarkdownInline(content)}</blockquote>`;
      });

      // Process lists (ordered and unordered, with nesting)
      html = this.parseMarkdownLists(html);

      // Process horizontal rules
      html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr class="hku-hr">');

      // Process headings (ATX style)
      html = html.replace(/^#{6}\s+(.*)$/gm, '<h6 class="hku-h6">$1</h6>');
      html = html.replace(/^#{5}\s+(.*)$/gm, '<h5 class="hku-h5">$1</h5>');
      html = html.replace(/^#{4}\s+(.*)$/gm, '<h4 class="hku-h4">$1</h4>');
      html = html.replace(/^#{3}\s+(.*)$/gm, '<h3 class="hku-h3">$1</h3>');
      html = html.replace(/^#{2}\s+(.*)$/gm, '<h2 class="hku-h2">$1</h2>');
      html = html.replace(/^#{1}\s+(.*)$/gm, '<h1 class="hku-h1">$1</h1>');

      // Process inline formatting
      html = this.parseMarkdownInline(html);

      // Convert remaining line breaks to paragraphs or br tags
      html = this.processLineBreaks(html);

      return html;
    }

    private parseMarkdownInline(text: string): string {
      let html = text;

      // Images (before links to avoid conflicts)
      html = html.replace(
        /!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g,
        (match, alt, src, title) => {
          const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : "";
          return `<img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(alt)}"${titleAttr} class="hku-chatbot-bot-message-image" loading="lazy" onerror="this.style.display='none'">`;
        }
      );

      // Links
      html = html.replace(
        /\[([^\]]+)\]\(([^)]+)(?:\s+"([^"]*)")?\)/g,
        (match, text, url, title) => {
          const titleAttr = title ? ` title="${this.escapeHtml(title)}"` : "";
          return `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
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
        '<code class="hku-inline-code">$1</code>'
      );

      // Auto-link URLs (avoid double-linking)
      html = html.replace(
        /(?<!href=["']|src=["'])(?<!<a[^>]*>.*?)(https?:\/\/[^\s<>"]+)(?![^<]*<\/a>)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      );

      return html;
    }

    private parseMarkdownTables(text: string): string {
      const tableRegex = /^(\|.+\|)\n(\|[-\s|:]+\|)\n((?:\|.+\|\n?)+)/gm;
      return text.replace(tableRegex, (match, header, separator, rows) => {
        const headerCells = header
          .split("|")
          .slice(1, -1)
          .map(
            (cell: string) =>
              `<th class="hku-table-header">${this.parseMarkdownInline(cell.trim())}</th>`
          )
          .join("");

        const rowsHtml = rows
          .trim()
          .split("\n")
          .map((row: string) => {
            const cells = row
              .split("|")
              .slice(1, -1)
              .map(
                (cell: string) =>
                  `<td class="hku-table-cell">${this.parseMarkdownInline(cell.trim())}</td>`
              )
              .join("");
            return `<tr class="hku-table-row">${cells}</tr>`;
          })
          .join("");

        return `<div class="hku-table-wrapper"><table class="hku-table"><thead><tr class="hku-table-header-row">${headerCells}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
      });
    }

    private parseMarkdownLists(text: string): string {
      // Process unordered lists
      text = text.replace(/^(\s*[-*+]\s+.+(?:\n\s*[-*+]\s+.+)*)/gm, (match) => {
        const items = match
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            if (trimmed.match(/^[-*+]\s+/)) {
              const content = trimmed.replace(/^[-*+]\s+/, "");
              return `<li class="hku-list-item">${this.parseMarkdownInline(content)}</li>`;
            }
            return "";
          })
          .filter((item) => item)
          .join("");
        return `<ul class="hku-list">${items}</ul>`;
      });

      // Process ordered lists
      text = text.replace(/^(\s*\d+\.\s+.+(?:\n\s*\d+\.\s+.+)*)/gm, (match) => {
        const items = match
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            if (trimmed.match(/^\d+\.\s+/)) {
              const content = trimmed.replace(/^\d+\.\s+/, "");
              return `<li class="hku-list-item">${this.parseMarkdownInline(content)}</li>`;
            }
            return "";
          })
          .filter((item) => item)
          .join("");
        return `<ol class="hku-ordered-list">${items}</ol>`;
      });

      return text;
    }

    private processLineBreaks(text: string): string {
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
          return `<p class="hku-paragraph">${withBreaks}</p>`;
        })
        .filter((p) => p)
        .join("");
    }

    private escapeHtml(text: string): string {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }

    private smartScroll(sender: string, messageElement: HTMLElement): void {
      if (sender === "user") {
        // For user messages, scroll to show the user message at the top
        this.scrollToUserMessage(messageElement);
      } else if (sender === "bot" || sender === "human") {
        // For bot/human messages, find the last user message and scroll to it
        // This shows the user message at the top and the bot response below it
        const allMessages = Array.from(
          this.elements.messages.getElementsByClassName(
            "hku-chatbot-message-wrapper"
          )
        );
        let lastUserMessage: HTMLElement | null = null;

        // Find the last user message before this bot message
        for (let i = allMessages.length - 2; i >= 0; i--) {
          // -2 because current message is last
          if (
            (allMessages[i] as HTMLElement).classList.contains(
              "hku-chatbot-user-wrapper"
            )
          ) {
            lastUserMessage = allMessages[i] as HTMLElement;
            break;
          }
        }

        if (lastUserMessage) {
          this.scrollToUserMessage(lastUserMessage);
        } else {
          // If no user message found, scroll to bottom (fallback)
          this.scrollToBottom();
        }
      }
    }

    private scrollToUserMessage(
      messageElement: HTMLElement,
      smooth: boolean = true
    ): void {
      if (!messageElement) return;

      setTimeout(() => {
        // Scroll the message to near the top of the container, with a small offset
        const scrollOffset = 20; // pixels from the top
        const scrollPosition = messageElement.offsetTop - scrollOffset;

        this.elements.messages.scrollTo({
          top: scrollPosition,
          behavior: smooth ? "smooth" : "auto",
        });
      }, 100);
    }

    private showTypingIndicator(): void {
      if (this.elements.typingIndicator) {
        this.elements.typingIndicator.classList.add("visible");
        this.scrollToBottom();
      }
    }

    private hideTypingIndicator(): void {
      if (this.elements.typingIndicator) {
        this.elements.typingIndicator.classList.remove("visible");
      }
    }

    private addSuggestionButtons(): void {
      const suggestions = [
        "How to reset my password?",
        "How to connect to Wi-Fi?",
        "What are the printing costs?",
        "Give me the availability of Chi Wah",
      ];

      const suggestionGrid = document.createElement("div");
      suggestionGrid.className = "hku-chatbot-suggestion-grid";

      suggestions.forEach((suggestion) => {
        const button = document.createElement("button");
        button.className = "hku-chatbot-suggestion-button";
        button.textContent = suggestion;
        button.addEventListener("click", (e: MouseEvent) => {
          e.stopPropagation(); // Prevent event bubbling to document click listener
          this.elements.input.value = suggestion;
          this.sendMessage();
          suggestionGrid.remove();
        });
        suggestionGrid.appendChild(button);
      });

      this.elements.messages.appendChild(suggestionGrid);
      this.scrollToBottom();
    }

    private startPolling(): void {
      if (!this.pollingInterval) {
        this.showConnectingIndicator();
        this.pollForMessages(); // Initial poll
        this.pollingInterval = window.setInterval(
          () => this.pollForMessages(),
          1000
        );
        console.log("Polling started");
      }
    }

    private stopPolling(): void {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
        this.lastQueuePosition = null; // Reset queue position when polling stops
        console.log("Polling stopped");
      }
    }

    private async pollForMessages(): Promise<void> {
      try {
        const response = await fetch(this.options.chatUrl!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "-",
            sessionId: this.sessionId,
          }),
        });

        const data = await response.json();
        let message = data.output;

        // Only show message if it's not "-" and not empty
        if (message && message !== "-") {
          // Keep the message as plain text without any HTML formatting
          message = message.toString().trim();

          // Check if it's a queue position message
          const queuePositionMatch = message.match(
            /queue position[:\s]*(\d+)/i
          );
          if (queuePositionMatch) {
            const currentPosition = queuePositionMatch[1];
            // Only show the message if the queue position has changed
            if (this.lastQueuePosition !== currentPosition) {
              this.lastQueuePosition = currentPosition;
              this.addMessage(message, "bot");
            }
            return; // Exit early for queue position messages
          }

          // Check if it's the stop command
          if (message === "/stop") {
            this.stopPolling();
            this.addMessage("Staff disconnected", "bot");
          } else if (message === "Cancelled") {
            this.stopPolling();
            this.hideConnectingIndicator();
            this.addMessage("Queue cancelled", "bot");
          } else if (
            message.includes("Please wait. Type 'Cancel' to cancel the queue")
          ) {
            // Don't show "Please wait" message, just keep connecting indicator visible
            console.log(
              "Received queue message during polling, keeping indicator visible"
            );
            if (!this.isConnecting) {
              this.showConnectingIndicator();
            }
          } else {
            // First human message received, hide connecting indicator
            this.hideConnectingIndicator();
            this.addMessage(message, "human");
          }
        }
      } catch (error) {
        console.error("Error polling for messages:", error);
        this.hideConnectingIndicator();
      }
    }

    private showConnectingIndicator(): void {
      if (this.elements.connectingIndicator) {
        this.elements.connectingIndicator.classList.add("visible");
        this.isConnecting = true;
      }
    }

    private hideConnectingIndicator(): void {
      if (this.elements.connectingIndicator) {
        this.elements.connectingIndicator.classList.remove("visible");
        this.isConnecting = false;
      }
    }

    private scrollToBottom(): void {
      if (this.elements.messages) {
        setTimeout(() => {
          this.elements.messages.scrollTop =
            this.elements.messages.scrollHeight;
        }, 100);
      }
    }

    private openFullscreen(): void {
      try {
        const fullscreenUrl = this.options.fullscreenUrl!;
        const newTab = window.open(fullscreenUrl, "_blank");

        if (newTab) {
          newTab.focus();
          if (this.options.debug) {
            console.log(
              "HKU Chatbot Widget: Opened fullscreen chatbot in new tab"
            );
          }
        } else {
          if (this.options.debug) {
            console.warn(
              "HKU Chatbot Widget: Popup blocked, trying to navigate in current tab"
            );
          }
          const popupBlockedMessage =
            this.config && this.config.getMessage
              ? this.config.getMessage("popupBlocked") ||
                "Popup was blocked by your browser. Please allow popups for this site or click here to open fullscreen:"
              : "Popup was blocked by your browser. Please allow popups for this site or click here to open fullscreen:";

          this.addMessage(
            `${popupBlockedMessage} <a href="${fullscreenUrl}" target="_blank" rel="noopener noreferrer">Open Fullscreen Chatbot</a>`,
            "bot"
          );
        }
      } catch (error) {
        console.error(
          "HKU Chatbot Widget: Error opening fullscreen chatbot:",
          error
        );
        this.addMessage(
          `Error opening fullscreen view. Please visit: <a href="${this.options.fullscreenUrl}" target="_blank" rel="noopener noreferrer">Fullscreen Chatbot</a>`,
          "bot"
        );
      }
    }

    private async sendDisconnectMessage(): Promise<void> {
      const disconnectData = {
        message: "User disconnected due to page refresh",
        sessionId: this.sessionId,
      };

      try {
        // Use fetch with keepalive for better reliability during page unload
        const response = await fetch(this.options.chatUrl!, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(disconnectData),
          keepalive: true, // Ensures request continues even if page is unloading
        });

        if (this.options.debug) {
          console.log(
            "Disconnect message sent, response status:",
            response.status
          );
        }
      } catch (error) {
        if (this.options.debug) {
          console.error(
            "HKU Chatbot Widget: Error sending disconnect message with fetch:",
            error
          );
        }

        // Fallback to sendBeacon if fetch fails
        try {
          if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(disconnectData)], {
              type: "application/json",
            });
            const sent = navigator.sendBeacon(this.options.chatUrl!, blob);
            if (this.options.debug) {
              console.log("Disconnect message sent via sendBeacon:", sent);
            }
          }
        } catch (beaconError) {
          if (this.options.debug) {
            console.error(
              "HKU Chatbot Widget: Error sending disconnect message with sendBeacon:",
              beaconError
            );
          }
        }
      }
    }

    // Public API methods
    public open(): void {
      this.openChat();
    }

    public close(): void {
      this.closeChat();
    }

    public isOpenWidget(): boolean {
      return this.isOpen;
    }

    public destroy(): void {
      this.stopPolling();
      if (this.widget) {
        this.widget.remove();
      }
    }

    // Your current methods already exist in the compiled chatbot-widget.js
    // so the TypeScript is working. The issue is we're using both files.

    // Public API methods will be implemented as needed...
  }

  // Global API
  (window as any).HKUChatbotWidget = HKUChatbotWidget;

  // Auto-initialize if data attributes are present
  document.addEventListener("DOMContentLoaded", function () {
    const autoInit = document.querySelector("[data-hku-chatbot]");
    if (autoInit) {
      new HKUChatbotWidget();
    }
  });
})();
