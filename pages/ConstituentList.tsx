
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import MiniSearch from 'minisearch';
import Papa from 'papaparse';
import { 
  useReactTable, 
  getCoreRowModel, 
  getPaginationRowModel,
  flexRender, 
  createColumnHelper 
} from '@tanstack/react-table';
import { 
  Search, Plus, Filter, MessageCircle, MapPin, ChevronRight,
  Loader2, X, Phone, User as UserIcon, Fingerprint, Star, 
  Trash2, Edit2, Info, Tag, Upload, Hash,
  Users2, Building2, UserCheck, Sparkles, FileSpreadsheet, StickyNote, Mail, UserPlus,
  Cake, ExternalLink, History, ClipboardList, Calendar, Map as MapIcon,
  Navigation, ShieldAlert, Database, CheckCircle, Save, RefreshCw, ChevronLeft
} from 'lucide-react';

import { ConstituentService, DemandService, UserService } from '../services/api';
import { GeoService } from '../services/geo';
import { AIService } from '../services/ai';
import { logger } from '../services/LoggerService';
import { legacyKnownTags } from '../services/mockData';
import { Constituent, Demand, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import DemandStatusBadge from '../components/DemandStatusBadge';
import ConstituentCreateModal from '../components/ConstituentCreateModal';

// --- Constantes Estritas de Regra de Negócio ---
const PRIORITY_RESPONSIBLES = [
  'ALINE', 'ATILIO', 'DERSON', 'FRANCIS JUNIO', 
  'IKARO', 'JOAO CARLOS', 'NANDA', 'PAMELA'
];

const maskCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').substring(0, 14);
const maskPhone = (v: string) => {
  v = v.replace(/\D/g, '');
  if (v.startsWith('55') && v.length > 10) v = v.substring(2);
  return v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
};
const maskCEP = (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
const cleanNumbers = (v: string) => (v || '').replace(/\D/g, '');

const toTitleCase = (str: string) => {
  if (!str) return '';
  const particles = ['de', 'da', 'do', 'dos', 'das', 'e'];
  return str.toLowerCase().split(' ').map((word, index) => {
    if (particles.includes(word) && index !== 0) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
};

const calculateAge = (birthDate?: string) => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) { age--; }
  return age;
};

const cleanStreetForSearch = (street: string) => {
  if (!street) return '';
  return street.split(',')[0].split('-')[0].replace(/\d+$/, '').replace(/\b(R|Rua|Av|Avenida|Trav|Travessa|Al|Alameda)\b\.?\s+/gi, '').trim();
};

const columnHelper = createColumnHelper<Constituent>();

const ConstituentList: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLeadership, setFilterLeadership] = useState<string>('all');
  const [filterNeighborhood, setFilterNeighborhood] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterOwnership, setFilterOwnership] = useState<string>('all');
  const [isBirthdayFilterActive, setIsBirthdayFilterActive] = useState(false);
  
  const [selectedConstituent, setSelectedConstituent] = useState<Constituent | null>(null);
  const [constituentDemands, setConstituentDemands] = useState<Demand[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'location' | 'history' | 'audit'>('profile');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingConstituent, setEditingConstituent] = useState<Constituent | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState('');

  const [tempNotes, setTempNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isRecalibrating, setIsRecalibrating] = useState(false);

  const [importStep, setImportProgressStep] = useState<0 | 1 | 2>(0); 
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [defaultCity, setDefaultCity] = useState('Sete Lagoas');
  const [defaultState, setDefaultState] = useState('MG');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '' });

  const miniSearch = useMemo(() => {
    return new MiniSearch({
      fields: ['name', 'document', 'neighborhood', 'mobile_phone'],
      storeFields: ['id'],
      searchOptions: { 
        fuzzy: 0, 
        prefix: false, 
        combineWith: 'AND'
      }
    });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [consData, usersData] = await Promise.all([
        ConstituentService.getAll(),
        UserService.getAll()
      ]);
      
      const sortedConstituents = consData.sort((a, b) => 
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      );

      setConstituents(sortedConstituents);
      setSystemUsers(usersData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (location.state?.filter === 'birthdays_today') {
      setIsBirthdayFilterActive(true);
      setSearchTerm('');
    }
  }, [location.state]);

  useEffect(() => {
    if (constituents.length > 0) {
      miniSearch.removeAll();
      miniSearch.addAll(constituents.map(c => ({
        id: c.id,
        name: c.name,
        document: cleanNumbers(c.document),
        neighborhood: c.address.neighborhood,
        mobile_phone: cleanNumbers(c.mobile_phone)
      })));
    }
  }, [constituents, miniSearch]);

  const filteredConstituents = useMemo(() => {
    let result = [...constituents];

    // Filtro de Aniversariantes do Dia
    if (isBirthdayFilterActive) {
      const today = new Date();
      result = result.filter(c => {
        if (!c.birth_date) return false;
        const bDate = new Date(c.birth_date);
        return bDate.getUTCDate() === today.getUTCDate() && bDate.getUTCMonth() === today.getUTCMonth();
      });
    }

    if (searchTerm.trim().length > 1) {
      const searchResults = miniSearch.search(searchTerm, { fuzzy: 0, prefix: false });
      const resultIds = new Set(searchResults.map(r => r.id));
      result = result.filter(c => resultIds.has(c.id));
    }
    if (filterLeadership === 'yes') result = result.filter(c => c.is_leadership);
    if (filterLeadership === 'no') result = result.filter(c => !c.is_leadership);
    
    if (filterOwnership === 'mine' && currentUser?.id) {
      const currentId = currentUser.id.trim();
      result = result.filter(c => (c.responsible_user_id || '').trim() === currentId);
    }
    
    if (filterNeighborhood !== 'all') {
      result = result.filter(c => c.address.neighborhood === filterNeighborhood);
    }

    if (filterGroup !== 'all') {
      result = result.filter(c => c.tags && c.tags.includes(filterGroup));
    }

    return result;
  }, [searchTerm, constituents, miniSearch, filterLeadership, filterNeighborhood, filterGroup, filterOwnership, currentUser, isBirthdayFilterActive]);

  const getResponsibleUser = (id: string) => systemUsers.find(u => u.id === id);

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Nome Completo',
      cell: info => (
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black uppercase border shadow-sm ${info.row.original.is_leadership ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            {info.getValue().charAt(0)}
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">{info.getValue()}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider font-mono">{maskCPF(info.row.original.document)}</p>
          </div>
        </div>
      )
    }),
    columnHelper.accessor('mobile_phone', {
      header: 'Telefone',
      cell: info => <span className="text-xs font-black text-slate-700 font-mono">{maskPhone(info.getValue())}</span>
    }),
    columnHelper.accessor('address.neighborhood', {
      header: 'Bairro',
      cell: info => <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200/50">{info.getValue()}</span>
    }),
    columnHelper.accessor('id', {
      id: 'groups',
      header: 'Grupos',
      cell: info => (
        <div className="flex flex-wrap gap-1 max-w-[180px]">
          {info.row.original.tags.slice(0, 3).map(t => (
            <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded-md border border-blue-100">{t}</span>
          ))}
          {info.row.original.tags.length > 3 && <span className="text-[8px] font-black text-slate-400 uppercase">+{info.row.original.tags.length - 3}</span>}
        </div>
      )
    }),
    columnHelper.accessor('responsible_user_id', {
      header: 'Responsável',
      cell: info => {
        const owner = getResponsibleUser(info.getValue());
        return (
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg border ${owner ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
              {owner ? owner.name.split(' ')[0] : 'Gabinete'}
            </span>
          </div>
        );
      }
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: info => (
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => handleOpenDetails(info.row.original)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl" title="Ficha Completa"><Info size={18} /></button>
          <button onClick={() => handleEdit(info.row.original)} className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl" title="Editar"><Edit2 size={18} /></button>
          <a href={`https://wa.me/${info.row.original.mobile_phone}`} target="_blank" rel="noreferrer" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl"><MessageCircle size={18} /></a>
          <button onClick={() => handleDelete(info.row.original.id)} className="p-2 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl" title="Excluir"><Trash2 size={18} /></button>
        </div>
      )
    })
  ], [systemUsers]);

  const table = useReactTable({
    data: filteredConstituents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 25,
      },
    },
  });

  const neighborhoodOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    constituents.forEach(c => {
      const n = c.address.neighborhood;
      if (n) counts[n] = (counts[n] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { sensitivity: 'base' }));
  }, [constituents]);

  const groupOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    constituents.forEach(c => {
      if (c.tags) {
        c.tags.forEach(t => {
          counts[t] = (counts[t] || 0) + 1;
        });
      }
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { sensitivity: 'base' }));
  }, [constituents]);

  const handleOpenDetails = async (c: Constituent) => {
    setSelectedConstituent(c);
    setTempNotes(c.notes || '');
    setActiveTab('profile');
    setIsDrawerOpen(true);
    const allDemands = await DemandService.getAll();
    setConstituentDemands(allDemands.filter(d => d.constituent_id === c.id));
  };

  const handleSaveQuickNotes = async () => {
    if (!selectedConstituent || !currentUser) return;
    setIsSavingNotes(true);
    try {
      const updated = await ConstituentService.update(selectedConstituent.id, { notes: tempNotes }, currentUser);
      setSelectedConstituent(updated);
      setConstituents(prev => prev.map(c => c.id === updated.id ? updated : c));
      showToast("Observações atualizadas.");
    } catch (e) {
      showToast("Erro ao salvar observações.", "error");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleEdit = (c: Constituent) => {
    setEditingConstituent(c);
    setIsModalOpen(true);
  };

  const handleNewConstituent = () => {
    setEditingConstituent(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setDeletionReason('');
    setIsDeleteModalOpen(true);
  };

  const confirmDeletion = async () => {
    if (!currentUser || !deleteId || !deletionReason.trim()) return;
    try {
      setLoading(true);
      await ConstituentService.delete(deleteId, currentUser, deletionReason);
      setConstituents(prev => prev.filter(c => c.id !== deleteId));
      if (selectedConstituent?.id === deleteId) {
        setIsDrawerOpen(false);
        setSelectedConstituent(null);
      }
      showToast("Registro enviado para Quarentena de Auditoria.");
      setIsDeleteModalOpen(false);
      setDeleteId(null);
    } catch (error) {
      showToast("Erro ao processar solicitação.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > 0) {
          setCsvData(results.data);
          setCsvHeaders(Object.keys(results.data[0]));
          const autoMap: Record<string, string> = {};
          const fields = [
            { key: 'name', labels: ['nome', 'name', 'eleitor', 'cidadão', 'completo'] },
            { key: 'document', labels: ['cpf', 'documento', 'cnpj', 'identidade'] },
            { key: 'mobile_phone', labels: ['telefone', 'celular', 'whatsapp', 'mobile', 'contato'] },
            { key: 'zip_code', labels: ['cep', 'zip'] },
            { key: 'street', labels: ['rua', 'logradouro', 'endereço', 'address', 'street'] },
            { key: 'number', labels: ['número', 'nº', 'number', 'num'] },
            { key: 'neighborhood', labels: ['bairro', 'neighborhood', 'região'] },
            { key: 'city', labels: ['cidade', 'city', 'localidade'] },
            { key: 'state', labels: ['uf', 'estado', 'state', 'sigla'] },
            { key: 'tags', labels: ['grupos', 'tags', 'observações', 'legado', 'notas', 'perfil'] },
          ];
          const headers = Object.keys(results.data[0]);
          fields.forEach(f => {
            const match = headers.find(h => f.labels.some(label => h.toLowerCase().includes(label)));
            if (match) autoMap[f.key] = match;
          });
          setColumnMapping(autoMap);
          setImportProgressStep(1);
        } else {
          showToast("O arquivo parece estar vazio.", "error");
        }
      }
    });
  };

  const processGroupsSegments = async (rawGroups: string, currentUsers: User[]) => {
    let finalTags: string[] = [];
    let responsibleId = '';
    let updatedUsers = [...currentUsers];

    const segments = rawGroups.toString().toUpperCase().split(/[,;\/|]/).map(s => s.trim());
    
    for (const segment of segments) {
      if (!segment) continue;

      const matchedName = PRIORITY_RESPONSIBLES.find(name => segment === name || segment.includes(name));

      if (matchedName) {
        let userMatch = updatedUsers.find(u => {
          const uName = (u.name || '').toUpperCase();
          return uName === matchedName || uName.startsWith(matchedName + " ");
        });
        
        if (!userMatch && currentUser) {
          const newUserId = await UserService.create(currentUser, {
            name: toTitleCase(matchedName),
            email: `${matchedName.toLowerCase().replace(/\s/g, '.')}@gabinete.internal`,
            username: matchedName.toLowerCase().replace(/\s/g, '.'),
            role: 'ASSESSOR',
            status: 'ACTIVE'
          });
          updatedUsers = await UserService.getAll();
          userMatch = updatedUsers.find(u => u.id === newUserId);
        }
        if (userMatch) responsibleId = userMatch.id;
      } 
      else {
        finalTags.push(segment);
      }
    }
    return { finalTags, responsibleId, updatedUsers };
  };

  const handleRecalibrateBase = async () => {
    if (!currentUser || isRecalibrating) return;
    setIsRecalibrating(true);
    showToast("Iniciando recalibração da base...", "info");
    
    try {
      const activeUsers = await UserService.getAll();
      let currentUsersList = [...activeUsers];
      let fixedCount = 0;

      for (const constituent of constituents) {
        const rawTags = constituent.tags.join(', ');
        const { finalTags, responsibleId, updatedUsers } = await processGroupsSegments(rawTags, currentUsersList);
        currentUsersList = updatedUsers;

        const hasChanges = 
          JSON.stringify(finalTags.sort()) !== JSON.stringify(constituent.tags.sort()) ||
          (responsibleId && responsibleId !== constituent.responsible_user_id);

        if (hasChanges) {
          await ConstituentService.update(constituent.id, {
            tags: Array.from(new Set(finalTags)),
            responsible_user_id: responsibleId || constituent.responsible_user_id
          }, currentUser);
          fixedCount++;
        }
      }

      await fetchData();
      showToast(`Recalibração concluída. ${fixedCount} registros corrigidos.`);
    } catch (e) {
      showToast("Falha na recalibração.", "error");
    } finally {
      setIsRecalibrating(false);
    }
  };

  const processImport = async () => {
    if (!currentUser || csvData.length === 0) return;
    setIsImporting(true);
    setImportProgressStep(2);
    setImportProgress({ current: 0, total: csvData.length, status: 'Preparando motor de inteligência...' });
    
    let activeUsers = await UserService.getAll();
    const batch: Partial<Constituent>[] = [];
    
    try {
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const rowName = row[columnMapping['name']] || `Registro #${i+1}`;
        setImportProgress(prev => ({ ...prev, current: i + 1, status: `Sincronizando: ${rowName.substring(0, 15)}...` }));
        
        try {
          let zip_code = cleanNumbers(row[columnMapping['zip_code']] || '');
          let street = (row[columnMapping['street']] || '').toUpperCase();
          let neighborhood = (row[columnMapping['neighborhood']] || '').toUpperCase();
          let city = (row[columnMapping['city']] || defaultCity || '').toUpperCase();
          let state = (row[columnMapping['state']] || defaultState || '').toUpperCase();

          if (zip_code.length === 8) {
            const res = await GeoService.getAddressByCep(zip_code);
            if (res && !res.erro) {
              street = res.logradouro.toUpperCase() || street;
              neighborhood = res.bairro.toUpperCase() || neighborhood;
              city = res.localidade.toUpperCase() || city;
              state = res.uf.toUpperCase() || state;
            }
          } else if (street.length >= 3 && city && state) {
            const res = await GeoService.getCepByAddress(state, city, cleanStreetForSearch(street));
            if (res && res.length > 0) zip_code = cleanNumbers(res[0].cep);
          }

          const rawGroups = (row[columnMapping['tags']] || '').toString();
          const { finalTags, responsibleId, updatedUsers } = await processGroupsSegments(rawGroups, activeUsers);
          activeUsers = updatedUsers;

          batch.push({
            name: rowName,
            document: cleanNumbers(row[columnMapping['document']] || ''),
            mobile_phone: cleanNumbers(row[columnMapping['mobile_phone']] || ''),
            address: { 
              zip_code, street, number: row[columnMapping['number']] || 'S/N', complement: '', 
              neighborhood, city, state 
            },
            responsible_user_id: responsibleId,
            tags: Array.from(new Set(['Smart Import', ...finalTags])),
            is_leadership: false,
            created_by: currentUser.id,
            is_pending_deletion: false 
          } as any);
        } catch (e) { console.error(e); }
        
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 50));
      }

      if (batch.length > 0) {
        await ConstituentService.batchCreate(batch, currentUser);
        await fetchData(); 
        showToast(`${batch.length} eleitores integrados com sucesso!`);
      }
      setIsImportModalOpen(false);
      setImportProgressStep(0);
    } catch (e) {
      showToast("Erro crítico na importação.", "error");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.8rem] flex items-center justify-center shadow-2xl shadow-blue-200">
             <Users2 size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Eleitores</h1>
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1 italic">Gestão estratégica de base e território.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleRecalibrateBase}
            disabled={isRecalibrating}
            className={`inline-flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm ${isRecalibrating ? 'opacity-50' : ''}`}
          >
            {isRecalibrating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 
            Recalibrar Base
          </button>
          <button onClick={() => { setImportProgressStep(0); setIsImportModalOpen(true); }} className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
            <Upload size={16} /> Smart Import
          </button>
          <button onClick={handleNewConstituent} className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">
            <UserPlus size={18} /> Novo Eleitor
          </button>
        </div>
      </header>

      {/* Mini Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner"><Users2 size={24} /></div>
          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base de Dados</p><p className="text-2xl font-black text-slate-900">{constituents.length}</p></div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><UserCheck size={24} /></div>
          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sua Carteira</p><p className="text-2xl font-black text-slate-900">{constituents.filter(c => (c.responsible_user_id || '').trim() === (currentUser?.id || '').trim()).length}</p></div>
        </div>
        <div className="md:col-span-2 bg-slate-900 p-2 rounded-[1.8rem] flex gap-1 shadow-2xl">
          <button onClick={() => setFilterOwnership('all')} className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterOwnership === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Base Geral</button>
          <button onClick={() => setFilterOwnership('mine')} className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterOwnership === 'mine' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Minha Carteira</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col space-y-4">
        {isBirthdayFilterActive && (
          <div className="flex items-center justify-between px-6 py-4 bg-pink-50 border border-pink-100 rounded-2xl animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <Cake size={20} className="text-pink-500" />
              <p className="text-xs font-black text-pink-700 uppercase tracking-widest">Visualizando aniversariantes de hoje</p>
            </div>
            <button 
              onClick={() => setIsBirthdayFilterActive(false)}
              className="px-4 py-2 bg-white text-pink-600 border border-pink-200 rounded-xl text-[9px] font-black uppercase hover:bg-pink-600 hover:text-white transition-all shadow-sm flex items-center gap-2"
            >
              <X size={14} /> Limpar Filtro
            </button>
          </div>
        )}
        
        <div className="flex flex-col 2xl:flex-row gap-4">
          <div className="relative w-full 2xl:w-[40%] group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={22} />
            <input 
              type="text" 
              placeholder="Pesquisar por Nome, CPF, Bairro ou Telefone..." 
              className="w-full pl-16 pr-12 py-5 bg-slate-50 border border-slate-200 rounded-[1.8rem] text-sm font-bold focus:ring-4 focus:ring-blue-500/5 focus:bg-white outline-none transition-all placeholder:text-slate-400" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-full text-slate-400 transition-all"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full 2xl:flex-1">
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl hover:bg-white transition-colors w-full h-full">
              <Building2 size={16} className="text-slate-400 shrink-0" />
              <select 
                className="bg-transparent text-[10px] font-black text-slate-600 outline-none w-full uppercase cursor-pointer" 
                value={filterNeighborhood} 
                onChange={(e) => setFilterNeighborhood(e.target.value)}
              >
                <option value="all">TODOS OS BAIRROS</option>
                {neighborhoodOptions.map(([n, count]) => (
                  <option key={n} value={n}>{n} ({count})</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl hover:bg-white transition-colors w-full h-full">
              <Tag size={16} className="text-slate-400 shrink-0" />
              <select 
                className="bg-transparent text-[10px] font-black text-slate-600 outline-none w-full uppercase cursor-pointer" 
                value={filterGroup} 
                onChange={(e) => setFilterGroup(e.target.value)}
              >
                <option value="all">TODOS OS GRUPOS</option>
                {groupOptions.map(([n, count]) => (
                  <option key={n} value={n}>{n} ({count})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl hover:bg-white transition-colors w-full h-full">
              <Star size={16} className="text-slate-400 shrink-0" />
              <select 
                className="bg-transparent text-[10px] font-black text-slate-600 outline-none w-full uppercase cursor-pointer" 
                value={filterLeadership} 
                onChange={(e) => setFilterLeadership(e.target.value)}
              >
                <option value="all">PERFIL: TODOS</option>
                <option value="yes">LIDERANÇAS</option>
                <option value="no">BASE COMUM</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* TELA: TABELA DE ELEITORES */}
      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-10 py-6">{flexRender(header.column.columnDef.header, header.getContext())}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="p-32 text-center"><Loader2 className="animate-spin inline-block text-blue-600" size={40} /></td></tr>
              ) : table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-blue-50/30 transition-all group cursor-pointer" onClick={() => handleOpenDetails(row.original)}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-10 py-6">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              )) : (
                <tr><td colSpan={7} className="p-32 text-center text-slate-400 font-black italic text-sm uppercase tracking-widest">Nenhum eleitor encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pág.</p>
               <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 shadow-sm">{table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</div>
            </div>
            <select
              value={table.getState().pagination.pageSize}
              onChange={e => table.setPageSize(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black text-slate-600 outline-none cursor-pointer shadow-sm transition-all hover:border-blue-200"
            >
              {[25, 50, 100].map(pageSize => (
                <option key={pageSize} value={pageSize}>MOSTRAR {pageSize}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); table.previousPage(); }}
              disabled={!table.getCanPreviousPage()}
              className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); table.nextPage(); }}
              disabled={!table.getCanNextPage()}
              className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-blue-600 hover:border-blue-200 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Side Drawer Detalhes */}
      {isDrawerOpen && selectedConstituent && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[150] transition-opacity" onClick={() => setIsDrawerOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-[160] overflow-y-auto animate-in slide-in-from-right duration-500 border-l border-slate-200 flex flex-col">
              <div className="p-8 border-b border-slate-100 bg-white sticky top-0 z-20">
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-6">
                        <div className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center font-black text-3xl shadow-2xl border-2 ${selectedConstituent.is_leadership ? 'bg-amber-50 text-amber-600 border-amber-200 shadow-amber-100' : 'bg-blue-50 text-blue-600 border-blue-200 shadow-blue-100'}`}>{selectedConstituent.name.charAt(0)}</div>
                        <div>
                          <div className="flex items-center gap-4">
                            <h2 className="text-3xl font-black text-slate-900 leading-tight uppercase tracking-tighter">{selectedConstituent.name}</h2>
                            {selectedConstituent.is_leadership && <span className="px-3 py-1.5 bg-amber-500 text-white text-[9px] font-black uppercase rounded-xl shadow-lg shadow-amber-100">Liderança</span>}
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 font-mono">{maskCPF(selectedConstituent.document)}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsDrawerOpen(false)} className="p-4 hover:bg-slate-100 rounded-[1.5rem] text-slate-400 transition-all"><X size={32} /></button>
                 </div>
                 <div className="flex items-center gap-3">
                    <a href={`https://wa.me/${selectedConstituent.mobile_phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-3 py-4 bg-emerald-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100"><MessageCircle size={18} /> Iniciar Conversa WhatsApp</a>
                    <button onClick={() => handleEdit(selectedConstituent)} className="p-4 bg-slate-100 text-slate-600 rounded-[1.5rem] hover:bg-blue-600 hover:text-white transition-all shadow-lg"><Edit2 size={18} /></button>
                 </div>
                 <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-[1.8rem] border border-slate-200 mt-8 shadow-inner">
                    <button onClick={() => setActiveTab('profile')} className={`flex-1 py-3 rounded-[1.2rem] text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400'}`}>Perfil Estratégico</button>
                    <button onClick={() => setActiveTab('location')} className={`flex-1 py-3 rounded-[1.2rem] text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'location' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400'}`}>Localização</button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 rounded-[1.2rem] text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400'}`}>Solicitações</button>
                 </div>
              </div>
              <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
                {activeTab === 'profile' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-2 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faixa Etária</p>
                        <p className="text-sm font-black text-slate-900 flex items-center gap-2"><Cake size={14} className="text-pink-500" /> {calculateAge(selectedConstituent.birth_date) || '--'} anos</p>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-2 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestão de Carteira</p>
                        <p className="text-xs font-black text-indigo-600 uppercase truncate">{getResponsibleUser(selectedConstituent.responsible_user_id)?.name.split(' ')[0] || 'Gabinete Geral'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-2"><Tag size={14} className="text-blue-500" /> Segmentação e Grupos</p>
                      <div className="flex flex-wrap gap-2.5">
                        {selectedConstituent.tags && selectedConstituent.tags.length > 0 ? selectedConstituent.tags.map(tag => (
                          <span key={tag} className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase rounded-xl shadow-sm">
                            {tag}
                          </span>
                        )) : (
                          <span className="text-xs font-bold text-slate-400 italic bg-slate-50 px-6 py-4 rounded-2xl w-full text-center border-2 border-dashed border-slate-200">Nenhum grupo estratégico vinculado.</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between ml-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><StickyNote size={14} className="text-amber-500" /> Inteligência de Relacionamento</p>
                        {tempNotes !== (selectedConstituent.notes || '') && (
                          <button onClick={handleSaveQuickNotes} disabled={isSavingNotes} className="px-4 py-2 bg-blue-600 text-white text-[9px] font-black uppercase rounded-xl shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2">{isSavingNotes ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Atualizar Notas</button>
                        )}
                      </div>
                      <textarea rows={6} className="w-full bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 text-sm text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white transition-all resize-none italic font-medium leading-relaxed" placeholder="Adicionar informações estratégicas sobre este eleitor..." value={tempNotes} onChange={(e) => setTempNotes(e.target.value)} />
                    </div>
                  </div>
                )}
                {activeTab === 'location' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
                       <MapPin className="absolute top-8 right-8 text-blue-500 opacity-20" size={140} />
                       <div className="relative z-10 space-y-8">
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Base Territorial</p>
                            <h4 className="text-3xl font-black uppercase tracking-tight leading-tight">{selectedConstituent.address.street}, {selectedConstituent.address.number}</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-10 pt-4 border-t border-white/10">
                            <div><p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Bairro / Região</p><p className="text-xl font-black uppercase">{selectedConstituent.address.neighborhood}</p></div>
                            <div><p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">CEP</p><p className="text-xl font-black uppercase font-mono">{maskCEP(selectedConstituent.address.zip_code)}</p></div>
                          </div>
                       </div>
                    </div>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedConstituent.address.street}, ${selectedConstituent.address.number}, ${selectedConstituent.address.neighborhood}, ${selectedConstituent.address.city}`)}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-8 bg-white border border-slate-200 rounded-[2.5rem] hover:border-blue-500 transition-all shadow-xl group">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-all"><Navigation size={28} /></div>
                        <div><p className="text-sm font-black text-slate-900 uppercase">Ver no Mapa</p><p className="text-[10px] font-black text-slate-400 uppercase mt-1">Planejar logística de visita</p></div>
                      </div>
                      <ExternalLink size={24} className="text-slate-200 group-hover:text-blue-500 transition-all" />
                    </a>
                  </div>
                )}
                {activeTab === 'history' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between ml-2"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList size={14} className="text-indigo-500" /> Trâmites Ativos</p><span className="bg-slate-900 text-white px-4 py-1.5 rounded-xl text-[10px] font-black shadow-lg shadow-slate-200">{constituentDemands.length} PROTOCOLOS</span></div>
                    <div className="space-y-5">
                      {constituentDemands.map(demand => (
                        <div key={demand.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:shadow-2xl transition-all border-l-4 border-l-blue-600 group">
                          <div className="flex items-center justify-between mb-4"><span className="text-[10px] font-black text-slate-400 font-mono">PROT: #{demand.protocol}</span><DemandStatusBadge status={demand.status} /></div>
                          <h5 className="text-base font-black text-slate-900 mb-2 uppercase group-hover:text-blue-600 transition-colors">{demand.title}</h5>
                          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-50"><Calendar size={14} className="text-slate-400" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Abertura em {new Date(demand.created_at).toLocaleDateString('pt-BR')}</span></div>
                        </div>
                      ))}
                      {constituentDemands.length === 0 && (
                        <div className="p-16 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem]">
                           <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Nenhuma demanda protocolada para este perfil.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                 <button onClick={() => handleDelete(selectedConstituent.id)} className="flex items-center gap-2 px-8 py-4 bg-white text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-rose-100 hover:bg-rose-50 transition-all shadow-sm"><Trash2 size={18} /> Solicitar Exclusão</button>
                 <button onClick={() => setIsDrawerOpen(false)} className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-2xl">Fechar Ficha</button>
              </div>
          </div>
        </>
      )}

      {/* Modal Smart Import */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] p-12 shadow-2xl space-y-10 overflow-y-auto max-h-[95vh] border border-white/20">
             <div className="flex items-center justify-between border-b border-slate-100 pb-10">
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-200"><FileSpreadsheet size={40} /></div>
                  <div><h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Smart Import v2</h3><p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Higienização e Sincronização Inteligente</p></div>
                </div>
                <button onClick={() => setIsImportModalOpen(false)} className="p-4 hover:bg-slate-100 rounded-2xl transition-all"><X size={36} /></button>
             </div>
             {importStep === 0 ? (
                <div className="space-y-10 animate-in slide-in-from-bottom-4">
                    <div onClick={() => fileInputRef.current?.click()} className="group cursor-pointer bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3rem] p-24 flex flex-col items-center justify-center gap-8 hover:bg-blue-50/50 hover:border-blue-300 transition-all">
                      <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center text-slate-300 group-hover:text-blue-500 group-hover:scale-110 transition-all"><Upload size={48} /></div>
                      <div className="text-center"><p className="text-xl font-black text-slate-900 mb-2 uppercase">Selecionar Arquivo .CSV</p><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Arraste aqui ou clique para navegar</p></div>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                    </div>
                </div>
             ) : importStep === 1 ? (
                <div className="space-y-10 animate-in slide-in-from-bottom-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {[
                      { key: 'name', label: 'Nome Completo*', icon: UserIcon },
                      { key: 'document', label: 'CPF / Documento', icon: Fingerprint },
                      { key: 'mobile_phone', label: 'WhatsApp / Telefone*', icon: MessageCircle },
                      { key: 'zip_code', label: 'CEP', icon: MapPin },
                      { key: 'street', label: 'Rua / Logradouro', icon: Navigation },
                      { key: 'number', label: 'Número', icon: Hash },
                      { key: 'neighborhood', label: 'Bairro', icon: Building2 },
                      { key: 'city', label: 'Cidade', icon: MapIcon },
                      { key: 'state', label: 'Estado (UF)', icon: MapIcon },
                      { key: 'tags', label: 'Segmentos (Tags)', icon: Sparkles },
                    ].map(field => (
                      <div key={field.key} className="flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-all"><field.icon size={20} /></div>
                           <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{field.label}</span>
                        </div>
                        <select className={`w-56 bg-slate-50 border px-4 py-3 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer transition-all ${columnMapping[field.key] ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-lg shadow-emerald-100' : 'border-slate-200'}`} value={columnMapping[field.key] || ''} onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.key]: e.target.value }))}><option value="">-- Ignorar --</option>{csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}</select>
                      </div>
                    ))}
                  </div>
                  <div className="pt-10 border-t border-slate-100 flex gap-6">
                     <button onClick={() => setImportProgressStep(0)} className="px-12 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Voltar</button>
                     <button onClick={processImport} disabled={!columnMapping['name'] || !columnMapping['mobile_phone']} className="flex-1 py-5 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-2xl shadow-blue-200 flex items-center justify-center gap-4 disabled:opacity-50 active:scale-95 transition-all"><CheckCircle size={22} /> Iniciar Processamento Estratégico</button>
                  </div>
                </div>
             ) : (
                <div className="py-24 flex flex-col items-center text-center space-y-16 animate-in fade-in">
                    <div className="relative"><div className="w-64 h-64 border-[16px] border-slate-50 border-t-blue-600 rounded-full animate-spin"></div><div className="absolute inset-0 flex items-center justify-center"><p className="text-5xl font-black text-slate-900">{Math.round((importProgress.current / importProgress.total) * 100)}<span className="text-2xl text-blue-600">%</span></p></div></div>
                    <div className="space-y-3"><p className="text-2xl font-black text-slate-900 uppercase tracking-tight animate-pulse">{importProgress.status}</p><p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">Por favor, não feche esta janela.</p></div>
                </div>
             )}
          </div>
        </div>
      )}

      {/* Modais de Gerenciamento de Eleitor */}
      <ConstituentCreateModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchData} 
        initialData={editingConstituent} 
      />

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl p-12 border border-slate-100 space-y-8">
            <div className="flex items-center gap-6 text-rose-600">
              <div className="w-16 h-16 rounded-[1.5rem] bg-rose-50 flex items-center justify-center shadow-inner"><ShieldAlert size={36} /></div>
              <div><h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Solicitar Exclusão</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">O registro irá para quarentena de auditoria.</p></div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Justificativa (Obrigatório)</label>
              <textarea rows={4} className="w-full px-8 py-6 bg-slate-50 border border-slate-200 rounded-[2rem] text-sm font-bold outline-none focus:ring-4 focus:ring-rose-500/5 transition-all resize-none italic" placeholder="Informe o motivo da exclusão deste perfil..." value={deletionReason} onChange={(e) => setDeletionReason(e.target.value)} />
            </div>

            <div className="flex gap-4 pt-6">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={confirmDeletion} disabled={!deletionReason.trim() || loading} className="flex-1 py-5 bg-rose-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-xl hover:bg-rose-700 transition-all disabled:opacity-50">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConstituentList;
