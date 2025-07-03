# AI Human Main (Production) Workflow

This n8n workflow serves as the main interface for an AI chatbot system that supports both automated AI responses and human agent handover capabilities. The workflow handles multiple input channels including Telegram and webhook-based chat interfaces.

## Overview

The **AI Human Main (prod)** workflow is designed to:
- Handle incoming messages from multiple channels (Telegram, web chat)
- Process text and audio messages (with speech-to-text conversion)
- Route conversations between AI and human agents
- Manage session states and user queues
- Store conversation data in Azure Cosmos DB
- Provide real-time responses through webhooks

## Workflow Architecture

### Input Channels

1. **Telegram Integration**
   - Telegram Trigger node receives messages from Telegram bot
   - Supports both text and voice messages
   - Extracts session ID from chat ID
   - Sets channel type as "telegram"

2. **Webhook Interface**
   - "When chat message received" webhook for web-based chat interfaces
   - Handles direct API calls with session management
   - Sets channel type as "chatTrigger"

### Core Processing Flow

#### 1. Message Type Detection
- **Switch Node**: Determines if incoming message is text or audio
  - Text messages: Processed directly
  - Audio messages: Sent to Azure Whisper API for transcription

#### 2. Audio Processing
- **transcribe-whisper**: Uses Azure OpenAI Whisper API
  - Converts audio files to text
  - Adds "[transcribed]" prefix to indicate audio origin
  - Handles voice messages from Telegram

#### 3. Channel Routing
- **Switch1**: Routes messages based on channel type
  - Telegram messages: Processed through Telegram response pipeline
  - Webhook messages: Processed through webhook response pipeline

#### 4. Human Agent Management
The workflow includes sophisticated human agent handover capabilities:

- **Queue Management**: Users can join/leave human agent queues
- **Session Tracking**: Maintains active sessions between users and agents
- **Status Management**: Tracks agent availability (active/offline/stop)
- **Message Polling**: Allows agents to poll for pending user messages

### Core Components

#### AI Processing
- **Execute Workflow**: Calls the main ITS AI workflow
  - Passes sessionId, chatInput, and channel information
  - Handles AI response generation
  - Returns processed responses

#### Database Operations
- **Azure Cosmos DB**: Multiple database operations
  - Store conversation history
  - Manage user sessions
  - Track agent assignments
  - Handle queue management

#### Response Management
- **Telegram Response**: Sends messages back to Telegram users
- **Webhook Response**: Returns JSON responses for web interfaces
- **Message Formatting**: Handles different response formats per channel

### Advanced Features

#### 1. Multi-Modal Support
- Text message processing
- Audio message transcription using Azure Whisper
- File handling capabilities

#### 2. Session Management
- Persistent session tracking across conversations
- User state management
- Agent assignment tracking

#### 3. Queue System
- User can request human agent assistance
- Queue management for agent assignment
- Automatic status updates

#### 4. Logging and Analytics
- Excel integration for conversation logging
- Markdown formatting for reports
- Comprehensive data tracking

### Key Nodes Explained

| Node Name | Function |
|-----------|----------|
| `Telegram Trigger` | Receives messages from Telegram bot |
| `Switch` | Routes between text and audio processing |
| `transcribe-whisper` | Converts audio to text using Azure Whisper |
| `Execute Workflow` | Calls main AI processing workflow |
| `Switch1` | Routes responses based on channel type |
| `Azure Cosmos DB` | Database operations for session/conversation storage |
| `Telegram` | Sends responses back to Telegram |
| `Respond to Webhook` | Returns API responses for web interfaces |

### Configuration Requirements

#### API Credentials Needed:
1. **Telegram Bot Token**: For Telegram integration
2. **Azure OpenAI API Key**: For Whisper speech-to-text
3. **Azure Cosmos DB**: For data persistence
4. **Microsoft Excel 365**: For logging (optional)

#### Webhook URLs:
- Chat interface webhook endpoint
- Telegram webhook configuration
- Response webhook configurations

### Usage Scenarios

1. **Standard Chat**: User sends text message → AI processes → Response returned
2. **Voice Message**: User sends audio → Transcribed → AI processes → Response returned  
3. **Human Handover**: User requests human help → Added to queue → Agent responds
4. **Agent Management**: Agents can check queues, respond to users, manage availability

### Error Handling

The workflow includes robust error handling:
- Retry mechanisms for API calls
- Fallback responses for failed operations
- Graceful degradation when services are unavailable

### Dependencies

This workflow depends on:
- **ITS Main** workflow (referenced by ID: 2r6sQSzeaxbuqX8a)
- Azure OpenAI services
- Azure Cosmos DB
- Telegram Bot API
- Microsoft Excel 365 (for logging)

### Deployment Notes

- Ensure all credentials are properly configured
- Test webhook endpoints before production deployment
- Monitor Azure service quotas and limits
- Set up proper error alerting and monitoring

This workflow represents a comprehensive chatbot solution that bridges AI automation with human agent capabilities, providing a seamless user experience across multiple communication channels.