
import React, { useState } from 'react';
import { TimelineEvent, User, TimelineEventType } from '../types';
import { mockUsers } from '../services/mockData';
import { 
  MessageSquare, History, UserPlus, CheckCircle, Send, 
  ExternalLink, Phone, AlertTriangle, ShieldCheck, Info
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
        {events.map((event) => {
          const user = getUser(event.user_id);
          const config = getEventConfig(event.type);
          return (
            <div key={event.id} className="flex gap-3 text-xs">
              <div className={`mt-1 shrink-0 ${config.color}`}>
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-slate-700">{user?.name || 'Sistema'}</span>
                  <span className="text-[9px] font-bold text-slate-300 uppercase">{config.label}</span>
                  <span className="text-[9px] text-slate-300 ml-auto">
                    {new Date(event.created_at).toLocaleDateString('pt-BR')} {new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-600 leading-tight">{event.description}</p>
                {event.metadata?.reason && (
                  <p className="mt-1 text-[10px] text-rose-500 italic">Justificativa: {event.metadata.reason}</p>
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
          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!comment.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};

export default DemandTimeline;
