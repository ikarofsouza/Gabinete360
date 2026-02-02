
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "./firebase";
import { LogAction, LogModule, LogChange, User, LogEntry } from "../types";

export interface ExtendedLogEntry {
  timestamp: any; // Firestore Timestamp
  action: LogAction;
  module: LogModule;
  entity_id: string;
  actor: {
    user_id: string;
    name: string;
    email: string;
    role: string;
  };
  changes?: LogChange[];
  meta?: any;
}

class LoggerService {
  private static instance: LoggerService;

  private constructor() {}

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Remove recursivamente campos com valor 'undefined' de um objeto,
   * pois o Firestore não aceita este tipo de dado.
   */
  private sanitizeData(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(v => this.sanitizeData(v));
    } else if (obj !== null && typeof obj === 'object') {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => [k, this.sanitizeData(v)])
      );
    }
    return obj;
  }

  /**
   * Registra uma ação com auditoria completa no Firestore
   */
  public async log(
    action: LogAction,
    module: LogModule,
    entityId: string,
    actor: User,
    changes?: LogChange[],
    meta?: any
  ): Promise<void> {
    try {
      const logEntryRaw: Omit<ExtendedLogEntry, 'timestamp'> & { timestamp: any } = {
        action,
        module,
        entity_id: entityId,
        actor: {
          user_id: actor.id,
          name: actor.name,
          email: actor.email,
          role: actor.role,
        },
        changes: changes || [],
        meta: {
          ...meta,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
        timestamp: serverTimestamp()
      };

      // Higieniza os dados para remover campos 'undefined' que quebram o Firestore
      const logEntry = this.sanitizeData(logEntryRaw);

      await addDoc(collection(db, "logs"), logEntry);
      
      // Feedback no console em desenvolvimento
      console.log(`[AUDIT] Action: ${action} | Entity: ${entityId} | User: ${actor.name}`);
    } catch (error) {
      console.error("CRITICAL: Failed to write audit log:", error);
    }
  }

  /**
   * Retorna os logs de auditoria
   */
  public async getAllLogs(): Promise<LogEntry[]> {
    const q = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(200));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
      } as unknown as LogEntry;
    });
  }
}

export const logger = LoggerService.getInstance();
