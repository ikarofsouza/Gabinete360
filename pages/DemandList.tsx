
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
  FileText, ArrowRightLeft, Upload, Trash2, ShieldAlert, MessageCircle, AlertCircle, FileX
} from 'lucide-react';
import { DemandService, ConstituentService, CategoryService } from '../services/api';
import { AIService } from '../services/ai';
import { mockUsers } from '../services/mockData';
import { logger } from '../services/LoggerService';
import { Demand, Constituent, TimelineEvent, DemandStatus, Category, DemandAttachment } from '../types';
import DemandStatusBadge from '../components/DemandStatusBadge';
import DemandTimeline from '../components/DemandTimeline';
import DemandCreateModal from '../components/DemandCreateModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const columnHelper = createColumnHelper<Demand & { 
  constituent_name?: string; 
  category_name?: string;
  display_user_name?: string;
  last_activity_at?: string;
}>();

const maskPhone = (v: string) => {
  if (!v) return '';
  v = v.replace(/\D/g, '');
  if (v.startsWith('55') && v.length > 10) v = v.substring(2);
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
  v = v.replace(/(\d{5})(\d)/, '$1-$2');
  return v.substring(0, 15);
};

const SETE_LAGOAS_ORGANS = [
  "Câmara Municipal de Sete Lagoas",
  "Controladoria-Geral do Município",
  "Núcleo de Licitações e Compras",
  "Prefeitura Municipal de Sete Lagoas",
  "Procuradoria Geral do Município",
  "SAAE - Serviço Autônomo de Água e Esgoto",
  "Secretaria da Mulher",
  "Secretaria de Administração e Tecnologia da Informação",
  "Secretaria de Assistência Social",
  "Secretaria de Cultura",
  "Secretaria de Desenvolvimento Econômico, Turismo e Agropecuária",
  "Secretaria de Educação",
  "Secretaria de Esportes e Lazer",
  "Secretaria de Fazenda e Planejamento",
  "Secretaria de Governo",
  "Secretaria de Meio Ambiente e Sustentabilidade",
  "Secretaria de Mobilidade Urbana",
  "Secretaria de Obras, Infraestrutura e Serviços Urbanos",
  "Secretaria de Saúde"
].sort();

const DemandList: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tramitFileInputRef = useRef<HTMLInputElement>(null);
  
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
  const [internalTransferCategoryId, setInternalTransferCategoryId] = useState('');
  
  const [isSavingExternal, setIsSavingExternal] = useState(false);
  const [isTransferringInternal, setIsTransferringInternal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState('');

  const [isDeleteAttachmentModalOpen, setIsDeleteAttachmentModalOpen] = useState(false);
  const [attachmentToDelete, setAttachmentToDelete] = useState<DemandAttachment | null>(null);

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
      return {
        ...d,
        constituent_name: constituents.find(c => c.id === d.constituent_id)?.name || 'Desconhecido',
        category_name: categories.find(cat => cat.id === d.category_id)?.name || 'Geral',
        display_user_name: d.last_user_name?.split(' ')[0] || 'Gabinete',
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
        <div className="flex flex-col gap-1 max-w-[300px]">
          <span className="text-[10px] font-black text-slate-900 uppercase leading-tight line-clamp-1 italic text-blue-600">
            {info.row.original.last_action_label || 'Aguardando ação...'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
              <User size={8} /> {info.row.original.display_user_name}
            </span>
            <span className="text-[9px] font-bold text-slate-300 uppercase">•</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">
              {new Date(info.row.original.last_activity_at!).toLocaleDateString('pt-BR')}
            </span>
          </div>
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
    setExternalSector(demand.external_sector || '');
    setCustomSector('');
    setProtocolExternal(demand.protocol_external || '');
    setProtocolDate(demand.protocol_date || '');
    setExternalLink(demand.external_link || '');
    setInternalTransferCategoryId(demand.category_id);
    setIsFullscreenOpen(true);
    const [constituent, history] = await Promise.all([
      ConstituentService.getById(demand.constituent_id),
      DemandService.getTimeline(demand.id)
    ]);
    setSelectedConstituent(constituent || null);
    setTimeline(history);
  };

  const handleViewAttachment = (url: string) => {
    if (!url || url === '#' || url === '') {
      showToast("Link do documento inválido ou não sincronizado.", "error");
      return;
    }
    const win = window.open(url, '_blank');
    if (win) {
      win.focus();
    } else {
      showToast("Bloqueador de popups impediu a visualização.", "error");
    }
  };

  const handleDeleteAttachmentRequest = (e: React.MouseEvent, att: DemandAttachment) => {
    e.stopPropagation();
    setAttachmentToDelete(att);
    setIsDeleteAttachmentModalOpen(true);
  };

  const confirmDeleteAttachment = async () => {
    if (!selectedDemand || !currentUser || !attachmentToDelete) return;
    try {
      setLoading(true);
      await DemandService.removeAttachment(selectedDemand.id, currentUser, attachmentToDelete.id);
      
      const updatedAttachments = selectedDemand.attachments?.filter(a => a.id !== attachmentToDelete.id) || [];
      const updatedDemand = { ...selectedDemand, attachments: updatedAttachments };
      
      setSelectedDemand(updatedDemand);
      setDemands(prev => prev.map(d => d.id === selectedDemand.id ? updatedDemand : d));
      
      const newTimeline = await DemandService.getTimeline(selectedDemand.id);
      setTimeline(newTimeline);
      
      showToast("Anexo removido.");
      setIsDeleteAttachmentModalOpen(false);
      setAttachmentToDelete(null);
    } catch (e) {
      showToast("Erro ao remover anexo.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExternal = async () => {
    if (!selectedDemand || !currentUser) return;
    setIsSavingExternal(true);
    const finalSector = externalSector === 'Outro' ? customSector : externalSector;
    try {
      const updated = await DemandService.update(selectedDemand.id, currentUser, {
        external_sector: finalSector,
        protocol_external: protocolExternal,
        protocol_date: protocolDate,
        external_link: externalLink
      });
      
      const updateMsg = `Trâmite Externo: Protocolo ${protocolExternal || '---'} em ${finalSector || 'Órgão'}`;
      
      await DemandService.addTimelineEvent(selectedDemand.id, currentUser, {
        type: 'EXTERNAL_UPDATE',
        description: `DADOS EXTERNOS ATUALIZADOS: Órgão Alvo: ${finalSector || 'Não Definido'}. Prot. Externo: ${protocolExternal || '---'}.`
      });

      setSelectedDemand({ ...updated, last_action_label: updateMsg, last_user_name: currentUser.name });
      setDemands(prev => prev.map(d => d.id === updated.id ? { ...updated, last_action_label: updateMsg, last_user_name: currentUser.name } : d));
      const newTimeline = await DemandService.getTimeline(selectedDemand.id);
      setTimeline(newTimeline);
      showToast("Dados de trâmite atualizados.");
    } catch (e) {
      showToast("Erro ao atualizar trâmite externo.", "error");
    } finally {
      setIsSavingExternal(false);
    }
  };

  const handleTransferInternal = async () => {
    if (!selectedDemand || !currentUser || !internalTransferCategoryId || internalTransferCategoryId === selectedDemand.category_id) return;
    setIsTransferringInternal(true);
    try {
      const oldCat = categories.find(c => c.id === selectedDemand.category_id)?.name || 'Desconhecido';
      const newCat = categories.find(c => c.id === internalTransferCategoryId)?.name || 'Desconhecido';
      
      const updated = await DemandService.update(selectedDemand.id, currentUser, {
        category_id: internalTransferCategoryId
      });
      
      const transferMsg = `Setor alterado de ${oldCat} para ${newCat}`;

      await DemandService.addTimelineEvent(selectedDemand.id, currentUser, {
        type: 'STATUS_CHANGE',
        description: `TRANSFERÊNCIA DE SETOR: De ${oldCat} para ${newCat}.`
      });

      setSelectedDemand({ ...updated, last_action_label: transferMsg, last_user_name: currentUser.name });
      setDemands(prev => prev.map(d => d.id === updated.id ? { ...updated, last_action_label: transferMsg, last_user_name: currentUser.name } : d));
      const newTimeline = await DemandService.getTimeline(selectedDemand.id);
      setTimeline(newTimeline);
      showToast(`Demanda transferida para ${newCat}.`);
    } finally {
      setIsTransferringInternal(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDemand || !currentUser) return;
    
    setIsUploading(true);
    try {
      const fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      const fileUrl = URL.createObjectURL(file); 
      const attachment = await DemandService.addAttachment(selectedDemand.id, currentUser, {
        name: file.name,
        type: file.type,
        size: fileSize,
        url: fileUrl
      });
      
      const updatedDemand = {
        ...selectedDemand,
        attachments: [...(selectedDemand.attachments || []), attachment],
        last_action_label: `Arquivo anexado: ${file.name}`,
        last_user_name: currentUser.name
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
      const event = await DemandService.updateStatus(selectedDemand.id, currentUser, newStatus);
      
      const updatedDemand = { 
        ...selectedDemand, 
        status: newStatus,
        last_action_label: event.description,
        last_user_name: currentUser.name,
        updated_at: new Date().toISOString(),
        updated_by: currentUser.id
      };
      
      setSelectedDemand(updatedDemand);
      setDemands(prev => prev.map(d => d.id === selectedDemand.id ? updatedDemand : d));
      
      const newTimeline = await DemandService.getTimeline(selectedDemand.id);
      setTimeline(newTimeline);
      showToast(`Status atualizado.`);
    } catch (error) {
      console.error("Status Update Error:", error);
      showToast('Erro ao atualizar status do registro.', 'error');
    }
  };

  const handleUnlockDemand = async () => {
    if (!selectedDemand || !currentUser || !unlockReason.trim()) return;
    try {
      await DemandService.updateStatus(selectedDemand.id, currentUser, 'OPEN', unlockReason);
      
      const updatedDemand = { 
        ...selectedDemand, 
        status: 'OPEN' as DemandStatus,
        last_action_label: 'Demanda reaberta para trâmite',
        last_user_name: currentUser.name,
        updated_at: new Date().toISOString(),
        updated_by: currentUser.id
      };
      
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

  const handleDeleteRequest = () => {
    if (!selectedDemand) return;
    setDeleteId(selectedDemand.id);
    setDeletionReason('');
    setIsDeleteModalOpen(true);
  };

  const confirmDeletion = async () => {
    if (!currentUser || !deleteId || !deletionReason.trim()) return;

    try {
      setLoading(true);
      await DemandService.delete(deleteId, currentUser, deletionReason);
      
      setDemands(prev => prev.filter(d => d.id !== deleteId));
      setIsFullscreenOpen(false);
      setSelectedDemand(null);

      showToast("Demanda enviada para Quarentena de Auditoria.");
      logger.log('DELETE_REQUESTED', 'DEMAND', deleteId, currentUser, undefined, { reason: deletionReason });
      
      setIsDeleteModalOpen(false);
      setDeleteId(null);
    } catch (error) {
      showToast("Erro ao processar solicitação.", "error");
    } finally {
      setLoading(false);
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
                 <button onClick={() => setIsUnlockModalOpen(true)} className="flex items-center gap-3 px-8 py-4 bg-emerald-50 text-emerald-600 rounded-[1.5rem] text-[10px] font-black uppercase border border-emerald-100 shadow-xl"><Unlock size={18} /> Reabrir Registro</button>
               ) : (
                 <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-[1.8rem] border border-slate-200">
                    {(['ANALYSIS', 'IN_PROGRESS', 'WAITING_THIRD_PARTY', 'SUCCESS', 'UNFEASIBLE'] as DemandStatus[]).map((s) => (
                      <button key={s} onClick={() => handleUpdateStatus(s)} className={`px-6 py-3 rounded-[1.2rem] text-[9px] font-black uppercase transition-all ${selectedDemand.status === s ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                        {s === 'ANALYSIS' ? 'Análise' : s === 'IN_PROGRESS' ? 'Trâmite' : s === 'WAITING_THIRD_PARTY' ? 'Pendente' : s === 'SUCCESS' ? 'Sucesso' : 'Inviável'}
                      </button>
                    ))}
                 </div>
               )}
               <button onClick={handleDeleteRequest} className="p-4 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-[1.5rem] transition-all" title="Excluir Registro"><Trash2 size={28} /></button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            <aside className="w-[320px] border-r border-slate-100 p-8 overflow-y-auto custom-scrollbar bg-slate-50/30 space-y-8 shrink-0">
              <section className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><User size={16} /> Solicitante</p>
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-blue-600 text-white flex items-center justify-center font-black text-2xl shadow-xl">{selectedConstituent?.name.charAt(0)}</div>
                    <div className="min-w-0">
                      <p className="text-base font-black text-slate-900 truncate uppercase">{selectedConstituent?.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest truncate">{maskPhone(selectedConstituent?.mobile_phone || '')}</p>
                        {selectedConstituent?.mobile_phone && (
                          <a 
                            href={`https://wa.me/${selectedConstituent.mobile_phone.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-emerald-500 hover:text-emerald-600 transition-colors"
                          >
                            <MessageCircle size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Building2 size={16} /> Trâmite Externo</p>
                <div className={`bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4 ${isFinalized(selectedDemand.status) ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Órgão Alvo</label>
                    <select value={externalSector} onChange={(e) => setExternalSector(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold outline-none cursor-pointer uppercase">
                      <option value="">Selecione o Órgão...</option>
                      {SETE_LAGOAS_ORGANS.map(organ => <option key={organ} value={organ}>{organ.toUpperCase()}</option>)}
                      <option value="Outro">OUTRO (ESPECIFICAR)</option>
                    </select>
                  </div>
                  {externalSector === 'Outro' && (
                    <div className="space-y-1 animate-in slide-in-from-top-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Especifique o Órgão</label>
                      <input value={customSector} onChange={(e) => setCustomSector(e.target.value.toUpperCase())} placeholder="NOME DO ÓRGÃO EXTERNO" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none uppercase" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Prot. Externo</label>
                    <input value={protocolExternal} onChange={(e) => setProtocolExternal(e.target.value)} placeholder="EX: 123/24" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-blue-600 outline-none" />
                  </div>
                  
                  <div className="pt-2">
                    <button 
                      onClick={() => tramitFileInputRef.current?.click()} 
                      className="w-full py-3 bg-white border-2 border-dashed border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-400 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
                    >
                      <Upload size={14} /> Anexar Documento do Trâmite
                    </button>
                    <input type="file" ref={tramitFileInputRef} className="hidden" onChange={handleFileUpload} />
                  </div>

                  <button onClick={handleSaveExternal} disabled={isSavingExternal} className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-2">
                    {isSavingExternal ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar Trâmite
                  </button>
                </div>
              </section>

              <section className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ArrowRightLeft size={16} /> Transferência de Setor</p>
                <div className={`bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4 ${isFinalized(selectedDemand.status) ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Novo Setor Responsável</label>
                    <select 
                      value={internalTransferCategoryId} 
                      onChange={(e) => setInternalTransferCategoryId(e.target.value)} 
                      className="w-full px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-[11px] font-black text-blue-700 outline-none cursor-pointer uppercase"
                    >
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <button 
                    onClick={handleTransferInternal} 
                    disabled={isTransferringInternal || internalTransferCategoryId === selectedDemand.category_id} 
                    className="w-full py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isTransferringInternal ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />} Confirmar Transferência
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
                        onAddComment={async (text) => {
                          if (!currentUser) return;
                          await DemandService.addTimelineEvent(selectedDemand.id, currentUser, { type: 'COMMENT', description: text });
                          const newTimeline = await DemandService.getTimeline(selectedDemand.id);
                          setTimeline(newTimeline);
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
                     <div 
                       key={att.id} 
                       className="group relative bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-blue-500 transition-all"
                     >
                       <button 
                         onClick={() => handleViewAttachment(att.url)}
                         className="flex flex-1 items-center gap-3 truncate text-left"
                       >
                         <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0"><FileText size={20} /></div>
                         <div>
                           <p className="text-[11px] font-black text-slate-900 truncate uppercase">{att.name}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase">{att.size}</p>
                         </div>
                       </button>
                       <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => handleDeleteAttachmentRequest(e, att)}
                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remover Anexo"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ExternalLink size={14} className="text-slate-300 group-hover:text-blue-600" />
                       </div>
                     </div>
                   ))}
                   {(!selectedDemand.attachments || selectedDemand.attachments.length === 0) && (
                     <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sem anexos</p>
                     </div>
                   )}
                 </div>
               </section>

               <section className="space-y-4 pt-10 border-t border-slate-100 opacity-60 pointer-events-none">
                 <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Sparkles size={16} /> Inteligência do Gabinete</p>
                    <span className="text-[8px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Em Breve</span>
                 </div>
                 <div className="grid grid-cols-1 gap-3">
                    <button disabled className="w-full py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl opacity-50">Minutar Ofício IA</button>
                    <button disabled className="w-full py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl opacity-50">Minutar Requerimento IA</button>
                 </div>
               </section>
            </aside>
          </div>
        </div>
      )}

      {/* Modal Confirmação Exclusão Anexo */}
      {isDeleteAttachmentModalOpen && attachmentToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 space-y-6">
            <div className="flex items-center gap-4 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                <FileX size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase">Remover Anexo?</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Esta ação ficará registrada na auditoria.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-bold text-slate-600 truncate uppercase">Arquivo: {attachmentToDelete.name}</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsDeleteAttachmentModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase tracking-widest">Cancelar</button>
              <button onClick={confirmDeleteAttachment} className="flex-1 py-4 bg-rose-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg">Confirmar Remoção</button>
            </div>
          </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 space-y-6">
            <div className="flex items-center gap-4 text-rose-600 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center shadow-inner">
                <ShieldAlert size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase">Solicitar Exclusão</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">A demanda irá para quarentena de auditoria.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Justificativa (Obrigatório)</label>
              <textarea 
                rows={4} 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-rose-500/10 transition-all resize-none"
                placeholder="Ex: Erro de digitação, solicitação duplicada..."
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={confirmDeletion} disabled={!deletionReason.trim()} className="flex-1 py-4 bg-rose-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg hover:bg-rose-700 transition-all disabled:opacity-50">Enviar p/ Quarentena</button>
            </div>
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
              <div className="flex items-center gap-4 text-emerald-600">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-inner"><Unlock size={28} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reabrir Trâmite</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prot: #{selectedDemand?.protocol}</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Motivo da Reabertura</label>
                <textarea rows={4} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none resize-none focus:ring-4 focus:ring-emerald-500/10 transition-all" value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsUnlockModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase tracking-widest">Cancelar</button>
                <button onClick={handleUnlockDemand} disabled={!unlockReason.trim()} className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl">Confirmar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DemandList;
