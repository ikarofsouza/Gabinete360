
import React from 'react';
import { DemandStatus } from '../types';

interface Props {
  status: DemandStatus;
  className?: string;
}

const DemandStatusBadge: React.FC<Props> = ({ status, className = "" }) => {
  const config: Record<DemandStatus, { label: string; classes: string }> = {
    DRAFT: { label: 'Rascunho', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
    OPEN: { label: 'Aberto', classes: 'bg-amber-100 text-amber-700 border-amber-300' },
    ANALYSIS: { label: 'Em Análise', classes: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
    IN_PROGRESS: { label: 'Em Trâmite', classes: 'bg-blue-600 text-white border-blue-700 shadow-sm shadow-blue-100' },
    WAITING_THIRD_PARTY: { label: 'Aguardando Terceiros', classes: 'bg-purple-100 text-purple-700 border-purple-300' },
    SUCCESS: { label: 'Atendido', classes: 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-100' },
    UNFEASIBLE: { label: 'Inviável', classes: 'bg-rose-100 text-rose-800 border-rose-300' },
    ARCHIVED: { label: 'Arquivado', classes: 'bg-slate-800 text-slate-300 border-slate-700' },
  };

  const { label, classes } = config[status] || config.DRAFT;

  return (
    <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm transition-all whitespace-nowrap ${classes} ${className}`}>
      {label}
    </span>
  );
};

export default DemandStatusBadge;
