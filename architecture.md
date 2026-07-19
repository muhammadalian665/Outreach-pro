# LinkedIn Lead Generation Messaging SaaS Architecture

## 1. Requirements Validation
We have validated the core business goals and technical boundaries:
- **Business Goal**: Maximize LinkedIn outreach reply rate by analyzing prospect context and writing natural, highly personalized, persuasion-driven messages.
- **Rules compliance**: Under 300 characters for connection requests. Conversation and curiosity-focused pitches. Value-first Follow-up 1. Respectful, breakup-focused Follow-up 2. 
- **Prohibited Words**: No robotic phrases such as "Hope you're doing well", "wanted to reach out", "checking in", or "just following up".
- **Integrations**: Support both modern server-side Gemini-3.5-flash and OpenAI (GPT-4o / GPT-4o-mini).

---

## 2. Feature List
- **Dashboard & Analytics**: Track reply rate trends, connection send ratios, active campaign performance, conversion statistics, and AI token usages.
- **Campaign Management**: Select the promoted B2B service once on entry, run multiple campaigns, manage service tag lines, and switch active campaigns easily.
- **Prospect Management**: Manage leads within campaigns. Support search, status filters (Draft, Sent, Replied, Won, Lost), custom context fields, and manual edits.
- **Prospect Bulk Importer**: Accept CSV and manual inputs to map prospect fields.
- **AI outreach generator**: Analyze company background, job title, and activity to generate sequential copy with copy buttons, manual inline edits, version histories, and itemized message regeneration.
- **System Settings & User profile**: Adjust AI temperature, select default model engines, toggle dark mode, and set custom personal signatures.

---

## 3. System Architecture
```
                  ┌────────────────────────────────────────┐
                  │              Web Browser               │
                  │       (React 19 / Tailwind 4 / Vite)   │
                  └───────────────────┬────────────────────┘
                                      │ REST API / JSON
                                      ▼
                  ┌────────────────────────────────────────┐
                  │             Express Server             │
                  │             (Port 3000)                │
                  └──────┬───────────────────────────┬─────┘
                         │                           │
                         ▼                           ▼
          ┌─────────────────────────────┐    ┌───────────────┐
          │  Google GenAI (Gemini SDK)  │    │  OpenAI API   │
          │     "gemini-3.5-flash"       │    │   "gpt-4o"    │
          └─────────────────────────────┘    └───────────────┘
```

---

## 4. Database Design
Our database is modelled relationally but optimized for immediate sandboxed containers using a high-performance, file-system based JSON Store (`database.json`) with relational join integrity:

### **Campaigns Table**
- `id` (Primary Key)
- `name`
- `serviceName` (e.g. AI Solutions, SEO)
- `description`
- `createdAt`
- `isActive`

### **Prospects Table**
- `id` (Primary Key)
- `campaignId` (Foreign Key -> Campaigns)
- `firstName`, `lastName`, `email`, `linkedInUrl`, `jobTitle`, `location`
- `companyName`, `website`, `industry`, `companySize`, `aboutCompany`
- `prospectSummary`, `painPoints`, `recentPosts`, `technologyUsed`
- `messageStatus` (Draft, Connection Sent, Pitch Sent, etc.)
- `connectionSent`, `pitchSent`, `followup1Sent`, `followup2Sent`
- `replyReceived`, `wonLostStatus`

### **GeneratedMessages Table**
- `id` (Primary Key)
- `prospectId` (Foreign Key -> Prospects)
- `campaignId` (Foreign Key -> Campaigns)
- `connectionRequest`
- `pitchMessage`
- `followup1`
- `followup2`
- `versions` (Array of historic text changes)

### **Activities Table**
- `id`, `prospectId`, `campaignId`, `type`, `action`, `timestamp`, `details`

---

## 5. UI Wireframes
The application features a single-page premium SaaS feel modeled after Linear and Vercel:
- **Left Rail Sidebar**: Persistent elegant workspace with active campaign metadata, stats highlights, navigation sections (Dashboard, Leads Hub, Logs, Configuration).
- **Primary Stage / Dashboard View**: Interactive KPIs, visual charts, and recent activity logs.
- **Campaign Leads Hub**: Grid of prospects with a split-panel sidebar showing active lead profile and custom generated connection / pitch copy, with direct regeneration controls.
- **Bulk Importer Portal**: Multi-step layout with direct CSV parsing and verification before saving to active campaign.

---

## 6. Folder Structure
```
├── server.ts                  # High-performance full-stack backend
├── database.json              # Local persistent relational state
├── package.json               # Configured dev, build, and start scripts
├── src/
│   ├── main.tsx               # Primary React entry point
│   ├── App.tsx                # SaaS Navigation Frame & router views
│   ├── types.ts               # Shared TypeScript schemas
│   ├── index.css              # Custom typography and tailwind configuration
│   ├── components/            # Reusable UI components
│   │   ├── Dashboard.tsx      # Main KPIs, Trends, and Activities
│   │   ├── LeadsHub.tsx       # Advanced search, filters, split drawer, copy tools
│   │   ├── Importer.tsx       # CSV/Manual Entry prospect loader
│   │   └── SettingsView.tsx   # AI configurations, profiles, and API secret models
```

---

## 7. Tech Stack Recommendation
*   **Frontend**: React 19 + TypeScript (For rapid rendering and safe data binding).
*   **Styling**: Tailwind CSS v4 (Modern, fast, and utility-first styling).
*   **Animations**: Motion (React Motion) (For fluid micro-interactions and high premium aesthetics).
*   **Backend**: Express Server + TSX (High reliability for hosting APIs and serving proxy AI tokens).
*   **Database**: Persistent JSON Storage (Zero-config setup, fully portable, speeds up container deployment).

---

## 8. Development Roadmap
1.  **Phase 1**: Design types and backend API paths in `server.ts` with local JSON persistence. (COMPLETED)
2.  **Phase 2**: Create components: Dashboard, LeadsHub, Importer, SettingsView.
3.  **Phase 3**: Connect Frontend to Express backend endpoints.
4.  **Phase 4**: Style application with Inter typography, deep slate colors, and high-contrast dark visual aesthetics.
