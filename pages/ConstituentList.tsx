
import React, { useEffect, useState, useMemo, useRef } from 'react';
import MiniSearch from 'minisearch';
import Papa from 'papaparse';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  useReactTable, 
  getCoreRowModel, 
  flexRender, 
  createColumnHelper 
} from '@tanstack/react-table';
import { 
  Search, Plus, Filter, MessageCircle, MapPin, ChevronRight,
  Loader2, X, Phone, User as UserIcon, Fingerprint, Star, 
  Save, Trash2, Edit2, Info, Tag, Upload,
  Users2, Building2, UserCheck, Sparkles, FileSpreadsheet, StickyNote, Mail, UserPlus,
  Cake, ExternalLink, History, ShieldCheck, ClipboardList, Calendar, Map as MapIcon,
  Navigation, AlertTriangle, Check, ShieldAlert, Database, HelpCircle, CheckCircle
} from 'lucide-react';

import { ConstituentService, DemandService } from '../services/api';
import { GeoService } from '../services/geo';
import { AIService } from '../services/ai';
import { logger } from '../services/LoggerService';
import { mockUsers, legacyKnownTags } from '../services/mockData';
import { Constituent, Address, User, LeadershipType, Demand } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { constituentSchema, ConstituentFormData } from '../services/ValidationSchemas';
import DemandStatusBadge from '../components/DemandStatusBadge';

// --- Helpers de Formatação e Máscaras ---
const maskCPF = (v: string) => {
  if (!v) return '';
  v = v.replace(/\D/g, '');
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d)/, '$1.$2');
    v = v.replace(/(\d{3})(\d{1,2})/, '$1-$2');
  }
  return v.substring(0, 14);
};

const maskPhone = (v: string) => {
  if (!v) return '';
  v = v.replace(/\D/g, '');
  if (v.startsWith('55') && v.length > 10) v = v.substring(2);
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
  v = v.replace(/(\d{5})(\d)/, '$1-$2');
  return v.substring(0, 15);
};

const maskCEP = (v: string) => {
  if (!v) return '';
  v = v.replace(/\D/g, '');
  return v.replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
};

const maskVoterTitle = (v: string) => {
  if (!v) return '';
  v = v.replace(/\D/g, '');
  return v.substring(0, 12);
};

const maskSUS = (v: string) => {
  if (!v) return '';
  v = v.replace(/\D/g, '');
  return v.substring(0, 15);
};

const cleanNumbers = (v: string) => (v || '').replace(/\D/g, '');

const toTitleCase = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
};

const calculateAge = (birthDate?: string) => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const cleanStreetForSearch = (street: string) => {
  if (!street) return '';
  return street
    .split(',')[0]
    .split('-')[0]
    .replace(/\d+$/, '')
    .replace(/\b(R|Rua|Av|Avenida|Trav|Travessa|Al|Alameda)\b\.?\s+/gi, '')
    .trim();
};

// Moved Hash helper up to ensure it's in scope for useMemo
const Hash = ({ size, className }: { size: number, className?: string }) => <span className={className} style={{ fontSize: size }}>#</span>;

const columnHelper = createColumnHelper<Constituent>();

const ConstituentList: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  
  const numberInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLeadership, setFilterLeadership] = useState<string>('all');
  const [filterNeighborhood, setFilterNeighborhood] = useState<string>('all');
  const [filterOwnership, setFilterOwnership] = useState<string>('all');
  
  const [selectedConstituent, setSelectedConstituent] = useState<Constituent | null>(null);
  const [constituentDemands, setConstituentDemands] = useState<Demand[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'location' | 'history' | 'audit'>('profile');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Estados para Auditoria de Exclusão
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState('');

  // Estados de observação rápida na Ficha
  const [tempNotes, setTempNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Estados do Smart Import
  const [importStep, setImportStep] = useState<0 | 1 | 2>(0); 
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [defaultCity, setDefaultCity] = useState('');
  const [defaultState, setDefaultState] = useState('MG');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, status: '' });

  // FILTRO: Apenas usuários ativos para novos cadastros
  const activeUsers = useMemo(() => mockUsers.filter(u => u.status === 'ACTIVE'), []);

  // --- React Hook Form Setup ---
  const { 
    register, 
    handleSubmit, 
    reset, 
    control, 
    setValue, 
    watch,
    formState: { errors } 
  } = useForm<ConstituentFormData>({
    resolver: zodResolver(constituentSchema),
    defaultValues: {
      name: '', document: '', mobile_phone: '', email: '', gender: 'M', birth_date: '',
      voter_title: '', sus_card: '', responsible_user_id: '',
      is_leadership: false, leadership_type: 'NONE', notes: '',
      address: { zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
    }
  });

  const isLeadershipWatcher = watch('is_leadership');

  const miniSearch = useMemo(() => {
    return new MiniSearch({
      fields: ['name', 'document', 'neighborhood', 'mobile_phone'],
      storeFields: ['id'],
      searchOptions: { fuzzy: 0.2, prefix: true }
    });
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await ConstituentService.getAll();
      setConstituents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
    let result = constituents;

    if (searchTerm.trim().length > 1) {
      const searchResults = miniSearch.search(searchTerm);
      const resultIds = new Set(searchResults.map(r => r.id));
      result = result.filter(c => resultIds.has(c.id));
    }

    if (filterLeadership === 'yes') result = result.filter(c => c.is_leadership);
    if (filterLeadership === 'no') result = result.filter(c => !c.is_leadership);
    if (filterOwnership === 'mine') result = result.filter(c => c.responsible_user_id === currentUser?.id);
    
    if (filterNeighborhood !== 'all') {
      result = result.filter(c => c.address.neighborhood === filterNeighborhood);
    }

    return result;
  }, [searchTerm, constituents, miniSearch, filterLeadership, filterNeighborhood, filterOwnership, currentUser]);

  const getResponsibleUser = (id: string) => mockUsers.find(u => u.id === id);

  // --- TanStack Table Setup ---
  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Nome Completo',
      cell: info => (
        <div>
          <p className="text-sm font-black text-slate-900 leading-tight">{info.getValue()}</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{maskCPF(info.row.original.document)}</p>
        </div>
      )
    }),
    columnHelper.accessor('mobile_phone', {
      header: 'Telefone',
      cell: info => <span className="text-sm font-black text-slate-700">{maskPhone(info.getValue())}</span>
    }),
    columnHelper.accessor('address.street', {
      header: 'Endereço',
      cell: info => <span className="text-xs font-bold text-slate-600 uppercase">{info.getValue()}, {info.row.original.address.number}</span>
    }),
    columnHelper.accessor('address.neighborhood', {
      header: 'Bairro',
      cell: info => <span className="text-xs font-black text-slate-600 uppercase bg-slate-100 px-3 py-1 rounded-lg">{info.getValue()}</span>
    }),
    columnHelper.accessor('id', {
      id: 'groups',
      header: 'Grupos',
      cell: info => (
        <div className="flex flex-wrap gap-1 max-w-[150px]">
          {info.row.original.is_leadership && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[9px] font-black uppercase rounded-md border border-amber-100">Liderança</span>}
          {info.row.original.tags.map(t => (
            <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded-md border border-blue-100">{t}</span>
          ))}
        </div>
      )
    }),
    columnHelper.accessor('responsible_user_id', {
      header: 'Responsável',
      cell: info => {
        const owner = getResponsibleUser(info.getValue());
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 border border-white shadow-sm flex items-center justify-center overflow-hidden">
              {owner?.avatar_url ? <img src={owner.avatar_url} className="w-full h-full object-cover" /> : <UserIcon size={12} className="text-slate-400" />}
            </div>
            {/* Corrected unclosed template literal and color logic */}
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${owner ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
              {owner ? owner.name.split(' ')[0] : 'Gabinete'}
            </span>
          </div>
        );
      }
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Ações',
      cell: info => (
        <div className="flex items-center justify-end gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
          <button onClick={() => handleOpenDetails(info.row.original)} className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl" title="Ficha Completa"><Info size={20} /></button>
          <button onClick={() => handleEdit(info.row.original)} className="p-2.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl" title="Editar"><Edit2 size={20} /></button>
          <a href={`https://wa.me/${info.row.original.mobile_phone}`} target="_blank" rel="noreferrer" className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl"><MessageCircle size={20} /></a>
          <button onClick={() => handleDelete(info.row.original.id)} className="p-2.5 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-xl" title="Excluir"><Trash2 size={20} /></button>
        </div>
      )
    })
  ], []);

  const table = useReactTable({
    data: filteredConstituents,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const neighborhoodOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    constituents.forEach(c => {
      const n = c.address.neighborhood;
      counts[n] = (counts[n] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
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
      const updated = await ConstituentService.update(selectedConstituent.id, {
        notes: tempNotes,
        updated_by: currentUser.id
      });
      setSelectedConstituent(updated);
      setConstituents(prev => prev.map(c => c.id === updated.id ? updated : c));
      showToast("Observações atualizadas.");
      logger.log('UPDATE', 'CONSTITUENT', selectedConstituent.id, currentUser, [{ field: 'notes', new_value: tempNotes }]);
    } catch (e) {
      showToast("Erro ao salvar observações.", "error");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleEdit = (c: Constituent) => {
    setIsEditing(true);
    reset({
      ...c,
      document: maskCPF(c.document),
      mobile_phone: maskPhone(c.mobile_phone),
      address: {
        ...c.address,
        zip_code: maskCEP(c.address.zip_code)
      }
    });
    setIsModalOpen(true);
  };

  const onFormSubmit = async (data: ConstituentFormData) => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      const payload = {
        ...data,
        name: toTitleCase(data.name.trim()),
        document: cleanNumbers(data.document),
        mobile_phone: cleanNumbers(data.mobile_phone),
        address: {
          ...data.address,
          zip_code: cleanNumbers(data.address.zip_code),
          street: data.address.street.toUpperCase(),
          neighborhood: data.address.neighborhood.toUpperCase(),
          city: data.address.city.toUpperCase(),
          state: data.address.state.toUpperCase(),
          complement: data.address.complement?.toUpperCase() || '',
        },
        updated_by: currentUser.id,
        tags: isEditing ? selectedConstituent?.tags || [] : [],
      };

      if (isEditing && selectedConstituent) {
        const updated = await ConstituentService.update(selectedConstituent.id, payload as any);
        setConstituents(prev => prev.map(c => c.id === updated.id ? updated : c));
        showToast("Registro atualizado com sucesso.");
        logger.log('UPDATE', 'CONSTITUENT', updated.id, currentUser);
      } else {
        const newConst = await ConstituentService.create({
          ...payload,
          responsible_user_id: data.responsible_user_id || '',
          created_by: currentUser.id,
          tags: []
        } as any);
        setConstituents(prev => [newConst, ...prev]);
        showToast(data.responsible_user_id ? "Novo eleitor salvo na carteira." : "Novo eleitor salvo no Gabinete.");
        logger.log('CREATE', 'CONSTITUENT', newConst.id, currentUser);
      }
      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cepValue = cleanNumbers(e.target.value);
    if (cepValue.length === 8) {
      setCepLoading(true);
      const data = await GeoService.getAddressByCep(cepValue);
      if (data) {
        setValue('address.street', data.logradouro.toUpperCase());
        setValue('address.neighborhood', data.bairro.toUpperCase());
        setValue('address.city', data.localidade.toUpperCase());
        setValue('address.state', data.uf.toUpperCase());
        showToast("Endereço sincronizado!");
        setTimeout(() => numberInputRef.current?.focus(), 100);
      }
      setCepLoading(false);
    }
  };

  const resetForm = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    reset();
  };

  /**
   * Quarentena: Solicitar motivo de exclusão
   */
  const handleDelete = (id: string) => {
    setDeleteId(id);
    setDeletionReason('');
    setIsDeleteModalOpen(true);
  };

  const confirmDeletion = async () => {
    if (!currentUser || !deleteId || !deletionReason.trim()) return;

    try {
      setLoading(true);
      await ConstituentService.delete(deleteId, currentUser.id, deletionReason);
      
      // Sincronizar estado local (remove da vista ativa)
      setConstituents(prev => prev.filter(c => c.id !== deleteId));
      
      if (selectedConstituent?.id === deleteId) {
        setIsDrawerOpen(false);
        setSelectedConstituent(null);
      }

      showToast("Registro enviado para Quarentena de Auditoria.");
      
      // Auditoria com motivo
      logger.log('DELETE_REQUESTED', 'CONSTITUENT', deleteId, currentUser, undefined, { reason: deletionReason });
      
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
          
          // Tentar mapeamento automático básico por semelhança de nomes
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
            { key: 'tags', labels: ['tags', 'observações', 'legado', 'notas', 'perfil', 'grupos'] },
          ];

          const headers = Object.keys(results.data[0]);
          fields.forEach(f => {
            const match = headers.find(h => f.labels.some(label => h.toLowerCase().includes(label)));
            if (match) autoMap[f.key] = match;
          });

          setColumnMapping(autoMap);
          setImportStep(1);
        } else {
          showToast("O arquivo parece estar vazio.", "error");
        }
      }
    });
  };

  const processImport = async () => {
    if (!currentUser || csvData.length === 0) return;
    setIsImporting(true);
    setImportStep(2);
    setImportProgress({ current: 0, total: csvData.length, status: 'Iniciando processamento estratégico...' });
    const batch: Partial<Constituent>[] = [];
    const allUserNames = mockUsers.map(u => u.name); 
    
    try {
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const rowName = row[columnMapping['name']] || `Registro #${i+1}`;
        setImportProgress(prev => ({ ...prev, current: i + 1, status: `Importando: ${rowName.substring(0, 20)}...` }));
        
        try {
          let foundCep = cleanNumbers(row[columnMapping['zip_code']] || '');
          const street = (row[columnMapping['street']] || '').toUpperCase();
          const city = (row[columnMapping['city']] || defaultCity || '').toUpperCase();
          const state = (row[columnMapping['state']] || defaultState || '').toUpperCase();
          
          if (!foundCep && street.length >= 3 && city && state) {
            const cleanStr = cleanStreetForSearch(street);
            const res = await GeoService.getCepByAddress(state, city, cleanStr);
            if (res && res.length > 0) foundCep = cleanNumbers(res[0].cep);
          }
          
          let finalTags: string[] = ['Smart Import'];
          let responsibleId = '';
          const rawTags = row[columnMapping['tags']] || '';
          
          if (rawTags) {
            const parsed = await AIService.parseLegacyTags(rawTags, legacyKnownTags, allUserNames);
            if (parsed.tags) finalTags = [...finalTags, ...parsed.tags];
            if (parsed.responsible_name) {
              const matched = mockUsers.find(u => u.name.toUpperCase().includes(parsed.responsible_name!.toUpperCase()));
              if (matched) responsibleId = matched.id;
            }
          }
          
          batch.push({
            name: toTitleCase(rowName),
            document: cleanNumbers(row[columnMapping['document']] || ''),
            mobile_phone: cleanNumbers(row[columnMapping['mobile_phone']] || ''),
            address: { 
              zip_code: foundCep, 
              street, 
              number: row[columnMapping['number']] || '', 
              complement: '', 
              neighborhood: (row[columnMapping['neighborhood']] || '').toUpperCase(), 
              city, 
              state 
            },
            responsible_user_id: responsibleId,
            tags: finalTags,
            is_leadership: false,
            created_by: currentUser.id,
          } as any);
        } catch (e) {
          console.error("Erro na linha " + i, e);
        }
        
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 30));
      }
      
      await ConstituentService.batchCreate(batch);
      await fetchData();
      showToast(`${batch.length} registros importados e geolocalizados com sucesso!`);
      setIsImportModalOpen(false);
      setImportStep(0);
      logger.log('EXPORT', 'SYSTEM', 'batch', currentUser, undefined, { count: batch.length });
    } catch (e) {
      showToast("Erro durante a importação em lote.", "error");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Eleitores</h1>
          <p className="text-slate-500 text-sm font-medium">Gestão estratégica de carteiras e inteligência territorial.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => { setImportStep(0); setIsImportModalOpen(true); }} className="inline-flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm">
            <Upload size={16} /> Smart Import
          </button>
          <button onClick={() => { setIsEditing(false); setIsModalOpen(true); }} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all">
            <Plus size={18} /> Novo Eleitor
          </button>
        </div>
      </header>

      {/* Mini Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner"><Users2 size={24} /></div>
          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total na Base</p><p className="text-2xl font-black text-slate-900">{constituents.length}</p></div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner"><UserCheck size={24} /></div>
          <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sua Carteira</p><p className="text-2xl font-black text-slate-900">{constituents.filter(c => c.responsible_user_id === currentUser?.id).length}</p></div>
        </div>
        <div className="md:col-span-2 bg-slate-900 p-2 rounded-[1.8rem] flex gap-1 shadow-2xl">
          <button onClick={() => setFilterOwnership('all')} className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterOwnership === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Base Geral</button>
          <button onClick={() => setFilterOwnership('mine')} className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filterOwnership === 'mine' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Minha Carteira</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input type="text" placeholder="Busca Inteligente (Nome, CPF, Bairro ou Telefone)..." className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] text-sm font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-400 shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-2.5 rounded-2xl min-w-[200px]">
            <Building2 size={16} className="text-slate-400" /><select className="bg-transparent text-xs font-black text-slate-600 outline-none w-full uppercase cursor-pointer" value={filterNeighborhood} onChange={(e) => setFilterNeighborhood(e.target.value)}><option value="all">TODOS OS BAIRROS</option>{neighborhoodOptions.map(([n, count]) => (<option key={n} value={n}>{n} ({count})</option>))}</select>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-5 py-2.5 rounded-2xl">
            <Star size={16} className="text-slate-400" /><select className="bg-transparent text-xs font-black text-slate-600 outline-none uppercase cursor-pointer" value={filterLeadership} onChange={(e) => setFilterLeadership(e.target.value)}><option value="all">PERFIL: TODOS</option><option value="yes">LIDERANÇAS</option><option value="no">BASE (COMUM)</option></select>
          </div>
        </div>
      </div>

      {/* Tabela com TanStack Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-8 py-6">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="p-20 text-center"><Loader2 className="animate-spin inline-block text-blue-600" size={32} /></td></tr>
              ) : table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-all group">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-8 py-6">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )) : (
                <tr><td colSpan={7} className="p-24 text-center text-slate-400 font-medium italic text-lg">Nenhum eleitor encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão (Audit) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 space-y-6">
            <div className="flex items-center gap-4 text-amber-600 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shadow-inner">
                <ShieldAlert size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase">Solicitar Exclusão</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">O registro irá para quarentena de auditoria.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Justificativa da Exclusão (Obrigatório)</label>
              <textarea 
                rows={4} 
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-amber-500/10 transition-all resize-none"
                placeholder="Ex: Registro duplicado, solicitação do cidadão..."
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeletion}
                disabled={!deletionReason.trim()}
                className="flex-1 py-4 bg-rose-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all disabled:opacity-50 disabled:grayscale"
              >
                Enviar p/ Quarentena
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro/Edição com React Hook Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 flex flex-col max-h-[92vh]">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-100">{isEditing ? <Edit2 size={26} /> : <Plus size={26} />}</div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{isEditing ? 'Atualizar Perfil' : 'Novo Cadastro de Eleitor'}</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ownership: Registro vinculado à carteira selecionada (Somente Ativos).</p>
                </div>
              </div>
              <button onClick={resetForm} className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-400"><X size={32} /></button>
            </div>
            
            <form className="p-10 overflow-y-auto space-y-12 custom-scrollbar" onSubmit={handleSubmit(onFormSubmit)}>
              {/* Seção 1: Identificação e Contato */}
              <div className="space-y-8">
                <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.25em] border-b border-blue-50 pb-3 flex items-center gap-2"><Fingerprint size={16} /> Identificação e Contato</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nome Completo *</label>
                    <input {...register('name')} placeholder="Ex: José da Silva" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all ${errors.name ? 'border-red-500' : 'border-slate-200'}`} />
                    {errors.name && <p className="text-[10px] text-red-500 font-bold ml-2 uppercase tracking-widest">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Telefone / WhatsApp *</label>
                    <input {...register('mobile_phone', { onChange: (e) => setValue('mobile_phone', maskPhone(e.target.value)) })} placeholder="(11) 99999-9999" className={`w-full px-6 py-4 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-emerald-500/10 ${errors.mobile_phone ? 'border-red-500' : ''}`} />
                    {errors.mobile_phone && <p className="text-[10px] text-red-500 font-bold ml-2 uppercase tracking-widest">{errors.mobile_phone.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">CPF *</label>
                    <input {...register('document', { onChange: (e) => setValue('document', maskCPF(e.target.value)) })} placeholder="000.000.000-00" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none ${errors.document ? 'border-red-500' : 'border-slate-200'}`} />
                    {errors.document && <p className="text-[10px] text-red-500 font-bold ml-2 uppercase tracking-widest">{errors.document.message}</p>}
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">E-mail</label>
                    <input {...register('email')} placeholder="exemplo@email.com" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none ${errors.email ? 'border-red-500' : 'border-slate-200'}`} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Título de Eleitor</label>
                    <input {...register('voter_title', { onChange: (e) => setValue('voter_title', maskVoterTitle(e.target.value)) })} placeholder="0000 0000 0000" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Cartão SUS</label>
                    <input {...register('sus_card', { onChange: (e) => setValue('sus_card', maskSUS(e.target.value)) })} placeholder="000 0000 0000 0000" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Data de Nascimento</label>
                    <input {...register('birth_date')} type="date" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Gênero</label>
                    <select {...register('gender')} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none cursor-pointer">
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Responsável (Somente Ativos)</label>
                    <select {...register('responsible_user_id')} className="w-full px-6 py-4 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl text-sm font-black outline-none cursor-pointer">
                      <option value="">Gabinete (Geral)</option>
                      {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção 2: Endereço */}
              <div className="space-y-8">
                <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.25em] border-b border-blue-50 pb-3 flex items-center gap-2"><MapPin size={16} /> Localização Territorial</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">CEP</label>
                    <div className="relative">
                       <input {...register('address.zip_code', { onBlur: handleCepBlur, onChange: (e) => setValue('address.zip_code', maskCEP(e.target.value)) })} placeholder="00000-000" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 ${errors.address?.zip_code ? 'border-red-500' : 'border-slate-200'}`} />
                       {cepLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-blue-500" size={18} />}
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Logradouro / Rua</label>
                    <input {...register('address.street')} placeholder="RUA, AVENIDA, ETC" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none uppercase ${errors.address?.street ? 'border-red-500' : 'border-slate-200'}`} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Número</label>
                    <input 
                      {...register('address.number')} 
                      ref={(e) => {
                        register('address.number').ref(e);
                        numberInputRef.current = e;
                      }}
                      placeholder="123" 
                      className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none ${errors.address?.number ? 'border-red-500' : 'border-slate-200'}`} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Complemento</label>
                    <input {...register('address.complement')} placeholder="APTO, BLOCO..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none uppercase" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Bairro</label>
                    <input {...register('address.neighborhood')} placeholder="BAIRRO" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none uppercase ${errors.address?.neighborhood ? 'border-red-500' : 'border-slate-200'}`} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Cidade</label>
                    <input {...register('address.city')} placeholder="CIDADE" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none uppercase ${errors.address?.city ? 'border-red-500' : 'border-slate-200'}`} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Estado</label>
                    <input {...register('address.state')} placeholder="UF" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none uppercase ${errors.address?.state ? 'border-red-500' : 'border-slate-200'}`} />
                  </div>
                </div>
              </div>

              {/* Seção 3: Perfil e Liderança */}
              <div className="space-y-8">
                <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.25em] border-b border-blue-50 pb-3 flex items-center gap-2"><Star size={16} /> Perfil e Liderança</h4>
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-3">
                    <Controller
                      name="is_leadership"
                      control={control}
                      render={({ field }) => (
                        <button 
                          type="button"
                          onClick={() => field.onChange(!field.value)}
                          className={`w-14 h-8 rounded-full transition-all relative ${field.value ? 'bg-blue-600' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${field.value ? 'left-7' : 'left-1'}`} />
                        </button>
                      )}
                    />
                    <span className="text-xs font-black uppercase text-slate-700 tracking-tight">Eleitor é Liderança Comunitária?</span>
                  </div>

                  {isLeadershipWatcher && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Tipo de Liderança</label>
                      <select {...register('leadership_type')} className="w-full px-6 py-4 bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl text-sm font-bold outline-none cursor-pointer">
                        <option value="COMMUNITY">Comunitária</option>
                        <option value="RELIGIOUS">Religiosa</option>
                        <option value="SPORTS">Esportiva</option>
                        <option value="UNION">Sindical</option>
                        <option value="OTHER">Outra</option>
                        <option value="NONE">Nenhuma</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Observações Estratégicas</label>
                  <textarea {...register('notes')} rows={4} placeholder="Notas sobre o eleitor, histórico de apoio..." className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none" />
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100 flex gap-4 sticky bottom-0 bg-white/95 backdrop-blur-md pb-4">
                <button type="button" onClick={resetForm} className="px-10 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 uppercase text-xs tracking-widest transition-all">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-200 flex items-center justify-center gap-4 uppercase text-xs tracking-widest transition-all">
                  {isSaving ? <Loader2 size={22} className="animate-spin" /> : <Save size={22} />}
                  {isEditing ? 'Confirmar Alterações' : 'Finalizar Cadastro de Eleitor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Side Drawer Detalhes (Ficha Completa) */}
      {isDrawerOpen && selectedConstituent && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsDrawerOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-slate-200 flex flex-col">
              {/* Header */}
              <div className="p-8 border-b border-slate-100 bg-white sticky top-0 z-20">
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-6">
                        <div className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center font-black text-3xl shadow-inner border-2 ${selectedConstituent.is_leadership ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-50 text-blue-600 border-blue-200'}`}>{selectedConstituent.name.charAt(0)}</div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black text-slate-900 leading-tight">{selectedConstituent.name}</h2>
                            {selectedConstituent.is_leadership && <span className="px-2.5 py-1 bg-amber-500 text-white text-[8px] font-black uppercase rounded-lg shadow-lg shadow-amber-200">Liderança</span>}
                          </div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">{maskCPF(selectedConstituent.document)}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsDrawerOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors"><X size={32} /></button>
                 </div>

                 <div className="flex items-center gap-3">
                    <a href={`https://wa.me/${selectedConstituent.mobile_phone}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100">
                      <MessageCircle size={18} /> WhatsApp
                    </a>
                    <a href={`tel:${selectedConstituent.mobile_phone}`} className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all">
                      <Phone size={18} />
                    </a>
                    <a href={`mailto:${selectedConstituent.email}`} className="p-3.5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all">
                      <Mail size={18} />
                    </a>
                    <div className="w-px h-10 bg-slate-100 mx-2" />
                    <button onClick={() => handleEdit(selectedConstituent)} className="p-3.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all">
                      <Edit2 size={18} />
                    </button>
                 </div>

                 <div className="flex gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 mt-8 shadow-inner">
                    <button onClick={() => setActiveTab('profile')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'profile' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>Perfil</button>
                    <button onClick={() => setActiveTab('location')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'location' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>Territorial</button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>Histórico</button>
                    <button onClick={() => setActiveTab('audit')} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>Auditoria</button>
                 </div>
              </div>

              <div className="flex-1 p-10 overflow-y-auto custom-scrollbar">
                {activeTab === 'profile' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Idade</p>
                        <p className="text-sm font-black text-slate-900 flex items-center gap-2"><Cake size={14} className="text-pink-500" /> {calculateAge(selectedConstituent.birth_date) || '--'} anos</p>
                      </div>
                      <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SUS</p>
                        <p className="text-sm font-black text-slate-900">{maskSUS(selectedConstituent.sus_card || '') || '--'}</p>
                      </div>
                      <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Título</p>
                        <p className="text-sm font-black text-slate-900">{maskVoterTitle(selectedConstituent.voter_title || '') || '--'}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><StickyNote size={14} /> Observações do Gabinete</p>
                        {tempNotes !== (selectedConstituent.notes || '') && (
                          <button onClick={handleSaveQuickNotes} disabled={isSavingNotes} className="px-3 py-1 bg-blue-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-lg shadow-blue-100">
                            {isSavingNotes ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Salvar Alteração
                          </button>
                        )}
                      </div>
                      <textarea rows={6} className="w-full bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-sm text-slate-600 leading-relaxed italic outline-none focus:ring-4 focus:ring-blue-500/5 focus:bg-white transition-all resize-none" placeholder="Anotações estratégicas..." value={tempNotes} onChange={(e) => setTempNotes(e.target.value)} />
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Tag size={14} /> Grupos e Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedConstituent.tags.map(t => <span key={t} className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-2xl text-[10px] font-black uppercase">{t}</span>)}
                        {selectedConstituent.is_leadership && <span className="px-4 py-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl text-[10px] font-black uppercase">Liderança {selectedConstituent.leadership_type}</span>}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'location' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-900 rounded-[3rem] p-8 text-white relative overflow-hidden shadow-2xl">
                       <MapPin className="absolute top-8 right-8 text-blue-500 opacity-20" size={120} />
                       <div className="relative z-10 space-y-6">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Endereço Estratégico</p>
                            <h4 className="text-2xl font-black uppercase">{selectedConstituent.address.street}, {selectedConstituent.address.number}</h4>
                          </div>
                          <div className="grid grid-cols-2 gap-8 pt-4">
                            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bairro / Região</p><p className="text-lg font-black uppercase">{selectedConstituent.address.neighborhood}</p></div>
                            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">CEP Sincronizado</p><p className="text-lg font-black uppercase">{maskCEP(selectedConstituent.address.zip_code)}</p></div>
                          </div>
                       </div>
                    </div>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedConstituent.address.street}, ${selectedConstituent.address.number}, ${selectedConstituent.address.neighborhood}, ${selectedConstituent.address.city}`)}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-6 bg-white border border-slate-200 rounded-3xl hover:border-blue-500 transition-all group shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-all"><Navigation size={24} /></div>
                        <div><p className="text-sm font-black text-slate-900">Visualizar Logística</p><p className="text-[10px] font-bold text-slate-400 uppercase">Google Maps para Planejamento de Visitas</p></div>
                      </div>
                      <ExternalLink size={18} className="text-slate-300 group-hover:text-blue-500" />
                    </a>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList size={14} /> Solicitações e Demandas</p><span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black">{constituentDemands.length} REGISTROS</span></div>
                    <div className="space-y-4">
                      {constituentDemands.map(demand => (
                        <div key={demand.id} className="bg-white border border-slate-200 rounded-[2rem] p-6 hover:shadow-lg transition-all">
                          <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-black text-slate-400">PROT: #{demand.protocol}</span><DemandStatusBadge status={demand.status} /></div>
                          <h5 className="text-sm font-black text-slate-900 mb-2">{demand.title}</h5>
                          <div className="flex items-center gap-2 mt-4"><Calendar size={12} className="text-slate-400" /><span className="text-[10px] font-bold text-slate-500 uppercase">{new Date(demand.created_at).toLocaleDateString()}</span></div>
                        </div>
                      ))}
                      {constituentDemands.length === 0 && <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 italic text-slate-400 text-sm">Nenhuma demanda registrada.</div>}
                    </div>
                  </div>
                )}

                {activeTab === 'audit' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-100 space-y-8">
                       <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-white border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm"><UserCheck size={28} /></div>
                          <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Gestor da Carteira</p><p className="text-lg font-black text-slate-900">{getResponsibleUser(selectedConstituent.responsible_user_id)?.name || 'Gabinete (Geral)'}</p></div>
                       </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Rodapé Drawer - Botão Excluir Ativado (via Quarentena) */}
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                 <button onClick={() => handleDelete(selectedConstituent.id)} className="flex items-center gap-2 px-6 py-3 bg-white text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-100 hover:bg-rose-50 transition-all">
                    <Trash2 size={16} /> Excluir Registro
                 </button>
                 <button onClick={() => setIsDrawerOpen(false)} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl">
                    Fechar Ficha
                 </button>
              </div>
          </div>
        </>
      )}

      {/* Modal Smart Import */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] p-10 shadow-2xl space-y-8 overflow-y-auto max-h-[95vh] border border-white/20">
             <div className="flex items-center justify-between border-b border-slate-100 pb-8">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-200">
                    <FileSpreadsheet size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Smart Import v2</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">IA Integrada para Tags e Geolocalização</p>
                  </div>
                </div>
                <button onClick={() => setIsImportModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-colors"><X size={28} /></button>
             </div>

             {importStep === 0 ? (
                <div className="space-y-10 animate-in slide-in-from-bottom-4">
                    <div 
                      onClick={() => fileInputRef.current?.click()} 
                      className="group cursor-pointer bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3rem] p-16 flex flex-col items-center justify-center gap-6 hover:bg-blue-50/50 hover:border-blue-200 transition-all"
                    >
                      <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-slate-300 group-hover:text-blue-500 transition-all group-hover:scale-110">
                        <Upload size={36} />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-black text-slate-900 mb-1">Selecione o arquivo .CSV</p>
                        <p className="text-sm text-slate-400 font-medium">Arraste aqui ou clique para buscar em seu computador</p>
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start gap-4">
                          <Sparkles className="text-blue-600 shrink-0" size={20} />
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Processamento IA</p>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">O Gemini 2.5 analisa automaticamente observações para extrair tags e responsáveis.</p>
                          </div>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start gap-4">
                          <MapPin className="text-emerald-600 shrink-0" size={20} />
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Geo-Sincronia</p>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">Buscamos automaticamente o CEP baseado no endereço para alimentar o Mapa Territorial.</p>
                          </div>
                       </div>
                       <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start gap-4">
                          <Database className="text-indigo-600 shrink-0" size={20} />
                          <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">SQL-Ready</p>
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">Dados higienizados e normalizados prontos para integração com sistemas legados.</p>
                          </div>
                       </div>
                    </div>
                </div>
             ) : importStep === 1 ? (
                <div className="space-y-10 animate-in slide-in-from-bottom-4">
                  <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-blue-200">
                      <div className="space-y-1">
                        <h4 className="text-xl font-black uppercase tracking-tight">Mapeamento Estratégico</h4>
                        <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest">Relacione as colunas da sua planilha com o sistema.</p>
                      </div>
                      <div className="flex gap-3">
                         <div className="space-y-1">
                           <label className="text-[8px] font-black uppercase ml-1 opacity-70">Cidade Padrão</label>
                           <input placeholder="Ex: SÃO PAULO" value={defaultCity} onChange={(e) => setDefaultCity(e.target.value.toUpperCase())} className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-bold outline-none placeholder:text-white/40 focus:bg-white/20" />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[8px] font-black uppercase ml-1 opacity-70">Estado Padrão</label>
                           <input placeholder="Ex: SP" maxLength={2} value={defaultState} onChange={(e) => setDefaultState(e.target.value.toUpperCase())} className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-xs font-bold w-16 text-center outline-none placeholder:text-white/40 focus:bg-white/20" />
                         </div>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
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
                      { key: 'tags', label: 'Legado / Observações (IA)', icon: Sparkles },
                    ].map(field => {
                      const Icon = field.icon || Database;
                      return (
                        <div key={field.key} className="flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                             <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors"><Icon size={16} /></div>
                             <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{field.label}</span>
                          </div>
                          <select 
                            className={`w-48 bg-slate-50 border px-4 py-2.5 rounded-xl text-[10px] font-black uppercase outline-none transition-all cursor-pointer ${columnMapping[field.key] ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200'}`}
                            value={columnMapping[field.key] || ''}
                            onChange={(e) => setColumnMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                          >
                            <option value="">-- Ignorar --</option>
                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      )
                    })}
                  </div>

                  <div className="pt-8 border-t border-slate-100 flex gap-4">
                     <button onClick={() => setImportStep(0)} className="px-10 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase tracking-widest">Voltar</button>
                     <button 
                        onClick={processImport} 
                        disabled={!columnMapping['name'] || !columnMapping['mobile_phone']}
                        className="flex-1 py-5 bg-blue-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest shadow-2xl shadow-blue-200 flex items-center justify-center gap-3 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:grayscale"
                      >
                        <CheckCircle size={18} /> Iniciar Processamento Estratégico
                      </button>
                  </div>
                </div>
             ) : (
                <div className="py-20 flex flex-col items-center text-center space-y-12 animate-in fade-in zoom-in-95">
                    <div className="relative">
                      <div className="w-48 h-48 border-[12px] border-slate-50 border-t-blue-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-3xl font-black text-slate-900">{Math.round((importProgress.current / importProgress.total) * 100)}%</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-lg font-black text-slate-900 uppercase tracking-tight animate-pulse">{importProgress.status}</p>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em]">
                        Higienizando base: {importProgress.current} de {importProgress.total} registros
                      </p>
                    </div>
                    <div className="w-full max-w-md bg-slate-100 h-2 rounded-full overflow-hidden">
                       <div 
                        className="bg-blue-600 h-full transition-all duration-500 shadow-[0_0_15px_rgba(37,99,235,0.5)]" 
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }} 
                       />
                    </div>
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConstituentList;
