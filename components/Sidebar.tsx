
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  ClipboardList, 
  Calendar, 
  BarChart3, 
  Settings,
  MessageSquare,
  LogOut,
  ChevronRight,
  Map as MapIcon,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ADMIN';

  const mainItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/app/dashboard' },
    { icon: Users, label: 'Eleitores', path: '/app/eleitores' },
    { icon: MapIcon, label: 'Mapa Territorial', path: '/app/mapa' },
    { icon: ClipboardList, label: 'Demandas', path: '/app/demandas' },
    { icon: Calendar, label: 'Agenda', path: '/app/agenda' },
    { icon: MessageSquare, label: 'WhatsApp', path: '/app/comunicacao' },
  ];

  const adminItems = [
    { icon: ShieldAlert, label: 'Centro Controle', path: '/app/config-gabinete' },
    { icon: BarChart3, label: 'Relatórios', path: '/app/relatorios' },
    { icon: Settings, label: 'Ajustes', path: '/app/config' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl relative z-10">
      <div className="p-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/50">
            G
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Gabinete360</h1>
            <p className="text-[10px] text-blue-400 uppercase tracking-[0.2em] font-black">Control Center</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 px-4 py-2 space-y-6 overflow-y-auto custom-scrollbar">
        {/* Menu Principal */}
        <div>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] px-4 mb-4">Menu Principal</p>
          <div className="space-y-1.5">
            {mainItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}
                `}
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <item.icon 
                        size={18} 
                        className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-100'} 
                      />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    {isActive && <ChevronRight size={14} className="text-blue-200" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Menu Administrativo - Visível apenas para ADMIN */}
        {isAdmin && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] px-4 mb-4">Menu Administrativo</p>
            <div className="space-y-1.5">
              {adminItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `
                    flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group
                    ${isActive 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <item.icon 
                          size={18} 
                          className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-100'} 
                        />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {isActive && <ChevronRight size={14} className="text-indigo-200" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <img 
              src={user?.avatar_url || 'https://i.pravatar.cc/150'} 
              alt={user?.name} 
              className="w-10 h-10 rounded-xl border-2 border-slate-700 shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 truncate lowercase font-black tracking-widest">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-700/50 text-slate-300 hover:bg-red-500/10 hover:text-red-400 rounded-xl text-xs font-bold transition-all border border-slate-700 hover:border-red-500/30"
          >
            <LogOut size={16} />
            Encerrar Sessão
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
