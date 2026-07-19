/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Database, 
  Terminal, 
  FileCode, 
  ShieldCheck, 
  RefreshCw, 
  Trash2, 
  Search, 
  Sparkles,
  Server,
  Key,
  Shield,
  Clock,
  ExternalLink,
  ChevronRight,
  LogOut,
  TrendingUp,
  Award,
  ArrowLeft,
  Copy,
  Check,
  Download,
  Flame,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, PromptHistoryItem, Campaign } from '../types';

interface RegisteredUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt?: string;
  status?: 'active' | 'suspended';
  sdrRole?: 'Junior SDR' | 'Senior SDR';
  aiPermission?: boolean;
  campaignLimit?: number;
}

interface AdminStats {
  totalUsers: number;
  totalCampaigns: number;
  totalProspects: number;
  totalMessages: number;
  totalPrompts: number;
  totalActivities: number;
  lastUpdated: string;
}

interface AdminDashboardProps {
  onSignOut: () => void;
  onEnterUserMode?: () => void;
}

export default function AdminDashboard({ onSignOut, onEnterUserMode }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'user-progress' | 'users' | 'campaigns' | 'activities' | 'prompts' | 'maintenance'>('user-progress');
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [prompts, setPrompts] = useState<PromptHistoryItem[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [systemMsg, setSystemMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Drill down SDR state
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  
  // AI Report State
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [aiReportText, setAiReportText] = useState<string>('');
  const [reportCopied, setReportCopied] = useState(false);
  const [terminalStep, setTerminalStep] = useState(0);

  // Global system controls
  const [globalConfig, setGlobalConfig] = useState({
    maintenanceMode: false,
    globalDailyQuota: 100,
    defaultModel: 'gemini-3.5-flash'
  });
  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);

  // Staff Authentication Status
  const [staffUser] = useState<{ id: string; fullName: string; email: string; role: string } | null>(() => {
    const stored = localStorage.getItem('outreach_user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u.id === 'admin' || u.phone === 'admin') u.role = 'Super Admin';
        else if (u.id === 'manager' || u.phone === 'manager') u.role = 'Manager';
        else if (u.id === 'executive' || u.phone === 'executive') u.role = 'Executive';
        return u;
      } catch (_) { return null; }
    }
    return null;
  });

  const isSuperAdmin = staffUser?.role === 'Super Admin' || staffUser?.id === 'admin';

  // Load Admin Data
  const fetchAllAdminData = async () => {
    setIsLoading(true);
    setSystemMsg(null);
    try {
      // 1. Fetch Stats
      const statsRes = await fetch('/api/admin/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Fetch Users
      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      // 3. Fetch campaigns
      const campaignsRes = await fetch('/api/campaigns');
      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        setCampaigns(campaignsData);
      }

      // 4. Fetch prospects
      const prospectsRes = await fetch('/api/prospects');
      if (prospectsRes.ok) {
        const prospectsData = await prospectsRes.json();
        setProspects(prospectsData);
      }

      // 5. Fetch activities
      const actRes = await fetch('/api/activities');
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivities(actData);
      }

      // 6. Fetch prompts history
      const promptRes = await fetch('/api/prompts');
      if (promptRes.ok) {
        const promptData = await promptRes.json();
        setPrompts(promptData);
      }

      // 7. Fetch global config
      const configRes = await fetch('/api/admin/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        setGlobalConfig(configData);
      }
    } catch (err: any) {
      setSystemMsg({ text: 'Error retrieving console database: ' + err.message, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllAdminData();
  }, []);

  // Update user permissions override
  const handleUpdateUserPermissions = async (userId: string, updates: Partial<RegisteredUser>) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (res.ok) {
        setSystemMsg({ text: `Access rules updated successfully for the member account.`, isError: false });
        // Update local users array faster
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
        fetchAllAdminData();
      } else {
        throw new Error(data.error || 'Permission override rejected.');
      }
    } catch (err: any) {
      setSystemMsg({ text: err.message, isError: true });
    }
  };

  // Update global policies
  const handleSaveGlobalConfig = async (newConfig: typeof globalConfig) => {
    setIsUpdatingConfig(true);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      const data = await res.json();
      if (res.ok) {
        setSystemMsg({ text: 'Global governance policies updated successfully.', isError: false });
        setGlobalConfig(data.config);
      } else {
        throw new Error(data.error || 'Global policy update rejected.');
      }
    } catch (err: any) {
      setSystemMsg({ text: err.message, isError: true });
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  // Export Activities Log as CSV
  const exportActivitiesCsv = () => {
    if (activities.length === 0) return;
    const headers = ['Timestamp', 'Action', 'Details', 'User ID'];
    const rows = activities.map(a => [
      new Date(a.timestamp).toLocaleString(),
      `"${a.action.replace(/"/g, '""')}"`,
      `"${a.details.replace(/"/g, '""')}"`,
      a.userId || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `outreach_pro_telemetry_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Prompt History Log as CSV
  const exportPromptsCsv = () => {
    if (prompts.length === 0) return;
    const headers = ['Timestamp', 'Model Used', 'Target Prospect', 'Prompt Context', 'AI Output'];
    const rows = prompts.map(p => [
      new Date(p.timestamp).toLocaleString(),
      p.modelUsed,
      `"${p.prospectName.replace(/"/g, '""')}"`,
      `"${p.prompt.replace(/"/g, '""')}"`,
      `"${p.response.replace(/"/g, '""')}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `outreach_pro_ai_prompts_audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pre-populate high-fidelity demo data
  const handleSeedDemoData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/seed-demo-data', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSystemMsg({ text: data.message, isError: false });
        await fetchAllAdminData();
      } else {
        throw new Error(data.error || 'Seeding failed.');
      }
    } catch (err: any) {
      setSystemMsg({ text: err.message, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  // Actions
  const handlePurgeUser = async (userId: string, name: string) => {
    if (!isSuperAdmin) {
      alert('Action Restricted: Only Super Administrators can purge client accounts.');
      return;
    }
    if (!confirm(`Are you absolutely sure you want to permanently delete user "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setSystemMsg({ text: data.message || `Deleted user "${name}" successfully.`, isError: false });
        if (selectedUser?.id === userId) setSelectedUser(null);
        fetchAllAdminData();
      } else {
        throw new Error(data.error || 'Server rejected user deletion.');
      }
    } catch (err: any) {
      setSystemMsg({ text: err.message, isError: true });
    }
  };

  const handlePurgePrompts = async () => {
    if (!isSuperAdmin) {
      alert('Action Restricted: Only Super Administrators can clear system telemetry.');
      return;
    }
    if (!confirm('Purge all AI audit logs? This removes historical system telemetry.')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/prompts', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setSystemMsg({ text: data.message, isError: false });
        fetchAllAdminData();
      }
    } catch (err: any) {
      setSystemMsg({ text: err.message, isError: true });
    }
  };

  const handlePurgeActivities = async () => {
    if (!isSuperAdmin) {
      alert('Action Restricted: Only Super Administrators can reset audit logs.');
      return;
    }
    if (!confirm('Reset system logs? All action history will be flushed.')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/activities', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setSystemMsg({ text: data.message, isError: false });
        fetchAllAdminData();
      }
    } catch (err: any) {
      setSystemMsg({ text: err.message, isError: true });
    }
  };

  const handlePurgeCampaign = async (campaignId: string, title: string) => {
    if (!isSuperAdmin) {
      alert('Action Restricted: Only Super Administrators can purge campaigns.');
      return;
    }
    if (!confirm(`Permanently delete campaign "${title}"?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      if (res.ok) {
        setSystemMsg({ text: `Purged campaign "${title}" successfully.`, isError: false });
        fetchAllAdminData();
      }
    } catch (err: any) {
      setSystemMsg({ text: err.message, isError: true });
    }
  };

  // Generate Gemini AI Report
  const triggerAiReport = async (userId: string) => {
    setIsGeneratingReport(true);
    setAiReportText('');
    setTerminalStep(0);

    // Simulated high-fidelity terminal ticks for immersive UX
    const interval = setInterval(() => {
      setTerminalStep(prev => {
        if (prev < 4) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 1500);

    try {
      const res = await fetch('/api/admin/generate-user-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId })
      });
      const data = await res.json();
      if (res.ok) {
        setAiReportText(data.report);
      } else {
        throw new Error(data.error || 'Failed to compile AI assessment.');
      }
    } catch (err: any) {
      setSystemMsg({ text: err.message, isError: true });
    } finally {
      clearInterval(interval);
      setIsGeneratingReport(false);
    }
  };

  // Filters
  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone.includes(searchTerm)
  );

  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPrompts = prompts.filter(p => 
    p.prospectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.response.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.modelUsed.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredActivities = activities.filter(a => 
    a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Local helper calculations for user directory progress oversight
  const getUserPerformanceStats = (userId: string) => {
    const userCamps = campaigns.filter(c => c.userId === userId);
    const campIds = userCamps.map(c => c.id);
    const userPros = prospects.filter(p => campIds.includes(p.campaignId) || p.userId === userId);
    
    let pitches = 0;
    let replies = 0;
    let won = 0;
    userPros.forEach(p => {
      if (p.pitchSent) pitches++;
      if (p.replyReceived) replies++;
      if (p.wonLostStatus === 'won') won++;
    });

    const replyRate = pitches > 0 ? Math.round((replies / pitches) * 100) : 0;
    return {
      campaignsCount: userCamps.length,
      prospectsCount: userPros.length,
      leadsGenerated: replies,
      wonCount: won,
      replyRate
    };
  };

  const copyReportToClipboard = () => {
    navigator.clipboard.writeText(aiReportText);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>OutreachPro Executive Report - ${selectedUser?.fullName}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
              h1 { border-bottom: 2px solid #3b82f6; padding-bottom: 10px; color: #1e3a8a; }
              h2 { color: #1e40af; margin-top: 30px; }
              h3 { color: #1e3a8a; }
              pre { background: #f3f4f6; padding: 15px; border-radius: 8px; }
              hr { border: none; border-top: 1px solid #e5e7eb; margin: 30px 0; }
              .meta { font-size: 12px; color: #666; margin-bottom: 30px; }
            </style>
          </head>
          <body>
            <h1>EXECUTIVE SDR PERFORMANCE EVALUATION</h1>
            <div class="meta">
              <strong>Subject:</strong> ${selectedUser?.fullName}<br>
              <strong>Email:</strong> ${selectedUser?.email}<br>
              <strong>Date:</strong> ${new Date().toLocaleDateString()}<br>
              <strong>Generated By:</strong> OutreachPro AI Performance Auditor
            </div>
            <div>${aiReportText.replace(/\n/g, '<br>')}</div>
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-gray-200 flex flex-col font-sans selection:bg-indigo-600/30 selection:text-white" id="admin-viewport">
      {/* Header Terminal */}
      <header className="border-b border-white/5 bg-[#08080A]/90 backdrop-blur-xl px-6 py-4 sticky top-0 z-40" id="admin-header">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white block uppercase">
                  {staffUser?.role || 'STAFF'} COMMAND CONSOLE
                </span>
                <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[8px] font-mono font-bold uppercase rounded-md tracking-wider">
                  {staffUser?.role || 'SDR OVERSIGHT'}
                </span>
              </div>
              <span className="text-[10px] text-gray-500 block">
                Manage Workspace Accounts, Inspect SDR pipelines & Compile Performance reports
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAllAdminData}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-[11px] font-bold text-gray-300 rounded-xl transition-all border border-white/5 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`shrink-0 ${isLoading ? 'animate-spin' : ''}`} size={12} />
              <span>Sync Network</span>
            </button>

            {onEnterUserMode && (
              <button
                onClick={onEnterUserMode}
                className="px-3.5 py-1.5 bg-indigo-600/15 border border-indigo-500/20 hover:bg-indigo-600/25 text-indigo-400 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Server size={12} />
                <span>Client Sandbox</span>
              </button>
            )}

            <button
              onClick={onSignOut}
              className="px-3.5 py-1.5 bg-red-950/20 hover:bg-red-950/30 text-red-400 border border-red-500/10 hover:border-red-500/20 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut size={12} />
              <span>Exit Console</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Terminal Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Status Notification Alerts */}
        <AnimatePresence>
          {systemMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={`p-4 rounded-2xl text-xs border flex items-center justify-between gap-3 ${
                systemMsg.isError 
                  ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield size={14} />
                <span>{systemMsg.text}</span>
              </div>
              <button 
                onClick={() => setSystemMsg(null)}
                className="text-[10px] font-bold opacity-60 hover:opacity-100 uppercase font-mono tracking-wider cursor-pointer"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global System Metrics Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4" id="admin-bento-matrix">
          {[
            { label: 'Registered SDRs', value: users.length, icon: Users, color: 'text-indigo-400 border-indigo-500/10 bg-indigo-500/5' },
            { label: 'Oversight Campaigns', value: campaigns.length, icon: Database, color: 'text-pink-400 border-pink-500/10 bg-pink-500/5' },
            { label: 'Aggregated Prospects', value: prospects.length, icon: Sparkles, color: 'text-emerald-400 border-emerald-500/10 bg-emerald-500/5' },
            { label: 'Leads Generated', value: prospects.filter(p => p.replyReceived).length, icon: Flame, color: 'text-amber-400 border-amber-500/10 bg-amber-500/5' },
            { label: 'Prompt Audit Logs', value: prompts.length, icon: FileCode, color: 'text-blue-400 border-blue-500/10 bg-blue-500/5' },
            { label: 'Telemetry Actions', value: activities.length, icon: Terminal, color: 'text-purple-400 border-purple-500/10 bg-purple-500/5' }
          ].map((card, idx) => (
            <div 
              key={idx} 
              className={`p-4 border rounded-3xl flex flex-col justify-between space-y-3 shadow-lg ${card.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{card.label}</span>
                <card.icon size={13} className="opacity-60" />
              </div>
              <div>
                <span className="text-2xl font-bold font-mono tracking-tight text-white block">
                  {isLoading ? '...' : card.value}
                </span>
                <span className="text-[8px] text-gray-500">Unified Stack Value</span>
              </div>
            </div>
          ))}
        </div>

        {/* Section Controls Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-[#0A0A0C]/90 border border-white/5 rounded-3xl p-4 space-y-4">
              <div>
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">TELEMETRY SCOPES</span>
                <div className="space-y-1">
                  {[
                    { id: 'user-progress', label: 'SDR Team Directory', icon: Award, count: users.length, allowedRoles: ['Super Admin', 'Manager', 'Executive'] },
                    { id: 'users', label: 'System User Records', icon: Users, count: users.length, allowedRoles: ['Super Admin'] },
                    { id: 'campaigns', label: 'Campaign Matrix', icon: Database, count: campaigns.length, allowedRoles: ['Super Admin', 'Manager', 'Executive'] },
                    { id: 'activities', label: 'Live System Activities', icon: Terminal, count: activities.length, allowedRoles: ['Super Admin'] },
                    { id: 'prompts', label: 'Prompt History Logs', icon: FileCode, count: prompts.length, allowedRoles: ['Super Admin'] },
                    { id: 'maintenance', label: 'System Governance & Policies', icon: Shield, count: globalConfig.maintenanceMode ? '⚠️ LOCK' : '🟢 ON', allowedRoles: ['Super Admin'] }
                  ].filter(tab => tab.allowedRoles.includes(staffUser?.role || 'Manager')).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setSearchTerm('');
                        setSelectedUser(null);
                        setAiReportText('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === tab.id 
                          ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold' 
                          : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <tab.icon size={13} />
                        <span>{tab.label}</span>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 bg-black/40 rounded-md border border-white/5 text-gray-400">
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seeding Block for demonstration ease */}
              <div className="pt-2 border-t border-white/5">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-2">DEMONSTRATION TOOL</span>
                <button
                  onClick={handleSeedDemoData}
                  className="w-full flex items-center justify-center gap-1.5 text-center text-xs text-white bg-indigo-600 hover:bg-indigo-500 font-bold py-2 px-3 rounded-xl transition-all cursor-pointer shadow-lg"
                >
                  <Sparkles size={12} />
                  <span>Populate Demo B2B Data</span>
                </button>
                <p className="text-[9px] text-gray-500 mt-1 leading-normal text-center">
                  Instantly load high-fidelity SDRs, campaigns, prospects and closed-deals to inspect reviews.
                </p>
              </div>

              {/* Super Admin Actions only */}
              {isSuperAdmin && (
                <div className="pt-3 border-t border-white/5 space-y-2">
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider block">PURGE SCRIPTS</span>
                  
                  <button
                    onClick={handlePurgePrompts}
                    className="w-full flex items-center justify-between text-left text-[11px] text-gray-400 hover:text-red-400 font-semibold p-2 bg-black/40 hover:bg-red-950/10 border border-white/5 hover:border-red-500/20 rounded-xl transition-colors cursor-pointer"
                  >
                    <span>Purge Audit Logs</span>
                    <Trash2 size={12} />
                  </button>

                  <button
                    onClick={handlePurgeActivities}
                    className="w-full flex items-center justify-between text-left text-[11px] text-gray-400 hover:text-red-400 font-semibold p-2 bg-black/40 hover:bg-red-950/10 border border-white/5 hover:border-red-500/20 rounded-xl transition-colors cursor-pointer"
                  >
                    <span>Reset System Logs</span>
                    <Trash2 size={12} />
                  </button>
                </div>
              )}

              <div className="p-3 bg-[#0D0B0B] border border-white/5 rounded-2xl text-[10px] text-gray-500 leading-relaxed">
                <span className="font-semibold text-indigo-400 block mb-1">🛡️ Console Guard</span>
                Your staff account is logging all queries and actions. Compliance with data governance limits is active.
              </div>
            </div>
          </div>

          {/* Table / Details stage */}
          <div className="lg:col-span-3 bg-[#0A0A0C]/90 border border-white/5 rounded-3xl p-6 min-h-[500px] flex flex-col justify-between space-y-6">
            
            <div className="space-y-4 flex-1">
              
              {/* If SelectedUser is SET, render SDR DRILL DOWN view */}
              {selectedUser ? (
                <div className="space-y-6" id="sdr-performance-profile">
                  {/* Drill Down Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setSelectedUser(null);
                          setAiReportText('');
                        }}
                        className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-colors cursor-pointer border border-white/5"
                        title="Back to Directory"
                      >
                        <ArrowLeft size={14} />
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{selectedUser.fullName}</h3>
                          <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[8px] font-mono font-bold uppercase rounded">SDR Specialist</span>
                        </div>
                        <p className="text-xs text-gray-500 font-mono">{selectedUser.email} • {selectedUser.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 font-mono">
                        Member since: {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'Active SDR'}
                      </span>
                    </div>
                  </div>

                  {/* SDR KPIs Bento Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: 'Active Campaigns', value: getUserPerformanceStats(selectedUser.id).campaignsCount, subtitle: 'Configured Pipelines' },
                      { label: 'Total Prospects', value: getUserPerformanceStats(selectedUser.id).prospectsCount, subtitle: 'Managed Lead Base' },
                      { label: 'Leads Generated', value: getUserPerformanceStats(selectedUser.id).leadsGenerated, subtitle: 'Prospect Replies' },
                      { label: 'Closed Leads (Won)', value: getUserPerformanceStats(selectedUser.id).wonCount, subtitle: 'Deals Finalized', highlight: true }
                    ].map((kpi, index) => (
                      <div key={index} className={`p-4 rounded-2xl border ${kpi.highlight ? 'bg-indigo-600/5 border-indigo-500/20' : 'bg-black/40 border-white/5'}`}>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">{kpi.label}</span>
                        <span className="text-xl font-bold font-mono text-white tracking-tight mt-1 block">{kpi.value}</span>
                        <span className="text-[9px] text-gray-400 mt-0.5 block">{kpi.subtitle}</span>
                      </div>
                    ))}
                  </div>

                  {/* Core details workspace: Left side campaigns + activity, Right side AI progress reports */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    
                    {/* SDR Details lists (8 cols) */}
                    <div className="xl:col-span-6 space-y-6">
                      
                      {/* Campaign pipelines list */}
                      <div className="p-5 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                        <div className="flex items-center gap-2">
                          <Database size={14} className="text-indigo-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Associated Pipelines & Campaigns</h4>
                        </div>
                        
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {campaigns.filter(c => c.userId === selectedUser.id).length === 0 ? (
                            <p className="text-xs text-gray-500 font-mono py-4 text-center">No campaigns created by this user yet.</p>
                          ) : (
                            campaigns.filter(c => c.userId === selectedUser.id).map(c => {
                              const campPros = prospects.filter(p => p.campaignId === c.id);
                              const wonLeads = campPros.filter(p => p.wonLostStatus === 'won').length;
                              return (
                                <div key={c.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between hover:border-indigo-500/10 transition-all">
                                  <div>
                                    <span className="font-semibold text-white text-xs block">{c.name}</span>
                                    <span className="text-[9px] text-gray-500 block font-mono mt-0.5">{c.serviceName}</span>
                                  </div>
                                  <div className="text-right shrink-0 font-mono text-[10px]">
                                    <span className="text-indigo-400 block font-bold">{campPros.length} Prospects</span>
                                    <span className="text-emerald-400 text-[8px] font-semibold">{wonLeads} closed won</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* User SDR Activities Feed */}
                      <div className="p-5 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                        <div className="flex items-center gap-2">
                          <Terminal size={14} className="text-indigo-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">SDR Activity Chronology</h4>
                        </div>

                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                          {activities.filter(a => a.userId === selectedUser.id).length === 0 ? (
                            <p className="text-xs text-gray-500 font-mono py-4 text-center">No activity history logs recorded.</p>
                          ) : (
                            activities.filter(a => a.userId === selectedUser.id).map(a => (
                              <div key={a.id} className="p-2.5 bg-white/[0.01] border border-white/5 rounded-xl flex items-start gap-2 text-[11px]">
                                <span className="text-indigo-400 font-bold font-mono text-[9px] shrink-0 mt-0.5">
                                  [{new Date(a.timestamp).toLocaleTimeString()}]
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="font-bold text-white block">{a.action}</span>
                                  <p className="text-gray-400 text-[10px] leading-relaxed mt-0.5">{a.details}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>

                    {/* AI report generator (4 cols) */}
                    <div className="xl:col-span-6 space-y-4">
                      <div className="p-5 bg-gradient-to-br from-indigo-950/10 to-transparent border border-indigo-500/10 rounded-3xl flex flex-col h-full justify-between min-h-[380px]">
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <div className="flex items-center gap-2">
                              <Sparkles size={15} className="text-indigo-400 animate-pulse" />
                              <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI Executive Progress Report</h4>
                            </div>
                            <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[7px] font-mono font-bold uppercase rounded">Gemini Co-Pilot</span>
                          </div>

                          {/* Render Report Block */}
                          {!isGeneratingReport && !aiReportText && (
                            <div className="py-12 text-center space-y-4 flex flex-col items-center justify-center">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-950/20 border border-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <Award size={22} />
                              </div>
                              <div className="space-y-1.5 max-w-xs">
                                <span className="text-xs font-bold text-white block">Compile SDR Metrics Assessment</span>
                                <p className="text-[10px] text-gray-500 leading-normal">
                                  Synthesize a comprehensive, executive-ready performance review. Analyzes campaign conversions, activity frequencies, and outlines coaching suggestions.
                                </p>
                              </div>
                              <button
                                onClick={() => triggerAiReport(selectedUser.id)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg cursor-pointer"
                              >
                                Compile Report Card
                              </button>
                            </div>
                          )}

                          {/* Loader Terminal */}
                          {isGeneratingReport && (
                            <div className="font-mono text-[10px] text-indigo-400 p-4 bg-black/80 rounded-2xl border border-indigo-500/10 space-y-2 h-[260px] overflow-y-auto">
                              <div className="flex items-center gap-1.5">
                                <RefreshCw size={10} className="animate-spin shrink-0" />
                                <span className="font-bold">SYSTEM TELEMETRY DIAGNOSTIC ACTIVE</span>
                              </div>
                              <hr className="border-indigo-500/10 my-2" />
                              <p className={terminalStep >= 0 ? "opacity-100" : "opacity-30"}>
                                [SDR_AUDIT] Reading user registry profile metrics for target id: {selectedUser.id}... Done.
                              </p>
                              {terminalStep >= 1 && (
                                <p className="text-indigo-300">
                                  [KPI_CALC] Fetching related campaigns count ({getUserPerformanceStats(selectedUser.id).campaignsCount}) and managed prospects base ({getUserPerformanceStats(selectedUser.id).prospectsCount})... Completed.
                                </p>
                              )}
                              {terminalStep >= 2 && (
                                <p className="text-pink-400">
                                  [RATIO_ANALYSIS] Pitch-to-Reply rate calculated at {getUserPerformanceStats(selectedUser.id).replyRate}%. Won closed conversion rate computed at {getUserPerformanceStats(selectedUser.id).wonCount} deals.
                                </p>
                              )}
                              {terminalStep >= 3 && (
                                <p className="text-amber-400">
                                  [COACHING_INTELLIGENCE] Initializing server-side Gemini 3.5 model with prompt weights... Synthesizing constructive outreach developmental advice...
                                </p>
                              )}
                              {terminalStep >= 4 && (
                                <p className="text-emerald-400 font-bold animate-pulse">
                                  [COMPILING] Report text finalized. Writing beautiful Markdown template...
                                </p>
                              )}
                            </div>
                          )}

                          {/* Render finalized Report */}
                          {aiReportText && !isGeneratingReport && (
                            <div className="space-y-3">
                              <div className="bg-[#050507] border border-white/5 p-4 rounded-2xl h-[280px] overflow-y-auto scrollbar-thin">
                                <MiniMarkdownRenderer text={aiReportText} />
                              </div>

                              {/* Actions on AI Report */}
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <button
                                  onClick={() => triggerAiReport(selectedUser.id)}
                                  className="text-[10px] text-gray-500 hover:text-indigo-400 font-semibold underline cursor-pointer"
                                >
                                  Re-generate report
                                </button>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={copyReportToClipboard}
                                    className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 hover:border-white/10 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    {reportCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                    <span>{reportCopied ? 'Copied' : 'Copy'}</span>
                                  </button>

                                  <button
                                    onClick={printReport}
                                    className="px-2.5 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/10 hover:border-indigo-500/20 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <Download size={11} />
                                    <span>Download</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>

                        <div className="pt-4 border-t border-white/5 text-[9px] text-gray-500 italic mt-3 leading-tight">
                          Gemini AI evaluates historical outreach ratios. Ensure team feedback aligns with direct pipeline telemetry.
                        </div>

                      </div>
                    </div>

                  </div>

                </div>
              ) : (
                <div className="space-y-4">
                  {/* Header Info + Search Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white capitalize flex items-center gap-2 animate-fade-in">
                        {activeTab === 'user-progress' && 'SDR Progress & Oversight'}
                        {activeTab === 'users' && 'System User Directory'}
                        {activeTab === 'campaigns' && 'Campaign Matrix'}
                        {activeTab === 'activities' && 'Live System Activities'}
                        {activeTab === 'prompts' && 'Prompt History Audit logs'}
                        {activeTab === 'maintenance' && 'System Governance & Policies'}
                        <span className="text-[10px] font-mono text-gray-500 normal-case font-normal">
                          ({
                            activeTab === 'maintenance' ? 'System Configuration' : `showing ${
                              activeTab === 'user-progress' ? filteredUsers.length :
                              activeTab === 'users' ? filteredUsers.length :
                              activeTab === 'campaigns' ? filteredCampaigns.length :
                              activeTab === 'activities' ? filteredActivities.length :
                              filteredPrompts.length
                            } items`
                          })
                        </span>
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {activeTab === 'user-progress' && 'Oversee B2B pipelines, campaign volumes, closed deals, and generate progress reports for each SDR.'}
                        {activeTab === 'users' && 'Query registered workspace accounts, configure role permissions, toggle status, and campaign creation limits.'}
                        {activeTab === 'campaigns' && 'View campaign definitions and purge inactive client channels.'}
                        {activeTab === 'activities' && 'Chronological audit of sign-ups, policy updates and administrative changes.'}
                        {activeTab === 'prompts' && 'Verify target system and context prompt queries matched to outputs.'}
                        {activeTab === 'maintenance' && 'Configure global maintenance mode, standard AI model, daily prompt quotas, and inspect sandbox health.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {activeTab === 'activities' && (
                        <button
                          onClick={exportActivitiesCsv}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all shadow-md shadow-indigo-600/15 cursor-pointer shrink-0"
                        >
                          <Download size={13} />
                          <span>Export CSV</span>
                        </button>
                      )}
                      {activeTab === 'prompts' && (
                        <button
                          onClick={exportPromptsCsv}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all shadow-md shadow-indigo-600/15 cursor-pointer shrink-0"
                        >
                          <Download size={13} />
                          <span>Export CSV</span>
                        </button>
                      )}
                      {activeTab !== 'maintenance' && (
                        <div className="relative w-full sm:w-52 shrink-0">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
                          <input
                            type="text"
                            placeholder={`Filter logs...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 transition-colors animate-fade-in"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Data Lists */}
                  <div className="pt-2">
                    {isLoading ? (
                      <div className="py-24 text-center space-y-3">
                        <RefreshCw className="animate-spin text-indigo-400 mx-auto" size={24} />
                        <p className="text-xs text-gray-500">Retrieving system records...</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        
                        {/* TAB 0: USER PROGRESS OVERVIEW (B2B SDR OVERSIGHT) */}
                        {activeTab === 'user-progress' && (
                          <table className="w-full text-left text-xs text-gray-400">
                            <thead>
                              <tr className="border-b border-white/5 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                                <th className="py-2.5">SDR Member</th>
                                <th className="py-2.5">Pipelines</th>
                                <th className="py-2.5">Prospects Base</th>
                                <th className="py-2.5">Closed (Won)</th>
                                <th className="py-2.5">Pitch-to-Reply</th>
                                <th className="py-2.5 text-right">Oversight</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {filteredUsers.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="py-12 text-center text-gray-500 font-mono">
                                    No registered SDR profiles available. Click "Populate Demo B2B Data" to showcase!
                                  </td>
                                </tr>
                              ) : (
                                filteredUsers.map((u) => {
                                  const uStats = getUserPerformanceStats(u.id);
                                  return (
                                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                                      <td className="py-3">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-8 h-8 rounded-xl bg-indigo-950/20 border border-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-xs font-mono">
                                            {u.fullName[0].toUpperCase()}
                                          </div>
                                          <div>
                                            <p className="font-bold text-white leading-none">{u.fullName}</p>
                                            <p className="text-[9px] text-gray-500 font-mono mt-1">{u.email}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-3 font-mono font-bold text-gray-300">{uStats.campaignsCount} campaigns</td>
                                      <td className="py-3 font-mono text-gray-300">{uStats.prospectsCount} leads</td>
                                      <td className="py-3">
                                        <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-mono text-[10px] font-bold">
                                          {uStats.wonCount} won
                                        </span>
                                      </td>
                                      <td className="py-3 font-mono font-bold text-indigo-400">{uStats.replyRate}%</td>
                                      <td className="py-3 text-right">
                                        <button
                                          onClick={() => setSelectedUser(u)}
                                          className="px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/10 hover:border-indigo-500/20 rounded-xl text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 ml-auto"
                                        >
                                          <span>Report Card</span>
                                          <ChevronRight size={10} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        )}

                        {/* TAB 1: USERS LIST */}
                        {activeTab === 'users' && (
                          <div className="space-y-4 animate-fade-in">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs text-gray-400">
                                <thead>
                                  <tr className="border-b border-white/5 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                                    <th className="py-2.5">User Details</th>
                                    <th className="py-2.5">SDR Role</th>
                                    <th className="py-2.5">Status Policy</th>
                                    <th className="py-2.5">AI Access</th>
                                    <th className="py-2.5">Cap (Daily)</th>
                                    <th className="py-2.5 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {filteredUsers.length === 0 ? (
                                    <tr>
                                      <td colSpan={6} className="py-12 text-center text-gray-500 font-mono">No matching registered user records found.</td>
                                    </tr>
                                  ) : (
                                    filteredUsers.map((u) => (
                                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="py-3">
                                          <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-indigo-950/20 border border-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold text-xs font-mono">
                                              {u.fullName[0].toUpperCase()}
                                            </div>
                                            <div>
                                              <p className="font-bold text-white leading-none">{u.fullName}</p>
                                              <p className="text-[9px] text-gray-500 font-mono mt-1">{u.email} • {u.phone}</p>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3">
                                          <select
                                            value={u.sdrRole || 'Junior SDR'}
                                            onChange={(e) => handleUpdateUserPermissions(u.id, { sdrRole: e.target.value as any })}
                                            className="bg-black/80 text-gray-300 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-mono cursor-pointer focus:outline-none focus:border-indigo-500"
                                          >
                                            <option value="Junior SDR">Junior SDR</option>
                                            <option value="Senior SDR">Senior SDR</option>
                                          </select>
                                        </td>
                                        <td className="py-3">
                                          <select
                                            value={u.status || 'active'}
                                            onChange={(e) => handleUpdateUserPermissions(u.id, { status: e.target.value as any })}
                                            className={`border rounded-lg px-2 py-1 text-[11px] font-mono font-bold cursor-pointer focus:outline-none ${
                                              (u.status || 'active') === 'active' 
                                                ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' 
                                                : 'bg-red-950/30 text-red-400 border-red-500/20'
                                            }`}
                                          >
                                            <option value="active">Active</option>
                                            <option value="suspended">Suspended</option>
                                          </select>
                                        </td>
                                        <td className="py-3">
                                          <button
                                            onClick={() => handleUpdateUserPermissions(u.id, { aiPermission: u.aiPermission !== false ? false : true })}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all border cursor-pointer ${
                                              u.aiPermission !== false 
                                                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                                            }`}
                                          >
                                            {u.aiPermission !== false ? 'Allowed' : 'Revoked'}
                                          </button>
                                        </td>
                                        <td className="py-3">
                                          <div className="flex items-center gap-1.5">
                                            <input
                                              type="number"
                                              min={1}
                                              max={100}
                                              value={u.campaignLimit || 5}
                                              onChange={(e) => handleUpdateUserPermissions(u.id, { campaignLimit: Number(e.target.value) })}
                                              className="w-10 bg-black/80 text-white font-mono text-center border border-white/10 rounded-lg p-1 text-[11px] focus:outline-none focus:border-indigo-500"
                                            />
                                            <span className="text-[9px] text-gray-500 font-mono">camps</span>
                                          </div>
                                        </td>
                                        <td className="py-3 text-right">
                                          <button
                                            onClick={() => handlePurgeUser(u.id, u.fullName)}
                                            className="px-2 py-1 bg-red-950/10 hover:bg-red-950/25 text-red-400 border border-red-500/10 hover:border-red-500/20 rounded-lg text-[10px] font-bold cursor-pointer transition-colors disabled:opacity-30 animate-pulse-slow"
                                            disabled={!isSuperAdmin}
                                          >
                                            Purge
                                          </button>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* TAB 2: CAMPAIGNS LIST */}
                        {activeTab === 'campaigns' && (
                          <table className="w-full text-left text-xs text-gray-400">
                            <thead>
                              <tr className="border-b border-white/5 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                                <th className="py-2.5">Campaign Info</th>
                                <th className="py-2.5">B2B Core Offer</th>
                                <th className="py-2.5">Created At</th>
                                <th className="py-2.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {filteredCampaigns.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="py-12 text-center text-gray-500 font-mono">No campaign channels recorded.</td>
                                </tr>
                              ) : (
                                filteredCampaigns.map((c) => (
                                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="py-3">
                                      <div>
                                        <p className="font-bold text-white block">{c.name}</p>
                                        <p className="text-[9px] text-gray-500 font-mono mt-0.5">{c.id}</p>
                                      </div>
                                    </td>
                                    <td className="py-3 font-semibold text-indigo-400">{c.serviceName}</td>
                                    <td className="py-3 text-gray-400 text-[11px]">{new Date(c.createdAt).toLocaleDateString()}</td>
                                    <td className="py-3 text-right">
                                      <button
                                        onClick={() => handlePurgeCampaign(c.id, c.name)}
                                        className="p-1.5 bg-red-950/10 hover:bg-red-950/20 text-red-400 hover:text-red-300 rounded-lg cursor-pointer border border-red-500/10 transition-colors disabled:opacity-30"
                                        title="Purge Campaign"
                                        disabled={!isSuperAdmin}
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        )}

                        {/* TAB 3: LIVE ACTIVITIES */}
                        {activeTab === 'activities' && (
                          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                            {filteredActivities.length === 0 ? (
                              <div className="py-12 text-center text-gray-500 font-mono">No system activities logged.</div>
                            ) : (
                              filteredActivities.map((a) => (
                                <div 
                                  key={a.id} 
                                  className="p-3 bg-black/40 border border-white/5 rounded-2xl flex items-start gap-3 hover:border-indigo-500/10 transition-colors"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-indigo-950/20 border border-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                                    <Terminal size={11} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="font-bold text-white text-xs block">{a.action}</span>
                                      <span className="text-[9px] text-gray-500 font-mono flex items-center gap-1 shrink-0">
                                        <Clock size={10} />
                                        {new Date(a.timestamp).toLocaleTimeString()}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{a.details}</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {/* TAB 4: PROMPTS AUDIT */}
                        {activeTab === 'prompts' && (
                          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                            {filteredPrompts.length === 0 ? (
                              <div className="py-12 text-center text-gray-500 font-mono text-xs">No matching AI prompts audit history recorded.</div>
                            ) : (
                              filteredPrompts.map((p) => (
                                <div 
                                  key={p.id} 
                                  className="p-4 bg-black/40 border border-white/5 rounded-2xl space-y-3 hover:border-indigo-500/10 transition-colors"
                                >
                                  <div className="flex justify-between items-center gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[8px] font-mono font-bold rounded">
                                        {p.modelUsed}
                                      </span>
                                      <span className="text-xs font-bold text-white">Target: {p.prospectName}</span>
                                    </div>
                                    <span className="text-[9px] text-gray-500 font-mono">
                                      {new Date(p.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] font-mono">
                                    <div className="p-2.5 bg-[#070709] rounded-xl border border-white/5 space-y-1">
                                      <span className="text-gray-500 font-bold block text-[8px] uppercase">PROMPT QUERY SCHEMA</span>
                                      <p className="text-gray-400 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{p.prompt}</p>
                                    </div>
                                    <div className="p-2.5 bg-[#070709] rounded-xl border border-white/5 space-y-1">
                                      <span className="text-indigo-400 font-bold block text-[8px] uppercase">GENERATED CO-PILOT RESPONSE</span>
                                      <p className="text-gray-300 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">{p.response}</p>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {/* TAB 5: SYSTEM MAINTENANCE & GOVERNANCE */}
                        {activeTab === 'maintenance' && (
                          <div className="space-y-6 animate-fade-in" id="governance-management-stage">
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              
                              {/* Left Card: Application Policy Overrides */}
                              <div className="p-5 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                                  <Shield size={16} className="text-indigo-400" />
                                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Access Controls & AI Rules</h4>
                                </div>
                                
                                <div className="space-y-4">
                                  {/* Toggle: Maintenance Mode */}
                                  <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <div className="space-y-0.5 pr-2">
                                      <span className="text-xs font-bold text-white block">SDR Maintenance Mode (Lockout)</span>
                                      <p className="text-[10px] text-gray-500 leading-normal">
                                        Temporarily disable access for non-staff SDR users. Staff accounts retain administrative privileges.
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleSaveGlobalConfig({ ...globalConfig, maintenanceMode: !globalConfig.maintenanceMode })}
                                      className={`px-3 py-1.5 text-xs font-bold font-mono rounded-xl border transition-all cursor-pointer ${
                                        globalConfig.maintenanceMode 
                                          ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/10' 
                                          : 'bg-slate-900 border-white/5 text-gray-400 hover:text-white'
                                      }`}
                                    >
                                      {globalConfig.maintenanceMode ? 'Active (Lockout)' : 'Inactive'}
                                    </button>
                                  </div>

                                  {/* Select: Default AI Model */}
                                  <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <div className="space-y-0.5">
                                      <span className="text-xs font-bold text-white block">Standard Workspace AI Model</span>
                                      <p className="text-[10px] text-gray-500 leading-normal">
                                        Enforce standard model selection for automatic lead sequences.
                                      </p>
                                    </div>
                                    <select
                                      value={globalConfig.defaultModel}
                                      onChange={(e) => handleSaveGlobalConfig({ ...globalConfig, defaultModel: e.target.value })}
                                      className="bg-black/90 text-slate-200 border border-white/10 rounded-xl p-2 text-xs font-mono font-semibold cursor-pointer focus:outline-none focus:border-indigo-500"
                                    >
                                      <option value="gemini-3.5-flash">Gemini 3.5 Flash (SDR Fast)</option>
                                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Rich Context)</option>
                                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Precision)</option>
                                    </select>
                                  </div>

                                  {/* Input: Daily Limit */}
                                  <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-2xl">
                                    <div className="space-y-0.5">
                                      <span className="text-xs font-bold text-white block">Global Daily Generation Cap</span>
                                      <p className="text-[10px] text-gray-500 leading-normal">
                                        Max prompt generations per individual user daily to prevent rate limits.
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min={10}
                                        max={1000}
                                        value={globalConfig.globalDailyQuota}
                                        onChange={(e) => handleSaveGlobalConfig({ ...globalConfig, globalDailyQuota: Number(e.target.value) })}
                                        className="w-16 bg-black/90 text-white font-mono text-center border border-white/10 rounded-xl p-2 text-xs focus:outline-none focus:border-indigo-500"
                                      />
                                      <span className="text-[10px] text-gray-500 font-bold uppercase font-mono">Prompts</span>
                                    </div>
                                  </div>

                                </div>
                              </div>

                              {/* Right Card: DB Integrity & Encryption */}
                              <div className="p-5 bg-black/40 border border-white/5 rounded-3xl space-y-4">
                                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                                  <Database size={16} className="text-indigo-400" />
                                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Database Integrity & Diagnostics</h4>
                                </div>

                                <div className="space-y-3.5 text-xs font-mono">
                                  <div className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                                    <span className="text-gray-500 uppercase text-[10px]">Data Storage Status</span>
                                    <span className="text-emerald-400 font-bold">🟢 SYNCHRONIZED</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                                    <span className="text-gray-500 uppercase text-[10px]">Memory DB Engine</span>
                                    <span className="text-white font-bold">JSON PERSISTENT FILE</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                                    <span className="text-gray-500 uppercase text-[10px]">Local Database File</span>
                                    <span className="text-white font-bold">database.json</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                                    <span className="text-gray-500 uppercase text-[10px]">SSL Certificate Check</span>
                                    <span className="text-indigo-400 font-bold">ACTIVE (TLS v1.3 SECURED)</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                                    <span className="text-gray-500 uppercase text-[10px]">Encryption Standard</span>
                                    <span className="text-indigo-400 font-bold">256-BIT AES ENCRYPTED</span>
                                  </div>
                                  <div className="flex items-center justify-between py-1">
                                    <span className="text-gray-500 uppercase text-[10px]">Connected Containers</span>
                                    <span className="text-gray-300 font-semibold">1 Active Node (Ingress Port 3000)</span>
                                  </div>
                                </div>
                              </div>

                            </div>

                            <div className="p-5 bg-indigo-600/5 border border-indigo-500/10 rounded-3xl space-y-2">
                              <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                                <Shield className="text-indigo-400" size={14} />
                                Administrative Workspace Notice
                              </h5>
                              <p className="text-[11px] text-gray-400 leading-relaxed">
                                Under B2B security directives, updating global policies immediately enforces rate ceilings and blocks non-executive personnel if lockout is toggled. Each policy switch creates a secure audit trail event inside the live activities registry.
                              </p>
                            </div>

                          </div>
                        )}

                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Footer timestamp */}
            <div className="border-t border-white/5 pt-4 flex flex-col sm:flex-row items-center justify-between text-[10px] text-gray-500 gap-2 font-mono mt-6">
              <span>Staff Oversight Terminal authenticated under SSL protection.</span>
              <span>Last Synchronized: {stats ? new Date(stats.lastUpdated).toLocaleTimeString() : 'N/A'}</span>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}

// Immersive Mini Markdown parser for customized report evaluation look and feel
function MiniMarkdownRenderer({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-3.5 text-xs text-gray-300 leading-relaxed font-sans">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={i} className="text-xs font-bold text-white mt-4 border-b border-white/5 pb-1 uppercase tracking-wider">
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="text-sm font-bold text-indigo-400 mt-5 border-l-2 border-indigo-500 pl-2 uppercase tracking-wide">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={i} className="text-base font-black text-white mt-6 mb-2 tracking-tight">
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.slice(2);
          return (
            <div key={i} className="flex items-start gap-2 pl-2">
              <span className="text-indigo-400 shrink-0 mt-1">•</span>
              <span>{parseBoldText(content)}</span>
            </div>
          );
        }
        if (trimmed === '---') {
          return <hr key={i} className="my-4 border-white/5" />;
        }
        if (!trimmed) {
          return <div key={i} className="h-1" />;
        }
        return <p key={i}>{parseBoldText(trimmed)}</p>;
      })}
    </div>
  );
}

function parseBoldText(text: string) {
  const parts = text.split('**');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} className="text-white font-bold">{part}</strong>;
    }
    return part;
  });
}
