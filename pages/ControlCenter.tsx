
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, UserPlus, Search, History, Activity, Download, RefreshCw, X, 
  ShieldCheck, CheckCircle2, Database, Globe, Zap, Shield, Eye, Loader2, Lock,
  AlertCircle, LayoutGrid, Tag, Plus, Trash2, Palette, Save, Phone, Mail,
  ChevronRight, ChevronLeft, ArrowUpRight, RotateCcw, User as UserIcon, Server, Cpu, HelpCircle, Camera, Upload, ShieldAlert, Clock, Calendar, DatabaseZap,
  GitMerge as Merge, Columns as Split, Edit2, ClipboardCheck, Sparkles, MapPin
} from 'lucide-react';
import { collection, getDocs, writeBatch, query, limit, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import md5 from 'blueimp-md5';
import { CategoryService, UserService, ConstituentService, DemandService } from '../services/api';
import { GeoService } from '../services/geo';
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

const toTitleCase = (str: string) => {
  if (!str) return '';
  const particles = ['de', 'da', 'do', 'dos', 'das', 'e'];
  return str.toLowerCase().trim().split(/\s+/).map((word, index) => {
    if (particles.includes(word) && index !== 0) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

const getAvatarUrl = (user: User) => {
  if (user.avatar_url) return user.avatar_url;
  const hash = md5(user.email.toLowerCase().trim());
  return `https://www.gravatar.com/avatar/${hash}?d=mp&s=200`;
};

const ControlCenter: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<'users' | 'sectors' | 'groups' | 'logs' | 'audit' | 'system'>('users');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isBulkUpdateConfirmOpen, setIsBulkUpdateConfirmOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isGeocodingConfirmOpen, setIsGeocodingConfirmOpen] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0 });
  
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);

  // Estados de Dados
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [pendingConstituents, setPendingConstituents] = useState<Constituent[]>([]);
  const [pendingDemands, setPendingDemands] = useState<Demand[]>([]);
  const [uniqueGroups, setUniqueGroups] = useState<{name: string, count: number}[]>([]);
  
  // Estados de Paginação dos Logs
  const [logPageIndex, setLogPageIndex] = useState(0);
  const [logPageSize, setLogPageSize] = useState(50);

  // Estados de UI/Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalUserOpen, setIsModalUserOpen] = useState(false);
  const [isModalSectorOpen, setIsModalSectorOpen] = useState(false);
  const [isModalGroupOpen, setIsModalGroupOpen] = useState(false);

  // Estados para Auditoria de Exclusão
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditInfo, setAuditInfo] = useState<LogEntry | null>(null);
  const [auditTargetName, setAuditTargetName] = useState('');

  // Estados para Confirmação de Exclusão Permanente
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState<{ id: string; type: 'CONSTITUENT' | 'DEMAND'; name: string } | null>(null);

  // Formulários
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    name: '', email: '', username: '', phone: '', password: '', 
    role: 'ASSESSOR' as UserRole, status: 'ACTIVE' as UserStatus,
    sectors: [] as string[], avatar_url: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [editingSector, setEditingSector] = useState<Category | null>(null);
  const [sectorForm, setSectorForm] = useState({ name: '', color: '#2563eb' });

  // Estados para Gestão de Grupos
  const [groupAction, setGroupAction] = useState<'CREATE' | 'EDIT' | 'MERGE' | 'SPLIT'>('CREATE');
  const [groupForm, setGroupForm] = useState({
    name: '',
    newName: '',
    mergeTarget: '',
    splitSegments: ''
  });

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users' || isModalUserOpen) {
        const [u, c] = await Promise.all([ UserService.getAll(), CategoryService.getAll() ]);
        setUsers(u);
        setCategories(c);
      } else if (activeTab === 'sectors') {
        const c = await CategoryService.getAll();
        setCategories(c);
      } else if (activeTab === 'groups') {
        const all = await ConstituentService.getAll();
        const groupsMap: Record<string, number> = {};
        all.forEach(c => {
          if (c.tags) {
            c.tags.forEach(tag => {
              groupsMap[tag] = (groupsMap[tag] || 0) + 1;
            });
          }
        });
        setUniqueGroups(Object.entries(groupsMap).map(([name, count]) => ({name, count})).sort((a,b) => b.count - a.count));
      } else if (activeTab === 'logs') {
        const l = await logger.getAllLogs();
        setAllLogs(l);
        setLogPageIndex(0); // Reseta a página ao carregar novos dados
      } else if (activeTab === 'audit') {
        const [c, d, u] = await Promise.all([ 
          ConstituentService.getPendingDeletions(), 
          DemandService.getPendingDeletions(),
          UserService.getAll()
        ]);
        setPendingConstituents(c);
        setPendingDemands(d);
        setUsers(u);
      }
    } catch (err) {
      showToast("Falha na sincronização.", "error");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Executa a geocodificação em massa de todos os cadastros
   */
  const handleBulkGeocode = async () => {
    if (!currentUser || isGeocoding) return;
    
    setIsGeocodingConfirmOpen(false);
    setIsGeocoding(true);
    try {
      const allConstituents = await ConstituentService.getAll();
      const targets = allConstituents.filter(c => 
        c.address?.zip_code?.replace(/\D/g, '').length === 8 && 
        (!c.geo || !c.geo.lat || !c.geo.lng)
      );

      setGeocodeProgress({ current: 0, total: targets.length });
      
      if (targets.length === 0) {
        showToast("Nenhum registro pendente de coordenadas encontrado.");
        setIsGeocoding(false);
        return;
      }

      let successCount = 0;

      for (const constituent of targets) {
        const coords = await GeoService.getCoordsByCep(constituent.address.zip_code);
        
        if (coords) {
          await ConstituentService.update(constituent.id, { geo: coords }, currentUser);
          successCount++;
        }
        
        setGeocodeProgress(prev => ({ ...prev, current: prev.current + 1 }));
        
        // Delay para respeitar rate-limit da API Nominatim (1 req/sec)
        await new Promise(resolve => setTimeout(resolve, 1100));
      }

      await logger.log('UPDATE', 'SYSTEM', 'bulk_geocoding', currentUser, [{ field: 'constituents_coordinates', new_value: 'UPDATED' }], { count: successCount });
      showToast(`Mapeamento concluído! ${successCount} novos registros localizados.`);
      loadTabData();
    } catch (error) {
      console.error(error);
      showToast("Erro durante o mapeamento geográfico.", "error");
    } finally {
      setIsGeocoding(false);
    }
  };

  /**
   * Executa a higienização de todos os cadastros baseada nas definições atuais
   */
  const handleBulkUpdateDefinitions = async () => {
    if (!currentUser || isBulkUpdating) return;
    
    setIsBulkUpdateConfirmOpen(false);
    setIsBulkUpdating(true);
    try {
      const allConstituents = await ConstituentService.getAll();
      setBulkProgress({ current: 0, total: allConstituents.length });
      
      let updatedCount = 0;

      for (const constituent of allConstituents) {
        const currentName = constituent.name;
        const sanitizedName = toTitleCase(currentName);
        
        // Só atualiza se houver mudança efetiva
        if (currentName !== sanitizedName) {
          await ConstituentService.update(constituent.id, { name: sanitizedName }, currentUser);
          updatedCount++;
        }
        
        setBulkProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      await logger.log('UPDATE', 'SYSTEM', 'bulk_sanitization', currentUser, [{ field: 'all_constituents_names', new_value: 'SANITIZED' }], { count: updatedCount });
      showToast(`Higienização concluída! ${updatedCount} registros foram padronizados.`);
      loadTabData();
    } catch (error) {
      console.error(error);
      showToast("Erro durante a padronização global.", "error");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleOpenGroupAction = (action: 'CREATE' | 'EDIT' | 'MERGE' | 'SPLIT', targetName?: string) => {
    setGroupAction(action);
    setGroupForm({
      name: targetName || '',
      newName: targetName || '',
      mergeTarget: '',
      splitSegments: targetName ? targetName.replace(/[\/\-|]/g, ', ') : ''
    });
    setIsModalGroupOpen(true);
  };

  const handleGroupOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    try {
      const all = await ConstituentService.getAll();
      let updatedCount = 0;

      for (const c of all) {
        let newTags = [...(c.tags || [])];
        let changed = false;

        if (groupAction === 'EDIT') {
          if (newTags.includes(groupForm.name)) {
            newTags = newTags.map(t => t === groupForm.name ? groupForm.newName.toUpperCase() : t);
            changed = true;
          }
        } else if (groupAction === 'MERGE') {
          if (newTags.includes(groupForm.name)) {
            newTags = newTags.filter(t => t !== groupForm.name);
            if (!newTags.includes(groupForm.mergeTarget)) {
              newTags.push(groupForm.mergeTarget);
            }
            changed = true;
          }
        } else if (groupAction === 'SPLIT') {
          if (newTags.includes(groupForm.name)) {
            newTags = newTags.filter(t => t !== groupForm.name);
            const segments = groupForm.splitSegments.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            segments.forEach(s => { if (!newTags.includes(s)) newTags.push(s); });
            changed = true;
          }
        } else if (groupAction === 'CREATE') {
          showToast(`Grupo ${groupForm.newName.toUpperCase()} criado.`);
          setIsModalGroupOpen(false);
          setIsSaving(false);
          return;
        }

        if (changed) {
          await ConstituentService.update(c.id, { tags: Array.from(new Set(newTags)) }, currentUser);
          updatedCount++;
        }
      }

      await logger.log('UPDATE', 'CONTROL_CENTER', 'batch_group_update', currentUser, [{ field: groupAction, new_value: groupForm.newName || groupForm.mergeTarget }]);
      showToast(`${updatedCount} registros foram atualizados no grupo.`);
      setIsModalGroupOpen(false);
      loadTabData();
    } catch (err) {
      showToast("Erro na operação de grupo.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveGroupGlobal = async (tagName: string) => {
    if (!currentUser || !window.confirm(`Isso removerá o segmento "${tagName}" de todos os eleitores. Confirmar?`)) return;
    setLoading(true);
    try {
      const all = await ConstituentService.getAll();
      let count = 0;
      for (const c of all) {
        if (c.tags?.includes(tagName)) {
          const filtered = c.tags.filter(t => t !== tagName);
          await ConstituentService.update(c.id, { tags: filtered }, currentUser);
          count++;
        }
      }
      showToast(`Segmento removido de ${count} registros.`);
      loadTabData();
    } finally {
      setLoading(false);
    }
  };

  const handleWipeDatabase = async () => {
    if (!currentUser || isWiping) return;
    setIsWiping(true);
    try {
      const collectionsToWipe = ['constituents', 'demands', 'timeline'];
      let totalDeleted = 0;
      for (const collName of collectionsToWipe) {
        const querySnapshot = await getDocs(collection(db, collName));
        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => { batch.delete(doc.ref); totalDeleted++; });
        await batch.commit();
      }
      await logger.log('DELETE', 'SYSTEM', 'all_data_wipe', currentUser, [{ field: 'database_wipe', new_value: 'COMPLETE' }], { total_records: totalDeleted });
      showToast("Base de dados restaurada com sucesso.");
      setIsWipeModalOpen(false);
      loadTabData();
    } catch (error) {
      showToast("Erro crítico ao limpar base de dados.", "error");
    } finally {
      setIsWiping(false);
    }
  };

  const handleOpenUserModal = (user?: User) => {
    setSelectedFile(null);
    if (user) {
      setEditingUser(user);
      const url = getAvatarUrl(user);
      setPreviewUrl(url);
      setUserForm({
        name: user.name, email: user.email, username: user.username || '', phone: user.phone || '',
        password: '', role: user.role, status: user.status, sectors: user.sectors || [], avatar_url: user.avatar_url || ''
      });
    } else {
      setEditingUser(null);
      setPreviewUrl('');
      setUserForm({ 
        name: '', email: '', username: '', phone: '', password: '', 
        role: 'ASSESSOR', status: 'ACTIVE', sectors: [], avatar_url: ''
      });
    }
    setIsModalUserOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => { setPreviewUrl(reader.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    try {
      let finalAvatarUrl = userForm.avatar_url;
      if (selectedFile) {
        const targetId = editingUser ? editingUser.id : `new_${Date.now()}`;
        finalAvatarUrl = await UserService.uploadAvatar(targetId, selectedFile);
      }
      const payload = { ...userForm, avatar_url: finalAvatarUrl };
      if (editingUser && !payload.password) delete (payload as any).password;
      if (editingUser) await UserService.update(editingUser.id, currentUser, payload);
      else await UserService.create(currentUser, payload);
      showToast("Cadastro de colaborador concluído.");
      setIsModalUserOpen(false);
      loadTabData();
    } catch (err) {
      showToast("Erro ao salvar colaborador.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenSectorModal = (cat?: Category) => {
    if (cat) { setEditingSector(cat); setSectorForm({ name: cat.name, color: cat.color }); }
    else { setEditingSector(null); setSectorForm({ name: '', color: '#2563eb' }); }
    setIsModalSectorOpen(true);
  };

  const handleSaveSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    try {
      if (editingSector) await CategoryService.update(editingSector.id, currentUser, sectorForm);
      else await CategoryService.create(currentUser, sectorForm.name, sectorForm.color);
      showToast("Setor registrado com sucesso.");
      setIsModalSectorOpen(false);
      loadTabData();
    } finally { setIsSaving(false); }
  };

  const handleDeleteSector = async (id: string) => {
    if (!currentUser || !window.confirm("Confirmar a remoção deste setor?")) return;
    await CategoryService.delete(id, currentUser);
    showToast("Setor removido.");
    loadTabData();
  };

  const handleRestore = async (type: 'CONSTITUENT' | 'DEMAND', id: string) => {
    if (!currentUser) return;
    try {
      if (type === 'CONSTITUENT') await ConstituentService.restore(id, currentUser);
      else await DemandService.restore(id, currentUser);
      showToast("Registro restaurado com sucesso.");
      loadTabData();
    } catch (e) { showToast("Erro ao restaurar registro.", "error"); }
  };

  const confirmPermanentDelete = async () => {
    if (!currentUser || !targetToDelete) return;
    setLoading(true);
    try {
      if (targetToDelete.type === 'CONSTITUENT') await ConstituentService.permanentDelete(targetToDelete.id, currentUser);
      else await DemandService.permanentDelete(targetToDelete.id, currentUser);
      showToast("Registro excluído permanentemente.");
      setIsConfirmDeleteOpen(false);
      setTargetToDelete(null);
      loadTabData();
    } catch (e) { showToast("Erro na exclusão definitiva.", "error"); }
    finally { setLoading(false); }
  };

  // Logica de Paginação de Auditoria
  const paginatedLogs = useMemo(() => {
    const start = logPageIndex * logPageSize;
    return allLogs.slice(start, start + logPageSize);
  }, [allLogs, logPageIndex, logPageSize]);

  const totalLogPages = Math.ceil(allLogs.length / logPageSize);

  return (
    <div className="p-8 space-y-8 page-enter pb-24 min-h-screen">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
           <div className="w-16 h-16 bg-slate-900 text-white rounded-[1.8rem] flex items-center justify-center shadow-2xl">
             <ShieldCheck size={32} />
           </div>
           <div>
             <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Centro de Controle</h1>
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 italic">Governança, Equipe e Configurações</p>
           </div>
        </div>
        
        <nav className="flex bg-white p-1.5 rounded-[2.2rem] border border-slate-200 shadow-xl overflow-x-auto">
          {[
            { id: 'users', label: 'Equipe', icon: Users },
            { id: 'sectors', label: 'Setores', icon: LayoutGrid },
            { id: 'groups', label: 'Segmentos', icon: Tag },
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
        <div className="space-y-8 animate-in fade-in">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-[2.2rem] border border-slate-200 shadow-sm">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Localizar colaborador por nome..." className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button onClick={() => handleOpenUserModal()} className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 flex items-center gap-2">
              <UserPlus size={18} /> Registrar Colaborador
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
              <div key={u.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-6 relative overflow-hidden group hover:shadow-xl transition-all">
                <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[8px] font-black uppercase ${u.role === 'ADMIN' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{u.role === 'ADMIN' ? 'Admin' : 'Assessor'}</div>
                <div className="w-20 h-20 rounded-[1.8rem] bg-slate-100 border-4 border-white shadow-lg overflow-hidden">
                   <img src={getAvatarUrl(u)} className="w-full h-full object-cover" onError={(e) => (e.target as any).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}`} />
                </div>
                <div className="w-full truncate">
                  <h4 className="text-base font-black text-slate-900 uppercase truncate">{u.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{u.email}</p>
                </div>
                <button onClick={() => handleOpenUserModal(u)} className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-[9px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all">Configurar Perfil</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TELA: SETORES */}
      {activeTab === 'sectors' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex justify-between items-center bg-white p-6 rounded-[2.2rem] border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2"><LayoutGrid size={20} className="text-blue-600" /> Categorias e Setores</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase mt-1">Organize as áreas de atuação para triagem de demandas.</p>
            </div>
            <button onClick={() => handleOpenSectorModal()} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2 shadow-xl shadow-slate-200"><Plus size={16} /> Novo Setor</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map(cat => (
              <div key={cat.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm flex flex-col justify-between group hover:border-blue-500/20 transition-all hover:shadow-xl">
                <div className="flex items-start justify-between">
                   <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100" style={{ backgroundColor: cat.color }}><Tag size={24} /></div>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                     <button onClick={() => handleOpenSectorModal(cat)} className="p-3 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all" title="Editar Setor"><Edit2 size={16} /></button>
                     <button onClick={() => handleDeleteSector(cat.id)} className="p-3 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all" title="Remover Setor"><Trash2 size={16} /></button>
                   </div>
                </div>
                <div className="mt-8">
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">{cat.name}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código: {cat.color}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TELA: SEGMENTOS / GRUPOS */}
      {activeTab === 'groups' && (
        <div className="space-y-8 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-6 rounded-[2.2rem] border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2"><Tag size={20} className="text-blue-600" /> Gestão de Segmentos</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Higienize e organize os segmentos da sua base.</p>
            </div>
            <button 
              onClick={() => handleOpenGroupAction('CREATE')}
              className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <Plus size={18} /> Novo Segmento
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {uniqueGroups.map(group => (
              <div key={group.name} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-6 group hover:shadow-xl transition-all border-l-4 border-l-blue-600">
                <div className="flex justify-between items-start">
                  <div className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-blue-100">{group.count} Eleitores</div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                     <button onClick={() => handleOpenGroupAction('MERGE', group.name)} className="p-2.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg" title="Mesclar com outro"><Merge size={16} /></button>
                     <button onClick={() => handleOpenGroupAction('SPLIT', group.name)} className="p-2.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 rounded-lg" title="Separar em vários"><Split size={16} /></button>
                     <button onClick={() => handleOpenGroupAction('EDIT', group.name)} className="p-2.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg" title="Renomear Global"><Edit2 size={16} /></button>
                     <button onClick={() => handleRemoveGroupGlobal(group.name)} className="p-2.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 rounded-lg" title="Remover de Todos"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div>
                   <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter truncate">{group.name}</h4>
                </div>
              </div>
            ))}
            {uniqueGroups.length === 0 && (
               <div className="col-span-full py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem]">
                 <p className="text-slate-400 font-black uppercase tracking-widest text-[11px]">Nenhum segmento identificado na base.</p>
               </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL GESTÃO DE GRUPOS/SEGMENTOS */}
      {isModalGroupOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-12 border border-white/20 space-y-10 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-8">
              <div className="flex items-center gap-4">
                 <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl">
                    {groupAction === 'MERGE' ? <Merge size={32} /> : groupAction === 'SPLIT' ? <Split size={32} /> : <Tag size={32} />}
                 </div>
                 <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase leading-none">
                      {groupAction === 'CREATE' ? 'Novo Segmento' : 
                       groupAction === 'EDIT' ? 'Renomear Global' : 
                       groupAction === 'MERGE' ? 'Mesclar Segmento' : 'Separar em Vários'}
                   </h3>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Higiene e Governança de Dados</p>
                 </div>
              </div>
              <button onClick={() => setIsModalGroupOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400"><X size={32} /></button>
            </div>

            <form onSubmit={handleGroupOperation} className="space-y-8">
              {groupAction === 'CREATE' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nome do Novo Segmento</label>
                  <input required className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" value={groupForm.newName} onChange={(e) => setGroupForm({...groupForm, newName: e.target.value.toUpperCase()})} />
                </div>
              )}

              {groupAction === 'EDIT' && (
                <div className="space-y-6">
                  <div className="p-6 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-inner"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Nome Atual</p><p className="text-base font-black text-slate-900 uppercase tracking-tight">{groupForm.name}</p></div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Novo Nome (Alterará todos os registros)</label>
                    <input required className="w-full px-6 py-5 bg-white border border-blue-200 rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 shadow-lg shadow-blue-50 transition-all" value={groupForm.newName} onChange={(e) => setGroupForm({...groupForm, newName: e.target.value.toUpperCase()})} />
                  </div>
                </div>
              )}

              {groupAction === 'MERGE' && (
                <div className="space-y-6">
                  <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-[1.5rem]"><p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-relaxed">Todos os membros de <span className="underline font-black">{groupForm.name}</span> serão migrados para o destino selecionado abaixo.</p></div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Segmento de Destino</label>
                    <select required className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black uppercase outline-none cursor-pointer" value={groupForm.mergeTarget} onChange={(e) => setGroupForm({...groupForm, mergeTarget: e.target.value})}>
                      <option value="">SELECIONE O DESTINO...</option>
                      {uniqueGroups.filter(g => g.name !== groupForm.name).map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {groupAction === 'SPLIT' && (
                <div className="space-y-6">
                  <div className="p-6 bg-amber-50 border border-amber-100 rounded-[1.5rem]"><p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-relaxed">O segmento <span className="underline font-black">{groupForm.name}</span> será removido e substituído por novas tags individuais nos perfis.</p></div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Novos Segmentos (Separe por vírgula)</label>
                    <textarea 
                      required 
                      rows={4}
                      className="w-full px-8 py-6 bg-white border border-blue-200 rounded-[2rem] text-sm font-black uppercase outline-none shadow-xl shadow-blue-50 transition-all focus:ring-4 focus:ring-blue-500/5" 
                      value={groupForm.splitSegments} 
                      onChange={(e) => setGroupForm({...groupForm, splitSegments: e.target.value})} 
                      placeholder="EX: APOIADOR, VOLUNTÁRIO, ZONA OESTE" 
                    />
                    <p className="text-[9px] font-bold text-slate-400 ml-2 uppercase italic">Atenção: Cada termo gerará uma nova tag independente no perfil do eleitor.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-8">
                <button type="button" onClick={() => setIsModalGroupOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase shadow-2xl shadow-blue-200 flex items-center justify-center gap-3 transition-all hover:bg-blue-700 active:scale-95">
                   {isSaving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Confirmar Processamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: USUÁRIO (EDIÇÃO COMPLETA) */}
      {isModalUserOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-12 border border-white/20 space-y-10 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-8">
                <div>
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{editingUser ? 'Editar Perfil de Agente' : 'Registrar Novo Colaborador'}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Controle de Acessos e Identidade</p>
                </div>
                <button onClick={() => setIsModalUserOpen(false)} className="p-4 hover:bg-slate-100 rounded-2xl transition-all text-slate-400"><X size={32} /></button>
              </div>
              <form onSubmit={handleSaveUser} className="space-y-10">
                <div className="flex flex-col items-center gap-6 py-4">
                   <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-32 h-32 rounded-[2.5rem] bg-slate-100 border-4 border-white shadow-2xl overflow-hidden flex items-center justify-center group-hover:scale-105 transition-all duration-500">
                         {previewUrl ? <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" /> : <UserIcon size={56} className="text-slate-300" />}
                         <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"><Camera size={32} /></div>
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-3 rounded-2xl shadow-2xl border-4 border-white"><Upload size={18} /></div>
                   </div>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Nome Completo</label><input required className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all uppercase" value={userForm.name} onChange={(e) => setUserForm({...userForm, name: e.target.value})} /></div>
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Nome de Usuário (Username)</label><input required className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" value={userForm.username} onChange={(e) => setUserForm({...userForm, username: e.target.value.toLowerCase().replace(/\s/g, '')})} /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">E-mail Corporativo</label><input required type="email" className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} /></div>
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Senha {editingUser && '(Deixe em branco para não alterar)'}</label><input type="password" placeholder="••••••••" className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Nível de Acesso</label><select className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black uppercase outline-none cursor-pointer" value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value as UserRole})}><option value="ASSESSOR">Assessor de Base</option><option value="ADMIN">Administrador</option><option value="PARLIAMENTARY">Parlamentar / Chefe</option></select></div>
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Status da Conta</label><select className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black uppercase outline-none cursor-pointer" value={userForm.status} onChange={(e) => setUserForm({...userForm, status: e.target.value as UserStatus})}><option value="ACTIVE">Ativo / Operante</option><option value="INACTIVE">Inativo / Bloqueado</option></select></div>
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Setores de Atuação (Permissões de Visualização)</label>
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                      {categories.map(cat => (
                        <button key={cat.id} type="button" onClick={() => {
                          const sectors = userForm.sectors || [];
                          if (sectors.includes(cat.id)) setUserForm({...userForm, sectors: sectors.filter(s => s !== cat.id)});
                          else setUserForm({...userForm, sectors: [...sectors, cat.id]});
                        }} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase border transition-all ${userForm.sectors?.includes(cat.id) ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-100' : 'bg-white text-slate-400 border-slate-200 hover:border-blue-300'}`}>{cat.name}</button>
                      ))}
                   </div>
                </div>

                <div className="flex gap-6 pt-10">
                  <button type="button" onClick={() => setIsModalUserOpen(false)} className="flex-1 py-6 bg-slate-100 text-slate-500 font-black rounded-3xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="flex-[2] py-6 bg-blue-600 text-white font-black rounded-3xl text-[10px] uppercase tracking-widest shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all">{isSaving ? 'Sincronizando...' : 'Confirmar Dados do Agente'}</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL: SETOR (EDIÇÃO COMPLETA) */}
      {isModalSectorOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-12 border border-white/20 space-y-12 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{editingSector ? 'Editar Setor Operacional' : 'Novo Setor Estratégico'}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Classificação de Protocolos</p>
                </div>
                <button onClick={() => setIsModalSectorOpen(false)} className="p-4 hover:bg-slate-100 rounded-2xl transition-all text-slate-400"><X size={32} /></button>
              </div>
              <form onSubmit={handleSaveSector} className="space-y-10">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Nome da Categoria / Área</label>
                   <input required className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" value={sectorForm.name} onChange={(e) => setSectorForm({...sectorForm, name: e.target.value.toUpperCase()})} placeholder="EX: SAÚDE, EDUCAÇÃO, OBRAS..." />
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Identidade Visual (Cor)</label>
                   <div className="flex gap-4 items-center">
                     <input type="color" className="w-20 h-20 rounded-2xl bg-white p-2 cursor-pointer border border-slate-200 shadow-sm" value={sectorForm.color} onChange={(e) => setSectorForm({...sectorForm, color: e.target.value})} />
                     <div className="flex-1 px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-black text-slate-500 uppercase">{sectorForm.color}</div>
                   </div>
                </div>
                <div className="flex gap-6">
                  <button type="button" onClick={() => setIsModalSectorOpen(false)} className="flex-1 py-6 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="flex-[2] py-6 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all">{isSaving ? 'Salvando...' : 'Confirmar Setor'}</button>
                </div>
              </form>
           </div>
        </div>
      )}
      
      {/* TELA: AUDITORIA (LOGS) */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in flex flex-col min-h-[600px]">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-black text-slate-900 uppercase flex items-center gap-2 tracking-tight"><History size={20} className="text-indigo-600" /> Registro de Operações (Log)</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Histórico completo para auditoria e transparência interna.</p>
            </div>
            <button onClick={loadTabData} className="p-3 hover:bg-slate-100 rounded-xl transition-all"><RefreshCw size={18} className={loading ? "animate-spin text-blue-600" : "text-slate-400"} /></button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50/30 border-b border-slate-100">
                  <th className="px-10 py-6">Data/Hora</th><th className="px-10 py-6">Operador</th><th className="px-10 py-6">Ação</th><th className="px-10 py-6">Módulo</th><th className="px-10 py-6">Impacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedLogs.map(log => (
                  <tr key={log.id} className="text-[11px] hover:bg-slate-50/80 transition-all font-medium">
                    <td className="px-10 py-5 font-mono text-[10px] text-slate-500 font-black">{new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                    <td className="px-10 py-5 font-black uppercase text-slate-800 tracking-tight">{log.actor.name}</td>
                    <td className="px-10 py-5">
                      <span className="px-2.5 py-1.5 rounded-lg font-black text-[8px] bg-white border border-slate-200 text-slate-600 shadow-sm uppercase tracking-widest">{log.action === 'CREATE' ? 'Criação' : log.action === 'UPDATE' ? 'Edição' : log.action === 'DELETE' ? 'Exclusão' : log.action}</span>
                    </td>
                    <td className="px-10 py-5 font-black text-indigo-500 uppercase tracking-widest text-[9px]">{log.module}</td>
                    <td className="px-10 py-5 text-slate-500 max-w-xs truncate italic">
                      {log.changes?.[0] ? `Alterou campo: ${log.changes[0].field}` : log.meta?.reason || log.meta?.count || '---'}
                    </td>
                  </tr>
                ))}
                {paginatedLogs.length === 0 && !loading && (
                   <tr><td colSpan={5} className="py-20 text-center font-black text-slate-300 uppercase text-[10px] tracking-widest">Nenhum log registrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Paginação da Auditoria */}
          <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pág.</p>
                <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 shadow-sm">
                  {logPageIndex + 1} / {Math.max(1, totalLogPages)}
                </div>
              </div>
              <select
                value={logPageSize}
                onChange={e => {
                  setLogPageSize(Number(e.target.value));
                  setLogPageIndex(0);
                }}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 outline-none cursor-pointer shadow-sm transition-all hover:border-blue-200"
              >
                {[50, 100, 200].map(size => (
                  <option key={size} value={size}>MOSTRAR {size}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setLogPageIndex(prev => Math.max(0, prev - 1))}
                disabled={logPageIndex === 0}
                className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 transition-all shadow-sm"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setLogPageIndex(prev => Math.min(totalLogPages - 1, prev + 1))}
                disabled={logPageIndex >= totalLogPages - 1 || totalLogPages === 0}
                className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 transition-all shadow-sm"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TELA: QUARENTENA */}
      {activeTab === 'audit' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 animate-in fade-in">
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[650px]">
            <div className="p-10 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-5">
                <Users size={24} className="text-blue-400" />
                <div><h3 className="font-black text-lg uppercase leading-none">Eleitores</h3><p className="text-[9px] font-black text-blue-300 uppercase tracking-[0.2em] mt-1">Exclusões Pendentes</p></div>
              </div>
              <span className="bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black shadow-inner">{pendingConstituents.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
               {pendingConstituents.map(c => (
                 <div key={c.id} className="p-8 hover:bg-rose-50/30 transition-all group flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                       <div className="flex-1 truncate">
                          <p className="text-base font-black text-slate-900 uppercase truncate">{c.name}</p>
                          <div className="flex flex-col gap-1 mt-1">
                             <p className="text-[10px] text-rose-600 font-black italic uppercase tracking-tighter bg-rose-50 px-3 py-1 rounded-lg inline-block self-start">Motivo: {c.deletion_reason}</p>
                             <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                <UserIcon size={10} className="text-slate-400" /> Solicitado por: {users.find(u => u.id === c.deleted_by)?.name || 'Sistema'}
                             </p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                        <button onClick={() => handleRestore('CONSTITUENT', c.id)} className="p-3.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-lg" title="Restaurar Registro"><RotateCcw size={18} /></button>
                        <button onClick={() => { setTargetToDelete({type:'CONSTITUENT', id:c.id, name:c.name}); setIsConfirmDeleteOpen(true); }} className="p-3.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-lg" title="Excluir Definitivamente"><Trash2 size={18} /></button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col h-[650px]">
            <div className="p-10 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-5">
                <ClipboardCheck size={24} className="text-emerald-400" />
                <div><h3 className="font-black text-lg uppercase leading-none">Demandas</h3><p className="text-[9px] font-black text-emerald-300 uppercase tracking-[0.2em] mt-1">Protocolos em Revisão</p></div>
              </div>
              <span className="bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-[10px] font-black shadow-inner">{pendingDemands.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
               {pendingDemands.map(d => (
                 <div key={d.id} className="p-8 hover:bg-rose-50/30 transition-all group flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                       <div className="flex-1 truncate">
                          <p className="text-base font-black text-slate-900 uppercase truncate">{d.title}</p>
                          <div className="flex flex-col gap-1 mt-1">
                             <p className="text-[10px] text-rose-600 font-black italic uppercase tracking-tighter bg-rose-50 px-3 py-1 rounded-lg inline-block self-start">Motivo: {d.deletion_reason}</p>
                             <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                <UserIcon size={10} className="text-slate-400" /> Solicitado por: {users.find(u => u.id === d.deleted_by)?.name || 'Sistema'}
                             </p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                        <button onClick={() => handleRestore('DEMAND', d.id)} className="p-3.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-lg" title="Restaurar Protocolo"><RotateCcw size={18} /></button>
                        <button onClick={() => { setTargetToDelete({type:'DEMAND', id:d.id, name:d.title}); setIsConfirmDeleteOpen(true); }} className="p-3.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-lg" title="Excluir Definitivamente"><Trash2 size={18} /></button>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}

      {/* TELA: SISTEMA */}
      {activeTab === 'system' && (
        <div className="space-y-10 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 text-blue-50 opacity-10 group-hover:scale-110 transition-transform duration-700"><Server size={180} /></div>
                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-inner"><Server size={28} /></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Infraestrutura Cloud</h3>
                </div>
                <div className="space-y-5 relative z-10">
                   <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Banco de Dados</span><span className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-2"><CheckCircle2 size={14} /> Ativo e Conectado</span></div>
                   <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motor de IA</span><span className="text-[10px] font-black text-blue-600 uppercase">Google Gemini 3.0 Pro</span></div>
                </div>
             </div>

             {/* NOVO CARD: INTELIGÊNCIA GEOGRÁFICA */}
             <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 text-blue-50 opacity-10 group-hover:scale-110 transition-transform duration-700"><MapPin size={180} /></div>
                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-inner"><MapPin size={28} /></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Inteligência Geográfica</h3>
                </div>
                <div className="space-y-6 relative z-10">
                   <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Converte CEPs da base em coordenadas (Lat/Lng) para alimentar o Mapa Territorial em tempo real.</p>
                   {isGeocoding ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase text-blue-600">
                           <span>Mapeando Território...</span>
                           <span>{Math.round((geocodeProgress.current / geocodeProgress.total) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(geocodeProgress.current / geocodeProgress.total) * 100}%` }} />
                        </div>
                      </div>
                   ) : (
                      <button 
                        onClick={() => setIsGeocodingConfirmOpen(true)}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <MapPin size={18} /> Verificar Coordenadas
                      </button>
                   )}
                </div>
             </div>

             {/* CARD: HIGIENIZAÇÃO DE DADOS */}
             <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-8 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 text-indigo-50 opacity-10 group-hover:scale-110 transition-transform duration-700"><Sparkles size={180} /></div>
                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-[1.5rem] flex items-center justify-center shadow-inner"><Database size={28} /></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Higiene de Dados</h3>
                </div>
                <div className="space-y-6 relative z-10">
                   <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Sincroniza todos os cadastros com os últimos padrões de formatação do sistema (Ex: Nomes Padronizados).</p>
                   {isBulkUpdating ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase text-blue-600">
                           <span>Processando...</span>
                           <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
                        </div>
                      </div>
                   ) : (
                      <button 
                        onClick={() => setIsBulkUpdateConfirmOpen(true)}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <Sparkles size={18} /> Aplicar Padronização Global
                      </button>
                   )}
                </div>
             </div>
          </div>

          <div className="bg-rose-50 p-12 rounded-[4rem] border-2 border-rose-100 shadow-2xl space-y-10 relative overflow-hidden group">
             <div className="flex flex-col xl:flex-row items-center justify-between gap-10 relative z-10">
                <div className="flex items-center gap-10">
                   <div className="w-24 h-24 bg-rose-600 text-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-rose-200"><DatabaseZap size={48} /></div>
                   <div className="max-w-xl text-center xl:text-left space-y-4">
                      <h4 className="text-3xl font-black text-rose-900 uppercase tracking-tighter">Zona de Risco Crítico</h4>
                      <p className="text-sm font-bold text-rose-700/60 leading-relaxed uppercase tracking-widest italic">Ação irreversível: Limpeza completa da base de dados. Use com extrema cautela.</p>
                   </div>
                </div>
                <button onClick={() => setIsWipeModalOpen(true)} className="px-12 py-6 bg-rose-600 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-rose-300 hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-4">
                  <Trash2 size={24} /> Limpar Base Completa
                </button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO GEOCODIFICAÇÃO EM MASSA */}
      {isGeocodingConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-12 space-y-10 border border-white/20 animate-in zoom-in-95">
              <div className="text-center space-y-6">
                 <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-100"><MapPin size={48} /></div>
                 <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Geolocalização em Massa</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 leading-relaxed px-6">O sistema verificará todos os cadastros sem coordenadas e tentará localizá-los via CEP. <br/><br/><span className="text-blue-600 font-black">Este processo respeita limites de API e pode levar alguns minutos.</span></p>
                 </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setIsGeocodingConfirmOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                <button onClick={handleBulkGeocode} className="flex-1 py-5 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3">
                   Iniciar Mapeamento
                </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO HIGIENIZAÇÃO GLOBAL */}
      {isBulkUpdateConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-12 space-y-10 border border-white/20 animate-in zoom-in-95">
              <div className="text-center space-y-6">
                 <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-indigo-100"><Sparkles size={48} /></div>
                 <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Higienização Global</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 leading-relaxed px-6">Deseja aplicar a padronização de nomes em <b>todos</b> os registros da base de dados agora?</p>
                 </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setIsBulkUpdateConfirmOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                <button onClick={handleBulkUpdateDefinitions} className="flex-1 py-5 bg-indigo-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                   Confirmar
                </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: CONFIRMAÇÃO EXCLUSÃO PERMANENTE */}
      {isConfirmDeleteOpen && targetToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-12 space-y-10 border border-white/20 animate-in zoom-in-95">
              <div className="text-center space-y-6">
                 <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl shadow-rose-100"><ShieldAlert size={48} /></div>
                 <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Exclusão Permanente</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 leading-relaxed px-6">Confirma a remoção definitiva de <br/><span className="text-rose-600 font-black">"{targetToDelete.name}"</span>?</p>
                 </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setIsConfirmDeleteOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Manter</button>
                <button onClick={confirmPermanentDelete} className="flex-1 py-5 bg-rose-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all flex items-center justify-center gap-3">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />} Confirmar
                </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: RESET DATABASE */}
      {isWipeModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[4rem] shadow-2xl p-16 space-y-10 border border-slate-100 animate-in zoom-in-95">
              <div className="text-center space-y-8">
                 <div className="w-28 h-28 bg-rose-100 text-rose-600 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl shadow-rose-200 animate-bounce"><ShieldAlert size={56} /></div>
                 <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">CUIDADO!</h3>
                 <p className="text-sm font-bold text-slate-500 uppercase leading-relaxed tracking-widest">Esta ação apagará <span className="text-rose-600 underline">TODOS</span> os dados de eleitores e trâmites de forma definitiva.</p>
              </div>
              <div className="flex flex-col gap-4">
                <button onClick={handleWipeDatabase} className="w-full py-6 bg-rose-600 text-white font-black rounded-3xl text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-rose-300 hover:bg-rose-700 transition-all active:scale-95">{isWiping ? 'EXECUTANDO...' : 'SIM, APAGAR TUDO AGORA'}</button>
                <button onClick={() => setIsWipeModalOpen(false)} className="w-full py-6 bg-slate-100 text-slate-500 font-black rounded-3xl text-[10px] uppercase tracking-[0.3em] hover:bg-slate-200 transition-all">ABORTAR OPERAÇÃO</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ControlCenter;
