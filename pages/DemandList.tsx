
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  useReactTable, 
  getCoreRowModel, 
  flexRender, 
  createColumnHelper 
} from '@tanstack/react-table';
import { 
  Search, Plus, ChevronRight, ChevronLeft, X, User, 
  Sparkles, Loader2, Copy, Building2, Paperclip, Save,
  History, Lock, Unlock, Eye, ClipboardCheck, Tag, ExternalLink,
  FileText
} from 'lucide-react';
import { DemandService, ConstituentService, CategoryService } from '../services/api';
import { AIService } from '../services/ai';
import { mockUsers } from '../services/mockData';
import { Demand, Constituent, TimelineEvent, DemandStatus, Category } from '../types';
import DemandStatusBadge from '../components/DemandStatusBadge';
import DemandTimeline from '../components/DemandTimeline';
import DemandCreateModal from '../components/DemandCreateModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const SETE_LAGOAS_ORGANS = [
  "Câmara Municipal de Sete Lagoas",
  "Prefeitura Municipal de Sete Lagoas",
  "Procuradoria Geral do Município",
  "Secretaria de Saúde",
  "Secretaria de Educação",
  "Secretaria de Obras",
  "SAAE - Sete Lagoas",
  "Outro"
];

const columnHelper = createColumnHelper<Demand & { 
  constituent_name?: string; 
  category_name?: string;
  last_user_name?: string;
  last_activity_at?: string;
}>();

const DemandList: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [demands, setDemands] = useState<Demand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filterTab, setFilterTab] = useState<'MY_SECTOR' | 'ACTIVE' | 'FINISHED' | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [selectedDemand, setSelectedDemand] = useState<Demand | null>(null);
  const [selectedConstituent, setSelectedConstituent] = useState<Constituent | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  
  const [externalSector, setExternalSector] = useState('');
  const [customSector, setCustomSector] = useState('');
  const [protocolExternal, setProtocolExternal] = useState('');
  const [protocolDate, setProtocolDate] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [isSavingExternal, setIsSavingExternal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState('');

  useEffect(() => {
    loadData();
    if (location.state?.activeTab) {
      setFilterTab(location.state.activeTab);
    }
  }, [location.state]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [d, c, e] = await Promise.all([
        DemandService.getAll(),
        CategoryService.getAll(),
        ConstituentService.getAll()
      ]);
      setDemands(d);
      setCategories(c);
      setConstituents(e);
    } finally {
      setLoading(false);
    }
  };

  const isFinalized = (status: DemandStatus) => ['SUCCESS', 'UNFEASIBLE', 'ARCHIVED'].includes(status);

  const enrichedDemands = useMemo(() => {
    return demands.map(d => {
      const lastUser = mockUsers.find(u => u.id === (d.updated_by || d.created_by));
      return {
        ...d,
        constituent_name: constituents.find(c => c.id === d.constituent_id)?.name || 'Desconhecido',
        category_name: categories.find(cat => cat.id === d.category_id)?.name || 'Geral',
        last_user_name: lastUser?.name.split(' ')[0] || 'Sistema',
        last_activity_at: d.updated_at || d.created_at
      };
    });
  }, [demands, constituents, categories]);

  const filteredDemands = useMemo(() => {
    return enrichedDemands.filter(d => {
      const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            d.protocol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            d.constituent_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || d.category_id === selectedCategory;
      
      let matchesTab = true;
      if (filterTab === 'MY_SECTOR') matchesTab = currentUser?.sectors?.includes(d.category_id) || false;
      else if (filterTab === 'ACTIVE') matchesTab = !isFinalized(d.status);
      else if (filterTab === 'FINISHED') matchesTab = isFinalized(d.status);
      
      return matchesSearch && matchesCategory && matchesTab;
    });
  }, [enrichedDemands, searchTerm, selectedCategory, filterTab, currentUser]);

  const columns = useMemo(() => [
    columnHelper.accessor('protocol', {
      header: 'Protocolo',
      cell: info => <span className="text-[10px] font-black text-slate-400 font-mono tracking-tighter uppercase">#{info.getValue()}</span>
    }),
    columnHelper.accessor('constituent_name', {
      header: 'Eleitor',
      cell: info => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black uppercase border border-blue-100 shadow-sm">{info.getValue()?.charAt(0)}</div>
          <span className="text-sm font-black text-slate-800 uppercase truncate max-w-[200px]">{info.getValue()}</span>
        </div>
      )
    }),
    columnHelper.accessor('category_name', {
      header: 'Setor',
      cell: info => <span className="text-[9px] font-black px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 uppercase tracking-widest border border-slate-200">{info.getValue()}</span>
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => <DemandStatusBadge status={info.getValue()} />
    }),
    columnHelper.display({
      id: 'last_movement',
      header: 'Movimentação',
      cell: info => (
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-900 uppercase flex items-center gap-1.5"><User size={10} className="text-blue-500" /> {info.row.original.last_user_name}</span>
          <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(info.row.original.last_activity_at!).toLocaleDateString()}</span>
        </div>
      )
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: () => <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
    })
  ], []);

  const table = useReactTable({
    data: filteredDemands,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleOpenDetails = async (demand: Demand) => {
    setSelectedDemand(demand);
    const currentSector = demand.external_sector || '';
    const isPredefined = SETE_LAGOAS_ORGANS.includes(currentSector);
    setExternalSector(isPredefined ? currentSector : (currentSector ? 'Outro' : ''));
    setCustomSector(!isPredefined ? currentSector : '');
    setProtocolExternal(demand.protocol_external || '');
    setProtocolDate(demand.protocol_date || '');
    setExternalLink(demand.external_link || '');
    setGeneratedDraft('');
    setIsFullscreenOpen(true);
    const [constituent, history] = await Promise.all([
      ConstituentService.getById(demand.constituent_id),
      DemandService.getTimeline(demand.id)
    ]);
    setSelectedConstituent(constituent || null);
    setTimeline(history);
  };

  const handleSaveExternal = async () => {
    if (!selectedDemand || !currentUser) return;
    setIsSavingExternal(true);
    const finalSector = externalSector === 'Outro' ? customSector : externalSector;
    try {
      const updated = await DemandService.update(selectedDemand.id, currentUser.id, {
        external_sector: finalSector,
        protocol_external: protocolExternal,
        protocol_date: protocolDate,
        external_link: externalLink
      });
      await DemandService.addTimelineEvent(selectedDemand.id, currentUser.id, {
        type: 'EXTERNAL_UPDATE',
        description: `Vinculada documentação externa. Órgão: ${finalSector || 'N/A'} | Prot: ${protocolExternal || 'N/A'}`
      });
      setSelectedDemand(updated);
      setDemands(prev => prev.map(d => d.id === updated.id ? updated : d));
      const newTimeline = await DemandService.getTimeline(selectedDemand.id);
      setTimeline(newTimeline);
      showToast("Dados de trâmite atualizados.");
    } finally {
      setIsSavingExternal(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDemand || !currentUser) return;
    
    setIsUploading(true);
    try {
      const fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      const attachment = await DemandService.addAttachment(selectedDemand.id, currentUser.id, {
        name: file.name,
        type: file.type,
        size: fileSize
      });
      
      const updatedDemand = {
        ...selectedDemand,
        attachments: [...(selectedDemand.attachments || []), attachment]
      };
      
      setSelectedDemand(updatedDemand);
      setDemands(prev => prev.map(d => d.id === selectedDemand.id ? updatedDemand : d));
      const newTimeline = await DemandService.getTimeline(selectedDemand.id);
      setTimeline(newTimeline);
      showToast("Documento anexado.");
    } catch (error) {
      showToast("Erro ao anexar arquivo.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: DemandStatus) => {
    if (!selectedDemand || !currentUser) return;
    try {
      await DemandService.updateStatus(selectedDemand.id, currentUser.id, newStatus);
      const updatedDemand = { ...selectedDemand, status: newStatus };
      setSelectedDemand(updatedDemand);
      setDemands(prev => prev.map(d => d.id === selectedDemand.id ? updatedDemand : d));
      const newTimeline = await DemandService.getTimeline(selectedDemand.id);
      setTimeline(newTimeline);
      showToast(`Status atualizado para ${newStatus}.`);
    } catch (error) {
      showToast('Erro ao atualizar status', 'error');
    }
  };

  const handleUnlockDemand = async () => {
    if (!selectedDemand || !currentUser || !unlockReason.trim()) return;
    try {
      await DemandService.updateStatus(selectedDemand.id, currentUser.id, 'OPEN', unlockReason);
      const updatedDemand = { ...selectedDemand, status: 'OPEN' as DemandStatus };
      setSelectedDemand(updatedDemand);
      setDemands(prev => prev.map(d => d.id === selectedDemand.id ? updatedDemand : d));
      const newTimeline = await DemandService.getTimeline(selectedDemand.id);
      setTimeline(newTimeline);
      setIsUnlockModalOpen(false);
      setUnlockReason('');
      showToast("Demanda reaberta para trâmite.");
    } catch (error) {
      showToast('Erro ao reabrir demanda', 'error');
    }
  };

  const handleDocIA = async (type: string) => {
    if (!selectedDemand || !selectedConstituent) return;
    setAiLoading(true);
    try {
      const draft = await AIService.generateOfficialLetter(selectedDemand.title, selectedDemand.description, selectedConstituent.name);
      setGeneratedDraft(draft);
      showToast(`${type} gerado com sucesso.`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 page-enter pb-24 min-h-screen">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.8rem] flex items-center justify-center shadow-2xl shadow-blue-200">
             <ClipboardCheck size={32} />
           </div>
           <div>
             <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Demandas</h1>
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 italic">Gestão de Trâmites e Protocolos</p>
           </div>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="px-10 py-5 bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-3"
        >
          <Plus size={20} /> Adicionar Demanda
        </button>
      </header>

      <div className="flex flex-col xl:flex-row gap-6 items-center">
        <div className="flex bg-white p-1.5 rounded-[2.2rem] border border-slate-200 shadow-xl overflow-x-auto w-full xl:w-auto">
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'MY_SECTOR', label: 'Minhas Áreas' },
            { id: 'ACTIVE', label: 'Em Aberto' },
            { id: 'FINISHED', label: 'Histórico' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setFilterTab(tab.id as any)} 
              className={`px-6 py-3.5 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap active:scale-95 ${filterTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 bg-white px-5 py-2.5 rounded-[2rem] border border-slate-200 shadow-lg w-full xl:w-auto">
          <Tag size={16} className="text-slate-400" />
          <select 
            className="bg-transparent text-[10px] font-black text-slate-600 uppercase outline-none cursor-pointer w-full xl:w-48"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">Filtrar por Setor: Todos</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 relative group w-full">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={22} />
          <input 
            type="text" 
            placeholder="Buscar por protocolo, eleitor ou assunto..." 
            className="w-full pl-16 pr-6 py-5 bg-white border border-slate-200 rounded-[2.5rem] text-sm font-bold outline-none shadow-xl focus:ring-4 focus:ring-blue-600/5 transition-all" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-slate-50/50 border-b border-slate-100">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{flexRender(header.column.columnDef.header, header.getContext())}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="py-32 text-center"><Loader2 className="animate-spin inline-block text-blue-600" size={40} /></td></tr>
              ) : table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map(row => (
                <tr key={row.id} onClick={() => handleOpenDetails(row.original)} className="hover:bg-blue-50/30 cursor-pointer transition-all group">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-10 py-7">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              )) : (
                <tr><td colSpan={7} className="py-32 text-center italic text-slate-400 font-bold uppercase tracking-widest">Nenhuma demanda filtrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFullscreenOpen && selectedDemand && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-300">
          <header className="h-24 border-b border-slate-100 flex items-center justify-between px-12 shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-8">
              <button onClick={() => setIsFullscreenOpen(false)} className="p-4 hover:bg-slate-100 rounded-[1.5rem] text-slate-400 transition-all"><ChevronLeft size={32} /></button>
              <div className="flex flex-col">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{selectedDemand.title}</h2>
                  <DemandStatusBadge status={selectedDemand.status} />
                </div>
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Protocolo Interno: #{selectedDemand.protocol}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               {isFinalized(selectedDemand.status) ? (
                 <button onClick={() => setIsUnlockModalOpen(true)} className="flex items-center gap-3 px-8 py-4 bg-rose-50 text-rose-600 rounded-[1.5rem] text-[10px] font-black uppercase border border-rose-100 shadow-xl"><Unlock size={18} /> Reabrir Registro</button>
               ) : (
                 <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-[1.8rem] border border-slate-200">
                    {(['ANALYSIS', 'IN_PROGRESS', 'WAITING_THIRD_PARTY', 'SUCCESS', 'UNFEASIBLE'] as DemandStatus[]).map((s) => (
                      <button key={s} onClick={() => handleUpdateStatus(s)} className={`px-6 py-3 rounded-[1.2rem] text-[9px] font-black uppercase transition-all ${selectedDemand.status === s ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                        {s === 'ANALYSIS' ? 'Análise' : s === 'IN_PROGRESS' ? 'Trâmite' : s === 'WAITING_THIRD_PARTY' ? 'Pendente' : s === 'SUCCESS' ? 'Sucesso' : 'Inviável'}
                      </button>
                    ))}
                 </div>
               )}
               <button onClick={() => setIsFullscreenOpen(false)} className="p-4 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-[1.5rem] transition-all"><X size={32} /></button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            <aside className="w-[300px] border-r border-slate-100 p-8 overflow-y-auto custom-scrollbar bg-slate-50/30 space-y-8">
              <section className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User size={16} /> Solicitante</p>
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-blue-600 text-white flex items-center justify-center font-black text-2xl shadow-xl">{selectedConstituent?.name.charAt(0)}</div>
                    <div className="min-w-0">
                      <p className="text-base font-black text-slate-900 truncate uppercase">{selectedConstituent?.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate">{selectedConstituent?.address.neighborhood}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Building2 size={16} /> Trâmite Externo</p>
                <div className={`bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4 ${isFinalized(selectedDemand.status) ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Órgão Alvo</label>
                    <select value={externalSector} onChange={(e) => setExternalSector(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none cursor-pointer">
                      <option value="">Selecione...</option>
                      {SETE_LAGOAS_ORGANS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Prot. Externo</label>
                    <input value={protocolExternal} onChange={(e) => setProtocolExternal(e.target.value)} placeholder="EX: 123/24" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-blue-600 outline-none" />
                  </div>
                  <button onClick={handleSaveExternal} disabled={isSavingExternal} className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2">
                    {isSavingExternal ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar Trâmite
                  </button>
                </div>
              </section>
            </aside>

            <main className="flex-1 bg-white relative z-10 shadow-2xl flex flex-col">
              <div className="p-10 overflow-y-auto custom-scrollbar space-y-10 flex-1">
                <section className="space-y-4">
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3"><Eye size={24} className="text-blue-600" /> Relato Original</h3>
                   <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 shadow-inner text-base text-slate-700 leading-relaxed font-medium italic relative">
                      <div className="absolute left-0 top-0 w-2 h-full bg-blue-600 rounded-l-[3rem]" />
                      "{selectedDemand.description}"
                   </div>
                </section>

                <section className="space-y-6 pt-10 border-t border-slate-100">
                  <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-3"><History size={24} className="text-slate-400" /> Trilha de Auditoria</h4>
                  <div className="bg-slate-50/50 p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                    <DemandTimeline 
                        events={timeline} 
                        onAddComment={(text) => {
                          DemandService.addTimelineEvent(selectedDemand.id, currentUser!.id, { type: 'COMMENT', description: text });
                          DemandService.getTimeline(selectedDemand.id).then(setTimeline);
                          showToast("Nota registrada.");
                        }} 
                      />
                  </div>
                </section>
              </div>
            </main>

            <aside className="w-[350px] border-l border-slate-100 p-8 overflow-y-auto custom-scrollbar bg-slate-50/30 space-y-10">
               <section className="space-y-4">
                 <div className="flex items-center justify-between">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Paperclip size={16} /> Documentos Anexos</p>
                   <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-white text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl shadow-xl border border-slate-100 transition-all"><Plus size={16} /></button>
                   <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                 </div>
                 <div className="space-y-3">
                   {selectedDemand.attachments?.map(att => (
                     <div key={att.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-blue-500">
                       <div className="flex items-center gap-3 truncate">
                         <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0"><FileText size={20} /></div>
                         <p className="text-[11px] font-black text-slate-900 truncate uppercase">{att.name}</p>
                       </div>
                       <ExternalLink size={14} className="text-slate-300 group-hover:text-blue-600" />
                     </div>
                   ))}
                 </div>
               </section>

               <section className="space-y-4 pt-10 border-t border-slate-100">
                 <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={16} /> Inteligência do Gabinete</p>
                 </div>
                 <div className="grid grid-cols-1 gap-3">
                    <button onClick={() => handleDocIA('OFÍCIO')} disabled={aiLoading} className="w-full py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-xl">Minutar Ofício IA</button>
                    <button onClick={() => handleDocIA('REQUERIMENTO')} disabled={aiLoading} className="w-full py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-xl">Minutar Requerimento IA</button>
                 </div>
                 {generatedDraft && (
                    <div className="animate-in fade-in slide-in-from-top-4 space-y-4">
                       <div className="bg-slate-900 text-emerald-400 p-6 rounded-[2.5rem] text-[9px] font-mono leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar shadow-2xl">
                         <pre className="whitespace-pre-wrap">{generatedDraft}</pre>
                       </div>
                       <button onClick={() => { navigator.clipboard.writeText(generatedDraft); showToast("Copiado!"); }} className="w-full py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"><Copy size={16} /> Copiar Texto</button>
                    </div>
                 )}
               </section>
            </aside>
          </div>
        </div>
      )}

      <DemandCreateModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSuccess={loadData} 
      />

      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-lg rounded-[2.5rem] shadow-2xl p-10 border border-white/20 space-y-8">
              <div className="flex items-center gap-4 text-rose-600">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center shadow-inner"><Lock size={28} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reabrir Trâmite</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prot: #{selectedDemand?.protocol}</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Motivo da Reabertura</label>
                <textarea rows={4} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none resize-none focus:ring-4 focus:ring-rose-500/10 transition-all" value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsUnlockModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase tracking-widest">Cancelar</button>
                <button onClick={handleUnlockDemand} disabled={!unlockReason.trim()} className="flex-1 py-4 bg-rose-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl">Confirmar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DemandList;
