
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  AlertCircle, 
  Clock, 
  TrendingUp,
  Cake,
  MessageCircle,
  Plus,
  Search,
  ChevronRight,
  Loader2,
  ClipboardCheck,
  UserPlus
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line
} from 'recharts';
import { DemandService, ConstituentService } from '../services/api';
import { WhatsAppService } from '../services/whatsapp';
import { KPIStats, Demand, Constituent } from '../types';
import StatCard from '../components/StatCard';
import DemandCreateModal from '../components/DemandCreateModal';
import ConstituentCreateModal from '../components/ConstituentCreateModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  
  const [stats, setStats] = useState<KPIStats | null>(null);
  const [recentDemands, setRecentDemands] = useState<Demand[]>([]);
  const [recentConstituents, setRecentConstituents] = useState<Constituent[]>([]);
  const [birthdayPeeps, setBirthdayPeeps] = useState<Constituent[]>([]);
  const [loading, setLoading] = useState(true);

  const [globalSearch, setGlobalSearch] = useState('');
  const [isDemandModalOpen, setIsDemandModalOpen] = useState(false);
  const [isConstituentModalOpen, setIsConstituentModalOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [s, d, c, bdays] = await Promise.all([
        DemandService.getKPIs(),
        DemandService.getAll(),
        ConstituentService.getAll(),
        ConstituentService.getBirthdaysToday()
      ]);
      
      setStats(s);
      setRecentDemands(d.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setRecentConstituents(c.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setBirthdayPeeps(bdays);
    } catch (error) {
      console.error("Erro ao carregar dashboard", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDemands = useMemo(() => {
    return recentDemands
      .filter(d => d.title.toLowerCase().includes(globalSearch.toLowerCase()))
      .slice(0, 6);
  }, [recentDemands, globalSearch]);

  const filteredConstituents = useMemo(() => {
    return recentConstituents
      .filter(c => c.name.toLowerCase().includes(globalSearch.toLowerCase()))
      .slice(0, 8);
  }, [recentConstituents, globalSearch]);

  const handleSendGreeting = async (person: Constituent) => {
    const text = `Olá ${person.name.split(' ')[0]}, tudo bem? Passando para desejar um feliz aniversário em nome do gabinete! Muita saúde e conquistas. 🎉`;
    const url = await WhatsAppService.sendDemandUpdate(person.mobile_phone, text);
    window.open(url, '_blank');
    showToast(`Mensagem de parabéns gerada.`);
  };

  if (loading || !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Sincronizando Centro de Comando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 pb-24 bg-slate-50/50 min-h-screen">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Dashboard <span className="text-blue-600">360</span></h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Bem-vindo, {currentUser?.name}. Gestão tática em tempo real.</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="relative group min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Filtrar visão rápida..." 
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold shadow-sm focus:ring-4 focus:ring-blue-600/5 transition-all outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsConstituentModalOpen(true)}
              className="flex items-center justify-center gap-3 px-6 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-[1.5rem] text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-50 active:scale-95 transition-all"
            >
              <UserPlus size={18} /> Adicionar Eleitor
            </button>
            <button 
              onClick={() => setIsDemandModalOpen(true)}
              className="flex items-center justify-center gap-3 px-8 py-3.5 bg-blue-600 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
            >
              <Plus size={18} /> Protocolo Rápido
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div onClick={() => navigate('/app/eleitores')} className="cursor-pointer hover:scale-[1.02] transition-transform active:scale-95">
            <StatCard label="Total de Eleitores" value={stats.total_constituents} icon={Users} trend="+12% Base" color="bg-blue-600" />
        </div>
        <div onClick={() => navigate('/app/demandas', { state: { activeTab: 'ACTIVE' } })} className="cursor-pointer hover:scale-[1.02] transition-transform active:scale-95">
            <StatCard label="Demandas Abertas" value={stats.open_demands} icon={AlertCircle} color="bg-amber-500" />
        </div>
        <div onClick={() => navigate('/app/eleitores')} className="cursor-pointer hover:scale-[1.02] transition-transform active:scale-95">
            <StatCard label="Aniversários Hoje" value={stats.birthdays_today} icon={Cake} color="bg-pink-500" />
        </div>
        <div onClick={() => navigate('/app/demandas', { state: { activeTab: 'FINISHED' } })} className="cursor-pointer hover:scale-[1.02] transition-transform active:scale-95">
            <StatCard label="Pendentes Terceiros" value={stats.waiting_demands} icon={Clock} color="bg-indigo-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-inner"><TrendingUp size={20} /></div>
               <h3 className="font-black text-slate-900 uppercase tracking-tight">Performance da Base</h3>
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.constituent_growth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: '900', color: '#2563eb', textTransform: 'uppercase' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#2563eb" 
                  strokeWidth={6} 
                  dot={{ r: 6, fill: '#2563eb', strokeWidth: 3, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-4 bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl flex flex-col relative overflow-hidden group">
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div className="flex items-center gap-3">
                <Cake size={20} className="text-pink-400" />
                <h3 className="font-black text-white text-xs uppercase tracking-[0.2em]">Aniversariantes</h3>
            </div>
            <span className="px-3 py-1 bg-white/10 text-white text-[9px] font-black uppercase rounded-lg border border-white/10">{birthdayPeeps.length} HOJE</span>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto max-h-[340px] pr-2 custom-scrollbar relative z-10">
            {birthdayPeeps.length > 0 ? birthdayPeeps.map(person => (
              <div key={person.id} className="flex items-center justify-between bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-black text-white truncate uppercase">{person.name}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{person.address.neighborhood}</p>
                </div>
                <button 
                  onClick={() => handleSendGreeting(person)}
                  className="p-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-500 transition-all active:scale-95"
                >
                  <MessageCircle size={16} />
                </button>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nenhum evento registrado para hoje.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Users size={20} /></div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Atividade na Base</h3>
            </div>
            <button onClick={() => navigate('/app/eleitores')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">Ver Base Completa <ChevronRight size={14} /></button>
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-8 py-5">Eleitor</th>
                  <th className="px-8 py-5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredConstituents.map((c) => (
                  <tr key={c.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black uppercase text-slate-500">{c.name.charAt(0)}</div>
                         <p className="text-sm font-black text-slate-800 truncate max-w-[180px] uppercase">{c.name}</p>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button 
                        onClick={() => navigate('/app/eleitores')}
                        className="p-2.5 bg-white border border-slate-100 text-slate-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px]">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><AlertCircle size={20} /></div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Trâmites Prioritários</h3>
            </div>
            <button onClick={() => navigate('/app/demandas')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">War Room <ChevronRight size={14} /></button>
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-8 py-5">Assunto</th>
                  <th className="px-8 py-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredDemands.map((demand) => (
                  <tr key={demand.id} className="hover:bg-blue-50/30 transition-colors group cursor-pointer" onClick={() => navigate('/app/demandas')}>
                    <td className="px-8 py-4">
                      <p className="text-sm font-black text-slate-800 line-clamp-1 uppercase">{demand.title}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">#{demand.protocol}</p>
                    </td>
                    <td className="px-8 py-4 text-right">
                       <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg ${
                        demand.status === 'OPEN' ? 'bg-blue-50 text-blue-600' : 
                        demand.status === 'IN_PROGRESS' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {demand.status === 'OPEN' ? 'Aguardando' : demand.status === 'IN_PROGRESS' ? 'Em Curso' : 'Finalizado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <DemandCreateModal 
        isOpen={isDemandModalOpen} 
        onClose={() => setIsDemandModalOpen(false)} 
        onSuccess={loadDashboardData} 
      />

      <ConstituentCreateModal
        isOpen={isConstituentModalOpen}
        onClose={() => setIsConstituentModalOpen(false)}
        onSuccess={loadDashboardData}
      />
    </div>
  );
};

export default Dashboard;
