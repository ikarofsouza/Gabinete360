
import { 
  User, 
  Constituent, 
  Demand, 
  TimelineEvent, 
  Category, 
  KPIStats, 
  DemandStatus,
  TimelineEventType,
  DemandAttachment
} from '../types';
import { 
  mockUsers, 
  mockConstituents, 
  mockDemands, 
  mockTimeline, 
  mockCategories 
} from './mockData';

const DELAY = 600;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class AuthService {
  static async login(email: string): Promise<User> {
    await sleep(DELAY);
    const user = mockUsers.find(u => u.email === email);
    if (!user) throw new Error('Usuário não encontrado.');
    return user;
  }
}

export class ConstituentService {
  static async getAll(): Promise<Constituent[]> {
    await sleep(DELAY);
    return mockConstituents.filter(c => !c.is_pending_deletion);
  }

  static async getById(id: string): Promise<Constituent | undefined> {
    await sleep(DELAY);
    return mockConstituents.find(c => c.id === id);
  }

  static async getBirthdaysToday(): Promise<Constituent[]> {
    await sleep(DELAY / 2);
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    
    return mockConstituents.filter(c => {
      if (!c.birth_date || c.is_pending_deletion) return false;
      const bDate = new Date(c.birth_date);
      return bDate.getDate() === day && (bDate.getMonth() + 1) === month;
    });
  }

  static async getPendingDeletions(): Promise<Constituent[]> {
    await sleep(DELAY / 2);
    return mockConstituents.filter(c => c.is_pending_deletion);
  }

  static async create(data: Partial<Constituent>): Promise<Constituent> {
    await sleep(DELAY);
    const newConstituent: Constituent = {
      ...data,
      id: `e${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_pending_deletion: false
    } as Constituent;
    mockConstituents.push(newConstituent);
    return newConstituent;
  }

  static async update(id: string, data: Partial<Constituent>): Promise<Constituent> {
    await sleep(DELAY);
    const index = mockConstituents.findIndex(c => c.id === id);
    if (index === -1) throw new Error("Eleitor não encontrado");
    const updated = { ...mockConstituents[index], ...data, updated_at: new Date().toISOString() };
    mockConstituents[index] = updated;
    return updated;
  }

  static async delete(id: string, userId: string, reason: string): Promise<void> {
    await sleep(DELAY);
    const index = mockConstituents.findIndex(c => c.id === id);
    if (index !== -1) {
      mockConstituents[index] = {
        ...mockConstituents[index],
        is_pending_deletion: true,
        deletion_reason: reason,
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      };
    }
  }

  static async permanentDelete(id: string): Promise<void> {
    await sleep(DELAY);
    const index = mockConstituents.findIndex(c => c.id === id);
    if (index !== -1) mockConstituents.splice(index, 1);
  }

  static async restore(id: string): Promise<void> {
    await sleep(DELAY);
    const index = mockConstituents.findIndex(c => c.id === id);
    if (index !== -1) {
      mockConstituents[index].is_pending_deletion = false;
    }
  }

  static async batchCreate(data: Partial<Constituent>[]): Promise<void> {
    await sleep(DELAY * 2);
    data.forEach(item => {
      mockConstituents.push({
        ...item,
        id: `e${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        is_pending_deletion: false
      } as Constituent);
    });
  }
}

export class DemandService {
  static async getAll(): Promise<Demand[]> {
    await sleep(DELAY);
    return mockDemands.filter(d => !d.is_pending_deletion);
  }

  static async getPendingDeletions(): Promise<Demand[]> {
    await sleep(DELAY / 2);
    return mockDemands.filter(d => d.is_pending_deletion);
  }

  static async create(data: Partial<Demand>): Promise<Demand> {
    await sleep(DELAY);
    const nextProtocol = `REQ-${new Date().getFullYear()}-${String(mockDemands.length + 1).padStart(3, '0')}`;
    const newDemand: Demand = {
      ...data,
      id: `d${Date.now()}`,
      protocol: nextProtocol,
      status: 'OPEN',
      attachments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_pending_deletion: false
    } as Demand;
    mockDemands.push(newDemand);

    await this.addTimelineEvent(newDemand.id, data.created_by || 'system', {
      type: 'CREATION',
      description: 'Demanda aberta no sistema.'
    });

    return newDemand;
  }

  static async getById(id: string): Promise<Demand | undefined> {
    await sleep(DELAY);
    return mockDemands.find(d => d.id === id);
  }

  static async update(id: string, userId: string, data: Partial<Demand>): Promise<Demand> {
    await sleep(DELAY);
    const index = mockDemands.findIndex(d => d.id === id);
    if (index === -1) throw new Error("Demanda não encontrada");
    
    mockDemands[index] = {
      ...mockDemands[index],
      ...data,
      updated_at: new Date().toISOString(),
      updated_by: userId
    };
    return mockDemands[index];
  }

  static async permanentDelete(id: string): Promise<void> {
    await sleep(DELAY);
    const index = mockDemands.findIndex(d => d.id === id);
    if (index !== -1) mockDemands.splice(index, 1);
  }

  static async restore(id: string, userId: string): Promise<void> {
    await sleep(DELAY);
    const index = mockDemands.findIndex(d => d.id === id);
    if (index !== -1) {
      mockDemands[index].is_pending_deletion = false;
      mockDemands[index].updated_at = new Date().toISOString();
      mockDemands[index].updated_by = userId;
    }
  }

  static async addAttachment(demandId: string, userId: string, file: { name: string, type: string, size: string }): Promise<DemandAttachment> {
    await sleep(DELAY);
    const demand = mockDemands.find(d => d.id === demandId);
    if (!demand) throw new Error("Demanda não encontrada");

    const newAttachment: DemandAttachment = {
      id: `att-${Date.now()}`,
      name: file.name,
      type: file.type,
      size: file.size,
      url: '#',
      created_at: new Date().toISOString()
    };

    if (!demand.attachments) demand.attachments = [];
    demand.attachments.push(newAttachment);

    await this.addTimelineEvent(demandId, userId, {
      type: 'DOCUMENT_UPLOAD',
      description: `Anexou o arquivo: ${file.name}`
    });

    return newAttachment;
  }

  static async updateStatus(demandId: string, userId: string, newStatus: DemandStatus, unlockReason?: string): Promise<void> {
    await sleep(DELAY);
    const demand = mockDemands.find(d => d.id === demandId);
    if (!demand) throw new Error('Demanda não encontrada.');
    
    const oldStatus = demand.status;
    demand.status = newStatus;
    demand.updated_at = new Date().toISOString();
    demand.updated_by = userId;

    if (unlockReason) {
      await this.addTimelineEvent(demandId, userId, {
        type: 'UNLOCK',
        description: `REABERTURA DE REGISTRO. Justificativa: ${unlockReason}`,
        metadata: { old: oldStatus, new: newStatus }
      });
    } else {
      await this.addTimelineEvent(demandId, userId, {
        type: 'STATUS_CHANGE',
        description: `Alterou o status de ${oldStatus} para ${newStatus}`,
        metadata: { old: oldStatus, new: newStatus }
      });
    }
  }

  static async addTimelineEvent(
    demandId: string, 
    userId: string, 
    data: { type: TimelineEventType, description: string, metadata?: any }
  ): Promise<TimelineEvent> {
    await sleep(DELAY / 2);
    const newEvent: TimelineEvent = {
      id: `t-${Date.now()}`,
      parent_id: demandId,
      user_id: userId,
      type: data.type,
      description: data.description,
      metadata: data.metadata,
      created_at: new Date().toISOString()
    };
    mockTimeline.push(newEvent);
    return newEvent;
  }

  static async getTimeline(demandId: string): Promise<TimelineEvent[]> {
    await sleep(DELAY / 2);
    return mockTimeline.filter(t => t.parent_id === demandId).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  static async getKPIs(): Promise<KPIStats> {
    await sleep(DELAY);
    const productivity = mockUsers.map(user => ({
      user_name: user.name,
      resolved_count: mockDemands.filter(d => d.assigned_to_user_id === user.id && (d.status === 'SUCCESS')).length
    })).sort((a, b) => b.resolved_count - a.resolved_count);

    return {
      total_constituents: mockConstituents.length,
      open_demands: mockDemands.filter(d => d.status === 'OPEN').length,
      waiting_demands: mockDemands.filter(d => d.status === 'WAITING_THIRD_PARTY').length,
      birthdays_today: 0,
      finished_this_month: mockDemands.filter(d => d.status === 'SUCCESS').length,
      active_neighborhoods: 0,
      team_productivity: productivity,
      demands_by_category: [],
      constituent_growth: []
    };
  }
}

export class CategoryService {
  static async getAll(): Promise<Category[]> {
    return [...mockCategories];
  }
}
