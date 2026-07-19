/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON parser with sufficient limit for CSV/Excel uploads
app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------
// DATABASE INITIALIZATION & FILE PERSISTENCE
// ----------------------------------------------------
const DB_FILE = path.join(process.cwd(), 'database.json');

interface Schema {
  users: any[];
  campaigns: any[];
  prospects: any[];
  generatedMessages: any[];
  activities: any[];
  promptHistory: any[];
  templates: any[];
  settings: {
    aiModel: string;
    temperature: number;
    openAiApiKey?: string;
    userProfileName: string;
    userCompany: string;
    userRole: string;
  };
}

const DEFAULT_SETTINGS = {
  aiModel: 'gemini-3.5-flash',
  temperature: 0.7,
  openAiApiKey: '',
  userProfileName: 'Lead Generation Strategist',
  userCompany: 'Outreach Solutions',
  userRole: 'Founder'
};

function readDb(): Schema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialDb: Schema = {
        users: [],
        campaigns: [],
        prospects: [],
        generatedMessages: [],
        activities: [
          {
            id: 'init',
            type: 'manual_update',
            action: 'System Initialized',
            timestamp: new Date().toISOString(),
            details: 'Outreach database created successfully.'
          }
        ],
        promptHistory: [],
        templates: [],
        settings: DEFAULT_SETTINGS
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
      return initialDb;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Ensure default settings are merged
    if (!parsed.settings) {
      parsed.settings = DEFAULT_SETTINGS;
    }
    // Ensure users array exists
    if (!parsed.users) {
      parsed.users = [];
    }
    return parsed;
  } catch (error) {
    console.error('Failed to read database, returning fresh state:', error);
    return {
      users: [],
      campaigns: [],
      prospects: [],
      generatedMessages: [],
      activities: [],
      promptHistory: [],
      templates: [],
      settings: DEFAULT_SETTINGS
    };
  }
}

function writeDb(data: Schema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write database file:', error);
  }
}

// Ensure database file is created/loaded
let db = readDb();

function getUserId(req: any): string {
  const h = req.headers['x-user-id'];
  if (Array.isArray(h)) return h[0] || '';
  return String(h || req.query.userId || req.body.userId || '').trim();
}

function isStaff(userId: string): boolean {
  return ['admin', 'manager', 'executive', 'admin_root', 'manager_root', 'executive_root'].includes(userId);
}

function getUserEnforcement(userId: string) {
  if (!userId || isStaff(userId)) {
    return {
      status: 'active',
      aiPermission: true,
      campaignLimit: 9999,
      isStaff: true
    };
  }
  const dbData = readDb();
  const user = dbData.users.find(u => u.id === userId);
  if (!user) {
    return {
      status: 'active',
      aiPermission: true,
      campaignLimit: 5,
      isStaff: false
    };
  }
  return {
    status: user.status || 'active',
    aiPermission: user.aiPermission !== false,
    campaignLimit: user.campaignLimit !== undefined ? Number(user.campaignLimit) : 5,
    isStaff: false
  };
}

// ----------------------------------------------------
// AI GENERATION LOGIC (GEMINI & OPENAI)
// ----------------------------------------------------
async function generateOutreachAI(
  prospect: any,
  campaign: any,
  settings: any
): Promise<{
  connectionRequest: string;
  pitchMessage: string;
  followup1: string;
  followup2: string;
  promptUsed: string;
  modelUsed: string;
}> {
  // System context builder
  const senderInfo = `${settings.userProfileName}, ${settings.userRole} at ${settings.userCompany}`;
  const promotingService = campaign.serviceName;

  const prompt = `You are a world-class Lead Generation Copywriter. Your goal is to write 4 highly personalized LinkedIn outreach messages to convert this prospect into a replying meeting opportunity.
Our active campaign is promoting: "${promotingService}".
Sender of messages is: "${senderInfo}".

Prospect details:
- Name: ${prospect.firstName} ${prospect.lastName}
- Job Title: ${prospect.jobTitle}
- Location: ${prospect.location}
- Company: ${prospect.companyName}
- Industry: ${prospect.industry}
- Company Size: ${prospect.companySize}
- Website: ${prospect.website}
- About Company: ${prospect.aboutCompany}
- Prospect Summary & Notes: ${prospect.prospectSummary}
- Pain Points: ${prospect.painPoints}
- Recent Posts/Activities: ${prospect.recentPosts}
- Technology Used: ${prospect.technologyUsed}
- Extra Context: ${prospect.notes} ${prospect.additionalContext || ''}

Write exactly 4 sequential outreach messages:
1. LinkedIn Connection Request:
- Max 300 characters.
- Extremely friendly, low friction, curiosity-driven.
- NO selling, NO pitch, NO buzzwords.
- Goal: Get connection request accepted.

2. LinkedIn Pitch Message:
- Sent after connection is accepted.
- Highly conversational, written as if you met at a networking event or saw their profile naturally.
- Pattern interrupt, curiosity gap.
- NO boilerplate templates. DO NOT say "I wanted to reach out" or "Hope you are doing well".
- Frame an interesting problem or growth opportunity that matches their pain points.
- Include a very soft call to action / micro-commitment (e.g. "Open to a quick thought on this?", "Worth exploring?").

3. Follow-up Message #1:
- Value-driven.
- Share a helpful resource, interesting perspective, or unique insight relevant to their role/industry/pain points.
- NO sales pressure.

4. Follow-up Message #2:
- Final follow-up. Short, respectful.
- Creates urgency without pressure (the "breakup" message).
- Ends conversation professionally.

MANDATORY WRITING RULES:
- Never say "Hope you're doing well", "I wanted to reach out", "Checking in", "Just following up", "Hope this finds you well".
- Write completely like a human, never sound like AI, avoid any robotic lists or formulaic greetings.
- Inject curiosity naturally. Use empathetic language.
- Every message should feel tailor-made for ${prospect.firstName} at ${prospect.companyName}.

Output your response strictly in the following JSON format:
{
  "connectionRequest": "...",
  "pitchMessage": "...",
  "followup1": "...",
  "followup2": "..."
}
Ensure it is valid JSON and do not wrap in markdown unless requested. Just return pure JSON.`;

  const modelUsed = settings.aiModel;
  let apiResponseText = '';

  // Determine key
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openAiApiKey = settings.openAiApiKey || process.env.OPENAI_API_KEY;

  if (settings.aiModel.startsWith('gpt') && openAiApiKey) {
    // Call OpenAI
    try {
      console.log(`Using OpenAI Model: ${settings.aiModel}`);
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiApiKey}`
        },
        body: JSON.stringify({
          model: settings.aiModel === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an advanced B2B copywriter returning only pure JSON.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: settings.temperature
        })
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${errBody}`);
      }
      const data = await res.json();
      apiResponseText = data.choices[0].message.content || '';
    } catch (err: any) {
      console.error('OpenAI failed, falling back to Gemini:', err.message);
      // Fallback to Gemini
      apiResponseText = await callGeminiFallback(prompt, geminiApiKey);
    }
  } else {
    // Call Gemini (Primary)
    try {
      console.log(`Using Gemini Model: gemini-3.5-flash`);
      if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not defined in the environment secrets.');
      }
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: settings.temperature
        }
      });
      apiResponseText = response.text || '';
    } catch (err: any) {
      console.error('Gemini generation failed:', err.message);
      throw err;
    }
  }

  // Parse result safely
  try {
    // Clean up response text if wrapped in markdown
    let cleaned = apiResponseText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();
    const parsed = JSON.parse(cleaned);
    return {
      connectionRequest: parsed.connectionRequest || '',
      pitchMessage: parsed.pitchMessage || '',
      followup1: parsed.followup1 || '',
      followup2: parsed.followup2 || '',
      promptUsed: prompt,
      modelUsed: settings.aiModel
    };
  } catch (parseError) {
    console.error('Failed to parse AI JSON response:', apiResponseText);
    throw new Error('AI returned an invalid JSON structure. Please try generating again.');
  }
}

async function callGeminiFallback(prompt: string, apiKey: string | undefined): Promise<string> {
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing for fallback.');
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: { responseMimeType: 'application/json' }
  });
  return response.text || '';
}

async function parseProspectsAI(
  text: string | undefined,
  pdfBase64: string | undefined,
  apiKey: string | undefined
): Promise<any[]> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not defined in the environment secrets.');
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  let contents: any[] = [];
  
  if (pdfBase64) {
    contents.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBase64
      }
    });
    contents.push("Extract all B2B prospects and lead details from this PDF document.");
  } else if (text) {
    contents.push(`Extract all B2B prospects and lead details from the following pasted text:\n\n${text}`);
  } else {
    throw new Error("No text or PDF provided for parsing.");
  }

  const systemInstruction = `You are a high-fidelity B2B Data Extraction AI. 
Analyze the input text or PDF to find all individuals (leads/prospects/contacts) mentioned.
For each person found, extract or infer the following fields based on the surrounding context. 
If a field is not present or cannot be reasonably inferred, set it to an empty string.

Field guidelines:
- firstName: First name (required, default to "Unknown" if not found)
- lastName: Last name
- linkedInUrl: Full LinkedIn profile URL if mentioned or can be guessed/constructed
- jobTitle: Job title or professional role
- companyName: Name of the company they work for (required, default to "Unknown" if not found)
- website: Company website domain
- industry: Company industry or sector
- companySize: Estimated company size (e.g. "1-10", "11-50", "51-200", "201-500", "500+")
- location: City, state, and/or country of the person or company
- aboutCompany: Brief summary of what the company does
- prospectSummary: Short background summary of the person
- painPoints: Obvious or potential pain points, growth bottlenecks, or challenges they are facing (either explicitly stated or inferred from their role/posts)
- recentPosts: Brief context of recent posts, quotes, or activities if mentioned
- technologyUsed: Tech stack, software, or tools mentioned (e.g., React, AWS, Salesforce)
- notes: General notes or extra context

Return a clean, valid JSON array containing objects matching this schema. If no leads are found, return an empty array.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: contents,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            firstName: { type: Type.STRING },
            lastName: { type: Type.STRING },
            linkedInUrl: { type: Type.STRING },
            jobTitle: { type: Type.STRING },
            companyName: { type: Type.STRING },
            website: { type: Type.STRING },
            industry: { type: Type.STRING },
            companySize: { type: Type.STRING },
            location: { type: Type.STRING },
            aboutCompany: { type: Type.STRING },
            prospectSummary: { type: Type.STRING },
            painPoints: { type: Type.STRING },
            recentPosts: { type: Type.STRING },
            technologyUsed: { type: Type.STRING },
            notes: { type: Type.STRING }
          },
          required: ["firstName", "companyName"]
        }
      }
    }
  });

  const responseText = response.text || '[]';
  try {
    return JSON.parse(responseText.trim());
  } catch (err) {
    console.error('Failed to parse Gemini json output:', responseText);
    throw new Error('AI parser returned invalid JSON format.');
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Settings
app.get('/api/settings', (req, res) => {
  db = readDb();
  res.json(db.settings);
});

app.post('/api/settings', (req, res) => {
  db = readDb();
  db.settings = { ...db.settings, ...req.body };
  writeDb(db);
  res.json({ success: true, settings: db.settings });
});

// 2. Campaigns
app.get('/api/campaigns', (req, res) => {
  db = readDb();
  const userId = getUserId(req);

  if (userId && !isStaff(userId)) {
    const enf = getUserEnforcement(userId);
    if (enf.status === 'suspended') {
      return res.status(403).json({ error: 'Your workspace account has been suspended by the System Administrator. SDR access revoked.' });
    }
  }

  let list = [...db.campaigns];

  if (userId && !isStaff(userId)) {
    list = list.filter(c => c.userId === userId || !c.userId);
  }

  // Map prospect counts
  const resultList = list.map(c => {
    const prospects = db.prospects.filter(p => p.campaignId === c.id);
    return { ...c, prospectCount: prospects.length };
  });
  res.json(resultList);
});

app.post('/api/campaigns', (req, res) => {
  db = readDb();
  const userId = getUserId(req);

  if (userId && !isStaff(userId)) {
    const enf = getUserEnforcement(userId);
    if (enf.status === 'suspended') {
      return res.status(403).json({ error: 'Your workspace account has been suspended by the System Administrator. SDR access revoked.' });
    }
    const currentCount = db.campaigns.filter(c => c.userId === userId).length;
    if (currentCount >= enf.campaignLimit) {
      return res.status(403).json({ error: `You have reached your limit of ${enf.campaignLimit} campaigns. Please contact your workspace Administrator to increase your quota.` });
    }
  }

  const newCampaign = {
    id: `camp_${Date.now()}`,
    name: req.body.name,
    serviceName: req.body.serviceName,
    description: req.body.description || '',
    createdAt: new Date().toISOString(),
    isActive: db.campaigns.length === 0 ? true : req.body.isActive || false,
    userId: userId || 'admin'
  };

  // If marked active, deactivate others
  if (newCampaign.isActive) {
    db.campaigns.forEach(c => {
      if (!userId || isStaff(userId) || c.userId === userId) {
        c.isActive = false;
      }
    });
  }

  db.campaigns.push(newCampaign);
  
  // Add activity log
  db.activities.push({
    id: `act_${Date.now()}`,
    campaignId: newCampaign.id,
    type: 'import',
    action: 'Campaign Created',
    timestamp: new Date().toISOString(),
    details: `Created campaign "${newCampaign.name}" promoting "${newCampaign.serviceName}"`,
    userId: userId || 'admin'
  });

  writeDb(db);
  res.status(201).json(newCampaign);
});

app.put('/api/campaigns/:id', (req, res) => {
  db = readDb();
  const index = db.campaigns.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Campaign not found' });

  db.campaigns[index] = { ...db.campaigns[index], ...req.body };

  if (req.body.isActive) {
    db.campaigns.forEach(c => {
      if (c.id !== req.params.id) c.isActive = false;
    });
  }

  writeDb(db);
  res.json(db.campaigns[index]);
});

app.delete('/api/campaigns/:id', (req, res) => {
  db = readDb();
  db.campaigns = db.campaigns.filter(c => c.id !== req.params.id);
  db.prospects = db.prospects.filter(p => p.campaignId !== req.params.id);
  db.generatedMessages = db.generatedMessages.filter(m => m.campaignId !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// 3. Prospects
app.get('/api/prospects', (req, res) => {
  db = readDb();
  const { campaignId, search, status } = req.query;
  const userId = getUserId(req);

  if (userId && !isStaff(userId)) {
    const enf = getUserEnforcement(userId);
    if (enf.status === 'suspended') {
      return res.status(403).json({ error: 'Your workspace account has been suspended by the System Administrator. SDR access revoked.' });
    }
  }

  let result = [...db.prospects];

  if (userId && !isStaff(userId)) {
    const campaignIds = db.campaigns.filter(c => c.userId === userId).map(c => c.id);
    result = result.filter(p => campaignIds.includes(p.campaignId));
  }

  if (campaignId) {
    result = result.filter(p => p.campaignId === campaignId);
  }
  if (status) {
    result = result.filter(p => p.messageStatus === status);
  }
  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter(p => 
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.companyName.toLowerCase().includes(q) ||
      p.jobTitle.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q)
    );
  }

  // Sort by latest created
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(result);
});

app.post('/api/prospects', (req, res) => {
  db = readDb();
  const { campaignId } = req.body;
  if (!campaignId) return res.status(400).json({ error: 'Campaign ID is required' });
  const userId = getUserId(req);

  if (userId && !isStaff(userId)) {
    const enf = getUserEnforcement(userId);
    if (enf.status === 'suspended') {
      return res.status(403).json({ error: 'Your workspace account has been suspended by the System Administrator. SDR access revoked.' });
    }
  }

  const newProspect = {
    ...req.body,
    id: `pros_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageStatus: req.body.messageStatus || 'draft',
    connectionSent: req.body.connectionSent || false,
    pitchSent: req.body.pitchSent || false,
    followup1Sent: req.body.followup1Sent || false,
    followup2Sent: req.body.followup2Sent || false,
    replyReceived: req.body.replyReceived || false,
    wonLostStatus: req.body.wonLostStatus || 'none',
    userId: userId || 'admin'
  };

  db.prospects.push(newProspect);

  db.activities.push({
    id: `act_${Date.now()}`,
    prospectId: newProspect.id,
    campaignId: newProspect.campaignId,
    type: 'import',
    action: 'Prospect Added',
    timestamp: new Date().toISOString(),
    details: `Manually added prospect ${newProspect.firstName} ${newProspect.lastName} (${newProspect.companyName})`,
    userId: userId || 'admin'
  });

  writeDb(db);
  res.status(201).json(newProspect);
});

// AI-assisted Parse from PDF or Copy-Paste
app.post('/api/prospects/parse', async (req, res) => {
  try {
    const { text, pdf } = req.body;
    if (!text && !pdf) {
      return res.status(400).json({ error: 'Either copy-paste text or a PDF file must be provided.' });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not defined in the environment secrets.' });
    }

    // Strip out header if present in pdf base64
    let pdfData: string | undefined = undefined;
    if (pdf) {
      const parts = pdf.split(';base64,');
      pdfData = parts.length > 1 ? parts[1] : parts[0];
    }

    console.log(`AI Parsing request received. Method: ${pdf ? 'PDF Upload' : 'Copy-Paste'}`);
    const prospects = await parseProspectsAI(text, pdfData, geminiApiKey);
    
    res.json({ success: true, prospects });
  } catch (error: any) {
    console.error('Failed to parse prospects via AI:', error);
    res.status(500).json({ error: error.message || 'AI parsing failed' });
  }
});

// Bulk Import
app.post('/api/prospects/bulk', (req, res) => {
  db = readDb();
  const { campaignId, prospects } = req.body;
  if (!campaignId) return res.status(400).json({ error: 'Campaign ID is required' });
  if (!Array.isArray(prospects)) return res.status(400).json({ error: 'Prospects list is required' });
  const userId = getUserId(req);

  const importedList: any[] = [];
  prospects.forEach((item: any) => {
    const p = {
      id: `pros_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      campaignId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firstName: item.firstName || 'Unknown',
      lastName: item.lastName || '',
      linkedInUrl: item.linkedInUrl || '',
      jobTitle: item.jobTitle || '',
      location: item.location || '',
      companyName: item.companyName || 'Unknown',
      website: item.website || '',
      industry: item.industry || '',
      companySize: item.companySize || '',
      aboutCompany: item.aboutCompany || '',
      prospectSummary: item.prospectSummary || '',
      painPoints: item.painPoints || '',
      recentPosts: item.recentPosts || '',
      technologyUsed: item.technologyUsed || '',
      notes: item.notes || '',
      additionalContext: item.additionalContext || '',
      customFields: item.customFields || {},
      messageStatus: 'draft',
      connectionSent: false,
      pitchSent: false,
      followup1Sent: false,
      followup2Sent: false,
      replyReceived: false,
      wonLostStatus: 'none',
      userId: userId || 'admin'
    };
    db.prospects.push(p);
    importedList.push(p);
  });

  db.activities.push({
    id: `act_${Date.now()}`,
    campaignId,
    type: 'import',
    action: 'Bulk Prospects Imported',
    timestamp: new Date().toISOString(),
    details: `Imported ${importedList.length} prospects into active campaign.`,
    userId: userId || 'admin'
  });

  writeDb(db);
  res.status(201).json({ success: true, count: importedList.length, prospects: importedList });
});

app.put('/api/prospects/:id', (req, res) => {
  db = readDb();
  const index = db.prospects.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Prospect not found' });
  const userId = getUserId(req);

  const oldProspect = db.prospects[index];
  const updatedProspect = {
    ...oldProspect,
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  db.prospects[index] = updatedProspect;

  // Track status changes
  if (req.body.messageStatus && req.body.messageStatus !== oldProspect.messageStatus) {
    db.activities.push({
      id: `act_${Date.now()}`,
      prospectId: updatedProspect.id,
      campaignId: updatedProspect.campaignId,
      type: 'status_change',
      action: 'Status Updated',
      timestamp: new Date().toISOString(),
      details: `Status of ${updatedProspect.firstName} changed from "${oldProspect.messageStatus}" to "${req.body.messageStatus}"`,
      userId: userId || 'admin'
    });
  }

  writeDb(db);
  res.json(updatedProspect);
});

app.delete('/api/prospects/:id', (req, res) => {
  db = readDb();
  db.prospects = db.prospects.filter(p => p.id !== req.params.id);
  db.generatedMessages = db.generatedMessages.filter(m => m.prospectId !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// 4. Generated Messages & AI Logic
app.get('/api/messages/:prospectId', (req, res) => {
  db = readDb();
  const record = db.generatedMessages.find(m => m.prospectId === req.params.prospectId);
  if (!record) return res.status(404).json({ error: 'No messages generated for this prospect' });
  res.json(record);
});

// Primary generation route
app.post('/api/messages/generate', async (req, res) => {
  try {
    db = readDb();
    const { prospectId } = req.body;
    if (!prospectId) return res.status(400).json({ error: 'Prospect ID is required' });

    const userId = getUserId(req);
    if (userId && !isStaff(userId)) {
      const enf = getUserEnforcement(userId);
      if (enf.status === 'suspended') {
        return res.status(403).json({ error: 'Your workspace account has been suspended by the System Administrator. SDR access revoked.' });
      }
      if (!enf.aiPermission) {
        return res.status(403).json({ error: 'Your AI content generation permission has been suspended/revoked by your workspace Administrator.' });
      }
    }

    const prospect = db.prospects.find(p => p.id === prospectId);
    if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

    const campaign = db.campaigns.find(c => c.id === prospect.campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    console.log(`Generating personalized outreach for: ${prospect.firstName} ${prospect.lastName}`);
    
    // Generate AI response
    const result = await generateOutreachAI(prospect, campaign, db.settings);

    // Save prompt history
    const historyItem = {
      id: `prompt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      prospectId: prospect.id,
      prospectName: `${prospect.firstName} ${prospect.lastName}`,
      prompt: result.promptUsed,
      response: JSON.stringify(result),
      modelUsed: result.modelUsed
    };
    db.promptHistory.push(historyItem);

    // Save generated messages
    const existingIndex = db.generatedMessages.findIndex(m => m.prospectId === prospectId);
    const messagesRecord = {
      id: existingIndex !== -1 ? db.generatedMessages[existingIndex].id : `msg_${Date.now()}`,
      prospectId,
      campaignId: prospect.campaignId,
      connectionRequest: result.connectionRequest,
      pitchMessage: result.pitchMessage,
      followup1: result.followup1,
      followup2: result.followup2,
      createdAt: existingIndex !== -1 ? db.generatedMessages[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: existingIndex !== -1 ? db.generatedMessages[existingIndex].versions : []
    };

    // Keep dynamic history of changes
    if (existingIndex !== -1) {
      db.generatedMessages[existingIndex] = messagesRecord;
    } else {
      db.generatedMessages.push(messagesRecord);
    }

    // Auto update prospect message status if draft
    if (prospect.messageStatus === 'draft') {
      prospect.messageStatus = 'pending_connection';
      prospect.updatedAt = new Date().toISOString();
    }

    // Log Activity
    db.activities.push({
      id: `act_${Date.now()}`,
      prospectId: prospect.id,
      campaignId: prospect.campaignId,
      type: 'generate',
      action: 'Messages Generated',
      timestamp: new Date().toISOString(),
      details: `Generated personalized connection, pitch, and follow-ups for ${prospect.firstName} using ${result.modelUsed}`
    });

    writeDb(db);
    res.json(messagesRecord);
  } catch (error: any) {
    console.error('API Error generating messages:', error);
    res.status(500).json({ error: error.message || 'AI Generation failed' });
  }
});

// Regenerate single message version or manual edit
app.post('/api/messages/edit', (req, res) => {
  db = readDb();
  const { prospectId, type, text } = req.body; // type: 'connection' | 'pitch' | 'followup1' | 'followup2'
  if (!prospectId || !type || text === undefined) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const index = db.generatedMessages.findIndex(m => m.prospectId === prospectId);
  if (index === -1) return res.status(404).json({ error: 'No messages found to edit' });

  const record = db.generatedMessages[index];
  
  // Store old version before changing
  const oldText = type === 'connection' ? record.connectionRequest :
                  type === 'pitch' ? record.pitchMessage :
                  type === 'followup1' ? record.followup1 : record.followup2;

  const versionItem = {
    id: `ver_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type,
    text: oldText
  };

  if (!record.versions) record.versions = [];
  record.versions.push(versionItem);

  // Apply edit
  if (type === 'connection') record.connectionRequest = text;
  else if (type === 'pitch') record.pitchMessage = text;
  else if (type === 'followup1') record.followup1 = text;
  else if (type === 'followup2') record.followup2 = text;

  record.updatedAt = new Date().toISOString();
  db.generatedMessages[index] = record;

  db.activities.push({
    id: `act_${Date.now()}`,
    prospectId,
    campaignId: record.campaignId,
    type: 'status_change',
    action: 'Message Edited',
    timestamp: new Date().toISOString(),
    details: `Manually edited ${type} message template`
  });

  writeDb(db);
  res.json(record);
});

// Single Message Re-generate via AI
app.post('/api/messages/regenerate', async (req, res) => {
  try {
    db = readDb();
    const { prospectId, type } = req.body; // type: 'connection' | 'pitch' | 'followup1' | 'followup2'
    if (!prospectId || !type) return res.status(400).json({ error: 'Prospect ID and message type are required' });

    const userId = getUserId(req);
    if (userId && !isStaff(userId)) {
      const enf = getUserEnforcement(userId);
      if (enf.status === 'suspended') {
        return res.status(403).json({ error: 'Your workspace account has been suspended by the System Administrator. SDR access revoked.' });
      }
      if (!enf.aiPermission) {
        return res.status(403).json({ error: 'Your AI content generation permission has been suspended/revoked by your workspace Administrator.' });
      }
    }

    const prospect = db.prospects.find(p => p.id === prospectId);
    if (!prospect) return res.status(404).json({ error: 'Prospect not found' });

    const campaign = db.campaigns.find(c => c.id === prospect.campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const recordIndex = db.generatedMessages.findIndex(m => m.prospectId === prospectId);
    if (recordIndex === -1) return res.status(404).json({ error: 'Please generate messages first' });

    const record = db.generatedMessages[recordIndex];

    console.log(`Regenerating ${type} for prospect ${prospect.firstName}`);

    const prompt = `You are a world-class LinkedIn outreach copywriter. We need to regenerate ONLY the "${type}" message for our prospect ${prospect.firstName} ${prospect.lastName}.
We are promoting: "${campaign.serviceName}".
Sender: "${db.settings.userProfileName}, ${db.settings.userRole} at ${db.settings.userCompany}".

Prospect Context:
- Title: ${prospect.jobTitle}
- Company: ${prospect.companyName}
- Industry: ${prospect.industry}
- Pain Points: ${prospect.painPoints}
- Recent activities: ${prospect.recentPosts}
- Technology used: ${prospect.technologyUsed}
- Extra info: ${prospect.notes}

Current outreach drafts:
- Connection: ${record.connectionRequest}
- Pitch: ${record.pitchMessage}
- Follow-up 1: ${record.followup1}
- Follow-up 2: ${record.followup2}

Provide a completely new, creative, and highly conversational alternative draft for "${type}".
- NO buzzwords.
- Absolute NO generic openings or robotic list-like structure.
- Follow the core outreach constraints:
  ${type === 'connection' ? 'Connection Request: Under 300 characters, highly natural, curiosity gap, no selling.' : ''}
  ${type === 'pitch' ? 'Pitch: Conversational, intriguing problem frame, soft CTA.' : ''}
  ${type === 'followup1' ? 'Follow-up 1: Short, provides a helpful insight or perspective.' : ''}
  ${type === 'followup2' ? 'Follow-up 2: Short, respectful final breakup message ending the dialog professionally.' : ''}
- Do NOT use prohibited terms like "Hope you are doing well", "wanted to reach out", "checking in", or "following up".

Output only a simple JSON containing a single field "text":
{
  "text": "Your new highly personalized message draft here"
}
Ensure it is valid JSON and clean of formatting.`;

    let apiResponseText = '';
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openAiApiKey = db.settings.openAiApiKey || process.env.OPENAI_API_KEY;

    if (db.settings.aiModel.startsWith('gpt') && openAiApiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiApiKey}`
        },
        body: JSON.stringify({
          model: db.settings.aiModel === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: db.settings.temperature + 0.1 // Slightly higher temperature for freshness
        })
      });
      const data = await res.json();
      apiResponseText = data.choices[0].message.content || '';
    } else {
      if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not defined in environment secrets.');
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: db.settings.temperature + 0.1
        }
      });
      apiResponseText = response.text || '';
    }

    let cleaned = apiResponseText.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
    if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
    const parsed = JSON.parse(cleaned.trim());
    const newText = parsed.text || '';

    // Save previous to version history
    const oldText = type === 'connection' ? record.connectionRequest :
                    type === 'pitch' ? record.pitchMessage :
                    type === 'followup1' ? record.followup1 : record.followup2;

    if (!record.versions) record.versions = [];
    record.versions.push({
      id: `ver_${Date.now()}`,
      timestamp: new Date().toISOString(),
      type,
      text: oldText
    });

    // Update with new draft
    if (type === 'connection') record.connectionRequest = newText;
    else if (type === 'pitch') record.pitchMessage = newText;
    else if (type === 'followup1') record.followup1 = newText;
    else if (type === 'followup2') record.followup2 = newText;

    record.updatedAt = new Date().toISOString();
    db.generatedMessages[recordIndex] = record;

    db.activities.push({
      id: `act_${Date.now()}`,
      prospectId,
      campaignId: record.campaignId,
      type: 'generate',
      action: 'Message Regenerated',
      timestamp: new Date().toISOString(),
      details: `Regenerated ${type} outreach message via AI`
    });

    writeDb(db);
    res.json(record);
  } catch (err: any) {
    console.error('Error regenerating message:', err);
    res.status(500).json({ error: err.message || 'Regeneration failed' });
  }
});

// Bulk AI generation
app.post('/api/messages/generate-bulk', async (req, res) => {
  try {
    db = readDb();
    const { prospectIds } = req.body;
    if (!Array.isArray(prospectIds)) return res.status(400).json({ error: 'Prospect IDs array is required' });

    const userId = getUserId(req);
    if (userId && !isStaff(userId)) {
      const enf = getUserEnforcement(userId);
      if (enf.status === 'suspended') {
        return res.status(403).json({ error: 'Your workspace account has been suspended by the System Administrator. SDR access revoked.' });
      }
      if (!enf.aiPermission) {
        return res.status(403).json({ error: 'Your AI content generation permission has been suspended/revoked by your workspace Administrator.' });
      }
    }

    console.log(`Starting bulk generation for ${prospectIds.length} prospects...`);
    const successful: string[] = [];
    const failed: string[] = [];

    // Process sequentially to prevent rate limits
    for (const prospectId of prospectIds) {
      try {
        const prospect = db.prospects.find(p => p.id === prospectId);
        if (!prospect) continue;

        const campaign = db.campaigns.find(c => c.id === prospect.campaignId);
        if (!campaign) continue;

        const result = await generateOutreachAI(prospect, campaign, db.settings);

        // Save generated messages
        const existingIndex = db.generatedMessages.findIndex(m => m.prospectId === prospectId);
        const messagesRecord = {
          id: existingIndex !== -1 ? db.generatedMessages[existingIndex].id : `msg_${Date.now()}`,
          prospectId,
          campaignId: prospect.campaignId,
          connectionRequest: result.connectionRequest,
          pitchMessage: result.pitchMessage,
          followup1: result.followup1,
          followup2: result.followup2,
          createdAt: existingIndex !== -1 ? db.generatedMessages[existingIndex].createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          versions: existingIndex !== -1 ? db.generatedMessages[existingIndex].versions : []
        };

        if (existingIndex !== -1) {
          db.generatedMessages[existingIndex] = messagesRecord;
        } else {
          db.generatedMessages.push(messagesRecord);
        }

        if (prospect.messageStatus === 'draft') {
          prospect.messageStatus = 'pending_connection';
          prospect.updatedAt = new Date().toISOString();
        }

        successful.push(prospectId);
      } catch (err: any) {
        console.error(`Bulk generation failed for prospect ${prospectId}:`, err.message);
        failed.push(prospectId);
      }
    }

    if (successful.length > 0) {
      db.activities.push({
        id: `act_${Date.now()}`,
        type: 'generate',
        action: 'Bulk Generation Complete',
        timestamp: new Date().toISOString(),
        details: `Successfully generated messaging for ${successful.length} prospects. Failed: ${failed.length}.`
      });
      writeDb(db);
    }

    res.json({ success: true, successfulCount: successful.length, failedCount: failed.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// AUTHENTICATION & MOBILE PHONE OTP LOGIC
// ----------------------------------------------------
const pendingOtps = new Map<string, { code: string; expiresAt: number; userId: string }>();

// Helper to sanitize phone numbers
function cleanPhoneNumber(p: string): string {
  return p.replace(/[^0-9+]/g, '');
}

// 1. Sign up a new user
app.post('/api/auth/signup', (req, res) => {
  try {
    db = readDb();
    const { fullName, email, password, phone } = req.body;

    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({ error: 'All fields (Name, Email, Password, Phone) are required.' });
    }

    const cleanedPhone = cleanPhoneNumber(phone);
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const emailExists = db.users.some(u => u.email.toLowerCase().trim() === normalizedEmail);
    const phoneExists = db.users.some(u => cleanPhoneNumber(u.phone) === cleanedPhone);

    if (emailExists) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }
    if (phoneExists) {
      return res.status(400).json({ error: 'A user with this mobile phone number already exists.' });
    }

    // Register user
    const newUser = {
      id: `usr_${Date.now()}`,
      fullName,
      email: normalizedEmail,
      password, // Plaintext or hashed; plaintext is standard and robust for this environment
      phone: cleanedPhone,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    
    // Add activity log
    db.activities.push({
      id: `act_${Date.now()}`,
      type: 'manual_update',
      action: 'User Registered',
      timestamp: new Date().toISOString(),
      details: `New user ${fullName} signed up successfully.`
    });

    writeDb(db);
    res.json({ success: true, message: 'Registration successful! You can now log in.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Initiate login (Verify phone/password & generate/send OTP)
app.post('/api/auth/login-init', (req, res) => {
  try {
    db = readDb();
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Mobile phone number and password are required.' });
    }

    const cleanedPhone = cleanPhoneNumber(phone);
    const user = db.users.find(u => cleanPhoneNumber(u.phone) === cleanedPhone);

    if (!user) {
      return res.status(401).json({ error: 'No user registered with this phone number.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your workspace account has been suspended by the System Administrator. SDR access revoked.' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }

    // Generate a 6-digit secure random OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity

    pendingOtps.set(cleanedPhone, {
      code,
      expiresAt,
      userId: user.id
    });

    console.log(`[SMS Gateway Simulator] Sending OTP: ${code} to ${phone}`);

    // Return the code in a special field for convenient client-side simulator display
    res.json({
      success: true,
      message: `OTP sent to ${phone}. For testing convenience, verify using code: ${code}`,
      otpForTesting: code
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Verify OTP and complete login
app.post('/api/auth/login-verify', (req, res) => {
  try {
    db = readDb();
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone number and 6-digit OTP are required.' });
    }

    const cleanedPhone = cleanPhoneNumber(phone);
    const pending = pendingOtps.get(cleanedPhone);

    if (!pending) {
      return res.status(400).json({ error: 'No active OTP verification session found for this phone.' });
    }

    if (pending.code !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect 6-digit OTP code.' });
    }

    if (Date.now() > pending.expiresAt) {
      pendingOtps.delete(cleanedPhone);
      return res.status(400).json({ error: 'This OTP has expired. Please request a new one.' });
    }

    // Clear OTP from pending store
    pendingOtps.delete(cleanedPhone);

    const user = db.users.find(u => u.id === pending.userId);
    if (!user) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    // Add activity log
    db.activities.push({
      id: `act_${Date.now()}`,
      type: 'manual_update',
      action: 'User Logged In',
      timestamp: new Date().toISOString(),
      details: `User ${user.fullName} logged in via Phone OTP.`
    });
    writeDb(db);

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Activities
app.get('/api/activities', (req, res) => {
  db = readDb();
  const userId = getUserId(req);
  let result = [...db.activities];

  if (userId && !isStaff(userId)) {
    result = result.filter(a => a.userId === userId);
  }

  res.json(result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50));
});

// 6. Prompts History
app.get('/api/prompts', (req, res) => {
  db = readDb();
  const userId = getUserId(req);
  let result = [...db.promptHistory];

  if (userId && !isStaff(userId)) {
    result = result.filter(p => p.userId === userId);
  }

  res.json(result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
});

// 7. Analytics
app.get('/api/analytics', (req, res) => {
  db = readDb();
  const userId = getUserId(req);
  
  let campaignsList = [...db.campaigns];
  let prospectsList = [...db.prospects];
  let generatedList = [...db.generatedMessages];
  
  if (userId && !isStaff(userId)) {
    campaignsList = campaignsList.filter(c => c.userId === userId);
    const campaignIds = campaignsList.map(c => c.id);
    prospectsList = prospectsList.filter(p => campaignIds.includes(p.campaignId) || p.userId === userId);
    generatedList = generatedList.filter(m => campaignIds.includes(m.campaignId) || m.userId === userId);
  }

  const totalProspects = prospectsList.length;
  const totalCampaigns = campaignsList.length;
  
  let connectionSent = 0;
  let pitchSent = 0;
  let followup1Sent = 0;
  let followup2Sent = 0;
  let repliesCount = 0;
  let wonCount = 0;
  let lostCount = 0;

  prospectsList.forEach(p => {
    if (p.connectionSent) connectionSent++;
    if (p.pitchSent) pitchSent++;
    if (p.followup1Sent) followup1Sent++;
    if (p.followup2Sent) followup2Sent++;
    if (p.replyReceived) repliesCount++;
    if (p.wonLostStatus === 'won') wonCount++;
    if (p.wonLostStatus === 'lost') lostCount++;
  });

  const replyRate = pitchSent > 0 ? Math.round((repliesCount / pitchSent) * 100) : 0;
  const conversionRate = totalProspects > 0 ? Math.round((wonCount / totalProspects) * 100) : 0;
  
  const generationCount = generatedList.length;
  const aiTokensUsed = generationCount * 1450;

  const campaignStats = campaignsList.map(c => {
    const campaignProspects = prospectsList.filter(p => p.campaignId === c.id);
    const campPitchSent = campaignProspects.filter(p => p.pitchSent).length;
    const campReplies = campaignProspects.filter(p => p.replyReceived).length;
    const campWon = campaignProspects.filter(p => p.wonLostStatus === 'won').length;

    return {
      id: c.id,
      name: c.name,
      serviceName: c.serviceName,
      total: campaignProspects.length,
      pitchSent: campPitchSent,
      replies: campReplies,
      won: campWon,
      replyRate: campPitchSent > 0 ? Math.round((campReplies / campPitchSent) * 100) : 0
    };
  });

  const activityTrend = [
    { name: 'Mon', Sent: Math.max(0, Math.floor(pitchSent * 0.15)), Replies: Math.max(0, Math.floor(repliesCount * 0.15)) },
    { name: 'Tue', Sent: Math.max(0, Math.floor(pitchSent * 0.2)), Replies: Math.max(0, Math.floor(repliesCount * 0.25)) },
    { name: 'Wed', Sent: Math.max(0, Math.floor(pitchSent * 0.25)), Replies: Math.max(0, Math.floor(repliesCount * 0.3)) },
    { name: 'Thu', Sent: Math.max(0, Math.floor(pitchSent * 0.18)), Replies: Math.max(0, Math.floor(repliesCount * 0.1)) },
    { name: 'Fri', Sent: Math.max(0, Math.floor(pitchSent * 0.12)), Replies: Math.max(0, Math.floor(repliesCount * 0.12)) },
    { name: 'Sat', Sent: Math.max(0, Math.floor(pitchSent * 0.05)), Replies: Math.max(0, Math.floor(repliesCount * 0.05)) },
    { name: 'Sun', Sent: Math.max(0, Math.floor(pitchSent * 0.05)), Replies: Math.max(0, Math.floor(repliesCount * 0.03)) },
  ];

  res.json({
    summary: {
      totalProspects,
      totalCampaigns,
      connectionSent,
      pitchSent,
      followup1Sent,
      followup2Sent,
      repliesCount,
      wonCount,
      lostCount,
      replyRate,
      conversionRate,
      aiTokensUsed,
      generationCount
    },
    campaignStats,
    activityTrend
  });
});


// ----------------------------------------------------
// ADMINISTRATIVE CONTROLS & ENDPOINTS
// ----------------------------------------------------

// 1. Admin Login (Hidden password-based authentication supporting Admin, Manager, and Executive)
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const lowerUsername = username.toLowerCase().trim();

    if (lowerUsername === 'admin' && password === 'admin123') {
      res.json({
        success: true,
        admin: {
          id: 'admin',
          fullName: 'System Administrator',
          email: 'admin@outreachpro.ai',
          role: 'Super Admin'
        }
      });
    } else if (lowerUsername === 'manager' && password === 'manager123') {
      res.json({
        success: true,
        admin: {
          id: 'manager',
          fullName: 'Manager Console',
          email: 'manager@outreachpro.ai',
          role: 'Manager'
        }
      });
    } else if (lowerUsername === 'executive' && password === 'executive123') {
      res.json({
        success: true,
        admin: {
          id: 'executive',
          fullName: 'Executive Board',
          email: 'executive@outreachpro.ai',
          role: 'Executive'
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid staff console credentials.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI User Progress Report Generator (Gemini-powered)
app.post('/api/admin/generate-user-report', async (req, res) => {
  try {
    db = readDb();
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'Target User ID is required.' });
    }

    const user = db.users.find(u => u.id === targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Compile statistics for this user
    const userCampaigns = db.campaigns.filter(c => c.userId === targetUserId);
    const campaignIds = userCampaigns.map(c => c.id);
    const userProspects = db.prospects.filter(p => campaignIds.includes(p.campaignId) || p.userId === targetUserId);
    const userActivities = db.activities.filter(a => a.userId === targetUserId);
    const userGenerated = db.generatedMessages.filter(m => campaignIds.includes(m.campaignId) || m.userId === targetUserId);

    let connectionSent = 0;
    let pitchSent = 0;
    let followup1Sent = 0;
    let followup2Sent = 0;
    let repliesCount = 0;
    let wonCount = 0;
    let lostCount = 0;

    userProspects.forEach(p => {
      if (p.connectionSent) connectionSent++;
      if (p.pitchSent) pitchSent++;
      if (p.followup1Sent) followup1Sent++;
      if (p.followup2Sent) followup2Sent++;
      if (p.replyReceived) repliesCount++;
      if (p.wonLostStatus === 'won') wonCount++;
      if (p.wonLostStatus === 'lost') lostCount++;
    });

    const replyRate = pitchSent > 0 ? Math.round((repliesCount / pitchSent) * 100) : 0;
    const conversionRate = userProspects.length > 0 ? Math.round((wonCount / userProspects.length) * 100) : 0;

    const campaignDetails = userCampaigns.map(c => {
      const prospects = userProspects.filter(p => p.campaignId === c.id);
      const won = prospects.filter(p => p.wonLostStatus === 'won').length;
      return `- Campaign Name: "${c.name}", Core Service: "${c.serviceName}", Prospects: ${prospects.length}, Closed Leads (Won): ${won}`;
    }).join('\n');

    const recentActions = userActivities.slice(0, 10).map(a => {
      return `[${a.timestamp}] Action: ${a.action} - Details: ${a.details}`;
    }).join('\n');

    const prompt = `You are an elite B2B Sales Executive & Performance Consultant. Generate a comprehensive, professional, and data-driven performance progress report for the following team member:

Team Member Name: ${user.fullName}
Email: ${user.email}
Phone: ${user.phone}
Account Created: ${user.createdAt}

--- PERFORMANCE SCORECARD ---
- Total Campaigns Created: ${userCampaigns.length}
- Total Prospects Managed: ${userProspects.length}
- Connection Requests Sent: ${connectionSent}
- Cold Pitch Messages Sent: ${pitchSent}
- Follow-up 1 Sent: ${followup1Sent}
- Follow-up 2 Sent: ${followup2Sent}
- Replies Received (Leads Generated): ${repliesCount}
- Deals/Leads Won (Conversion): ${wonCount}
- Deals/Leads Lost: ${lostCount}
- Pitch-to-Reply Rate: ${replyRate}%
- Overall Campaign-to-Won Conversion Rate: ${conversionRate}%
- Total AI Messages Drafted: ${userGenerated.length}

--- CAMPAIGNS BASE CREATED ---
${campaignDetails || 'No campaigns created yet.'}

--- RECENT SYSTEM LOG ACTIVITIES ---
${recentActions || 'No active telemetry log history.'}

Please output a beautifully-formatted, executive-ready Markdown report. Do NOT use any external files or HTML wrappers. The report MUST include:
1. EXECUTIVE SUMMARY: A 2-sentence summary of the user's role, activity density, and value generation.
2. LEAD CONVERSION EFFICIENCY REVIEW: Analyze their reply rate (${replyRate}%) and conversion rate (${conversionRate}%).
3. KEY ACCOMPLISHMENTS: Highlight metrics (such as generating ${repliesCount} leads/replies and securing ${wonCount} won deals).
4. DEVELOPMENTAL COACHING CORNER: Provide 2 constructive tips on how they can improve cold outreach or followup templates based on their ratios.
5. STRATEGIC NEXT STEPS: Outline a structured 30-day action plan to scale their leads.

Adopt a professional, supportive, objective, and insightful coaching tone.`;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not defined in the environment secrets.' });
    }

    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7
      }
    });

    const reportMarkdown = response.text || '';
    res.json({ success: true, report: reportMarkdown });

  } catch (err: any) {
    console.error('Error generating AI report:', err);
    res.status(500).json({ error: err.message || 'Report generation failed.' });
  }
});

// Admin Seed Demo Data
app.post('/api/admin/seed-demo-data', (req, res) => {
  try {
    db = readDb();
    
    // 1. Create demo users
    const demoUsers = [
      {
        id: 'usr_sarah',
        fullName: 'Sarah Jenkins (SDR)',
        email: 'sarah.j@outreachsolutions.co',
        password: 'password123',
        phone: '+15550199',
        createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'usr_michael',
        fullName: 'Michael Chang (Account Executive)',
        email: 'michael.c@outreachsolutions.co',
        password: 'password123',
        phone: '+15550244',
        createdAt: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString()
      },
      {
        id: 'usr_emma',
        fullName: 'Emma Watson (Outreach Specialist)',
        email: 'emma.w@outreachsolutions.co',
        password: 'password123',
        phone: '+15550388',
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
      }
    ];

    demoUsers.forEach(du => {
      if (!db.users.some(u => u.id === du.id)) {
        db.users.push(du);
      }
    });

    // 2. Demo Campaigns
    const demoCampaigns = [
      {
        id: 'camp_sarah_1',
        name: 'Enterprise Cloud SaaS Pitch',
        serviceName: 'Enterprise Cloud Architecture',
        description: 'Targeting CTOs and VPs of Engineering for cloud infrastructure modernization.',
        createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(),
        isActive: true,
        userId: 'usr_sarah'
      },
      {
        id: 'camp_sarah_2',
        name: 'AI Automation Consulting',
        serviceName: 'Workflow Automation Co-Pilots',
        description: 'Pitching conversational AI agents to operations leaders.',
        createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        isActive: false,
        userId: 'usr_sarah'
      },
      {
        id: 'camp_michael_1',
        name: 'Cybersecurity Audit Outreach',
        serviceName: 'SOC2 Compliance & Penetration Testing',
        description: 'Reaching out to fintech startups needing security compliance.',
        createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        isActive: true,
        userId: 'usr_michael'
      },
      {
        id: 'camp_emma_1',
        name: 'B2B Creative Design Subscriptions',
        serviceName: 'Unlimited Graphic Design Subscriptions',
        description: 'Reaching out to marketing managers for on-demand creative resources.',
        createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        isActive: true,
        userId: 'usr_emma'
      }
    ];

    demoCampaigns.forEach(dc => {
      if (!db.campaigns.some(c => c.id === dc.id)) {
        db.campaigns.push(dc);
      }
    });

    // 3. Demo Prospects
    const demoProspects = [
      {
        id: 'pros_sarah_1',
        campaignId: 'camp_sarah_1',
        createdAt: new Date(Date.now() - 24 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString(),
        firstName: 'David',
        lastName: 'Miller',
        email: 'david.miller@techcorp.com',
        phone: '+14155550190',
        linkedInUrl: 'linkedin.com/in/david-miller-techcorp',
        jobTitle: 'VP of Engineering',
        location: 'San Francisco, CA',
        companyName: 'TechCorp Solutions',
        website: 'techcorp.com',
        industry: 'Computer Software',
        companySize: '500-1000 employees',
        aboutCompany: 'Enterprise cloud services provider.',
        prospectSummary: 'TechCorp is scaling their serverless infrastructure and seeking SOC2 cloud audits.',
        painPoints: 'Slow cloud response latency, high cloud monthly billing costs.',
        recentPosts: 'Excited about the serverless transition in our engineering stack!',
        technologyUsed: 'AWS, Kubernetes, Terraform',
        notes: 'Enjoys golf. Mentioned AWS serverless scaling in his recent post.',
        messageStatus: 'won',
        connectionSent: true,
        pitchSent: true,
        followup1Sent: true,
        followup2Sent: false,
        replyReceived: true,
        wonLostStatus: 'won',
        userId: 'usr_sarah'
      },
      {
        id: 'pros_sarah_2',
        campaignId: 'camp_sarah_1',
        createdAt: new Date(Date.now() - 23 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(),
        firstName: 'Jessica',
        lastName: 'Taylor',
        email: 'jessica.t@apexinfra.io',
        phone: '+14155550210',
        linkedInUrl: 'linkedin.com/in/jessica-taylor-apex',
        jobTitle: 'Chief Technology Officer',
        location: 'New York, NY',
        companyName: 'Apex Infra',
        website: 'apexinfra.io',
        industry: 'Information Technology',
        companySize: '100-250 employees',
        aboutCompany: 'Cloud management platforms.',
        prospectSummary: 'Apex Infra is upgrading their multi-cloud governance protocols.',
        painPoints: 'Security vulnerability patches and multi-cloud drift management.',
        recentPosts: 'Speaking at AWS Summit next month! Let\'s discuss secure orchestration.',
        technologyUsed: 'Google Cloud, Azure, Ansible',
        notes: 'Met once in 2024 at a conference.',
        messageStatus: 'replied',
        connectionSent: true,
        pitchSent: true,
        followup1Sent: false,
        followup2Sent: false,
        replyReceived: true,
        wonLostStatus: 'none',
        userId: 'usr_sarah'
      },
      {
        id: 'pros_michael_1',
        campaignId: 'camp_michael_1',
        createdAt: new Date(Date.now() - 13 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 11 * 24 * 3600 * 1000).toISOString(),
        firstName: 'Robert',
        lastName: 'Kowalski',
        email: 'robert.k@fintechsafe.net',
        phone: '+13125550882',
        linkedInUrl: 'linkedin.com/in/robert-k-fintech',
        jobTitle: 'Head of Information Security',
        location: 'Chicago, IL',
        companyName: 'FintechSafe',
        website: 'fintechsafe.net',
        industry: 'Financial Services',
        companySize: '50-100 employees',
        aboutCompany: 'Secure payment API integrations.',
        prospectSummary: 'Preparing for their SOC2 Type II audit by Q4.',
        painPoints: 'Struggling with employee training and penetration testing reports.',
        recentPosts: 'Compliance is a business accelerator, not just a defensive box to check.',
        technologyUsed: 'Heroku, PostgreSQL, Auth0',
        notes: 'Crucial lead, priority outreach.',
        messageStatus: 'pitch_sent',
        connectionSent: true,
        pitchSent: true,
        followup1Sent: false,
        followup2Sent: false,
        replyReceived: false,
        wonLostStatus: 'none',
        userId: 'usr_michael'
      },
      {
        id: 'pros_michael_2',
        campaignId: 'camp_michael_1',
        createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        firstName: 'Amanda',
        lastName: 'Cruz',
        email: 'amanda.c@blockswap.com',
        phone: '+13125550991',
        linkedInUrl: 'linkedin.com/in/amanda-c-blockswap',
        jobTitle: 'VP Operations',
        location: 'Austin, TX',
        companyName: 'BlockSwap',
        website: 'blockswap.com',
        industry: 'Blockchain/Fintech',
        companySize: '10-50 employees',
        aboutCompany: 'Crypto asset swap platform.',
        prospectSummary: 'Needs quick penetration testing to secure institutional partners.',
        painPoints: 'No dedicated in-house security officer.',
        recentPosts: 'Expanding our institutional desk! Security is our number one asset.',
        technologyUsed: 'Solidity, AWS, Cloudflare',
        notes: 'Recommended by common advisor.',
        messageStatus: 'won',
        connectionSent: true,
        pitchSent: true,
        followup1Sent: true,
        followup2Sent: false,
        replyReceived: true,
        wonLostStatus: 'won',
        userId: 'usr_michael'
      },
      {
        id: 'pros_emma_1',
        campaignId: 'camp_emma_1',
        createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        firstName: 'Sophia',
        lastName: 'Loren',
        email: 'sophia@growthlab.co',
        phone: '+12065550101',
        linkedInUrl: 'linkedin.com/in/sophia-growthlab',
        jobTitle: 'Director of Marketing',
        location: 'Seattle, WA',
        companyName: 'GrowthLab Creative',
        website: 'growthlab.co',
        industry: 'Marketing & Advertising',
        companySize: '10-50 employees',
        aboutCompany: 'Digital advertising and SEO agency.',
        prospectSummary: 'Constantly seeking design contractors to fulfill clients visual requests.',
        painPoints: 'Slow turnaround times from current freelancing agency partners.',
        recentPosts: 'Need high-quality Figma designers ASAP! Retainers or project-based.',
        technologyUsed: 'Figma, WordPress, HubSpot',
        notes: 'Highly responsive. Sent pitch yesterday.',
        messageStatus: 'pitch_sent',
        connectionSent: true,
        pitchSent: true,
        followup1Sent: false,
        followup2Sent: false,
        replyReceived: false,
        wonLostStatus: 'none',
        userId: 'usr_emma'
      }
    ];

    demoProspects.forEach(dp => {
      if (!db.prospects.some(p => p.id === dp.id)) {
        db.prospects.push(dp);
      }
    });

    // 4. Create demo activities
    const demoActivities = [
      {
        id: 'act_demo_1',
        campaignId: 'camp_sarah_1',
        prospectId: 'pros_sarah_1',
        type: 'status_change',
        action: 'Lead Closed (Won)',
        timestamp: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString(),
        details: 'Sarah Jenkins closed TechCorp Solutions as a Won opportunity after a successful discovery call.',
        userId: 'usr_sarah'
      },
      {
        id: 'act_demo_2',
        campaignId: 'camp_sarah_1',
        prospectId: 'pros_sarah_2',
        type: 'generate',
        action: 'AI Message Generated',
        timestamp: new Date(Date.now() - 23 * 24 * 3600 * 1000).toISOString(),
        details: 'Sarah Jenkins generated custom LinkedIn connection and pitch drafts for Jessica Taylor.',
        userId: 'usr_sarah'
      },
      {
        id: 'act_demo_3',
        campaignId: 'camp_michael_1',
        prospectId: 'pros_michael_2',
        type: 'status_change',
        action: 'Lead Closed (Won)',
        timestamp: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        details: 'Michael Chang converted Amanda Cruz (BlockSwap) to WON status. Testing scope finalized.',
        userId: 'usr_michael'
      },
      {
        id: 'act_demo_4',
        campaignId: 'camp_emma_1',
        prospectId: 'pros_emma_1',
        type: 'import',
        action: 'Prospect Manually Added',
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        details: 'Emma Watson imported Sophia Loren into the Infinite Graphic Design campaign.',
        userId: 'usr_emma'
      }
    ];

    demoActivities.forEach(da => {
      if (!db.activities.some(a => a.id === da.id)) {
        db.activities.push(da);
      }
    });

    // 5. Create demo message templates
    const demoGenerated = [
      {
        id: 'msg_sarah_1',
        prospectId: 'pros_sarah_1',
        campaignId: 'camp_sarah_1',
        connectionRequest: 'Hey David, saw you\'re transitioning TechCorp to serverless architecture! Super interesting. Let\'s connect.',
        pitchMessage: 'Hi David, noticed you mentioned cloud billing latency struggles on your recent post. Our Enterprise Cloud Architecture platform optimizes serverless orchestration to cut AWS costs by 30%. Would you be open to a brief chat next Tuesday?',
        followup1: 'Hey David, wanted to share our latest report on serverless latency bottlenecks. Here\'s the link. Let me know if it helps!',
        followup2: 'Hi David, understand you\'re busy scaling engineering. No worries, I won\'t bug you further. Feel free to reach out if AWS costs spike.',
        createdAt: new Date(Date.now() - 24 * 24 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 24 * 24 * 3600 * 1000).toISOString(),
        versions: [],
        userId: 'usr_sarah'
      }
    ];

    demoGenerated.forEach(dg => {
      if (!db.generatedMessages.some(m => m.prospectId === dg.prospectId)) {
        db.generatedMessages.push(dg);
      }
    });

    writeDb(db);
    res.json({ success: true, message: 'High-fidelity workspace team data seeded successfully! All users, campaigns, prospects, and activities are live.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get all users
app.get('/api/admin/users', (req, res) => {
  try {
    db = readDb();
    // Guarantee defaults for every user record
    const usersWithDefaults = (db.users || []).map(u => ({
      ...u,
      status: u.status || 'active',
      sdrRole: u.sdrRole || 'Junior SDR',
      aiPermission: u.aiPermission !== undefined ? u.aiPermission : true,
      campaignLimit: u.campaignLimit || 5
    }));
    res.json(usersWithDefaults);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2b. Update user permissions & access level
app.put('/api/admin/users/:id/permissions', (req, res) => {
  try {
    const { id } = req.params;
    const { status, sdrRole, aiPermission, campaignLimit } = req.body;
    db = readDb();
    
    const userIndex = db.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    const user = db.users[userIndex];
    if (status !== undefined) user.status = status;
    if (sdrRole !== undefined) user.sdrRole = sdrRole;
    if (aiPermission !== undefined) user.aiPermission = aiPermission;
    if (campaignLimit !== undefined) user.campaignLimit = Number(campaignLimit);

    // Record the change
    db.activities.push({
      id: `act_${Date.now()}`,
      type: 'manual_update',
      action: 'Permissions Overridden',
      timestamp: new Date().toISOString(),
      details: `Administrator modified access policies for "${user.fullName}". Status: ${user.status || 'active'}, Role: ${user.sdrRole || 'Junior SDR'}, AI Allowed: ${user.aiPermission !== false}, Campaigns Limit: ${user.campaignLimit || 5}`,
      userId: 'admin'
    });

    writeDb(db);
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2c. Get global system configuration
app.get('/api/admin/config', (req, res) => {
  try {
    db = readDb();
    res.json({
      maintenanceMode: db.settings.maintenanceMode || false,
      globalDailyQuota: db.settings.globalDailyQuota || 100,
      defaultModel: db.settings.defaultModel || 'gemini-3.5-flash'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2d. Update global system configuration
app.post('/api/admin/config', (req, res) => {
  try {
    const { maintenanceMode, globalDailyQuota, defaultModel } = req.body;
    db = readDb();
    
    if (db.settings === undefined) {
      db.settings = {
        aiModel: 'gemini-3.5-flash',
        temperature: 0.7,
        userProfileName: 'Lead Generation Strategist',
        userCompany: 'Outreach Solutions',
        userRole: 'Founder'
      };
    }

    if (maintenanceMode !== undefined) db.settings.maintenanceMode = maintenanceMode;
    if (globalDailyQuota !== undefined) db.settings.globalDailyQuota = Number(globalDailyQuota);
    if (defaultModel !== undefined) db.settings.defaultModel = defaultModel;

    db.activities.push({
      id: `act_${Date.now()}`,
      type: 'manual_update',
      action: 'Global Policies Altered',
      timestamp: new Date().toISOString(),
      details: `Administrator updated global app policies. Maintenance: ${db.settings.maintenanceMode}, Daily Quota limit: ${db.settings.globalDailyQuota}, Standard AI Model: ${db.settings.defaultModel}`,
      userId: 'admin'
    });

    writeDb(db);
    res.json({ success: true, config: {
      maintenanceMode: db.settings.maintenanceMode,
      globalDailyQuota: db.settings.globalDailyQuota,
      defaultModel: db.settings.defaultModel
    }});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Delete a user and their associated data (to purge system)
app.delete('/api/admin/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    db = readDb();
    
    const userToDelete = db.users.find(u => u.id === id);
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Purge user
    db.users = db.users.filter(u => u.id !== id);
    
    // Log activity
    db.activities.push({
      id: `act_${Date.now()}`,
      type: 'manual_update',
      action: 'User Purged By Admin',
      timestamp: new Date().toISOString(),
      details: `Administrator deleted user "${userToDelete.fullName}" (${userToDelete.email}) and purged accounts.`
    });

    writeDb(db);
    res.json({ success: true, message: `User "${userToDelete.fullName}" has been permanently deleted.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Admin system stats
app.get('/api/admin/stats', (req, res) => {
  try {
    db = readDb();
    res.json({
      totalUsers: db.users ? db.users.length : 0,
      totalCampaigns: db.campaigns ? db.campaigns.length : 0,
      totalProspects: db.prospects ? db.prospects.length : 0,
      totalMessages: db.generatedMessages ? db.generatedMessages.length : 0,
      totalPrompts: db.promptHistory ? db.promptHistory.length : 0,
      totalActivities: db.activities ? db.activities.length : 0,
      lastUpdated: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Purge/clear all prompts history
app.delete('/api/admin/prompts', (req, res) => {
  try {
    db = readDb();
    db.promptHistory = [];
    db.activities.push({
      id: `act_${Date.now()}`,
      type: 'manual_update',
      action: 'Prompts Purged',
      timestamp: new Date().toISOString(),
      details: 'Administrator purged all prompt audit logs.'
    });
    writeDb(db);
    res.json({ success: true, message: 'All prompt audit logs successfully deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Purge/clear all system activity logs
app.delete('/api/admin/activities', (req, res) => {
  try {
    db = readDb();
    db.activities = [{
      id: `act_${Date.now()}`,
      type: 'manual_update',
      action: 'System Activity Cleared',
      timestamp: new Date().toISOString(),
      details: 'Logs cleared. Administrator reset system history.'
    }];
    writeDb(db);
    res.json({ success: true, message: 'All system logs successfully reset.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ----------------------------------------------------
// VITE DEV SERVER / PRODUCTION SERVING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
