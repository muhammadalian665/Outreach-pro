/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Users, 
  Send, 
  MessageSquare, 
  TrendingUp, 
  Award, 
  Layers, 
  Sliders, 
  Database,
  Archive,
  Menu,
  ChevronRight,
  Shield,
  LayoutDashboard,
  FolderLock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Subcomponents
import Dashboard from './components/Dashboard';
import LeadsHub from './components/LeadsHub';
import Importer from './components/Importer';
import SettingsView from './components/SettingsView';
import AuthView from './components/AuthView';
import AdminDashboard from './components/AdminDashboard';

import { Campaign, Prospect, AppSettings, DashboardStats, Activity, PromptHistoryItem } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Authentication State
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string; email: string; phone: string } | null>(() => {
    const stored = localStorage.getItem('outreach_user');
    if (stored) {
      try { return JSON.parse(stored); } catch (_) { return null; }
    }
    return null;
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [adminUserSandboxMode, setAdminUserSandboxMode] = useState(false);

  // App schemas & states
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string>('');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [promptHistory, setPromptHistory] = useState<PromptHistoryItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    aiModel: 'gemini-3.5-flash',
    temperature: 0.7,
    openAiApiKey: '',
    userProfileName: 'Lead Generation Strategist',
    userCompany: 'Outreach Solutions',
    userRole: 'Founder'
  });
  const [stats, setStats] = useState<any>(null);

  // Custom Delete confirmation modal
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    type: 'prospect' | 'campaign';
    id: string;
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: 'prospect',
    id: '',
    title: '',
    description: ''
  });

  // STEP 1 Modal: Ask ONLY ONCE if no campaign exists
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomeCampaignName, setWelcomeCampaignName] = useState('Outreach Campaign #1');
  const [welcomeService, setWelcomeService] = useState('Custom Software Development');

  // Loading States
  const [isLoading, setIsLoading] = useState(true);

  // Authenticated fetch wrapper to secure all API operations and automatically handle suspension checks
  const authFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = {
      ...(init?.headers || {}),
      'x-user-id': currentUser?.id || ''
    };
    try {
      const res = await fetch(input, { ...init, headers });
      if (res.status === 403) {
        const data = await res.clone().json().catch(() => ({}));
        if (data.error && data.error.includes('suspended')) {
          localStorage.removeItem('outreach_user');
          setCurrentUser(null);
          alert(`Access Revoked:\n\n${data.error}`);
          window.location.reload();
          return res;
        }
      }
      return res;
    } catch (err) {
      console.error('Authenticated Request Failed:', err);
      throw err;
    }
  };

  // Refresh all state fields from custom REST server APIs
  const refreshAllData = async (currentCampId?: string) => {
    try {
      // Fetch Campaigns
      const campRes = await authFetch('/api/campaigns');
      if (!campRes.ok) throw new Error('Failed to load campaigns');
      const campsData: Campaign[] = await campRes.json();
      setCampaigns(campsData);

      // Resolve active campaign ID
      let resolvedCampId = currentCampId || activeCampaignId;
      if (!resolvedCampId && campsData.length > 0) {
        const activeCamp = campsData.find(c => c.isActive) || campsData[0];
        resolvedCampId = activeCamp.id;
        setActiveCampaignId(resolvedCampId);
      }

      // If absolutely no campaigns exist, trigger Step 1 Modal
      if (campsData.length === 0) {
        setShowWelcomeModal(true);
        setIsLoading(false);
        return;
      } else {
        setShowWelcomeModal(false);
      }

      // Fetch settings
      const settingsRes = await authFetch('/api/settings');
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }

      // Fetch prospects for active campaign
      if (resolvedCampId) {
        const prospectsRes = await authFetch(`/api/prospects?campaignId=${resolvedCampId}`);
        if (prospectsRes.ok) {
          const prospectsData = await prospectsRes.json();
          setProspects(prospectsData);
        }
      }

      // Fetch logs and history
      const actRes = await authFetch('/api/activities');
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivities(actData);
      }

      const promptRes = await authFetch('/api/prompts');
      if (promptRes.ok) {
        const promptData = await promptRes.json();
        setPromptHistory(promptData);
      }

      // Fetch complete analytics stats
      const statsRes = await authFetch('/api/analytics');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('State Sync Failure:', err);
      setIsLoading(false);
    }
  };

  // Initial Sync
  useEffect(() => {
    if (currentUser) {
      refreshAllData();
    }
  }, [currentUser]);

  // Update prospect list when active campaign switches
  const handleCampaignChange = (id: string) => {
    setActiveCampaignId(id);
    refreshAllData(id);

    // Switch campaign status in database
    authFetch(`/api/campaigns/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true })
    }).then(() => {
      // Trigger dynamic background updates
      authFetch('/api/campaigns').then(r => r.json()).then(setCampaigns);
    });
  };

  // Create welcome Campaign (Step 1 flow)
  const handleWelcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!welcomeService) return;
    setIsLoading(true);

    try {
      const res = await authFetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: welcomeCampaignName || `${welcomeService} Launch`,
          serviceName: welcomeService,
          isActive: true
        })
      });
      if (res.ok) {
        const newCamp = await res.json();
        setActiveCampaignId(newCamp.id);
        setShowWelcomeModal(false);
        await refreshAllData(newCamp.id);
      }
    } catch (err) {
      console.error('Failed to provision initial campaign', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Create auxiliary campaign
  const handleAddCampaign = async (name: string, serviceName: string, description: string) => {
    try {
      const res = await authFetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, serviceName, description })
      });
      if (res.ok) {
        const data = await res.json();
        await refreshAllData(data.id);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to create campaign');
      }
    } catch (err) {
      console.error('Campaign save error:', err);
    }
  };

  // Deletion campaign trigger
  const handleDeleteCampaign = (id: string) => {
    const camp = campaigns.find(c => c.id === id);
    const campName = camp ? camp.name : 'this campaign';
    setDeleteConfirmState({
      isOpen: true,
      type: 'campaign',
      id,
      title: 'Delete Campaign',
      description: `Are you sure you want to delete the campaign "${campName}"? All associated prospects, AI outreach message templates, and logs will be permanently deleted. This action cannot be undone.`
    });
  };

  // Save manual prospect details
  const handleAddProspect = async (prospect: Partial<Prospect>) => {
    try {
      const res = await authFetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prospect)
      });
      if (res.ok) {
        refreshAllData();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to add prospect');
      }
    } catch (err) {
      console.error('Prospect save failure', err);
    }
  };

  // Edit prospect statuses or info details
  const handleUpdateProspect = async (id: string, updates: Partial<Prospect>) => {
    try {
      const res = await authFetch(`/api/prospects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        // Refresh local UI states faster
        setProspects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
        // Refresh full logging list in background
        authFetch('/api/activities').then(r => r.json()).then(setActivities);
        authFetch('/api/analytics').then(r => r.json()).then(setStats);
      }
    } catch (err) {
      console.error('Failed to update prospect', err);
    }
  };

  // Delete prospect trigger
  const handleDeleteProspect = (id: string) => {
    const pros = prospects.find(p => p.id === id);
    const prosName = pros ? `${pros.firstName} ${pros.lastName}` : 'this prospect';
    setDeleteConfirmState({
      isOpen: true,
      type: 'prospect',
      id,
      title: 'Delete Prospect',
      description: `Are you sure you want to delete "${prosName}"? All generated personalized sequences for this prospect will be permanently lost.`
    });
  };

  // Confirmed delete execution
  const handleExecuteDelete = async () => {
    const { type, id } = deleteConfirmState;
    if (!id) return;
    
    try {
      if (type === 'campaign') {
        const res = await authFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
        if (res.ok) {
          if (activeCampaignId === id) {
            setActiveCampaignId('');
          }
          await refreshAllData();
        }
      } else if (type === 'prospect') {
        const res = await authFetch(`/api/prospects/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setProspects(prev => prev.filter(p => p.id !== id));
          await refreshAllData();
        }
      }
    } catch (err) {
      console.error(`Failed to execute delete for ${type}`, err);
    } finally {
      setDeleteConfirmState(prev => ({ ...prev, isOpen: false, id: '' }));
    }
  };

  // Bulk Personalization Generation trigger
  const handleBulkGenerate = async (ids: string[]) => {
    try {
      const res = await authFetch('/api/messages/generate-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds: ids })
      });
      if (res.ok) {
        refreshAllData();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Bulk generation failed');
      }
    } catch (err) {
      console.error('Bulk generate failed', err);
    }
  };

  // Bulk importer Complete handler
  const handleBulkImportComplete = async (parsedProspects: Partial<Prospect>[]) => {
    try {
      const res = await authFetch('/api/prospects/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: activeCampaignId,
          prospects: parsedProspects
        })
      });
      if (res.ok) {
        setActiveTab('leads');
        refreshAllData();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Bulk Import failed');
      }
    } catch (err) {
      console.error('Bulk Import API error', err);
    }
  };

  // Save Settings Config
  const handleSaveSettings = async (updates: Partial<AppSettings>) => {
    try {
      const res = await authFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, ...updates }));
        refreshAllData();
      }
    } catch (err) {
      console.error('Failed to save settings', err);
    }
  };

  if (!currentUser) {
    return <AuthView onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const isStaff = ['admin', 'manager', 'executive'].includes(currentUser.id.toLowerCase());

  if (isStaff && !adminUserSandboxMode) {
    return (
      <AdminDashboard 
        onSignOut={() => {
          localStorage.removeItem('outreach_user');
          setCurrentUser(null);
          setAdminUserSandboxMode(false);
        }}
        onEnterUserMode={() => setAdminUserSandboxMode(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-bento-bg text-bento-text flex font-sans antialiased selection:bg-indigo-600/30 selection:text-white" id="main-saas-layout">
      
      {/* 1. Left Rail Sidebar Workspace Navigation */}
      <aside className="w-64 border-r border-bento-border bg-bento-card flex flex-col justify-between shrink-0 hidden md:flex" id="left-rail-sidebar">
        <div className="space-y-6 py-6">
          {/* Logo Brand Header */}
          <div className="px-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25">
              <Sparkles size={16} className="animate-spin-slow" />
            </div>
            <div className="space-y-0.5">
              <span className="font-bold text-sm tracking-tight text-white block">Outreach Pro</span>
              <span className="text-[10px] text-gray-500 font-medium block">LinkedIn Lead Gen AI</span>
            </div>
          </div>

          {isStaff && (
            <div className="mx-3 p-3 bg-red-950/20 border border-red-500/20 rounded-2xl flex items-center justify-between gap-2">
              <div>
                <span className="text-[9px] font-bold text-red-400 block tracking-wider font-mono">STAFF ACTIVE</span>
                <span className="text-[8px] text-gray-500 block">Client Sandbox Mode</span>
              </div>
              <button 
                onClick={() => setAdminUserSandboxMode(false)}
                className="px-2 py-1 bg-red-500/15 hover:bg-red-500/25 text-[9px] font-mono font-bold text-red-400 rounded-lg border border-red-500/20 cursor-pointer transition-colors shrink-0"
              >
                Console ↗
              </button>
            </div>
          )}

          {/* Navigation Items */}
          <div className="px-3 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'leads', label: 'Campaign Leads Hub', icon: Users },
              { id: 'importer', label: 'Bulk List Importer', icon: Layers },
              { id: 'settings', label: 'System Configuration', icon: Sliders }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id === 'importer' && !activeCampaignId) {
                    alert('Please select or create an active campaign first!');
                    setActiveTab('leads');
                  }
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-left transition-all cursor-pointer ${
                  activeTab === item.id 
                    ? 'bg-bento-card-active text-indigo-400 font-bold border border-bento-border-highlight' 
                    : 'text-gray-400 hover:text-white hover:bg-bento-card-hover'
                }`}
              >
                <item.icon size={14} />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Footer context */}
        <div className="p-4 border-t border-bento-border/50 space-y-3">
          {currentUser && (
            <div className="p-2.5 bg-bento-bg border border-bento-border/60 rounded-xl space-y-2" id="sidebar-user-profile-block">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                  {currentUser.fullName[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-white truncate leading-none">{currentUser.fullName}</p>
                  <p className="text-[8px] text-gray-500 truncate mt-0.5">{currentUser.phone}</p>
                </div>
              </div>
              <button
                id="sidebar-signout-btn"
                onClick={() => {
                  localStorage.removeItem('outreach_user');
                  setCurrentUser(null);
                }}
                className="w-full py-1 bg-red-950/10 hover:bg-red-950/20 text-[9px] font-bold text-red-400 border border-red-500/10 hover:border-red-500/20 rounded-lg text-center transition-all cursor-pointer"
              >
                Sign Out Workspace
              </button>
            </div>
          )}

          {activeCampaignId && campaigns.length > 0 && (
            <div className="p-3 bg-bento-bg border border-bento-border rounded-xl space-y-1.5">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Active Promotion</span>
              <p className="text-[11px] font-semibold text-white truncate">
                {campaigns.find(c => c.id === activeCampaignId)?.serviceName || 'Custom Service'}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] text-gray-500 px-2 justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> DB PERSISTENT
            </span>
            <span>v1.0.4</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Content stage area */}
      <main className="flex-1 flex flex-col min-w-0" id="main-content-stage">
        {/* Top Navbar */}
        <header className="h-16 border-b border-bento-border bg-bento-card/50 backdrop-blur-md px-6 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-gray-400 hover:text-white">
              <Menu size={20} />
            </button>
            <span className="text-sm font-semibold text-slate-300">
              {activeTab === 'dashboard' ? 'Analytics Command Center' : 
               activeTab === 'leads' ? 'Prospects & AI Messaging Panel' : 
               activeTab === 'importer' ? 'Spreadsheet Parsing Tool' : 'Settings & API Keys'}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Quick stats tags */}
            {stats && (
              <div className="hidden sm:flex items-center gap-2 border border-bento-border-highlight bg-bento-card-active rounded-full px-3.5 py-1 text-[11px] font-medium text-gray-400">
                <span>Active Leads: <strong className="text-white">{stats.summary.totalProspects}</strong></span>
                <span className="text-bento-border">|</span>
                <span>Avg Replies: <strong className="text-green-500">{stats.summary.replyRate}%</strong></span>
              </div>
            )}

            <div className="relative" id="user-profile-menu-container">
              <button 
                onClick={() => setShowProfileMenu(prev => !prev)}
                className="w-8 h-8 rounded-full bg-indigo-600/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs hover:bg-indigo-600/25 transition-colors cursor-pointer select-none"
              >
                {currentUser ? currentUser.fullName[0].toUpperCase() : 'U'}
              </button>
              
              {showProfileMenu && currentUser && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0E0F12] border border-white/5 rounded-2xl p-4 shadow-2xl z-50 text-left space-y-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white truncate">{currentUser.fullName}</p>
                    <p className="text-[10px] text-gray-400 truncate">{currentUser.email}</p>
                    <p className="text-[10px] text-indigo-400 font-mono mt-1">{currentUser.phone}</p>
                  </div>
                  <div className="h-px bg-white/5"></div>
                  <button
                    onClick={() => {
                      localStorage.removeItem('outreach_user');
                      setCurrentUser(null);
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left py-1 text-[11px] font-bold text-red-400 hover:text-red-300 flex items-center gap-2 cursor-pointer bg-transparent border-none p-0"
                  >
                    <span>Sign Out Workspace</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Views Canvas */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-48">
              <div className="space-y-4 text-center">
                <RefreshCw size={24} className="text-indigo-500 animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Syncing CRM outreach databanks...</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                {activeTab === 'dashboard' && (
                  <Dashboard
                    stats={stats}
                    activities={activities}
                    campaigns={campaigns}
                    onNavigate={setActiveTab}
                    onSelectCampaign={handleCampaignChange}
                    onCreateCampaignClick={() => setActiveTab('leads')}
                  />
                )}

                {activeTab === 'leads' && (
                  <LeadsHub
                    campaigns={campaigns}
                    activeCampaignId={activeCampaignId}
                    onCampaignChange={handleCampaignChange}
                    onAddCampaign={handleAddCampaign}
                    onDeleteCampaign={handleDeleteCampaign}
                    prospects={prospects}
                    onAddProspect={handleAddProspect}
                    onUpdateProspect={handleUpdateProspect}
                    onDeleteProspect={handleDeleteProspect}
                    onBulkGenerate={handleBulkGenerate}
                    onBulkImportClick={() => setActiveTab('importer')}
                    currentUserId={currentUser?.id || ''}
                  />
                )}

                {activeTab === 'importer' && (
                  <Importer
                    campaignId={activeCampaignId}
                    onImportComplete={handleBulkImportComplete}
                    onCancel={() => setActiveTab('leads')}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsView
                    settings={settings}
                    campaigns={campaigns}
                    promptHistory={promptHistory}
                    onSaveSettings={handleSaveSettings}
                    onDeleteCampaign={handleDeleteCampaign}
                    isAdmin={currentUser?.id === 'admin'}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* STEP 1: Modal Ask ONLY ONCE (Provision landing Campaign context) */}
      {showWelcomeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-sky-400"></div>
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="space-y-2 text-center sm:text-left">
              <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto sm:mx-0">
                <Sparkles size={22} className="animate-pulse" />
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">Active Offer Setup</h2>
              <p className="text-slate-400 text-xs leading-relaxed max-w-md">
                Welcome to Outreach Pro. Let's configure your initial lead generation campaign. What service or SaaS solution do you want to promote?
              </p>
            </div>

            <form onSubmit={handleWelcomeSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold">Campaign Label Name</label>
                  <input
                    id="welcome-campaign-name-input"
                    type="text"
                    value={welcomeCampaignName}
                    onChange={(e) => setWelcomeCampaignName(e.target.value)}
                    placeholder="e.g. AI Automation Outreach"
                    className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-bold">Promoted Service / Offer</label>
                  <select
                    id="welcome-campaign-service-selector"
                    value={welcomeService}
                    onChange={(e) => setWelcomeService(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 text-slate-300 rounded-xl p-3 cursor-pointer"
                  >
                    <option value="Custom Software Development">Custom Software Development</option>
                    <option value="Web Development">Web Development</option>
                    <option value="Mobile App Development">Mobile App Development</option>
                    <option value="AI Solutions">AI Solutions</option>
                    <option value="SaaS Development">SaaS Development</option>
                    <option value="UI/UX Design">UI/UX Design</option>
                    <option value="SEO & Web Rankings">SEO & Search Optimization</option>
                    <option value="Lead Generation Solutions">Lead Generation / Appointment Setting</option>
                    <option value="Cloud Solutions & DevOps">Cloud & DevOps Solutions</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl text-[11px] text-slate-400 leading-relaxed flex gap-2">
                <Shield className="text-indigo-400 shrink-0 mt-0.5" size={14} />
                <span>
                  The campaign context will act as the foundational "value-proposition anchor" when the AI analyzes prospect psychology to generate high-converting message hooks.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  id="welcome-modal-activate-btn"
                  type="submit"
                  disabled={!welcomeService || !welcomeCampaignName}
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Activate Outreach Engine <ArrowRight size={14} />
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* CUSTOM CONFIRM DELETE MODAL */}
      {deleteConfirmState.isOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4" id="custom-delete-confirm-overlay">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 relative overflow-hidden text-xs"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center text-[10px] font-bold">!</span>
                {deleteConfirmState.title}
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                {deleteConfirmState.description}
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                id="delete-confirm-cancel-btn"
                onClick={() => setDeleteConfirmState(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-gray-300 font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                id="delete-confirm-execute-btn"
                onClick={handleExecuteDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl cursor-pointer transition-colors"
              >
                Permanently Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
