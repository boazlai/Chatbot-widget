# n8n Workflow: ITS Main

This document provides a detailed explanation of the `ITS_Main.json` n8n workflow. This workflow serves as the primary AI-driven engine for answering user queries related to The University of Hong Kong's Information Technology Services (ITS).

## Workflow Overview

The core of this workflow is a sophisticated **AI Agent** that is equipped with a specific set of tools and a detailed system prompt. It is designed to handle ITS-related questions, provide accurate information based on live data, and follow strict operational guidelines. It can be triggered either by another workflow (its primary mode of operation) or by a direct chat message for testing.

---

## Triggers

1.  **`When Executed by Another Workflow`**: This is the main entry point. A parent workflow (like a central router) passes the user's `sessionId`, `chatInput`, and `channel` to start the process.
2.  **`When chat message received`**: A secondary trigger that allows for direct interaction with the workflow, primarily for development and testing purposes.

---

## Core Component: AI Agent

- **Node:** `AI Agent`
- **Type:** LangChain Agent

This agent is the brain of the operation. Its behavior is governed by a comprehensive **System Prompt** that defines its role, rules, and instructions.

### Key Instructions from the System Prompt:

1.  **Role**: To act as an ITS assistant for HKU.
2.  **Tool Reliance**: The agent **must** base its answers strictly on information retrieved from its specialized tools. It is forbidden from using its own pre-existing knowledge.
3.  **Search Strategy**: It follows a specific search hierarchy:
    - First, use `ITSWebSearch` for a broad, up-to-date search of the ITS website.
    - Second, use `FindAnswerITS` to supplement and verify information, as this tool is considered more authoritative.
4.  **Specialized Queries**: For questions about Chi Wah Learning Commons study rooms, it must use the `Check Chi Wah` tool directly.
5.  **Formatting**: All answers must be in Markdown, using lists and bolding for readability. It must always cite the source links.
6.  **Standard Disclaimers**: Every answer must include a note that it is AI-generated and that users should verify critical information. It should also provide relevant contact details from the `ITS Service Contact and Location Tool` and mention the option to email ITS.
7.  **Internal Reasoning**: The agent appends its reasoning process to the end of its output, separated by `####NOTE####`. This is stripped out before being shown to the user.

### The "Talk To Staff" Protocol

The agent has a strict, non-negotiable protocol for when a user expresses a desire to speak to a human. This overrides all other rules.

- **Step 1: Confirmation**: If a user wants to talk to staff, the agent will **only** reply with: `"To connect you with the ITS staff, please reply 'yes' to confirm. Otherwise, ignore this message."`
- **Step 2: Activation**: If the user replies "yes", the agent outputs a special string: `UserWantFindStaff_____`. This string acts as a signal to the parent workflow to transfer the user to the human support queue.
- **Step 3: Cancellation**: If the user cancels, the agent outputs `UserWantCancelFindStaff_____`.

---

## Tools Available to the Agent

The agent has a suite of custom tools to find information:

- **`ITSWebSearch`**: Performs a live web search (via Tavily API) restricted to the `its.hku.hk` domain.
- **`FindAnswerITS`**: Executes a sub-workflow to query an internal, authoritative knowledge base for information that may not be on the public website.
- **`Check Chi Wah`**: Executes a sub-workflow to get the real-time availability of study rooms in the Chi Wah Learning Commons.
- **`Printer Info Tool`**: Executes a sub-workflow to retrieve detailed information about printing services (locations, charges, policies, etc.).
- **`ITS Service Contact and Location Tool`**: Executes a sub-workflow to fetch contact numbers, opening hours, and locations for various ITS services.
- **`Email ITS Staff Tool`**: A tool that allows the user to send their question as an email to ITS staff directly from the chatbot.
- **`Date & Time`**: Provides the current date and time, which is crucial for time-sensitive queries.
- **`Think`**: A tool that allows the agent to perform complex reasoning or record its thought process without affecting the final answer.

---

## Workflow Process

1.  The workflow is triggered and receives the user's input and session ID.
2.  The `set channel` node ensures all necessary variables (`sessionId`, `chatInput`, `channel`) are properly formatted.
3.  The data is passed to the **`AI Agent`**.
4.  The agent uses its **`Simple Memory`** to recall the conversation history.
5.  Based on the user's query and its instructions, the agent decides which **Tool(s)** to use.
6.  The selected tools are executed, and their outputs are returned to the agent.
7.  The agent synthesizes the information from the tools into a final answer or generates a special string for human handoff (`UserWantFindStaff_____`).
8.  The agent's output is sent to the **`If find staff or cancel`** node. This node acts as a router.
    - **If the output is a standard AI answer**: It is forwarded to the `Edit Fields` node.
      - **`Edit Fields`**: This node splits the output at the `####NOTE####` separator, isolating the user-facing answer from the agent's internal reasoning.
      - **`Markdown`**: The final answer text is converted from Markdown to HTML to be correctly rendered in the chat interface.
      - The HTML output is returned to the parent workflow for display to the user.
    - **If the output is a special string (`UserWantFindStaff_____` or `UserWantCancelFindStaff_____`)**: It is forwarded to the `Edit Fields2` node.
      - **`Edit Fields2`**: This node preserves the special string.
      - The string is returned directly to the parent workflow, which then initiates or cancels the human support transfer process.
