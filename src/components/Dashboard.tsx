/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Users, 
  Send, 
  MessageSquare, 
  TrendingUp, 
  Sparkles, 
  Award, 
  ListTodo, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  stats: any;
  activities: any[];
  campaigns: any[];
  onNavigate: (tab: string) => void;
  onSelectCampaign: (id: string) => void;
  onCreateCampaignClick: () => void;
}

export default function Dashboard({ 
  stats, 
  activities, 
  campaigns, 
  onNavigate,
  onSelectCampaign,
  onCreateCampaignClick
}: DashboardProps) {
  
  const summary = stats?.summary || {
    totalProspects: 0,
    totalCampaigns: 0,
    connectionSent: 0,
    pitchSent: 0,
    followup1Sent: 0,
    followup2Sent: 0,
    repliesCount: 0,
    wonCount: 0,
    lostCount: 0,
    replyRate: 0,
    conversionRate: 0,
    aiTokensUsed: 0,
    generationCount: 0
  };

  const campaignStats = stats?.campaignStats || [];
  const trend = stats?.activityTrend || [];

  const statCards = [
    {
      title: 'Total Prospects',
      value: summary.totalProspects,
      icon: Users,
      description: 'Leads loaded across campaigns',
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20'
    },
    {
      title: 'Pitches Sent',
      value: summary.pitchSent,
      icon: Send,
      description: 'First personalized outreach pitch',
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20'
    },
    {
      title: 'Reply Rate',
      value: `${summary.replyRate}%`,
      icon: TrendingUp,
      description: 'Replies per pitches sent',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    },
    {
      title: 'Deals Won',
      value: summary.wonCount,
      icon: Award,
      description: 'Converted prospects',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    }
  ];

  // Helper to draw clean SVG charts for trends
  const maxVal = Math.max(...trend.map(t => Math.max(t.Sent, t.Replies)), 1);

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-bento-card border border-bento-border rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="space-y-1 relative z-10 font-display">
          <h1 className="text-xl font-bold tracking-tight text-white">Prospecting Command Center</h1>
          <p className="text-gray-400 text-xs">Analyze B2B decision makers, design non-AI sounding pitches, and watch reply rates climb.</p>
        </div>
        <div className="flex gap-3 relative z-10">
          <button 
            id="import-leads-dashboard-btn"
            onClick={() => onNavigate('leads')}
            className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-[#1C1C1E] hover:bg-bento-card-hover border border-bento-border rounded-xl transition-all cursor-pointer"
          >
            Leads Hub
          </button>
          <button 
            id="create-camp-dashboard-btn"
            onClick={onCreateCampaignClick}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-600/15 cursor-pointer flex items-center gap-1.5"
          >
            Create Campaign <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-5 bg-bento-card border border-bento-border rounded-3xl space-y-3"
            id={`stat-card-${i}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">{card.title}</span>
              <div className={`p-2 rounded-xl border ${card.color}`}>
                <card.icon size={15} />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-3xl font-bold text-white tracking-tighter font-display">{card.value}</span>
              <p className="text-gray-500 text-[11px]">{card.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts & Campaign Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SVG Sparkline Activity Chart */}
        <div className="lg:col-span-2 p-6 bg-bento-card border border-bento-border rounded-3xl flex flex-col justify-between space-y-4" id="performance-chart">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white font-display uppercase tracking-wider">Outreach Activity Trend</h3>
            <p className="text-gray-500 text-xs">Pitches dispatched vs. replies acquired this week</p>
          </div>
          
          {/* Custom SVG Line Chart to avoid external charting libraries rendering errors */}
          <div className="h-56 w-full relative flex items-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 700 200" preserveAspectRatio="none">
              {/* Grid Lines */}
              <line x1="0" y1="20" x2="700" y2="20" stroke="#1F1F21" strokeDasharray="3,3" strokeWidth="1" />
              <line x1="0" y1="80" x2="700" y2="80" stroke="#1F1F21" strokeDasharray="3,3" strokeWidth="1" />
              <line x1="0" y1="140" x2="700" y2="140" stroke="#1F1F21" strokeDasharray="3,3" strokeWidth="1" />
              <line x1="0" y1="200" x2="700" y2="200" stroke="#2A2A2C" strokeWidth="1" />

              {/* Data Lines & Points for Sent */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
                points={trend.map((t, idx) => {
                  const x = (idx / (trend.length - 1)) * 700;
                  const y = 200 - (t.Sent / maxVal) * 160 - 15;
                  return `${x},${y}`;
                }).join(' ')}
              />
              {trend.map((t, idx) => {
                const x = (idx / (trend.length - 1)) * 700;
                const y = 200 - (t.Sent / maxVal) * 160 - 15;
                return (
                  <circle key={`sent-${idx}`} cx={x} cy={y} r="4" fill="#38bdf8" stroke="#0a0a0b" strokeWidth="2" />
                );
              })}

              {/* Data Lines & Points for Replies */}
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                points={trend.map((t, idx) => {
                  const x = (idx / (trend.length - 1)) * 700;
                  const y = 200 - (t.Replies / maxVal) * 160 - 15;
                  return `${x},${y}`;
                }).join(' ')}
              />
              {trend.map((t, idx) => {
                const x = (idx / (trend.length - 1)) * 700;
                const y = 200 - (t.Replies / maxVal) * 160 - 15;
                return (
                  <circle key={`rep-${idx}`} cx={x} cy={y} r="4" fill="#10b981" stroke="#0a0a0b" strokeWidth="2" />
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between items-center pt-2 text-gray-500 text-xs border-t border-bento-border">
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-sky-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span> Dispatched Pitches
              </span>
              <span className="flex items-center gap-1.5 text-green-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Hot Replies
              </span>
            </div>
            <div className="flex gap-8 pr-1 font-mono text-[10px]">
              {trend.map((t) => (
                <span key={t.name}>{t.name}</span>
              ))}
            </div>
          </div>
        </div>

        {/* AI & Delivery Statistics */}
        <div className="p-6 bg-bento-card border border-bento-border rounded-3xl flex flex-col justify-between" id="ai-stats-card">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white font-display uppercase tracking-wider">AI Coprocessor Health</h3>
            <p className="text-gray-500 text-xs">Token utilization and prompt analytics</p>
          </div>

          <div className="py-6 space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Personalization Rate</span>
                <span className="text-indigo-400 font-semibold">100% Unique</span>
              </div>
              <div className="w-full bg-[#1C1C1E] h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full w-full"></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Message Generations</span>
                <span className="text-sky-400 font-semibold">{summary.generationCount} / Unlimited</span>
              </div>
              <div className="w-full bg-[#1C1C1E] h-1.5 rounded-full overflow-hidden">
                <div className="bg-sky-400 h-full" style={{ width: `${Math.min(100, (summary.generationCount / 200) * 100)}%` }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Estimated Tokens Dispatched</span>
                <span className="text-amber-400 font-semibold">{(summary.aiTokensUsed).toLocaleString()} tokens</span>
              </div>
              <div className="w-full bg-[#1C1C1E] h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full" style={{ width: `${Math.min(100, (summary.aiTokensUsed / 250000) * 100)}%` }}></div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-2xl">
            <p className="text-gray-400 text-[11px] leading-relaxed flex items-start gap-2">
              <Sparkles className="text-indigo-400 shrink-0 mt-0.5" size={13} />
              AI writes outreach sequences customized to target's recent posts and pain points. Zero templates are repeated.
            </p>
          </div>
        </div>
      </div>

      {/* Campaigns & Lead Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Campaigns Table */}
        <div className="lg:col-span-2 p-6 bg-bento-card border border-bento-border rounded-3xl space-y-4" id="campaigns-table">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white font-display uppercase tracking-wider">Active Campaigns</h3>
              <p className="text-gray-500 text-xs">Performances by promoted SaaS/Service</p>
            </div>
            <button 
              id="view-all-camps-btn"
              onClick={() => onNavigate('leads')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
            >
              Leads Hub &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-bento-border text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2">Campaign Name</th>
                  <th className="py-3 px-2">Promoted Service</th>
                  <th className="py-3 px-2 text-center">Prospects</th>
                  <th className="py-3 px-2 text-center">Pitches</th>
                  <th className="py-3 px-2 text-center">Replies</th>
                  <th className="py-3 px-2 text-right">Reply Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1C1E] text-gray-300">
                {campaignStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No active campaigns. Click "Create Campaign" to launch one.
                    </td>
                  </tr>
                ) : (
                  campaignStats.map((camp: any) => (
                    <tr 
                      key={camp.id} 
                      className="hover:bg-bento-card-hover transition-colors cursor-pointer group"
                      onClick={() => onSelectCampaign(camp.id)}
                    >
                      <td className="py-3 px-2 font-semibold text-white group-hover:text-indigo-400 transition-colors">
                        {camp.name}
                      </td>
                      <td className="py-3 px-2 text-gray-400">{camp.serviceName}</td>
                      <td className="py-3 px-2 text-center">{camp.total}</td>
                      <td className="py-3 px-2 text-center">{camp.pitchSent}</td>
                      <td className="py-3 px-2 text-center text-green-500 font-medium">{camp.replies}</td>
                      <td className="py-3 px-2 text-right font-semibold text-white">
                        <span className="px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px]">
                          {camp.replyRate}%
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Logs / Audit Trail */}
        <div className="p-6 bg-bento-card border border-bento-border rounded-3xl flex flex-col justify-between space-y-4" id="recent-activities">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white font-display uppercase tracking-wider">Real-Time Logs</h3>
            <p className="text-gray-500 text-xs">Recent campaign and outreach actions</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-64 space-y-3 scrollbar-none pr-1">
            {activities.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs">
                No recent activity logged.
              </div>
            ) : (
              activities.map((act) => (
                <div key={act.id} className="flex gap-3 text-xs leading-relaxed p-2.5 bg-[#0a0a0b] border border-bento-border rounded-2xl">
                  <div className="mt-0.5 shrink-0 text-gray-400">
                    {act.type === 'import' && <Layers size={12} className="text-indigo-400" />}
                    {act.type === 'generate' && <Sparkles size={12} className="text-sky-400" />}
                    {act.type === 'status_change' && <ListTodo size={12} className="text-green-500" />}
                    {act.type === 'note_added' && <MessageSquare size={12} className="text-amber-400" />}
                    {act.type === 'manual_update' && <Send size={12} className="text-purple-400" />}
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between text-gray-400 font-semibold text-[11px]">
                      <span className="truncate pr-1">{act.action}</span>
                      <span className="text-[9px] text-gray-600 font-mono shrink-0">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-gray-300 font-normal text-[11px] leading-relaxed break-words">{act.details}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
