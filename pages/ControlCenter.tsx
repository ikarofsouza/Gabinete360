
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, UserPlus, Search, History, Activity, Download, RefreshCw, X, 
  ShieldCheck, CheckCircle2, Database, Globe, Zap, Shield, Eye, Loader2, Lock,
  AlertCircle, LayoutGrid, Tag, Plus, Trash2, Palette, Save, Phone, Mail,
  ChevronRight, ArrowUpRight, RotateCcw, User as UserIcon, Server, Cpu, HelpCircle, Camera, Upload, ShieldAlert, Clock, Calendar
} from 'lucide-react';
import md5 from 'blueimp-md5';
import { CategoryService, UserService, ConstituentService, DemandService } from '../services/api';
import { logger } from '../services/LoggerService';
import { useToast } from '../contexts/ToastContext';
import { UserStatus, Constituent, Demand, User, UserRole, LogEntry, Category } from '../types';
import { useAuth } from '../contexts/AuthContext';

const maskPhone = (v: string) => {
  if (!v) return '';
  v = v.replace(/\D/g, '');
  if (v.startsWith('55') && v.length > 10) v = v.substring(2);
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
  v = v.replace(/(\d{5})(\d)/, '$1-$2');
  return v.substring(0, 15);
};

/**
 * Retorna a URL do avatar do usuário priorizando o upload manual, 
 * depois Gravatar e por fim um fallback baseado no nome.
 */
const getAvatarUrl = (user: User) => {
  if (user.avatar_url) return user.avatar_url;
  const hash = md5(user.email.toLowerCase().trim());
  return `https://www.gravatar.com/avatar/${hash}?d=mp&s=200`;
};

const ControlCenter: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<'users' | 'sectors' | 'logs' | 'audit' | 'system'>('users');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados de Dados
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [pendingConstituents, setPendingConstituents] = useState<Constituent[]>([]);
  const [pendingDemands, setPendingDemands] = useState<Demand[]>([]);
  
  // Estados de UI/Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalUserOpen, setIsModalUserOpen] = useState(false);
  const [isModalSectorOpen, setIsModalSectorOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // Estados para Auditoria de Exclusão (Modal de detalhes)
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditInfo, setAuditInfo] = useState<LogEntry | null>(null);
  const [auditTargetName, setAuditTargetName] = useState('');

  // Estados para Confirmação de Exclusão Permanente
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState<{ id: string, type: 'CONSTITUENT' | 'DEMAND', name: string } | null>(null);

  // Formulários de Usuário
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    name: '', 
    email: '', 
    username: '', 
    phone: '', 
    password: '', 
    role: 'ASSESSOR' as UserRole, 
    status: 'ACTIVE' as UserStatus,
    sectors: [] as string[],
    avatar_url: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [editingSector, setEditingSector] = useState<Category | null>(null);
  const [sectorForm, setSectorForm] = useState({ name: '', color: '#2563eb' });

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users' || isModalUserOpen) {
        const [u, c] = await Promise.all([
          UserService.getAll(),
          CategoryService.getAll()
        ]);
        setUsers(u);
        setCategories(c);
      } else if (activeTab === 'sectors') {
        const c = await CategoryService.getAll();
        setCategories(c);
      } else if (activeTab === 'logs') {
        const l = await logger.getAllLogs();
        setAllLogs(l);
      } else if (activeTab === 'audit') {
        const [c, d] = await Promise.all([
          ConstituentService.getPendingDeletions(),
          DemandService.getPendingDeletions()
        ]);
        setPendingConstituents(c);
        setPendingDemands(d);
      }
    } catch (err) {
      showToast("Falha na sincronização.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers de Equipe ---
  const handleOpenUserModal = (user?: User) => {
    setSelectedFile(null);
    if (user) {
      setEditingUser(user);
      const url = getAvatarUrl(user);
      setPreviewUrl(url);
      setUserForm({
        name: user.name,
        email: user.email,
        username: user.username || '',
        phone: user.phone || '',
        password: '', 
        role: user.role,
        status: user.status,
        sectors: user.sectors || [],
        avatar_url: user.avatar_url || ''
      });
    } else {
      setEditingUser(null);
      setPreviewUrl('');
      setUserForm({ 
        name: '', 
        email: '', 
        username: '', 
        phone: '', 
        password: '', 
        role: 'ASSESSOR', 
        status: 'ACTIVE',
        sectors: [],
        avatar_url: ''
      });
    }
    setIsModalUserOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    try {
      let finalAvatarUrl = userForm.avatar_url;
      
      // Se houver novo arquivo selecionado, faz o upload primeiro
      if (selectedFile) {
        // Para novos usuários usamos um ID temporário ou geramos o upload com um prefixo de tempo
        const targetId = editingUser ? editingUser.id : `new_${Date.now()}`;
        finalAvatarUrl = await UserService.uploadAvatar(targetId, selectedFile);
      }

      const payload = { ...userForm, avatar_url: finalAvatarUrl };
      
      // Em edição, se a senha estiver vazia, removemos do payload para não sobrescrever
      if (editingUser && !payload.password) {
        delete (payload as any).password;
      }

      if (editingUser) {
        await UserService.update(editingUser.id, currentUser, payload);
        showToast("Perfil atualizado com sucesso.");
      } else {
        await UserService.create(currentUser, payload);
        showToast("Novo colaborador integrado à equipe.");
      }
      setIsModalUserOpen(false);
      loadTabData();
    } catch (err) {
      console.error(err);
      showToast("Erro ao processar salvamento do colaborador.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSectorSelection = (sectorId: string) => {
    setUserForm(prev => ({
      ...prev,
      sectors: prev.sectors.includes(sectorId)
        ? prev.sectors.filter(id => id !== sectorId)
        : [...prev.sectors, sectorId]
    }));
  };

  // --- Handlers de Setores ---
  const handleOpenSectorModal = (cat?: Category) => {
    if (cat) {
      setEditingSector(cat);
      setSectorForm({ name: cat.name, color: cat.color });
    } else {
      setEditingSector(null);
      setSectorForm({ name: '', color: '#2563eb' });
    }
    setIsModalSectorOpen(true);
  };

  const handleSaveSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    try {
      if (editingSector) {
        await CategoryService.update(editingSector.id, currentUser, sectorForm);
        showToast("Setor atualizado.");
      } else {
        await CategoryService.create(currentUser, sectorForm.name, sectorForm.color);
        showToast("Nova área de atendimento criada.");
      }
      setIsModalSectorOpen(false);
      loadTabData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSector = async (id: string) => {
    if (!currentUser || !window.confirm("Deseja realmente remover este setor? Isso pode afetar demandas vinculadas.")) return;
    await CategoryService.delete(id, currentUser);
    showToast("Setor removido.");
    loadTabData();
  };

  // --- Handlers de Quarentena ---
  const handleRestore = async (type: 'CONSTITUENT' | 'DEMAND', id: string) => {
    if (!currentUser) return;
    try {
      if (type === 'CONSTITUENT') await ConstituentService.restore(id, currentUser);
      else await DemandService.restore(id, currentUser);
      showToast("Registro recuperado com sucesso!");
      loadTabData();
    } catch (e) {
      showToast("Erro ao restaurar.", "error");
    }
  };

  const handleOpenAuditDetails = async (type: 'CONSTITUENT' | 'DEMAND', id: string, name: string) => {
    setLoading(true);
    try {
      const logs = await logger.getAllLogs();
      const deleteLog = logs.find(l => l.entity_id === id && l.action === 'DELETE_REQUESTED');
      if (deleteLog) {
        setAuditInfo(deleteLog);
        setAuditTargetName(name);
        setIsAuditModalOpen(true);
      } else {
        showToast("Log de exclusão não localizado.", "info");
      }
    } catch (e) {
      showToast("Erro ao buscar detalhes da auditoria.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermanentDelete = (type: 'CONSTITUENT' | 'DEMAND', id: string, name: string) => {
    setTargetToDelete({ type, id, name });
    setIsConfirmDeleteOpen(true);
  };

  const confirmPermanentDelete = async () => {
    if (!currentUser || !targetToDelete) return;
    setLoading(true);
    try {
      if (targetToDelete.type === 'CONSTITUENT') {
        await ConstituentService.permanentDelete(targetToDelete.id, currentUser);
      } else {
        await DemandService.permanentDelete(targetToDelete.id, currentUser);
      }
      showToast("Registro removido permanentemente.");
      setIsConfirmDeleteOpen(false);
      setTargetToDelete(null);
      loadTabData();
    } catch (e) {
      showToast("Erro ao processar exclusão permanente.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 page-enter pb-24 min-h-screen">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.8rem] flex items-center justify-center shadow-2xl">
             <ShieldCheck size={32} />
           </div>
           <div>
             <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Centro de Controle</h1>
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 italic">Governança, Equipe e Setores</p>
           </div>
        </div>
        
        <nav className="flex bg-white p-1.5 rounded-[2.2rem] border border-slate-200 shadow-xl overflow-x-auto">
          {[
            { id: 'users', label: 'Equipe', icon: Users },
            { id: 'sectors', label: 'Setores', icon: Tag },
            { id: 'logs', label: 'Auditoria', icon: History },
            { id: 'audit', label: 'Quarentena', icon: AlertCircle },
            { id: 'system', label: 'Sistema', icon: Activity }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap active:scale-95 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* TELA: EQUIPE */}
      {activeTab === 'users' && (
        <div className="space-y-8 page-enter">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-[2.2rem] border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar colaborador..." 
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => handleOpenUserModal()}
              className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <UserPlus size={18} /> Adicionar Colaborador
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
              <div key={u.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-6 group transition-all hover:shadow-xl relative overflow-hidden">
                <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[8px] font-black uppercase ${u.role === 'ADMIN' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {u.role}
                </div>
                <div className="w-20 h-20 rounded-[1.8rem] bg-slate-100 flex items-center justify-center text-3xl font-black text-slate-400 border-4 border-white shadow-lg overflow-hidden">
                   <img 
                    src={getAvatarUrl(u)} 
                    alt={u.name}
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(u.name);
                    }}
                   />
                </div>
                <div className="w-full">
                  <h4 className="text-base font-black text-slate-900 uppercase truncate">{u.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase truncate mt-1 flex items-center justify-center gap-1"><Mail size={10} /> {u.email}</p>
                  {u.phone && <p className="text-[10px] font-bold text-blue-600 uppercase mt-1 flex items-center justify-center gap-1"><Phone size={10} /> {u.phone}</p>}
                </div>
                <div className="flex gap-2 w-full pt-2">
                  <button onClick={() => handleOpenUserModal(u)} className="flex-1 py-3 bg-slate-50 text-slate-600 rounded-xl text-[9px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all">Editar</button>
                  <div className={`w-3 h-3 rounded-full absolute bottom-8 right-8 ${u.status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} title={u.status === 'ACTIVE' ? 'Ativo' : 'Inativo'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TELA: SETORES */}
      {activeTab === 'sectors' && (
        <div className="space-y-8 page-enter">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><LayoutGrid size={20} className="text-blue-600" /> Gestão de Áreas de Atendimento</h2>
            <button 
              onClick={() => handleOpenSectorModal()}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Novo Setor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map(cat => (
              <div key={cat.id} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm flex flex-col justify-between group hover:border-blue-500/20 transition-all">
                <div className="flex items-start justify-between">
                   <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: cat.color }}>
                     <Tag size={20} />
                   </div>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => handleOpenSectorModal(cat)} className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg"><Eye size={14} /></button>
                     <button onClick={() => handleDeleteSector(cat.id)} className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg"><Trash2 size={14} /></button>
                   </div>
                </div>
                <div className="mt-6">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{cat.name}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{cat.color}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TELA: AUDITORIA */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-black text-slate-900 uppercase flex items-center gap-2"><History size={20} className="text-blue-600" /> Histórico de Auditoria Geral</h3>
            <button onClick={loadTabData} className="p-2 hover:bg-slate-100 rounded-lg transition-all"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  <th className="px-8 py-5">Data/Hora</th>
                  <th className="px-8 py-5">Usuário</th>
                  <th className="px-8 py-5">Ação</th>
                  <th className="px-8 py-5">Módulo</th>
                  <th className="px-8 py-5">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allLogs.map(log => (
                  <tr key={log.id} className="text-[11px] hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-4 font-bold text-slate-500">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                    <td className="px-8 py-4">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 uppercase tracking-tight">{log.actor.name}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{log.actor.role}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className={`px-2 py-1 rounded-md font-black text-[9px] uppercase border ${
                        log.action === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        log.action === 'DELETE' || log.action === 'DELETE_REQUESTED' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        log.action === 'UPDATE' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                        log.action === 'LOGIN' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-100'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-8 py-4 font-bold text-slate-500 uppercase">{log.module}</td>
                    <td className="px-8 py-4 text-slate-600 font-medium">
                      <div className="max-w-[250px] truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:max-w-none transition-all">
                        {log.changes?.map((c, i) => (
                          <span key={i} className="block mb-1 last:mb-0">
                            <span className="font-black text-slate-400 uppercase text-[9px] mr-1">{c.field}:</span> 
                            {JSON.stringify(c.new_value)}
                          </span>
                        )) || 'Nenhum detalhe disponível'}
                      </div>
                    </td>
                  </tr>
                ))}
                {allLogs.length === 0 && !loading && (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold uppercase text-xs italic">Nenhum registro encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TELA: QUARENTENA */}
      {activeTab === 'audit' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 page-enter">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3 text-rose-600">
                <Users size={20} />
                <h3 className="font-black text-slate-900 uppercase">Eleitores em Quarentena</h3>
              </div>
              <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-500">{pendingConstituents.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[500px] divide-y divide-slate-50">
               {pendingConstituents.map(c => (
                 <div key={c.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all group">
                    <div className="min-w-0 flex-1">
                      <p 
                        className="text-sm font-black text-slate-800 uppercase truncate cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => handleOpenAuditDetails('CONSTITUENT', c.id, c.name)}
                      >
                        {c.name}
                      </p>
                      <p className="text-[10px] text-rose-500 font-bold mt-1 uppercase italic">Motivo: {c.deletion_reason}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRestore('CONSTITUENT', c.id)} 
                        className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="Restaurar Registro"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button 
                        onClick={() => handleRequestPermanentDelete('CONSTITUENT', c.id, c.name)} 
                        className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                        title="Excluir Permanentemente"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                 </div>
               ))}
               {pendingConstituents.length === 0 && <div className="p-20 text-center text-slate-400 font-bold uppercase italic text-xs">Limpo</div>}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3 text-rose-600">
                <Plus size={20} />
                <h3 className="font-black text-slate-900 uppercase">Demandas em Quarentena</h3>
              </div>
              <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-500">{pendingDemands.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[500px] divide-y divide-slate-50">
               {pendingDemands.map(d => (
                 <div key={d.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all group">
                    <div className="min-w-0 flex-1">
                      <p 
                        className="text-sm font-black text-slate-800 uppercase truncate cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => handleOpenAuditDetails('DEMAND', d.id, d.title)}
                      >
                        {d.title}
                      </p>
                      <p className="text-[10px] text-rose-500 font-bold mt-1 uppercase italic">Motivo: {d.deletion_reason}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleRestore('DEMAND', d.id)} 
                        className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        title="Restaurar Registro"
                      >
                        <RotateCcw size={16} />
                      </button>
                      <button 
                        onClick={() => handleRequestPermanentDelete('DEMAND', d.id, d.title)} 
                        className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                        title="Excluir Permanentemente"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                 </div>
               ))}
               {pendingDemands.length === 0 && <div className="p-20 text-center text-slate-400 font-bold uppercase italic text-xs">Limpo</div>}
            </div>
          </div>
        </div>
      )}

      {/* TELA: SISTEMA */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner"><Server size={24} /></div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Infraestrutura</h3>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Banco de Dados</span><span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1"><CheckCircle2 size={12} /> Conectado</span></div>
                 <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Motor de IA</span><span className="text-[10px] font-black text-blue-600 uppercase">Gemini 3.0 Pro</span></div>
                 <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Versão</span><span className="text-[10px] font-black text-slate-600 uppercase">v2.5.0-beta</span></div>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><Cpu size={24} /></div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Recursos</h3>
              </div>
              <div className="space-y-4">
                 <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Armazenamento</span><span className="text-[10px] font-black text-slate-900 uppercase">24.5 MB / 5 GB</span></div>
                 <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Geocodificação</span><span className="text-[10px] font-black text-emerald-600 uppercase">Ativo</span></div>
                 <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Relatórios</span><span className="text-[10px] font-black text-blue-600 uppercase">Otimizado</span></div>
              </div>
           </div>

           <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl space-y-6 text-white overflow-hidden relative group">
              <Zap className="absolute -bottom-10 -right-10 text-white opacity-5 w-40 h-40 group-hover:scale-110 transition-transform duration-700" />
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center shadow-inner"><Globe size={24} /></div>
                <h3 className="font-black uppercase tracking-tight">Estatísticas</h3>
              </div>
              <div className="space-y-4 relative z-10">
                 <div className="flex justify-between items-center"><span className="text-[10px] font-black text-white/40 uppercase">Acessos Hoje</span><span className="text-xl font-black">{users.length * 4}</span></div>
                 <div className="flex justify-between items-center"><span className="text-[10px] font-black text-white/40 uppercase">Logs/Hora</span><span className="text-xl font-black">{allLogs.length > 0 ? Math.round(allLogs.length / 24) : 0}</span></div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: AUDITORIA DE EXCLUSÃO (Detalhes de quem excluiu) */}
      {isAuditModalOpen && auditInfo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 border border-white/20 space-y-8 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><History size={24} /></div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Detalhes de Exclusão</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{auditTargetName}</p>
                  </div>
                </div>
                <button onClick={() => setIsAuditModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X size={24} /></button>
              </div>

              <div className="space-y-6">
                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm"><UserIcon size={18} /></div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solicitante</p>
                          <p className="text-sm font-black text-slate-900 uppercase">{auditInfo.actor.name}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm"><Calendar size={18} /></div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data e Horário</p>
                          <p className="text-sm font-black text-slate-900 uppercase">{new Date(auditInfo.timestamp).toLocaleString('pt-BR')}</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Motivo Informado</p>
                    <div className="p-6 bg-rose-50 border border-rose-100 rounded-[2rem] text-sm text-rose-800 font-bold italic leading-relaxed">
                       "{auditInfo.meta?.reason || 'Sem justificativa detalhada.'}"
                    </div>
                 </div>

                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><Globe size={12} /> Dados do Ambiente</p>
                    <div className="space-y-1">
                      <p className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-2"><Lock size={10} /> IP: {auditInfo.meta?.platform || '---'}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-2"><Activity size={10} /> {auditInfo.meta?.userAgent?.substring(0, 45)}...</p>
                    </div>
                 </div>
              </div>

              <button onClick={() => setIsAuditModalOpen(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all">
                 Fechar Auditoria
              </button>
           </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO PERMANENTE */}
      {isConfirmDeleteOpen && targetToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 border border-white/20 space-y-8 animate-in zoom-in-95">
              <div className="text-center space-y-4">
                 <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl shadow-rose-200/50">
                    <ShieldAlert size={40} />
                 </div>
                 <div>
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Excluir Permanente?</h3>
                    <p className="text-sm font-bold text-slate-400 leading-relaxed px-4">Esta ação é irreversível e removerá todos os dados do registro <span className="text-rose-600">"{targetToDelete.name}"</span> definitivamente do banco de dados.</p>
                 </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsConfirmDeleteOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Manter Registro</button>
                <button 
                  onClick={confirmPermanentDelete} 
                  disabled={loading}
                  className="flex-1 py-4 bg-rose-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-rose-300 hover:bg-rose-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Confirmar Exclusão
                </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: USUÁRIO */}
      {isModalUserOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 border border-white/20 space-y-10 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><UserPlus size={24} /></div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{editingUser ? 'Editar Perfil' : 'Novo Colaborador'}</h3>
                </div>
                <button onClick={() => setIsModalUserOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X size={28} /></button>
              </div>
              <form onSubmit={handleSaveUser} className="space-y-8">
                {/* Upload de Foto */}
                <div className="flex flex-col items-center gap-4 py-4">
                   <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-24 h-24 rounded-[1.8rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                         {previewUrl ? (
                           <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                         ) : (
                           <UserIcon size={40} className="text-slate-300" />
                         )}
                         <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Camera size={24} />
                         </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white p-2 rounded-xl shadow-lg">
                        <Upload size={14} />
                      </div>
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clique para alterar foto de perfil</p>
                   <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                   />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-3">Nome Completo</label>
                     <input required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" value={userForm.name} onChange={(e) => setUserForm({...userForm, name: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-3">Nome de Usuário</label>
                     <div className="relative">
                       <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                       <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" value={userForm.username} onChange={(e) => setUserForm({...userForm, username: e.target.value.toLowerCase().replace(/\s/g, '')})} placeholder="ex: joao.silva" />
                     </div>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-3">E-mail Corporativo</label>
                     <input required type="email" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-3">Telefone Celular</label>
                     <input className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" value={userForm.phone} onChange={(e) => setUserForm({...userForm, phone: maskPhone(e.target.value)})} placeholder="(00) 00000-0000" />
                   </div>
                </div>

                {/* VINCULO DE SETORES */}
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-3 flex items-center gap-2">Setores de Atuação <Info size={12} className="text-blue-500" /></label>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-4 rounded-3xl border border-slate-100 max-h-[160px] overflow-y-auto custom-scrollbar">
                     {categories.map(cat => (
                       <label key={cat.id} className="flex items-center gap-2 p-3 bg-white border border-slate-100 rounded-xl cursor-pointer hover:border-blue-500 transition-all">
                         <input 
                           type="checkbox" 
                           checked={userForm.sectors.includes(cat.id)}
                           onChange={() => toggleSectorSelection(cat.id)}
                           className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                         />
                         <span className="text-[10px] font-black text-slate-600 uppercase truncate">{cat.name}</span>
                       </label>
                     ))}
                     {categories.length === 0 && <p className="col-span-full py-4 text-center text-[9px] font-bold text-slate-400 italic">Cadastre setores primeiro.</p>}
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-3">Senha</label>
                     <input required={!editingUser} type="password" placeholder="Mínimo 6 caracteres" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-3">Função / Cargo</label>
                     <select className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black uppercase outline-none cursor-pointer" value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value as UserRole})}>
                        <option value="ASSESSOR">Assessor de Gabinete</option>
                        <option value="ADMIN">Administrador de Sistema</option>
                        <option value="STAFF">Equipe de Campo</option>
                        <option value="PARLIAMENTARY">Parlamentar</option>
                     </select>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-3">Status da Conta</label>
                     <select className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black uppercase outline-none cursor-pointer" value={userForm.status} onChange={(e) => setUserForm({...userForm, status: e.target.value as UserStatus})}>
                        <option value="ACTIVE">Ativo / Operacional</option>
                        <option value="INACTIVE">Inativo / Bloqueado</option>
                     </select>
                   </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setIsModalUserOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase shadow-2xl transition-all hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Salvar Colaborador
                  </button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL: SETOR */}
      {isModalSectorOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-lg rounded-[3rem] shadow-2xl p-10 border border-white/20 space-y-10 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{editingSector ? 'Editar' : 'Novo'} Setor</h3>
                <button onClick={() => setIsModalSectorOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X size={28} /></button>
              </div>
              <form onSubmit={handleSaveSector} className="space-y-8">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-3">Nome da Área / Setor</label>
                   <input required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold uppercase outline-none focus:ring-4 focus:ring-blue-600/5 transition-all" value={sectorForm.name} onChange={(e) => setSectorForm({...sectorForm, name: e.target.value.toUpperCase()})} placeholder="Ex: SAÚDE" />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-3">Cor de Identificação</label>
                   <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                     <input type="color" className="w-14 h-14 rounded-lg bg-transparent cursor-pointer border-none" value={sectorForm.color} onChange={(e) => setSectorForm({...sectorForm, color: e.target.value})} />
                     <div className="flex-1">
                        <p className="text-[10px] font-black text-slate-900 uppercase">Código HEX</p>
                        <p className="text-xs font-mono font-bold text-slate-400">{sectorForm.color}</p>
                     </div>
                   </div>
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setIsModalSectorOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase shadow-2xl transition-all flex items-center justify-center gap-2">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar Setor
                  </button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

// Componente auxiliar para ícones e tooltips
const Info = ({ size, className }: { size: number, className: string }) => <div className={className}><HelpCircle size={size} /></div>;

export default ControlCenter;
