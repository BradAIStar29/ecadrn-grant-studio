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

