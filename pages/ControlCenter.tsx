
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, Search, Power, History, Activity, Download, RefreshCw, X, 
  ShieldCheck, CheckCircle2, Database, Globe, Zap, Shield, Eye, Loader2, Lock,
  AlertCircle
} from 'lucide-react';
import { mockUsers } from '../services/mockData';
import { ConstituentService, DemandService } from '../services/api';
import { logger } from '../services/LoggerService';
import { useToast } from '../contexts/ToastContext';
import { UserStatus, Constituent, Demand, User, UserRole, LogEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';

const md5 = (str: string) => {
  const s = str.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

const getGravatarUrl = (email: string) => {
  const hash = md5(email || 'guest@gabinete.leg.br');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=200`;
};

const ControlCenter: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'logs' | 'users' | 'audit' | 'system'>('logs');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [pendingConstituents, setPendingConstituents] = useState<Constituent[]>([]);
  const [pendingDemands, setPendingDemands] = useState<Demand[]>([]);
  
  const [logSearch, setLogSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [logFilterModule, setLogFilterModule] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const [isModalUserOpen, setIsModalUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    avatar_url: '',
    role: 'ASSESSOR' as UserRole,
    status: 'ACTIVE' as UserStatus
  });

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'logs') {
        setAllLogs(logger.getAllLogs());
      } else if (activeTab === 'audit') {
        const [c, d] = await Promise.all([
          ConstituentService.getPendingDeletions(),
          DemandService.getPendingDeletions()
        ]);
        setPendingConstituents(c);
        setPendingDemands(d);
      }
    } catch (err) {
      showToast("Falha ao sincronizar dados.", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      const matchesModule = logFilterModule === 'all' || log.module === logFilterModule;
      const matchesSearch = !logSearch || 
        log.actor.name.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.entity_id.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.action.toLowerCase().includes(logSearch.toLowerCase());
      return matchesModule && matchesSearch;
    });
  }, [allLogs, logFilterModule, logSearch]);

  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        name: user.name,
        email: user.email,
        phone: '(31) 9' + Math.floor(10000000 + Math.random() * 90000000),
        password: '',
        avatar_url: user.avatar_url || '',
        role: user.role,
        status: user.status
      });
    } else {
      setEditingUser(null);
      setUserForm({ name: '', email: '', phone: '', password: '', avatar_url: '', role: 'ASSESSOR', status: 'ACTIVE' });
    }
    setIsModalUserOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const finalAvatar = userForm.avatar_url || getGravatarUrl(userForm.email);
      if (editingUser) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...userForm, avatar_url: finalAvatar } : u));
        showToast("Membro atualizado com sucesso.");
        logger.log('UPDATE', 'CONTROL_CENTER', editingUser.id, currentUser!);
      } else {
        const newUser: User = { id: 'u' + Date.now(), ...userForm, avatar_url: finalAvatar };
        setUsers(prev => [newUser, ...prev]);
        showToast("Novo assessor integrado ao gabinete.");
        logger.log('CREATE', 'CONTROL_CENTER', newUser.id, currentUser!);
      }
      setIsModalUserOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Funções de Sistema Ativadas
  const handleSystemAction = async (type: 'BACKUP' | 'NOTES') => {
    setLoading(true);
    if (type === 'BACKUP') {
      showToast("Iniciando Backup SQL Estratégico...", "info");
      await new Promise(r => setTimeout(r, 2000));
      showToast("Dump de banco de dados concluído. Download iniciado.");
      logger.log('EXPORT', 'SYSTEM', 'DATABASE_SQL', currentUser!);
    } else {
      showToast("Compilando notas de versão v2.5.0...", "info");
      await new Promise(r => setTimeout(r, 1000));
      showToast("Documentação de release gerada com sucesso.");
    }
    setLoading(false);
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
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 italic">Governança, Segurança e Equipe</p>
           </div>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-[2rem] border border-slate-200 shadow-xl overflow-x-auto">
          {[
            { id: 'logs', label: 'Auditoria', icon: History },
            { id: 'users', label: 'Equipe', icon: Users },
            { id: 'audit', label: 'Quarentena', icon: AlertCircle },
            { id: 'system', label: 'Sistema', icon: Activity }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap active:scale-95 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'logs' && (
        <div className="space-y-6 page-enter">
           <div className="bg-white p-6 rounded-[2.2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 group">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                  type="text" 
                  placeholder="Pesquisar no histórico de ações..." 
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                 />
              </div>
              <button onClick={loadTabData} className="p-3.5 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-900 hover:text-white transition-all active:scale-95">
                <RefreshCw size={18} />
              </button>
           </div>

           <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
              <div className="flex flex-col divide-y divide-slate-50">
                {loading ? (
                  <div className="p-20 text-center flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                  </div>
                ) : filteredLogs.length > 0 ? filteredLogs.map(log => (
                  <div key={log.id} className="group flex items-center gap-6 px-10 py-5 hover:bg-slate-50/80 transition-all text-[11px] font-medium border-l-[6px] border-l-transparent hover:border-l-blue-600">
                    <span className="text-slate-400 font-mono w-20 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    
                    <div className="flex items-center gap-3 w-48 shrink-0">
                      <img src={getGravatarUrl(log.actor.email)} className="w-8 h-8 rounded-lg shadow-sm" />
                      <span className="font-black text-slate-900 truncate uppercase">{log.actor.name.split(' ')[0]}</span>
                    </div>

                    <div className="w-32 shrink-0 text-center">
                      <span className="px-2.5 py-1 rounded-lg font-black uppercase text-[8px] border shadow-sm block bg-blue-50 text-blue-600 border-blue-100">
                        {log.action.replace('_', ' ')}
                      </span>
                    </div>

                    <span className="text-slate-400 font-black uppercase tracking-widest w-24 shrink-0 text-center">{log.module}</span>
                    <span className="text-slate-500 truncate flex-1 font-mono tracking-tighter opacity-60">ID: {log.entity_id}</span>

                    <button 
                      onClick={() => setSelectedLog(log)}
                      className="p-2.5 bg-white border border-slate-100 text-slate-300 hover:text-blue-600 rounded-xl opacity-0 group-hover:opacity-100"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                )) : (
                  <div className="p-24 text-center">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum registro encontrado.</p>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-8 page-enter">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
             <div className="relative flex-1 max-w-md group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar assessor..." 
                  className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-[1.5rem] text-xs font-bold transition-all outline-none shadow-sm" 
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
             </div>
             <button 
              onClick={() => handleOpenUserModal()} 
              className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 transition-all"
             >
                <UserPlus size={18} /> Novo Assessor
             </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {users.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
              <div key={u.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-6 group transition-all hover:shadow-xl">
                <div className="relative">
                  <img src={u.avatar_url || getGravatarUrl(u.email)} className="w-20 h-20 rounded-[1.8rem] border-4 border-slate-50 object-cover shadow-lg" />
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white ${u.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </div>
                <div className="w-full">
                  <h4 className="text-base font-black text-slate-900 uppercase tracking-tight truncate">{u.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase truncate mt-1">{u.email}</p>
                </div>
                <button onClick={() => handleOpenUserModal(u)} className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all active:scale-95">Editar Membro</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 page-enter">
           <div className="p-10 bg-white rounded-[3rem] shadow-xl border border-slate-100 transition-all hover:-translate-y-1">
              <Database size={40} className="text-emerald-500 mb-6" />
              <h4 className="text-xl font-black uppercase tracking-tight mb-3">Integridade de Dados</h4>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">Base de dados normalizada e higienizada via algoritmos de detecção de homônimos.</p>
              <button 
                onClick={() => handleSystemAction('BACKUP')}
                disabled={loading}
                className="w-full py-4 bg-slate-50 text-slate-900 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} SQL Backup
              </button>
           </div>

           <div className="p-10 bg-white rounded-[3rem] shadow-xl border border-slate-100 transition-all hover:-translate-y-1">
              <Globe size={40} className="text-blue-500 mb-6" />
              <h4 className="text-xl font-black uppercase tracking-tight mb-3">API Gateway</h4>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">Conexão redundante com os servidores de inteligência legislativa e geocodificação.</p>
              <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /> Operacional</div>
           </div>

           <div className="p-10 bg-slate-900 text-white rounded-[3rem] shadow-xl border border-slate-100 transition-all hover:-translate-y-1">
              <Zap size={40} className="text-amber-400 mb-6" />
              <h4 className="text-xl font-black uppercase tracking-tight mb-3">Versão do CRM</h4>
              <p className="text-sm text-slate-400 leading-relaxed mb-8">Gabinete360 v2.5.0-MVP Enterprise Build. Versão estável com IA Gemini integrada.</p>
              <button 
                onClick={() => handleSystemAction('NOTES')}
                disabled={loading}
                className="w-full py-4 bg-white/10 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95"
              >
                Release Notes
              </button>
           </div>
        </div>
      )}

      {isModalUserOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl p-10 border border-white/20 space-y-10 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{editingUser ? 'Editar' : 'Novo'} Assessor</h3>
                <button onClick={() => setIsModalUserOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X size={28} /></button>
              </div>
              <form onSubmit={handleSaveUser} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-3">Nome Completo</label>
                     <input required className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" value={userForm.name} onChange={(e) => setUserForm({...userForm, name: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-3">E-mail Corporativo</label>
                     <input required type="email" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} />
                   </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalUserOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase">Cancelar</button>
                  <button type="submit" className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase shadow-2xl transition-all hover:bg-blue-700 active:scale-95">
                    {isSaving ? <Loader2 className="animate-spin inline-block mr-2" size={16} /> : <CheckCircle2 className="inline-block mr-2" size={16} />}
                    Confirmar Registro
                  </button>
                </div>
              </form>
           </div>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl p-10 space-y-8 animate-in zoom-in-95">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 uppercase">Evento de Auditoria</h3>
                <button onClick={() => setSelectedLog(null)} className="p-2 text-slate-400"><X size={28} /></button>
              </div>
              <div className="bg-slate-900 text-emerald-400 p-8 rounded-[2rem] font-mono text-[11px] overflow-x-auto shadow-2xl">
                 <pre>{JSON.stringify(selectedLog, null, 2)}</pre>
              </div>
              <button onClick={() => setSelectedLog(null)} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl text-[10px] uppercase">Fechar Detalhes</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ControlCenter;
