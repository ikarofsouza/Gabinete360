
import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Plus, Search, Loader2, Save, Fingerprint, MapPin, 
  ChevronRight, UserPlus, ClipboardCheck 
} from 'lucide-react';
import { Constituent, Category, DemandPriority } from '../types';
import { ConstituentService, CategoryService, DemandService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ConstituentCreateModal from './ConstituentCreateModal';

interface DemandCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DemandCreateModal: React.FC<DemandCreateModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [constituentSearch, setConstituentSearch] = useState('');
  const [selectedConstituent, setSelectedConstituent] = useState<Constituent | null>(null);
  
  // Estado para controlar o modal de novo eleitor dentro deste fluxo
  const [isConstituentModalOpen, setIsConstituentModalOpen] = useState(false);
  
  const [newDemand, setNewDemand] = useState({
    constituent_id: '',
    title: '',
    description: '',
    category_id: '',
    priority: 'MEDIUM' as DemandPriority
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, cons] = await Promise.all([
        CategoryService.getAll(),
        ConstituentService.getAll()
      ]);
      // CategoryService.getAll already sorts by name
      setCategories(cats);
      setConstituents(cons);
    } finally {
      setLoading(false);
    }
  };

  const matchedConstituents = useMemo(() => {
    if (constituentSearch.length < 2) return [];
    const search = constituentSearch.toLowerCase();
    return constituents.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.document.replace(/\D/g, '').includes(search) || 
      c.mobile_phone.replace(/\D/g, '').includes(search)
    ).slice(0, 5);
  }, [constituents, constituentSearch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newDemand.constituent_id || !newDemand.title) {
      showToast("Campos obrigatórios ausentes.", "error");
      return;
    }
    setAiLoading(true);
    try {
      const created = await DemandService.create({
        ...newDemand,
        assigned_to_user_id: currentUser.id,
      }, currentUser);
      showToast(`Protocolo #${created.protocol} gerado com sucesso!`);
      setNewDemand({ constituent_id: '', title: '', description: '', category_id: '', priority: 'MEDIUM' });
      setSelectedConstituent(null);
      setConstituentSearch('');
      onSuccess();
      onClose();
    } catch (error) {
      showToast("Erro ao gerar demanda.", "error");
    } finally {
      setAiLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl p-12 border border-white/20 space-y-10 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between border-b border-slate-100 pb-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl">
              <ClipboardCheck size={32} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Adicionar Nova Demanda</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abertura de Protocolo Territorial</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X size={32} /></button>
        </div>

        <form onSubmit={handleCreate} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Eleitor Solicitante *</label>
              
              {selectedConstituent ? (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between animate-in zoom-in-95">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-lg shadow-lg">{selectedConstituent.name.charAt(0)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate uppercase">{selectedConstituent.name}</p>
                      <p className="text-[9px] text-blue-600 font-bold uppercase tracking-widest">{selectedConstituent.address.neighborhood}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setSelectedConstituent(null); setNewDemand({...newDemand, constituent_id: ''}); }} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-blue-600 transition-all"><X size={16} /></button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                    <input 
                      placeholder="Buscar por Nome, CPF ou Telefone..." 
                      className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-600/5 transition-all"
                      value={constituentSearch}
                      onChange={(e) => setConstituentSearch(e.target.value)}
                    />
                  </div>
                  {matchedConstituents.length > 0 && (
                    <div className="bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-50 animate-in slide-in-from-top-2">
                      {matchedConstituents.map(c => (
                        <button 
                          key={c.id} 
                          type="button"
                          onClick={() => {
                            setSelectedConstituent(c);
                            setNewDemand({...newDemand, constituent_id: c.id});
                            setConstituentSearch('');
                          }}
                          className="w-full p-4 flex items-center justify-between hover:bg-blue-50/50 transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs">{c.name.charAt(0)}</div>
                            <div>
                              <p className="text-xs font-black text-slate-900 uppercase">{c.name}</p>
                              <div className="flex gap-2 items-center mt-0.5">
                                <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1"><Fingerprint size={8} /> {c.document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.***.$3-$4')}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1"><MapPin size={8} /> {c.address.neighborhood}</span>
                              </div>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  )}
                  {constituentSearch.length >= 2 && matchedConstituents.length === 0 && (
                    <div className="p-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Nenhum eleitor encontrado</p>
                      <button 
                        type="button" 
                        onClick={() => setIsConstituentModalOpen(true)}
                        className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-1 justify-center mx-auto"
                      >
                        <UserPlus size={12} /> Cadastrar Novo Eleitor
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Setor *</label>
              <select 
                required 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none uppercase cursor-pointer" 
                value={newDemand.category_id} 
                onChange={(e) => setNewDemand({...newDemand, category_id: e.target.value})}
              >
                <option value="">Selecione o Setor...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Assunto / Título *</label>
            <input 
              required 
              placeholder="EX: TAPA-BURACO RUA X, MANUTENÇÃO POSTE Y..." 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none uppercase" 
              value={newDemand.title} 
              onChange={(e) => setNewDemand({...newDemand, title: e.target.value.toUpperCase()})} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Relato Detalhado do Caso</label>
            <textarea 
              rows={5} 
              className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] text-sm font-medium outline-none resize-none" 
              placeholder="Descreva os detalhes da solicitação..." 
              value={newDemand.description} 
              onChange={(e) => setNewDemand({...newDemand, description: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Grau de Urgência</label>
              <div className="flex gap-2">
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                  <button 
                    key={p} 
                    type="button" 
                    onClick={() => setNewDemand({...newDemand, priority: p as any})} 
                    className={`flex-1 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${newDemand.priority === p ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                  >
                    {p === 'LOW' ? 'Baixa' : p === 'MEDIUM' ? 'Média' : p === 'HIGH' ? 'Alta' : 'Urgente'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Data Alvo (SLA)</label>
              <input type="date" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
            </div>
          </div>

          <div className="flex gap-4 pt-10 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
            <button 
              type="submit" 
              disabled={aiLoading || !newDemand.constituent_id} 
              className="flex-[2] py-5 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
            >
              {aiLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} Gerar Demanda
            </button>
          </div>
        </form>

        <ConstituentCreateModal 
          isOpen={isConstituentModalOpen}
          onClose={() => setIsConstituentModalOpen(false)}
          onSuccess={() => {
            loadData(); // Recarrega a lista para que o novo eleitor apareça na busca
          }}
        />
      </div>
    </div>
  );
};

export default DemandCreateModal;
