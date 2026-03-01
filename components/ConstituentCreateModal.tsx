
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  X, Plus, Loader2, Save, Fingerprint, Phone, Mail, 
  MapPin, Star, Edit2, UserPlus, StickyNote, Info, User as UserIcon, Tag,
  Search, Calendar
} from 'lucide-react';
import { ConstituentService, UserService } from '../services/api';
import { GeoService } from '../services/geo';
import { constituentSchema, ConstituentFormData } from '../services/ValidationSchemas';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Constituent, User } from '../types';

interface ConstituentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Constituent | null;
}

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

const ConstituentCreateModal: React.FC<ConstituentCreateModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const numberInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [newTag, setNewTag] = useState('');
  const [allExistingTags, setAllExistingTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const isEditing = !!initialData;

  useEffect(() => {
    const loadModalData = async () => {
      try {
        const [users, constituents] = await Promise.all([
          UserService.getAll(),
          ConstituentService.getAll()
        ]);
        setSystemUsers(users.filter(u => u.status === 'ACTIVE'));
        
        // Extrair todas as tags únicas da base para o autocomplete
        const tags = new Set<string>();
        constituents.forEach(c => {
          if (c.tags) c.tags.forEach(t => tags.add(t.toUpperCase()));
        });
        setAllExistingTags(Array.from(tags).sort());
      } catch (error) {
        console.error("Erro ao carregar dados do modal:", error);
      }
    };
    if (isOpen) loadModalData();
  }, [isOpen]);

  const { 
    register, 
    handleSubmit, 
    reset, 
    control, 
    setValue, 
    watch,
    formState: { errors } 
  } = useForm<ConstituentFormData & { tags: string[] }>({
    resolver: zodResolver(constituentSchema) as any,
    values: initialData ? {
      ...initialData,
      document: maskCPF(initialData.document),
      mobile_phone: maskPhone(initialData.mobile_phone),
      birth_date: initialData.birth_date ? initialData.birth_date.split('T')[0] : '',
      address: { ...initialData.address, zip_code: maskCEP(initialData.address.zip_code) },
      notes: initialData.notes || '',
      tags: initialData.tags || []
    } : {
      name: '', document: '', mobile_phone: '', email: '', gender: 'M', birth_date: '',
      voter_title: '', sus_card: '', responsible_user_id: '',
      is_leadership: false, leadership_type: 'NONE', notes: '',
      tags: [],
      address: { zip_code: '', street: '', number: '', neighborhood: '', city: '', state: '' }
    }
  });

  const tagsWatcher = watch('tags') || [];
  const isLeadershipWatcher = watch('is_leadership');

  const tagSuggestions = useMemo(() => {
    if (!newTag.trim()) return [];
    const search = newTag.toUpperCase().trim();
    return allExistingTags.filter(tag => 
      tag.includes(search) && !tagsWatcher.includes(tag)
    ).slice(0, 6);
  }, [newTag, allExistingTags, tagsWatcher]);

  const addTag = (tagName?: string) => {
    const tag = (tagName || newTag).trim().toUpperCase();
    if (tag && !tagsWatcher.includes(tag)) {
      setValue('tags', [...tagsWatcher, tag]);
      setNewTag('');
      setShowTagSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue('tags', tagsWatcher.filter(t => t !== tagToRemove));
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
        setValue('address.uf', data.uf.toUpperCase());
        showToast("Endereço sincronizado!");
        setTimeout(() => numberInputRef.current?.focus(), 100);
      }
      setCepLoading(false);
    }
  };

  const onFormSubmit: SubmitHandler<ConstituentFormData & { tags: string[] }> = async (data) => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      const payload = {
        ...data,
        name: toTitleCase(data.name.trim()),
        document: cleanNumbers(data.document || ''),
        mobile_phone: cleanNumbers(data.mobile_phone),
        tags: tagsWatcher, // Explicitly grab from watcher to avoid Zod stripping
        address: {
          ...data.address,
          zip_code: cleanNumbers(data.address?.zip_code || ''),
          street: data.address?.street?.toUpperCase() || '',
          neighborhood: data.address?.neighborhood?.toUpperCase() || '',
          city: data.address?.city?.toUpperCase() || '',
          state: data.address?.state?.toUpperCase() || '',
          complement: data.address?.complement?.toUpperCase() || '',
        },
      };

      if (isEditing && initialData) {
        await ConstituentService.update(initialData.id, payload as any, currentUser);
        showToast("Perfil atualizado com sucesso.");
      } else {
        await ConstituentService.create({
          ...payload,
          responsible_user_id: data.responsible_user_id || '',
        } as any, currentUser);
        showToast("Novo eleitor salvo com sucesso.");
      }
      reset();
      onSuccess();
      onClose();
    } catch (error) {
      showToast("Erro ao salvar eleitor.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 flex flex-col max-h-[92vh]">
        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-100">
              {isEditing ? <Edit2 size={26} /> : <UserPlus size={26} />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">
                {isEditing ? 'Atualizar Perfil' : 'Novo Cadastro de Eleitor'}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                Gestão de Inteligência Territorial
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all text-slate-400"><X size={32} /></button>
        </div>
        
        <form className="p-10 overflow-y-auto space-y-12 custom-scrollbar" onSubmit={handleSubmit(onFormSubmit)}>
          <div className="space-y-8">
            <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.25em] border-b border-blue-50 pb-3 flex items-center gap-2"><Fingerprint size={16} /> Identificação e Contato</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nome Completo *</label>
                <input {...register('name')} placeholder="Ex: JOSÉ DA SILVA" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all uppercase ${errors.name ? 'border-red-500' : 'border-slate-200'}`} />
                {errors.name && <p className="text-[10px] text-red-500 font-bold ml-2 uppercase tracking-widest">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Telefone / WhatsApp *</label>
                <input {...register('mobile_phone', { onChange: (e) => setValue('mobile_phone', maskPhone(e.target.value)) })} placeholder="(11) 99999-9999" className={`w-full px-6 py-4 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-2xl text-sm font-black outline-none focus:ring-4 focus:ring-emerald-500/10 ${errors.mobile_phone ? 'border-red-500' : ''}`} />
                {errors.mobile_phone && <p className="text-[10px] text-red-500 font-bold ml-2 uppercase tracking-widest">{errors.mobile_phone.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">CPF</label>
                <input {...register('document', { onChange: (e) => setValue('document', maskCPF(e.target.value)) })} placeholder="000.000.000-00" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-black outline-none font-mono ${errors.document ? 'border-red-500' : 'border-slate-200'}`} />
                {errors.document && <p className="text-[10px] text-red-500 font-bold ml-2 uppercase tracking-widest">{errors.document.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest flex items-center gap-2">Data de Nascimento <Calendar size={10} /></label>
                <input type="date" {...register('birth_date')} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none uppercase text-slate-600 cursor-pointer" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Título de Eleitor</label>
                <input {...register('voter_title')} placeholder="0000 0000 0000" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none font-mono" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Cartão SUS</label>
                <input {...register('sus_card')} placeholder="000 0000 0000 0000" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none font-mono" />
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.25em] border-b border-blue-50 pb-3 flex items-center gap-2"><MapPin size={16} /> Localização Territorial</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">CEP</label>
                <div className="relative">
                   <input {...register('address.zip_code', { onBlur: handleCepBlur, onChange: (e) => setValue('address.zip_code', maskCEP(e.target.value)) })} placeholder="00000-000" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-black outline-none border-slate-200 font-mono`} />
                   {cepLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-blue-500" size={18} />}
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Logradouro / Rua</label>
                <input {...register('address.street')} placeholder="RUA, AVENIDA, ETC" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none uppercase border-slate-200`} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Número</label>
                <input {...register('address.number')} ref={(e) => { register('address.number').ref(e); (numberInputRef as any).current = e; }} placeholder="123" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none border-slate-200`} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Bairro</label>
                <input {...register('address.neighborhood')} placeholder="BAIRRO" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none uppercase border-slate-200`} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Cidade</label>
                <input {...register('address.city')} placeholder="CIDADE" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none uppercase border-slate-200`} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Estado</label>
                <input {...register('address.state')} placeholder="UF" className={`w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black outline-none uppercase`} />
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.25em] border-b border-blue-50 pb-3 flex items-center gap-2"><Star size={16} /> Perfil e Inteligência</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-center gap-3 bg-slate-50 p-6 rounded-[1.8rem] border border-slate-100 shadow-sm">
                  <Controller
                    name="is_leadership"
                    control={control}
                    render={({ field }) => (
                      <button type="button" onClick={() => field.onChange(!field.value)} className={`w-14 h-8 rounded-full transition-all relative ${field.value ? 'bg-blue-600' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${field.value ? 'left-7' : 'left-1'}`} />
                      </button>
                    )}
                  />
                  <span className="text-xs font-black uppercase text-slate-700 tracking-tighter">Liderança Comunitária?</span>
                </div>
                {isLeadershipWatcher && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Tipo de Liderança</label>
                    <select {...register('leadership_type')} className="w-full px-6 py-4 bg-amber-50 border border-amber-100 text-amber-900 rounded-2xl text-sm font-black outline-none cursor-pointer">
                      <option value="NONE">SELECIONE O PERFIL...</option>
                      <option value="COMMUNITY">COMUNITÁRIA</option>
                      <option value="RELIGIOUS">RELIGIOSA</option>
                      <option value="SPORTS">ESPORTIVA</option>
                      <option value="UNION">SINDICAL</option>
                      <option value="OTHER">OUTRA</option>
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-2 tracking-widest">Responsável pela Carteira <UserIcon size={10} /></label>
                  <select {...register('responsible_user_id')} className="w-full px-6 py-4 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl text-sm font-black outline-none cursor-pointer uppercase">
                    <option value="">GABINETE (GERAL)</option>
                    {systemUsers.map(u => <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex items-center gap-2 tracking-widest"><StickyNote size={14} /> Observações Estratégicas</label>
                <textarea 
                  {...register('notes')} 
                  rows={6} 
                  placeholder="Informações relevantes sobre o eleitor..." 
                  className="w-full px-8 py-6 bg-slate-50 border border-slate-200 rounded-[2.2rem] text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/5 transition-all resize-none italic leading-relaxed"
                />
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.25em] border-b border-blue-50 pb-3 flex items-center gap-2"><Tag size={16} /> Grupos e Segmentação</h4>
            <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
              <div className="flex flex-wrap gap-2.5">
                {tagsWatcher.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-blue-200 text-blue-700 text-[10px] font-black uppercase rounded-xl shadow-sm animate-in zoom-in-95">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="p-1 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-all"><X size={14} /></button>
                  </span>
                ))}
                {tagsWatcher.length === 0 && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] py-2 ml-2 italic">Nenhum grupo atribuído</p>
                )}
              </div>
              
              <div className="relative">
                <div className="flex gap-3">
                  <div className="relative flex-1 group">
                    <Tag className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-all" size={20} />
                    <input 
                      type="text" 
                      placeholder="ADICIONAR GRUPO (EX: VOLUNTÁRIO, ZONA SUL...)" 
                      className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                      value={newTag}
                      onChange={(e) => {
                        setNewTag(e.target.value);
                        setShowTagSuggestions(true);
                      }}
                      onFocus={() => setShowTagSuggestions(true)}
                      onKeyDown={(e) => { 
                        if (e.key === 'Enter') { 
                          e.preventDefault(); 
                          addTag(); 
                        } 
                      }}
                    />
                  </div>
                  <button type="button" onClick={() => addTag()} className="px-8 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center active:scale-95"><Plus size={24} /></button>
                </div>

                {/* Autocomplete de Tags solicitado */}
                {showTagSuggestions && tagSuggestions.length > 0 && (
                  <div className="absolute z-50 bottom-full mb-3 left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                      <Search size={12} className="text-slate-400" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Grupos Existentes</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {tagSuggestions.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTag(tag)}
                          className="w-full px-6 py-4 text-left hover:bg-blue-50 flex items-center justify-between group transition-all"
                        >
                          <span className="text-[11px] font-black text-slate-700 uppercase group-hover:text-blue-600">{tag}</span>
                          <Plus size={14} className="text-slate-200 group-hover:text-blue-500" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 flex gap-4 sticky bottom-0 bg-white/95 backdrop-blur-md pb-4 z-10">
            <button type="button" onClick={onClose} className="px-12 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 uppercase text-[10px] tracking-widest transition-all">Cancelar</button>
            <button type="submit" disabled={isSaving} className="flex-1 py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-200 flex items-center justify-center gap-4 uppercase text-[10px] tracking-widest transition-all active:scale-[0.98]">
              {isSaving ? <Loader2 size={22} className="animate-spin" /> : <Save size={22} />}
              {isEditing ? 'Confirmar Alterações' : 'Finalizar Cadastro Estratégico'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConstituentCreateModal;
