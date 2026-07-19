/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Campaign {
  id: string;
  name: string;
  serviceName: string;
  createdAt: string;
  description?: string;
  isActive: boolean;
}

export interface Prospect {
  id: string;
  campaignId: string;
  createdAt: string;
  updatedAt: string;
  
  // Basic Info
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  linkedInUrl: string;
  jobTitle: string;
  location: string;
  
  // Company Info
  companyName: string;
  website: string;
  industry: string;
  companySize: string;
  aboutCompany: string;
  
  // Custom context for generating messages
  prospectSummary: string;
  painPoints: string;
  recentPosts: string;
  technologyUsed: string;
  notes: string;
  additionalContext?: string;
  customFields?: Record<string, string>;

  // Outreach Statuses
  messageStatus: 'draft' | 'pending_connection' | 'connection_sent' | 'pitch_sent' | 'followup_1_sent' | 'followup_2_sent' | 'replied' | 'won' | 'lost';
  connectionSent: boolean;
  pitchSent: boolean;
  followup1Sent: boolean;
  followup2Sent: boolean;
  replyReceived: boolean;
  wonLostStatus: 'none' | 'won' | 'lost';
}

export interface MessageVersion {
  id: string;
  timestamp: string;
  type: 'connection' | 'pitch' | 'followup1' | 'followup2';
  text: string;
}

export interface GeneratedMessages {
  id: string;
  prospectId: string;
  campaignId: string;
  connectionRequest: string;
  pitchMessage: string;
  followup1: string;
  followup2: string;
  createdAt: string;
  updatedAt: string;
  versions: MessageVersion[];
}

export interface Activity {
  id: string;
  prospectId?: string;
  campaignId?: string;
  type: 'import' | 'generate' | 'status_change' | 'note_added' | 'manual_update';
  action: string;
  timestamp: string;
  details: string;
}

export interface PromptHistoryItem {
  id: string;
  timestamp: string;
  prospectId: string;
  prospectName: string;
  prompt: string;
  response: string;
  modelUsed: string;
}

export interface Template {
  id: string;
  name: string;
  type: 'connection' | 'pitch' | 'followup1' | 'followup2';
  body: string;
  createdAt: string;
}

export interface AppSettings {
  aiModel: 'gemini-3.5-flash' | 'gpt-4o-mini' | 'gpt-4o';
  temperature: number;
  openAiApiKey?: string;
  userProfileName: string;
  userCompany: string;
  userRole: string;
}

export interface DashboardStats {
  totalProspects: number;
  totalCampaigns: number;
  connectionSent: number;
  pitchSent: number;
  followup1Sent: number;
  followup2Sent: number;
  repliesCount: number;
  wonCount: number;
  lostCount: number;
  replyRate: number;
  conversionRate: number;
  aiTokensUsed: number;
  generationCount: number;
}
