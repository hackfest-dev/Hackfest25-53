# Axentis: AI-Powered Productivity & Automation Platform

Axentis is a comprehensive AI-powered productivity and automation platform that combines multiple intelligent agents, personal data integration, and automation capabilities in one unified interface.

## Core Features

- **Multi-Agent AI System**
  - WebSurfer: AI agent for browsing and searching the web
  - FileSurfer: Local file preview and interaction
  - Coder: Programming assistance and code generation
  - Terminal: Command execution through natural language

- **Personal Data Integration**
  - Calendar integration with Google Calendar
  - Email management with Gmail
  - Activity tracking and time management tools
  - Weather-aware recommendations

- **Smart Dashboard**
  - Activity timeline and productivity insights
  - Time tracking with category breakdown
  - Daily AI-generated personalized tips
  - Upcoming events calendar

- **WhatsApp Integration**
  - Connect via QR code scanning
  - Send/receive messages through the web interface
  - Voice message transcription and text-to-speech generation
  - Remote command execution

- **Memory System**
  - Context-aware AI that remembers previous conversations
  - User preference learning and adaptation
  - Personalized responses based on interaction history

- **Command Panel**
  - Execute system commands with natural language
  - Capture screenshots remotely
  - Automate repetitive tasks
  - AI-powered command generation

## Setup

### Requirements

- Node.js (v14+)
- npm or yarn
- For voice message support: ffmpeg and whisper AI

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd axentis
```

2. Install dependencies:

```bash
npm run install-all
```

3. For Windows users who want to use the screenshot functionality:

```bash
npm run setup-windows
```

This will download and install nircmd, which is used for taking screenshots on Windows.

4. Start the application:

```bash
npm start
```

The application will start both the backend server (port 3000) and the frontend development server (port 5173).

## Usage

1. Open your browser and navigate to `http://localhost:5173`
2. Set up integrations in the Settings panel:
   - Connect to WhatsApp by scanning the QR code
   - Link your Google Calendar and Gmail accounts
   - Configure other preferences
3. Explore the dashboard and begin interacting with the AI agents
4. Use the Command Panel for system tasks and automation

## Troubleshooting

### Screenshot Issues

If you encounter issues with the screenshot functionality:

- On Windows: Run `npm run setup-windows` to install nircmd
- On Linux: Ensure you have gnome-screenshot, scrot, or ImageMagick installed
- On macOS: No additional setup required

### API Integration Issues

If you experience problems with third-party integrations:
- Verify your API keys are correctly set in the .env file
- Check that you've authorized the necessary permissions
- Consult the logs for specific error messages

## Project Structure

- `backend/` - Node.js backend with API endpoints and AI services
- `frontend/` - React frontend with the dashboard and agent interfaces
- `agents/` - AI agent implementations and configurations
- `integrations/` - Third-party service connectors
- `utils/` - Helper utilities and shared functions
- `package.json` - Root package.json for managing the project


## License

MIT License