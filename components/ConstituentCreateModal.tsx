
import React, { useState, useRef, useMemo } from 'react';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  X, Plus, Loader2, Save, Fingerprint, Phone, Mail, 
  MapPin, Star, Edit2, UserPlus 
} from 'lucide-react';
import { ConstituentService } from '../services/api';
import { GeoService } from '../services/geo';
import { constituentSchema, ConstituentFormData } from '../services/ValidationSchemas';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { mockUsers } from '../services/mockData';
import { Constituent } from '../types';

interface ConstituentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Constituent | null;
}

// Helpers de Máscara
const maskCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2').substring(0, 14);
const maskPhone = (v: string) => {
  v = v.replace(/\D/g, '');
  if (v.startsWith('55') && v.length > 10) v = v.substring(2);
  return v.replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
};
const maskCEP = (v: string) => v.replace(/\D/g, '').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 9);
const maskVoterTitle = (v: string) => v.replace(/\D/g, '').substring(0, 12);
const maskSUS = (v: string) => v.replace(/\D/g, '').substring(0, 15);
const cleanNumbers = (v: string) => (v || '').replace(/\D/g, '');
const toTitleCase = (str: string) => str.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());

const ConstituentCreateModal: React.FC<ConstituentCreateModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const numberInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const activeUsers = useMemo(() => mockUsers.filter(u => u.status === 'ACTIVE'), []);
  const isEditing = !!initialData;

  const { 
    register, 
    handleSubmit, 
    reset, 
    control, 
    setValue, 
    watch,
    formState: { errors } 
  } = useForm<ConstituentFormData>({
    resolver: zodResolver(constituentSchema) as any,
    values: initialData ? {
      ...initialData,
      document: maskCPF(initialData.document),
      mobile_phone: maskPhone(initialData.mobile_phone),
      address: { ...initialData.address, zip_code: maskCEP(initialData.address.zip_code) }
    } : {
      name: '', document: '', mobile_phone: '', email: '', gender: 'M', birth_date: '',
      voter_title: '', sus_card: '', responsible_user_id: '',
      is_leadership: false, leadership_type: 'NONE', notes: '',
      address: { zip_code: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
    }
  });

  const isLeadershipWatcher = watch('is_leadership');

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

  const onFormSubmit: SubmitHandler<ConstituentFormData> = async (data) => {
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
      };

      if (isEditing && initialData) {
        await ConstituentService.update(initialData.id, payload as any, currentUser);
        showToast("Perfil atualizado com sucesso.");
      } else {
        await ConstituentService.create({
          ...payload,
          responsible_user_id: data.responsible_user_id || '',
          tags: [],
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
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                {isEditing ? 'Atualizar Perfil' : 'Novo Cadastro de Eleitor'}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Gestão de Inteligência Territorial
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-400"><X size={32} /></button>
        </div>
        
        <form className="p-10 overflow-y-auto space-y-12 custom-scrollbar" onSubmit={handleSubmit(onFormSubmit)}>
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
          </div>

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
                <input {...register('address.number')} ref={(e) => { register('address.number').ref(e); (numberInputRef as any).current = e; }} placeholder="123" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none ${errors.address?.number ? 'border-red-500' : 'border-slate-200'}`} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Bairro</label>
                <input {...register('address.neighborhood')} placeholder="BAIRRO" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none uppercase ${errors.address?.neighborhood ? 'border-red-500' : 'border-slate-200'}`} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Cidade</label>
                <input {...register('address.city')} placeholder="CIDADE" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none uppercase ${errors.address?.city ? 'border-red-500' : 'border-slate-200'}`} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Estado</label>
                <input {...register('address.state')} placeholder="UF" className={`w-full px-6 py-4 bg-slate-50 border rounded-2xl text-sm font-bold outline-none uppercase ${errors.address?.state ? 'border-red-500' : 'border-slate-200'}`} />
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.25em] border-b border-blue-50 pb-3 flex items-center gap-2"><Star size={16} /> Perfil e Liderança</h4>
            <div className="flex items-center gap-3">
              <Controller
                name="is_leadership"
                control={control}
                render={({ field }) => (
                  <button type="button" onClick={() => field.onChange(!field.value)} className={`w-14 h-8 rounded-full transition-all relative ${field.value ? 'bg-blue-600' : 'bg-slate-200'}`}>
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
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Responsável pela Carteira</label>
              <select {...register('responsible_user_id')} className="w-full px-6 py-4 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl text-sm font-black outline-none cursor-pointer">
                <option value="">Gabinete (Geral)</option>
                {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 flex gap-4 sticky bottom-0 bg-white/95 backdrop-blur-md pb-4">
            <button type="button" onClick={onClose} className="px-10 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 uppercase text-xs tracking-widest transition-all">Cancelar</button>
            <button type="submit" disabled={isSaving} className="flex-1 py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-2xl shadow-blue-200 flex items-center justify-center gap-4 uppercase text-xs tracking-widest transition-all">
              {isSaving ? <Loader2 size={22} className="animate-spin" /> : <Save size={22} />}
              {isEditing ? 'Confirmar Alterações' : 'Finalizar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConstituentCreateModal;
