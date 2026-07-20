# AI-Powered B2B Prospecting & Campaign Manager

## Overview
This repository contains the architecture and implementation of an AI-powered LinkedIn Lead Generation and B2B Prospecting platform. Designed to solve major bottlenecks in modern outbound sales workflows, the application replaces generic, low-conversion outreach with hyper-personalized messaging at an enterprise scale.

This project was developed utilizing **"Vibe Coding"** via **Google AI Studio**, serving as a proof-of-concept for rapid, AI-orchestrated software development.

## Development Methodology: Vibe Coding
Rather than writing manual boilerplate, this platform was built using an AI-assisted development workflow known as "Vibe Coding." By leveraging Google AI Studio and large language models (LLMs), I operated as the system architect—focusing on high-level system design, relational data structures, and business logic, while orchestrating the AI to generate the underlying codebase. This methodology demonstrates the ability to rapidly prototype, iterate, and deploy enterprise-grade applications at exceptional speed.

## Core Problems & Solutions

### 1. The Personalization Problem (Low Conversion Rates)
*   **Problem:** Generic, copy-pasted outbound templates suffer from low reply rates and feel spammy to prospects.
*   **Solution:** Integrated a server-side AI engine powered by Gemini. The platform analyzes specific B2B prospect data (role, company, industry, profile details) to dynamically generate highly tailored connection requests, customized sales pitches, and follow-ups.

### 2. The Scale Problem (Manual Bottlenecks)
*   **Problem:** Manually researching prospects and drafting individualized messages restricts the volume of leads a Sales Development Representative (SDR) can handle.
*   **Solution:** Engineered a **Bulk CSV Importer** and a **Bulk AI Generation Engine**. SDRs can upload full lead matrices and automatically generate multi-step messaging sequences for hundreds of prospects simultaneously.

### 3. The Campaign Management Problem (Disorganized Follow-Ups)
*   **Problem:** Tracking multi-step sales sequences (Connection Request -> Pitch -> Follow-up 1 -> Follow-up 2) across dozens of leads quickly becomes chaotic.
*   **Solution:** Built a structured **Campaign Matrix & Leads Hub**. This centralized dashboard monitors the outreach status of every lead (Connected, Pitched, Responded, Ignored). Representatives can review, regenerate, or manually fine-tune drafted messages at each sequence step prior to execution.

### 4. The Governance Problem (Admin & Compliance)
*   **Problem:** Scaling AI across a sales team poses risks of runaway API costs, rogue messaging, and unauthorized access to system prompts.
*   **Solution:** Implemented an advanced **Admin Dashboard** with Role-Based Access Control (Super Admin, Manager, Executive). Features include:
    *   SDR workspace directory management.
    *   Live telemetry and real-time prompt history logs for compliance auditing.
    *   System-wide guardrail and maintenance mode toggles.
    *   Selective account suspension or AI-generation revocation upon compliance breaches.

## Tech Stack & Skills Highlighted

*   **Artificial Intelligence:** Prompt Engineering, Google AI Studio, Large Language Models (LLMs), Generative AI Integration.
*   **Architecture & Backend:** Server-Side AI Orchestration, API Integration, Relational Data Modeling, B2B SaaS Architecture.
*   **Security & Governance:** Role-Based Access Control (RBAC), Enterprise Governance, System Telemetry & Logging.
*   **Methodology:** Vibe Coding, Rapid Prototyping, Agile Product Development.

## Getting Started

### Prerequisites
*   Node.js (v16 or higher)
*   Google Gemini API Key
*   [Add any other database or environment prerequisites here]

### Installation
1. Clone the repository:
   ```bash
   git clone [https://github.com/yourusername/ai-prospecting-manager.git](https://github.com/yourusername/ai-prospecting-manager.git)
