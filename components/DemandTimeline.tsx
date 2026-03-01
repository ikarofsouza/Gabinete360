
import React, { useState } from 'react';
import { TimelineEvent, User, TimelineEventType } from '../types';
import { mockUsers } from '../services/mockData';
import { 
  MessageSquare, History, UserPlus, CheckCircle, Send, 
  ExternalLink, Phone, AlertTriangle, ShieldCheck, Info,
  Upload, Unlock, RotateCcw, Building2, Edit2, Scale
} from 'lucide-react';

interface Props {
  events: TimelineEvent[];
  onAddComment: (text: string) => void;
  onEditRequest?: (event: TimelineEvent) => void;
  onCompareRequest?: (event: TimelineEvent) => void;
  currentUser?: User | null;
}

const DemandTimeline: React.FC<Props> = ({ events, onAddComment, onEditRequest, onCompareRequest, currentUser }) => {
  const [comment, setComment] = useState('');

  const getUser = (id: string): User | undefined => mockUsers.find(u => u.id === id);

  const getEventConfig = (type: TimelineEventType) => {
    switch (type) {
      case 'CREATION': 
        return { icon: <History size={12} />, color: 'text-slate-400', label: 'CRIADO' };
      case 'STATUS_CHANGE': 
        return { icon: <CheckCircle size={12} />, color: 'text-blue-500', label: 'TRÂMITE' };
      case 'CONTACT': 
        return { icon: <Phone size={12} />, color: 'text-emerald-500', label: 'CONTATO' };
      case 'ASSIGNMENT': 
        return { icon: <UserPlus size={12} />, color: 'text-indigo-500', label: 'RESPONSÁVEL' };
      case 'DELETION_REQUESTED': 
        return { icon: <AlertTriangle size={12} />, color: 'text-rose-500', label: 'AUDITORIA' };
      case 'EXTERNAL_UPDATE':
        return { icon: <Building2 size={12} />, color: 'text-amber-500', label: 'EXTERNAL' };
      case 'DOCUMENT_UPLOAD':
        return { icon: <Upload size={12} />, color: 'text-indigo-600', label: 'ANEXO' };
      case 'UNLOCK':
        return { icon: <Unlock size={12} />, color: 'text-rose-600', label: 'REABERTO' };
      case 'RESTORED':
        return { icon: <RotateCcw size={12} />, color: 'text-emerald-600', label: 'RESTORED' };
      default: 
        return { icon: <MessageSquare size={12} />, color: 'text-slate-400', label: 'NOTA' };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    onAddComment(comment);
    setComment('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          Histórico de Auditoria
        </h4>
        <span className="text-[10px] font-medium text-slate-300 uppercase">{events.length} registros</span>
      </div>

      <div className="space-y-6">
        {[...events].reverse().map((event) => {
          const userFromMock = getUser(event.user_id);
          const userName = event.user_name || userFromMock?.name || 'Sistema';
          const config = getEventConfig(event.type);
          const isEdited = event.metadata?.is_edited;

          return (
            <div key={event.id} className="flex gap-4 text-xs animate-in fade-in slide-in-from-left-2 group">
              <div className={`mt-1 shrink-0 ${config.color}`}>
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-black text-slate-800 uppercase text-[10px]">{userName}</span>
                  <span className="text-[8px] font-bold text-slate-300 uppercase px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">{config.label}</span>
                  
                  {isAdmin && (
                    <button 
                      onClick={() => onEditRequest?.(event)}
                      className="p-1 text-slate-300 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                      title="Editar registro da trilha"
                    >
                      <Edit2 size={10} />
                    </button>
                  )}

                  <span className="text-[9px] text-slate-300 ml-auto font-mono">
                    {new Date(event.created_at).toLocaleDateString('pt-BR')} {new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                
                <div className={`p-4 rounded-2xl border transition-all ${isEdited ? 'bg-amber-50/30 border-amber-100' : 'bg-white border-slate-100'}`}>
                   <p className="text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{event.description}</p>
                   
                   {isEdited && (
                     <div className="mt-3 pt-3 border-t border-amber-100 flex items-center justify-between">
                        <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                          <AlertTriangle size={10} /> Registro alterado pelo administrador
                        </span>
                        <button 
                          onClick={() => onCompareRequest?.(event)}
                          className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase hover:underline"
                        >
                          <Scale size={10} /> Ver Comparativo
                        </button>
                     </div>
                   )}
                </div>

                {event.metadata?.reason && (
                  <p className="mt-1.5 text-[10px] text-rose-500 font-bold italic ml-2">Justificativa: {event.metadata.reason}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex gap-2 items-start bg-slate-50 p-4 rounded-[2rem] border border-slate-100">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Adicionar nota interna... (Ctrl+Enter envia)"
          rows={2}
          className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none custom-scrollbar shadow-inner"
        />
        <button
          type="submit"
          disabled={!comment.trim()}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100 flex items-center justify-center h-[42px] self-end mb-1"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default DemandTimeline;
