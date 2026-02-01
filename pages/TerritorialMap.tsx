
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Users, Navigation, Info } from 'lucide-react';
import { ConstituentService } from '../services/api';
import { Constituent } from '../types';

// Corrigir ícone padrão do Leaflet (quebra em SPAs as vezes)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TerritorialMap: React.FC = () => {
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ConstituentService.getAll().then(data => {
      setConstituents(data.filter(c => c.geo));
      setLoading(false);
    });
  }, []);

  // Centro aproximado de SP (conforme mockData)
  const position: [number, number] = [-23.5614, -46.6559];

  return (
    <div className="p-8 space-y-6 h-screen flex flex-col">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mapa Territorial</h1>
          <p className="text-slate-500 text-sm">Distribuição geográfica dos eleitores cadastrados.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Users size={18} className="text-blue-600" />
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Mapeados</p>
              <p className="text-sm font-bold text-slate-900">{constituents.length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[1000] backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-slate-500 font-bold animate-pulse">Renderizando camadas geográficas...</p>
            </div>
          </div>
        ) : (
          <MapContainer center={position} zoom={13} scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {constituents.map((c) => (
              <React.Fragment key={c.id}>
                <Marker position={[c.geo!.lat, c.geo!.lng]}>
                  <Popup>
                    <div className="p-1">
                      <p className="text-sm font-bold text-slate-900 mb-1">{c.name}</p>
                      <p className="text-xs text-slate-500 mb-2">{c.address.neighborhood}</p>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map(t => (
                          <span key={t} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-bold">{t}</span>
                        ))}
                      </div>
                    </div>
                  </Popup>
                </Marker>
                {/* Efeito de Heatmap simplificado com Circle */}
                <Circle 
                  center={[c.geo!.lat, c.geo!.lng]} 
                  radius={500} 
                  pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.1, weight: 1 }}
                />
              </React.Fragment>
            ))}
          </MapContainer>
        )}

        {/* Legend Overlay */}
        <div className="absolute bottom-6 left-6 z-[1000] bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl max-w-xs">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-3">
            <Info size={14} className="text-blue-600" />
            Legenda do Mapa
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <p className="text-xs text-slate-600 font-medium">Marcador de Eleitor</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-600/20 border border-blue-600/40" />
              <p className="text-xs text-slate-600 font-medium">Zona de Influência (500m)</p>
            </div>
          </div>
          <p className="mt-4 text-[10px] text-slate-400 italic">
            * Dados baseados nas coordenadas fornecidas no cadastro.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TerritorialMap;
