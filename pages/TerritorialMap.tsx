
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Users, Navigation, Info, Search, Target, LayoutGrid, Loader2, AlertCircle } from 'lucide-react';
import { ConstituentService } from '../services/api';
import { Constituent } from '../types';
import { useToast } from '../contexts/ToastContext';

// Fix para ícones padrão do Leaflet em ambientes ESM
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Componente para ajuste dinâmico do zoom baseado nos marcadores visíveis
const FitBounds: React.FC<{ constituents: Constituent[] }> = ({ constituents }) => {
  const map = useMap();
  
  useEffect(() => {
    if (constituents.length > 0) {
      try {
        const validCoords = constituents
          .filter(c => c.geo && typeof c.geo.lat === 'number' && typeof c.geo.lng === 'number')
          .map(c => [c.geo!.lat, c.geo!.lng] as [number, number]);
        
        if (validCoords.length > 0) {
          const bounds = L.latLngBounds(validCoords);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
      } catch (err) {
        console.error("Erro ao calcular limites do mapa:", err);
      }
    }
  }, [constituents, map]);

  return null;
};

const TerritorialMap: React.FC = () => {
  const { showToast } = useToast();
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfluence, setShowInfluence] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMapData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ConstituentService.getAll();
      // Filtra apenas registros que possuem o objeto geo e coordenadas válidas
      const mapped = data.filter(c => 
        c.geo && 
        typeof c.geo.lat === 'number' && 
        typeof c.geo.lng === 'number' &&
        c.geo.lat !== 0 && 
        c.geo.lng !== 0
      );
      setConstituents(mapped);
    } catch (error) {
      console.error("Erro ao buscar dados do mapa:", error);
      showToast("Falha ao carregar inteligência territorial.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  // Filtro de busca local nos dados já carregados
  const filteredConstituents = useMemo(() => {
    return constituents.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.address.neighborhood && c.address.neighborhood.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [constituents, searchTerm]);

  // Centro padrão (Sete Lagoas - MG)
  const defaultPosition: [number, number] = [-19.4658, -44.2467];

  return (
    <div className="p-8 space-y-6 h-screen flex flex-col page-enter">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl">
             <MapPin size={28} />
           </div>
           <div>
             <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Mapa Territorial</h1>
             <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1">Distribuição tática e zonas de influência</p>
           </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group min-w-[320px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Localizar eleitor ou região..." 
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-600/5 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button 
            onClick={() => setShowInfluence(!showInfluence)}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${showInfluence ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            <Target size={16} /> {showInfluence ? 'Ocultar Raios' : 'Ver Influência'}
          </button>

          <div className="bg-slate-900 px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-800">
            <Users size={18} className="text-blue-400" />
            <div className="flex flex-col">
              <p className="text-[8px] text-slate-500 font-black uppercase leading-none">Mapeados</p>
              <p className="text-sm font-black text-white">{filteredConstituents.length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 bg-white rounded-[3rem] border-4 border-white shadow-2xl overflow-hidden relative group">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-[1000] backdrop-blur-md">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 border-[6px] border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
                <MapPin className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" size={24} />
              </div>
              <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Sincronizando Geo-Inteligência...</p>
            </div>
          </div>
        ) : constituents.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-[1000] p-12 text-center">
            <div className="max-w-md space-y-6">
              <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-amber-100">
                <AlertCircle size={40} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase">Sem Dados Geográficos</h3>
                <p className="text-sm font-medium text-slate-500 mt-2 leading-relaxed">Nenhum eleitor na base possui coordenadas válidas para exibição no mapa. Certifique-se de preencher o endereço/CEP nos cadastros.</p>
              </div>
              <button onClick={fetchMapData} className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all">Tentar Novamente</button>
            </div>
          </div>
        ) : null}

        <MapContainer 
          center={defaultPosition} 
          zoom={13} 
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <FitBounds constituents={filteredConstituents} />
          
          {filteredConstituents.map((c) => (
            <React.Fragment key={c.id}>
              <Marker position={[c.geo!.lat, c.geo!.lng]}>
                <Popup minWidth={260} className="custom-popup">
                  <div className="p-4 font-sans space-y-4">
                    <div className="flex items-center gap-4 mb-2 border-b border-slate-100 pb-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg border ${c.is_leadership ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-blue-600 text-white border-blue-500'}`}>
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 uppercase leading-tight truncate">{c.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{c.address.neighborhood || 'Bairro não informado'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3 text-[10px] text-slate-600 font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <Navigation size={14} className="text-blue-500 shrink-0" />
                        <span className="uppercase truncate">{c.address.street}, {c.address.number}</span>
                      </div>
                      
                      {c.is_leadership && (
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-500 text-white text-[8px] font-black uppercase px-2.5 py-1 rounded-lg shadow-lg shadow-amber-100">
                            Liderança Estratégica
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(c.tags || []).slice(0, 3).map(t => (
                        <span key={t} className="text-[8px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-black uppercase border border-blue-100">{t}</span>
                      ))}
                    </div>

                    <button 
                      onClick={() => window.open(`https://wa.me/${c.mobile_phone.replace(/\D/g, '')}`, '_blank')}
                      className="w-full py-3 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl flex items-center justify-center gap-2 mt-2"
                    >
                      Abrir Canal Direto
                    </button>
                  </div>
                </Popup>
              </Marker>
              
              {showInfluence && (
                <Circle 
                  center={[c.geo!.lat, c.geo!.lng]} 
                  radius={400} 
                  pathOptions={{ 
                    color: c.is_leadership ? '#f59e0b' : '#2563eb', 
                    fillColor: c.is_leadership ? '#f59e0b' : '#2563eb', 
                    fillOpacity: 0.08, 
                    weight: 1,
                    dashArray: '8, 8'
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </MapContainer>

        {/* Legend Overlay */}
        <div className="absolute top-6 right-6 z-[1000] bg-white/95 backdrop-blur-md p-6 rounded-[2.5rem] border border-slate-200 shadow-2xl max-w-xs space-y-6 animate-in slide-in-from-right duration-700">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <LayoutGrid size={18} />
            </div>
            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Legenda Tática</h4>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-5 h-5 rounded-full bg-blue-600 shadow-lg shadow-blue-100 border-2 border-white" />
              <p className="text-[10px] text-slate-700 font-black uppercase tracking-wider">Eleitor Base</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-5 h-5 rounded-full bg-amber-500 shadow-lg shadow-amber-100 border-2 border-white" />
              <p className="text-[10px] text-slate-700 font-black uppercase tracking-wider">Liderança</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-5 rounded-lg bg-blue-600/10 border border-dashed border-blue-400" />
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider italic">Raio 400m</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[9px] text-slate-500 font-bold italic leading-relaxed text-center">
              "A densidade de marcadores revela áreas de força e vácuos de atuação do mandato."
            </p>
          </div>
        </div>

        {/* Sync Status Info */}
        <div className="absolute bottom-8 left-8 z-[1000] bg-slate-900/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 animate-in slide-in-from-bottom-4">
           <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
           <span className="text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap">Conexão em Tempo Real Ativa</span>
        </div>
      </div>
    </div>
  );
};

export default TerritorialMap;
