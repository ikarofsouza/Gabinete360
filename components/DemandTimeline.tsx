
import React, { useState } from 'react';
import { TimelineEvent, User, TimelineEventType } from '../types';
import { mockUsers } from '../services/mockData';
import { 
  MessageSquare, History, UserPlus, CheckCircle, Send, 
  ExternalLink, Phone, AlertTriangle, ShieldCheck, Info,
  Upload, Unlock, RotateCcw, Building2
} from 'lucide-react';

interface Props {
  events: TimelineEvent[];
  onAddComment: (text: string) => void;
}

const DemandTimeline: React.FC<Props> = ({ events, onAddComment }) => {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          Histórico de Auditoria
        </h4>
        <span className="text-[10px] font-medium text-slate-300 uppercase">{events.length} registros</span>
      </div>

      <div className="space-y-3">
        {[...events].reverse().map((event) => {
          const userFromMock = getUser(event.user_id);
          const userName = event.user_name || userFromMock?.name || 'Sistema';
          const config = getEventConfig(event.type);
          return (
            <div key={event.id} className="flex gap-3 text-xs animate-in fade-in slide-in-from-left-2">
              <div className={`mt-1 shrink-0 ${config.color}`}>
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-black text-slate-800 uppercase text-[10px]">{userName}</span>
                  <span className="text-[8px] font-bold text-slate-300 uppercase px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">{config.label}</span>
                  <span className="text-[9px] text-slate-300 ml-auto">
                    {new Date(event.created_at).toLocaleDateString('pt-BR')} {new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed font-medium">{event.description}</p>
                {event.metadata?.reason && (
                  <p className="mt-1 text-[10px] text-rose-500 font-bold italic">Justificativa: {event.metadata.reason}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Adicionar nota interna..."
          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!comment.trim()}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100 flex items-center justify-center"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default DemandTimeline;
