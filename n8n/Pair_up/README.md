# Pair Up Workflow

This n8n workflow automates the pairing process between users waiting for human support and available staff members. It runs on a scheduled basis to continuously monitor and manage the human agent queue system.

## Overview

The **Pair up** workflow is designed to:
- Automatically match waiting users with available staff members
- Manage queue positions for users waiting for human support
- Update staff status and notify both users and staff when connections are made
- Handle queue management when no staff is available

## Workflow Architecture

### Trigger Mechanism
- **Schedule Trigger**: Runs every second to continuously monitor for pairing opportunities
- Ensures real-time responsiveness for user-staff connections

### Core Logic Flow

#### 1. User Detection
```
Schedule Trigger → Find Who Waiting → Check If People Waiting
```
- Queries Azure Cosmos DB for users with status 'waiting' in the 'library' flow
- Orders by timestamp (oldest requests first) using `ORDER BY c._ts ASC`
- Takes only the first user (`SELECT Top 1`) to process one pairing at a time

#### 2. Staff Availability Check
```
If Have People Waiting → Find Which Staff Active → Check If Have Active Staff
```
- Queries the staff database for active staff members
- Looks for staff with status 'active' or ID '0' (default available state)
- Orders by timestamp to get the most recent status

#### 3. Pairing Logic

The workflow handles two main scenarios:

**Scenario A: Staff Available**
```
Have Active Staff → Change Staff Status → Edit Fields → Merge → Pair Up
```
1. **Change Staff Status**: Updates staff status to "connected"
2. **Edit Fields**: Prepares pairing data with:
   - `sessionId`: User's chat ID
   - `channel`: User's communication channel
   - `humanid`: Staff member's ID
3. **Merge**: Combines user and staff data
4. **Pair Up**: Creates active session record in database

**Scenario B: No Staff Available**
```
No Active Staff → Find Offline Staff + Find Waiting Users
```
1. **Find Offline Staff**: Notifies offline staff that someone is waiting
2. **Find Waiting Users**: Updates all waiting users with their queue position

### Database Operations

#### Collections Used:
1. **humanSupportRequests**: Tracks user support requests and active sessions
2. **staff**: Manages staff availability and status
3. **chatMessageWaiting**: Stores messages to be delivered to users

#### Key Queries:
- **Find Waiting Users**: `SELECT Top 1 * FROM c WHERE c.flowId='library' and c.status='waiting' ORDER BY c._ts ASC`
- **Find Active Staff**: `SELECT TOP 1 c.id FROM c WHERE c.staffId = 'staffstatus' AND (c.status='active' or c.id='0') order by c._ts desc`
- **Find Queue Position**: `SELECT c.id FROM c WHERE c.status='waiting' and c.flowId='library' ORDER BY c._ts ASC`

### Notification System

#### When Pairing Successful:
1. **Tell User They Connected**: Creates message in `chatMessageWaiting` with connection confirmation
2. **Tell Staff They Are Connected**: Sends Telegram message to staff with user ID

#### When No Staff Available:
1. **Telegram Notification**: Alerts offline staff that someone is waiting
2. **Queue Position Updates**: Informs all waiting users of their position in queue

### Key Nodes Explained

| Node Name | Function | Database Operation |
|-----------|----------|-------------------|
| `Schedule Trigger` | Runs workflow every second | None |
| `find who waiting` | Gets oldest waiting user | Query humanSupportRequests |
| `if have ppl waiting` | Checks if users exist | Logic only |
| `Find which staff active` | Finds available staff | Query staff |
| `If have active staff` | Checks staff availability | Logic only |
| `change staff status` | Updates staff to connected | Create/Update staff |
| `Pair up` | Creates active session | Create humanSupportRequests |
| `tell user they connected` | Notifies user of connection | Create chatMessageWaiting |
| `Tell staff they are connected` | Notifies staff via Telegram | Telegram API |
| `Code` | Calculates queue positions | Logic only |
| `tell user their queue position` | Updates user with queue info | Create chatMessageWaiting |

### Data Flow Examples

#### Successful Pairing:
```json
Input: {
  "userChatId": "12345",
  "channel": "telegram",
  "status": "waiting",
  "flowId": "library"
}

Staff Found: {
  "id": "staff123",
  "status": "active"
}

Output: {
  "userChatId": "12345",
  "humanChatId": "staff123",
  "status": "active",
  "channel": "telegram"
}
```

#### Queue Management:
```json
Waiting Users: [
  {"id": "user1", "status": "waiting"},
  {"id": "user2", "status": "waiting"},
  {"id": "user3", "status": "waiting"}
]

Queue Positions: [
  {"id": "user1", "position": 1},
  {"id": "user2", "position": 2},
  {"id": "user3", "position": 3}
]
```

### Integration Points

#### Dependencies:
- **Azure Cosmos DB**: Primary data storage
- **Telegram Bot API**: Staff notifications
- **AI Human Main Workflow**: Source of support requests

#### Connected Systems:
- Users enter the queue through the main AI chatbot workflow
- Staff receive notifications via Telegram
- Queue positions are communicated back through the main workflow

### Configuration Requirements

#### Database Setup:
- **Azure Cosmos DB Account**: With proper connection credentials
- **Required Containers**:
  - `humanSupportRequests`
  - `staff`
  - `chatMessageWaiting`

#### API Credentials:
- **Telegram Bot Token**: For staff notifications
- **Azure Cosmos DB Keys**: For database operations

### Operational Characteristics

#### Performance:
- **Execution Frequency**: Every second
- **Processing Load**: Lightweight - handles one pairing per execution
- **Scalability**: Processes users in FIFO order (first-in, first-out)

#### Error Handling:
- Graceful handling of empty queues
- Continues operation if no staff available
- Database connection resilience

### Monitoring and Maintenance

#### Key Metrics to Monitor:
- Average wait time in queue
- Staff response time
- Successful pairing rate
- Queue length trends

#### Maintenance Tasks:
- Clean up old completed sessions
- Monitor database performance
- Update staff availability status
- Review notification delivery

### Usage Scenarios

1. **Peak Hours**: Multiple users waiting, staff gets notified and processes queue
2. **Off Hours**: Users get queue position updates when no staff available
3. **Staff Rotation**: Automatic pairing when staff becomes available
4. **System Recovery**: Continues pairing after temporary outages

This workflow ensures efficient and fair distribution of human support requests while providing real-time feedback to both users and staff members.
