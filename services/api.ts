
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where,
  serverTimestamp,
  orderBy,
  limit,
  writeBatch,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { logger } from "./LoggerService";
import { User, Constituent, Demand, Category, KPIStats, DemandStatus, TimelineEvent, DemandAttachment, UserRole, UserStatus } from "../types";

export class UserService {
  static async getAll(): Promise<User[]> {
    const q = query(collection(db, "users"), orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as User));
  }

  static async update(id: string, actor: User, data: Partial<User>): Promise<void> {
    const docRef = doc(db, "users", id);
    await updateDoc(docRef, {
      ...data,
      updated_at: serverTimestamp()
    });
    await logger.log('UPDATE', 'CONTROL_CENTER', id, actor, [{ field: 'user_profile', new_value: data.name }]);
  }

  static async create(actor: User, data: Partial<User>): Promise<string> {
    const payload = {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, "users"), payload);
    await logger.log('CREATE', 'CONTROL_CENTER', docRef.id, actor, [{ field: 'new_user', new_value: data.email }]);
    return docRef.id;
  }

  static async uploadAvatar(userId: string, file: File): Promise<string> {
    const storageRef = ref(storage, `avatars/${userId}_${Date.now()}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  }
}

export class CategoryService {
  static async getAll(): Promise<Category[]> {
    const q = query(collection(db, "categories"), orderBy("name"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Category));
  }

  static async create(actor: User, name: string, color: string): Promise<Category> {
    const payload = {
      name,
      color,
      created_at: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, "categories"), payload);
    await logger.log('CREATE', 'CATEGORY', docRef.id, actor, [{ field: 'name', new_value: name }]);
    return { ...payload, id: docRef.id } as Category;
  }

  static async update(id: string, actor: User, data: Partial<Category>): Promise<void> {
    const docRef = doc(db, "categories", id);
    await updateDoc(docRef, data);
    await logger.log('UPDATE', 'CATEGORY', id, actor, [{ field: 'category_data', new_value: data.name }]);
  }

  static async delete(id: string, actor: User): Promise<void> {
    await deleteDoc(doc(db, "categories", id));
    await logger.log('DELETE', 'CATEGORY', id, actor);
  }

  static async seed() {
    const cats = [
      { name: 'Assistência Social', color: '#ec4899' },
      { name: 'Educação', color: '#3b82f6' },
      { name: 'Esporte', color: '#10b981' },
      { name: 'Meio Ambiente', color: '#059669' },
      { name: 'Obras', color: '#f59e0b' },
      { name: 'Relações Públicas', color: '#6366f1' },
      { name: 'SAAE', color: '#0ea5e9' },
      { name: 'Saúde', color: '#ef4444' },
      { name: 'Trânsito', color: '#64748b' },
      { name: 'Visita - Aguardando', color: '#f97316' },
      { name: 'Visita - Realizada', color: '#8b5cf6' }
    ].sort((a, b) => a.name.localeCompare(b.name));
    
    const existing = await this.getAll();
    if (existing.length === 0) {
      for (const cat of cats) {
        await addDoc(collection(db, "categories"), cat);
      }
    }
  }
}

export class ConstituentService {
  static async getAll(): Promise<Constituent[]> {
    const q = query(collection(db, "constituents"), where("is_pending_deletion", "==", false));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Constituent));
  }

  static async getById(id: string): Promise<Constituent | null> {
    const docSnap = await getDoc(doc(db, "constituents", id));
    return docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } as Constituent : null;
  }

  static async getBirthdaysToday(): Promise<Constituent[]> {
    const all = await this.getAll();
    const today = new Date();
    return all.filter(c => {
      if (!c.birth_date) return false;
      const bDate = new Date(c.birth_date);
      return bDate.getUTCDate() === today.getUTCDate() && bDate.getUTCMonth() === today.getUTCMonth();
    });
  }

  static async getPendingDeletions(): Promise<Constituent[]> {
    const q = query(collection(db, "constituents"), where("is_pending_deletion", "==", true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Constituent));
  }

  static async create(data: Partial<Constituent>, actor: User): Promise<Constituent> {
    const payload = {
      ...data,
      is_pending_deletion: false,
      created_at: new Date().toISOString(),
      created_by: actor.id,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    };
    
    const docRef = await addDoc(collection(db, "constituents"), payload);
    
    await logger.log('CREATE', 'CONSTITUENT', docRef.id, actor, [
      { field: 'full_record', new_value: data.name }
    ]);

    return { ...payload, id: docRef.id } as Constituent;
  }

  static async update(id: string, data: Partial<Constituent>, actor: User): Promise<Constituent> {
    const docRef = doc(db, "constituents", id);
    const oldSnap = await getDoc(docRef);
    const oldData = oldSnap.data();

    const changes = Object.keys(data).map(key => ({
      field: key,
      old_value: oldData?.[key],
      new_value: (data as any)[key]
    }));

    const updatePayload = {
      ...data,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    };

    await updateDoc(docRef, updatePayload);
    await logger.log('UPDATE', 'CONSTITUENT', id, actor, changes);

    return { ...oldData, ...updatePayload, id } as Constituent;
  }

  static async delete(id: string, actor: User, reason: string): Promise<void> {
    const docRef = doc(db, "constituents", id);
    await updateDoc(docRef, {
      is_pending_deletion: true,
      deletion_reason: reason,
      deleted_at: new Date().toISOString(),
      deleted_by: actor.id
    });
    await logger.log('DELETE_REQUESTED', 'CONSTITUENT', id, actor, undefined, { reason });
  }

  static async permanentDelete(id: string, actor: User): Promise<void> {
    await deleteDoc(doc(db, "constituents", id));
    await logger.log('DELETE', 'CONSTITUENT', id, actor);
  }

  static async restore(id: string, actor: User): Promise<void> {
    const docRef = doc(db, "constituents", id);
    await updateDoc(docRef, {
      is_pending_deletion: false,
      deletion_reason: null,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    });
    await logger.log('RESTORE', 'CONSTITUENT', id, actor);
  }

  static async batchCreate(constituents: Partial<Constituent>[], actor: User): Promise<void> {
    const batch = writeBatch(db);
    constituents.forEach(c => {
      const docRef = doc(collection(db, "constituents"));
      batch.set(docRef, {
        ...c,
        is_pending_deletion: false,
        created_at: new Date().toISOString(),
        created_by: actor.id,
        updated_at: new Date().toISOString(),
        updated_by: actor.id
      });
    });
    await batch.commit();
    await logger.log('EXPORT', 'CONSTITUENT', 'batch', actor, undefined, { count: constituents.length });
  }
}

export class DemandService {
  static async getAll(): Promise<Demand[]> {
    const q = query(collection(db, "demands"), where("is_pending_deletion", "==", false));
    const snapshot = await getDocs(q);
    const demands = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Demand));
    
    return demands.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  static async getPendingDeletions(): Promise<Demand[]> {
    const q = query(collection(db, "demands"), where("is_pending_deletion", "==", true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Demand));
  }

  static async getTimeline(demandId: string): Promise<TimelineEvent[]> {
    const q = query(collection(db, "timeline"), where("parent_id", "==", demandId));
    const snapshot = await getDocs(q);
    const events = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as TimelineEvent));
    
    return events.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  static async getKPIs(): Promise<KPIStats> {
    const [demands, constituents, categories] = await Promise.all([
      this.getAll(),
      ConstituentService.getAll(),
      CategoryService.getAll()
    ]);

    const productivity = [
      { user_name: 'Gabinete Digital', resolved_count: demands.filter(d => d.status === 'SUCCESS').length }
    ];

    const categoryStats = categories.map(cat => ({
      name: cat.name,
      count: demands.filter(d => d.category_id === cat.id).length,
      color: cat.color
    })).filter(c => c.count > 0);

    const today = new Date();
    const bdays = constituents.filter(c => {
      if (!c.birth_date) return false;
      const bDate = new Date(c.birth_date);
      return bDate.getUTCDate() === today.getUTCDate() && bDate.getUTCMonth() === today.getUTCMonth();
    }).length;

    return {
      total_constituents: constituents.length,
      open_demands: demands.filter(d => d.status === 'OPEN').length,
      waiting_demands: demands.filter(d => d.status === 'WAITING_THIRD_PARTY').length,
      birthdays_today: bdays,
      finished_this_month: demands.filter(d => d.status === 'SUCCESS' && d.updated_at.includes(today.toISOString().substring(0, 7))).length,
      active_neighborhoods: new Set(constituents.map(c => c.address.neighborhood)).size,
      team_productivity: productivity,
      demands_by_category: categoryStats,
      constituent_growth: [{ month: 'Mês Atual', count: constituents.length }]
    };
  }

  static async create(data: Partial<Demand>, actor: User): Promise<Demand> {
    const protocol = `REQ-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    const payload = {
      ...data,
      protocol,
      status: 'OPEN',
      is_pending_deletion: false,
      last_action_label: 'Abertura do protocolo',
      last_user_name: actor.name,
      created_at: new Date().toISOString(),
      created_by: actor.id,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    };

    const docRef = await addDoc(collection(db, "demands"), payload);
    
    await this.addTimelineEvent(docRef.id, actor, {
      type: 'CREATION',
      description: `Protocolo #${protocol} gerado por ${actor.name}.`
    });

    await logger.log('CREATE', 'DEMAND', docRef.id, actor, [{ field: 'protocol', new_value: protocol }]);

    return { ...payload, id: docRef.id } as Demand;
  }

  static async update(id: string, actor: User, data: Partial<Demand>): Promise<Demand> {
    const docRef = doc(db, "demands", id);
    const updatePayload = {
      ...data,
      last_user_name: actor.name,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    };
    await updateDoc(docRef, updatePayload);
    const snap = await getDoc(docRef);
    return { ...snap.data(), id: snap.id } as Demand;
  }

  static async updateStatus(id: string, actor: User, newStatus: DemandStatus, reason?: string): Promise<TimelineEvent> {
    const docRef = doc(db, "demands", id);
    const oldSnap = await getDoc(docRef);
    
    if (!oldSnap.exists()) {
      throw new Error("Demanda não encontrada para atualização.");
    }

    const oldData = oldSnap.data();
    const oldStatus = oldData?.status;

    const statusLabels: Record<string, string> = {
      OPEN: 'ABERTO',
      ANALYSIS: 'ANÁLISE TÁTICA',
      IN_PROGRESS: 'TRÂMITE INTERNO',
      WAITING_THIRD_PARTY: 'AGUARDANDO ÓRGÃO EXTERNO',
      SUCCESS: 'FINALIZADO',
      UNFEASIBLE: 'INVIÁVEL',
      ARCHIVED: 'ARQUIVADO'
    };

    let description = `Trâmite alterado de ${statusLabels[oldStatus] || oldStatus} para ${statusLabels[newStatus] || newStatus}.`;
    
    if (newStatus === 'IN_PROGRESS' && oldStatus === 'WAITING_THIRD_PARTY') {
      description = "Retomada de Trâmite: O processo voltou após resposta ou cumprimento de prazo externo.";
    } else if (newStatus === 'WAITING_THIRD_PARTY' && oldStatus === 'IN_PROGRESS') {
      description = "Pausa Estratégica: Aguardando posicionamento, documento ou ação de órgão terceiro.";
    } else if (newStatus === 'ANALYSIS') {
      description = "Triagem Técnica: O relato está sendo avaliado para definir estratégia de encaminhamento.";
    } else if (newStatus === 'SUCCESS') {
      description = "Conclusão de Demanda: Objetivo alcançado e reportado ao eleitor.";
    }

    await updateDoc(docRef, {
      status: newStatus,
      last_action_label: description,
      last_user_name: actor.name,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    });

    const event = await this.addTimelineEvent(id, actor, {
      type: 'STATUS_CHANGE',
      description,
      metadata: reason ? { reason } : {}
    });

    await logger.log('STATUS_CHANGE', 'DEMAND', id, actor, [{ field: 'status', old_value: oldStatus, new_value: newStatus }], { reason });
    return event;
  }

  static async delete(id: string, actor: User, reason: string): Promise<void> {
    const docRef = doc(db, "demands", id);
    await updateDoc(docRef, {
      is_pending_deletion: true,
      deletion_reason: reason,
      deleted_at: new Date().toISOString(),
      deleted_by: actor.id
    });
    await logger.log('DELETE_REQUESTED', 'DEMAND', id, actor, undefined, { reason });
  }

  static async permanentDelete(id: string, actor: User): Promise<void> {
    await deleteDoc(doc(db, "demands", id));
    await logger.log('DELETE', 'DEMAND', id, actor);
  }

  static async restore(id: string, actor: User): Promise<void> {
    const docRef = doc(db, "demands", id);
    await updateDoc(docRef, {
      is_pending_deletion: false,
      deletion_reason: null,
      last_user_name: actor.name,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    });
    await logger.log('RESTORE', 'DEMAND', id, actor);
  }

  static async addTimelineEvent(demandId: string, actor: User, event: Partial<TimelineEvent>): Promise<TimelineEvent> {
    const payload: any = {
      ...event,
      parent_id: demandId,
      user_id: actor.id,
      user_name: actor.name, 
      created_at: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, "timeline"), payload);
    
    const dRef = doc(db, "demands", demandId);
    const updatePayload: any = {
      last_user_name: actor.name,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    };

    if (event.type === 'COMMENT') {
      updatePayload.last_action_label = `Nova nota: ${event.description.substring(0, 40)}...`;
    }

    await updateDoc(dRef, updatePayload);

    return { ...payload, id: docRef.id } as TimelineEvent;
  }

  static async addAttachment(demandId: string, actor: User, attachment: Partial<DemandAttachment>): Promise<DemandAttachment> {
    const docRef = doc(db, "demands", demandId);
    const demandSnap = await getDoc(docRef);
    const currentAttachments = demandSnap.data()?.attachments || [];
    
    const newAttachment: DemandAttachment = {
      id: Math.random().toString(36).substr(2, 9),
      name: attachment.name || 'documento',
      type: attachment.type || 'application/octet-stream',
      size: attachment.size || '0 KB',
      url: attachment.url || '#', 
      created_at: new Date().toISOString()
    };

    const actionText = `Arquivo anexado: ${newAttachment.name}`;

    await updateDoc(docRef, {
      attachments: [...currentAttachments, newAttachment],
      last_action_label: actionText,
      last_user_name: actor.name,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    });

    await this.addTimelineEvent(demandId, actor, {
      type: 'DOCUMENT_UPLOAD',
      description: actionText
    });

    return newAttachment;
  }

  static async removeAttachment(demandId: string, actor: User, attachmentId: string): Promise<void> {
    const docRef = doc(db, "demands", demandId);
    const demandSnap = await getDoc(docRef);
    if (!demandSnap.exists()) return;

    const currentAttachments: DemandAttachment[] = demandSnap.data()?.attachments || [];
    const target = currentAttachments.find(a => a.id === attachmentId);
    const filtered = currentAttachments.filter(a => a.id !== attachmentId);

    const actionText = `Arquivo removido: ${target?.name || 'anexo'}`;

    await updateDoc(docRef, {
      attachments: filtered,
      last_action_label: actionText,
      last_user_name: actor.name,
      updated_at: new Date().toISOString(),
      updated_by: actor.id
    });

    await this.addTimelineEvent(demandId, actor, {
      type: 'DOCUMENT_UPLOAD',
      description: actionText,
      metadata: { deleted_id: attachmentId }
    });
  }
}
