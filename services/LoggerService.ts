
import { LogEntry, LogAction, LogModule, LogChange, User, LogActorSnapshot } from '../types';

/**
 * LoggerService - Subsistema de Auditoria e Rastreabilidade
 * Centraliza o registro de ações para Timeline e Segurança.
 */
class LoggerService {
  private static instance: LoggerService;
  private logs: LogEntry[] = [];

  private constructor() {
    this.initializeMockLogs();
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Registra uma nova ação no sistema
   */
  public log(
    action: LogAction,
    module: LogModule,
    entityId: string,
    actor: User,
    changes?: LogChange[],
    meta?: LogEntry['meta']
  ): void {
    const actorSnapshot: LogActorSnapshot = {
      user_id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
    };

    const entry: LogEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
      timestamp: new Date().toISOString(),
      action,
      module,
      entity_id: entityId,
      actor: actorSnapshot,
      changes,
      meta: {
        ...meta,
        user_agent: navigator.userAgent,
      },
    };

    this.logs.unshift(entry); // Adiciona ao início (mais recente primeiro)
    this.printToConsole(entry);
    
    // Em um ambiente real, aqui faríamos o push para o Firestore/Tabela de Logs
    this.persistLocal();
  }

  /**
   * Retorna logs de uma entidade específica (Ex: Para Timeline de uma demanda)
   */
  public getLogsByEntity(entityId: string): LogEntry[] {
    return this.logs.filter(log => log.entity_id === entityId);
  }

  /**
   * Retorna logs filtrados por módulo
   */
  public getLogsByModule(module: LogModule): LogEntry[] {
    return this.logs.filter(log => log.module === module);
  }

  /**
   * Retorna logs de ações de um usuário específico
   */
  public getLogsByActor(userId: string): LogEntry[] {
    return this.logs.filter(log => log.actor.user_id === userId);
  }

  /**
   * Retorna todos os logs (Uso em painel administrativo)
   */
  public getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Persistência simples em localStorage para simular banco de dados em ambiente Mock
   */
  private persistLocal(): void {
    try {
      localStorage.setItem('g360_audit_logs', JSON.stringify(this.logs.slice(0, 1000)));
    } catch (e) {
      console.warn('LoggerService: Falha ao persistir logs localmente (quota excedida?)');
    }
  }

  /**
   * Debug Visual no Console
   */
  private printToConsole(entry: LogEntry): void {
    // Adding the missing 'UNLOCK' key to satisfy the Record<LogAction, string> type constraint
    const colors: Record<LogAction, string> = {
      CREATE: '#10b981', // green
      UPDATE: '#3b82f6', // blue
      DELETE: '#ef4444', // red
      DELETE_REQUESTED: '#f59e0b', // amber
      RESTORE: '#10b981', // green
      LOGIN: '#f59e0b',  // amber
      STATUS_CHANGE: '#8b5cf6', // violet
      CONTACT: '#06b6d4', // cyan
      COMMENT: '#64748b', // slate
      EXPORT: '#ec4899', // pink
      USER_STATUS_CHANGE: '#f43f5e', // rose
      UNLOCK: '#3b82f6' // blue
    };

    const color = colors[entry.action] || '#000';
    
    console.groupCollapsed(
      `%c AUDIT: [${entry.action}] - ${entry.module} %c ${new Date(entry.timestamp).toLocaleTimeString()}`,
      `background: ${color}; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;`,
      'color: gray; font-weight: normal;'
    );
    console.log('ID:', entry.id);
    console.log('Actor:', entry.actor.name, `(${entry.actor.role})`);
    console.log('Entity ID:', entry.entity_id);
    if (entry.changes) console.log('Changes:', entry.changes);
    if (entry.meta) console.log('Metadata:', entry.meta);
    console.groupEnd();
  }

  /**
   * Inicialização com Dados Mock (Narrativa de Auditoria)
   */
  private initializeMockLogs(): void {
    const saved = localStorage.getItem('g360_audit_logs');
    if (saved) {
      this.logs = JSON.parse(saved);
      return;
    }

    const mockLogs: LogEntry[] = [
      {
        id: 'log-1',
        timestamp: '2024-03-20T08:00:00Z',
        action: 'LOGIN',
        module: 'AUTH',
        entity_id: 'u1',
        actor: { user_id: 'u1', name: 'Ana (Admin)', email: 'ana@gabinete.leg.br', role: 'ADMIN' },
        meta: { ip: '192.168.1.1' }
      },
      {
        id: 'log-2',
        timestamp: '2024-03-20T09:15:00Z',
        action: 'CREATE',
        module: 'CONSTITUENT',
        entity_id: 'e1',
        actor: { user_id: 'u2', name: 'Marcos (Assessor)', email: 'marcos@gabinete.leg.br', role: 'ASSESSOR' },
        changes: [{ field: 'name', new_value: 'João da Silva Sauro' }]
      },
      {
        id: 'log-3',
        timestamp: '2024-03-20T10:30:00Z',
        action: 'UPDATE',
        module: 'CONSTITUENT',
        entity_id: 'e1',
        actor: { user_id: 'u1', name: 'Ana (Admin)', email: 'ana@gabinete.leg.br', role: 'ADMIN' },
        changes: [{ field: 'notes', old_value: '', new_value: 'Liderança ativa no bairro Bela Vista.' }]
      },
      {
        id: 'log-4',
        timestamp: '2024-03-20T11:00:00Z',
        action: 'CREATE',
        module: 'DEMAND',
        entity_id: 'd1',
        actor: { user_id: 'u3', name: 'Aline', email: 'aline@gabinete.leg.br', role: 'ASSESSOR' },
        changes: [{ field: 'title', new_value: 'Poste quebrado na Rua das Flores' }]
      },
      {
        id: 'log-5',
        timestamp: '2024-03-20T13:45:00Z',
        action: 'UPDATE',
        module: 'DEMAND',
        entity_id: 'd1',
        actor: { user_id: 'u11', name: 'Mauricio', email: 'mauricio@gabinete.leg.br', role: 'ASSESSOR' },
        changes: [{ field: 'assigned_to_user_id', old_value: 'u3', new_value: 'u14' }]
      },
      {
        id: 'log-6',
        timestamp: '2024-03-20T14:20:00Z',
        action: 'STATUS_CHANGE',
        module: 'DEMAND',
        entity_id: 'd1',
        actor: { user_id: 'u14', name: 'Roney', email: 'roney@gabinete.leg.br', role: 'ASSESSOR' },
        changes: [{ field: 'status', old_value: 'OPEN', new_value: 'IN_PROGRESS' }]
      },
      {
        id: 'log-7',
        timestamp: '2024-03-20T15:00:00Z',
        action: 'EXPORT',
        module: 'SYSTEM',
        entity_id: 'system',
        actor: { user_id: 'u1', name: 'Ana (Admin)', email: 'ana@gabinete.leg.br', role: 'ADMIN' },
        meta: { report_type: 'MONTHLY_DEMANDS_CSV' }
      },
      {
        id: 'log-8',
        timestamp: '2024-03-20T15:30:00Z',
        action: 'COMMENT',
        module: 'DEMAND',
        entity_id: 'd1',
        actor: { user_id: 'u6', name: 'Francis Junio', email: 'francis@gabinete.leg.br', role: 'ASSESSOR' },
        meta: { comment_preview: 'Liguei para a prefeitura e o prazo é de 48h.' }
      },
      {
        id: 'log-9',
        timestamp: '2024-03-20T16:10:00Z',
        action: 'CONTACT',
        module: 'DEMAND',
        entity_id: 'd1',
        actor: { user_id: 'u14', name: 'Roney', email: 'roney@gabinete.leg.br', role: 'ASSESSOR' },
        meta: { channel: 'whatsapp', source: 'whatsapp_button' }
      },
      {
        id: 'log-10',
        timestamp: '2024-03-20T17:00:00Z',
        action: 'USER_STATUS_CHANGE',
        module: 'CONTROL_CENTER',
        entity_id: 'u16',
        actor: { user_id: 'u1', name: 'Ana (Admin)', email: 'ana@gabinete.leg.br', role: 'ADMIN' },
        changes: [{ field: 'status', old_value: 'ACTIVE', new_value: 'INACTIVE' }]
      }
    ];

    this.logs = mockLogs;
    this.persistLocal();
  }
}

export const logger = LoggerService.getInstance();
