
import { mockConstituents, mockDemands, mockCategories, mockUsers } from './mockData';
import { Constituent, Demand, Category, KPIStats } from '../types';

export class DataService {
  static async getConstituents(): Promise<Constituent[]> {
    return new Promise((resolve) => setTimeout(() => resolve(mockConstituents), 500));
  }

  static async getDemands(): Promise<Demand[]> {
    return new Promise((resolve) => setTimeout(() => resolve(mockDemands), 500));
  }

  static async getCategories(): Promise<Category[]> {
    return mockCategories;
  }

  // Corrigindo o erro de propriedades ausentes no KPIStats
  static async getKPIs(): Promise<KPIStats> {
    // Cálculo de produtividade da equipe baseado no mockData
    const productivity = mockUsers.map(user => {
      const count = mockDemands.filter(d => 
        d.assigned_to_user_id === user.id && 
        // FIX: Changed 'FINISHED' to 'SUCCESS' as 'FINISHED' is not in DemandStatus type
        (d.status === 'SUCCESS' || d.status === 'ARCHIVED')
      ).length;
      return {
        user_name: user.name,
        resolved_count: count
      };
    }).sort((a, b) => b.resolved_count - a.resolved_count);

    // Estatísticas de demandas por categoria
    const categoryStats = mockCategories.map(cat => ({
      name: cat.name,
      count: mockDemands.filter(d => d.category_id === cat.id).length,
      color: cat.color
    })).filter(c => c.count > 0);

    // Dados de crescimento mensal (março refletindo o tamanho atual da base)
    const growth = [
      { month: 'Jan', count: 45 },
      { month: 'Fev', count: 62 },
      { month: 'Mar', count: mockConstituents.length }
    ];

    // FIX: Cálculo de aniversariantes hoje para satisfazer a interface KPIStats
    const today = new Date();
    const birthdaysCount = mockConstituents.filter(c => {
      if (!c.birth_date) return false;
      const bDate = new Date(c.birth_date);
      return bDate.getDate() === today.getDate() && bDate.getMonth() === today.getMonth();
    }).length;

    return {
      total_constituents: mockConstituents.length,
      open_demands: mockDemands.filter(d => d.status === 'OPEN').length,
      waiting_demands: mockDemands.filter(d => d.status === 'WAITING_THIRD_PARTY').length,
      birthdays_today: birthdaysCount,
      // FIX: Changed 'FINISHED' to 'SUCCESS' as 'FINISHED' is not in DemandStatus type
      finished_this_month: mockDemands.filter(d => d.status === 'SUCCESS').length,
      active_neighborhoods: new Set(mockConstituents.map(c => c.address.neighborhood)).size,
      team_productivity: productivity,
      demands_by_category: categoryStats,
      constituent_growth: growth
    };
  }

  static async createDemand(demand: Omit<Demand, 'id' | 'created_at' | 'updated_at'>): Promise<Demand> {
    const newDemand: Demand = {
      ...demand,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockDemands.push(newDemand);
    return newDemand;
  }
}
