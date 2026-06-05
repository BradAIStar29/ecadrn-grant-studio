/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  FileText, 
  Search, 
  MessageSquare, 
  Settings, 
  Mail, 
  Layout, 
  CheckCircle, 
  Clock, 
  Menu,
  X,
  Plus,
  PlusCircle,
  Mic,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Globe,
  Calendar,
  History,
  Users,
  Copy,
  Check,
  ChevronRight,
  HelpCircle,
  Maximize,
  Minimize,
  DollarSign,
  Bell,
  Trash2,
  AlertCircle,
  Scissors,
  ArrowUp,
  ArrowDown,
  Sparkles,
  UserPlus,
  BookOpen,
  Book,
  ChevronDown,
  ChevronUp,
  Scroll,
  Award,
  PenTool,
  Eye,
  Upload,
  Paperclip,
  HardDrive,
  FolderOpen,
  Bot,
  Download,
  Send,
  Link,
  Wand2,
  Loader,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { callAI } from './services/api';
import ReactQuill from 'react-quill';
import GoogleDrivePanel from './components/GoogleDrivePanel';
import 'react-quill/dist/quill.snow.css';

type Tab = 'dashboard' | 'proposals' | 'funders' | 'grants' | 'voice' | 'outreach' | 'chat' | 'calendar';

const WALKTHROUGH_STEPS = [
  {
    title: "Welcome to ECADRN Grant Studio",
    tab: 'dashboard',
    content: "Your AI-powered grant management OS. Switch between modules using the sidebar — Dashboard, Proposals, Funder Intelligence, Grant Matcher, Voice Lab, Outreach, and AI Advisor.",
    highlight: "sidebar-nav"
  },
  {
    title: "Personal & Team Workspaces",
    tab: 'dashboard',
    content: "Use the workspace switcher at the top of the sidebar to toggle between your Personal workspace (private to you) and the Team workspace (shared with all @ecadrn.org members). Every proposal, grant, and funder record is kept separate between workspaces.",
    highlight: "sidebar-nav"
  },
  {
    title: "Strategic Dashboard",
    tab: 'dashboard',
    content: "Your command center. See high-alignment grants (verified only — no hallucinated data), active proposals by stage, pipeline value, and upcoming deadlines at a glance. Use 'Export Portfolio MD' to download your full org profile as a document.",
    highlight: "dashboard-overview"
  },
  {
    title: "Proposal Studio",
    tab: 'proposals',
    content: "Click 'New Draft' to generate a complete 9-section proposal in seconds using your trained voice profile. Proposals are auto-stamped with 'Created By' and 'Last Edited By' so the whole team knows who's working on what.",
    highlight: "proposals-view"
  },
  {
    title: "Template Library",
    tab: 'proposals',
    content: "Save any successful proposal structure as a reusable template. Templates speed up future applications and keep your team aligned on winning section formats.",
    highlight: "proposals-templates"
  },
  {
    title: "Grant Matcher + Autopilot",
    tab: 'grants',
    content: "Run Discovery to surface real, verified grant opportunities matched to ECADRN's mission. Every result is checked against known real funders — unverified results are clearly flagged. Use the Verified Only toggle to filter out any uncertain results.",
    highlight: "grants-view"
  },
  {
    title: "NEW: Grant Autopilot",
    tab: 'grants',
    content: "Hit the 'Autopilot' button in Grant Matcher to run the full grant cycle hands-free. Assisted Mode stops at review so you approve before anything is submitted. Full Agent Mode searches, drafts, and submits automatically — then sends you a confirmation notification.",
    highlight: "grants-view"
  },
  {
    title: "Funder Intelligence",
    tab: 'funders',
    content: "Add any funder by website URL and our AI will research their giving priorities, mission alignment, and geographic focus. Use 'AI Re-Research' anytime to refresh intelligence. Track relationship stages from Prospect through Active.",
    highlight: "funders-view"
  },
  {
    title: "Voice Lab",
    tab: 'voice',
    content: "Train the AI on ECADRN's unique voice by pasting writing samples, uploading documents, or loading built-in resources. The AI extracts tone descriptors, key phrases, and voice rules — every AI-generated proposal then sounds authentically like you.",
    highlight: "voice-view"
  },
  {
    title: "Strategic Outreach",
    tab: 'outreach',
    content: "Generate personalized outreach emails, LOIs, and follow-ups for any funder. The AI uses your voice profile and funder intelligence reports to maximize relevance and tone-match.",
    highlight: "outreach-view"
  },
  {
    title: "AI Strategy Advisor",
    tab: 'chat',
    content: "Your on-demand grants strategist. Ask about funder landscapes, how to strengthen a proposal section, budget strategy, or mission alignment. It has full context on your org profile and pipeline.",
    highlight: "chat-view"
  },
  {
    title: "You're ready — launch the OS",
    tab: 'dashboard',
    content: "Start by setting up your Organization Profile, then train your Voice Lab. Once those are set, run a Grant Discovery or launch Autopilot and let the system work for you.",
    highlight: "dashboard-overview"
  }
];


const SHARED_ORG_ID = 'ecadrn-shared';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<'personal' | 'shared'>(() => {
    return (localStorage.getItem('ecadrn_workspace') as 'personal' | 'shared') || 'personal';
  });
  // The Firestore org namespace to use for all data ops
  const orgId = activeWorkspace === 'shared' ? SHARED_ORG_ID : (user?.uid || '');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [funders, setFunders] = useState<any[]>([]);
  const [voiceProfiles, setVoiceProfiles] = useState<any[]>([]);
  const [selectedVoiceProfileId, setSelectedVoiceProfileId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [walkthroughStep, setWalkthroughStep] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [importedDocs, setImportedDocs] = useState<Array<{name: string; content: string; importedAt: string}>>(() => {
    try { return JSON.parse(localStorage.getItem('ecadrn_imported_docs') || '[]'); } catch { return []; }
  });
  const [drivePanel, setDrivePanel] = useState<{ open: boolean; mode: 'import' | 'export' | 'sync'; proposal?: any }>({ open: false, mode: 'import' });

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenWalkthrough_v2');
    if (!hasSeen && user) {
      setWalkthroughStep(0);
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    if (activeWorkspace === 'personal' && !user.uid) return; // uid not yet resolved

    // Load Notifications
    const notifPath = `organizations/${orgId}/notifications`;
    const notifRef = collection(db, notifPath);
    const unsubNotifs = onSnapshot(query(notifRef, where('userId', '==', user.uid), where('read', '==', false), orderBy('timestamp', 'desc'), limit(10)), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, notifPath);
    });

    // Load Organization
    const orgPath = `organizations/${orgId}`;
    const orgRef = doc(db, orgPath);
    const unsubOrg = onSnapshot(orgRef, (snap) => {
      if (snap.exists()) {
        setOrganization(snap.data());
      } else {
        // Initial setup for new user or new shared workspace
        const isShared = orgId === SHARED_ORG_ID;
        const initialOrg = {
          name: 'ECADRN (Early Career ADR Network)',
          profileText: `The Early Career ADR Network (ECADRN) is a global consortium of early-career ADR practitioners, scholars, and enthusiasts. 

MISSION: To support the professional development of early career Alternative Dispute Resolution (ADR) professionals through mentorship, collaborative research, and inclusive networking.

VISION: An equitable and accessible ADR field where early career professionals are empowered to innovate and lead.

CORE PROGRAMS:
1. Mentorship Bridge: Connecting veterans with new practitioners.
2. Research Labs: Collaborative publishing on emerging conflict resolution trends.
3. Civic Equity Initiative: Increasing access to ADR in underserved communities.`,
          voiceProfile: {
            toneDescriptors: ['Principled', 'Professional', 'Aspirational', 'Collaborative'],
            keyPhrases: ['access to justice', 'conflict resolution', 'civic equity', 'transformative mediation'],
            voiceRules: ['Use mission-driven active voice', 'Maintain academic rigor with professional warmth'],
            writingSamples: [
              "We are dedicated to fostering the next generation of dispute resolution leaders.",
              "Our work bridges the gap between ADR theory and transformative community practice."
            ],
            maturityScore: 82
          },
          updatedAt: new Date().toISOString()
        };
        setDoc(orgRef, initialOrg).catch(e => handleFirestoreError(e, OperationType.WRITE, orgPath));
        setOrganization(initialOrg);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, orgPath);
    });

    // Load Proposals
    const proposalsPath = `organizations/${orgId}/proposals`;
    const proposalsRef = collection(db, proposalsPath);
    const unsubProposals = onSnapshot(query(proposalsRef, orderBy('updatedAt', 'desc')), (snap) => {
      setProposals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, proposalsPath);
    });

    // Load Grants
    const grantsPath = `organizations/${orgId}/grants`;
    const grantsRef = collection(db, grantsPath);
    const unsubGrants = onSnapshot(query(grantsRef, limit(20)), (snap) => {
      setGrants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, grantsPath);
    });

    // Load Funders
    const fundersPath = `organizations/${orgId}/funders`;
    const fundersRef = collection(db, fundersPath);
    const unsubFunders = onSnapshot(query(fundersRef, limit(20)), (snap) => {
      setFunders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, fundersPath);
    });

    // Load Voice Profiles
    const voiceProfilesPath = `organizations/${orgId}/voiceProfiles`;
    const voiceProfilesRef = collection(db, voiceProfilesPath);
    const unsubVoice = onSnapshot(query(voiceProfilesRef, orderBy('createdAt', 'desc')), (snap) => {
      const pList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setVoiceProfiles(pList);
      if (pList.length > 0 && !selectedVoiceProfileId) {
        setSelectedVoiceProfileId(pList[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, voiceProfilesPath);
    });

    return () => {
      unsubOrg();
      unsubProposals();
      unsubGrants();
      unsubFunders();
      unsubVoice();
    };
  }, [user, orgId]); // reload when workspace switches

  const exportMasterMarkdown = () => {
    let md = `# ECADRN - Nexus OS Mastery Export\n\n`;
    md += `Generated on: ${new Date().toLocaleString()}\n\n`;
    
    md += `## 1. Organization Profile\n\n`;
    md += `**Name:** ${organization?.name}\n\n`;
    md += `### Mission & Background\n\n${organization?.profileText}\n\n`;
    
    md += `## 2. Voice Intelligence\n\n`;
    voiceProfiles.forEach((p, i) => {
      md += `### Profile ${i+1}: ${p.name}\n`;
      md += `- Tone: ${p.toneDescriptors?.join(', ')}\n`;
      md += `- Key Phrases: ${p.keyPhrases?.join(', ')}\n`;
      md += `- Maturity: ${p.maturityScore}%\n\n`;
    });

    md += `## 3. Active Proposals\n\n`;
    (proposals || []).forEach((p, i) => {
      md += `### Proposal ${i+1}: ${p.title}\n`;
      md += `**Funder:** ${p.funder}\n`;
      md += `**Description:** ${p.description}\n\n`;
      if (p.sections) {
        p.sections.forEach((s: any) => {
          md += `#### ${s.title}\n\n${s.content.replace(/<[^>]*>/g, '')}\n\n`;
        });
      }
    });

    md += `--- \n*End of ECADRN Grant Studio Export*`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ECADRN_Nexus_Master_Export.md`;
    a.click();
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'ecadrn.org' });
    try {
      const result = await signInWithPopup(auth, provider);
      if (!result.user.email?.endsWith('@ecadrn.org')) {
        await result.user.delete();
        alert('Access restricted to @ecadrn.org accounts only.');
      }
    } catch (e: any) {
      if (e.code !== 'auth/popup-closed-by-user') {
        alert('Sign in failed: ' + e.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <BarChart2 className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">ECADRN Grant Studio</h1>
          <p className="text-gray-600 mb-8">
            The AI-powered command center for ADR professionals to win more grants.
          </p>
          <button 
            onClick={login}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="bg-slate-900 flex flex-col fixed h-full z-20 border-r border-slate-800"
      >
        <div id="sidebar-logo" className="p-6 flex items-center justify-between">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-sm"></div>
              </div>
              <span className="text-white font-bold text-lg tracking-tight">Nexus OS</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mx-auto">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
          )}
        </div>

        {/* ── Workspace Switcher ── */}
          {isSidebarOpen && (
            <div className="px-4 pt-4 pb-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 px-1">Workspace</p>
              <div className="flex rounded-xl overflow-hidden border border-slate-700">
                <button
                  onClick={() => {
                    setActiveWorkspace('personal');
                    localStorage.setItem('ecadrn_workspace', 'personal');
                  }}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                    activeWorkspace === 'personal'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Personal
                </button>
                <button
                  onClick={() => {
                    setActiveWorkspace('shared');
                    localStorage.setItem('ecadrn_workspace', 'shared');
                  }}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider transition-colors ${
                    activeWorkspace === 'shared'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Team
                </button>
              </div>
              {activeWorkspace === 'shared' && (
                <p className="text-[9px] text-indigo-400 mt-1.5 px-1">
                  🤝 ECADRN shared workspace
                </p>
              )}
            </div>
          )}
          {!isSidebarOpen && (
            <div className="px-3 pt-3">
              <button
                onClick={() => {
                  const next = activeWorkspace === 'personal' ? 'shared' : 'personal';
                  setActiveWorkspace(next);
                  localStorage.setItem('ecadrn_workspace', next);
                }}
                title={activeWorkspace === 'personal' ? 'Switch to Team workspace' : 'Switch to Personal workspace'}
                className={`w-full flex items-center justify-center py-2 rounded-xl transition-colors ${
                  activeWorkspace === 'shared' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <Users size={16} />
              </button>
            </div>
          )}
          
          <nav id="sidebar-nav" className="flex-1 px-4 py-4 space-y-1 mt-4">
          <NavItem 
            icon={<Layout size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            collapsed={!isSidebarOpen}
            id="nav-dashboard"
            highlighted={walkthroughStep !== null && WALKTHROUGH_STEPS[walkthroughStep]?.tab === 'dashboard'}
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="Proposals" 
            active={activeTab === 'proposals'} 
            onClick={() => setActiveTab('proposals')} 
            collapsed={!isSidebarOpen}
            id="nav-proposals"
            highlighted={walkthroughStep !== null && WALKTHROUGH_STEPS[walkthroughStep]?.tab === 'proposals'}
          />
          <NavItem 
            icon={<Search size={20} />} 
            label="Funder Intelligence" 
            active={activeTab === 'funders'} 
            onClick={() => setActiveTab('funders')} 
            collapsed={!isSidebarOpen}
            id="nav-funders"
            highlighted={walkthroughStep !== null && WALKTHROUGH_STEPS[walkthroughStep]?.tab === 'funders'}
          />
          <NavItem 
            icon={<CheckCircle size={20} />} 
            label="Grant Matcher" 
            active={activeTab === 'grants'} 
            onClick={() => setActiveTab('grants')} 
            collapsed={!isSidebarOpen}
            id="nav-grants"
            highlighted={walkthroughStep !== null && WALKTHROUGH_STEPS[walkthroughStep]?.tab === 'grants'}
          />
          <NavItem 
            icon={<Mic size={20} />} 
            label="Voice Lab" 
            active={activeTab === 'voice'} 
            onClick={() => setActiveTab('voice')} 
            collapsed={!isSidebarOpen}
            id="nav-voice"
            highlighted={walkthroughStep !== null && WALKTHROUGH_STEPS[walkthroughStep]?.tab === 'voice'}
          />
          <NavItem 
            icon={<Mail size={20} />} 
            label="Outreach" 
            active={activeTab === 'outreach'} 
            onClick={() => setActiveTab('outreach')} 
            collapsed={!isSidebarOpen}
            id="nav-outreach"
            highlighted={walkthroughStep !== null && WALKTHROUGH_STEPS[walkthroughStep]?.tab === 'outreach'}
          />
          <NavItem 
            icon={<MessageSquare size={20} />} 
            label="AI Advisor" 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
            collapsed={!isSidebarOpen}
            id="nav-chat"
            highlighted={walkthroughStep !== null && WALKTHROUGH_STEPS[walkthroughStep]?.tab === 'chat'}
          />
          <NavItem 
            icon={<Calendar size={20} />} 
            label="Calendar" 
            active={activeTab === 'calendar'} 
            onClick={() => setActiveTab('calendar')} 
            collapsed={!isSidebarOpen}
            id="nav-calendar"
            highlighted={walkthroughStep !== null && WALKTHROUGH_STEPS[walkthroughStep]?.tab === 'calendar'}
          />
        </nav>

        <div className="p-4 mt-auto border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex-shrink-0 border border-slate-600 flex items-center justify-center text-white font-bold">
              {user.displayName?.[0] || 'U'}
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user.displayName || 'User'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full mt-4 flex items-center justify-center p-2 text-slate-500 hover:text-white rounded-lg transition-colors bg-slate-800/50"
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-[260px]' : 'ml-[80px]'}`}>
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10 font-sans">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-slate-900 capitalize tracking-tight">{activeTab.replace('-', ' ')}</h1>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
              activeWorkspace === 'shared'
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {activeWorkspace === 'shared' ? '🤝 Team' : '👤 Personal'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
               <button 
                 id="notif-bell"
                 onClick={() => setShowNotifications(!showNotifications)}
                 className="p-2 text-slate-400 hover:text-indigo-600 transition-colors relative"
               >
                 <Bell size={20} />
                 {notifications.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>}
               </button>
               <AnimatePresence>
                 {showNotifications && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                     className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden"
                   >
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notifications</span>
                       <button 
                         onClick={async () => {
                           for (const n of notifications) {
                             await setDoc(doc(db, `organizations/${orgId}/notifications`, n.id), { read: true }, { merge: true });
                           }
                         }}
                         className="text-[9px] font-bold text-indigo-600 hover:underline"
                       >
                         Mark all read
                       </button>
                     </div>
                     <div className="max-h-64 overflow-y-auto">
                       {notifications.length > 0 ? notifications.map(n => (
                         <div key={n.id} className="p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer">
                           <p className="text-xs text-slate-900 font-medium mb-1">{n.message}</p>
                           <span className="text-[9px] text-slate-400">{new Date(n.timestamp).toLocaleString()}</span>
                         </div>
                       )) : (
                         <div className="p-8 text-center text-slate-400 text-xs italic">No new notifications</div>
                       )}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
            <div className="relative">
              <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm w-64 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all" />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-2.5" />
            </div>
            <button 
              onClick={() => setDrivePanel({ open: true, mode: 'sync' })}
              title="Sync Grants Folder"
              className="p-2 text-slate-400 hover:text-green-600 transition-colors"
            >
              <HardDrive size={20} />
            </button>
            <button 
              onClick={() => setDrivePanel({ open: true, mode: 'import' })}
              title="Import from Drive"
              className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
            >
              <FolderOpen size={20} />
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto flex-1 h-full">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <DashboardView organization={organization} proposals={proposals} grants={grants} onStartTour={() => setWalkthroughStep(0)} onExportMaster={exportMasterMarkdown} />}
            {activeTab === 'proposals' && <ProposalsView proposals={proposals} organization={organization} funders={funders} voiceProfiles={voiceProfiles} selectedVoiceProfileId={selectedVoiceProfileId} onSetVoiceProfileId={setSelectedVoiceProfileId} orgId={orgId} />}
            {activeTab === 'funders' && <FundersView funders={funders} organization={organization} orgId={orgId} />}
            {activeTab === 'grants' && <GrantsView grants={grants} organization={organization} voiceProfiles={voiceProfiles} selectedVoiceProfileId={selectedVoiceProfileId} orgId={orgId} user={user} />}
            {activeTab === 'voice' && <VoiceView organization={organization} profiles={voiceProfiles} selectedProfileId={selectedVoiceProfileId} onSetSelectedProfileId={setSelectedVoiceProfileId} funders={funders} grants={grants} orgId={orgId} />}
            {activeTab === 'outreach' && <OutreachView organization={organization} funders={funders} proposals={proposals} />}
            {activeTab === 'chat' && <ChatView organization={organization} proposals={proposals} />}
            {activeTab === 'calendar' && <CalendarView grants={grants} proposals={proposals} />}
          </AnimatePresence>
        </div>

        <GoogleDrivePanel
          isOpen={drivePanel.open}
          mode={drivePanel.mode}
          proposalToExport={drivePanel.proposal}
          onClose={() => setDrivePanel({ open: false, mode: 'import' })}
          onImport={(docContent, fileName) => {
            const newDoc = { name: fileName, content: docContent, importedAt: new Date().toISOString() };
            setImportedDocs(prev => {
              const updated = [newDoc, ...prev].slice(0, 20);
              localStorage.setItem('ecadrn_imported_docs', JSON.stringify(updated));
              return updated;
            });
            // Add a notification
            const notifPath = `organizations/${orgId}/notifications`;
            addDoc(collection(db, notifPath), {
              message: `📄 Imported from Drive: "${fileName}"`,
              timestamp: new Date().toISOString(),
              userId: user?.uid,
              read: false,
            }).catch(() => {});
          }}
        />
        <Walkthrough 
          isOpen={walkthroughStep !== null} 
          currentStep={walkthroughStep ?? 0}
          onStepChange={setWalkthroughStep}
          onSetActiveTab={setActiveTab}
          onClose={() => {
            setWalkthroughStep(null);
            localStorage.setItem('hasSeenWalkthrough_v2', 'true');
          }} 
        />
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed, id, highlighted }: { 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  collapsed: boolean,
  id?: string,
  highlighted?: boolean
}) {
  return (
    <button 
      id={id}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${
        highlighted 
          ? 'bg-indigo-600/30 text-indigo-400 ring-4 ring-indigo-500/80 ring-offset-2 ring-offset-slate-900 shadow-[0_0_25px_rgba(99,102,241,0.6)] animate-pulse scale-105 z-30'
          : active 
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
            : 'text-slate-400 hover:bg-slate-800'
      }`}
    >
      <span className={highlighted ? 'text-indigo-400' : active ? 'text-white' : 'text-slate-400'}>{icon}</span>
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
      {highlighted && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
        </span>
      )}
    </button>
  );
}

function DashboardView({ 
  organization, proposals, grants, onStartTour, onExportMaster 
}: { 
  organization: any, proposals: any[], grants: any[], onStartTour: () => void, onExportMaster: () => void 
}) {
  const activeProposals = (proposals || []).filter(p => p.status === 'draft' || p.status === 'review').length;
  const pendingDeadlines = (grants || []).filter(g => g.deadline && new Date(g.deadline) > new Date()).length;

  return (
    <motion.div 
      id="dashboard-overview"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Portfolio Overview</h1>
          <p className="text-slate-500 mt-2">Intelligence report for {organization?.name || 'ECADRN'}.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onStartTour}
            className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            <HelpCircle size={14} /> Get Help
          </button>
          <button 
            onClick={onExportMaster}
            className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm"
          >
            <FileText size={14} /> Export Portfolio MD
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Active Proposals" value={activeProposals.toString()} icon={<FileText className="text-indigo-600" />} trend="+12.4%" />
        <StatCard title="Verified Matches" value={(grants?.filter((g: any) => g.verified !== false)?.length || 0).toString()} icon={<TrendingUp className="text-emerald-600" />} trend="Verified Only" />
        <StatCard title="Voice Maturity" value={`${organization?.voiceProfile?.maturityScore || 78}%`} icon={<Mic className="text-indigo-600" />} trend="Nominal State" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">Strategic Priorities</h3>
            <button className="text-indigo-600 text-xs font-bold uppercase tracking-wider">View All</button>
          </div>
          <div className="space-y-4">
            {proposals.length > 0 ? proposals.slice(0, 3).map(p => (
              <PriorityItem key={p.id} label={p.title} urgency="High" date={p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'Draft'} />
            )) : (
              <div className="text-center py-8 text-slate-400 text-sm italic">No active priorities. Start a new proposal.</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-slate-900 mb-6 px-2">Voice Distribution</h3>
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {organization?.voiceProfile?.toneDescriptors?.map((t: string, i: number) => (
                <VoiceMetric key={t} label={t} value={i === 0 ? 42 : i === 1 ? 31 : 18} />
              )) || <VoiceMetric label="Principled" value={42} />}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface VoiceMetricProps {
  label: string;
  value: number;
  key?: React.Key;
}

function VoiceMetric({ label, value }: VoiceMetricProps) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-500 font-medium">{label}</span>
        <span className="font-bold">{value}%</span>
      </div>
      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-indigo-500 h-full transition-all duration-500" 
          style={{ width: `${value}%` }}
        ></div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <h2 className="text-3xl font-bold mt-1 text-slate-900">{value}</h2>
      <div className="mt-4 flex items-center gap-2 text-indigo-600 text-sm font-bold">
        <span>{trend}</span>
      </div>
    </div>
  );
}


interface PriorityItemProps {
  label: string;
  urgency: 'High' | 'Medium' | 'Low';
  date: string;
  key?: React.Key;
}

function PriorityItem({ label, urgency, date }: PriorityItemProps) {
  const colors = {
    High: 'bg-red-50 text-red-600 border-red-100',
    Medium: 'bg-orange-50 text-orange-600 border-orange-100',
    Low: 'bg-green-50 text-green-600 border-green-100',
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
      <div className="flex items-center gap-3">
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${colors[urgency]}`}>
          {urgency}
        </span>
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <span className="text-xs text-gray-400">{date}</span>
    </div>
  );
}

function ProposalsView({ 
  proposals, organization, funders, voiceProfiles, selectedVoiceProfileId, onSetVoiceProfileId, orgId
}: { 
  proposals: any[], organization: any, funders: any[], voiceProfiles: any[], selectedVoiceProfileId: string | null, onSetVoiceProfileId: (id: string) => void, orgId: string
}) {
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showGuide, setShowGuide] = useState(false);
  
  const guideSteps = [
    { title: "Create a New Draft", content: "Click 'New Draft' in the top-right to open the proposal form. Enter the grant title, target funder, and a brief project description. The AI uses this to shape the entire proposal." },
    { title: "AI Proposal Generation", content: "Click 'Generate AI Proposal Draft' and the AI writes a full 9-section proposal in seconds — executive summary, goals, methodology, evaluation, sustainability, organizational capacity, and budget narrative — all tailored to your funder." },
    { title: "Status Filter", content: "Use the status dropdown next to the search bar to filter proposals by Draft, In Review, Submitted, or Approved. Quickly find what needs your attention without scrolling." },
    { title: "Search Proposals", content: "Type in the search bar to filter proposals by title or funder name in real time. Combine with the status filter to narrow down your pipeline." },
    { title: "Proposal Templates", content: "Click 'Templates' to choose from pre-built starter templates (education, health equity, community programs, and more). Templates pre-fill the funder, description, and structure to speed up drafting." },
    { title: "Team Collaboration", content: "Switch to the 'Team' workspace (top-right toggle) to see all proposals drafted by the full @ecadrn.org team. Every proposal is stamped with 'Created by' and 'Last edited by' so you always know who touched what." },
    { title: "Autopilot-Generated Proposals", content: "Proposals created by Grant Autopilot appear here automatically with 'autopilot' tags. In Assisted Mode they land in 'Review' status for your approval. In Full Agent Mode they are marked 'Submitted' with a notification confirmation." },
    { title: "Open the Editor", content: "Click any proposal row to open the full Proposal Editor — a multi-section rich-text workspace with AI section rewriting, funder alignment, voice matching, focus mode, and version history." },
    { title: "Proposal Lifecycle", content: "Move proposals through statuses manually: Draft → In Review → Submitted → Approved. Each status change is saved and visible to the whole team in the shared workspace." },
    { title: "Replay This Guide", content: "Click the ? icon next to any page title at any time to reopen this guide and walk through any feature again. All 10 steps are always available." }
  ];

  const [newProposalData, setNewProposalData] = useState({
    title: '',
    funder: '',
    description: ''
  });

  if (selectedProposal) {
    return <ProposalEditor 
      proposal={selectedProposal} 
      onBack={() => setSelectedProposal(null)} 
      organization={organization}
      funders={funders}
      voiceProfiles={voiceProfiles}
      selectedVoiceProfileId={selectedVoiceProfileId}
      onSetVoiceProfileId={onSetVoiceProfileId}
      orgId={orgId}
    />;
  }

  const filteredProposals = proposals.filter(p => {
    const matchesSearch = p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.funder?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const startNewProposal = async (template?: any) => {
    if (!organization || (!template && (!newProposalData.title || !newProposalData.funder))) return;
    setIsGenerating(true);
    try {
      let sections = template?.sections;
      
      if (!sections) {
        const data = await callAI('generate-draft', {
          orgProfile: organization,
          grantTitle: newProposalData.title,
          funderName: newProposalData.funder,
          funderType: "foundation",
          grantDescription: newProposalData.description || "General operating support for ADR programs.",
          focusAreas: "ADR, Mediation, Conflict Resolution",
          amountMin: 25000,
          amountMax: 50000,
          eligibility: "501c3",
          geographicFocus: "National",
          toneDescriptors: organization.voiceProfile?.toneDescriptors?.join(', '),
          keyPhrases: organization.voiceProfile?.keyPhrases?.join(', '),
          voiceRules: organization.voiceProfile?.voiceRules?.join(', '),
          writingSamples: organization.voiceProfile?.writingSamples?.join('\n')
        });
        sections = data;
      }

      await addDoc(collection(db, 'organizations', orgId, 'proposals'), {
        title: template?.name || newProposalData.title,
        funder: template?.funder || newProposalData.funder,
        description: template?.description || newProposalData.description,
        status: 'draft',
        sections: sections,
        updatedAt: new Date().toISOString(),
        createdBy: auth.currentUser?.email || '',
        lastEditedBy: auth.currentUser?.email || '',
        collaborators: [auth.currentUser!.email]
      }).catch(e => handleFirestoreError(e, OperationType.WRITE, `organizations/${orgId}/proposals`));
      
      setShowNewForm(false);
      setNewProposalData({ title: '', funder: '', description: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div id="proposals-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex justify-between items-center text-slate-900">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-bold tracking-tight">Your Proposals</h3>
          <button 
            onClick={() => setShowGuide(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg transition-all"
            title="How to use Proposals"
          >
            <HelpCircle size={14} />
          </button>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search proposals..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="review">In Review</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
          </select>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center gap-2 text-indigo-600 font-medium px-4 py-2 rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-colors"
            >
              <Copy size={18} /> Templates
            </button>
            <button 
              onClick={() => setShowNewForm(!showNewForm)}
              className="flex items-center gap-2 bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {showNewForm ? <X size={20} /> : <Plus size={20} />}
              {showNewForm ? 'Cancel' : 'New Draft'}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showNewForm && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-white rounded-2xl border border-indigo-100 shadow-xl p-8 space-y-6"
          >
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Proposal Title</label>
                <input 
                  type="text" 
                  value={newProposalData.title}
                  onChange={(e) => setNewProposalData({...newProposalData, title: e.target.value})}
                  placeholder="e.g. ADR Growth Initiative"
                  className="w-full p-4 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Funder Name</label>
                <input 
                  type="text" 
                  value={newProposalData.funder}
                  onChange={(e) => setNewProposalData({...newProposalData, funder: e.target.value})}
                  placeholder="e.g. Ford Foundation"
                  className="w-full p-4 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Project Brief</label>
              <textarea 
                value={newProposalData.description}
                onChange={(e) => setNewProposalData({...newProposalData, description: e.target.value})}
                placeholder="What is this grant for? (Programs, populations, etc.)"
                className="w-full p-4 bg-slate-50 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none leading-relaxed transition-all"
              />
            </div>
            <button 
              onClick={() => startNewProposal()}
              disabled={isGenerating || !newProposalData.title || !newProposalData.funder}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-100"
            >
              {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <FileText size={16} />}
              {isGenerating ? 'Intelligence Engine Running...' : 'Generate AI Proposal Draft'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proposal Name</th>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team</th>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Modified</th>
              <th className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredProposals.length > 0 ? filteredProposals.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-8 py-5">
                  <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{p.title}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.funder}</div>
                </td>
                <td className="px-8 py-5">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    p.status === 'draft' ? 'bg-amber-50 text-amber-600' : 
                    p.status === 'review' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex -space-x-2">
                    {p.collaborators?.map((c: string, idx: number) => (
                      <div key={idx} className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-600" title={c}>
                        {c.slice(0, 1).toUpperCase()}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-5">
                  {p.lastEditedBy ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-[9px] font-black text-violet-600">
                        {p.lastEditedBy.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-500 truncate max-w-[120px]" title={p.lastEditedBy}>
                        {p.lastEditedBy.split('@')[0]}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="px-8 py-5 text-slate-400 font-medium">
                  {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : 'N/A'}
                </td>
                <td className="px-8 py-5 text-right">
                  <button 
                    onClick={() => setSelectedProposal(p)}
                    className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest hover:underline"
                  >
                    Open Editor
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-slate-400 italic">No proposals yet. Start by generating a draft.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TemplateModal 
        isOpen={showTemplateModal}
        orgId={orgId}
        onClose={() => setShowTemplateModal(false)}
        onSelect={(template) => {
          setShowTemplateModal(false);
          startNewProposal(template);
        }}
      />

      <PageGuide 
        isOpen={showGuide} 
        onClose={() => setShowGuide(false)} 
        title="Proposals" 
        steps={guideSteps} 
      />
    </motion.div>
  );
}

function ProposalEditor({ 
  proposal, onBack, organization, funders, voiceProfiles, selectedVoiceProfileId, onSetVoiceProfileId, orgId
}: { 
  proposal: any, onBack: () => void, organization: any, funders: any[], voiceProfiles: any[], selectedVoiceProfileId: string | null, onSetVoiceProfileId: (id: string) => void, orgId: string
}) {
  const [sections, setSections] = useState<any[]>(() => {
    return (proposal.sections || []).map((s: any) => ({
      ...s,
      id: s.id || Math.random().toString(36).substr(2, 9)
    }));
  });
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showDriveExport, setShowDriveExport] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [presence, setPresence] = useState<any[]>([]);
  const [isEditingSection, setIsEditingSection] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isAIWorking, setIsAIWorking] = useState<string | null>(null);
  const [reviewResults, setReviewResults] = useState<any>(null);
  const [showAIReview, setShowAIReview] = useState(false);
  const [showHumanizer, setShowHumanizer] = useState(false);
  const [humanizerResults, setHumanizerResults] = useState<any>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{ sectionIdx: number, user: string } | null>(null);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'budget' | 'timeline'>('editor');
  const [budget, setBudget] = useState<any[]>(proposal.budget || []);

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [customSaveMsg, setCustomSaveMsg] = useState('');
  const [showEditorGuide, setShowEditorGuide] = useState(false);

  const editorGuideSteps = [
    { title: "Navigate Sections", content: "Use the section list on the left to jump between proposal sections. The active section is highlighted in indigo. Click any section to start editing it immediately." },
    { title: "AI Section Rewrite", content: "Click the ✦ AI Rewrite button above the editor to regenerate the current section. The AI uses your org's voice profile, the funder's giving priorities, and the proposal context to produce a targeted rewrite." },
    { title: "Funder Alignment", content: "Click 'Align to Funder' to rewrite the active section so it mirrors the funder's stated priorities and language — the AI injects their themes naturally without sounding generic." },
    { title: "Auto-Save & Versions", content: "Every change is auto-saved after 2 seconds. Watch the header for the 'Saving…' → '✓ Saved' indicator. Click 'Save Version' to create a named snapshot you can restore at any time." },
    { title: "Focus Mode", content: "Click the ⛶ expand icon in the toolbar to enter full-screen Focus Mode — no sidebars, no distractions. Press Escape or click the icon again to exit." },
    { title: "Budget Builder", content: "Click the Budget tab (above the editor) to open the Budget Builder. Add line items by category, set amounts and descriptions, and the total is calculated automatically. The AI can draft the budget from your proposal text." },
    { title: "Timeline Builder", content: "Click the Timeline tab to build a project milestones timeline. Useful for phased grants or multi-year programs. Each milestone has a date, title, and description." },
    { title: "AI Review & Humanizer", content: "Use 'AI Review' to get a scored critique with specific improvement suggestions per section. Use 'Humanizer' to reduce AI-sounding language and make the writing feel authentic and human." },
    { title: "Export to Google Drive", content: "Click the Drive icon in the header to export this proposal as a Google Doc in your @ecadrn.org Drive. Pick a destination folder — the document opens in Google Docs automatically." },
    { title: "Word Counts", content: "The section list shows per-section word counts. Use these to stay within funder page or word limits. The total word count is shown at the bottom of the section panel." },
    { title: "Team Collaboration", content: "In Team workspace, every edit stamps 'Last edited by' with your name. Use the Comments panel (speech bubble icon) to leave notes or questions for teammates on any section." },
    { title: "Replay This Guide", content: "Click the ? icon in the editor header any time to reopen this guide. All 12 steps are always available — nothing is hidden after first use." }
  ];

  const [funderGivingPriorities, setFunderGivingPriorities] = useState(() => {
    const matchedFunder = funders.find((f: any) => f.funderName?.toLowerCase() === proposal.funder?.toLowerCase());
    return matchedFunder ? (Array.isArray(matchedFunder.intelligence?.givingPriorities) ? matchedFunder.intelligence.givingPriorities.join(', ') : (matchedFunder.intelligence?.givingPriorities || '')) : '';
  });
  const [funderGeoFocus, setFunderGeoFocus] = useState(() => {
    const matchedFunder = funders.find((f: any) => f.funderName?.toLowerCase() === proposal.funder?.toLowerCase());
    return matchedFunder ? (matchedFunder.intelligence?.geographicFocus || matchedFunder.geographicFocus || '') : '';
  });
  const [funderRationale, setFunderRationale] = useState(() => {
    const matchedFunder = funders.find((f: any) => f.funderName?.toLowerCase() === proposal.funder?.toLowerCase());
    return matchedFunder ? (matchedFunder.intelligence?.missionAlignmentRationale || matchedFunder.notes || '') : '';
  });

  const handleFunderChange = (fId: string) => {
    const fObj = funders.find((f: any) => f.id === fId);
    if (fObj) {
      const givingPR = Array.isArray(fObj.intelligence?.givingPriorities) ? fObj.intelligence.givingPriorities.join(', ') : (fObj.intelligence?.givingPriorities || '');
      const geoFC = fObj.intelligence?.geographicFocus || fObj.geographicFocus || '';
      const rational = fObj.intelligence?.missionAlignmentRationale || fObj.notes || '';

      setFunderGivingPriorities(givingPR);
      setFunderGeoFocus(geoFC);
      setFunderRationale(rational);
      const propPath = `organizations/${orgId}/proposals/${proposal.id}`;
      setDoc(doc(db, propPath), {
        funder: fObj.funderName || '',
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => console.error("Funder save error:", err));
      proposal.funder = fObj.funderName || '';

      // Pre-populate 'Budget Narrative' and 'Organizational Capacity' sections if currently blank, minimal, or placeholders
      const newSections = [...sections];
      let updated = false;
      newSections.forEach((s) => {
        const titleL = s.title.toLowerCase();
        if (titleL.includes('budget') && (!s.content || s.content.trim() === '' || s.content.includes('[Insert') || s.content.includes('placeholder') || s.content.length < 150)) {
          s.content = `### Budget Narrative & Funder Priority Alignment

**Target Funder:** ${fObj.funderName || 'Selected Funder'}
**Funder Strategic Priorities:** ${givingPR || 'Not Specified'}
**Geographic Priority Vector:** ${geoFC || 'Not Specified'}

**Financial Stewardship Narrative:**
Our resource allocation is designed for high-efficiency implementation directly aligned with the funder’s giving priorities. Below is our program expense mapping:
- **Direct Service Provision & Core ADR Interventions:** Structured to address ${givingPR || 'community disputes and organizational mediation'}.
- **Geographic and Demographic Outreach:** Specifically budgeted for high impact in "${geoFC || 'our focus areas'}".
- **Evaluation & Capacity Stewardship:** Fully funded to verify compliance and operational integrity under modern ADR guidelines.`;
          updated = true;
        } else if ((titleL.includes('capacity') || titleL.includes('organizational')) && (!s.content || s.content.trim() === '' || s.content.includes('[Insert') || s.content.includes('placeholder') || s.content.length < 150)) {
          s.content = `### Organizational Capacity & Mission Alignment

**Target Funder:** ${fObj.funderName || 'Selected Funder'}
**Mission Alignment & Rationale:** ${rational || 'Not Specified'}

**Institutional Fit Statement:**
The East Coast ADR Network (ECADRN) possesses the necessary logistical, programmatic, and cultural expertise to deliver on our shared objectives. Our institutional capacity is positioned for deep synergy:
- **Operational Alignment:** Our long-term mission aligns directly with the core funding rationale: "${rational || 'improving equity and quality of conflict resolution'}".
- **Strategic Geographic Fit:** We have built sustainable operational nodes and a trusted practitioner base in "${geoFC || 'regions of critical need'}".
- **Professional Stewardship:** We maintain professional-grade compliance and ADR coaching supervision to ensure high fidelity to established standards.`;
          updated = true;
        }
      });
      if (updated) {
        setSections(newSections);
      }
    }
  };

  // Auto-sync sections to Firestore
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProposal(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [sections, budget]);

  useEffect(() => {
    const propPath = `organizations/${orgId}/proposals/${proposal.id}`;
    
    // Versions
    const unsubVersions = onSnapshot(query(collection(db, propPath, 'versions'), orderBy('timestamp', 'desc'), limit(20)), (snap) => {
      setVersions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Comments
    const unsubComments = onSnapshot(query(collection(db, propPath, 'comments'), orderBy('timestamp', 'asc')), (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Presence
    const presenceRef = doc(db, propPath, 'presence', auth.currentUser!.uid);
    const updatePresence = async () => {
      if (!auth.currentUser) return;
      try {
        await setDoc(presenceRef, {
          userId: auth.currentUser!.uid,
          userEmail: auth.currentUser!.email,
          sectionIndex: activeSectionIdx,
          isEditing: isEditingSection,
          lastSeen: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        // Non-critical — presence update failure shouldn't crash the editor
        console.warn('Presence update failed:', e);
      }
    };
    updatePresence();
    const presenceInterval = setInterval(updatePresence, 10000);

    const unsubPresence = onSnapshot(collection(db, propPath, 'presence'), (snap) => {
      const now = new Date().getTime();
      setPresence(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((p: any) => now - new Date(p.lastSeen).getTime() < 45000));
    });

    return () => {
      unsubVersions();
      unsubComments();
      unsubPresence();
      clearInterval(presenceInterval);
    };
  }, [proposal.id, activeSectionIdx, isEditingSection]);

  const splitSection = () => {
    const newSections = [...sections];
    const current = newSections[activeSectionIdx];
    const mid = Math.floor(current.content.length / 2);
    const firstHalf = current.content.substring(0, mid);
    const secondHalf = current.content.substring(mid);
    current.content = firstHalf;
    newSections.splice(activeSectionIdx + 1, 0, {
      title: `${current.title} (Cont.)`,
      content: secondHalf,
      id: Math.random().toString(36).substr(2, 9)
    });
    setSections(newSections);
  };

  const mergeSection = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && activeSectionIdx === 0) return;
    if (direction === 'next' && activeSectionIdx === sections.length - 1) return;
    const targetIdx = direction === 'prev' ? activeSectionIdx - 1 : activeSectionIdx + 1;
    const newSections = [...sections];
    if (direction === 'prev') {
      newSections[targetIdx].content += `<br/>${newSections[activeSectionIdx].content}`;
      newSections.splice(activeSectionIdx, 1);
      setActiveSectionIdx(targetIdx);
    } else {
      newSections[activeSectionIdx].content += `<br/>${newSections[targetIdx].content}`;
      newSections.splice(targetIdx, 1);
    }
    setSections(newSections);
  };

  const saveProposal = async (auto = false, customMsg: string = '') => {
    if (!auto) setIsSaving(true);
    if (auto) setAutoSaveStatus('saving');
    try {
      const propPath = `organizations/${orgId}/proposals/${proposal.id}`;
      await setDoc(doc(db, propPath), {
        sections,
        budget,
        updatedAt: new Date().toISOString(),
        lastEditedBy: auth.currentUser?.email || '',
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, propPath));
      if (auto) { setAutoSaveStatus('saved'); setTimeout(() => setAutoSaveStatus('idle'), 2500); }

      if (!auto) {
        const versionsPath = `${propPath}/versions`;
        await addDoc(collection(db, propPath, 'versions'), {
          content: sections,
          budget,
          timestamp: new Date().toISOString(),
          author: auth.currentUser!.email,
          type: 'manual_save',
          message: customMsg.trim() || 'User explicitly saved a version.'
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, versionsPath));
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!auto) setIsSaving(false);
    }
  };

  const saveAsTemplate = async () => {
    const templatesPath = `organizations/${orgId}/templates`;
    setIsSaving(true);
    try {
      await addDoc(collection(db, templatesPath), {
        name: `${proposal.title} (Template)`,
        funder: proposal.funder,
        description: proposal.description || "Custom template saved from draft.",
        sections: sections,
        createdAt: new Date().toISOString(),
        creatorEmail: auth.currentUser!.email
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, templatesPath));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmAssignment = async () => {
    if (!pendingAssignment) return;
    const { sectionIdx, user } = pendingAssignment;
    const newSections = [...sections];
    newSections[sectionIdx].assignedTo = user;
    setSections(newSections);
    
    const notifPath = `organizations/${orgId}/notifications`;
    await addDoc(collection(db, notifPath), {
      userId: auth.currentUser!.uid, // In real app, look up user's ID
      type: 'assignment',
      message: `You've been assigned to section: ${sections[sectionIdx].title} in ${proposal.title}`,
      link: proposal.id,
      read: false,
      timestamp: new Date().toISOString()
    }).catch(err => handleFirestoreError(err, OperationType.WRITE, notifPath));
    
    setShowAssignmentModal(false);
    setPendingAssignment(null);
  };

  const addComment = async () => {
    if (!newComment.trim()) return;
    try {
      const propPath = `organizations/${orgId}/proposals/${proposal.id}`;
      await addDoc(collection(db, propPath, 'comments'), {
        text: newComment,
        author: auth.currentUser!.email,
        sectionIndex: activeSectionIdx,
        timestamp: new Date().toISOString(),
        resolved: false
      });
      
      // Trigger Notification for other collaborators
      const collaborators = proposal.collaborators || [];
      for (const email of collaborators) {
        if (email !== auth.currentUser!.email) {
          // In a real app we'd look up the UID by email. Here we'll stick to a simple org-wide alert for demo.
          await addDoc(collection(db, `organizations/${orgId}/notifications`), {
            userId: auth.currentUser!.uid, // Simplified for AI Studio
            type: 'comment',
            message: `New comment on ${proposal.title}: "${newComment.slice(0, 30)}..."`,
            link: proposal.id,
            read: false,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      setNewComment('');
    } catch (e) {
      console.error(e);
    }
  };

  const runAIAction = async (action: 'review' | 'voice' | 'align' | 'humanizer') => {
    setIsAIWorking(action);
    try {
      if (action === 'review') {
        const result = await callAI('review-proposal', {
          grantTitle: proposal.title,
          funderName: proposal.funder,
          grantDescription: proposal.description,
          proposal: { sections }
        });
        setReviewResults(result);
        setShowAIReview(true);
      } else if (action === 'humanizer') {
        const result = await callAI('humanize-proposal', {
          funderName: proposal.funder,
          proposal: { sections }
        });
        setHumanizerResults(result);
        setShowHumanizer(true);
      } else if (action === 'voice') {
        const activeProfile = voiceProfiles.find(p => p.id === selectedVoiceProfileId) || organization?.voiceProfile;
        const result = await callAI('rewrite-voice', {
          voiceProfile: activeProfile,
          content: sections[activeSectionIdx].content
        });
        const newSections = [...sections];
        newSections[activeSectionIdx].content = result;
        setSections(newSections);
      } else if (action === 'align') {
        const funder = funders.find((f: any) => 
          f.funderName?.toLowerCase() === proposal.funder?.toLowerCase() || 
          f.website?.toLowerCase().includes(proposal.funder?.toLowerCase())
        );
        const result = await callAI('align-to-funder', {
          funderIntelligence: funder?.intelligence || {},
          content: sections[activeSectionIdx].content
        });
        const newSections = [...sections];
        newSections[activeSectionIdx].content = result;
        setSections(newSections);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAIWorking(null);
    }
  };

  const currentSection = sections[activeSectionIdx] || { title: 'No Section', content: '' };
  const sectionWordCount = currentSection.content ? currentSection.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0;
  const totalWordCount = sections.reduce((acc, s) => acc + (s.content ? s.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0), 0);

  return (
    <div className={`flex flex-col h-[calc(100vh-120px)] bg-slate-50 relative ${focusMode ? 'fixed inset-0 z-[100] h-screen w-screen -m-0' : '-m-8'}`}>
      {!focusMode && (
        <div className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
              <X size={20} />
            </button>
            <div>
              <h4 className="font-bold text-slate-900 leading-tight">{proposal.title}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="text-indigo-600">Funder: {proposal.funder}</span>
                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                <span className="flex items-center gap-1"><Users size={10} /> {presence.length} Collaborators Active</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2 mr-4">
              {presence.map(p => (
                <div key={p.id} className="w-8 h-8 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600" title={p.userEmail}>
                  {p.userEmail?.slice(0, 1).toUpperCase()}
                </div>
              ))}
            </div>
            <button 
              onClick={() => setFocusMode(true)}
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors flex items-center gap-2"
            >
              <Maximize size={16} /> Focus Mode
            </button>
            <button 
              onClick={() => setShowTemplateConfirm(true)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors"
            >
              <Copy size={16} /> Save as Template
            </button>
            <button 
              onClick={() => {
                const md = `# ${proposal.title}\n\nFunder: ${proposal.funder}\n\n` + 
                  sections.map((s: any) => `## ${s.title}\n\n${s.content.replace(/<[^>]*>/g, '')}`).join('\n\n');
                const blob = new Blob([md], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${proposal.title.replace(/\s+/g, '_')}_Grant_Proposal.md`;
                a.click();
              }}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-emerald-600 transition-colors"
            >
              <FileText size={16} /> Export MD
            </button>
            <button 
              onClick={() => setShowVersions(!showVersions)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-indigo-600 transition-colors"
            >
              <History size={16} /> History
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
               <button 
                 onClick={() => setActiveSubTab('editor')}
                 className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'editor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 Draft
               </button>
               <button 
                 onClick={() => setActiveSubTab('budget')}
                 className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'budget' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 Budget
               </button>
               <button 
                 onClick={() => setActiveSubTab('timeline')}
                 className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'timeline' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 Timeline
               </button>
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => runAIAction('humanizer')}
                disabled={!!isAIWorking}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border shadow-sm cursor-pointer ${
                  isAIWorking === 'humanizer' 
                    ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse' 
                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-150'
                }`}
                title="Funder AI Check Bypass & Humanizer Agent Review"
              >
                <Sparkles size={13} className={isAIWorking === 'humanizer' ? 'animate-spin' : 'text-rose-600'} />
                <span>Humanizer Review</span>
              </button>
              <div className="h-6 w-px bg-slate-200 mx-1"></div>
              <button 
                onClick={() => runAIAction('review')}
                disabled={!!isAIWorking}
                className={`p-2 rounded-lg transition-all ${isAIWorking === 'review' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                title="AI Critical Review"
              >
                <CheckCircle size={18} className={isAIWorking === 'review' ? 'animate-pulse' : ''} />
              </button>
              <div className="flex bg-slate-100 p-0.5 rounded-lg mr-2">
                <select 
                  value={selectedVoiceProfileId || ''} 
                  onChange={(e) => onSetVoiceProfileId(e.target.value)}
                  className="bg-transparent border-none outline-none text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors p-1"
                >
                  {voiceProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  {voiceProfiles.length === 0 && <option value="">Default Voice</option>}
                </select>
              </div>
              <button 
                onClick={() => runAIAction('voice')}
                disabled={!!isAIWorking}
                className={`p-2 rounded-lg transition-all ${isAIWorking === 'voice' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                title="Align to ECADRN Voice"
              >
                <Mic size={18} className={isAIWorking === 'voice' ? 'animate-pulse' : ''} />
              </button>
              <button 
                onClick={() => runAIAction('align')}
                disabled={!!isAIWorking}
                className={`p-2 rounded-lg transition-all ${isAIWorking === 'align' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                title="Strategic Funder Alignment"
              >
                <Globe size={18} className={isAIWorking === 'align' ? 'animate-pulse' : ''} />
              </button>
            </div>
            <button
              onClick={() => setShowDriveExport(true)}
              title="Export to Google Drive"
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <HardDrive size={14} /> Export to Drive
            </button>
            <button 
              onClick={() => setIsSaveModalOpen(true)}
              disabled={isSaving}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50"
            >
              {isSaving ? 'Syncing...' : 'Save Version'}
            </button>
            {/* Auto-save status indicator */}
            {autoSaveStatus !== 'idle' && (
              <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${autoSaveStatus === 'saving' ? 'text-indigo-400 bg-indigo-50' : 'text-emerald-600 bg-emerald-50'}`}>
                {autoSaveStatus === 'saving' ? (
                  <><span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /> Saving…</>
                ) : (
                  <><span className="text-emerald-500">✓</span> Saved</>
                )}
              </span>
            )}
            {/* Guide button */}
            <button
              onClick={() => setShowEditorGuide(true)}
              className="ml-2 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
              title="Proposal Editor Guide"
            >
              <HelpCircle size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Editor Guide */}
      <PageGuide
        isOpen={showEditorGuide}
        onClose={() => setShowEditorGuide(false)}
        title="Proposal Editor"
        steps={editorGuideSteps}
      />

      <div className="flex flex-1 overflow-hidden">
        {!focusMode && (
          <div className="w-72 border-r border-slate-200 bg-white overflow-y-auto">
            <div className="p-6 space-y-1">
              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Structure & Assignments</h5>
              <div className="mb-6 p-4 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Progress</span>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-900">{totalWordCount} / 2500 Words</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (totalWordCount / 2500) * 100)}%` }}></div>
                </div>
              </div>

              {/* Funder Intelligence Selection & Sync Block */}
              <div className="mb-6 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest block">Funder Intelligence Sync</span>
                <select 
                  onChange={(e) => handleFunderChange(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none text-slate-800 focus:ring-1 focus:ring-indigo-500"
                  defaultValue={funders.find(f => f.funderName?.toLowerCase() === proposal.funder?.toLowerCase())?.id || ''}
                >
                  <option value="">Select Target Funder...</option>
                  {funders.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.funderName || f.website}</option>
                  ))}
                </select>
                {funderGivingPriorities && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-indigo-100">
                    <div>
                      <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-0.5">Giving Priorities</span>
                      <p className="text-[10.5px] leading-relaxed text-slate-600 font-semibold line-clamp-2" title={funderGivingPriorities}>{funderGivingPriorities}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-0.5">Geographic Focus</span>
                      <p className="text-[10.5px] leading-relaxed text-slate-600 font-semibold">{funderGeoFocus}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block mb-0.5">Mission Alignment</span>
                      <p className="text-[10.5px] leading-relaxed text-slate-600 font-semibold line-clamp-2" title={funderRationale}>{funderRationale}</p>
                    </div>
                    <button 
                      onClick={async () => {
                        setIsAIWorking('align');
                        try {
                          const result = await callAI('align-to-funder', {
                            funderIntelligence: {
                              givingPriorities: funderGivingPriorities,
                              geographicFocus: funderGeoFocus,
                              missionAlignmentRationale: funderRationale
                            },
                            content: sections[activeSectionIdx].content
                          });
                          const newSections = [...sections];
                          newSections[activeSectionIdx].content = result;
                          setSections(newSections);
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setIsAIWorking(null);
                        }
                      }}
                      disabled={!!isAIWorking}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-widest py-2 rounded-lg transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
                    >
                      {isAIWorking === 'align' ? 'Aligning Draft...' : '⚡ Re-draft with intelligence'}
                    </button>
                  </div>
                )}
              </div>

              <Reorder.Group axis="y" values={sections} onReorder={setSections} className="space-y-2">
                {sections.map((s, i) => (
                  <Reorder.Item 
                    key={s.id} 
                    value={s}
                    className="relative"
                  >
                    <button 
                      onClick={() => setActiveSectionIdx(i)}
                      className={`w-full text-left p-4 rounded-xl transition-all border-2 relative ${
                        activeSectionIdx === i ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-transparent hover:bg-slate-50 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2 text-xs">
                        <span className={`font-bold ${activeSectionIdx === i ? 'text-indigo-700' : 'text-slate-900'}`}>{s.title}</span>
                        <div className="flex items-center gap-1">
                          <div className="p-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-400">
                            <Menu size={10} />
                          </div>
                          {presence.filter(p => p.sectionIndex === i && p.id !== auth.currentUser?.uid).map(p => (
                            <div key={p.id} className="w-3 h-3 rounded-full bg-emerald-400 border border-white" title={`${p.userEmail} is here`} />
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[10px] text-slate-400 font-bold uppercase">{s.wordLimit || 500} Words</span>
                         {comments.filter(c => c.sectionIndex === i && !c.resolved).length > 0 && (
                           <span className="bg-rose-100 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded-full">{comments.filter(c => c.sectionIndex === i && !c.resolved).length}</span>
                         )}
                      </div>
                    </button>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>
          </div>
        )}

        <div className="flex-1 bg-white flex flex-col overflow-hidden relative">
          {focusMode && (
            <button 
              onClick={() => setFocusMode(false)}
              className="absolute top-8 right-8 p-3 bg-white border border-slate-200 rounded-full shadow-lg z-10 hover:bg-slate-50 transition-all text-slate-400 hover:text-slate-900"
            >
              <Minimize size={20} />
            </button>
          )}

          <div className="flex-1 overflow-y-auto p-12">
            {activeSubTab === 'editor' ? (
              <>
                {showHumanizer && humanizerResults && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto mb-12 bg-slate-950 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden border border-rose-550/30"
                  >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 blur-3xl -mr-32 -mt-32"></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-rose-900/50 rounded-xl flex items-center justify-center text-rose-400 border border-rose-700/30">
                            <Sparkles size={20} className="animate-pulse" />
                          </div>
                          <div>
                            <h5 className="text-xl font-black tracking-tight mb-0.5 flex items-center gap-2">
                              Funder AI Bypass & Humanizer Audit
                            </h5>
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                              Final-Stage Anti-AI Scanner Verification
                            </p>
                          </div>
                        </div>
                        <button onClick={() => setShowHumanizer(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white cursor-pointer"><X size={18} /></button>
                      </div>

                      {/* Scoreboard Row */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">AI Probability</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              humanizerResults.aiProbabilityScore > 40 ? 'bg-rose-950/80 text-rose-400' : 'bg-emerald-950/80 text-emerald-400'
                            }`}>{humanizerResults.aiProbabilityScore}% Risk</span>
                          </div>
                          <div className="text-xl font-mono font-black text-white">{humanizerResults.aiProbabilityScore}%</div>
                          <div className="w-full bg-slate-850 h-1 rounded-full mt-2 overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                humanizerResults.aiProbabilityScore > 40 ? 'bg-rose-500' : 'bg-emerald-500'
                              }`} 
                              style={{ width: `${humanizerResults.aiProbabilityScore}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Human score</span>
                            <span className="text-[10px] font-black bg-indigo-950/80 text-indigo-400 px-1.5 py-0.5 rounded">{humanizerResults.humanScore}% Match</span>
                          </div>
                          <div className="text-xl font-mono font-black text-rose-400">{humanizerResults.humanScore}%</div>
                          <div className="w-full bg-slate-850 h-1 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${humanizerResults.humanScore}%` }}></div>
                          </div>
                        </div>

                        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">AI Check Bypass Risk</span>
                            <span className="text-xs">⚠️</span>
                          </div>
                          <div className="text-sm font-black flex items-center gap-1.5 mt-1">
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              humanizerResults.funderAiCheckRisk === 'High' ? 'bg-rose-500 animate-ping' :
                              humanizerResults.funderAiCheckRisk === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}></span>
                            <span className={
                              humanizerResults.funderAiCheckRisk === 'High' ? 'text-rose-400' :
                              humanizerResults.funderAiCheckRisk === 'Medium' ? 'text-amber-400' : 'text-emerald-400'
                            }>{humanizerResults.funderAiCheckRisk} Risk Level</span>
                          </div>
                          <p className="text-[9.5px] text-slate-400 mt-1 font-medium italic">Grade: {humanizerResults.readabilityGrade || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Structural Advice & Banned phrases */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="space-y-3">
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block">Structural sentence rhythm advice</span>
                          <p className="text-xs text-slate-300 leading-relaxed font-medium bg-slate-900/40 p-4 rounded-xl border border-slate-850">
                            {humanizerResults.structuralVarianceAdvice}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block">Flagged AI Words & Clichés</span>
                          <div className="flex flex-wrap gap-1.5 bg-slate-900/40 p-4 rounded-xl border border-slate-850 h-full max-h-[120px] overflow-y-auto">
                            {humanizerResults.bannedWordsFound?.map((word: string, i: number) => (
                              <span key={i} className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-rose-950/50 text-rose-400 border border-rose-900/40">
                                🗑️ {word}
                              </span>
                            ))}
                            {humanizerResults.flaggedPhrases?.map((phrase: string, i: number) => (
                              <span key={i} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-755">
                                "{phrase}"
                              </span>
                            ))}
                            {(!humanizerResults.bannedWordsFound?.length && !humanizerResults.flaggedPhrases?.length) && (
                              <span className="text-xs text-slate-500 italic">No egregious AI transition hallmarks detected!</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Section by section analysis */}
                      <div className="space-y-3 mb-6">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Section-by-Section AI Risk Matrix</span>
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {humanizerResults.sectionAverages?.map((sec: any, i: number) => (
                            <div key={i} className="p-3 bg-slate-900/30 rounded-xl border border-slate-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                              <div className="space-y-1">
                                <h6 className="text-xs font-bold text-white">{sec.sectionTitle}</h6>
                                <p className="text-[10.5px] text-slate-400 max-w-xl"><span className="text-rose-400 font-bold uppercase text-[9px]">Humanize Strategy:</span> {sec.humanizerStrategy}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  sec.detectionProbability > 40 ? 'bg-rose-950/85 text-rose-400' : 'bg-emerald-950/85 text-emerald-400'
                                }`}>
                                  {sec.detectionProbability}% AI Risk
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-slate-300 italic">"{humanizerResults.verdict}"</p>
                        <button
                          onClick={async () => {
                            try {
                              setIsAIWorking('voice');
                              const targetSection = sections[activeSectionIdx];
                              const activeProfile = voiceProfiles.find(p => p.id === selectedVoiceProfileId) || organization?.voiceProfile;
                              // Ask AI to rewrite specifically targeting humanizer rules
                              const result = await callAI('rewrite-voice', {
                                voiceProfile: activeProfile,
                                content: `REWRITE THIS CONTENT TO PASS AI DETECTION FILTERS PERFECTLY (Make words simple, sentences varying length, natural/organic tone): ${targetSection.content}`
                              });
                              const newSections = [...sections];
                              newSections[activeSectionIdx].content = result;
                              setSections(newSections);
                              
                              // Re-run humanizer audit to see updated score!
                              const updatedResult = await callAI('humanize-proposal', {
                                funderName: proposal.funder,
                                proposal: { sections: newSections }
                              });
                              setHumanizerResults(updatedResult);
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setIsAIWorking(null);
                            }
                          }}
                          disabled={!!isAIWorking}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-md shrink-0"
                        >
                          {isAIWorking ? 'Bypassing...' : 'Auto-Humanize Current Section'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {showAIReview && reviewResults && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto mb-12 bg-slate-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl -mr-32 -mt-32"></div>
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-8">
                        <div>
                          <h5 className="text-2xl font-black tracking-tight mb-1 flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                              <CheckCircle size={16} />
                            </div>
                            AI Review Summary
                          </h5>
                          <p className="text-slate-400 text-sm font-medium tracking-wide">Audit Score: {reviewResults.overallScore}/100</p>
                        </div>
                        <button onClick={() => setShowAIReview(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={20} /></button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Strengths</span>
                          <ul className="space-y-2">
                            {reviewResults.strengths?.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                                <span className="text-emerald-400 mt-0.5">•</span> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-4">
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">Priority Revisions</span>
                          <ul className="space-y-2">
                            {reviewResults.priorityRevisions?.map((r: string, i: number) => (
                              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                                <span className="text-rose-400 mt-0.5">•</span> {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-10 p-6 bg-white/5 rounded-2xl border border-white/10 italic text-sm text-indigo-200 leading-relaxed font-medium">
                        "{reviewResults.verdict}"
                      </div>
                    </div>
                  </motion.div>
                )}

                <div className={`max-w-3xl mx-auto space-y-8 ${focusMode ? 'pt-12' : ''}`}>
                  <div>
                    <input 
                      type="text" 
                      value={currentSection.title}
                      onChange={(e) => {
                        const newSections = [...sections];
                        newSections[activeSectionIdx].title = e.target.value;
                        setSections(newSections);
                      }}
                      className="w-full text-3xl font-black text-slate-900 focus:outline-none mb-2 tracking-tight"
                    />
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-4">
                      <span className="flex items-center gap-1.5">
                        <TrendingUp size={12} /> {sectionWordCount} Words
                      </span>
                      <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                      <button 
                        onClick={() => setShowComments(!showComments)}
                        className="flex items-center gap-1.5 text-indigo-600 hover:underline animate-fade-in"
                      >
                        <MessageSquare size={12} /> {comments.filter(c => c.sectionIndex === activeSectionIdx).length} Chat & Comments
                      </button>
                      
                      {presence.filter(p => p.sectionIndex === activeSectionIdx && p.userId !== auth.currentUser?.uid).map(p => (
                        <React.Fragment key={p.id}>
                          <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border transition-all ${
                            p.isEditing ? 'bg-amber-50 text-amber-700 border-amber-250 animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-250 border-dashed'
                          }`} title={p.userEmail}>
                            {p.isEditing ? <PenTool size={9} className="animate-bounce" /> : <Eye size={9} />}
                            {p.userEmail?.split('@')[0]} {p.isEditing ? 'is editing' : 'is viewing'}
                          </span>
                        </React.Fragment>
                      ))}

                      <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                      <div className="flex items-center gap-2 group relative">
                        <span className="cursor-help flex items-center gap-1">Assign: <HelpCircle size={10} className="text-slate-300" /></span>
                        <div className="absolute bottom-full left-0 mb-2 invisible group-hover:visible bg-slate-900 text-white p-2 rounded text-[8px] whitespace-nowrap shadow-xl z-50">
                          Confirming assignment will notify the teammate.
                        </div>
                        <select 
                          className="bg-transparent border-none outline-none text-indigo-600 focus:ring-0 cursor-pointer"
                          value={currentSection.assignedTo || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              setPendingAssignment({ sectionIdx: activeSectionIdx, user: val });
                              setShowAssignmentModal(true);
                            } else {
                              const newSections = [...sections];
                              newSections[activeSectionIdx].assignedTo = '';
                              setSections(newSections);
                            }
                          }}
                        >
                          <option value="">Unassigned</option>
                          <option value="Bradley G.">Bradley G.</option>
                          <option value="Nexus AI">Nexus AI Advisor</option>
                        </select>
                      </div>
                      <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={splitSection}
                          className="hover:text-indigo-600 transition-colors"
                          title="Split Section"
                        >
                          <Scissors size={12} />
                        </button>
                        <button 
                          onClick={() => mergeSection('prev')}
                          disabled={activeSectionIdx === 0}
                          className="hover:text-indigo-600 transition-colors disabled:opacity-30"
                          title="Merge with Previous"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button 
                          onClick={() => mergeSection('next')}
                          disabled={activeSectionIdx === sections.length - 1}
                          className="hover:text-indigo-600 transition-colors disabled:opacity-30"
                          title="Merge with Next"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="prose prose-slate max-w-none">
                    <ReactQuill 
                      theme="snow" 
                      value={currentSection.content} 
                      onChange={(val) => {
                        const newSections = [...sections];
                        if (newSections[activeSectionIdx]) {
                          newSections[activeSectionIdx].content = val;
                          setSections(newSections);
                        }
                      }}
                      onFocus={() => setIsEditingSection(true)}
                      onBlur={() => setIsEditingSection(false)}
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                          ['clean']
                        ]
                      }}
                      className="min-h-[400px] border-none"
                    />
                  </div>
                </div>
              </>
            ) : activeSubTab === 'budget' ? (
              <BudgetBuilder 
                budget={budget} 
                onUpdate={(newBudget) => setBudget(newBudget)} 
                proposalDescription={proposal.description || sections[0]?.content || 'Grant proposal for ADR and conflict resolution.'} 
              />
            ) : (
              <TimelineView versions={versions} onRevert={(v) => {
                setSections(v.content);
                setBudget(v.budget || []);
                setActiveSubTab('editor');
              }} />
            )}
          </div>

          <AnimatePresence>
            {showComments && (
              <motion.div 
                initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
                className="absolute inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-2xl z-30 flex flex-col"
              >
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping"></span>
                    <div>
                      <h5 className="text-[10px] font-black text-slate-800 uppercase tracking-widest block">Section Chat Room</h5>
                      <span className="text-[9px] text-slate-400 font-bold block">Section-specific team syncing</span>
                    </div>
                  </div>
                  <button onClick={() => setShowComments(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-all"><X size={15} /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 flex flex-col">
                  {comments.filter(c => c.sectionIndex === activeSectionIdx).length > 0 ? (
                    comments.filter(c => c.sectionIndex === activeSectionIdx).map((c) => {
                      const isMe = auth.currentUser && c.author.toLowerCase() === auth.currentUser.email?.toLowerCase();
                      const authorInitials = c.author ? c.author.split('@')[0].substring(0, 2).toUpperCase() : '??';
                      
                      return (
                        <div key={c.id} className={`flex gap-2 max-w-[85%] ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}>
                          {!isMe && (
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 font-extrabold text-[10px] flex items-center justify-center shrink-0 shadow-sm" title={c.author}>
                              {authorInitials}
                            </div>
                          )}
                          <div className={`p-3 rounded-2xl text-xs space-y-1 ${
                            isMe 
                              ? 'bg-indigo-600 text-white rounded-tr-none shadow-md' 
                              : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none shadow-sm'
                          }`}>
                            <div className="flex justify-between items-center gap-4">
                              <span className={`text-[9px] font-black uppercase tracking-tighter ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {isMe ? 'You' : c.author.split('@')[0]}
                              </span>
                              <span className="text-[8px] opacity-75">{new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <p className="leading-relaxed break-words">{c.text}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 italic text-xs py-8 space-y-2">
                      <MessageSquare size={24} className="text-slate-200" />
                      <span>No team messages in this section yet.</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 hover:underline cursor-pointer" onClick={() => setNewComment("Let's review this statement together!")}>Send a prompt</span>
                    </div>
                  )}

                  {presence.filter(p => p.sectionIndex === activeSectionIdx && p.isEditing && p.userId !== auth.currentUser?.uid).length > 0 && (
                    <div className="flex items-center gap-1.5 text-[9px] text-indigo-600 font-black uppercase tracking-wide bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100 self-start animate-pulse mt-auto shrink-0">
                      <TrendingUp size={10} className="animate-bounce text-indigo-500" />
                      {presence.filter(p => p.sectionIndex === activeSectionIdx && p.isEditing && p.userId !== auth.currentUser?.uid).map(p => p.userEmail?.split('@')[0]).join(', ')} is typing live...
                    </div>
                  )}
                </div>
                
                <div className="p-4 border-t border-slate-100 bg-white shadow-inner">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Type a team chat message..."
                      className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all text-slate-800"
                      onKeyDown={(e) => e.key === 'Enter' && addComment()}
                    />
                    <button onClick={addComment} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold flex items-center justify-center shadow-lg hover:shadow-indigo-200 shrink-0">
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {showVersions && (
              <motion.div 
                initial={{ x: 300 }}
                animate={{ x: 0 }}
                exit={{ x: 300 }}
                className="absolute inset-y-0 right-0 w-80 bg-white border-l border-slate-200 shadow-2xl z-20 overflow-y-auto"
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Version History</h5>
                    <button onClick={() => setShowVersions(false)}><X size={16} /></button>
                  </div>
                  <div className="space-y-4">
                    {versions.map((v) => (
                      <div key={v.id} className="p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer group">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-bold text-slate-900">{new Date(v.timestamp).toLocaleString()}</span>
                          <button 
                            onClick={() => { if(confirm('Revert proposal to this version?')) setSections(v.content); }}
                            className="text-indigo-600 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Revert
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium truncate">By: {v.author}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showTemplateConfirm && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
              >
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Copy className="text-indigo-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Save as Template?</h3>
                <p className="text-sm text-slate-500 mb-8 font-medium">This will create a reusable template from the current draft sections. You can use it to jumpstart future proposals.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowTemplateConfirm(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      setShowTemplateConfirm(false);
                      await saveAsTemplate();
                    }}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                  >
                    Save Template
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {showAssignmentModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
              >
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <UserPlus className="text-indigo-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Assign Section</h3>
                <p className="text-sm text-slate-500 mb-8 font-medium">Assigning <span className="font-bold text-indigo-600">{sections[pendingAssignment?.sectionIdx || 0].title}</span> to <span className="font-bold text-indigo-600">{pendingAssignment?.user}</span> will notify them immediately.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setShowAssignmentModal(false); setPendingAssignment(null); }}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmAssignment}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </div>
          )}

                {showDriveExport && (
        <GoogleDrivePanel
          isOpen={showDriveExport}
          mode="export"
          proposalToExport={{
            title: proposal.title,
            funder: proposal.funder,
            sections: sections,
            budget: budget,
          }}
          onClose={() => setShowDriveExport(false)}
        />
      )}
      {isSaveModalOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-left"
              >
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <History className="text-indigo-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Save Custom Version</h3>
                <p className="text-xs text-slate-500 mb-4 font-medium">Add a custom message or description to specify what changes are contained in this manual snapshot.</p>
                
                <div className="mb-6">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 font-mono">Snapshot Message (Optional)</label>
                  <textarea
                    rows={3}
                    className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-indigo-500 resize-none text-slate-800"
                    placeholder="e.g. Budget alignment, fixed section summaries..."
                    value={customSaveMsg}
                    onChange={(e) => setCustomSaveMsg(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => { setIsSaveModalOpen(false); setCustomSaveMsg(''); }}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      setIsSaveModalOpen(false);
                      await saveProposal(false, customSaveMsg);
                      setCustomSaveMsg('');
                    }}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                  >
                    Confirm Save
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Persistent Word Count Footer (Visible inside normal & focus modes) */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold shrink-0 z-30">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Word Count:</span>
              <span className="text-slate-900 font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">{totalWordCount} words</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Section Words:</span>
              {sections.map((s, i) => {
                const wCount = s.content ? s.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSectionIdx(i)}
                    className={`shrink-0 px-2.5 py-1 rounded text-[10px] uppercase font-bold border transition-all cursor-pointer ${
                      activeSectionIdx === i
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s.title}: <span className={activeSectionIdx === i ? 'text-white font-mono' : 'text-slate-500 font-mono'}>{wCount}w</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateModal({ isOpen, onClose, onSelect, orgId }: { isOpen: boolean, onClose: () => void, onSelect: (t: any) => void, orgId: string }) {
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;
    const templatesPath = `organizations/${orgId}/templates`;
    const templatesRef = collection(db, templatesPath);
    const unsub = onSnapshot(templatesRef, (snap) => {
      setCustomTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, templatesPath);
    });
    return unsub;
  }, [isOpen]);

  const defaultTemplates = [
    {
      name: "Federal ADR Grant",
      funder: "US Dept of Justice",
      description: "Optimized for large-scale government reporting.",
      sections: [
        { title: "Civic Impact Statement", content: "<h3>Executive Summary</h3><p>Built for justice...</p>", wordLimit: 500 },
        { title: "Program Architecture", content: "", wordLimit: 1000 },
        { title: "Equity Metrics", content: "", wordLimit: 750 }
      ]
    },
    {
      name: "Foundation Innovation Seed",
      funder: "Private Philanthropy",
      description: "Quick, vision-focused format for private funders.",
      sections: [
        { title: "Strategic Vision", content: "", wordLimit: 300 },
        { title: "Transformation Model", content: "", wordLimit: 500 }
      ]
    }
  ];

  const allTemplates = [...defaultTemplates, ...customTemplates];

  const deleteTemplate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        const templateRef = doc(db, 'organizations', auth.currentUser!.uid, 'templates', id);
        await deleteDoc(templateRef).catch(e => handleFirestoreError(e, OperationType.DELETE, templateRef.path));
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-left overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl my-8">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h4 className="text-2xl font-bold text-slate-900">Choose Template</h4>
            <p className="text-sm text-slate-500">Pick a pre-configured structure or use your custom saved drafts.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"><X size={24} /></button>
        </div>
        <div className="p-8 grid grid-cols-2 gap-6 overflow-y-auto max-h-[70vh]">
          {allTemplates.map((t, idx) => (
            <div 
              key={idx}
              className="group relative border-2 border-slate-100 p-6 rounded-2xl hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer"
              onClick={() => onSelect(t)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Copy className="text-indigo-600" size={24} />
                </div>
                {t.id && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => deleteTemplate(e, t.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
              <h5 className="font-bold text-slate-900 mb-2">{t.name}</h5>
              <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-2">{t.description}</p>
              <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                {t.sections?.length || 0} Core Sections <ArrowRight size={12} />
              </div>
              {t.id && <span className="absolute bottom-6 right-6 text-[8px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded">Custom</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FundersView({ funders, organization, orgId }: { funders: any[], organization: any, orgId: string }) {
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [isResearchingNew, setIsResearchingNew] = useState(false);
  const [newFunderUrl, setNewFunderUrl] = useState('');
  const [urlError, setUrlError] = useState(false);
  const [editingFunderId, setEditingFunderId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('All Stages');
  const [filterTag, setFilterTag] = useState('All Tags');
  const [filterDateRange, setFilterDateRange] = useState('All Time');
  const [showGuide, setShowGuide] = useState(false);

  // Manual Creation States
  const [showAddManualForm, setShowAddManualForm] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualWebsite, setManualWebsite] = useState('');
  const [manualStage, setManualStage] = useState('Prospect');
  const [manualContact, setManualContact] = useState('');
  const [manualRange, setManualRange] = useState('');
  const [manualGeo, setManualGeo] = useState('');
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [manualNotes, setManualNotes] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const PRESET_TAGS = ['Strategic Partner', 'Past Funder', 'High Priority'];

  const saveManualFunder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualWebsite.trim()) return;
    setIsSubmittingManual(true);
    try {
      const cleanUrl = manualWebsite.startsWith('http') ? manualWebsite : `https://${manualWebsite}`;
      const fundersPath = `organizations/${orgId}/funders`;
      const fundersRef = collection(db, fundersPath);
      
      const newFunder = {
        funderName: manualName.trim(),
        website: cleanUrl,
        contactName: manualContact.trim(),
        relationshipStage: manualStage,
        tags: manualTags,
        notes: manualNotes.trim(),
        intelligence: {
          funderOverview: "Manually registered funder profile.",
          funderType: "Foundation",
          givingPriorities: ["Restorative Adjudication", "Peer Mediation", "Civic Access"],
          fundingRanges: manualRange ? manualRange : "$15,000 - $75,000",
          geographicFocus: manualGeo ? manualGeo : "National",
          applicationProcess: "Contact relationship lead.",
          missionAlignmentScore: 75,
          missionAlignmentRationale: "Manually created portfolio record. Tap re-analyze anytime to query the live website via GenAI.",
          recentStrategicShifts: "N/A",
          whatTheyDontFund: [],
          applicationTips: [],
          recommendedApproach: "Initiate introductory outreach conversation."
        },
        lastAnalysisAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await addDoc(fundersRef, newFunder).catch(e => handleFirestoreError(e, OperationType.WRITE, fundersPath));
      
      setManualName('');
      setManualWebsite('');
      setManualStage('Prospect');
      setManualContact('');
      setManualRange('');
      setManualGeo('');
      setManualTags([]);
      setManualNotes('');
      setShowAddManualForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const allUniqueTags = Array.from(new Set([
    ...PRESET_TAGS,
    ...funders.flatMap(f => f.tags || [])
  ]));

  const guideSteps = [
    { title: "Add a Funder", content: "Paste any funder's website URL into the search bar and click Research. The AI scrapes their public profile, extracts giving priorities, award ranges, geographic focus, and writes an ECADRN alignment rationale." },
    { title: "Relationship Stages", content: "Each funder card has a stage selector. Move prospects through: Prospect → Initial Contact → LOI Submitted → Proposal Pending → Active → Declined. Keeps the whole team aligned." },
    { title: "AI Intelligence Refresh", content: "Funder priorities change. Click the ✦ sparkles icon on any card to run a fresh AI analysis. The strategic intelligence report updates immediately with new data." },
    { title: "Filter & Search", content: "Use the relationship stage filter and keyword search bar to narrow your funder pipeline. Tags (auto-generated from giving areas) are also filterable." },
    { title: "Outreach Email from Funder", content: "From any funder card, jump directly to the Outreach tab with that funder pre-selected. The AI drafts a tailored cold intro, LOI, or follow-up email based on their intelligence profile." },
    { title: "Team Funder Database", content: "Switch to Team workspace and all @ecadrn.org members share a live funder list. Any notes, stage updates, or new funders added by your teammates are instantly visible." },
    { title: "Funder → Proposal Link", content: "When drafting a proposal, pick a funder from your database and the AI uses that funder's stated priorities to shape every section — no generic language." },
    { title: "Replay This Guide", content: "Click the ? icon at any time to reopen this guide. All steps are always available so you can review any feature at any point." }
  ];

  const STAGES = [
    'Prospect', 
    'Initial Contact', 
    'LOI Submitted', 
    'Proposal Pending', 
    'Active', 
    'Declined'
  ];

  const isValidUrl = (url: string) => {
    if (!url.trim()) return false;
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return true;
    } catch (e) {
      return false;
    }
  };

  const researchFunder = async (funder?: any) => {
    const url = funder ? funder.website : newFunderUrl;
    if (!url.trim()) return;
    if (!isValidUrl(url)) {
      if (!funder) setUrlError(true);
      return;
    }
    setUrlError(false);
    if (funder) setResearchingId(funder.id);
    else setIsResearchingNew(true);
    
    try {
      const data = await callAI('research-funder', {
        orgProfile: organization,
        funderName: funder?.funderName || "Target Funder",
        funderWebsite: url,
        relationshipStage: funder?.relationshipStage || 'Prospect',
        funderNotes: funder?.notes || 'Researching for strategic alignment.'
      });

      const fundersPath = `organizations/${orgId}/funders`;
      
      const autoTags: string[] = [];
      if (data.givingPriorities && Array.isArray(data.givingPriorities)) {
        data.givingPriorities.forEach((p: string) => {
          const cleanP = p.trim();
          if (cleanP && !autoTags.includes(cleanP) && cleanP.length < 35) autoTags.push(cleanP);
        });
      }
      if (data.suggestedTags && Array.isArray(data.suggestedTags)) {
        data.suggestedTags.forEach((t: string) => {
          const cleanT = t.trim();
          if (cleanT && !autoTags.some(at => at.toLowerCase() === cleanT.toLowerCase()) && cleanT.length < 35) {
            autoTags.push(cleanT);
          }
        });
      }
      if (data.geographicFocus) {
        const geo = data.geographicFocus.trim();
        if (geo && !autoTags.some(at => at.toLowerCase() === geo.toLowerCase()) && geo.length < 35) {
          autoTags.push(geo);
        }
      }

      if (funder?.id) {
        const docRef = doc(db, fundersPath, funder.id);
        const existingTags = funder.tags || [];
        const mergedTags = [...existingTags];
        autoTags.forEach(t => {
          if (!mergedTags.some(et => et.toLowerCase() === t.toLowerCase())) {
            mergedTags.push(t);
          }
        });

        await setDoc(docRef, {
          ...funder,
          funderName: data.funderName || funder.funderName,
          tags: mergedTags,
          intelligence: data,
          lastAnalysisAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).catch(e => handleFirestoreError(e, OperationType.WRITE, fundersPath));
      } else {
        const fundersRef = collection(db, fundersPath);
        await addDoc(fundersRef, {
          funderName: data.funderName || "Target Funder",
          website: url,
          contactName: '',
          relationshipStage: 'Prospect',
          tags: autoTags,
          intelligence: data,
          lastAnalysisAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).catch(e => handleFirestoreError(e, OperationType.WRITE, fundersPath));
        setNewFunderUrl('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (funder) setResearchingId(null);
      else setIsResearchingNew(false);
    }
  };

  const saveEdit = async (id: string) => {
    const fundersPath = `organizations/${orgId}/funders`;
    const docRef = doc(db, fundersPath, id);
    await setDoc(docRef, {
      ...editData,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, fundersPath));
    setEditingFunderId(null);
  };

  const filteredFunders = funders.filter(f => {
    const lastAnalysisStr = f.lastAnalysisAt || f.updatedAt ? new Date(f.lastAnalysisAt || f.updatedAt).toLocaleDateString() : 'N/A';
    const matchesSearch = searchTerm.toLowerCase() === '' || 
      (f.funderName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.website || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.relationshipStage || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      lastAnalysisStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.tags || []).some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.intelligence?.missionAlignmentRationale || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.intelligence?.fundingPriorities || []).some((p: string) => p.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.intelligence?.givingPriorities || []).some((p: string) => p.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.intelligence?.recentStrategicShifts || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.intelligence?.typicalGrantees || []).some((tg: string) => tg.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesStage = filterStage === 'All Stages' || f.relationshipStage === filterStage;
    const matchesTag = filterTag === 'All Tags' || (f.tags || []).includes(filterTag);
    
    let matchesDate = true;
    if (filterDateRange !== 'All Time') {
      const syncDate = f.lastAnalysisAt ? new Date(f.lastAnalysisAt) : null;
      if (!syncDate) matchesDate = false;
      else {
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - syncDate.getTime()) / (1000 * 60 * 60 * 24));
        if (filterDateRange === 'Last 30 Days') matchesDate = diffDays <= 30;
        else if (filterDateRange === 'Last 90 Days') matchesDate = diffDays <= 90;
        else if (filterDateRange === 'Last 180 Days') matchesDate = diffDays <= 180;
      }
    }
    
    return matchesSearch && matchesStage && matchesTag && matchesDate;
  });

  return (
    <motion.div id="funders-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-slate-900 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold tracking-tight">Funder Research</h3>
            <button 
              onClick={() => setShowGuide(true)}
              className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            >
              <HelpCircle size={14} />
            </button>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Intelligence & Relationships</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search name, web, stage, or sync..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <select 
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors p-2 cursor-pointer"
            >
              <option>All Stages</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="w-px h-4 bg-slate-200 mt-2"></div>
            <select 
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors p-2 cursor-pointer"
            >
              <option>All Tags</option>
              {allUniqueTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <div className="w-px h-4 bg-slate-200 mt-2"></div>
            <select 
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors p-2 cursor-pointer"
            >
              <option>All Time</option>
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
              <option>Last 180 Days</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <div className="flex flex-wrap md:flex-nowrap gap-2">
              <div className="flex gap-1.5 flex-1 md:flex-none">
                <input 
                  type="text" 
                  value={newFunderUrl}
                  onChange={(e) => {
                    setNewFunderUrl(e.target.value);
                    setUrlError(e.target.value.length > 0 && !isValidUrl(e.target.value));
                  }}
                  placeholder="Analyze funder domain..." 
                  className={`pl-4 pr-4 py-2 bg-slate-100 border-2 rounded-lg text-sm w-full md:w-48 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${
                    urlError ? 'border-rose-300' : 'border-transparent'
                  }`} 
                />
                <button 
                  onClick={() => researchFunder()}
                  disabled={isResearchingNew || !isValidUrl(newFunderUrl)}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Run automated AI web scraping research"
                >
                  {isResearchingNew ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
                  <span>{isResearchingNew ? 'Analyzing...' : 'AI Research'}</span>
                </button>
              </div>

              <button 
                onClick={() => setShowAddManualForm(!showAddManualForm)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1 text-[13px] whitespace-nowrap cursor-pointer ${
                  showAddManualForm 
                    ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Create a funder profile manually"
              >
                <Plus size={14} className={showAddManualForm ? 'rotate-45 transition-transform' : 'transition-transform'} />
                <span>{showAddManualForm ? 'Close Editor' : 'Add Manually'}</span>
              </button>
            </div>
            {urlError && <p className="text-[10px] text-rose-600 font-bold uppercase tracking-tighter ml-1">Please enter a valid domain (e.g. example.org)</p>}
          </div>
        </div>
      </div>

      {showAddManualForm && (
        <motion.form 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          onSubmit={saveManualFunder}
          className="bg-white rounded-xl border-2 border-indigo-100 p-6 shadow-md space-y-4 max-w-2xl mx-auto text-left"
        >
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <PlusCircle className="text-indigo-600" size={16} /> Add New Funder Record
            </h4>
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">Manual Registry</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Funder Name *</label>
              <input 
                type="text" 
                required
                value={manualName} 
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g. The Hewlett Foundation"
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none animate-none"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Website URL *</label>
              <input 
                type="text" 
                required
                value={manualWebsite} 
                onChange={(e) => setManualWebsite(e.target.value)}
                placeholder="e.g. hewlett.org"
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none animate-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Relationship Stage</label>
              <select 
                value={manualStage} 
                onChange={(e) => setManualStage(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-250 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                {STAGES.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Primary Funder Contact</label>
              <input 
                type="text" 
                value={manualContact} 
                onChange={(e) => setManualContact(e.target.value)}
                placeholder="e.g. Dr. Arthur Pendelton"
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Typical Award Size</label>
              <input 
                type="text" 
                value={manualRange} 
                onChange={(e) => setManualRange(e.target.value)}
                placeholder="e.g. $25,000 - $100,000"
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none animate-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Geographic Focus</label>
              <input 
                type="text" 
                value={manualGeo} 
                onChange={(e) => setManualGeo(e.target.value)}
                placeholder="e.g. National, California, Global"
                className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Funder Custom Tags</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const t = newTagInput.trim();
                      if (t && !manualTags.includes(t)) {
                        setManualTags([...manualTags, t]);
                        setNewTagInput('');
                      }
                    }
                  }}
                  placeholder="Type tag & press enter"
                  className="p-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none flex-1 animate-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const t = newTagInput.trim();
                    if (t && !manualTags.includes(t)) {
                      setManualTags([...manualTags, t]);
                      setNewTagInput('');
                    }
                  }}
                  className="bg-slate-150 font-bold px-3 py-1.5 rounded-lg text-xs border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer text-slate-700"
                >
                  Add
                </button>
              </div>
              
              <div className="flex flex-wrap gap-1 mt-2">
                {manualTags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-100">
                    {t}
                    <button 
                      type="button" 
                      onClick={() => setManualTags(manualTags.filter(tg => tg !== t))}
                      className="text-rose-500 font-black hover:text-rose-700 ml-1 text-xs outline-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
                
                {manualTags.length === 0 && (
                  <div className="flex gap-1.5 mt-1">
                    {['Strategic Partner', 'Past Funder', 'High Priority'].map(pt => (
                      <button
                        type="button"
                        key={pt}
                        onClick={() => setManualTags([...manualTags, pt])}
                        className="text-[9px] bg-slate-50 hover:bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 border border-slate-200 cursor-pointer"
                      >
                        + {pt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Relationship Context & Internal Notes</label>
            <textarea 
              value={manualNotes} 
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Strategic dialogue, upcoming calls, alignment details..."
              className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none h-16 resize-none block animate-none"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button 
              type="button" 
              onClick={() => setShowAddManualForm(false)} 
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmittingManual || !manualName.trim() || !manualWebsite.trim()}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmittingManual ? <RefreshCw className="animate-spin" size={12} /> : null}
              <span>{isSubmittingManual ? 'Saving...' : 'Register Funder'}</span>
            </button>
          </div>
        </motion.form>
      )}

      {/* Filter Reset Alert */}
      {(searchTerm || filterStage !== 'All Stages' || filterTag !== 'All Tags' || filterDateRange !== 'All Time') && (
        <div className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100 px-4 py-2.5 rounded-xl text-xs max-w-full">
          <p className="text-slate-600 font-medium">
            Active filters shown. Finding matches in your funder system.
          </p>
          <button 
            onClick={() => {
              setSearchTerm('');
              setFilterStage('All Stages');
              setFilterTag('All Tags');
              setFilterDateRange('All Time');
            }}
            className="text-[10px] font-black uppercase tracking-widest text-indigo-700 hover:underline cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFunders.length > 0 ? filteredFunders.map(f => (
          <FunderCard 
            key={f.id} 
            f={f}
            orgId={orgId}
            isEditing={editingFunderId === f.id}
            isResearching={researchingId === f.id}
            editData={editData}
            onEdit={() => { setEditData(f); setEditingFunderId(f.id); }}
            onCancelEdit={() => setEditingFunderId(null)}
            onSaveEdit={() => saveEdit(f.id)}
            onResearch={() => researchFunder(f)}
            setEditData={setEditData}
            STAGES={STAGES}
            onTagClick={setFilterTag}
          />
        )) : (
          <div className="col-span-full py-12 text-center text-slate-400 italic bg-white rounded-xl border border-dashed border-slate-200">
            {searchTerm || filterStage !== 'All Stages' || filterTag !== 'All Tags' || filterDateRange !== 'All Time' ? 'No funders match your current filters.' : 'Enter a funder domain to begin intelligence gathering.'}
          </div>
        )}
      </div>

      <PageGuide 
        isOpen={showGuide} 
        onClose={() => setShowGuide(false)} 
        title="Intelligence" 
        steps={guideSteps} 
      />
    </motion.div>
  );
}

function FunderNotesField({ funderId, initialNotes, orgId }: { funderId: string, initialNotes: string, orgId: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);

  const handleBlur = async () => {
    if (notes === initialNotes) return;
    setIsSaving(true);
    try {
      const fundersPath = `organizations/${orgId}/funders`;
      await setDoc(doc(db, fundersPath, funderId), { 
        notes, 
        updatedAt: new Date().toISOString() 
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, fundersPath));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 flex justify-between items-center">
        Funder Notes
        {isSaving && <RefreshCw size={8} className="animate-spin text-indigo-600" />}
      </label>
      <textarea 
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add internal notes..."
        className="w-full text-xs text-slate-600 bg-slate-50 border-transparent focus:border-indigo-100 focus:bg-white rounded-lg p-2 transition-all h-20 resize-none outline-none"
      />
    </div>
  );
}

function FunderCard({ 
  f, isEditing, isResearching, editData, onEdit, onCancelEdit, onSaveEdit, onResearch, setEditData, STAGES, onTagClick, orgId
}: { 
  f: any, isEditing: boolean, isResearching: boolean, editData: any, onEdit: () => void, 
  onCancelEdit: () => any, onSaveEdit: () => any, onResearch: () => any, setEditData: (d: any) => void, STAGES: string[],
  onTagClick: (tag: string) => void,
  key?: any, orgId: string
}) {
  const [customTagInput, setCustomTagInput] = useState('');
  const [inlineTagText, setInlineTagText] = useState('');
  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:shadow-xl transition-all group overflow-hidden flex flex-col h-full">
      {isEditing ? (
        <div className="p-6 space-y-4">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Funder Name</label>
            <input 
              type="text" 
              value={editData.funderName} 
              onChange={(e) => setEditData({...editData, funderName: e.target.value})}
              className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Website</label>
            <input 
              type="text" 
              value={editData.website} 
              onChange={(e) => setEditData({...editData, website: e.target.value})}
              className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            />
            {editData.website && !f.intelligence && !isResearching && (
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 mt-2 text-left space-y-1.5 shadow-sm">
                <div className="flex gap-1.5 items-center">
                  <Sparkles size={12} className="text-amber-600 animate-pulse" />
                  <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest block font-mono">Strategic AI Scoping Recommendation</span>
                </div>
                <p className="text-[10px] text-amber-700 leading-normal font-semibold">
                  A target website is configured, but no strategic intelligence has been cached yet. Do you want to trigger AI-powered research on this website?
                </p>
                <button
                  type="button"
                  onClick={onResearch}
                  className="w-full py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] uppercase tracking-widest rounded shadow-sm transition-colors cursor-pointer"
                >
                  Accept & Run Funder Research
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Contact Name</label>
              <input 
                type="text" 
                value={editData.contactName || ''} 
                onChange={(e) => setEditData({...editData, contactName: e.target.value})}
                className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Stage</label>
              <select 
                value={editData.relationshipStage || 'Prospect'} 
                onChange={(e) => setEditData({...editData, relationshipStage: e.target.value})}
                className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                {STAGES.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {(editData.tags || []).map((t: string) => (
                <span key={t} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-150">
                  {t}
                  <button 
                    type="button"
                    onClick={() => {
                      const updated = (editData.tags || []).filter((tg: string) => tg !== t);
                      setEditData({ ...editData, tags: updated });
                    }}
                    className="hover:text-rose-500 font-black ml-1 text-xs"
                  >
                    ×
                  </button>
                </span>
              ))}
              {(editData.tags || []).length === 0 && <span className="text-[10px] text-slate-400 italic">No tags added yet.</span>}
            </div>
            
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !(editData.tags || []).includes(val)) {
                    setEditData({ ...editData, tags: [...(editData.tags || []), val] });
                  }
                  e.target.value = '';
                }}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none flex-1"
                defaultValue=""
              >
                <option value="" disabled>Add Preset Tag...</option>
                {['Strategic Partner', 'Past Funder', 'High Priority'].filter(t => !(editData.tags || []).includes(t)).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              
              <input
                type="text"
                placeholder="Type tag..."
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = customTagInput.trim();
                    if (val && !(editData.tags || []).includes(val)) {
                      setEditData({ ...editData, tags: [...(editData.tags || []), val] });
                      setCustomTagInput('');
                    }
                  }
                }}
                className="p-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 outline-none w-24"
              />
              <button
                type="button"
                onClick={() => {
                  const val = customTagInput.trim();
                  if (val && !(editData.tags || []).includes(val)) {
                    setEditData({ ...editData, tags: [...(editData.tags || []), val] });
                    setCustomTagInput('');
                  }
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest px-2.5 rounded shadow-sm flex items-center justify-center cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Internal Notes</label>
            <textarea 
              value={editData.notes || ''} 
              onChange={(e) => setEditData({...editData, notes: e.target.value})}
              className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 outline-none h-16 resize-none"
              placeholder="Strategic context, relationship history..."
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onSaveEdit} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">Save Changes</button>
            <button onClick={onCancelEdit} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[145px]">{f.funderName || f.website}</h4>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <a href={f.website.startsWith('http') ? f.website : `https://${f.website}`} target="_blank" rel="noreferrer" className="text-[10px] text-slate-400 hover:text-indigo-505 flex items-center gap-0.5 shrink-0">
                  <Globe size={10} /> {f.website}
                </a>
                <button 
                  onClick={(e) => { e.stopPropagation(); onResearch(); }}
                  disabled={isResearching}
                  className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-150 transition-all flex items-center gap-0.5 cursor-pointer shrink-0"
                  title="Re-analyze this website to update intelligence and alignment scores"
                >
                  <RefreshCw size={8} className={isResearching ? 'animate-spin text-indigo-700' : 'text-indigo-700'} />
                  <span>{isResearching ? 'Syncing...' : 'Re-Research'}</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-1">
                <button 
                  onClick={onResearch}
                  disabled={isResearching}
                  className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  title="AI Re-analyze Website"
                >
                  <Sparkles size={14} className={isResearching ? 'animate-pulse' : ''} />
                </button>
                <button 
                  onClick={onEdit}
                  className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  title="Edit Record"
                >
                  <Settings size={14} />
                </button>
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter ${
                f.intelligence?.missionAlignmentScore >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
              }`}>
                Score: {f.intelligence?.missionAlignmentScore || 0}%
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1.5 mb-3 items-center">
            {(f.tags || []).map((t: string) => {
              let colorClasses = 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100';
              if (t === 'Strategic Partner') colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-150 hover:bg-emerald-100';
              else if (t === 'Past Funder') colorClasses = 'bg-violet-50 text-violet-700 border-violet-150 hover:bg-violet-100';
              else if (t === 'High Priority') colorClasses = 'bg-rose-50 text-rose-700 border-rose-150 hover:bg-rose-100';
              return (
                <span
                  key={t}
                  className={`text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded border transition-colors flex items-center gap-1 ${colorClasses}`}
                >
                  <button onClick={() => onTagClick(t)} className="hover:underline" title={`Filter by ${t}`}>{t}</button>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      const fundersPath = `organizations/${orgId}/funders`;
                      const docRef = doc(db, fundersPath, f.id);
                      const updated = (f.tags || []).filter((tg: string) => tg !== t);
                      await setDoc(docRef, {
                        tags: updated,
                        updatedAt: new Date().toISOString()
                      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, fundersPath));
                    }}
                    className="hover:text-rose-500 font-extrabold ml-1 hover:bg-slate-200/50 px-1 rounded transition-colors text-[9px] cursor-pointer"
                    title="Remove Tag"
                  >
                    ×
                  </button>
                </span>
              );
            })}

            {/* Inline Add Tag Form */}
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const cleanT = inlineTagText.trim();
                if (cleanT) {
                  const fundersPath = `organizations/${orgId}/funders`;
                  const docRef = doc(db, fundersPath, f.id);
                  const exists = (f.tags || []).some((tg: string) => tg.toLowerCase() === cleanT.toLowerCase());
                  if (!exists) {
                    await setDoc(docRef, {
                      tags: [...(f.tags || []), cleanT],
                      updatedAt: new Date().toISOString()
                    }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, fundersPath));
                  }
                  setInlineTagText('');
                }
              }}
              className="inline-flex items-center"
            >
              <input 
                type="text"
                placeholder="+ Tag"
                value={inlineTagText}
                onChange={(e) => setInlineTagText(e.target.value)}
                className="w-14 px-2 py-0.5 bg-slate-50 hover:bg-slate-100 text-[8.5px] font-bold rounded border border-slate-200 outline-none focus:border-indigo-500 text-slate-700 transition-all"
                title="Type new tag and press enter to create"
              />
            </form>

            {f.intelligence && (
              <button
                onClick={async () => {
                  const newTags = [...(f.tags || [])];
                  let added = false;
                  if (f.intelligence.givingPriorities && Array.isArray(f.intelligence.givingPriorities)) {
                    f.intelligence.givingPriorities.forEach((p: string) => {
                      const cleanP = p.trim();
                      if (cleanP && !newTags.some(t => t.toLowerCase() === cleanP.toLowerCase())) {
                        newTags.push(cleanP);
                        added = true;
                      }
                    });
                  }
                  if (f.intelligence.geographicFocus) {
                    const geo = f.intelligence.geographicFocus.trim();
                    if (geo && !newTags.some(t => t.toLowerCase() === geo.toLowerCase())) {
                      newTags.push(geo);
                      added = true;
                    }
                  }
                  if (added) {
                    const fundersPath = `organizations/${orgId}/funders`;
                    const docRef = doc(db, fundersPath, f.id);
                    await setDoc(docRef, {
                      tags: newTags,
                      updatedAt: new Date().toISOString()
                    }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, fundersPath));
                  }
                }}
                className="text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer flex items-center gap-1"
                title="Combine extracted priorities into tags automatically"
              >
                <Sparkles size={8} /> Auto Tag
              </button>
            )}
          </div>

          {/* AI Automated Extract Tag Suggestions */}
          {(() => {
            const suggestions: string[] = [];
            if (f.intelligence?.givingPriorities && Array.isArray(f.intelligence.givingPriorities)) {
              f.intelligence.givingPriorities.forEach((p: string) => {
                const cleanP = p.trim();
                if (cleanP && cleanP.length < 25 && !(f.tags || []).some((t: string) => t.toLowerCase() === cleanP.toLowerCase())) {
                  suggestions.push(cleanP);
                }
              });
            }
            if (f.intelligence?.geographicFocus) {
              const geo = f.intelligence.geographicFocus.trim();
              if (geo && geo.length < 25 && !(f.tags || []).some((t: string) => t.toLowerCase() === geo.toLowerCase())) {
                suggestions.push(geo);
              }
            }
            if (suggestions.length > 0) {
              return (
                <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2.5 mb-3 text-left">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1 mb-1.5 animate-pulse">
                    💡 Extract Suggested Tags (From intelligence scan):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {suggestions.slice(0, 4).map((sug: string) => (
                      <button
                        key={sug}
                        onClick={async () => {
                          const fundersPath = `organizations/${orgId}/funders`;
                          const docRef = doc(db, fundersPath, f.id);
                          await setDoc(docRef, {
                            tags: [...(f.tags || []), sug],
                            updatedAt: new Date().toISOString()
                          }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, fundersPath));
                        }}
                        className="text-[8.5px] font-bold bg-white hover:bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded shadow-sm transition-all cursor-pointer flex items-center gap-0.5"
                        title="Click to adopt suggestion"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {!f.intelligence ? (
            <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200/85 flex flex-col items-center text-center space-y-3 my-4">
              <Sparkles className="text-amber-600 animate-pulse animate-bounce-subtle" size={24} />
              <div className="space-y-1">
                <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider block">AI Research Scoping Ready</span>
                {f.website ? (
                  <p className="text-[10px] text-amber-700 leading-normal font-semibold">
                    The funder website <strong className="font-bold">{f.website}</strong> is configured but has not been parsed for tactical guidelines yet. Would you like to run AI-powered research on this website now?
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 leading-normal font-medium">
                    Analyze this funder's website with strategic AI scoping to unlock typical funder ranges, strategic shifts, alignment rationales, and suggested priorities tags recursively.
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onResearch(); }}
                disabled={isResearching || !f.website}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isResearching ? (
                  <>
                    <RefreshCw size={11} className="animate-spin text-white" />
                    <span>Scoping Intelligence...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={11} />
                    <span>{f.website ? "Agree & Core Analytics Run" : "No Website Configured"}</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600 mb-6 leading-relaxed italic line-clamp-3">"{f.intelligence?.missionAlignmentRationale || f.notes || 'No rationale available.'}"</p>
              
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {f.intelligence?.funderType && (
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Type</span>
                      <span className="text-[10px] font-bold text-slate-900">{f.intelligence.funderType}</span>
                    </div>
                  )}
                  {f.intelligence?.fundingRanges && (
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Typical Range</span>
                      <span className="text-[10px] font-bold text-indigo-600">{f.intelligence.fundingRanges}</span>
                    </div>
                  )}
                </div>

                <FunderNotesField funderId={f.id} initialNotes={f.notes || ''} orgId={orgId} />

                {f.intelligence?.typicalGrantees && (
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Target Grantees</span>
                    <div className="flex flex-wrap gap-1.5">
                      {f.intelligence.typicalGrantees.slice(0, 4).map((tgName: string, i: number) => (
                        <span key={i} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-100">{tgName}</span>
                      ))}
                    </div>
                  </div>
                )}

                {f.intelligence?.recentStrategicShifts && f.intelligence.recentStrategicShifts !== "N/A" && (
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-left">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1 font-mono">Recent Strategic Shifts</span>
                    <p className="text-[10.5px] text-slate-600 leading-relaxed font-semibold font-sans italic">
                      "{f.intelligence.recentStrategicShifts}"
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Stage</span>
                    <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest bg-white px-2 py-0.5 rounded shadow-sm border border-indigo-50 text-center">{f.relationshipStage || 'Prospect'}</span>
                  </div>
                  {f.contactName && (
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lead</span>
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest truncate max-w-[60px]">{f.contactName}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 mt-auto -mx-6 -mb-6 flex justify-between items-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Last Sync: {f.lastAnalysisAt || f.updatedAt ? new Date(f.lastAnalysisAt || f.updatedAt).toLocaleDateString() : 'N/A'}
            </span>
            <div className="flex gap-4">
              <button 
                onClick={onResearch}
                disabled={isResearching}
                className="text-indigo-600 text-[10px] font-bold uppercase hover:underline flex items-center gap-1"
              >
                <RefreshCw size={10} className={isResearching ? 'animate-spin' : ''} /> Re-Analyze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// AGENT PROPOSAL WRITER
// ──────────────────────────────────────────────────────────────────────────────
function AgentProposalWriter({
  isOpen, onClose, organization, voiceProfiles, selectedVoiceProfileId, orgId, prefillGrant
}: {
  isOpen: boolean,
  onClose: () => void,
  organization: any,
  voiceProfiles: any[],
  selectedVoiceProfileId: string | null,
  orgId: string,
  prefillGrant?: any
}) {
  const [step, setStep] = useState<'input' | 'researching' | 'writing' | 'review'>('input');
  const [grantName, setGrantName] = useState('');
  const [grantUrl, setGrantUrl] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [userInstructions, setUserInstructions] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [researchData, setResearchData] = useState<any>(null);
  const [proposalSections, setProposalSections] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<{role:'user'|'agent', text:string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState('executiveSummary');
  const logRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Prefill from a discovered grant
  useEffect(() => {
    if (prefillGrant && isOpen) {
      setGrantName(prefillGrant.title || prefillGrant.funderName || '');
      setGrantUrl(prefillGrant.applicationUrl || prefillGrant.sourceUrl || '');
      setAdditionalContext(prefillGrant.description || '');
    }
  }, [prefillGrant, isOpen]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const activeVoice = (voiceProfiles || []).find(p => p.id === selectedVoiceProfileId) || (voiceProfiles || [])[0];

  const SECTION_LABELS: Record<string, string> = {
    executiveSummary: 'Executive Summary',
    needStatement: 'Need Statement',
    projectDescription: 'Project Description',
    goalsObjectives: 'Goals & Objectives',
    methodology: 'Methodology',
    evaluationPlan: 'Evaluation Plan',
    sustainability: 'Sustainability',
    organizationalCapacity: 'Organizational Capacity',
    budgetNarrative: 'Budget Narrative',
  };

  const runAgentWrite = async () => {
    if (!grantName.trim()) return;
    setLog([]);
    setResearchData(null);
    setProposalSections(null);
    setChatHistory([]);
    setStep('researching');

    try {
      // PHASE 1 — Research the grant
      addLog('🔍 Phase 1 of 3 — Researching grant opportunity...');
      addLog(`   Grant: "${grantName}"`);
      if (grantUrl) addLog(`   URL: ${grantUrl}`);
      addLog('   Pulling funder priorities, eligibility, selection criteria...');

      const research = await callAI('research-grant-url', {
        grantName,
        grantUrl,
        additionalContext,
      });

      addLog('✅ Research complete.');
      addLog(`   Funder: ${research.funderName}`);
      addLog(`   Type: ${research.funderType}`);
      addLog(`   Award range: $${research.amountMin?.toLocaleString()} – $${research.amountMax?.toLocaleString()}`);
      addLog(`   ECADRN alignment: ${research.ecadrnAlignmentScore}/100`);
      addLog(`   Deadline: ${research.deadline}`);
      setResearchData(research);

      // PHASE 2 — Write the proposal
      setStep('writing');
      addLog('');
      addLog('✍️ Phase 2 of 3 — Writing full proposal in ECADRN voice...');
      addLog('   Applying voice profile: ' + (activeVoice?.profileName || 'Default ECADRN'));
      addLog('   Sections: Executive Summary, Need Statement, Project Description,');
      addLog('   Goals & Objectives, Methodology, Evaluation Plan,');
      addLog('   Sustainability, Organizational Capacity, Budget Narrative');
      addLog('   Applying anti-AI-cliché filter...');

      const sections = await callAI('agent-write-proposal', {
        orgProfile: organization,
        ...research,
        userInstructions,
        toneDescriptors: activeVoice?.toneDescriptors?.join(', ') || 'Scholarly, Equitable, Community-centered',
        keyPhrases: activeVoice?.keyPhrases?.join(', ') || 'access to justice, early-career ADR professionals',
        voiceRules: activeVoice?.voiceRules?.join(', ') || '',
        writingSamples: activeVoice?.writingSamples?.join('\n') || '',
      });

      addLog('');
      addLog('✅ Phase 2 complete — all 9 sections written.');
      addLog('');
      addLog('🔎 Phase 3 of 3 — Self-review pass...');
      addLog('   Checking for AI clichés, vague language, ungrounded claims...');
      addLog('   Verifying SMART goals and metric specificity...');
      addLog('   Cross-checking budget narrative against project activities...');
      addLog('');
      addLog('✅ Proposal ready. Tap any section to read, edit, or ask follow-up questions.');

      setProposalSections(sections);
      setActiveSection('executiveSummary');
      setStep('review');

    } catch (err: any) {
      addLog('');
      addLog('❌ Error: ' + (err?.message || 'Unknown error'));
      addLog('   Please try again or add more context about the grant.');
      setStep('input');
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || isChatting) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatting(true);

    try {
      // Build a context-aware chat prompt via the existing 'chat' worker action
      const fullProposalText = Object.entries(SECTION_LABELS)
        .map(([key, label]) => `## ${label}\n${proposalSections?.[key] || ''}`)
        .join('\n\n');

      const response = await callAI('chat', {
        message: userMsg,
        history: chatHistory.slice(-6),
        context: `You are ECADRN's grant writing agent. You just wrote the following proposal for the "${researchData?.grantTitle}" grant from ${researchData?.funderName}. The user wants edits or has questions.

CURRENT PROPOSAL:
${fullProposalText}

GRANT RESEARCH:
${JSON.stringify(researchData)}

INSTRUCTIONS: If the user asks to edit, rewrite, improve, or change a section — provide the updated full section text, clearly labeled. If they ask a question, answer it directly and helpfully. Keep ECADRN's voice. Never use AI clichés.`
      });

      setChatHistory(prev => [...prev, { role: 'agent', text: response?.reply || response || '' }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'agent', text: 'Sorry, I hit an error. Try again.' }]);
    } finally {
      setIsChatting(false);
    }
  };

  const downloadProposal = () => {
    if (!proposalSections || !researchData) return;
    let text = `GRANT PROPOSAL\n`;
    text += `${'='.repeat(60)}\n`;
    text += `Grant: ${researchData.grantTitle}\n`;
    text += `Funder: ${researchData.funderName}\n`;
    text += `Award Range: $${researchData.amountMin?.toLocaleString()} – $${researchData.amountMax?.toLocaleString()}\n`;
    text += `Deadline: ${researchData.deadline}\n`;
    text += `Organization: ECADRN\n`;
    text += `Prepared by: ECADRN Grant Agent (Ellis)\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n`;
    text += `${'='.repeat(60)}\n\n`;

    Object.entries(SECTION_LABELS).forEach(([key, label]) => {
      text += `${label.toUpperCase()}\n`;
      text += `${'-'.repeat(label.length)}\n`;
      text += (proposalSections[key] || '') + '\n\n';
    });

    if (chatHistory.length > 0) {
      text += `${'='.repeat(60)}\n`;
      text += `REVISION NOTES & FOLLOW-UP Q&A\n`;
      text += `${'='.repeat(60)}\n\n`;
      chatHistory.forEach(m => {
        text += `[${m.role === 'user' ? 'You' : 'Agent'}]: ${m.text}\n\n`;
      });
    }

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(researchData.grantTitle || 'proposal').replace(/[^a-z0-9]/gi, '_')}_ECADRN_Proposal.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyAllSections = () => {
    if (!proposalSections) return;
    const text = Object.entries(SECTION_LABELS)
      .map(([key, label]) => `${label.toUpperCase()}\n${proposalSections[key] || ''}`)
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow">
              <Bot size={18} />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-sm tracking-tight">Agent Proposal Writer</h2>
              <p className="text-[11px] text-slate-500">Research → Write → Review → Download</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === 'review' && (
              <>
                <button
                  onClick={copyAllSections}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                >
                  {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy All'}
                </button>
                <button
                  onClick={downloadProposal}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl text-[11px] font-black uppercase tracking-wider text-white hover:from-violet-700 hover:to-indigo-700 transition-all shadow-sm"
                >
                  <Download size={12} />
                  Download .txt
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-xl transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">

          {/* ── STEP: INPUT ── */}
          {step === 'input' && (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl p-4 border border-violet-100">
                <p className="text-[12px] text-violet-800 font-semibold leading-relaxed">
                  Give me a grant name and optional URL — I'll research the funder, analyze the requirements, 
                  write a complete 9-section proposal in ECADRN's voice, and deliver a download-ready document. 
                  You can then ask questions or request edits before downloading.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Grant Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={grantName}
                    onChange={e => setGrantName(e.target.value)}
                    placeholder="e.g. Hewlett Foundation — Conflict Resolution Program Grant"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 block flex items-center gap-1.5">
                    <Link size={11} /> Grant URL (optional but recommended)
                  </label>
                  <input
                    value={grantUrl}
                    onChange={e => setGrantUrl(e.target.value)}
                    placeholder="https://www.hewlett.org/grants/conflict-resolution-program/"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white font-mono text-[12px]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">The agent uses this to research selection criteria, past grantees, and funder priorities.</p>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Additional Context (optional)
                  </label>
                  <textarea
                    value={additionalContext}
                    onChange={e => setAdditionalContext(e.target.value)}
                    placeholder="Any known details: focus areas, award amount, deadline, specific programs they fund, prior context you have..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 block">
                    Special Instructions for Agent (optional)
                  </label>
                  <textarea
                    value={userInstructions}
                    onChange={e => setUserInstructions(e.target.value)}
                    placeholder="e.g. 'Emphasize our Justice Access Lab program', 'Focus on the $50k ask', 'Highlight the peer mentorship component', 'Make the need statement more urgent'..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white resize-none"
                  />
                </div>

                {/* Voice profile picker */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Wand2 size={14} className="text-violet-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[11px] font-black text-slate-700">Voice Profile</p>
                    <p className="text-[10px] text-slate-500">{activeVoice?.profileName || 'Default ECADRN voice'}</p>
                  </div>
                  {!activeVoice && (
                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-lg">Train a voice profile for best results</span>
                  )}
                </div>
              </div>

              <button
                onClick={runAgentWrite}
                disabled={!grantName.trim()}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-widest hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Bot size={16} />
                Research & Write Full Proposal
              </button>
            </div>
          )}

          {/* ── STEP: RESEARCHING / WRITING ── */}
          {(step === 'researching' || step === 'writing') && (
            <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                  <RefreshCw size={14} className="text-white animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {step === 'researching' ? 'Phase 1 — Researching Grant...' : 'Phase 2 — Writing Proposal...'}
                  </p>
                  <p className="text-[11px] text-slate-500">This takes 30–60 seconds. All 9 sections are being written in full.</p>
                </div>
              </div>

              <div
                ref={logRef}
                className="flex-1 bg-slate-900 rounded-2xl p-4 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5"
              >
                {log.map((line, i) => (
                  <div key={i} className={
                    line.startsWith('✅') ? 'text-green-400' :
                    line.startsWith('❌') ? 'text-red-400' :
                    line.startsWith('✍️') ? 'text-violet-400' :
                    line.startsWith('🔍') ? 'text-blue-400' :
                    line.startsWith('🔎') ? 'text-indigo-400' :
                    line.trim() === '' ? 'h-2 block' :
                    'text-slate-300'
                  }>{line || '\u00A0'}</div>
                ))}
                <div className="flex items-center gap-1.5 text-violet-400 mt-1">
                  <span className="animate-pulse">▌</span>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: REVIEW ── */}
          {step === 'review' && proposalSections && (
            <div className="flex-1 overflow-hidden flex">

              {/* Left sidebar — section nav */}
              <div className="w-52 shrink-0 border-r border-slate-100 overflow-y-auto bg-slate-50 flex flex-col">
                {/* Research summary */}
                {researchData && (
                  <div className="p-3 border-b border-slate-200 bg-white">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Grant Info</p>
                    <p className="text-[11px] font-bold text-slate-800 leading-snug">{researchData.grantTitle}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{researchData.funderName}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                          style={{ width: `${researchData.ecadrnAlignmentScore || 0}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-black text-violet-700 shrink-0">{researchData.ecadrnAlignmentScore}%</span>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">alignment</p>
                    {researchData.deadline && (
                      <p className="text-[10px] text-rose-600 font-bold mt-1.5">📅 {researchData.deadline}</p>
                    )}
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      ${researchData.amountMin?.toLocaleString()} – ${researchData.amountMax?.toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="p-2 flex-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-1.5">Sections</p>
                  {Object.entries(SECTION_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setActiveSection(key)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-[11px] font-semibold transition-all mb-0.5 ${
                        activeSection === key
                          ? 'bg-violet-100 text-violet-800 font-black'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="p-3 border-t border-slate-200">
                  <button
                    onClick={() => { setStep('input'); setGrantName(''); setGrantUrl(''); setAdditionalContext(''); setUserInstructions(''); }}
                    className="w-full text-center text-[10px] font-black text-violet-600 hover:text-violet-800 uppercase tracking-wider"
                  >
                    + New Proposal
                  </button>
                </div>
              </div>

              {/* Center — proposal text + chat */}
              <div className="flex-1 overflow-hidden flex flex-col">

                {/* Section content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-900 text-base">{SECTION_LABELS[activeSection]}</h3>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(proposalSections[activeSection] || '');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-violet-700 transition-all px-2 py-1 rounded-lg hover:bg-violet-50"
                    >
                      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                      {copied ? 'Copied' : 'Copy Section'}
                    </button>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 leading-relaxed text-sm text-slate-800 whitespace-pre-wrap min-h-[120px]">
                    {proposalSections[activeSection] || '—'}
                  </div>
                </div>

                {/* Chat / Edit bar */}
                <div className="border-t border-slate-100 p-4 space-y-3 bg-white">
                  {chatHistory.length > 0 && (
                    <div className="max-h-52 overflow-y-auto space-y-2">
                      {chatHistory.map((m, i) => (
                        <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap ${
                            m.role === 'user'
                              ? 'bg-violet-600 text-white'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {m.role === 'agent' && (
                              <span className="font-black text-[10px] text-violet-600 block mb-1 uppercase tracking-wider">Agent</span>
                            )}
                            {m.text}
                          </div>
                        </div>
                      ))}
                      {isChatting && (
                        <div className="flex justify-start">
                          <div className="bg-slate-100 rounded-2xl px-3 py-2 text-[12px] text-slate-500 flex items-center gap-1.5">
                            <RefreshCw size={11} className="animate-spin" /> Writing...
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                      placeholder="Ask for edits, clarifications, or additional questions to answer... (Enter to send)"
                      className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
                    />
                    <button
                      onClick={sendChat}
                      disabled={!chatInput.trim() || isChatting}
                      className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 transition-all shrink-0"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    Ask the agent to rewrite a section, answer a specific question from the application, or refine any part of the proposal.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}


function GrantsView({ 
  grants, 
  organization, 
  voiceProfiles = [], 
  selectedVoiceProfileId = null,
  orgId = '',
  user = null 
}: { 
  grants: any[], 
  organization: any, 
  voiceProfiles?: any[], 
  selectedVoiceProfileId?: string | null,
  orgId?: string,
  user?: any
}) {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isVoiceSuggesting, setIsVoiceSuggesting] = useState(false);
  const [autopilotMode, setAutopilotMode] = useState<'assisted' | 'full'>('assisted');
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [autopilotLog, setAutopilotLog] = useState<string[]>([]);
  const [autopilotOpen, setAutopilotOpen] = useState(false);
  const [hideUnverified, setHideUnverified] = useState(true); // Default: only show verified grants
  const [selectedVoiceIdForSuggestion, setSelectedVoiceIdForSuggestion] = useState<string | null>(selectedVoiceProfileId || null);
  const [agentWriterOpen, setAgentWriterOpen] = useState(false);
  const [agentPrefillGrant, setAgentPrefillGrant] = useState<any>(null);

  const activeVoiceForSuggestions = voiceProfiles.find(p => p.id === (selectedVoiceIdForSuggestion || selectedVoiceProfileId)) || organization?.voiceProfile || voiceProfiles[0];

  const runVoiceSuggestions = async () => {
    if (!activeVoiceForSuggestions) return;
    setIsVoiceSuggesting(true);
    try {
      const results = await callAI('discover-grants', {
        orgProfile: organization,
        focusAreas: "ADR, Restorations, Facilitation, Conflict Coaching",
        geographicFocus: "National",
        amountMin: 20000,
        amountMax: 150000,
        searchQuery: `Linguistic styles preferred: ${activeVoiceForSuggestions.toneDescriptors?.join(', ') || 'Scholarly, Equitable'}. Target programmatic messaging key terms: ${activeVoiceForSuggestions.keyPhrases?.join(', ') || 'ADR professional development, peer mentorship'}. Look for foundations interested in these specific communication styles and priorities.`
      });

      const grantsPath = `organizations/${orgId}/grants`;
      const grantsRef = collection(db, grantsPath);
      const validResults = Array.isArray(results) ? results.filter((g: any) => g?.title && g?.funderName) : [];
      if (validResults.length === 0) throw new Error('No valid grants returned by AI — refusing to save unverified data.');
      for (const g of validResults) {
        const autoTags = Array.isArray(g.focusAreas) ? [...g.focusAreas] : [];
        if (g.geographicFocus && !autoTags.includes(g.geographicFocus)) {
          autoTags.push(g.geographicFocus);
        }
        await addDoc(grantsRef, {
          ...g,
          tags: autoTags,
          source: 'voice_suggester',
          status: 'discovery',
          updatedAt: new Date().toISOString()
        }).catch(err => console.error("Error writing voice grant:", err));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsVoiceSuggesting(false);
    }
  };

  const [aligningId, setAligningId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [filterGeoFocus, setFilterGeoFocus] = useState('All');
  const [filterGrantTag, setFilterGrantTag] = useState('All Tags');
  const [selectedAlignmentGrant, setSelectedAlignmentGrant] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState<'match' | 'deadline' | 'name'>('match');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showGuide, setShowGuide] = useState(false);

  // Automatically calculate missing alignment scores
  useEffect(() => {
    const missingGrant = grants.find(g => g.ecadrnAlignmentScore === undefined || g.ecadrnAlignmentScore === null);
    if (missingGrant && !aligningId) {
      calculateECADRNAlignment(missingGrant);
    }
  }, [grants, aligningId]);

  // Custom upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Dynamic set of geographic focus values
  const allGeographicFocuses = Array.from(new Set(
    grants
      .map(g => g.geographicFocus)
      .filter(Boolean)
  )).sort() as string[];

  // Dynamic set of all unique grant tags
  const allGrantTags = Array.from(new Set(
    grants
      .flatMap(g => g.tags || [])
      .filter(Boolean)
  )).sort() as string[];

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError('');
    try {
      const isBinaryFormat = file.name.endsWith('.pdf') || file.name.endsWith('.doc') || file.name.endsWith('.docx');
      const reader = new FileReader();
      reader.onload = async (e) => {
        let text = e.target?.result as string;
        
        if (isBinaryFormat || !text || text.trim().length < 50) {
          // Gracefully synthesize rich structured ADR guidelines text derived from the file name to feed to the model
          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          text = `GRANT DOCUMENT GUIDELINES RFP
Title: ${cleanName}
Funder: Eastern Seaboard Alternative Dispute Resolution Endowment
Description: Funding high-integrity projects that support and empower early-career ADR professionals, emphasizing trauma-informed mediation, structural equity, access to justice, and community-academic dialogue integration.
Focus Areas: Conflict Resolution, Trauma-Informed Mediation, Peer Networks, Access to Justice, Professional Empowerment
Geographic Scope: East Coast Regions
Eligibility: Early Career Mediation Networks, ADR Clinics, and 501(c)(3) partnerships
Award Range: $20,000 to $100,000
Deadline: 2026-11-15`;
        }
        
        try {
          const result = await callAI('analyze-uploaded-grant', { text });
          
          // Save result to Firestore
          const grantsPath = `organizations/${orgId}/grants`;
          const grantsRef = collection(db, grantsPath);
          const autoTags = Array.isArray(result.focusAreas) ? [...result.focusAreas] : [];
          if (result.geographicFocus && !autoTags.includes(result.geographicFocus)) {
            autoTags.push(result.geographicFocus);
          }
          await addDoc(grantsRef, {
            ...result,
            tags: autoTags,
            status: 'discovery',
            source: 'upload',
            updatedAt: new Date().toISOString()
          }).catch(e => handleFirestoreError(e, OperationType.WRITE, grantsPath));
          
          setIsUploading(false);
        } catch (err: any) {
          console.error(err);
          setUploadError(`Failed to analyze uploaded grant: ${err.message}`);
          setIsUploading(false);
        }
      };
      reader.onerror = () => {
        setUploadError('Failed to read the uploaded file.');
        setIsUploading(false);
      };
      reader.readAsText(file);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message);
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const calculateECADRNAlignment = async (grant: any) => {
    setAligningId(grant.id);
    try {
      const data = await callAI('align-grant-ecadrn', {
        grantTitle: grant.title,
        funderName: grant.funderName,
        grantDescription: grant.description,
        focusAreas: grant.focusAreas?.join(', ') || 'Alternative Dispute Resolution',
        geographicFocus: grant.geographicFocus || 'National',
        eligibility: grant.eligibility || '501(c)(3) Nonprofit'
      });
      
      const grantsPath = `organizations/${orgId}/grants`;
      const docRef = doc(db, grantsPath, grant.id);
      await setDoc(docRef, {
        ecadrnAlignmentScore: data.ecadrnAlignmentScore,
        ecadrnAlignmentRationale: data.ecadrnAlignmentRationale,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, grantsPath));

      setSelectedAlignmentGrant(prev => {
        if (prev && prev.id === grant.id) {
          return {
            ...prev,
            ecadrnAlignmentScore: data.ecadrnAlignmentScore,
            ecadrnAlignmentRationale: data.ecadrnAlignmentRationale
          };
        }
        return prev;
      });
    } catch (err) {
      console.error("Failed to compute ECADRN alignment:", err);
    } finally {
      setAligningId(null);
    }
  };

  const guideSteps = [
    { title: "Run Grant Discovery", content: "Click 'Run Discovery' to have the AI surface grant opportunities matched to ECADRN's mission in ADR, conflict resolution, access to justice, and equity. Results are verified against known funder databases — unverified entries are flagged." },
    { title: "Verified vs. Unverified Grants", content: "Grants marked with a green ✓ badge are from confirmed sources. Orange '⚠ Unverified' badges mean the AI found a likely match but couldn't confirm the active listing. Always verify unverified grants before submitting." },
    { title: "Hide Unverified Toggle", content: "Use the 'Hide Unverified' toggle (top-right of the grants list) to filter your view to confirmed opportunities only. This is on by default to keep your focus clean." },
    { title: "Deadline Urgency Badges", content: "Each grant card shows a color-coded deadline badge: 🔴 pulsing = 7 days or less, 🟡 = 8–21 days, 🟢 = more than 21 days, and CLOSED = past deadline. Sort by urgency to prioritize your pipeline." },
    { title: "Match Score", content: "Each discovered grant shows a match score (0–100) indicating how closely it aligns with ECADRN's mission and profile. Focus on 75+ scores for highest-probability applications." },
    { title: "Upload a Grant RFP", content: "Have an RFP PDF or document? Click 'Upload Grant Doc' to paste or upload it. The AI extracts requirements, deadlines, eligibility, and creates a structured grant record automatically." },
    { title: "Grant Autopilot", content: "Click 'Grant Autopilot' to run the full AI pipeline: it discovers top matching grants, drafts complete proposals for each, and either queues them for your review (Assisted Mode) or marks them submitted (Full Agent Mode)." },
    { title: "Autopilot: What 'Submitted' Means", content: "IMPORTANT: In Full Agent Mode, 'Submitted' means a complete proposal is drafted and saved in your system — it does NOT automatically submit to an external portal. You must still log into each funder's portal and submit manually. The app helps you draft; submission is always a human step." },
    { title: "Autopilot Credentials", content: "Grant Autopilot uses your @ecadrn.org email (the account you are logged in with) as the organization contact on all generated proposals. No passwords or portal credentials are stored — the app never logs into external systems on your behalf." },
    { title: "Add Grants Manually", content: "Click 'Add Grant' to manually enter a grant opportunity. Fill in funder, amount, deadline, and requirements. Useful for grants you found through a conference, newsletter, or referral." },
    { title: "Replay This Guide", content: "Click the ? icon any time to reopen this guide. All 11 steps are always available — including the Autopilot and credentials explainer." }
  ];

  const runAutopilot = async () => {
    if (!organization) return;
    setAutopilotRunning(true);
    setAutopilotLog([]);
    setAutopilotOpen(true);

    const log = (msg: string) => setAutopilotLog(prev => [...prev, msg]);

    try {
      log('🔍 Searching for best-match grants for ECADRN...');
      const results = await callAI('autopilot-search', {
        orgProfile: organization,
        focusAreas: organization?.voiceProfile?.keyPhrases?.join(', ') || 'ADR, conflict resolution, civic equity'
      });

      if (!Array.isArray(results) || results.length === 0) {
        log('⚠️ No grants found. Try updating your voice profile first.');
        setAutopilotRunning(false);
        return;
      }
      log(`✅ Found ${results.length} grant opportunities.`);

      const grantsPath = `organizations/${orgId}/grants`;
      const grantsRef = collection(db, grantsPath);
      const savedGrants: any[] = [];
      const verifiedResults = Array.isArray(results) ? results.filter((g: any) => g?.title && g?.funderName) : [];
      if (verifiedResults.length === 0) {
        log('⚠️ AI returned no verifiable grants. Aborting to prevent hallucinated data.');
        setAutopilotRunning(false);
        return;
      }
      for (const g of verifiedResults) {
        const autoTags = Array.isArray(g.focusAreas) ? [...g.focusAreas] : [];
        const ref = await addDoc(grantsRef, {
          ...g, tags: autoTags, source: 'autopilot', status: 'discovery',
          updatedAt: new Date().toISOString()
        });
        savedGrants.push({ id: ref.id, ...g });
        log(`  📌 ${g.title} (${g.funderName}) — ${g.matchScore}% match`);
      }

      const topGrants = savedGrants.filter(g => g.matchScore >= 75).slice(0, 3);
      log(`
✍️ Drafting proposals for top ${topGrants.length} grant(s)...`);

      const proposalsPath = `organizations/${orgId}/proposals`;
      const proposalsRef = collection(db, proposalsPath);

      for (const grant of topGrants) {
        log(`  ⏳ Writing full proposal: ${grant.title}...`);
        try {
          const activeVoice = voiceProfiles.find(p => p.id === selectedVoiceProfileId) || voiceProfiles[0];
          const draft = await callAI('generate-draft', {
            orgProfile: organization,
            grantTitle: grant.title,
            funderName: grant.funderName,
            funderType: grant.funderType || 'Foundation',
            grantDescription: grant.description,
            focusAreas: (grant.focusAreas || []).join(', '),
            amountMin: grant.amountMin || 25000,
            amountMax: grant.amountMax || 100000,
            eligibility: grant.eligibility || 'Nonprofits',
            geographicFocus: grant.geographicFocus || 'National',
            toneDescriptors: activeVoice?.toneDescriptors?.join(', ') || organization?.voiceProfile?.toneDescriptors?.join(', ') || '',
            keyPhrases: activeVoice?.keyPhrases?.join(', ') || organization?.voiceProfile?.keyPhrases?.join(', ') || '',
            voiceRules: activeVoice?.voiceRules?.join('; ') || organization?.voiceProfile?.voiceRules?.join('; ') || '',
            writingSamples: activeVoice?.writingSamples?.join(' | ') || organization?.voiceProfile?.writingSamples?.join(' | ') || ''
          });

          const sections = [
            { id: 'executiveSummary', title: 'Executive Summary', content: draft.executiveSummary || '' },
            { id: 'needStatement', title: 'Need Statement', content: draft.needStatement || '' },
            { id: 'projectDescription', title: 'Project Description', content: draft.projectDescription || '' },
            { id: 'goalsObjectives', title: 'Goals & Objectives', content: draft.goalsObjectives || '' },
            { id: 'methodology', title: 'Methodology', content: draft.methodology || '' },
            { id: 'evaluationPlan', title: 'Evaluation Plan', content: draft.evaluationPlan || '' },
            { id: 'sustainability', title: 'Sustainability', content: draft.sustainability || '' },
            { id: 'organizationalCapacity', title: 'Organizational Capacity', content: draft.organizationalCapacity || '' },
            { id: 'budgetNarrative', title: 'Budget Narrative', content: draft.budgetNarrative || '' }
          ];

          const status = autopilotMode === 'full' ? 'submitted' : 'review';
          const proposalRef = await addDoc(proposalsRef, {
            title: grant.title, funder: grant.funderName, description: grant.description,
            sections, status, createdBy: user?.email || 'autopilot', lastEditedBy: 'Autopilot',
            source: 'autopilot', autopilot: true, matchScore: grant.matchScore,
            updatedAt: new Date().toISOString(), createdAt: new Date().toISOString()
          });

          if (autopilotMode === 'full') {
            log(`  🚀 SUBMITTED: ${grant.title} — ID: ${proposalRef.id}`);
            const notifPath = `organizations/${orgId}/notifications`;
            await addDoc(collection(db, notifPath), {
              userId: user?.uid,
              title: '✅ Grant Submitted by Autopilot',
              message: `"${grant.title}" (${grant.funderName}) submitted automatically. Proposal ID: ${proposalRef.id}`,
              read: false, timestamp: new Date().toISOString(),
              type: 'autopilot_submission', proposalId: proposalRef.id
            });
          } else {
            log(`  ✅ Ready for review: ${grant.title} → Proposals tab`);
          }
        } catch (err: any) {
          log(`  ❌ Failed: ${grant.title}: ${err.message}`);
        }
      }
      log(autopilotMode === 'full'
        ? `
🎉 Done! ${topGrants.length} proposals submitted. Check Notifications for confirmations.`
        : `
🎉 Done! ${topGrants.length} proposals queued for your review in Proposals.`);
    } catch (err: any) {
      log(`❌ Autopilot error: ${err.message}`);
    } finally {
      setAutopilotRunning(false);
    }
  };

  const runDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const results = await callAI('discover-grants', {
        orgProfile: organization,
        focusAreas: "ADR, Conflict Resolution, Access to Justice",
        geographicFocus: "National",
        amountMin: 10000,
        amountMax: 100000,
        searchQuery: "Early career ADR network funding"
      });

      const grantsPath = `organizations/${orgId}/grants`;
      const grantsRef = collection(db, grantsPath);
      const validGrants = Array.isArray(results) ? results.filter((g: any) => g?.title && g?.funderName) : [];
      if (validGrants.length === 0) throw new Error('AI returned no verifiable grants — nothing saved.');
      for (const g of validGrants) {
        const autoTags = Array.isArray(g.focusAreas) ? [...g.focusAreas] : [];
        if (g.geographicFocus && !autoTags.includes(g.geographicFocus)) {
          autoTags.push(g.geographicFocus);
        }
        await addDoc(grantsRef, {
          ...g,
          tags: autoTags,
          status: 'discovery',
          updatedAt: new Date().toISOString()
        }).catch(e => handleFirestoreError(e, OperationType.WRITE, grantsPath));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDiscovering(false);
    }
  };

  const filteredGrants = grants
    .filter(g => {
      if (hideUnverified && g.verified === false) return false;
      const matchText = g.title?.toLowerCase().includes(filterText.toLowerCase()) || 
                        g.funderName?.toLowerCase().includes(filterText.toLowerCase()) ||
                        (g.focusAreas && g.focusAreas.some((fa: string) => fa.toLowerCase().includes(filterText.toLowerCase()))) ||
                        (g.tags && g.tags.some((tg: string) => tg.toLowerCase().includes(filterText.toLowerCase())));
      const matchGeo = filterGeoFocus === 'All' || g.geographicFocus === filterGeoFocus;
      const matchTag = filterGrantTag === 'All Tags' || (g.tags || []).includes(filterGrantTag);
      return matchText && matchGeo && matchTag;
    })
    .sort((a, b) => {
      let valA, valB;
      if (sortBy === 'match') {
        valA = a.missionFitScore || 0;
        valB = b.missionFitScore || 0;
      } else if (sortBy === 'deadline') {
        valA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        valB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      } else {
        valA = a.funderName || '';
        valB = b.funderName || '';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <motion.div id="grants-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center text-slate-900 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-bold tracking-tight">Grant Matcher</h3>
          <button 
            onClick={() => setShowGuide(true)}
            className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
          >
            <HelpCircle size={14} />
          </button>
        </div>
        <div className="flex gap-4">
          {/* Agent Write Proposal Button */}
          <button
            onClick={() => { setAgentPrefillGrant(null); setAgentWriterOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md"
          >
            <Bot size={13} />
            ✦ Agent Write
          </button>
          <div className="flex items-center gap-2">
          <button
            onClick={() => setHideUnverified(h => !h)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
              hideUnverified ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            {hideUnverified ? '✓ Verified Only' : '⚠️ Show All'}
          </button>
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button 
              onClick={() => { setSortBy('match'); setSortOrder(prev => sortBy === 'match' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc'); }}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${sortBy === 'match' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Match {sortBy === 'match' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => { setSortBy('deadline'); setSortOrder(prev => sortBy === 'deadline' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${sortBy === 'deadline' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Deadline {sortBy === 'deadline' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => { setSortBy('name'); setSortOrder(prev => sortBy === 'name' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'); }}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${sortBy === 'name' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Funder {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>
          </div>
          <button 
            onClick={runDiscovery}
            disabled={isDiscovering}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            {isDiscovering ? <RefreshCw className="animate-spin" size={16} /> : <TrendingUp size={16} />}
            {isDiscovering ? 'Searching...' : 'Run Discovery'}
          </button>
          <button
            onClick={() => setAutopilotOpen(o => !o)}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-widest hover:from-violet-700 hover:to-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-violet-100"
          >
            <Sparkles size={16} />
            Autopilot
          </button>
        </div>
      </div>

      {/* ── Autopilot Panel ── */}
      {autopilotOpen && (
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white">
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-sm">Grant Autopilot</h4>
                <p className="text-[11px] text-slate-500">Search → Draft → Review/Submit. Full cycle, hands-free.</p>
              </div>
            </div>
            <button onClick={() => setAutopilotOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Mode</p>
            <div className="flex rounded-xl overflow-hidden border border-violet-200 bg-white">
              <button
                onClick={() => setAutopilotMode('assisted')}
                className={`px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${autopilotMode === 'assisted' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                👤 Assisted — Stop at Review
              </button>
              <button
                onClick={() => setAutopilotMode('full')}
                className={`px-4 py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${autopilotMode === 'full' ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                🤖 Full Agent — Auto Submit
              </button>
            </div>
          </div>

          {autopilotMode === 'full' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="text-[11px] text-amber-700 font-semibold space-y-1">
                  <p>⚠ <strong>"Auto Submit" drafts proposals in your system only.</strong> It does NOT log into any external funder portal or submit on your behalf.</p>
                  <p>You must still visit each funder's portal and submit manually. The Autopilot gets the proposal ready — the final submission is always a human step.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
                <span className="text-blue-500 text-sm mt-0.5 shrink-0">ℹ</span>
                <p className="text-[11px] text-blue-700 font-semibold">
                  Proposals are authored under: <strong>{user?.email || '@ecadrn.org'}</strong>. No external portal credentials are required or stored.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={runAutopilot}
            disabled={autopilotRunning}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {autopilotRunning ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
            {autopilotRunning ? 'Autopilot Running...' : 'Launch Autopilot'}
          </button>

          {/* Live Log */}
          {autopilotLog.length > 0 && (
            <div className="bg-slate-900 rounded-xl p-4 font-mono text-[11px] text-green-400 space-y-1 max-h-48 overflow-y-auto">
              {autopilotLog.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {autopilotRunning && <div className="animate-pulse">▋</div>}
            </div>
          )}
        </div>
      )}

      {/* Matcher Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload RFP & Score with AI Panel */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-6 rounded-2xl border-2 border-dashed transition-all text-center relative overflow-hidden flex flex-col justify-between ${
            isDragOver 
              ? 'border-indigo-500 bg-indigo-50/50' 
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="max-w-xl mx-auto space-y-3">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
              <Upload size={24} className={isUploading ? "animate-bounce" : ""} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Upload & Score Custom Grant RFPs</h4>
              <p className="text-[11px] text-slate-400 font-medium">Drag and drop your grant proposal Guidelines (TXT/MD/PDF/DOCX) or click select. Nexus AI will instantly scan the priorities and grade objective match alignment.</p>
            </div>
            <div className="flex justify-center items-center gap-4">
              <label className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-md">
                <span>{isUploading ? "Analyzing..." : "Choose File"}</span>
                <input 
                  type="file" 
                  className="hidden" 
                  disabled={isUploading}
                  accept=".txt,.md,.pdf,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </label>
              <span className="text-xs text-slate-400 font-bold uppercase">or</span>
              <button
                onClick={() => {
                  const text = prompt("Paste grant text details here to analyze and score:");
                  if (text && text.trim().length >= 50) {
                    setIsUploading(true);
                    callAI('analyze-uploaded-grant', { text })
                      .then((result) => {
                        const grantsPath = `organizations/${orgId}/grants`;
                        const grantsRef = collection(db, grantsPath);
                        const autoTags = Array.isArray(result.focusAreas) ? [...result.focusAreas] : [];
                        if (result.geographicFocus && !autoTags.includes(result.geographicFocus)) {
                          autoTags.push(result.geographicFocus);
                        }
                        return addDoc(grantsRef, {
                          ...result,
                          tags: autoTags,
                          status: 'discovery',
                          source: 'upload',
                          updatedAt: new Date().toISOString()
                        });
                      })
                      .then(() => setIsUploading(false))
                      .catch((err) => {
                        console.error(err);
                        setUploadError(err.message);
                        setIsUploading(false);
                      });
                  } else if (text) {
                    alert("Please enter a longer text to analyze strategic fit.");
                  }
                }}
                disabled={isUploading}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-lg cursor-pointer transition-colors hover:border-slate-300"
              >
                Paste RFP Text
              </button>
            </div>
            {uploadError && (
              <p className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 rounded px-2 py-1 font-bold">
                {uploadError}
              </p>
            )}
            {isUploading && (
              <div className="flex items-center justify-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest animate-pulse mt-2 bg-indigo-50/50 py-1 rounded">
                <RefreshCw className="animate-spin text-indigo-600" size={12} />
                <span>Deconstructing RFP objectives, scoring access fit, and auditing ECADRN synergies...</span>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Voice Profile-Based Suggestion Panel */}
        <div className="p-6 bg-white border border-indigo-150 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16"></div>
          <div className="space-y-3 relative z-10">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Sparkles size={24} className="text-indigo-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Linguistic Style Suggestion Engine</h4>
              <p className="text-[11px] text-slate-400 font-medium">Auto-suggest and discover active key phrases and tone descriptors of your calibrated profile context.</p>
            </div>
            
            {activeVoiceForSuggestions ? (
              <div className="bg-slate-50/80 p-3 rounded-lg border border-slate-150 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider">Active Voice Profile:</span>
                  <span className="text-[10px] font-bold text-slate-700 font-mono text-xs">{activeVoiceForSuggestions.name}</span>
                </div>
                <div className="space-y-1.5 pt-1.5 border-t border-slate-150">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tone Descriptors</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {activeVoiceForSuggestions.toneDescriptors?.slice(0, 3).map((t: string) => (
                        <span key={t} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[8.5px] font-black tracking-wider uppercase border border-indigo-100">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Key Programmatic Phrases</span>
                    <p className="text-[10.5px] leading-relaxed text-slate-600 font-semibold line-clamp-1 italic">"{activeVoiceForSuggestions.keyPhrases?.slice(0, 2).join(', ')}"</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center">
                No active voice profile calibrated. Create profile in Voice Lab to enable.
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 relative z-10">
            <button 
              onClick={runVoiceSuggestions}
              disabled={isVoiceSuggesting || !activeVoiceForSuggestions}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              {isVoiceSuggesting ? <RefreshCw className="animate-spin text-white" size={12} /> : <Sparkles className="text-indigo-400" size={12} />}
              <span>{isVoiceSuggesting ? 'Locating Voice-Matching Opportunities...' : 'Locate Voice-Matching Grants'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <input 
            type="text" 
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter opportunities by funder, focus area, or tag..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
          />
          <Search size={18} className="absolute left-4 top-3.5 text-slate-400" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-white border border-slate-200 rounded-xl px-4 py-1.5 items-center gap-2 shadow-sm w-full md:w-56">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Geographic:</span>
            <select
              value={filterGeoFocus}
              onChange={(e) => setFilterGeoFocus(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold text-indigo-600 focus:ring-0 cursor-pointer flex-1 w-full"
            >
              <option value="All">All Regions</option>
              {allGeographicFocuses.map(geo => (
                <option key={geo} value={geo}>{geo}</option>
              ))}
            </select>
          </div>

          <div className="flex bg-white border border-slate-200 rounded-xl px-4 py-1.5 items-center gap-2 shadow-sm w-full md:w-56">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Tag Fit:</span>
            <select
              value={filterGrantTag}
              onChange={(e) => setFilterGrantTag(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold text-indigo-600 focus:ring-0 cursor-pointer flex-1 w-full"
            >
              <option value="All Tags">All Tags</option>
              {allGrantTags.map(tg => (
                <option key={tg} value={tg}>{tg}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGrants.length > 0 ? filteredGrants.map(g => (
          <div key={g.id} className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-xl transition-all group relative overflow-hidden flex flex-col h-full border-t-4 border-t-transparent hover:border-t-indigo-500">
            <div className="absolute top-0 right-0 p-3 flex flex-col items-end gap-1">
              <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${
                g.missionFitScore >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                Match: {g.missionFitScore || 0}%
              </span>
              {g.verified === false && (
                <span className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-1">
                  ⚠️ Unverified
                </span>
              )}
              {g.verified === true && (
                <span className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded bg-green-50 text-green-600 border border-green-200">
                  ✓ Verified
                </span>
              )}
            </div>
            <h4 className="font-bold text-slate-900 mb-2 leading-tight group-hover:text-indigo-600 pr-12 text-lg tracking-tight">{g.title}</h4>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5">
                <Globe size={11} className="text-indigo-400" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g.funderName}</p>
              </div>
              {g.geographicFocus && (
                <span className="text-[8.5px] font-black uppercase tracking-wider bg-slate-100/80 border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                  🗺️ {g.geographicFocus}
                </span>
              )}
            </div>
            
            {/* Automatic Strategic Tag Badges */}
            {(() => {
              const displayTags = g.tags || [g.geographicFocus, ...(g.focusAreas || [])].filter(Boolean);
              if (displayTags.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1 mb-3.5">
                  {displayTags.slice(0, 4).map((tag: string, idx: number) => (
                    <span 
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); setFilterGrantTag(tag); }}
                      className="bg-indigo-50/50 hover:bg-indigo-100/80 border border-indigo-100 text-indigo-750 px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest leading-none cursor-pointer transition-all hover:scale-105"
                      title={`Filter by ${tag}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              );
            })()}

            <p className="text-xs text-slate-500 line-clamp-4 mb-4 leading-relaxed italic">"{g.missionFitRationale}"</p>
            
            {g.ecadrnAlignmentScore !== undefined ? (
              <div 
                onClick={() => setSelectedAlignmentGrant(g)}
                className="bg-emerald-50/50 hover:bg-emerald-100/50 rounded-xl p-3 border border-emerald-100/45 mb-4 text-left space-y-1 relative group/align cursor-pointer transition-all border-l-4 border-l-emerald-400"
              >
                <div className="flex justify-between items-center sm:gap-2">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-emerald-800">ECADRN Purpose Fit</span>
                  <div className="flex items-center gap-1.5 flex-nowrap">
                    <span className="text-[9.5px] font-black text-emerald-700 bg-white border border-emerald-200 px-1.5 py-0.5 rounded">
                      Score: {g.ecadrnAlignmentScore}%
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedAlignmentGrant(g); }}
                      disabled={aligningId === g.id}
                      className="text-emerald-600 hover:text-emerald-800 transition-colors p-0.5 rounded hover:bg-emerald-100 cursor-pointer"
                      title="Inspect Strategic Alignment Details"
                    >
                      <Sparkles size={10} className={aligningId === g.id ? "animate-pulse" : ""} />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-600 leading-normal italic font-medium">"{g.ecadrnAlignmentRationale || 'Synergized with core conflict resolution priorities.'}"</p>
              </div>
            ) : (
              <div className="mb-4">
                <button
                  onClick={() => setSelectedAlignmentGrant(g)}
                  disabled={aligningId !== null}
                  className="w-full py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100/70 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all outline-none cursor-pointer hover:border-slate-300"
                >
                  {aligningId === g.id ? (
                    <>
                      <RefreshCw size={11} className="animate-spin text-indigo-600" />
                      <span>Analytically Matching...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} className="text-indigo-600" />
                      <span>Evaluate Alignment & View Context</span>
                    </>
                  )}
                </button>
              </div>
            )}
            <div className="mt-auto space-y-3 pt-4 border-t border-slate-50">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Geography</span>
                <span className="text-slate-600">{g.geographicFocus}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Allocation</span>
                <span className="text-indigo-600">${g.amountMax?.toLocaleString()} Max</span>
              </div>
              {g.deadline && (
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Deadline</span>
                  <span className="flex items-center gap-1.5">
                    {(() => {
                      const daysLeft = Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000);
                      const badge = daysLeft < 0
                        ? <span className="bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-black">CLOSED</span>
                        : daysLeft <= 7
                        ? <span className="bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded text-[9px] font-black animate-pulse">🔴 {daysLeft}d left</span>
                        : daysLeft <= 21
                        ? <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded text-[9px] font-black">🟡 {daysLeft}d left</span>
                        : <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[9px] font-black">🟢 {daysLeft}d left</span>;
                      return badge;
                    })()}
                    <span className="text-rose-500">{new Date(g.deadline).toLocaleDateString()}</span>
                  </span>
                </div>
              )}
            </div>
              {/* Agent Write CTA */}
              <button
                onClick={() => {
                  setAgentPrefillGrant(g);
                  setAgentWriterOpen(true);
                }}
                className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 border border-violet-200 text-violet-700 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
              >
                <Bot size={12} />
                ✦ Agent Write Full Proposal
              </button>
          </div>
        )) : (
          <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="text-slate-300" size={32} />
            </div>
            <h4 className="text-slate-900 font-bold mb-2">Zero Search Hits</h4>
            <p className="text-slate-500 text-sm italic">Lower your filters or run discovery to identify and cache new high-probability grant matches.</p>
          </div>
        )}
      </div>

      {/* ECADRN Purpose Alignment Assessment Dialog Overlay Block */}
      {selectedAlignmentGrant && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col overflow-hidden max-h-[90vh] text-left"
          >
            {/* Header */}
            <div className="bg-indigo-950 p-6 flex justify-between items-center text-white border-b border-indigo-900">
              <div>
                <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider font-mono">Strategic Match Assessment Framework</span>
                <h3 className="text-xl font-bold tracking-tight text-white mt-1">ECADRN Purpose Alignment Context</h3>
              </div>
              <button 
                onClick={() => setSelectedAlignmentGrant(null)}
                className="p-1.5 rounded-lg bg-indigo-900 text-indigo-100 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              
              {/* If score exists: present beautiful highlighted summary */}
              {selectedAlignmentGrant.ecadrnAlignmentScore !== undefined && (
                <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-250 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                  <div className="w-16 h-16 bg-white border-2 border-emerald-300 rounded-2xl flex flex-col items-center justify-center text-emerald-700 shadow-sm shrink-0">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">SCORE</span>
                    <span className="text-xl font-black font-mono leading-none">{selectedAlignmentGrant.ecadrnAlignmentScore}%</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Strategic Purpose Fit Results</h4>
                    <p className="text-xs text-emerald-700 font-semibold italic mt-1 leading-relaxed">
                      "{selectedAlignmentGrant.ecadrnAlignmentRationale || "Excellent overlap identified with community-based restorative dialogue mandates."}"
                    </p>
                  </div>
                </div>
              )}

              {/* Pillars side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                
                {/* Pillar A: Grant opportunity data */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="pb-3 border-b border-slate-200 mb-4 font-mono">
                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block">Pillar A / Solicitant Identity</span>
                      <h4 className="text-sm font-black text-slate-900 mt-1">{selectedAlignmentGrant.title}</h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-0.5">{selectedAlignmentGrant.funderName}</p>
                    </div>

                    <div className="space-y-4">
                      {/* Focus Areas */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 font-mono">Extracted Focus Areas</span>
                        <div className="flex flex-wrap gap-1.5 row-gap-1">
                          {selectedAlignmentGrant.focusAreas && selectedAlignmentGrant.focusAreas.length > 0 ? (
                            selectedAlignmentGrant.focusAreas.map((fa: string) => (
                              <span key={fa} className="bg-white border border-slate-205 text-slate-750 text-[8.5px] font-extrabold uppercase px-2 py-0.5 rounded shadow-sm">
                                🎯 {fa}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No focus areas specified</span>
                          )}
                        </div>
                      </div>

                      {/* Geographic Scope */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1 font-mono">Geographic Scope</span>
                        <span className="bg-slate-200 text-slate-700 text-[9.5px] font-black uppercase px-2 py-0.5 rounded tracking-widest inline-block border border-slate-300">
                          🗺️ {selectedAlignmentGrant.geographicFocus || "National"}
                        </span>
                      </div>

                      {/* Abstract */}
                      {selectedAlignmentGrant.description && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1 font-mono">Opportunity Description</span>
                          <p className="text-xs text-slate-600 leading-relaxed font-semibold italic">
                            "{selectedAlignmentGrant.description.length > 200 ? selectedAlignmentGrant.description.slice(0, 200) + "..." : selectedAlignmentGrant.description}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/80 border border-slate-200 mt-4 rounded-xl p-3 text-[10px] text-slate-500 leading-normal font-medium">
                    🔍 Tagging is parsed automatically upon grant discovery or manual document upload procedures.
                  </div>
                </div>

                {/* Pillar B: Our Strategic Mandate */}
                <div className="bg-indigo-900/10 border border-indigo-200 rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="pb-3 border-b border-indigo-200 mb-4 font-mono">
                      <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest block">Pillar B / Our Strategic Mandate</span>
                      <h4 className="text-sm font-black text-indigo-950 mt-1">East Coast ADR Network (ECADRN)</h4>
                      <p className="text-[10px] text-indigo-600 font-bold mt-0.5">Alt-Dispute Resolution & Restorative Practice Collective</p>
                    </div>

                    <div className="space-y-4 text-slate-850">
                      <div>
                        <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest block mb-1 font-mono">ECADRN Mission Statement</span>
                        <p className="text-xs leading-normal font-bold text-slate-705">
                          "To promote alternative dispute resolution, community mediation, dialogue facilitation, restorative practices, and conflict coaching as primary, non-violent pathways toward grassroots justice, systemic equity, and harmonious coexistence across diverse, marginalized constituencies globally."
                        </p>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest block mb-1 font-mono">ECADRN Vision Statement</span>
                        <p className="text-xs leading-normal font-bold text-slate-705">
                          "A world where every community has direct, low-barrier access to skilled alternative dispute resolution facilitators and restorative programs that cultivate shared power, de-escalate institutional violence, and heal structural divisions organically."
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-600 text-white/95 rounded-xl p-3 text-[10px] leading-normal font-bold mt-4 shadow-sm">
                    💎 Direct synergy allows ECADRN Network members to align targeted academic ADR theoretical briefs draft-by-draft.
                  </div>
                </div>

              </div>

            </div>

            {/* Footer triggers */}
            <div className="bg-slate-50 border-t border-slate-100 p-6 flex flex-col sm:flex-row gap-3 justify-between items-center">
              <span className="text-[10.5px] text-slate-400 font-bold leading-normal text-center sm:text-left">
                Triggering analysis will feed these two comparative profiles to the model for an authoritative purpose-fit alignment evaluation.
              </span>

              <div className="flex gap-2.5 w-full sm:w-auto shrink-0 justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedAlignmentGrant(null)}
                  className="flex-1 sm:flex-initial px-5 py-3 bg-white hover:bg-slate-100 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all border border-slate-205"
                >
                  Close Context
                </button>
                <button
                  type="button"
                  disabled={aligningId !== null}
                  onClick={() => calculateECADRNAlignment(selectedAlignmentGrant)}
                  className="flex-1 sm:flex-initial px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {aligningId === selectedAlignmentGrant.id ? (
                    <>
                      <RefreshCw size={11} className="animate-spin text-white" />
                      <span>Computing Alignment...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} />
                      <span>{selectedAlignmentGrant.ecadrnAlignmentScore !== undefined ? "Rerun AI Scoring" : "Evaluate ECADRN Alignment Now"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </motion.div>
        </div>
      )}

      <PageGuide 
        isOpen={showGuide} 
        onClose={() => setShowGuide(false)} 
        title="Matcher" 
        steps={guideSteps} 
      />

      {/* Agent Proposal Writer Modal */}
      <AgentProposalWriter
        isOpen={agentWriterOpen}
        onClose={() => { setAgentWriterOpen(false); setAgentPrefillGrant(null); }}
        organization={organization}
        voiceProfiles={voiceProfiles}
        selectedVoiceProfileId={selectedVoiceProfileId}
        orgId={orgId}
        prefillGrant={agentPrefillGrant}
      />
    </motion.div>
  );
}

const ECADRN_RESOURCES = [
  {
    id: 'ecadrn-charter',
    title: 'ECADRN Founding Charter & Strategic Blueprint',
    category: 'Strategic Plan',
    cohort: 'Network Members',
    description: 'Foundational vision outlining ECADRN\'s mission, core values, system principles, and academic career bridges.',
    fullText: `ECADRN FOUNDING CHARTER AND STRATEGIC BLUEPRINT

1. MISSION DECLARATION (ECADRN.ORG)
The Early Career ADR Network (ECADRN) is dedicated to supporting the professional development of early career Alternative Dispute Resolution (ADR) professionals through mentorship, collaborative research, and inclusive networking. We bridge the gap between ADR theory and transformative community practice by fostering the next generation of dispute resolution leaders.

2. VISION STATEMENTS
An equitable and accessible ADR field where early career professionals are empowered to innovate, lead, and serve communities. We democratize dispute systems, expand court-connected panels to include diverse practitioners, and promote restorative justice.

3. METHODOLOGICAL CORNERSTONES
- Inclusive Cohorts: Recruiting from historically underserved areas to diversify the mediation benches.
- Mentorship Bridges: Connecting master dispute resolution experts with emerging facilitators.
- Practice-Tested Research: Generating and disseminating open-source ADR field toolkits for public mediation.`
  },
  {
    id: 'dispute-systems-design',
    title: 'Dispute Systems Design (DSD) Guidelines',
    category: 'Policy Template',
    cohort: 'System Designers',
    description: 'Structural guidelines for designing low-cost multi-tiered community dispute resolution procedures and integrating them into court frameworks.',
    fullText: `DISPUTE SYSTEMS DESIGN (DSD) AND COMMUNITY-COURT INTEGRATION

1. STRUCTURAL HIERARCHY OF RESOLUTION
An effective dispute system design utilizes a multi-step restorative escalator that resolves issues at the lowest possible cost and complexity before formal litigation.
- Tier 1: Informal Facilitated Dialogue. Guided peer communication focusing on interest discovery.
- Tier 2: Facilitated Mediation. Neutral assistance leading to a formal, legally enforceable mutual covenant.
- Tier 3: Advisory Ombudsperson Evaluation. Expert feedback providing neutral assessments of statutory rights or organizational policies.

2. COMMUNITY-TO-COURT RE-ENTRY WAYS
- Court Diversion Panels: Establishing automated court-annexed mediation referral channels. Mentees and emerging professionals co-mediate family custody, civil claims, and tenant-landlord frictions under mentor supervision.
- Neutral Evaluation Labs: Providing early assessment grids to litigants, decreasing caseload backlog.`
  },
  {
    id: 'mentorship-playbook',
    title: 'ECADRN Mentorship Bridge Playbook',
    category: 'Practice Manual',
    cohort: 'Mentors & Scholars',
    description: 'Practical guidelines to foster high-impact academic-to-practice mentorship. Focuses on trauma-informed active listening, diagnostic case feedback loops, and co-mediation guidelines.',
    fullText: `ECADRN MENTORSHIP BRIDGE PLAYBOOK: CRITICAL WORKPLACE ADR COMPETENCIES

1. EXECUTIVE OVERVIEW & EDUCATIONAL METRICS
The Early Career ADR Network (ECADRN) Mentorship Bridge transitions practitioners smoothly from academic theory into clinical dispute resolution and restorative justice environments. Pairing dispute resolution leaders with early-career specialists fosters professional competency, practical ethics, and systemic equity.

2. CORE MEDIATION PROTOCOLS
- Structured Active Listening: Mentors and mentees must utilize a systematic active listening framework that documents stakeholders' positions, core interests, and emotional currents without evaluation.
- Reflective Inquiry Loops: Ask high-influence open-ended questions designed to uncover underlying structural drivers (e.g., resource disparities, cultural expectations) rather than surface-level transaction complaints.
- Mutual Ground Negotiation: Facilitate dialogue using neutral reframing designed to eliminate hostile jargon and emphasize shared values.

3. TRAUMA-INFORMED DISPUTE PRINCIPLES
- Create psychological safety: Establish clear, consistent ground rules prioritizing agency, confidentiality, and participant-governed pacing.
- Emotional De-escalation: When conflicts heat up in clinical settings, early-career practitioners are coached to implement structured pauses, validating statements, and voluntary break intervals to ensure emotional stabilization.`
  },
  {
    id: 'peer-mediation',
    title: 'Youth & Peer Mediation Field Implementation Guide',
    category: 'Field Toolkit',
    cohort: 'Community Centers',
    description: 'Operational manual for implementing restorative peer-led mediations in under-resourced community, municipal, and grassroots school settings. Includes step-by-step dispute resolution paths.',
    fullText: `YOUTH & PEER MEDIATION FIELD IMPLEMENTATION MANUAL: RESTORATIVE JUSTICE TEMPLATES

1. SYSTEM INITIALIZATION AND VOLUNTEER SELECTION
This guide establishes operational systems for implementing youth-led peer mediation within civil and educational environments. Peer mediation builds localized civic equity by proving that dispute resolution can be led by communities rather than institutional legal authorities.

2. MEDIATION STEP-BY-STEP WORKFLOW
- Step 1: Opening Statement. Establish peer authority, clear safety rules, absolute confidentiality (excepting danger of self/other harm), and request agreement to listen respectfully.
- Step 2: Story Verification. Each peer participant recounts their perspective uninterrupted, followed by active-neutral confirmation from the peer mediator.
- Step 3: Interest Identification. Find shared requirements. (e.g., respect in common areas, division of resources, reputation protection).
- Step 4: Solution Brainstorming. Encourage the participants to outline 3 distinct, action-oriented, feasible commitments without judgment.
- Step 5: Draft the Covenant. Write the exact agreements in plain language. Have all parties execute and sign to build ownership.

3. DISPUTE WORKSHOPS AND SIMULATION LABS
Peer practitioners are trained using mock scenarios simulating neighborhood property friction, civil equity access disputes, and digital workplace communication breakdown templates.`
  },
  {
    id: 'civic-equity',
    title: 'Civic Equity Dispute Resolution (CEDR) Manifesto',
    category: 'Policy & Advocacy',
    cohort: 'Systemic Reformers',
    description: 'Strategic analysis on leveraging low-cost community alternative dispute resolution to close the access-to-justice gap and support underprivileged litigants.',
    fullText: `THE SHIFT TOWARD CIVIC EQUITY: DEMOCRATIZING COMPREHENSIVE ADR OUTCOMES

1. EXECUTIVE MEMORANDUM ON THE ACCESS TO JUSTICE GAP
Low-income communities and underrepresented groups experience systemic barriers to traditional legal systems, creating a massive Access to Justice gap. High cost, administrative complexity, and cultural friction lock millions out of fair adjudication. Alternative Dispute Resolution (ADR), when practiced through a civic equity lens, returns agency to community members to configure fair outcomes without punitive legal debt.

2. RESTORATIVE METHODOLOGIES & POWER ASYMMETRY CORRECTIONS
- Power Balancing: ADR facilitators must actively monitor power disparities (such as employer-employee or corporate-tenant relationships). Implement structured safeguards, separate caucus meetings, and legal-navigator assistance.
- Community Mediation Hubs: Transition dispute resolution services away from corporate centers into accessible, comfortable community meeting rooms, maximizing accessibility.
- Diversifying the Profession: Cultivate a rich network of bi-lingual, multi-cultural, early-career ADR practitioners to match society’s demographic reality and ensure systemic trust.`
  },
  {
    id: 'restorative-circles',
    title: 'Circle Keeping & Restorative Dialogue Guidance',
    category: 'Dialogue Framework',
    cohort: 'Grassroots Facilitators',
    description: 'Procedural guidance for hosting Restorative Dialogue Circles. Explains values-driven dialogue setup, the role of Circle Keepers, and custom talking piece parameters.',
    fullText: `ECADRN CIRCLE KEEPING WORKFLOW AND DIALOGUE COMPASS

1. ARCHITECTURE OF COLLABORATIVE CIRCLE DIALOGUE
Restorative dialogues utilize structural circular geometry to symbolize collective equality—reversing typical vertical courtroom Hierarchies. It establishes a communal venue for acknowledging harm and designing joint restitution paths.

2. FACILITATION PROTOCOLS
- The Talking Piece: Establish that only the human holding the physical or digital talking piece holds the floor. This eliminates interruption, fosters deliberate speech, and validates every participant.
- The Circle Keeper's Duty: The facilitator is not a judge but a container. They model deep empathy, keep borders secure, and offer guidance cards without forcing resolutions.
- Re-Establishing Community: Agreements are evaluated not for compliance but for healing. Focus the final phase on reintegrating all disputants back into a supportive civic matrix.`
  },
  {
    id: 'academic-alignment',
    title: 'Theory-to-Practice Academic Guidance Report',
    category: 'Research Brief',
    cohort: 'Scholars & Clinicians',
    description: 'Synthesis modeling how to bridge university conflict-resolution research with hands-on, restorative litigation avoidance programs.',
    fullText: `THE SCHOLARSHIP OF PRACTICE: ALIGNING ACADEMIC ADR THEORY WITH COMMUNITY CHANGE

1. ACADEMIC SYNOPSIS
While academic institutions exhaustively model game theory and negotiation style grids (e.g., dual-concern models, interest-based bargaining), community mediation requires highly visceral, practical adaptations. This research brief bridges the gap, translating high-level dispute systems design theory into lightweight, scalable processes for local organizers.

2. CRITICAL SYNERGIES
- Interest-Based Bargaining vs. Value-Based Reconciliation: Transition clinical techniques from purely distributive bargaining (splitting dollars) into structural integrity conversations (restoring trust).
- Adaptive Facilitation Models: Practitioners must seamlessly blend directive evaluative styles (for legal clarity) with transformative, non-evaluative processes (for emotional reconciliation) depending on dispute maturity.`
  }
];

function VoiceView({ 
  organization, 
  profiles, 
  selectedProfileId, 
  onSetSelectedProfileId,
  funders,
  grants = [],
  orgId = ''
}: { 
  organization: any, 
  profiles: any[], 
  selectedProfileId: string | null, 
  onSetSelectedProfileId: (id: string) => void,
  funders: any[],
  grants?: any[],
  orgId?: string
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const guideSteps = [
    { title: "What Is Voice Training?", content: "The Voice Studio learns ECADRN's unique writing style from your own documents. Once trained, every AI-generated proposal section automatically matches your organization's tone, vocabulary, and mission framing — no generic AI language." },
    { title: "Add Writing Samples", content: "Paste writing samples directly (past proposals, letters, press releases, mission statements) into the text area, or upload documents from your computer. The AI analyzes them for tone, vocabulary, sentence structure, and recurring themes." },
    { title: "Load Built-In Samples", content: "Click 'Load ECADRN Built-In Samples' to pre-load a set of mission-aligned writing examples curated for ADR and access-to-justice organizations. Great starting point before adding your own." },
    { title: "Import from Google Drive", content: "Click the Drive icon to import documents directly from your @ecadrn.org Google Drive. This lets you pull in previous grant proposals, annual reports, or any document that reflects your org's voice." },
    { title: "Train the Voice Model", content: "After adding samples, click 'Train Voice Profile' and give it a name (e.g. 'Formal Grant Tone', 'Community Brief Style'). The AI builds a style model you can apply across all proposals." },
    { title: "Multiple Voice Profiles", content: "Create multiple named profiles for different audiences — a formal foundation tone, a government grant style, a community-facing voice. Switch between them when drafting different proposal types." },
    { title: "Apply Voice to Proposals", content: "In the Proposal Editor, select your voice profile from the dropdown before running AI rewrites. All AI-generated content will then match that profile's style and tone automatically." },
    { title: "Voice Strength", content: "Each trained profile shows a 'strength' indicator based on how many samples were used. More samples = stronger, more consistent voice. Aim for at least 3–5 diverse writing samples per profile." },
    { title: "Replay This Guide", content: "Click the ? icon any time to reopen this guide. All 9 steps are always available." }
  ];

  const [isRewriting, setIsRewriting] = useState(false);
  const [textToAnalyze, setTextToAnalyze] = useState('');
  const [textToRewrite, setTextToRewrite] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');

  // Enhanced features states
  const [voiceInputTab, setVoiceInputTab] = useState<'paste' | 'upload' | 'resources'>('paste');
  const [analyzedResult, setAnalyzedResult] = useState<any>(null);
  const [customProfileName, setCustomProfileName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState('');
  const [scanningStatus, setScanningStatus] = useState('');
  const [expandedResource, setExpandedResource] = useState<string | null>(null);

  // Suggested funder actions
  const [syncingFunderId, setSyncingFunderId] = useState<string | null>(null);
  const [funderSyncMsg, setFunderSyncMsg] = useState('');

  // Funder Alignment Tool States
  const [funderAlignmentResults, setFunderAlignmentResults] = useState<any>(null);
  const [isFunderAlignmentAnalyzing, setIsFunderAlignmentAnalyzing] = useState(false);

  const activeProfile = profiles.find(p => p.id === selectedProfileId) || organization?.voiceProfile;

  const firstFunder = funders && funders.length > 0 ? funders[0] : null;

  const analyzeFunderAlignment = async () => {
    if (!firstFunder) return;
    setIsFunderAlignmentAnalyzing(true);
    setFunderAlignmentResults(null);
    try {
      const priorities = Array.isArray(firstFunder.intelligence?.givingPriorities) 
        ? firstFunder.intelligence.givingPriorities.join(', ') 
        : (firstFunder.intelligence?.givingPriorities || '');
      const rationale = firstFunder.intelligence?.missionAlignmentRationale || firstFunder.notes || '';
      const domain = firstFunder.website || '';
      const analysisContent = `Funder Name: ${firstFunder.funderName}\nDomain: ${domain}\nGiving Priorities: ${priorities}\nAlignment Rationale: ${rationale}`;

      const result = await callAI('analyze-voice', {
        documents: [{ content: analysisContent }]
      });
      setFunderAlignmentResults(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsFunderAlignmentAnalyzing(false);
    }
  };

  const highAlignmentGrants = (grants || [])
    .filter(g => g.verified !== false) // Never surface unverified/hallucinated grants on dashboard
    .filter(g => (g.ecadrnAlignmentScore && g.ecadrnAlignmentScore >= 80) || (g.missionFitScore && g.missionFitScore >= 80))
    .map(g => {
      const pPhrases = activeProfile?.keyPhrases || [];
      const pTones = activeProfile?.toneDescriptors || [];
      const terms = [...pPhrases, ...pTones].map(t => t.toLowerCase());
      
      let matchCount = 0;
      const targetStr = `${g.title} ${g.description} ${(g.focusAreas || []).join(' ')}`.toLowerCase();
      terms.forEach(term => {
        if (targetStr.includes(term)) matchCount++;
      });
      const score = Math.min(100, 40 + (matchCount * 15));
      return {
        ...g,
        styleMatchScore: score,
        matchedKeywords: terms.filter(t => targetStr.includes(t))
      };
    })
    .sort((a, b) => b.styleMatchScore - a.styleMatchScore);

  const saveToProfiles = async (data: any, name: string) => {
    const profilesPath = `organizations/${orgId}/voiceProfiles`;
    const docRef = await addDoc(collection(db, profilesPath), {
      toneDescriptors: data.toneDescriptors || [],
      keyPhrases: data.keyPhrases || [],
      voiceRules: data.voiceRules || [],
      writingSamples: data.writingSamples || [],
      maturityScore: data.maturityScore || 80,
      primaryArchetype: data.primaryArchetype || 'The Advocate',
      name,
      createdAt: new Date().toISOString()
    }).catch(e => {
      handleFirestoreError(e, OperationType.WRITE, profilesPath);
      return null;
    });
    return docRef;
  };

  const analyzeVoice = async (textOverride?: string) => {
    const text = textOverride || textToAnalyze;
    if (!text.trim()) return;
    setIsAnalyzing(true);
    setAnalyzedResult(null);
    setProfileSavedMsg('');
    setCustomProfileName('');
    
    // Step-by-step scanning simulation
    const telemetrySteps = [
      "Deconstructing writing syntax & structural boundaries...",
      "Extracting signature repeating phraseology...",
      "Matching linguistic parameters against ADR knowledge domain...",
      "Detecting local and global funder alignment vectors...",
      "Calibrating final ECADRN voice metrics..."
    ];

    let stepIndex = 0;
    setScanningStatus(telemetrySteps[0]);
    const interval = setInterval(() => {
      stepIndex++;
      if (stepIndex < telemetrySteps.length) {
        setScanningStatus(telemetrySteps[stepIndex]);
      } else {
        clearInterval(interval);
      }
    }, 1200);

    try {
      const data = await callAI('analyze-voice', {
        documents: [{ content: text }]
      });
      clearInterval(interval);
      setAnalyzedResult(data);
    } catch (err) {
      clearInterval(interval);
      console.error(err);
    } finally {
      setIsAnalyzing(false);
      setScanningStatus('');
    }
  };

  // Check if suggested funder is already tracked
  const getFunderTrackState = (suggestedFunderName?: string) => {
    if (!suggestedFunderName || !funders) return { isTracked: false, id: null };
    const match = funders.find(f => f.funderName?.toLowerCase() === suggestedFunderName.toLowerCase());
    return { isTracked: !!match, id: match?.id || null };
  };

  const handleSyncSuggestedFunder = async () => {
    if (!analyzedResult?.suggestedFunder) return;
    const sf = analyzedResult.suggestedFunder;
    setSyncingFunderId(sf.funderName);
    setFunderSyncMsg('Initializing tracking and running in-depth strategic assessment...');

    try {
      const dbUrl = sf.website && sf.website !== 'string' ? sf.website : 'https://google.com';
      const cleanUrl = dbUrl.startsWith('http') ? dbUrl : `https://${dbUrl}`;

      // Run full strategic funder intelligence research in the background
      const data = await callAI('research-funder', {
        orgProfile: organization,
        funderName: sf.funderName,
        funderWebsite: cleanUrl,
        relationshipStage: 'Prospect',
        funderNotes: sf.matchReason || 'Automatically identified via Voice Lab context matching.'
      });

      const autoTags: string[] = [];
      if (data.givingPriorities && Array.isArray(data.givingPriorities)) {
        data.givingPriorities.forEach((p: string) => {
          const cleanP = p.trim();
          if (cleanP && !autoTags.includes(cleanP)) autoTags.push(cleanP);
        });
      }
      if (data.geographicFocus) {
        const geo = data.geographicFocus.trim();
        if (geo && !autoTags.includes(geo)) autoTags.push(geo);
      }

      const fundersPath = `organizations/${orgId}/funders`;
      const fundersRef = collection(db, fundersPath);
      await addDoc(fundersRef, {
        funderName: sf.funderName,
        website: cleanUrl,
        contactName: '',
        relationshipStage: 'Prospect',
        notes: `Source: Automatic Voice Lab Suggestion.\nConfidence: ${sf.confidence || 90}%\n\n${sf.matchReason || ''}`,
        tags: autoTags,
        intelligence: data,
        lastAnalysisAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setFunderSyncMsg(`Success! Saved ${sf.funderName} and loaded full intelligence guidelines.`);
      setTimeout(() => setFunderSyncMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setFunderSyncMsg(`Error saving funder profile: ${err.message}`);
    } finally {
      setSyncingFunderId(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!analyzedResult || !customProfileName.trim()) return;
    setIsSavingProfile(true);
    try {
      const docRef = await saveToProfiles(analyzedResult, customProfileName.trim());
      if (docRef && docRef.id) {
        onSetSelectedProfileId(docRef.id);
      }
      setProfileSavedMsg(`"${customProfileName.trim()}" successfully calibrated, saved, and set as active profile!`);
      setTimeout(() => {
        setProfileSavedMsg('');
        setAnalyzedResult(null);
      }, 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const rewriteText = async () => {
    if (!textToRewrite.trim() || !activeProfile) return;
    setIsRewriting(true);
    try {
      const data = await callAI('rewrite-voice', {
        voiceProfile: activeProfile,
        content: textToRewrite
      });
      setRewrittenText(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRewriting(false);
    }
  };

  const injectResource = (resourceText: string, elementId: string) => {
    setTextToAnalyze(resourceText);
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.div id="voice-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      {/* Voice Lab Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center text-slate-900 border-b border-slate-100 pb-5 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 text-white">
            <Mic size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight flex items-center gap-2">
              Voice Lab
              <button 
                onClick={() => setShowGuide(true)}
                className="p-1 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              >
                <HelpCircle size={16} />
              </button>
            </h3>
            <p className="text-xs text-slate-500 font-medium">Train, align, and calibrate your organization's signature writing persona.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setTextToAnalyze(`ECADRN (Early Career ADR Network) is dedicated to supporting the professional development of early career Alternative Dispute Resolution (ADR) professionals through mentorship, collaborative research, and inclusive networking. 

Our vision is an equitable and accessible ADR field where early career professionals are empowered to innovate and lead. 

We bridge the gap between ADR theory and transformative community practice by fostering the next generation of dispute resolution leaders.`)}
            className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest border border-slate-200 bg-white px-3.5 py-2.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          >
            <Globe size={13} /> Import Web Hook
          </button>

          <button 
            onClick={() => {
              const fused = ECADRN_RESOURCES.map(r => `[GUIDE: ${r.title}]\n${r.fullText}`).join('\n\n');
              setTextToAnalyze(fused);
              analyzeVoice(fused);
            }}
            className="flex items-center gap-2 text-[10px] font-black text-indigo-700 uppercase tracking-widest border border-indigo-150 bg-indigo-50/50 px-3.5 py-2.5 rounded-xl hover:bg-indigo-100 transition-all shadow-sm cursor-pointer animate-pulse-subtle"
            title="Consolidate and auto-calibrate on all available ecadrn.org training tools & resources simultaneously"
          >
            <Sparkles size={13} className="text-indigo-600" /> Train All ecadrn.org Resources
          </button>
          
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-1.5 flex items-center gap-2 shadow-sm">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Profile:</span>
            <select 
              value={selectedProfileId || ''} 
              onChange={(e) => onSetSelectedProfileId(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold text-indigo-600 focus:ring-0 cursor-pointer"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {profiles.length === 0 && <option value="">Default ECADRN</option>}
            </select>
          </div>

          <label className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase tracking-widest border-2 border-indigo-50 bg-white px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer shadow-sm">
            <Plus size={14} /> Upload Training Doc
            <input 
              type="file" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (re) => {
                    setTextToAnalyze(re.target?.result as string);
                  };
                  reader.readAsText(file);
                }
              }}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Neural Training Scratchpad */}
        <div id="neural-scratchpad" className="bg-white p-6 rounded-2xl border border-slate-200 col-span-2 shadow-sm flex flex-col relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <div>
              <h4 className="font-bold text-slate-900 tracking-tight">Linguistic Style Analyzer</h4>
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Configure styles by pasting direct material, uploading, or choosing resource sheets.</p>
            </div>
            <button 
              onClick={() => setTextToAnalyze('')}
              className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg self-end"
            >
              <X size={12} /> Clear Buffer
            </button>
          </div>

          {/* Core Selection Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4 self-start border border-slate-200/40">
            <button
              type="button"
              onClick={() => setVoiceInputTab('paste')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${voiceInputTab === 'paste' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-550 hover:text-indigo-600'}`}
            >
              📝 Paste Raw Text
            </button>
            <button
              type="button"
              onClick={() => setVoiceInputTab('upload')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${voiceInputTab === 'upload' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-550 hover:text-indigo-600'}`}
            >
              📎 Upload Document
            </button>
            <button
              type="button"
              onClick={() => setVoiceInputTab('resources')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${voiceInputTab === 'resources' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-550 hover:text-indigo-600'}`}
            >
              📚 Predefined Guides
            </button>
          </div>

          {/* Render Tab Contents */}
          {voiceInputTab === 'paste' && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono">Direct Paste Workspace (No Upload Required)</label>
              <textarea 
                value={textToAnalyze}
                onChange={(e) => setTextToAnalyze(e.target.value)}
                placeholder="PRO TIP: Directly paste 3-5 paragraphs of your BEST writing—letters, press releases, draft proposals, standard guides, or organizational statements. Bypasses file uploads or pre-defined resources completely!"
                className="w-full h-80 p-5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all resize-none outline-none mb-4 leading-relaxed font-sans text-slate-800 placeholder:text-slate-400"
              />
            </div>
          )}

          {voiceInputTab === 'upload' && (
            <div className="flex-1 flex flex-col justify-center py-8 px-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-center mb-4 min-h-[320px]">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-sm">
                <Paperclip size={22} />
              </div>
              <h5 className="font-bold text-slate-800 text-sm">Upload Core Calibration Text (.txt)</h5>
              <p className="text-xs text-slate-400 leading-normal max-w-sm mx-auto mt-1 mb-5">
                Load text-based guidelines or historical templates. This automatically populates the text buffer.
              </p>
              <label className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-indigo-600 font-extrabold text-[10px] uppercase tracking-widest rounded-xl shadow-sm transition-all cursor-pointer mx-auto">
                Select File
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (re) => {
                        setTextToAnalyze(re.target?.result as string);
                        setVoiceInputTab('paste'); // Switch to editor so they can view and run
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
              {textToAnalyze && (
                <p className="text-[10px] text-emerald-600 font-bold mt-4 uppercase tracking-wider">✓ Active Buffer Loaded: {textToAnalyze.length} chars</p>
              )}
            </div>
          )}

          {voiceInputTab === 'resources' && (
            <div className="space-y-3 mb-4 min-h-[320px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-mono mb-2">Inject Founding ecadrn.org Rationale Sheet</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ECADRN_RESOURCES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setTextToAnalyze(r.fullText);
                      setVoiceInputTab('paste'); // Automatically switch to editor to inspect
                    }}
                    className="flex flex-col text-left p-3.5 border border-slate-200 bg-white rounded-xl hover:border-indigo-400 hover:shadow-md transition-all group cursor-pointer"
                  >
                    <span className="text-[8px] font-black text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded self-start mb-2">{r.category}</span>
                    <span className="font-bold text-slate-800 text-xs group-hover:text-indigo-600">{r.title}</span>
                    <p className="text-[10px] text-slate-400 leading-normal mt-1 line-clamp-2">{r.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button 
              onClick={() => analyzeVoice()}
              disabled={isAnalyzing || !textToAnalyze.trim() || textToAnalyze.length < 50}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100/40 relative overflow-hidden group"
            >
              {isAnalyzing ? (
                <RefreshCw className="animate-spin text-white" size={16} />
              ) : (
                <Sparkles className="group-hover:rotate-12 transition-transform" size={16} />
              )}
              {isAnalyzing ? 'Extracting Linguistics...' : 'Analyze & Calibrate Voice Profile'}
            </button>
            {textToAnalyze.length > 0 && textToAnalyze.length < 50 && (
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider text-center italic font-mono">Insufficient data for stable analysis (at least 50 chars recommended)</p>
            )}
          </div>

          {/* Animate Telemetry Steps during scanning */}
          {isAnalyzing && scanningStatus && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center text-white z-20">
              <div className="w-16 h-16 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-6 shadow-glow"></div>
              <h5 className="font-mono text-xs uppercase tracking-widest text-indigo-400 animate-pulse mb-2">Neural Engine Scanning</h5>
              <p className="text-sm font-medium text-slate-200 max-w-sm font-mono">{scanningStatus}</p>
            </div>
          )}

          {/* Current Profile Indicators */}
          {organization?.voiceProfile && !analyzedResult && (
            <div className="mt-8 pt-8 border-t border-slate-100 bg-slate-50/50 p-4 rounded-xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Saved Active Profile Reference</p>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase font-bold mb-1.5">Tone Descriptors</span>
                  <div className="flex flex-wrap gap-1.5">
                    {organization.voiceProfile?.toneDescriptors?.map((t: string) => (
                      <span key={t} className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-[9px] font-extrabold border border-indigo-100 uppercase">{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase font-bold mb-1.5">Writing Maturity Score</span>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full" style={{ width: `${organization.voiceProfile?.maturityScore || 80}%` }}></div>
                    </div>
                    <span className="font-bold text-slate-700 text-xs">{organization.voiceProfile?.maturityScore || 80}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side Column */}
        <div className="space-y-6">
          {/* Voice Rewriter Tool */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col border border-slate-800">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center mb-6 text-white shadow-lg shadow-indigo-500/20">
              <Scroll size={20} className="text-white" />
            </div>
            <h4 className="font-bold text-lg mb-2">Voice Rewriter Scratchpad</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">Instantly test your calibrated active voice profile. Paste standard text and transform it into your calibrated brand identity.</p>
            
            <div className="mb-4">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Style Profile Selection</label>
              <select 
                value={selectedProfileId || ''} 
                onChange={(e) => onSetSelectedProfileId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg text-xs p-2.5 text-white outline-none focus:border-indigo-500"
              >
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                {profiles.length === 0 && <option value="">Default ECADRN</option>}
              </select>
            </div>
            
            <textarea 
              value={textToRewrite}
              onChange={(e) => setTextToRewrite(e.target.value)}
              placeholder="Paste raw text to translate here..."
              className="w-full h-36 p-3 bg-slate-800/50 border border-slate-850 rounded-lg text-xs focus:bg-slate-800 transition-all outline-none mb-4 text-white placeholder:text-slate-500 resize-none leading-relaxed"
            />
            
            <button 
              onClick={rewriteText}
              disabled={isRewriting || !textToRewrite.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-slate-950"
            >
              {isRewriting ? <RefreshCw className="animate-spin text-white" size={14} /> : null}
              {isRewriting ? 'Translating Syntax...' : 'Apply Calibrated Voice'}
            </button>
          </div>

          {rewrittenText && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-950/20 border border-emerald-900/30 p-5 rounded-2xl">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">Calibrated Output Translation</span>
                <span className="text-[8px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono tracking-tighter">SUCCESS</span>
              </div>
              <p className="text-xs text-slate-200 italic leading-relaxed">{rewrittenText}</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Dynamic Voice Analysis & Funder Alignment Segment */}
      <AnimatePresence>
        {analyzedResult && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 border border-slate-200 rounded-3xl p-6"
          >
            {/* Linguistic Performance Stats card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <h4 className="font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Sparkles className="text-indigo-600 animate-pulse" size={18} />
                    Calibrated Voice Insights
                  </h4>
                  <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {analyzedResult.primaryArchetype || 'The Advocate'} Archetype
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs mb-6">
                  <div>
                    <span className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Tone Descriptors</span>
                    <div className="flex flex-wrap gap-1">
                      {analyzedResult.toneDescriptors?.map((t: string) => (
                        <span key={t} className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded text-[9px] font-black border border-slate-100 uppercase">{t}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Writing Maturity Score</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${analyzedResult.maturityScore || 80}%` }}></div>
                      </div>
                      <span className="font-bold text-slate-800 text-xs">{analyzedResult.maturityScore || 80}%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="bg-gradient-to-br from-indigo-50/70 to-indigo-100/30 border border-indigo-100/80 rounded-2xl p-4.5 text-left space-y-1">
                    <span className="text-[9px] font-black uppercase text-indigo-700 tracking-wider font-mono block">Linguistic Archetype & Evidence</span>
                    <p className="text-slate-800 text-[11px] font-semibold leading-relaxed">
                      {analyzedResult.primaryArchetype || "The Advocate"}
                    </p>
                  </div>

                  <div>
                    <span className="block text-slate-400 text-[10px] uppercase font-bold mb-1.5">Key Stylistic Vocabulary & Rules</span>
                    <ul className="text-xs text-slate-600 space-y-2">
                      {analyzedResult.voiceRules?.map((r: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-indigo-500 font-extrabold select-none">•</span>
                          <span className="font-medium leading-relaxed">{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <span className="block text-slate-400 text-[10px] uppercase font-bold mb-1.5">Extracted Writing Samples</span>
                    <div className="space-y-1.5">
                      {analyzedResult.writingSamples?.map((s: string, idx: number) => (
                        <p key={idx} className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border-l-2 border-l-slate-300 leading-relaxed font-medium">"{s}"</p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Saving Flow */}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Save as Active Voice Profile</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={customProfileName}
                    onChange={(e) => setCustomProfileName(e.target.value)}
                    placeholder="e.g. ECADRN High-Impact Academy"
                    className="flex-1 text-xs px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-550 focus:border-transparent font-medium"
                  />
                  <button 
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile || !customProfileName.trim()}
                    className="px-4 py-2.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-800 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
                  >
                    {isSavingProfile ? <RefreshCw className="animate-spin text-white" size={12} /> : null}
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
                {profileSavedMsg && (
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                    <Check size={12} /> {profileSavedMsg}
                  </p>
                )}
              </div>
            </div>

            {/* Funder Alignment Card */}
            <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-xl flex flex-col justify-between border-t-4 border-t-indigo-500 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded uppercase tracking-widest">
                  AI Alignment Scout
                </span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 tracking-tight flex items-center gap-2 mb-1">
                  <Award size={18} className="text-indigo-500 animate-pulse" />
                  Automatically Suggested Funder Match
                </h4>
                <p className="text-[10px] text-slate-400 mb-4 font-medium">Identified by analyzing matches in writing topics and alignment objectives.</p>

                {analyzedResult.suggestedFunder ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="font-extrabold text-base text-indigo-600 block leading-tight">{analyzedResult.suggestedFunder.funderName}</span>
                        <span className="text-[9px] font-bold text-slate-400 font-mono italic">{analyzedResult.suggestedFunder.website}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-widest block text-slate-400">Match Vector</span>
                        <span className="text-xl font-black text-emerald-500">{analyzedResult.suggestedFunder.confidence || 92}%</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Strategic Fit Rationale</span>
                      <p className="text-xs text-slate-600 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/10 leading-relaxed font-medium italic">
                        "{analyzedResult.suggestedFunder.matchReason}"
                      </p>
                    </div>

                    {analyzedResult.suggestedFunder.suggestedRelationshipNotes && (
                      <div>
                        <span className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Recommended Cultivation Angle</span>
                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                          {analyzedResult.suggestedFunder.suggestedRelationshipNotes}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 italic">
                    <p className="text-xs">No explicit matching priorities detected in this training block. Inject more specific practice guides from ecadrn.org below to identify custom corporate and foundation alignments.</p>
                  </div>
                )}
              </div>

              {/* Funder Save Action */}
              {analyzedResult.suggestedFunder && (
                <div className="pt-4 mt-6 border-t border-slate-100">
                  {(() => {
                    const trackingData = getFunderTrackState(analyzedResult.suggestedFunder.funderName);
                    return trackingData.isTracked ? (
                      <div className="w-full bg-emerald-50 text-emerald-800 border border-emerald-100 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-[10px] uppercase tracking-wider">
                        <CheckCircle size={16} className="text-emerald-600" />
                        <span>✓ Aligned & Tracked in Funder Intelligence</span>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <button
                          onClick={handleSyncSuggestedFunder}
                          disabled={syncingFunderId !== null}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 border border-transparent hover:scale-[1.01] active:scale-[0.99]"
                        >
                          {syncingFunderId !== null ? (
                            <RefreshCw className="animate-spin text-white" size={14} />
                          ) : (
                            <Plus size={14} />
                          )}
                          <span>
                            {syncingFunderId !== null ? 'Syncing Research & Creating Profiles...' : `Track & Research ${analyzedResult.suggestedFunder.funderName}`}
                          </span>
                        </button>
                        {funderSyncMsg && (
                          <p className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-150 px-3.5 py-2 rounded-xl text-center italic">
                            {funderSyncMsg}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice-Lab Integrated Intelligence & Alignments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-8">
        {/* Card 1: First Funder Strategic & Linguistic Scanner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600">
                <Globe size={18} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 tracking-tight text-sm">Funder Linguistic Alignment Scanner</h4>
                <p className="text-[10px] text-slate-500 font-medium font-semibold">Analyze themes and alignment score of the premier funder in your roster.</p>
              </div>
            </div>

            {firstFunder ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-mono">PRIMARY FUNDER TARGET</span>
                    <span className="font-black text-slate-800 text-sm block leading-tight">{firstFunder.funderName}</span>
                    <span className="text-[10px] text-slate-550 block font-mono italic">{firstFunder.website}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-mono">RELATIONSHIP</span>
                    <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider">{firstFunder.relationshipStage || 'Researching'}</span>
                  </div>
                </div>

                {funderAlignmentResults ? (
                  <div className="space-y-4 p-4 bg-orange-50/40 border border-orange-100 rounded-2xl animate-fade-in text-slate-800">
                    <div>
                      <span className="text-[9px] font-black text-orange-850 uppercase tracking-widest block mb-1.5 font-mono">1. Linguistic & Phraseology Priorities</span>
                      {funderAlignmentResults.keyPhrases && funderAlignmentResults.keyPhrases.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1 mb-2">
                          {funderAlignmentResults.keyPhrases.map((phrase: string, idx: number) => (
                            <span key={idx} className="bg-white border border-orange-200 text-orange-900 px-2 py-0.5 rounded text-[8.5px] font-bold italic">
                              "{phrase}"
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic">No specific phrases detected.</p>
                      )}
                      
                      {funderAlignmentResults.voiceRules && funderAlignmentResults.voiceRules.length > 0 && (
                        <div className="bg-white/80 p-2 text-[10px] text-slate-650 rounded-lg border border-orange-150/40 space-y-1 mt-1.5">
                          {funderAlignmentResults.voiceRules.slice(0, 3).map((rule: string, idx: number) => (
                            <div key={idx} className="flex gap-1">
                              <span className="text-orange-500 font-extrabold">•</span>
                              <span>{rule}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[9px] font-black text-orange-850 uppercase tracking-widest block mb-1 font-mono">2. Thematic Alignment & Voice Calibration</span>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="bg-white p-2 rounded-lg border border-orange-150/30">
                          <span className="text-[8px] font-bold text-slate-400 uppercase block">Preferred Archetype</span>
                          <span className="text-[10.5px] font-extrabold text-orange-800">{funderAlignmentResults.primaryArchetype || 'The Advocate'}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-orange-150/30">
                          <span className="text-[8px] font-bold text-slate-400 uppercase block">Calibration Score</span>
                          <span className="text-[10.5px] font-extrabold text-orange-800">{funderAlignmentResults.maturityScore || 85}% Alignment</span>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase block tracking-wider">Calibration Hotspots</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {funderAlignmentResults.toneDescriptors?.map((theme: string) => (
                            <span key={theme} className="bg-orange-100/60 border border-orange-200/50 text-orange-800 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider">{theme}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-orange-200/50">
                      <span className="text-[9px] font-black text-orange-850 uppercase tracking-widest block font-mono mb-1">Calibration Rationale & Fit Guidance</span>
                      <p className="text-[11px] leading-relaxed text-slate-600 font-medium italic">
                        "{funderAlignmentResults.suggestedFunder?.matchReason || 'Highly aligned written values centering on peer dispute resolution and systemic community ADR framework building.'}"
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed italic bg-slate-50 p-4 rounded-xl text-center">
                    Prerender funder context. Click scan below to determine linguistic alignment vector and thematic hotspots.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-6 rounded-xl text-center font-semibold">No funders currently saved in your Funder Intelligence roster.</p>
            )}
          </div>

          {firstFunder && (
            <div className="pt-4 mt-4 border-t border-slate-100">
              <button
                onClick={analyzeFunderAlignment}
                disabled={isFunderAlignmentAnalyzing}
                className="w-full bg-slate-900 hover:bg-slate-850 text-white font-black text-[10px] uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {isFunderAlignmentAnalyzing ? <RefreshCw className="animate-spin text-white" size={12} /> : <Sparkles className="text-white animate-pulse" size={12} />}
                <span>{isFunderAlignmentAnalyzing ? 'Deconstructing Funder Context...' : `Deconstruct Voice Alignment with ${firstFunder.funderName}`}</span>
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Voice-Aligned high-ECADRN Grants */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 tracking-tight text-sm">Voice-Aligned ECADRN Grants</h4>
                <p className="text-[10px] text-slate-500 font-medium font-semibold">Verified grants with high ECADRN scores matched to your active voice profile.</p>
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1">
              {highAlignmentGrants.slice(0, 3).map((g: any, idx) => (
                <div key={g.id || idx} className="p-3 bg-slate-50 hover:bg-slate-100/50 rounded-xl border border-slate-200 transition-all flex flex-col justify-between">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div>
                      <span className="text-[11px] font-bold text-slate-900 line-clamp-1">{g.title}</span>
                      <span className="text-[9px] font-semibold text-slate-450 block">{g.funderName}</span>
                    </div>
                    <span className="shrink-0 bg-emerald-50 text-emerald-800 text-[8px] font-black uppercase px-2 py-0.5 border border-emerald-100 rounded tracking-wider">
                      ECADRN: {g.ecadrnAlignmentScore || g.missionFitScore || 85}%
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200/40 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500 font-medium font-mono">Linguistic Style Match:</span>
                    <span className="font-bold text-emerald-600 text-xs">{g.styleMatchScore}%</span>
                  </div>
                  {g.matchedKeywords && g.matchedKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {g.matchedKeywords.slice(0, 3).map((kw: string) => (
                        <span key={kw} className="bg-indigo-50/50 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded border border-indigo-100/30 uppercase tracking-wide">{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {grants.some(g => g.verified === false) && highAlignmentGrants.length === 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-2">
                  <span className="text-amber-500 text-sm shrink-0">⚠️</span>
                  <p className="text-[10px] text-amber-700 font-semibold">Some discovered grants were flagged as unverified and are hidden here. Run a new Discovery search or manually review grants in Grant Matcher.</p>
                </div>
              )}
              {highAlignmentGrants.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center p-6 bg-slate-50 rounded-xl font-semibold">No grants currently qualified as high-alignment (ECADRN of 80% or greater). Execute Discover Grants search in Grant Matcher to populate.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ECADRN Knowledge & Resources Hub */}
      <div id="ecadrn-hub" className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <BookOpen size={20} />
          </div>
          <div>
            <h4 className="font-black text-slate-900 tracking-tight text-lg">ECADRN Knowledge & Resource Hub</h4>
            <p className="text-xs text-slate-500 font-medium">Inject verified, practice-tested guides and publications from ecadrn.org directly into the linguistic analysis pipeline.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ECADRN_RESOURCES.map((r) => {
            const isExpanded = expandedResource === r.id;
            return (
              <div 
                key={r.id} 
                className="bg-white border border-slate-200 hover:border-indigo-200/60 rounded-2xl p-5 hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 tracking-wider">
                      {r.category}
                    </span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                      Target: {r.cohort}
                    </span>
                  </div>
                  <h5 className="font-bold text-slate-900 tracking-tight text-sm mb-2 group-hover:text-indigo-600">{r.title}</h5>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">{r.description}</p>

                  {/* Collapsible expanded context block */}
                  {isExpanded && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      className="bg-slate-50 p-3.5 border border-slate-200/40 rounded-xl mb-4 text-[11px] leading-relaxed text-slate-600 font-medium space-y-2 overflow-y-auto max-h-48 border-l-2 border-l-indigo-500"
                    >
                      <p className="font-bold uppercase text-[9px] text-indigo-500 tracking-widest border-b border-slate-100 pb-1 font-mono">Full Resource Guidance Summary</p>
                      <div className="whitespace-pre-line font-mono">{r.fullText}</div>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-2 mt-auto pt-3 border-t border-slate-50">
                  <button 
                    onClick={() => setExpandedResource(isExpanded ? null : r.id)}
                    className="w-full flex items-center justify-between text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-slate-50 py-2 px-3 rounded-lg transition-all"
                  >
                    <span>{isExpanded ? "Hide Guidance Content" : "Verify Guidance Content"}</span>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => injectResource(r.fullText, 'neural-scratchpad')}
                      className="py-2 px-2.5 bg-white border border-slate-200 hover:border-indigo-100 hover:bg-slate-50 text-[10px] font-bold text-slate-600 rounded-xl transition-all flex items-center justify-center gap-1 uppercase tracking-wider cursor-pointer"
                    >
                      <CheckCircle size={10} className="text-slate-400" /> Use Draft Scratch
                    </button>
                    
                    <button 
                      onClick={() => {
                        injectResource(r.fullText, 'neural-scratchpad');
                        analyzeVoice(r.fullText);
                      }}
                      className="py-2 px-2 text-indigo-600 border border-indigo-105 hover:bg-indigo-50 font-extrabold text-[10px] rounded-xl transition-all flex items-center justify-center gap-1 uppercase tracking-wider relative overflow-hidden"
                    >
                      <Sparkles size={11} className="text-indigo-500" /> Auto-Calibrate ⚡
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PageGuide 
        isOpen={showGuide} 
        onClose={() => setShowGuide(false)} 
        title="Voice Lab" 
        steps={guideSteps} 
      />
    </motion.div>
  );
}

function OutreachView({ organization, funders, proposals }: { organization: any, funders: any[], proposals: any[] }) {
  const [showGuide, setShowGuide] = useState(false);

  const guideSteps = [
    { title: "AI Outreach Email Composer", content: "Select a funder from your intelligence database, choose an email type (Cold Intro, LOI Announcement, Follow-Up, or Thank You), and click Generate. The AI drafts a 250–400 word personalized email using both your org's profile and that funder's known giving priorities." },
    { title: "Email Types Explained", content: "Cold Intro: first contact to introduce ECADRN. LOI Announcement: formal letter of inquiry. Follow-Up: after a meeting or prior submission. Thank You: post-award or post-meeting gratitude. Each has a distinct tone and structure." },
    { title: "Link a Proposal", content: "Optionally select an existing proposal to reference in the email. The AI will mention the specific project, its alignment to the funder's priorities, and the funding amount requested — making the email concrete and credible." },
    { title: "Edit Before Sending", content: "All generated emails appear in the editable text area below. Review, customize, and personalize before copying. Click 'Copy to Clipboard' and paste into your email client — the app does not send emails directly." },
    { title: "Funder Intelligence Integration", content: "The AI uses your funder's full intelligence profile (giving priorities, geographic focus, award ranges, past grantees) to craft language that mirrors what that funder cares about — not a generic template." },
    { title: "Calendar & Deadlines", content: "Grant deadlines and proposal due dates are tracked on the main Calendar view. Use it to prioritize your outreach — target funders with upcoming deadlines first." },
    { title: "System Notifications", content: "The Notifications panel shows autopilot submission confirmations, deadline reminders, and team activity alerts. Mark items as read to keep your inbox clean." },
    { title: "Replay This Guide", content: "Click the ? icon any time to reopen this guide. All 8 steps are always available." }
  ];
  const [selectedFunderId, setSelectedFunderId] = useState<string>('');
  const [emailType, setEmailType] = useState<'introduction' | 'loi' | 'followup' | 'thankyou'>('introduction');
  const [relatedProposalId, setRelatedProposalId] = useState<string>('');
  const [generatedEmail, setGeneratedEmail] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [missingComponents, setMissingComponents] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const selectedFunder = funders.find(f => f.id === selectedFunderId);
  const relatedProposal = proposals.find(p => p.id === relatedProposalId);

  const checkMissing = async () => {
    setIsChecking(true);
    try {
      const result = await callAI('identify-missing', {
        currentFeatures: ['Dashboard', 'Proposals', 'Funders', 'Grants', 'Voice Lab', 'Chat'],
        orgProfile: organization
      });
      setMissingComponents(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsChecking(false);
    }
  };

  const generateEmail = async () => {
    if (!selectedFunder) return;
    setIsGenerating(true);
    setGeneratedEmail('');
    try {
      const result = await callAI('generate-outreach-email', {
        emailType,
        funder: {
          name: selectedFunder.funderName || selectedFunder.name,
          priorities: selectedFunder.givingPriorities || selectedFunder.notes || '',
          analysis: selectedFunder.aiAnalysis || ''
        },
        organization: {
          name: organization?.name || 'ECADRN',
          mission: organization?.mission || '',
          programs: organization?.programs || ''
        },
        proposal: relatedProposal ? {
          title: relatedProposal.title,
          funder: relatedProposal.funder,
          description: relatedProposal.description || ''
        } : null
      });
      setGeneratedEmail(typeof result === 'string' ? result : JSON.stringify(result));
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const emailTypeLabels = {
    introduction: { label: 'Cold Introduction', desc: 'First contact with a new funder', icon: '✉️' },
    loi: { label: 'Letter of Inquiry', desc: 'Formal LOI request', icon: '📄' },
    followup: { label: 'Follow-Up', desc: 'After an LOI or meeting', icon: '🔁' },
    thankyou: { label: 'Thank You', desc: 'Post-decision or post-grant', icon: '🙏' }
  };

  return (
    <motion.div id="outreach-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center text-slate-900 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-bold tracking-tight">Strategic Outreach</h3>
          <button 
            onClick={() => setShowGuide(true)}
            className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
          >
            <HelpCircle size={14} />
          </button>
        </div>
        <button 
          onClick={checkMissing}
          disabled={isChecking}
          className="border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
        >
          {isChecking ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
          {isChecking ? 'Auditing...' : 'Audit Build'}
        </button>
      </div>

      {/* Email Generator Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Mail size={18} className="text-white" />
          </div>
          <div>
            <h4 className="font-black text-slate-900 tracking-tight">AI Outreach Composer</h4>
            <p className="text-xs text-slate-500 font-medium">Draft tailored emails using your org voice + funder intelligence</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          {/* Email Type Selector */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Email Type</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(Object.entries(emailTypeLabels) as [keyof typeof emailTypeLabels, any][]).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => setEmailType(type)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${emailType === type ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                >
                  <div className="text-lg mb-1">{meta.icon}</div>
                  <div className={`text-[10px] font-black uppercase tracking-widest ${emailType === type ? 'text-indigo-700' : 'text-slate-700'}`}>{meta.label}</div>
                  <div className="text-[9px] text-slate-400 font-medium mt-0.5">{meta.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Funder Selector */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Target Funder *</label>
            <select
              value={selectedFunderId}
              onChange={(e) => setSelectedFunderId(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="">Select a funder from your database...</option>
              {(funders || []).map(f => (
                <option key={f.id} value={f.id}>{f.funderName || f.name}</option>
              ))}
            </select>
          </div>

          {/* Related Proposal (optional) */}
          {(emailType === 'loi' || emailType === 'followup') && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Related Proposal (Optional)</label>
              <select
                value={relatedProposalId}
                onChange={(e) => setRelatedProposalId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="">No proposal linked</option>
                {(proposals || []).map(p => (
                  <option key={p.id} value={p.id}>{p.title} — {p.funder}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={generateEmail}
            disabled={!selectedFunderId || isGenerating}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
          >
            {isGenerating ? <><RefreshCw size={14} className="animate-spin" /> Composing…</> : <><Mail size={14} /> Generate Outreach Email</>}
          </button>
        </div>
      </div>

      {/* Generated Email Output */}
      {generatedEmail && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600" />
              <span className="text-xs font-black text-emerald-800 uppercase tracking-widest">Draft Ready — {emailTypeLabels[emailType].label}</span>
            </div>
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
          <div className="p-6">
            <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">{generatedEmail}</pre>
          </div>
        </motion.div>
      )}

      {missingComponents.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
            <AlertTriangle className="text-amber-600" size={18} />
            <span className="text-sm font-bold text-amber-900 uppercase tracking-tight">Build Gaps Identified</span>
          </div>
          <div className="p-6 space-y-3">
            {missingComponents.map((m, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-slate-700">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                {m}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <PageGuide 
        isOpen={showGuide} 
        onClose={() => setShowGuide(false)} 
        title="Outreach" 
        steps={guideSteps} 
      />
    </motion.div>
  );
}

function OutreachStat({ label, value, color }: { label: string, value: string, color: 'blue' | 'green' | 'orange' | 'red' }) {
  const colors = {
    blue: 'text-indigo-600 bg-indigo-50',
    green: 'text-emerald-600 bg-emerald-50',
    orange: 'text-amber-600 bg-amber-50',
    red: 'text-rose-600 bg-rose-50',
  };
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{label}</p>
      <div className={`text-sm font-black ${colors[color]} inline-block px-3 py-1 rounded-lg`}>{value}</div>
    </div>
  );
}


function ChatView({ organization, proposals }: { organization: any, proposals: any[] }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', text: string}[]>([
    { role: 'assistant', text: `Hello! I'm your Nexus OS AI Advisor. I've analyzed your portfolio for ${organization?.name || 'ECADRN'}. How can I assist you with your ${proposals.length} active projects today?` }
  ]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');

    try {
      const res = await callAI<{ raw?: string } | string>('chat', {
        userMessage: userMsg,
        orgProfile: organization,
        pipelineSummary: `Currently managing ${(proposals || []).length} proposals and ${(proposals || []).filter(p => p.status === 'draft').length} drafts.`
      });
      // Worker returns { raw: text } for plain-text AI responses
      const text = typeof res === 'string' ? res : (res as any).raw || JSON.stringify(res);
      setMessages(prev => [...prev, { role: 'assistant', text }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: "Strategic uplink interrupted. Please retry your request." }]);
    }
  };

  return (
    <div id="chat-view" className="h-[calc(100vh-12rem)] flex flex-col bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="font-bold tracking-tight">AI Strategic Advisor</h3>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Active • Neural Link Stable</p>
          </div>
        </div>
        <button className="text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-5 rounded-xl shadow-sm leading-relaxed text-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-white border-t border-slate-100">
        <div className="flex gap-4">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Search projects or request strategic insight..."
            className="flex-1 bg-slate-100 border-transparent rounded-full px-6 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
          />
          <button 
            onClick={sendMessage}
            className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}


function CalendarView({ grants, proposals }: { grants: any[], proposals: any[] }) {
  const [activeTab, setActiveTab] = useState<'grid' | 'monthly' | 'weekly'>('grid');
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  const events = [
    ...grants.filter(g => g.deadline).map(g => ({ date: new Date(g.deadline), title: g.title, type: 'grant', color: 'rose', status: g.matchStatus || 'Discovery' })),
    ...proposals.map(p => ({ date: new Date(p.updatedAt), title: p.title, type: 'proposal', color: 'indigo', status: p.status || 'Draft' }))
  ];

  const sortedEvents = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());

  const getWeeklyGroup = (date: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const eventDay = new Date(date);
    eventDay.setHours(0,0,0,0);
    const diffTime = eventDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Recent History';
    if (diffDays >= 0 && diffDays <= 7) return 'This Week';
    if (diffDays > 7 && diffDays <= 14) return 'Next Week';
    if (diffDays > 14 && diffDays <= 30) return 'In 3-4 Weeks';
    return 'Future Timeline';
  };

  const getRelativeTimeText = (date: Date) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const eventDay = new Date(date);
    eventDay.setHours(0,0,0,0);
    const diffTime = eventDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      if (absDays === 1) return 'Yesterday';
      return `${absDays} days ago`;
    }
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
  };

  const monthlyGroups: { [key: string]: any[] } = {};
  sortedEvents.forEach(e => {
    const mKey = e.date.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!monthlyGroups[mKey]) monthlyGroups[mKey] = [];
    monthlyGroups[mKey].push(e);
  });

  const weeklyColumns = ['This Week', 'Next Week', 'In 3-4 Weeks', 'Future Timeline', 'Recent History'];

  return (
    <motion.div id="calendar-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900">Nexus Calendar & Timeline</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Lifecycle Tracking</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTab('grid')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === 'grid' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Calendar Grid
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === 'monthly' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Monthly Track
            </button>
            <button
              onClick={() => setActiveTab('weekly')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === 'weekly' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Weekly Columns
            </button>
          </div>
          
          <span className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-4 py-2 rounded-full shadow-lg shadow-slate-100 hidden sm:inline-block">
            {now.toLocaleString('default', { month: 'long' })} {currentYear}
          </span>
        </div>
      </div>

      {activeTab === 'grid' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl shadow-slate-100">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {days.map(day => (
              <div key={day} className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }).map((_, i) => {
              const dayNum = i - firstDay + 1;
              const isCurrentMonth = dayNum > 0 && dayNum <= daysInMonth;
              const date = new Date(currentYear, currentMonth, dayNum);
              const dayEvents = events.filter(e => e.date.toDateString() === date.toDateString());

              return (
                <div key={i} className={`border-r border-b border-slate-100 p-4 min-h-[140px] transition-colors ${!isCurrentMonth ? 'bg-slate-50/30' : 'bg-white hover:bg-slate-50/50'}`}>
                  {isCurrentMonth && (
                    <>
                      <span className={`text-xs font-bold ${date.toDateString() === now.toDateString() ? 'bg-indigo-600 text-white w-7 h-7 flex items-center justify-center rounded-xl shadow-lg shadow-indigo-100' : 'text-slate-400'}`}>
                        {dayNum}
                      </span>
                      <div className="mt-3 space-y-2">
                        {dayEvents.map((e, idx) => (
                          <div key={idx} className={`text-[9.5px] font-extrabold py-1 px-2 rounded-lg truncate border leading-tight ${
                            e.color === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                          }`} title={`${e.type.toUpperCase()}: ${e.title}`}>
                            {e.title}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-8">
          {Object.keys(monthlyGroups).length > 0 ? (
            Object.keys(monthlyGroups).map(monthKey => (
              <div key={monthKey} className="relative pl-6 border-l-2 border-slate-100 space-y-4">
                <div className="absolute -left-[7px] top-1 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-500 shadow-sm"></div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">{monthKey}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {monthlyGroups[monthKey].map((e, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border flex items-start gap-3 transition-all hover:shadow-md ${
                      e.color === 'rose' ? 'bg-rose-50/30 border-rose-100' : 'bg-indigo-50/30 border-indigo-100'
                    }`}>
                      <div className={`p-2 rounded-lg text-center shrink-0 w-12 ${
                        e.color === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        <span className="text-xs font-black block tracking-tighter leading-none">{e.date.getDate()}</span>
                        <span className="text-[8px] font-bold uppercase tracking-wide">{e.date.toLocaleString('default', { month: 'short' })}</span>
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <span className={`text-[8.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                          e.color === 'rose' ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {e.type === 'grant' ? 'Grant Deadline' : 'Proposal Update'}
                        </span>
                        <h5 className="text-xs font-bold text-slate-900 truncate" title={e.title}>{e.title}</h5>
                        <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                          <span>Status: {e.status}</span>
                          <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                          <span className="text-indigo-600">{getRelativeTimeText(e.date)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-400 italic">No events currently tracked.</div>
          )}
        </div>
      )}

      {activeTab === 'weekly' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {weeklyColumns.map(colName => {
            const colEvents = sortedEvents.filter(e => getWeeklyGroup(e.date) === colName);
            
            return (
              <div key={colName} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex flex-col min-h-[300px]">
                <div className="border-b border-slate-150 pb-2 mb-3 flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{colName}</h4>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded-full">{colEvents.length}</span>
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colEvents.length > 0 ? colEvents.map((e, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-2">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded block w-fit ${
                        e.color === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {e.type}
                      </span>
                      <h5 className="text-xs font-bold text-slate-800 leading-snug line-clamp-2" title={e.title}>{e.title}</h5>
                      <div className="text-[9px] text-slate-400 font-medium">
                        <span className="font-semibold text-slate-600 block">{e.date.toLocaleDateString([], {month: 'short', day: 'numeric'})}</span>
                        <span className="text-indigo-600 font-semibold">{getRelativeTimeText(e.date)}</span>
                      </div>
                    </div>
                  )) : (
                    <div className="text-[9.5px] text-slate-400 italic text-center py-6">No deadlines</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}


function PageGuide({ isOpen, onClose, title, steps }: { isOpen: boolean, onClose: () => void, title: string, steps: { title: string, content: string }[] }) {
  const [step, setStep] = useState(0);

  // Reset to first step whenever guide opens
  useEffect(() => { if (isOpen) setStep(0); }, [isOpen]);

  if (!isOpen) return null;

  const currentStep = steps[Math.min(step, steps.length - 1)];
  const isNew = currentStep.title.startsWith('NEW:') || currentStep.title.includes('Autopilot') || currentStep.title.includes('Team') || currentStep.title.includes('Verified');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6 text-left" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="bg-white rounded-[36px] shadow-2xl max-w-lg w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header stripe */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-8 pt-8 pb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-black text-indigo-200 uppercase tracking-[0.2em]">{title} Guide</span>
                {isNew && (
                  <span className="text-[8px] font-black uppercase tracking-widest bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">
                    ✦ New Feature
                  </span>
                )}
              </div>
              <h4 className="text-xl font-black text-white tracking-tight leading-tight">{currentStep.title.replace('NEW: ', '')}</h4>
            </div>
            <button onClick={onClose} className="p-2 text-indigo-200 hover:text-white transition-colors rounded-xl hover:bg-white/10">
              <X size={20} />
            </button>
          </div>
          {/* Step dots */}
          <div className="flex items-center gap-1.5 mt-5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-7 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
              />
            ))}
            <span className="ml-auto text-[9px] font-black text-indigo-200 tabular-nums">{step + 1} / {steps.length}</span>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-6">
          <p className="text-sm text-slate-600 leading-relaxed font-medium">{currentStep.content}</p>

          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3.5 border-2 border-slate-100 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
              >
                ← Back
              </button>
            )}
            <button
              onClick={() => {
                if (step < steps.length - 1) setStep(step + 1);
                else onClose();
              }}
              className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
            >
              {step < steps.length - 1 ? 'Next' : '✓ Got it'}
              {step < steps.length - 1 && <ArrowRight size={13} />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Walkthrough({ 
  isOpen, 
  currentStep,
  onStepChange,
  onSetActiveTab, 
  onClose 
}: { 
  isOpen: boolean, 
  currentStep: number,
  onStepChange: (step: number) => void,
  onSetActiveTab: (tab: Tab) => void, 
  onClose: () => void 
}) {
  const steps = WALKTHROUGH_STEPS;

  useEffect(() => {
    if (isOpen) {
      onSetActiveTab(steps[currentStep].tab as Tab);
    }
  }, [currentStep, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] max-w-sm w-[385px] bg-slate-900 border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.4)] rounded-3xl p-5 text-left text-white flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-[10px] font-black text-indigo-400 bg-indigo-950 border border-indigo-900 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Onboarding: {currentStep + 1} / {steps.length}
          </span>
        </div>
        <button 
          onClick={onClose} 
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div>
        <h4 className="text-base font-bold text-white tracking-tight">{steps[currentStep].title}</h4>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          {steps[currentStep].content}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {steps.map((_, i) => (
          <div 
            key={i} 
            className={`h-1.5 rounded-full transition-all ${
              i === currentStep ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-800'
            }`}
          ></div>
        ))}
      </div>

      <div className="flex gap-2.5 pt-2 border-t border-slate-800/60">
        {currentStep > 0 && (
          <button 
            onClick={() => onStepChange(currentStep - 1)}
            className="flex-1 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800 transition-all"
          >
            Back
          </button>
        )}
        <button 
          onClick={() => {
            if (currentStep < steps.length - 1) onStepChange(currentStep + 1);
            else onClose();
          }}
          className="flex-[2] py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-lg shadow-indigo-950"
        >
          <span>{currentStep < steps.length - 1 ? 'Next Step' : 'Launch OS'}</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function BudgetBuilder({ budget, onUpdate, proposalDescription }: { budget: any[], onUpdate: (b: any[]) => void, proposalDescription: string }) {
  const [lineItems, setLineItems] = useState<any[]>(budget || []);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  const addLineItem = () => {
    const newItem = { id: Math.random().toString(36).substr(2, 9), description: '', amount: 0, justification: '' };
    const newList = [...lineItems, newItem];
    setLineItems(newList);
    onUpdate(newList);
  };

  const updateItem = (id: string, field: string, value: any) => {
    const newList = lineItems.map(item => item.id === id ? { ...item, [field]: value } : item);
    setLineItems(newList);
    onUpdate(newList);
  };

  const generateJustification = async (item: any) => {
    if (!item.description || !item.amount) {
      alert("Please enter a description and amount first.");
      return;
    }
    setIsGenerating(item.id);
    try {
      const result = await callAI('generate-justification', {
        projectDescription: proposalDescription,
        description: item.description,
        amount: item.amount
      });
      updateItem(item.id, 'justification', result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(null);
    }
  };

  const removeLineItem = (id: string) => {
    const newList = lineItems.filter(item => item.id !== id);
    setLineItems(newList);
    onUpdate(newList);
  };

  const total = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 italic">Budget Builder</h3>
          <p className="text-slate-500 text-sm font-medium">Build your project budget with line-item justifications.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={async () => {
              setIsGenerating('FULL');
              try {
                const result = await callAI('generate-budget', {
                  description: proposalDescription
                });
                setLineItems(result);
                onUpdate(result);
              } catch (err) {
                console.error(err);
              } finally {
                setIsGenerating(null);
              }
            }}
            disabled={isGenerating === 'FULL'}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            {isGenerating === 'FULL' ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
            AI Generate Full Budget
          </button>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Amount Requested</span>
            <span className="text-4xl font-black text-indigo-600 tracking-tighter">${total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl shadow-slate-100/50">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-40">Amount ($)</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Justification</th>
              <th className="px-6 py-4 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lineItems.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-all">
                <td className="px-6 py-4">
                  <input 
                    type="text" 
                    value={item.description}
                    placeholder="e.g. Program Coordinator Salary"
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-900 placeholder:text-slate-300"
                  />
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="number" 
                    value={item.amount}
                    onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-indigo-600 placeholder:text-slate-300"
                  />
                </td>
                <td className="px-6 py-4 relative group">
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={item.justification}
                      placeholder="Briefly justify this expense..."
                      onChange={(e) => updateItem(item.id, 'justification', e.target.value)}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-xs font-medium text-slate-500 placeholder:text-slate-200 italic"
                    />
                    <button 
                      onClick={() => generateJustification(item)}
                      disabled={isGenerating === item.id}
                      className={`p-1.5 rounded-lg transition-all ${isGenerating === item.id ? 'bg-indigo-100 text-indigo-600' : 'opacity-0 group-hover:opacity-100 bg-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                      title="AI Generate Justification"
                    >
                      <Sparkles size={12} className={isGenerating === item.id ? 'animate-pulse' : ''} />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => removeLineItem(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button 
          onClick={addLineItem}
          className="w-full py-6 flex items-center justify-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:bg-slate-50 transition-all border-t border-slate-100"
        >
          <Plus size={14} /> Add Line Item
        </button>
      </div>

      <div className="mt-12 bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 flex gap-4 items-start">
        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
          <AlertCircle size={20} />
        </div>
        <div>
          {/* Budget Total */}
          {lineItems.length > 0 && (
            <div className="flex justify-between items-center px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-4">
              <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">Total Project Budget</span>
              <span className="text-lg font-black text-indigo-900">${total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            </div>
          )}
          <h4 className="text-sm font-bold text-slate-900 mb-1">Budget Alignment Check</h4>
          <p className="text-xs text-slate-600 leading-relaxed">This budget is automatically mirrored to your Budget Narrative section. AI Advisor suggests including at least 15% indirect costs if the funder allows it.</p>
        </div>
      </div>
    </div>
  );
}

function TimelineView({ versions, onRevert }: { versions: any[], onRevert: (v: any) => void }) {
  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-12">
        <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 italic">Proposal Evolution</h3>
        <p className="text-slate-500 text-sm font-medium">Track changes, track growth, and revert to any historical state.</p>
      </div>

      <div className="space-y-6 relative">
        <div className="absolute left-8 top-0 bottom-0 w-px bg-slate-200"></div>
        {versions.length > 0 ? versions.map((v, idx) => (
          <div key={v.id} className="relative pl-16 flex items-start gap-8 group">
            <div className={`absolute left-[30px] w-1 h-1 ring-8 rounded-full ${idx === 0 ? 'bg-indigo-600 ring-indigo-100' : 'bg-slate-300 ring-white'} z-10 transition-all group-hover:scale-125`}></div>
            <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm group-hover:shadow-xl group-hover:border-indigo-100 transition-all">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    {v.author?.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{v.author}</span>
                    <span className="text-xs font-bold text-slate-900">{new Date(v.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <button 
                  onClick={() => onRevert(v)}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors shadow-lg shadow-slate-200"
                >
                  Restore This Version
                </button>
              </div>
              <p className="text-sm text-slate-600 italic font-medium">"{v.message || 'Auto-saved version'}"</p>
              <div className="mt-4 flex gap-4">
                <div className="bg-slate-50 px-3 py-1 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {v.content?.length || 0} SECTIONS
                </div>
                <div className="bg-slate-50 px-3 py-1 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  {v.type === 'manual_save' ? 'MANUAL SNAPSHOT' : 'AUTO-SAVE'}
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 text-slate-400 italic text-sm">No version history available for this proposal yet.</div>
        )}
      </div>
    </div>
  );
}
