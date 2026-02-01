
import React, { useEffect, useState } from 'react';
import { Search, Plus, Filter, MoreHorizontal, Phone } from 'lucide-react';
import { DataService } from '../services/DataService';
import { Constituent } from '../types';

const Constituents: React.FC = () => {
  const [list, setList] = useState<Constituent[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    DataService.getConstituents().then(setList);
  }, []);

  // Fixed filtering to use deep address properties
  const filtered = list.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.address.neighborhood.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6 animate-in slide-in-from-bottom-2 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Base de Eleitores</h1>
          <p className="text-gray-500">Gerencie o relacionamento com os cidadãos.</p>
        </div>
        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-all shadow-md active:scale-95">
          <Plus size={18} />
          Novo Eleitor
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou bairro..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Filter size={18} />
            Filtros
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Eleitor</th>
                <th className="px-6 py-4">Localização</th>
                <th className="px-6 py-4">Contato</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm uppercase">
                        {c.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.document}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {/* Fixed property access for address fields */}
                    <p className="text-sm text-gray-700">{c.address.neighborhood}</p>
                    <p className="text-xs text-gray-400">{c.address.city}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Phone size={14} className="text-gray-400" />
                        {/* Fixed property name from phone to mobile_phone */}
                        {c.mobile_phone}
                      </div>
                      <p className="text-xs text-blue-500 hover:underline cursor-pointer">{c.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <MoreHorizontal size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-gray-400">Nenhum eleitor encontrado com esses critérios.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Constituents;
