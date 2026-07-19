/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw,
  Sparkles,
  ChevronRight,
  Clipboard,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { motion } from 'motion/react';
import { Prospect } from '../types';

interface ImporterProps {
  campaignId: string;
  onImportComplete: (prospects: Partial<Prospect>[]) => void;
  onCancel: () => void;
}

export default function Importer({ campaignId, onImportComplete, onCancel }: ImporterProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [activeTab, setActiveTab] = useState<'pdf' | 'paste'>('pdf');
  
  // PDF upload states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  
  // Copy & Paste states
  const [pastedText, setPastedText] = useState<string>('');
  
  // App UI states
  const [dragActive, setDragActive] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [importPreview, setImportPreview] = useState<Partial<Prospect>[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setErrorMessage('Invalid file format. Please upload a PDF document.');
      return;
    }
    setPdfFile(file);
    setErrorMessage('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setPdfBase64(base64);
    };
    reader.onerror = () => {
      setErrorMessage('Error reading the uploaded PDF file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePdfUpload(e.dataTransfer.files[0]);
    }
  };

  const clearPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPdfFile(null);
    setPdfBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Perform Gemini-powered Parsing via REST backend API
  const handleExtractProspects = async () => {
    if (activeTab === 'pdf' && !pdfBase64) {
      setErrorMessage('Please upload a PDF document first.');
      return;
    }
    if (activeTab === 'paste' && !pastedText.trim()) {
      setErrorMessage('Please paste some text data representing lead details.');
      return;
    }

    setIsParsing(true);
    setErrorMessage('');

    try {
      const payload: Record<string, string> = {};
      if (activeTab === 'pdf' && pdfBase64) {
        payload.pdf = pdfBase64;
      } else {
        payload.text = pastedText;
      }

      const response = await fetch('/api/prospects/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse prospects.');
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.prospects)) {
        if (data.prospects.length === 0) {
          throw new Error('No prospects could be found or extracted. Please verify the input content is descriptive.');
        }
        setImportPreview(data.prospects);
        setStep(2);
      } else {
        throw new Error('AI parsing completed but returned invalid data structure.');
      }
    } catch (err: any) {
      console.error('AI Extractor Failure:', err);
      setErrorMessage(err.message || 'An error occurred while parsing content with Gemini.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFinalImport = () => {
    if (importPreview.length === 0) return;
    onImportComplete(importPreview);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-bento-card border border-bento-border rounded-3xl space-y-6" id="leads-importer-container">
      
      {/* Header and Steps */}
      <div className="flex items-center justify-between pb-4 border-b border-bento-border">
        <div className="space-y-0.5 font-display">
          <h2 className="text-lg font-bold text-white">AI Prospect Extractor</h2>
          <p className="text-gray-400 text-xs font-sans">Leverage Gemini to parse unstructured content into structured Leads.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold border ${
                step === s 
                  ? 'bg-indigo-600 border-indigo-500 text-white' 
                  : step > s 
                    ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                    : 'bg-[#0A0A0B] border-bento-border text-gray-500'
              }`}>
                {s}
              </span>
              <span className={step === s ? 'text-white font-medium' : 'text-gray-500'}>
                {s === 1 ? 'Input & Extract' : 'Review & Import'}
              </span>
              {s < 2 && <ChevronRight size={12} className="text-slate-600" />}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: Input Section */}
      {step === 1 && (
        <div className="space-y-6 font-sans">
          
          {/* Instructions header banner */}
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-3">
            <Sparkles className="text-indigo-400 shrink-0 mt-0.5" size={16} />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white font-display">High-Fidelity Lead Extraction</h4>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Directly supply a PDF resume, sales list, company directory, or simply copy & paste email chains, LinkedIn profile copy, and raw bios. Our Gemini-powered pipeline will automatically structure the information into structured B2B prospects.
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex justify-center">
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#0A0A0B] border border-bento-border rounded-2xl w-full max-w-sm">
              <button
                id="tab-pdf-selector"
                onClick={() => {
                  setActiveTab('pdf');
                  setErrorMessage('');
                }}
                className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'pdf'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileText size={14} />
                Upload PDF Document
              </button>
              <button
                id="tab-paste-selector"
                onClick={() => {
                  setActiveTab('paste');
                  setErrorMessage('');
                }}
                className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'paste'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Clipboard size={14} />
                Copy & Paste Text
              </button>
            </div>
          </div>

          {/* Tab Content: PDF */}
          {activeTab === 'pdf' && (
            <div className="space-y-4">
              {!pdfFile ? (
                <div 
                  id="pdf-drop-zone"
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4 cursor-pointer transition-all ${
                    dragActive 
                      ? 'border-indigo-500 bg-indigo-500/5' 
                      : 'border-bento-border hover:border-bento-border-highlight bg-[#0A0A0B]/40 hover:bg-[#0A0A0B]/60'
                  }`}
                >
                  <input 
                    id="pdf-file-input"
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handlePdfUpload(e.target.files[0])}
                    accept=".pdf"
                    className="hidden"
                  />
                  <div className="p-4 bg-bento-card border border-bento-border rounded-2xl text-gray-400">
                    <Upload size={24} className="text-indigo-400 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white font-display">Drag & drop your PDF file here</p>
                    <p className="text-gray-500 text-xs">or click to browse local files (PDF list or exported bios)</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#0A0A0B] border border-bento-border rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                      <FileText size={18} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-white truncate max-w-[300px]">{pdfFile.name}</p>
                      <p className="text-[10px] text-gray-500">{(pdfFile.size / 1024).toFixed(1)} KB • PDF Document</p>
                    </div>
                  </div>
                  <button 
                    onClick={clearPdf}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-bento-card-active rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Copy-Paste */}
          {activeTab === 'paste' && (
            <div className="space-y-3">
              <label className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider block font-display">Paste Raw Leads Information</label>
              <textarea
                id="raw-paste-textarea"
                placeholder="Paste names, job titles, companies, LinkedIn profile extracts, bio text, notes or email lists here..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="w-full h-56 bg-[#0A0A0B] border border-bento-border focus:border-indigo-500/50 focus:outline-none rounded-2xl p-4 text-xs text-white placeholder-gray-500 transition-colors leading-relaxed"
              />
            </div>
          )}

          {/* Error Message display */}
          {errorMessage && (
            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center gap-2.5 text-red-400 text-xs">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-bento-border">
            <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white cursor-pointer">
              Cancel
            </button>
            <button 
              id="ai-extract-leads-btn"
              onClick={handleExtractProspects}
              disabled={isParsing}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 rounded-xl shadow-lg cursor-pointer flex items-center gap-2 transition-all"
            >
              {isParsing ? (
                <>
                  <RefreshCw className="animate-spin" size={13} />
                  Structuring leads via Gemini...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Extract Prospects with AI
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading AI parser animation panel */}
      {isParsing && (
        <div className="p-12 text-center bg-[#0A0A0B]/40 border border-bento-border rounded-3xl flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin flex items-center justify-center"></div>
            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-400 animate-pulse" size={20} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white font-display">Deep Analyzing Lead Document</p>
            <p className="text-xs text-indigo-300 animate-pulse">Gemini is structuring records and identifying B2B pain points...</p>
          </div>
          <div className="text-[10px] text-gray-500 max-w-sm leading-relaxed space-y-1 font-mono">
            <p>✓ Reading payload bytes</p>
            <p>✓ Extracting professional roles and target companies</p>
            <p>✓ Inferring business challenges and technology stacks</p>
          </div>
        </div>
      )}

      {/* STEP 2: Review Preview */}
      {step === 2 && !isParsing && (
        <div className="space-y-6 font-sans">
          
          <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-2xl flex items-center gap-3">
            <CheckCircle2 size={18} className="text-green-400 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-white">AI Extraction Succeeded</p>
              <p className="text-[11px] text-gray-500">Gemini successfully parsed {importPreview.length} leads with high matching accuracy.</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-bento-border rounded-2xl max-h-[350px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0A0A0B] text-gray-400 uppercase tracking-wider text-[10px]">
                <tr className="border-b border-bento-border">
                  <th className="py-3 px-4">First Name</th>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Job Title</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Pain Points / Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1C1E] text-gray-300">
                {importPreview.map((item, index) => (
                  <tr key={index} className="hover:bg-[#1C1C1E]">
                    <td className="py-3 px-4 font-semibold text-white">{item.firstName} {item.lastName}</td>
                    <td className="py-3 px-4">{item.companyName}</td>
                    <td className="py-3 px-4">{item.jobTitle}</td>
                    <td className="py-3 px-4 text-gray-400">{item.location || 'Remote'}</td>
                    <td className="py-3 px-4 text-gray-500 truncate max-w-[200px]">
                      {item.painPoints || item.prospectSummary || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-bento-border">
            <button 
              onClick={() => {
                setStep(1);
                setImportPreview([]);
              }} 
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white cursor-pointer"
            >
              Back to Input
            </button>
            <button 
              id="finalize-leads-import-btn"
              onClick={handleFinalImport}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg cursor-pointer flex items-center gap-1.5 shadow-indigo-600/10 font-display"
            >
              <Sparkles size={13} /> Inject {importPreview.length} Prospects
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
