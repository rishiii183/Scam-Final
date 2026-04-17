import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion,
  Search, Mail, DollarSign, AlertCircle, Loader2,
  CheckCircle2, XCircle, User, Paperclip, Send, Sparkles,
  FileText, ScanSearch, Building2, TrendingDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import dollarGif from './assets/dollar.gif';
import companyGif from './assets/corporate-culture.gif';
import emailGif from './assets/message.gif';
import investigationGif from './assets/icons8-investigation.gif';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const API_BASE_URL = 'http://localhost:8000';
const INITIAL_MESSAGES = [];

const App = () => {
  const [activeTab, setActiveTab] = useState('investigation');
  const [conversations, setConversations] = useState([
    { id: Date.now(), title: 'Chat 1', messages: [...INITIAL_MESSAGES], formData: { job_url: '', company_claimed: '', recruiter_email: '', salary_offered: '', offer_text: '' } }
  ]);
  const [activeConvId, setActiveConvId] = useState(conversations[0].id);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const scrollContainerRef = useRef(null);
  const [userInput, setUserInput] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [analysisStep, setAnalysisStep] = useState(0);

  // ── Email Tab State ──────────────────────────────────────────────────────
  const [emailText, setEmailText] = useState('');
  const [emailResult, setEmailResult] = useState(null);
  const [isEmailAnalyzing, setIsEmailAnalyzing] = useState(false);
  const [emailError, setEmailError] = useState('');

  // ── Salary Tab State ─────────────────────────────────────────────────────
  const [salaryOffered, setSalaryOffered] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [salaryResult, setSalaryResult] = useState(null);
  const [isSalaryAnalyzing, setIsSalaryAnalyzing] = useState(false);
  const [salaryError, setSalaryError] = useState('');

  // ── Company Tab State ────────────────────────────────────────────────────
  const [companyName, setCompanyName] = useState('');
  const [companyResult, setCompanyResult] = useState(null);
  const [isCompanyAnalyzing, setIsCompanyAnalyzing] = useState(false);
  const [companyError, setCompanyError] = useState('');

  const analysisSteps = [
    "Auditing domain infrastructure...",
    "Verifying SSL certification...",
    "Cross-referencing company registries...",
    "Analyzing recruiter email headers...",
    "Calibrating salary coefficients...",
    "Scanning offer for fee demands...",
    "Detecting typosquatting signals...",
    "Verifying forensic integrity..."
  ];

  const anyLoading = isAnalyzing || isExtracting || isEmailAnalyzing || isSalaryAnalyzing || isCompanyAnalyzing;

  useEffect(() => {
    let interval;
    if (anyLoading) {
      interval = setInterval(() => {
        setAnalysisStep(prev => (prev + 1) % analysisSteps.length);
      }, 1000);
    } else {
      setAnalysisStep(0);
    }
    return () => clearInterval(interval);
  }, [anyLoading]);

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];
  const messages = activeConv.messages;
  const hasReport = messages.some(m => m.type === 'report');
  const formData = activeConv.formData;

  useEffect(() => {
    if (hasReport) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isAnalyzing, isExtracting, hasReport]);

  const updateActiveConv = (updates) => {
    setConversations(prev => prev.map(c => {
      if (c.id === activeConvId) {
        const nextMessages = typeof updates.messages === 'function' 
          ? updates.messages(c.messages) 
          : (updates.messages || c.messages);
        return { ...c, ...updates, messages: nextMessages };
      }
      return c;
    }));
  };

  const handleNewInvestigation = () => {
    const newId = Date.now();
    setConversations(prev => [...prev, {
      id: newId, title: `Chat ${prev.length + 1}`, messages: [...INITIAL_MESSAGES],
      formData: { job_url: '', company_claimed: '', recruiter_email: '', salary_offered: '', offer_text: '' }
    }]);
    setActiveConvId(newId);
    setActiveTab('investigation');
  };

  // ── Generic API Call Helper ──────────────────────────────────────────────
  const callCheckAPI = async (payload) => {
    const response = await axios.post(`${API_BASE_URL}/api/check`, {
      job_url: payload.job_url || "N/A",
      company_claimed: payload.company_claimed || "Unknown",
      recruiter_email: payload.recruiter_email || "",
      salary_offered: parseFloat(payload.salary_offered) || 0,
      offer_text: payload.offer_text || ""
    }, { headers: { 'Content-Type': 'application/json' } });
    return response.data;
  };

  // ── Email Analyze Handler ────────────────────────────────────────────────
  const handleEmailAnalyze = async () => {
    if (!emailText.trim()) return;
    setEmailError('');
    setEmailResult(null);
    setIsEmailAnalyzing(true);
    try {
      const data = await callCheckAPI({ offer_text: emailText.trim() });
      setEmailResult(data);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      setEmailError(status === 422
        ? `Payload mismatch (422): ${JSON.stringify(detail)}`
        : 'Backend unreachable — make sure Uvicorn is running on port 8000.');
    } finally {
      setIsEmailAnalyzing(false);
    }
  };

  // ── Salary Check Handler ─────────────────────────────────────────────────
  const handleSalaryCheck = async () => {
    if (!salaryOffered.trim() && !jobRole.trim()) return;
    setSalaryError('');
    setSalaryResult(null);
    setIsSalaryAnalyzing(true);
    try {
      // Extract numeric value from salary string (e.g. "$12,000 / month" → 12000)
      const numericSalary = parseFloat(salaryOffered.replace(/[^0-9.]/g, '')) || 0;
      const data = await callCheckAPI({
        salary_offered: numericSalary,
        company_claimed: jobRole.trim() || "Unknown Role",
        offer_text: `Job Role: ${jobRole}. Salary Offered: ${salaryOffered}.`
      });
      setSalaryResult(data);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      setSalaryError(status === 422
        ? `Payload mismatch (422): ${JSON.stringify(detail)}`
        : 'Backend unreachable — make sure Uvicorn is running on port 8000.');
    } finally {
      setIsSalaryAnalyzing(false);
    }
  };

  // ── Company Check Handler ────────────────────────────────────────────────
  const handleCompanyCheck = async () => {
    if (!companyName.trim()) return;
    setCompanyError('');
    setCompanyResult(null);
    setIsCompanyAnalyzing(true);
    try {
      const data = await callCheckAPI({
        company_claimed: companyName.trim(),
        offer_text: `Company name to verify: ${companyName.trim()}`
      });
      setCompanyResult(data);
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      setCompanyError(status === 422
        ? `Payload mismatch (422): ${JSON.stringify(detail)}`
        : 'Backend unreachable — make sure Uvicorn is running on port 8000.');
    } finally {
      setIsCompanyAnalyzing(false);
    }
  };

  const extractTextFromPDF = async (file) => {
    setIsExtracting(true);
    const userMsg = {
      role: 'user', type: 'pdf', content: file.name,
      fileSize: (file.size / 1024).toFixed(1) + ' KB',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    updateActiveConv({ messages: [...messages, userMsg] });
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
      }
      const cleanText = fullText.replace(/\s+/g, ' ').trim();
      const aiMsg = {
        role: 'ai', type: 'text',
        content: `Document integrity verified. Extracted ${cleanText.length} characters from "${file.name}". Running forensic analysis...`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const newFormData = { ...formData, offer_text: cleanText };
      updateActiveConv({ 
        messages: (prev) => [...prev, userMsg, aiMsg], 
        formData: newFormData 
      });
      setIsExtracting(false);
      setIsAnalyzing(true);
      try {
        const response = await axios.post(`${API_BASE_URL}/api/check`, {
          job_url: newFormData.job_url || "N/A",
          company_claimed: newFormData.company_claimed || "Unknown",
          recruiter_email: newFormData.recruiter_email || "",
          salary_offered: parseFloat(newFormData.salary_offered) || 0,
          offer_text: cleanText
        }, { headers: { 'Content-Type': 'application/json' } });
        const reportMsg = {
          role: 'ai', type: 'report', data: response.data,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        updateActiveConv({ messages: (prev) => [...prev, reportMsg] });
      } catch (err) {
        const errText = err?.response?.status === 422
          ? `Payload mismatch (422): ${JSON.stringify(err.response.data.detail)}`
          : 'Backend unreachable — make sure Uvicorn is running on port 8000.';
        updateActiveConv({ messages: (prev) => [...prev, { role: 'ai', type: 'text', content: errText, timestamp: 'ERROR' }] });
      } finally { setIsAnalyzing(false); }
      return;
    } catch (err) {
      console.error('PDF extraction error:', err);
      const errMsg = err?.message?.includes('worker') || err?.message?.includes('Worker')
        ? 'ERROR: PDF worker failed to load. Check internet connection.'
        : `ERROR: ${err?.message || 'Signal noise detected in PDF buffer.'}`;
      updateActiveConv({ messages: [...messages, userMsg, { role: 'ai', type: 'text', content: errMsg, timestamp: 'EXCEPTION' }] });
    } finally { setIsExtracting(false); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') extractTextFromPDF(file);
  };

  // ── handleSend (Job URL tab) ─────────────────────────────────────────────
  const handleSend = () => {
    if (!userInput.trim()) return;
    const text = userInput.trim();

    const userMsg = {
      role: 'user', type: 'text', content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    let newFormData = { ...formData };
    const isUrl = text.startsWith('http') || text.includes('www.') || (text.includes('.') && !text.includes(' '));
    
    if (isUrl) newFormData.job_url = text;
    else if (text.includes('@')) newFormData.recruiter_email = text;
    else if (/^\d+(\.\d+)?$/.test(text)) newFormData.salary_offered = text;
    else if (!newFormData.company_claimed) newFormData.company_claimed = text;
    else newFormData.offer_text = text;

    updateActiveConv({ messages: (prev) => [...prev, userMsg], formData: newFormData });
    setUserInput('');

    const payload = {
      job_url: newFormData.job_url || "N/A",
      company_claimed: newFormData.company_claimed || "Unknown",
      recruiter_email: newFormData.recruiter_email || "",
      salary_offered: parseFloat(newFormData.salary_offered) || 0,
      offer_text: newFormData.offer_text || text
    };

    const shouldAnalyze = newFormData.job_url || newFormData.offer_text || isUrl;
    if (!shouldAnalyze) return;

    (async () => {
      setIsAnalyzing(true);
      try {
        const response = await axios.post(`${API_BASE_URL}/api/check`, payload, {
          headers: { 'Content-Type': 'application/json' }
        });
        const reportMsg = {
          role: 'ai', type: 'report', data: response.data,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        updateActiveConv({ messages: (prev) => [...prev, reportMsg] });
      } catch (err) {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail;
        const errText = status === 422
          ? `Payload mismatch (422): ${JSON.stringify(detail)}`
          : `Backend unreachable — make sure Uvicorn is running on port 8000.`;
        updateActiveConv({
          messages: (prev) => [...prev, { role: 'ai', type: 'text', content: errText, timestamp: 'ERROR' }]
        });
      } finally { setIsAnalyzing(false); }
    })();
  };

  const getVerdictStyles = (verdict) => {
    switch (verdict) {
      case 'VERIFIED': return { color: 'text-emerald-500', icon: ShieldCheck };
      case 'UNVERIFIED': return { color: 'text-blue-500', icon: ShieldQuestion };
      case 'SUSPICIOUS': return { color: 'text-amber-500', icon: ShieldAlert };
      case 'SCAM': return { color: 'text-rose-500', icon: ShieldX };
      default: return { color: 'text-slate-500', icon: Search };
    }
  };

  const flattenSignals = (signals) => {
    if (!signals) return [];
    if (Array.isArray(signals)) return signals;
    const result = [];
    if (Array.isArray(signals.cyber_signals)) {
      signals.cyber_signals.forEach(s => {
        result.push({ flag: s.flag ?? false, reason: s.reason ?? '', category: s.category ?? '', check: s.check ?? '' });
      });
    }
    if (signals.ml_details && typeof signals.ml_details === 'object') {
      Object.entries(signals.ml_details).forEach(([key, val]) => {
        if (val && typeof val === 'object' && 'reason' in val) {
          result.push({ flag: val.flag ?? false, reason: val.reason, category: 'ML · ' + key.toUpperCase(), check: key });
        }
      });
    }
    return result;
  };

  // ── ReportCard ───────────────────────────────────────────────────────────
  const ReportCard = ({ data, onReset }) => {
    const [expanded, setExpanded] = useState(false);
    const verdictStyle = getVerdictStyles(data.verdict);
    const allSignals = flattenSignals(data.signals);
    const flagged = allSignals.filter(s => s.flag);
    const clean = allSignals.filter(s => !s.flag);
    const score = data.trust_score ?? data.score ?? 0;
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const strokeDash = (score / 100) * circumference;
    const strokeColor =
      data.verdict === 'VERIFIED' ? '#10b981' :
        data.verdict === 'SCAM' ? '#f43f5e' :
          data.verdict === 'SUSPICIOUS' ? '#f59e0b' : '#3b82f6';

    return (
      <div className={`border-2 rounded-[32px] overflow-hidden shadow-2xl text-left w-full transition-all 
        ${isDarkMode 
          ? 'bg-[#0b1120]/40 border-white/5 backdrop-blur-xl' 
          : 'bg-white/40 border-white/60 backdrop-blur-xl shadow-blue-500/5'}`}>
        <div className="p-6 lg:p-10 space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="space-y-1.5 flex-1">
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-[#9ca3af]'}`}>Forensic Verdict</p>
              <h2 className={`text-4xl font-black tracking-tighter font-display ${verdictStyle.color}`}>{data.verdict}</h2>
              {data.summary && (
                <p className={`text-xs font-medium mt-1 leading-relaxed max-w-md ${isDarkMode ? 'text-slate-400' : 'text-[#6b7280]'}`}>{data.summary}</p>
              )}
              {data.request_id && (
                <span className={`inline-block mt-2 text-[10px] font-mono px-3 py-1 rounded-lg ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-[#f3f4f6] text-[#9ca3af]'}`}>
                  ID: {data.request_id}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative w-20 h-20">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r={radius} fill="none" stroke={isDarkMode ? '#1e293b' : '#f3f4f6'} strokeWidth="8" />
                  <circle cx="40" cy="40" r={radius} fill="none"
                    stroke={strokeColor} strokeWidth="8"
                    strokeDasharray={`${strokeDash} ${circumference}`}
                    strokeLinecap="round" />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-xl font-black ${verdictStyle.color}`}>{score}</span>
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-[#9ca3af]'}`}>Trust Score</p>
            </div>
          </div>

          {/* Flagged signals */}
          {flagged.length > 0 && (
            <div className="space-y-3">
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-rose-400' : 'text-rose-500'}`}>
                ⚠ Threat Signals — {flagged.length} found
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(expanded ? flagged : flagged.slice(0, 3)).map((sig, i) => (
                  <div key={i} className={`flex items-start gap-4 p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-rose-500/5 border-rose-500/20' : 'bg-rose-50/40 border-rose-100'}`}>
                    <div className={`p-2 rounded-lg shrink-0 ${isDarkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-100 text-rose-500'}`}><XCircle size={16} /></div>
                    <div className="min-w-0">
                      <p className={`text-[13px] font-bold ${isDarkMode ? 'text-rose-200' : 'text-rose-900'}`}>{sig.reason}</p>
                      <p className={`text-[10px] font-black uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-rose-500/50' : 'text-rose-300'}`}>{sig.category}{sig.check ? ' · ' + sig.check : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clean signals - Only shown for non-critical scores */}
          {clean.length > 0 && score > 35 && (
            <div className="space-y-3">
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-emerald-400' : 'text-emerald-500'}`}>
                ✓ Clear Checks — {clean.length} passed
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(expanded ? clean : clean.slice(0, 3)).map((sig, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50/30 border-emerald-100'}`}>
                    <div className={`p-2 rounded-lg shrink-0 ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-500'}`}><CheckCircle2 size={16} /></div>
                    <div className="min-w-0">
                      <p className={`text-[12px] font-bold leading-tight ${isDarkMode ? 'text-emerald-200' : 'text-emerald-900'}`}>{sig.reason}</p>
                      <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-emerald-500/50' : 'text-emerald-400'}`}>{sig.category}{sig.check ? ' · ' + sig.check : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View More */}
          {(flagged.length > 3 || (score > 35 && clean.length > 3)) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`w-full py-4 rounded-2xl border-2 border-dashed font-black uppercase tracking-widest text-[10px] transition-all
                ${isDarkMode ? 'border-white/10 text-slate-500 hover:text-white hover:bg-white/5' : 'border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-white/40'}`}
            >
              {expanded ? '↑ Show Less' : `↓ View ${flagged.length + (score > 35 ? clean.length : 0) - (Math.min(flagged.length, 3) + (score > 35 ? Math.min(clean.length, 3) : 0))} More Signal Checks`}
            </button>
          )}

          {/* Recommendations */}
          {data.recommendations && data.recommendations.length > 0 && (
            <div className="space-y-3">
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`}>Recommendations</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.recommendations.map((rec, i) => (
                  <div key={i} className={`flex items-center gap-3 p-4 rounded-2xl border-2 ${isDarkMode ? 'bg-amber-500/5 border-amber-500/20 text-amber-200' : 'bg-amber-50/30 border-amber-100 text-amber-900'}`}>
                    <AlertCircle size={16} className="shrink-0 text-amber-500" />
                    <p className="text-[13px] font-bold">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset button for non-investigation tabs */}
          {onReset && (
            <div className="flex justify-center pt-4">
              <button onClick={onReset}
                className={`group px-6 py-3 rounded-full flex items-center gap-3 font-sans ${isDarkMode ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20' : 'bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/10 hover:bg-[#2563eb]/20'}`}>
                <ScanSearch size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">Run New Analysis</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Loading Overlay ───────────────────────────────────────────────────────
  const LoadingOverlay = ({ label }) => (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className={`w-[64px] h-[64px] rounded-2xl flex items-center justify-center shadow-2xl ${isDarkMode ? 'bg-violet-600/10' : 'bg-[#2563eb]/10'}`}>
        <Loader2 size={32} className={`animate-spin ${isDarkMode ? 'text-violet-500' : 'text-[#2563eb]'}`} />
      </div>
      <div className={`border rounded-[20px] px-8 py-4 text-sm font-black uppercase tracking-widest ${isDarkMode ? 'bg-[#1e293b]/50 border-slate-800 text-slate-200' : 'bg-white border-[#e5e7eb] text-gray-900 shadow-xl shadow-blue-500/5'}`}>
        {label || analysisSteps[analysisStep]}
      </div>
    </div>
  );

  // ── Error Box ─────────────────────────────────────────────────────────────
  const ErrorBox = ({ msg }) => (
    <div className={`mt-4 p-4 rounded-2xl border-2 text-xs font-bold ${isDarkMode ? 'bg-rose-500/5 border-rose-500/20 text-rose-300' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
      {msg}
    </div>
  );

  return (
    <div className={`flex h-screen font-sans antialiased overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-[#020617] text-slate-200 selection:bg-violet-500/30' : 'bg-[#f3f4f6] text-[#374151] selection:bg-blue-100'}`}>
      <main className={`flex-1 flex flex-col relative min-w-0 transition-colors duration-300 ${isDarkMode ? 'bg-[#020617]' : 'bg-[#f9fafb]'}`}>

        {/* ── Fixed Glass Navbar ── */}
        <header className="fixed top-0 left-0 right-0 h-[110px] flex items-center justify-center bg-transparent z-50 pointer-events-none">
          <div 
            style={{ 
              backdropFilter: 'blur(80px) saturate(200%) contrast(110%)', 
              WebkitBackdropFilter: 'blur(80px) saturate(200%) contrast(110%)' 
            }}
            className={`pointer-events-auto flex items-center p-1.5 rounded-full border transition-all duration-500 shadow-[0_8px_32px_rgb(0,0,0,0.12)] 
              ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white/30 border-white/60'}`}>
            <nav className="flex items-center gap-1">
              {[
                { key: 'investigation', label: 'Job URL' },
                { key: 'email', label: 'E-mail Audit' },
                { key: 'salary', label: 'Salary' },
                { key: 'company', label: 'Company' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`relative flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.14em] px-6 py-3.5 rounded-full transition-all duration-300 font-display z-10 ${activeTab === key
                    ? 'text-white'
                    : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-[#6b7280] hover:text-[#111827]')}`}>
                  <motion.span 
                    layout
                    className="relative z-20 transition-colors duration-300">
                    {label}
                  </motion.span>
                  {activeTab === key && (
                    <motion.div
                      layoutId="active-tab"
                      className={`absolute inset-0 rounded-full shadow-lg z-10 ${isDarkMode ? 'bg-violet-600 shadow-violet-500/20' : 'bg-[#2563eb] shadow-blue-500/20'}`}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* ── Main Content (Shifted for Nav) ── */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto scroll-smooth pt-[110px]">

          {/* ════════════════════ JOB URL TAB ════════════════════ */}
          {activeTab === 'investigation' ? (
            <div className={`px-4 lg:px-10 py-10 h-full ${messages.length === 0 ? 'overflow-hidden' : ''}`}>
              <div className={`max-w-[900px] mx-auto flex flex-col space-y-8 ${messages.length === 0 ? 'h-full' : 'pb-32'}`}>
                {messages.length === 0 && (
                  <div className="flex flex-col items-center pt-20 pb-10 text-center space-y-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-md ${isDarkMode ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-blue-50 shadow-blue-500/5'}`}>
                      <img src={investigationGif} alt="Investigation" className="w-full h-full object-contain p-1 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>New Investigation</h2>
                      <p className={`max-w-sm text-sm ${isDarkMode ? 'text-slate-400' : 'text-[#6b7280]'}`}>Paste a job URL or upload a PDF offer letter to begin analysis.</p>
                    </div>
                    <button onClick={handleNewInvestigation}
                      className={`text-[11px] font-black uppercase tracking-widest px-6 py-3 rounded-full border transition-all ${isDarkMode ? 'border-slate-700 text-slate-400 hover:text-white' : 'border-[#e5e7eb] text-[#6b7280] hover:text-[#111827]'}`}>
                      + New Chat
                    </button>
                  </div>
                )}
                {hasReport ? (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {messages.filter(m => m.type === 'report').map((msg, idx) => (
                      <ReportCard key={idx} data={msg.data} />
                    ))}
                    <div className="flex justify-center pt-8">
                      <button onClick={handleNewInvestigation}
                        className={`group px-6 py-3 rounded-full flex items-center gap-3 font-sans ${isDarkMode ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20' : 'bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/10 hover:bg-[#2563eb]/20'}`}>
                        <ScanSearch size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">New Audit</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {!(isAnalyzing || isExtracting) && messages.map((msg, idx) => (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={idx}
                        className={`flex gap-4 lg:gap-6 ${msg.role === 'user' ? 'flex-row-reverse justify-start self-end' : 'justify-start'}`}>
                        <div className={`w-[28px] h-[28px] lg:w-[32px] lg:h-[32px] flex-shrink-0 rounded-lg flex items-center justify-center shadow-md mt-1 ${msg.role === 'ai' ? (isDarkMode ? 'bg-violet-600 text-white' : 'bg-[#2563eb] text-white') : (isDarkMode ? 'bg-[#1e293b] text-slate-300' : 'bg-[#111827] text-white')}`}>
                          {msg.role === 'ai' ? <ShieldCheck size={14} fill="white" /> : <User size={14} />}
                        </div>
                        <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[90%] lg:max-w-[85%]`}>
                          {msg.type === 'text' && (
                            <div className={`inline-block px-4 py-2 rounded-[18px] text-[13px] leading-relaxed shadow-sm border ${msg.role === 'user' ? (isDarkMode ? 'bg-slate-800 text-slate-200 border-slate-700 rounded-tr-none' : 'bg-[#f3f4f6] text-[#374151] border-[#e5e7eb] rounded-tr-none') : (isDarkMode ? 'bg-[#111827]/50 text-slate-100 border-slate-800 rounded-tl-none' : 'bg-white text-[#1f2937] border-[#e5e7eb] rounded-tl-none')}`}>
                              <p className="font-medium whitespace-pre-line">{msg.content}</p>
                            </div>
                          )}
                          {msg.type === 'pdf' && (
                            <div className={`border-2 rounded-2xl p-4 flex items-center gap-4 max-w-sm shadow-sm ${isDarkMode ? 'bg-[#1e293b]/50 border-slate-800' : 'bg-white border-[#e5e7eb]'}`}>
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-500'}`}><FileText size={24} /></div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>{msg.content}</p>
                                <p className={`text-[11px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-[#9ca3af]'}`}>{msg.fileSize} · PDF</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {(isExtracting || isAnalyzing) && <LoadingOverlay label={isExtracting ? "Extracting PDF buffer..." : null} />}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            /* ════════════════════ EMAIL AUDIT TAB ════════════════════ */
          ) : activeTab === 'email' ? (
            <div className="px-4 lg:px-10 py-8 max-w-xl mx-auto">
              {emailResult ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <ReportCard data={emailResult} onReset={() => { setEmailResult(null); setEmailText(''); }} />
                </div>
              ) : (
                <div className={`border-2 rounded-[24px] p-6 lg:p-8 space-y-6 shadow-sm ${isDarkMode ? 'bg-[#0b1120] border-slate-800' : 'bg-white border-[#e5e7eb]'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-md ${isDarkMode ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 shadow-indigo-500/5'}`}>
                      <img src={emailGif} alt="Email" className="w-full h-full object-contain p-1 rounded-xl" />
                    </div>
                    <div>
                      <h2 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>E-mail Audit</h2>
                      <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-[#6b7280]'}`}>Analyze suspicious email text for fraud signals.</p>
                    </div>
                  </div>
                  <textarea
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    placeholder="Paste email content here..."
                    className={`w-full h-24 border-2 rounded-2xl p-4 text-sm outline-none resize-none transition-all ${isDarkMode ? 'bg-[#020617] border-slate-800 text-slate-300 focus:border-violet-500' : 'bg-[#f9fafb] border-[#e5e7eb] focus:border-[#2563eb]'}`}
                  />
                  {emailError && <ErrorBox msg={emailError} />}
                  {isEmailAnalyzing
                    ? <LoadingOverlay />
                    : (
                      <button
                        onClick={handleEmailAnalyze}
                        disabled={!emailText.trim()}
                        className={`w-full h-14 rounded-xl font-black flex items-center justify-center gap-2.5 uppercase tracking-widest text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isDarkMode ? 'bg-white text-[#020617] hover:bg-slate-200' : 'bg-[#111827] text-white hover:bg-black'}`}>
                        <ScanSearch size={20} /> Analyze Email
                      </button>
                    )
                  }
                </div>
              )}
            </div>

            /* ════════════════════ SALARY TAB ════════════════════ */
          ) : activeTab === 'salary' ? (
            <div className="px-4 lg:px-10 py-8 max-w-3xl mx-auto">
              {salaryResult ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <ReportCard data={salaryResult} onReset={() => { setSalaryResult(null); setSalaryOffered(''); setJobRole(''); }} />
                </div>
              ) : (
                <div className={`border-2 rounded-[24px] p-6 lg:p-8 space-y-6 shadow-sm ${isDarkMode ? 'bg-[#0b1120] border-slate-800' : 'bg-white border-[#e5e7eb]'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-md ${isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 shadow-emerald-500/5'}`}>
                      <img src={dollarGif} alt="Salary" className="w-full h-full object-contain p-1 rounded-xl" />
                    </div>
                    <div>
                      <h2 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>Salary Calibration</h2>
                      <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-[#6b7280]'}`}>Verify if compensation is realistic.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-[#9ca3af]'}`}>Salary Offered</label>
                      <input
                        type="text"
                        value={salaryOffered}
                        onChange={(e) => setSalaryOffered(e.target.value)}
                        placeholder="e.g. $12,000 / month"
                        className={`w-full h-12 border-2 rounded-xl px-4 font-bold outline-none text-sm transition-all ${isDarkMode ? 'bg-[#020617] border-slate-800 text-slate-200 focus:border-violet-500' : 'bg-[#f9fafb] border-[#e5e7eb] focus:border-[#2563eb]'}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-[#9ca3af]'}`}>Job Role</label>
                      <input
                        type="text"
                        value={jobRole}
                        onChange={(e) => setJobRole(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSalaryCheck()}
                        placeholder="e.g. Data Entry"
                        className={`w-full h-12 border-2 rounded-xl px-4 font-bold outline-none text-sm transition-all ${isDarkMode ? 'bg-[#020617] border-slate-800 text-slate-200 focus:border-violet-500' : 'bg-[#f9fafb] border-[#e5e7eb] focus:border-[#2563eb]'}`}
                      />
                    </div>
                  </div>
                  {salaryError && <ErrorBox msg={salaryError} />}
                  {isSalaryAnalyzing
                    ? <LoadingOverlay />
                    : (
                      <button
                        onClick={handleSalaryCheck}
                        disabled={!salaryOffered.trim() && !jobRole.trim()}
                        className={`w-full h-14 rounded-xl font-bold flex items-center justify-center gap-2.5 uppercase tracking-widest text-xs shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isDarkMode ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-[#2563eb] text-white hover:bg-blue-700'}`}>
                        <TrendingDown size={20} /> Check Anomaly Coefficient
                      </button>
                    )
                  }
                </div>
              )}
            </div>

            /* ════════════════════ COMPANY TAB ════════════════════ */
          ) : (
            <div className="px-4 lg:px-10 py-8 max-w-3xl mx-auto">
              {companyResult ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <ReportCard data={companyResult} onReset={() => { setCompanyResult(null); setCompanyName(''); }} />
                </div>
              ) : (
                <div className={`border-2 rounded-[24px] p-6 lg:p-8 space-y-6 shadow-sm ${isDarkMode ? 'bg-[#0b1120] border-slate-800' : 'bg-white border-[#e5e7eb]'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-md ${isDarkMode ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-rose-50 shadow-rose-500/5'}`}>
                      <img src={companyGif} alt="Company" className="w-full h-full object-contain p-1 rounded-xl" />
                    </div>
                    <div>
                      <h2 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-[#111827]'}`}>Company Verification</h2>
                      <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-[#6b7280]'}`}>Verify legal existence and reputation.</p>
                    </div>
                  </div>
                  <div className="relative">
                    <Building2 className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-[#9ca3af]'}`} size={18} />
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCompanyCheck()}
                      placeholder="Search official registry..."
                      className={`w-full h-14 border-2 rounded-xl pl-12 pr-4 font-bold outline-none text-sm transition-all ${isDarkMode ? 'bg-[#020617] border-slate-800 text-slate-200 focus:border-violet-500' : 'bg-[#f9fafb] border-[#e5e7eb] focus:border-[#2563eb]'}`}
                    />
                  </div>
                  {companyError && <ErrorBox msg={companyError} />}
                  {isCompanyAnalyzing
                    ? <LoadingOverlay />
                    : (
                      <button
                        onClick={handleCompanyCheck}
                        disabled={!companyName.trim()}
                        className={`w-full h-14 rounded-xl font-black flex items-center justify-center gap-2.5 uppercase tracking-widest text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isDarkMode ? 'bg-white text-[#020617] hover:bg-slate-200' : 'bg-[#111827] text-white hover:bg-black'}`}>
                        <Search size={20} /> Cross-check Registries
                      </button>
                    )
                  }
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer Input (Flex-Shrink-0) ── */}
        {activeTab === 'investigation' && !(isAnalyzing || isExtracting || hasReport) && (
          <footer className={`flex-shrink-0 px-4 lg:px-10 py-3 lg:py-5 border-t transition-colors duration-300 ${isDarkMode ? 'bg-[#020617] border-white/5' : 'bg-[#f9fafb] border-gray-200'}`}>
            <div className={`max-w-[800px] mx-auto flex items-center border-2 rounded-[20px] lg:rounded-[24px] pr-2 pl-3 lg:pl-4 py-1 transition-all ${isDarkMode ? 'bg-[#0b1120] border-slate-800' : 'bg-white border-[#e5e7eb]'}`}>
              <button onClick={() => fileInputRef.current?.click()} className={`p-2.5 rounded-lg shrink-0 transition-colors ${isDarkMode ? 'text-slate-500 hover:text-violet-400' : 'text-[#9ca3af] hover:text-[#2563eb]'}`}>
                <Paperclip size={18} />
              </button>
              <input
                type="text" value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Paste a job URL, recruiter email, or offer details..."
                className={`flex-1 bg-transparent border-none outline-none py-2.5 px-3 font-medium text-xs transition-colors ${isDarkMode ? 'text-slate-200 placeholder:text-slate-600' : 'placeholder:text-[#9ca3af]'}`}
              />
              <button onClick={handleSend} className={`w-[36px] h-[36px] lg:w-[42px] lg:h-[42px] text-white rounded-[14px] lg:rounded-[16px] flex items-center justify-center transition-all shrink-0 ${isDarkMode ? 'bg-violet-600 hover:bg-violet-500' : 'bg-[#111827] hover:bg-black'}`}>
                <Send size={15} fill="white" />
              </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf" />
          </footer>
        )}
      </main>
    </div>
  );
};

export default App;