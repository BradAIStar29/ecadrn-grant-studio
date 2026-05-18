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
  UserPlus
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
import 'react-quill/dist/quill.snow.css';

type Tab = 'dashboard' | 'proposals' | 'funders' | 'grants' | 'voice' | 'outreach' | 'chat' | 'calendar';

export default function App() {
  const [user, setUser] = useState<any>(null);
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
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('hasSeenWalkthrough');
    if (!hasSeen && user) {
      setShowWalkthrough(true);
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

    // Load Notifications
    const notifPath = `organizations/${user.uid}/notifications`;
    const notifRef = collection(db, notifPath);
    const unsubNotifs = onSnapshot(query(notifRef, where('userId', '==', user.uid), where('read', '==', false), orderBy('timestamp', 'desc'), limit(10)), (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, notifPath);
    });

    // Load Organization
    const orgPath = `organizations/${user.uid}`;
    const orgRef = doc(db, orgPath);
    const unsubOrg = onSnapshot(orgRef, (snap) => {
      if (snap.exists()) {
        setOrganization(snap.data());
      } else {
        // Initial setup for new user
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
    const proposalsPath = `organizations/${user.uid}/proposals`;
    const proposalsRef = collection(db, proposalsPath);
    const unsubProposals = onSnapshot(query(proposalsRef, orderBy('updatedAt', 'desc')), (snap) => {
      setProposals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, proposalsPath);
    });

    // Load Grants
    const grantsPath = `organizations/${user.uid}/grants`;
    const grantsRef = collection(db, grantsPath);
    const unsubGrants = onSnapshot(query(grantsRef, limit(20)), (snap) => {
      setGrants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, grantsPath);
    });

    // Load Funders
    const fundersPath = `organizations/${user.uid}/funders`;
    const fundersRef = collection(db, fundersPath);
    const unsubFunders = onSnapshot(query(fundersRef, limit(20)), (snap) => {
      setFunders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, fundersPath);
    });

    // Load Voice Profiles
    const voiceProfilesPath = `organizations/${user.uid}/voiceProfiles`;
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
  }, [user]);

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
    proposals.forEach((p, i) => {
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
      const email = result.user.email || '';
      if (!email.endsWith('@ecadrn.org')) {
        await result.user.delete();
        alert('Access denied. Only @ecadrn.org email addresses are allowed.');
        return;
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error(err);
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
        <div className="p-6 flex items-center justify-between">
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

        <nav className="flex-1 px-4 py-4 space-y-1 mt-4">
          <NavItem 
            icon={<Layout size={20} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="Proposals" 
            active={activeTab === 'proposals'} 
            onClick={() => setActiveTab('proposals')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Search size={20} />} 
            label="Funder Intelligence" 
            active={activeTab === 'funders'} 
            onClick={() => setActiveTab('funders')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<CheckCircle size={20} />} 
            label="Grant Matcher" 
            active={activeTab === 'grants'} 
            onClick={() => setActiveTab('grants')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Mic size={20} />} 
            label="Voice Lab" 
            active={activeTab === 'voice'} 
            onClick={() => setActiveTab('voice')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Mail size={20} />} 
            label="Outreach" 
            active={activeTab === 'outreach'} 
            onClick={() => setActiveTab('outreach')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<MessageSquare size={20} />} 
            label="AI Advisor" 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
            collapsed={!isSidebarOpen}
          />
          <NavItem 
            icon={<Calendar size={20} />} 
            label="Calendar" 
            active={activeTab === 'calendar'} 
            onClick={() => setActiveTab('calendar')} 
            collapsed={!isSidebarOpen}
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
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
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
          <h1 className="text-lg font-semibold text-slate-900 capitalize tracking-tight">{activeTab.replace('-', ' ')}</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
               <button 
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
                             await setDoc(doc(db, `organizations/${user.uid}/notifications`, n.id), { read: true }, { merge: true });
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
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Settings size={20} />
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto flex-1 h-full">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && <DashboardView organization={organization} proposals={proposals} grants={grants} onStartTour={() => setShowWalkthrough(true)} onExportMaster={exportMasterMarkdown} />}
            {activeTab === 'proposals' && <ProposalsView proposals={proposals} organization={organization} funders={funders} voiceProfiles={voiceProfiles} selectedVoiceProfileId={selectedVoiceProfileId} onSetVoiceProfileId={setSelectedVoiceProfileId} />}
            {activeTab === 'funders' && <FundersView funders={funders} organization={organization} />}
            {activeTab === 'grants' && <GrantsView grants={grants} organization={organization} />}
            {activeTab === 'voice' && <VoiceView organization={organization} profiles={voiceProfiles} selectedProfileId={selectedVoiceProfileId} onSetSelectedProfileId={setSelectedVoiceProfileId} />}
            {activeTab === 'outreach' && <OutreachView organization={organization} />}
            {activeTab === 'chat' && <ChatView organization={organization} proposals={proposals} />}
            {activeTab === 'calendar' && <CalendarView grants={grants} proposals={proposals} />}
          </AnimatePresence>
        </div>

        <Walkthrough isOpen={showWalkthrough} onClose={() => {
          setShowWalkthrough(false);
          localStorage.setItem('hasSeenWalkthrough_v1', 'true');
        }} />
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, collapsed }: { 
  icon: React.ReactNode, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  collapsed: boolean
}) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        active 
          ? 'bg-indigo-600 text-white' 
          : 'text-slate-400 hover:bg-slate-800'
      }`}
    >
      <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>
      {!collapsed && <span className="text-sm font-medium">{label}</span>}
    </button>
  );
}

function DashboardView({ 
  organization, proposals, grants, onStartTour, onExportMaster 
}: { 
  organization: any, proposals: any[], grants: any[], onStartTour: () => void, onExportMaster: () => void 
}) {
  const activeProposals = proposals.filter(p => p.status === 'draft' || p.status === 'review').length;
  const pendingDeadlines = grants.filter(g => g.deadline && new Date(g.deadline) > new Date()).length;

  return (
    <motion.div 
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
        <StatCard title="Strategic Matches" value={grants.length.toString()} icon={<TrendingUp className="text-emerald-600" />} trend="High Alignment" />
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
  proposals, organization, funders, voiceProfiles, selectedVoiceProfileId, onSetVoiceProfileId 
}: { 
  proposals: any[], organization: any, funders: any[], voiceProfiles: any[], selectedVoiceProfileId: string | null, onSetVoiceProfileId: (id: string) => void 
}) {
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  
  const guideSteps = [
    { title: "Generative Drafting", content: "Use the 'New Draft' button to trigger AI-powered generation of a full 9-section proposal based on your organization's mission and voice." },
    { title: "Smart Templates", content: "Choose from pre-built ADR grant structures or save your own successful drafts as custom templates for future work." },
    { title: "Advanced Editing", content: "Inside the editor, you can split or merge sections to control flow, and assign specific blocks to team members for collaboration." },
    { title: "Evolution & Budget", content: "Track every manual and auto-save via the Timeline view, and build complex budgets with AI-generated justifications for each line item." }
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
    />;
  }

  const filteredProposals = proposals.filter(p => 
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.funder?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      await addDoc(collection(db, 'organizations', auth.currentUser!.uid, 'proposals'), {
        title: template?.name || newProposalData.title,
        funder: template?.funder || newProposalData.funder,
        description: template?.description || newProposalData.description,
        status: 'draft',
        sections: sections,
        updatedAt: new Date().toISOString(),
        collaborators: [auth.currentUser!.email]
      }).catch(e => handleFirestoreError(e, OperationType.WRITE, `organizations/${auth.currentUser!.uid}/proposals`));
      
      setShowNewForm(false);
      setNewProposalData({ title: '', funder: '', description: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
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
  proposal, onBack, organization, funders, voiceProfiles, selectedVoiceProfileId, onSetVoiceProfileId 
}: { 
  proposal: any, onBack: () => void, organization: any, funders: any[], voiceProfiles: any[], selectedVoiceProfileId: string | null, onSetVoiceProfileId: (id: string) => void 
}) {
  const [sections, setSections] = useState<any[]>(() => {
    return (proposal.sections || []).map((s: any) => ({
      ...s,
      id: s.id || Math.random().toString(36).substr(2, 9)
    }));
  });
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [presence, setPresence] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [isAIWorking, setIsAIWorking] = useState<string | null>(null);
  const [reviewResults, setReviewResults] = useState<any>(null);
  const [showAIReview, setShowAIReview] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{ sectionIdx: number, user: string } | null>(null);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'budget' | 'timeline'>('editor');
  const [budget, setBudget] = useState<any[]>(proposal.budget || []);

  // Auto-sync sections to Firestore
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProposal(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [sections, budget]);

  useEffect(() => {
    const propPath = `organizations/${auth.currentUser!.uid}/proposals/${proposal.id}`;
    
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
      await setDoc(presenceRef, {
        userId: auth.currentUser!.uid,
        userEmail: auth.currentUser!.email,
        sectionIndex: activeSectionIdx,
        lastSeen: new Date().toISOString()
      }, { merge: true });
    };
    updatePresence();
    const presenceInterval = setInterval(updatePresence, 30000);

    const unsubPresence = onSnapshot(collection(db, propPath, 'presence'), (snap) => {
      const now = new Date().getTime();
      setPresence(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((p: any) => now - new Date(p.lastSeen).getTime() < 60000));
    });

    return () => {
      unsubVersions();
      unsubComments();
      unsubPresence();
      clearInterval(presenceInterval);
    };
  }, [proposal.id, activeSectionIdx]);

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

  const saveProposal = async (auto = false) => {
    if (!auto) setIsSaving(true);
    try {
      const propPath = `organizations/${auth.currentUser!.uid}/proposals/${proposal.id}`;
      await setDoc(doc(db, propPath), {
        sections,
        budget,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, propPath));

      if (!auto) {
        const versionsPath = `${propPath}/versions`;
        await addDoc(collection(db, propPath, 'versions'), {
          content: sections,
          budget,
          timestamp: new Date().toISOString(),
          author: auth.currentUser!.email,
          type: 'manual_save',
          message: 'User explicitly saved a version.'
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, versionsPath));
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!auto) setIsSaving(false);
    }
  };

  const saveAsTemplate = async () => {
    const templatesPath = `organizations/${auth.currentUser!.uid}/templates`;
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
    
    const notifPath = `organizations/${auth.currentUser!.uid}/notifications`;
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
      const propPath = `organizations/${auth.currentUser!.uid}/proposals/${proposal.id}`;
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
          await addDoc(collection(db, `organizations/${auth.currentUser!.uid}/notifications`), {
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

  const runAIAction = async (action: 'review' | 'voice' | 'align') => {
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
      } else if (action === 'voice') {
        const activeProfile = voiceProfiles.find(p => p.id === selectedVoiceProfileId) || organization.voiceProfile;
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
              onClick={() => saveProposal()}
              disabled={isSaving}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50"
            >
              {isSaving ? 'Syncing...' : 'Save Version'}
            </button>
          </div>
        </div>
      )}

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
                        className="flex items-center gap-1.5 text-indigo-600 hover:underline"
                      >
                        <MessageSquare size={12} /> {comments.filter(c => c.sectionIndex === activeSectionIdx).length} Comments
                      </button>
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
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section Discussion</h5>
                  <button onClick={() => setShowComments(false)}><X size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                  {comments.filter(c => c.sectionIndex === activeSectionIdx).map(c => (
                    <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2">
                       <div className="flex justify-between items-center">
                         <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{c.author}</span>
                         <span className="text-[8px] font-medium text-slate-400">{new Date(c.timestamp).toLocaleTimeString()}</span>
                       </div>
                       <p className="text-xs text-slate-700 leading-relaxed">{c.text}</p>
                    </div>
                  ))}
                </div>
                <div className="p-6 border-t border-slate-100 bg-white">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && addComment()}
                    />
                    <button onClick={addComment} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
                      <ArrowRight size={16} />
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
        </div>
      </div>
    </div>
  );
}

function TemplateModal({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (t: any) => void }) {
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  useEffect(() => {
    if (!isOpen || !auth.currentUser) return;
    const templatesPath = `organizations/${auth.currentUser.uid}/templates`;
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

function FundersView({ funders, organization }: { funders: any[], organization: any }) {
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [isResearchingNew, setIsResearchingNew] = useState(false);
  const [newFunderUrl, setNewFunderUrl] = useState('');
  const [urlError, setUrlError] = useState(false);
  const [editingFunderId, setEditingFunderId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('All Stages');
  const [filterDateRange, setFilterDateRange] = useState('All Time');
  const [showGuide, setShowGuide] = useState(false);

  const guideSteps = [
    { title: "AI Intelligence", content: "Enter any funder domain to trigger the Nexus Intelligence engine. We'll scrape their public profile and assess mission alignment automatically." },
    { title: "Surgical Search", content: "Filter by relationship stage, analysis date, or search deep within the intelligence reports for specific strategic keywords." },
    { title: "Continuous Research", content: "Use the Sparkles icon on any card to trigger a re-analysis. This updates the funder's strategic shifts and alignment score." },
    { title: "Relationship Management", content: "Directly edit funder notes on each card to keep your team synced on the latest interactions." }
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

      const fundersPath = `organizations/${auth.currentUser!.uid}/funders`;
      if (funder?.id) {
        const docRef = doc(db, fundersPath, funder.id);
        await setDoc(docRef, {
          ...funder,
          funderName: data.funderName || funder.funderName,
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
    const fundersPath = `organizations/${auth.currentUser!.uid}/funders`;
    const docRef = doc(db, fundersPath, id);
    await setDoc(docRef, {
      ...editData,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(e => handleFirestoreError(e, OperationType.WRITE, fundersPath));
    setEditingFunderId(null);
  };

  const filteredFunders = funders.filter(f => {
    const matchesSearch = searchTerm.toLowerCase() === '' || 
      (f.funderName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.website || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.notes || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.intelligence?.missionAlignmentRationale || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.intelligence?.fundingPriorities || []).some((p: string) => p.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.intelligence?.givingPriorities || []).some((p: string) => p.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.intelligence?.recentStrategicShifts || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.intelligence?.typicalGrantees || []).some((tg: string) => tg.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesStage = filterStage === 'All Stages' || f.relationshipStage === filterStage;
    
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
    
    return matchesSearch && matchesStage && matchesDate;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
              placeholder="Search intelligence..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <select 
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors p-2"
            >
              <option>All Stages</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="w-px h-4 bg-slate-200 mt-2"></div>
            <select 
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors p-2"
            >
              <option>All Time</option>
              <option>Last 30 Days</option>
              <option>Last 90 Days</option>
              <option>Last 180 Days</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newFunderUrl}
                onChange={(e) => {
                  setNewFunderUrl(e.target.value);
                  setUrlError(e.target.value.length > 0 && !isValidUrl(e.target.value));
                }}
                placeholder="Enter funder URL..." 
                className={`pl-4 pr-4 py-2 bg-slate-100 border-2 rounded-lg text-sm w-full md:w-64 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${
                  urlError ? 'border-rose-300' : 'border-transparent'
                }`} 
              />
              <button 
                onClick={() => researchFunder()}
                disabled={isResearchingNew || !isValidUrl(newFunderUrl)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
              >
                {isResearchingNew ? <RefreshCw className="animate-spin" size={16} /> : <Search size={16} />}
                {isResearchingNew ? 'Analyzing...' : 'Research'}
              </button>
            </div>
            {urlError && <p className="text-[10px] text-rose-600 font-bold uppercase tracking-tighter ml-1">Please enter a valid domain (e.g. example.org)</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFunders.length > 0 ? filteredFunders.map(f => (
          <FunderCard 
            key={f.id} 
            f={f}
            isEditing={editingFunderId === f.id}
            isResearching={researchingId === f.id}
            editData={editData}
            onEdit={() => { setEditData(f); setEditingFunderId(f.id); }}
            onCancelEdit={() => setEditingFunderId(null)}
            onSaveEdit={() => saveEdit(f.id)}
            onResearch={() => researchFunder(f)}
            setEditData={setEditData}
            STAGES={STAGES}
          />
        )) : (
          <div className="col-span-full py-12 text-center text-slate-400 italic bg-white rounded-xl border border-dashed border-slate-200">
            {searchTerm || filterStage !== 'All Stages' || filterDateRange !== 'All Time' ? 'No funders match your current filters.' : 'Enter a funder domain to begin intelligence gathering.'}
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

function FunderNotesField({ funderId, initialNotes }: { funderId: string, initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);

  const handleBlur = async () => {
    if (notes === initialNotes) return;
    setIsSaving(true);
    try {
      const fundersPath = `organizations/${auth.currentUser!.uid}/funders`;
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
  f, isEditing, isResearching, editData, onEdit, onCancelEdit, onSaveEdit, onResearch, setEditData, STAGES 
}: { 
  f: any, isEditing: boolean, isResearching: boolean, editData: any, onEdit: () => void, 
  onCancelEdit: () => void, onSaveEdit: () => any, onResearch: () => any, setEditData: (d: any) => void, STAGES: string[]
}) {
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
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Internal Notes</label>
            <textarea 
              value={editData.notes || ''} 
              onChange={(e) => setEditData({...editData, notes: e.target.value})}
              className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 outline-none h-20 resize-none"
              placeholder="Strategic context, relationship history..."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onSaveEdit} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">Save Changes</button>
            <button onClick={onCancelEdit} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate max-w-[140px]">{f.funderName || f.website}</h4>
              <a href={f.website.startsWith('http') ? f.website : `https://${f.website}`} target="_blank" rel="noreferrer" className="text-[10px] text-slate-400 hover:text-indigo-500 flex items-center gap-1 mt-0.5">
                <Globe size={10} /> {f.website}
              </a>
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
          
          <p className="text-xs text-slate-600 mb-6 leading-relaxed italic line-clamp-3">"{f.intelligence?.missionAlignmentRationale}"</p>
          
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

            <FunderNotesField funderId={f.id} initialNotes={f.notes || ''} />

            {f.intelligence?.typicalGrantees && (
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Target Grantees</span>
                <div className="flex flex-wrap gap-1.5">
                  {f.intelligence.typicalGrantees.slice(0, 3).map((g: string, i: number) => (
                    <span key={i} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-100">{g}</span>
                  ))}
                </div>
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

function GrantsView({ grants, organization }: { grants: any[], organization: any }) {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'match' | 'deadline' | 'name'>('match');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showGuide, setShowGuide] = useState(false);

  const guideSteps = [
    { title: "Grant Discovery", content: "Our matching engine scans global datasets to find active grant opportunities that perfectly align with your nonprofit mission." },
    { title: "Mission Fit Scoring", content: "Each discovered grant is evaluated by AI against your specific project focus areas and geographic reach to give you a 'Match' score." },
    { title: "Strategic Filtering", content: "Sort your matches by deadline urgency or alignment score to prioritize which opportunities to pursue first." }
  ];

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

      const grantsPath = `organizations/${auth.currentUser!.uid}/grants`;
      const grantsRef = collection(db, grantsPath);
      for (const g of results) {
        await addDoc(grantsRef, {
          ...g,
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
    .filter(g => 
      g.title?.toLowerCase().includes(filterText.toLowerCase()) || 
      g.funderName?.toLowerCase().includes(filterText.toLowerCase())
    )
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
          <button 
            onClick={runDiscovery}
            disabled={isDiscovering}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            {isDiscovering ? <RefreshCw className="animate-spin" size={16} /> : <TrendingUp size={16} />}
            {isDiscovering ? 'Searching...' : 'Run Discovery'}
          </button>
        </div>
      </div>

      <div className="relative">
        <input 
          type="text" 
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter opportunities by funder or focus area..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
        />
        <Search size={18} className="absolute left-4 top-3.5 text-slate-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGrants.length > 0 ? filteredGrants.map(g => (
          <div key={g.id} className="bg-white p-6 rounded-xl border border-slate-200 hover:shadow-xl transition-all group relative overflow-hidden flex flex-col h-full border-t-4 border-t-transparent hover:border-t-indigo-500">
            <div className="absolute top-0 right-0 p-3">
              <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${
                g.missionFitScore >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                Match: {g.missionFitScore || 0}%
              </span>
            </div>
            <h4 className="font-bold text-slate-900 mb-2 leading-tight group-hover:text-indigo-600 pr-12 text-lg tracking-tight">{g.title}</h4>
            <div className="flex items-center gap-2 mb-4">
              <Globe size={12} className="text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g.funderName}</p>
            </div>
            <p className="text-xs text-slate-500 line-clamp-4 mb-6 leading-relaxed italic">"{g.missionFitRationale}"</p>
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
                  <span className="text-rose-500">{new Date(g.deadline).toLocaleDateString()}</span>
                </div>
              )}
            </div>
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

      <PageGuide 
        isOpen={showGuide} 
        onClose={() => setShowGuide(false)} 
        title="Matcher" 
        steps={guideSteps} 
      />
    </motion.div>
  );
}

function VoiceView({ organization, profiles, selectedProfileId, onSetSelectedProfileId }: { organization: any, profiles: any[], selectedProfileId: string | null, onSetSelectedProfileId: (id: string) => void }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const guideSteps = [
    { title: "Voice Training", content: "Upload your historical grant applications, annual reports, or mission statements. We'll analyze them to identify your core organizational personality." },
    { title: "Style Calibration", content: "We extract 'Tone Descriptors' and 'Key Phrases' that ensure every AI-generated proposal sounds authentically like you." },
    { title: "Multiple Profiles", content: "Switch between different voice profiles for different funders or departments (e.g., Academic vs. Grassroots)." },
    { title: "Content Transformation", content: "Once your voice is trained, every draft from the Proposal Studio can be calibrated to your unique ADR style." }
  ];
  const [isRewriting, setIsRewriting] = useState(false);
  const [textToAnalyze, setTextToAnalyze] = useState('');
  const [textToRewrite, setTextToRewrite] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');

  const activeProfile = profiles.find(p => p.id === selectedProfileId) || organization?.voiceProfile;

  const saveToProfiles = async (data: any, name: string) => {
    const profilesPath = `organizations/${auth.currentUser!.uid}/voiceProfiles`;
    await addDoc(collection(db, profilesPath), {
      ...data,
      name,
      createdAt: new Date().toISOString()
    }).catch(e => handleFirestoreError(e, OperationType.WRITE, profilesPath));
  };

  const analyzeVoice = async () => {
    if (!textToAnalyze.trim()) return;
    setIsAnalyzing(true);
    try {
      const data = await callAI('analyze-voice', {
        documents: [{ content: textToAnalyze }]
      });
      
      const profileName = prompt("Name this voice profile:", "ECADRN Formal") || "Unnamed Profile";
      await saveToProfiles(data, profileName);

      setTextToAnalyze('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center text-slate-900 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-2xl font-bold tracking-tight">Voice Lab</h3>
          <button 
            onClick={() => setShowGuide(true)}
            className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
          >
            <HelpCircle size={14} />
          </button>
        </div>
        <div className="flex gap-4">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-1 flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Profile:</span>
            <select 
              value={selectedProfileId || ''} 
              onChange={(e) => onSetSelectedProfileId(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold text-indigo-600 focus:ring-0"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {profiles.length === 0 && <option value="">Default ECADRN</option>}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase tracking-widest border-2 border-indigo-50 px-4 py-2 rounded-xl hover:bg-slate-50 transition-all cursor-pointer">
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
        <div className="bg-white p-6 rounded-xl border border-slate-200 col-span-2 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-bold text-slate-900">Neural Training Input</h4>
            <button 
              onClick={() => setTextToAnalyze('')}
              className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest flex items-center gap-1"
            >
              <X size={12} /> Clear All
            </button>
          </div>
          <textarea 
            value={textToAnalyze}
            onChange={(e) => setTextToAnalyze(e.target.value)}
            placeholder="PRO TIP: For the most accurate voice profile, paste 3-5 paragraphs of your BEST writing—mission statements, successful grant proposals, or high-impact reports. Avoid bullet points or fragmented notes."
            className="w-full h-64 p-5 bg-slate-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all resize-none outline-none mb-4 leading-relaxed"
          />
          <button 
            onClick={analyzeVoice}
            disabled={isAnalyzing || !textToAnalyze.trim() || textToAnalyze.length < 50}
            className="w-full py-4 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-slate-100"
          >
            {isAnalyzing ? <RefreshCw className="animate-spin" size={16} /> : <TrendingUp size={16} />}
            {isAnalyzing ? 'Extracting Linguistics...' : 'Analyze & Calibrate Voice Profile'}
          </button>
          {textToAnalyze.length > 0 && textToAnalyze.length < 50 && (
            <p className="mt-2 text-[10px] text-amber-600 font-bold uppercase tracking-tighter text-center italic">Insufficient data for stable analysis (at least 50 chars recommended)</p>
          )}

          {organization?.voiceProfile && (
            <div className="mt-8 pt-8 border-t border-slate-100">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Current Profile Indicators</p>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Tone Descriptors</span>
                  <div className="flex flex-wrap gap-2">
                    {organization.voiceProfile.toneDescriptors?.map((t: string) => (
                      <span key={t} className="bg-slate-50 text-slate-600 px-2 py-1 rounded text-[10px] font-bold border border-slate-100 uppercase">{t}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase font-bold mb-1">Writing Maturity</span>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: `${organization.voiceProfile.maturityScore}%` }}></div>
                    </div>
                    <span className="font-bold text-slate-700">{organization.voiceProfile.maturityScore}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-xl shadow-xl flex flex-col">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center mb-6">
              <Mic className="text-white" size={20} />
            </div>
            <h4 className="font-bold text-lg mb-2">Voice Rewriter</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">Transform any drafted text into your signature organization voice.</p>
            <div className="mb-4">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">Voice Style Target</label>
              <select 
                value={selectedProfileId || ''} 
                onChange={(e) => onSetSelectedProfileId(e.target.value)}
                className="w-full bg-slate-800/50 border-transparent rounded-lg text-xs p-2 text-white outline-none mb-2"
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
              placeholder="Paste draft text here..."
              className="w-full h-32 p-3 bg-slate-800/50 border-transparent rounded-lg text-xs focus:bg-slate-800 transition-all outline-none mb-4 text-white placeholder:text-slate-500"
            />
            <button 
              onClick={rewriteText}
              disabled={isRewriting || !textToRewrite.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {isRewriting ? 'Rewriting...' : 'Rewrite with Neural Voice'}
            </button>
          </div>

          {rewrittenText && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block mb-2">Result</span>
              <p className="text-sm text-slate-700 italic leading-relaxed">{rewrittenText}</p>
            </motion.div>
          )}
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

function OutreachView({ organization }: { organization: any }) {
  const [showGuide, setShowGuide] = useState(false);

  const guideSteps = [
     { title: "Strategic Outreach", content: "Generate surgical emails and letters or introduction to funders that haven't been reached out to yet." },
     { title: "Funder Personalization", content: "AI uses the funder intelligence reports to bridge your organization mission with their specific strategic shifts." },
     { title: "Response Optimization", content: "Draft follow-ups or LOIs that maximize the probability of a meeting invitation based on historical success patterns." }
  ];
  const [missingComponents, setMissingComponents] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
        >
          {isChecking ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
          {isChecking ? 'Auditing...' : 'Audit Build Requirements'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <OutreachStat label="Neural Link" value="Stable" color="green" />
        <OutreachStat label="Auth Integrity" value="High" color="blue" />
        <OutreachStat label="DB Readiness" value="Nominal" color="green" />
        <OutreachStat label="API Quota" value="Spark" color="orange" />
      </div>

      {missingComponents.length > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden mb-8">
          <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
            <AlertTriangle className="text-amber-600" size={18} />
            <span className="text-sm font-bold text-amber-900 uppercase tracking-tight">Improvement Vector Identified</span>
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500 uppercase">Recent System Events</span>
          <button className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Clear Logs</button>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center"><Globe size={16} className="text-slate-400" /></div>
              <div>
                <p className="text-sm font-medium text-slate-900">Firestore Hook Initialized</p>
                <p className="text-[10px] text-slate-400">Success • System Core</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tight">Active</span>
          </div>
        </div>
      </div>

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
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userMessage: userMsg,
          orgProfile: organization,
          pipelineSummary: `Currently managing ${proposals.length} proposals and ${proposals.filter(p => p.status === 'draft').length} drafts.`
        })
      });
      const text = await res.text();
      setMessages(prev => [...prev, { role: 'assistant', text }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: "Strategic uplink interrupted. Please retry your request." }]);
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
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
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  const events = [
    ...grants.filter(g => g.deadline).map(g => ({ date: new Date(g.deadline), title: g.title, type: 'grant', color: 'rose' })),
    ...proposals.map(p => ({ date: new Date(p.updatedAt), title: p.title, type: 'proposal', color: 'indigo' }))
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-slate-900">Nexus Calendar</h3>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Timeline & Lifecycles</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white px-4 py-2 rounded-full shadow-lg shadow-slate-100">
          {now.toLocaleString('default', { month: 'long' })} {currentYear}
        </span>
      </div>

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
                        <div key={idx} className={`text-[9px] font-bold py-1 px-2 rounded-lg truncate border leading-tight ${
                          e.color === 'rose' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                        }`}>
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
    </motion.div>
  );
}

function PageGuide({ isOpen, onClose, title, steps }: { isOpen: boolean, onClose: () => void, title: string, steps: { title: string, content: string }[] }) {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6 text-left">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full overflow-hidden"
      >
        <div className="relative p-10 space-y-6">
          <div className="flex justify-between items-start">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Sparkles className="text-indigo-600" size={28} />
            </div>
            <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
              <X size={24} />
            </button>
          </div>
          <div>
            <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2">{title} Guide</h3>
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">{steps[step].title}</h4>
            <p className="text-sm text-slate-500 mt-4 leading-relaxed font-medium">{steps[step].content}</p>
          </div>
          <div className="flex items-center gap-2 pt-4">
             {steps.map((_, i) => (
               <div key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-100'}`}></div>
             ))}
          </div>
          <div className="flex gap-4 pt-4 border-t border-slate-50">
            {step > 0 && (
              <button 
                onClick={() => setStep(step - 1)}
                className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-50"
              >
                Back
              </button>
            )}
            <button 
              onClick={() => {
                if (step < steps.length - 1) setStep(step + 1);
                else onClose();
              }}
              className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100"
            >
              {step < steps.length - 1 ? 'Next Step' : 'Got it, thanks!'}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Walkthrough({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { title: "Nexus Dashboard", content: "Your strategic nerve center. Monitor grant pipelines, system health, and mission alignment scores in real-time." },
    { title: "Rich Proposal Studio", content: "Build complex budgets with AI-generated justifications, track every version, and split/merge sections for perfect flow." },
    { title: "Funder Intelligence 2.0", content: "Go beyond bios. Analyze strategic shifts with AI re-research, track relationship stages, and filter by historical analysis dates." },
    { title: "Voice & Outreach", content: "Train the system on your unique ADR voice. Then use that voice to generate surgical outreach to perfectly matched funders." },
    { title: "Smart Matching", content: "Our matching engine scans global datasets to find the exact grants that align with your civic equity and ADR mission." }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-6 text-left">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[40px] shadow-2xl max-w-xl w-full overflow-hidden"
      >
        <div className="relative p-12 space-y-8">
          <div className="flex justify-between items-start">
            <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-200">
              <HelpCircle className="text-white" size={32} />
            </div>
            <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
              <X size={24} />
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Module {step + 1} / {steps.length}</span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>
            <h4 className="text-3xl font-black text-slate-900 tracking-tight">{steps[step].title}</h4>
            <p className="text-base text-slate-500 mt-4 leading-relaxed font-medium">{steps[step].content}</p>
          </div>
          <div className="flex gap-4 pt-4">
            {step > 0 && (
              <button 
                onClick={() => setStep(step - 1)}
                className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-bold text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50 hover:border-slate-200 transition-all"
              >
                Previous
              </button>
            )}
            <button 
              onClick={() => {
                if (step < steps.length - 1) setStep(step + 1);
                else onClose();
              }}
              className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-100"
            >
              {step < steps.length - 1 ? 'Continue Tour' : 'Launch System'}
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </motion.div>
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
