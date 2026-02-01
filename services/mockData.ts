
import { User, Category, Constituent, Demand, TimelineEvent } from '../types';

export const mockUsers: User[] = [
  { id: 'u1', name: 'Ana (Admin)', email: 'ana@gabinete.leg.br', role: 'ADMIN', status: 'ACTIVE', avatar_url: 'https://i.pravatar.cc/150?u=ana', sectors: ['cat1', 'cat2', 'cat3', 'cat4', 'cat5'] },
  { id: 'u2', name: 'Marcos (Assessor)', email: 'marcos@gabinete.leg.br', role: 'ASSESSOR', status: 'ACTIVE', avatar_url: 'https://i.pravatar.cc/150?u=marcos', sectors: ['cat1', 'cat2'] },
  { id: 'u3', name: 'Aline', email: 'aline@gabinete.leg.br', role: 'ASSESSOR', status: 'ACTIVE', avatar_url: 'https://i.pravatar.cc/150?u=aline', sectors: ['cat3'] },
  { id: 'u4', name: 'Atilio', email: 'atilio@gabinete.leg.br', role: 'ASSESSOR', status: 'ACTIVE', avatar_url: 'https://i.pravatar.cc/150?u=atilio', sectors: ['cat4'] },
  { id: 'u5', name: 'Carlinhos', email: 'carlinhos@gabinete.leg.br', role: 'STAFF', status: 'ACTIVE', avatar_url: 'https://i.pravatar.cc/150?u=carlinhos', sectors: ['cat1'] }
];

export const legacyKnownTags = [
  "ALMOÇO COMUNITÁRIO 2023",
  "ALMOÇO COMUNITÁRIO 2024",
  "ALMOÇO COMUNITÁRIO 2025",
  "APROXIMAR NO SEU BAIRRO 2023",
  "OFTALMOLOGISTA"
];

export const mockCategories: Category[] = [
  { id: 'cat1', name: 'Iluminação Pública', color: '#f59e0b' },
  { id: 'cat2', name: 'Tapa-Buraco', color: '#ef4444' },
  { id: 'cat3', name: 'Saúde / Exames', color: '#10b981' },
  { id: 'cat4', name: 'Educação / Vagas', color: '#3b82f6' },
  { id: 'cat5', name: 'Segurança', color: '#6366f1' }
];

const today = new Date();
const pastDate = new Date();
pastDate.setDate(today.getDate() - 10);
const futureDate = new Date();
futureDate.setDate(today.getDate() + 5);

export const mockConstituents: Constituent[] = [
  {
    id: 'e1',
    name: 'João da Silva Sauro',
    document: '123.456.789-00',
    voter_title: '098765432100',
    sus_card: '700012345678901',
    mobile_phone: '5511988887777',
    email: 'joao.silva@email.com',
    gender: 'M',
    birth_date: today.toISOString().split('T')[0],
    address: {
      zip_code: '01310-100',
      street: 'Avenida Paulista',
      number: '1500',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP'
    },
    geo: { lat: -23.5614, lng: -46.6559 },
    tags: ['Apoiador', 'Zona Sul'],
    is_leadership: true,
    leadership_type: 'COMMUNITY',
    notes: 'Liderança ativa no bairro Bela Vista há 10 anos.',
    responsible_user_id: 'u2',
    created_at: pastDate.toISOString(),
    created_by: 'u1',
    updated_at: pastDate.toISOString(),
    updated_by: 'u1',
    is_pending_deletion: false
  }
];

export const mockDemands: Demand[] = [
  {
    id: 'd1',
    protocol: 'REQ-2024-001',
    protocol_external: 'PREF-9988/24',
    title: 'Poste quebrado na Rua das Flores',
    description: 'Morador relata que o poste está apagado há mais de 15 dias, gerando insegurança.',
    constituent_id: 'e1',
    category_id: 'cat1',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    deadline: futureDate.toISOString().split('T')[0],
    assigned_to_user_id: 'u2',
    created_at: pastDate.toISOString(),
    created_by: 'u1',
    updated_at: pastDate.toISOString(),
    updated_by: 'u1',
    is_pending_deletion: false
  },
  {
    id: 'd2',
    protocol: 'REQ-2024-002',
    title: 'Vaga em Creche Municipal',
    description: 'Solicitação de vaga para criança de 2 anos.',
    constituent_id: 'e1',
    category_id: 'cat4',
    status: 'OPEN',
    priority: 'URGENT',
    deadline: pastDate.toISOString().split('T')[0], // ATRASADA
    assigned_to_user_id: 'u4',
    created_at: pastDate.toISOString(),
    created_by: 'u1',
    updated_at: pastDate.toISOString(),
    updated_by: 'u1',
    is_pending_deletion: false
  }
];

export const mockTimeline: TimelineEvent[] = [
  {
    id: 't1',
    parent_id: 'd1',
    user_id: 'u1',
    type: 'CREATION',
    description: 'Demanda aberta no sistema com base em visita territorial.',
    created_at: pastDate.toISOString()
  }
];
