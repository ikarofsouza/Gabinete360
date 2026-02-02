
export type UserRole = 'ADMIN' | 'ASSESSOR' | 'STAFF' | 'PARLIAMENTARY';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

// Leadership type classification for constituents
export type LeadershipType = 'COMMUNITY' | 'RELIGIOUS' | 'SPORTS' | 'UNION' | 'OTHER' | 'NONE';

export type DemandStatus = 
  | 'DRAFT' 
  | 'OPEN' 
  | 'ANALYSIS'
  | 'IN_PROGRESS' 
  | 'WAITING_THIRD_PARTY' 
  | 'SUCCESS'
  | 'UNFEASIBLE'
  | 'ARCHIVED';

export type DemandPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TimelineEventType = 
  | 'STATUS_CHANGE' 
  | 'COMMENT' 
  | 'CONTACT' 
  | 'CREATION' 
  | 'ASSIGNMENT'
  | 'DELETION_REQUESTED'
  | 'RESTORED'
  | 'SLA_UPDATE'
  | 'PROTOCOL_UPDATE'
  | 'DOCUMENT_UPLOAD'
  | 'EXTERNAL_UPDATE'
  | 'UNLOCK';

export type LogAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'DELETE_REQUESTED' 
  | 'RESTORE' 
  | 'LOGIN' 
  | 'STATUS_CHANGE' 
  | 'CONTACT' 
  | 'COMMENT' 
  | 'EXPORT' 
  | 'USER_STATUS_CHANGE' 
  | 'UNLOCK';

export type LogModule = 'AUTH' | 'CONSTITUENT' | 'DEMAND' | 'SYSTEM' | 'CONTROL_CENTER' | 'CATEGORY';

export interface LogChange {
  field: string;
  old_value?: any;
  new_value?: any;
}

export interface LogActorSnapshot {
  user_id: string;
  name: string;
  email: string;
  role: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  action: LogAction;
  module: LogModule;
  entity_id: string;
  actor: LogActorSnapshot;
  changes?: LogChange[];
  meta?: any;
}

export interface DemandAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: string;
  created_at: string;
}

export interface Demand extends DeletionAudit {
  id: string;
  protocol: string;
  protocol_external?: string;
  protocol_date?: string;
  external_sector?: string;
  external_link?: string;
  title: string;
  description: string;
  constituent_id: string;
  category_id: string;
  status: DemandStatus;
  priority: DemandPriority;
  deadline?: string;
  assigned_to_user_id: string;
  attachments?: DemandAttachment[];
  last_action_label?: string;
  last_user_name?: string; // Novo: Nome amigável do último operador para a listagem
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  avatar_url?: string;
  sectors?: string[];
  created_at?: string;
}

export interface DeletionAudit {
  is_pending_deletion: boolean;
  deletion_reason?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface Address {
  zip_code: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface Constituent extends DeletionAudit {
  id: string;
  name: string;
  document: string;
  voter_title?: string;
  sus_card?: string;
  email?: string;
  mobile_phone: string;
  gender?: 'M' | 'F' | 'OTHER';
  birth_date?: string;
  address: Address;
  geo?: GeoLocation;
  tags: string[];
  is_leadership: boolean;
  leadership_type?: LeadershipType;
  notes?: string;
  responsible_user_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export interface TimelineEvent {
  id: string;
  parent_id: string;
  user_id: string;
  user_name?: string;
  type: TimelineEventType;
  description: string;
  metadata?: any;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  created_at?: string;
}

export interface KPIStats {
  total_constituents: number;
  open_demands: number;
  waiting_demands: number;
  birthdays_today: number;
  finished_this_month: number;
  active_neighborhoods: number;
  team_productivity: {
    user_name: string;
    resolved_count: number;
  }[];
  demands_by_category: {
    name: string;
    count: number;
    color: string;
  }[];
  constituent_growth: {
    month: string;
    count: number;
  }[];
}
