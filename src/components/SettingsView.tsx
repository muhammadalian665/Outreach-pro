/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Sparkles, 
  User, 
  Settings, 
  Eye, 
  EyeOff, 
  Trash2, 
  Check, 
  Sliders, 
  FileCode, 
  Info, 
  Database,
  ArrowRight,
  Shield,
  Save
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppSettings, Campaign, PromptHistoryItem } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  campaigns: Campaign[];
  promptHistory: PromptHistoryItem[];
  onSaveSettings: (updates: Partial<AppSettings>) => void;
  onDeleteCampaign: (id: string) => void;
  isAdmin?: boolean;
}

export default function SettingsView({ 
  settings, 
  campaigns, 
  promptHistory, 
  onSaveSettings,
  onDeleteCampaign,
  isAdmin = false
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'campaigns' | 'audit'>('profile');
  
  // Local editable settings
  const [aiModel, setAiModel] = useState(settings.aiModel);
  const [temperature, setTemperature] = useState(settings.temperature);
  const [openAiApiKey, setOpenAiApiKey] = useState(settings.openAiApiKey || '');
  const [userProfileName, setUserProfileName] = useState(settings.userProfileName);
  const [userCompany, setUserCompany] = useState(settings.userCompany);
  const [userRole, setUserRole] = useState(settings.userRole);

  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    onSaveSettings({
      aiModel,
      temperature,
      openAiApiKey,
      userProfileName,
      userCompany,
      userRole
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 font-sans" id="settings-view-viewport">
      
      {/* Sidebar navigation */}
      <div className="md:col-span-1 space-y-2.5">
        <div className="p-4 bg-bento-card border border-bento-border rounded-3xl">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 font-display">Workspace Settings</p>
          <div className="space-y-1">
            {[
              { id: 'profile', label: 'Sender Profile', icon: User },
              { id: 'ai', label: 'AI Configuration', icon: Sliders },
              ...(isAdmin ? [
                { id: 'campaigns', label: 'Campaigns Base', icon: Database },
                { id: 'audit', label: 'Prompt Audit Logs', icon: FileCode }
              ] : [])
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl text-left cursor-pointer transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-bento-card-active text-indigo-400 font-bold border border-bento-border-highlight' 
                    : 'text-gray-400 hover:text-white hover:bg-bento-card-hover'
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Security Warning panel */}
        <div className="p-4 bg-[#0A0A0B]/40 border border-bento-border rounded-3xl space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-display">
            <Shield size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Secure Co-Processor</span>
          </div>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            API keys and campaigns are parsed server-side. Sensitive tokens are never transmitted to user browsers.
          </p>
        </div>
      </div>

      {/* Primary configuration forms */}
      <div className="md:col-span-3 p-6 bg-bento-card border border-bento-border rounded-3xl flex flex-col justify-between" id="settings-stage">
        <div className="space-y-6">
          {/* TAB 1: SENDER PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="space-y-1 font-display">
                <h3 className="text-base font-semibold text-white">Sender Outreach Persona</h3>
                <p className="text-gray-400 text-xs font-sans">Customize who is reaching out so the AI aligns pitches perfectly.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                <div className="space-y-1.5">
                  <label className="text-gray-400 font-semibold">Your Full Name</label>
                  <input
                    id="sender-profile-name-input"
                    type="text"
                    value={userProfileName}
                    onChange={(e) => setUserProfileName(e.target.value)}
                    placeholder="e.g. Alice Johnson"
                    className="w-full bg-[#0A0A0B] border border-bento-border focus:border-indigo-500 focus:outline-none rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-400 font-semibold">Your Company Name</label>
                  <input
                    id="sender-profile-company-input"
                    type="text"
                    value={userCompany}
                    onChange={(e) => setUserCompany(e.target.value)}
                    placeholder="e.g. Outreach Labs"
                    className="w-full bg-[#0A0A0B] border border-bento-border focus:border-indigo-500 focus:outline-none rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-gray-400 font-semibold">Your Title / Role Signature</label>
                  <input
                    id="sender-profile-role-input"
                    type="text"
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                    placeholder="e.g. VP of Business Development"
                    className="w-full bg-[#0A0A0B] border border-bento-border focus:border-indigo-500 focus:outline-none rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-[#0A0A0B] border border-bento-border rounded-2xl space-y-1 text-xs">
                <p className="font-semibold text-indigo-400">Why signature persona matters:</p>
                <p className="text-gray-500 leading-relaxed text-[11px]">
                  When AI generates pitches, it contextualizes who you are in relation to the prospect's pain. (e.g. "I see you are expanding your engineering team, as a SaaS Architect, I thought I'd suggest...")
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: AI CONFIGURATION */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="space-y-1 font-display">
                <h3 className="text-base font-semibold text-white">AI Coprocessor Engines</h3>
                <p className="text-gray-400 text-xs font-sans">Configure LLM defaults and prompt creativity metrics.</p>
              </div>

              <div className="space-y-4 pt-2 text-xs">
                <div className="space-y-1.5">
                  <label className="text-gray-400 font-semibold">Default Generation Model</label>
                  <select
                    id="settings-model-selector"
                    value={aiModel}
                    onChange={(e: any) => setAiModel(e.target.value)}
                    className="w-full bg-[#0A0A0B] border border-bento-border focus:border-indigo-500 focus:outline-none text-gray-300 rounded-xl p-2.5 cursor-pointer"
                  >
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (Preconfigured / Zero setup)</option>
                    <option value="gpt-4o-mini">OpenAI GPT-4o-Mini (Requires API key)</option>
                    <option value="gpt-4o">OpenAI GPT-4o (Requires API key)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span className="font-semibold">Temperature (Creativity Ratio)</span>
                    <span className="text-indigo-400 font-mono font-bold">{temperature}</span>
                  </div>
                  <input
                    id="settings-temp-slider"
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 bg-[#0A0A0B] h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>Rigid / Predictable</span>
                    <span>Highly Creative / Personal</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-bento-border">
                  <label className="text-gray-400 font-semibold block">OpenAI Secret API Key</label>
                  <div className="relative">
                    <input
                      id="openai-api-key-input"
                      type={showKey ? 'text' : 'password'}
                      value={openAiApiKey}
                      onChange={(e) => setOpenAiApiKey(e.target.value)}
                      placeholder="sk-proj-..."
                      className="w-full bg-[#0A0A0B] border border-bento-border focus:border-indigo-500 focus:outline-none rounded-xl p-2.5 text-white pr-10"
                    />
                    <button
                      id="toggle-openai-key-visibility-btn"
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white cursor-pointer"
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Custom OpenAI keys are saved in local configurations. Leave blank to default to pre-configured Gemini models.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CAMPAIGNS BASE */}
          {activeTab === 'campaigns' && (
            <div className="space-y-4">
              <div className="space-y-1 font-display">
                <h3 className="text-base font-semibold text-white">Campaign Management</h3>
                <p className="text-gray-400 text-xs font-sans">Manage B2B services and delete old outreach pipelines.</p>
              </div>

              <div className="divide-y divide-bento-border bg-[#0A0A0B]/40 border border-bento-border rounded-2xl overflow-hidden text-xs">
                {campaigns.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    No campaigns created yet.
                  </div>
                ) : (
                  campaigns.map((camp) => (
                    <div key={camp.id} className="p-4 flex items-center justify-between gap-4 hover:bg-[#0A0A0B]/60 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{camp.name}</span>
                          {camp.isActive && (
                            <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-wider font-mono">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-[11px]">Service: {camp.serviceName}</p>
                        {camp.description && <p className="text-gray-500 text-[10px] leading-relaxed italic">{camp.description}</p>}
                      </div>
                      <button
                        id={`delete-campaign-${camp.id}-btn`}
                        onClick={() => onDeleteCampaign(camp.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete campaign and associated leads"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PROMPT AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="space-y-1 font-display">
                <h3 className="text-base font-semibold text-white">Prompt Execution Auditing</h3>
                <p className="text-gray-400 text-xs font-sans">See raw copy instructions and direct responses returned from LLMs.</p>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 text-xs">
                {promptHistory.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 border border-dashed border-bento-border rounded-3xl">
                    No LLM operations recorded yet.
                  </div>
                ) : (
                  promptHistory.map((hist) => (
                    <div key={hist.id} className="p-4 bg-[#0A0A0B]/60 border border-bento-border rounded-2xl space-y-3.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-white">Prospect: {hist.prospectName}</span>
                        <div className="flex gap-2 items-center text-gray-500">
                          <span className="px-1.5 py-0.5 rounded bg-bento-card-active text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                            {hist.modelUsed}
                          </span>
                          <span className="font-mono">{new Date(hist.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Transmitted Persona Context</span>
                        <pre className="p-2.5 bg-[#0A0A0B] rounded-xl border border-bento-border overflow-x-auto text-[10px] font-mono leading-relaxed text-gray-400 max-h-32">
                          {hist.prompt}
                        </pre>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Global Configuration Save */}
        {activeTab !== 'campaigns' && activeTab !== 'audit' && (
          <div className="pt-6 border-t border-bento-border flex justify-end">
            <button
              id="save-settings-btn"
              onClick={handleSave}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
            >
              {isSaved ? <Check size={14} className="text-emerald-300" /> : <Save size={14} />}
              {isSaved ? 'Settings Saved' : 'Commit Configuration'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
