
import { z } from 'zod';
import { cpf } from 'cpf-cnpj-validator';

/**
 * Esquema de Validação para Eleitores (Constituents)
 * Atualizado: Apenas nome e mobile_phone são obrigatórios.
 */
export const constituentSchema = z.object({
  name: z.string()
    .min(3, "Nome deve ter ao menos 3 caracteres")
    .max(100, "Nome muito longo"),
  document: z.string()
    .optional()
    .or(z.literal(''))
    .refine((val) => !val || cpf.isValid(val), "CPF inválido"),
  mobile_phone: z.string()
    .min(10, "Telefone inválido")
    .max(15, "Telefone muito longo"),
  email: z.string().email("E-mail inválido").optional().or(z.literal('')),
  gender: z.enum(['M', 'F', 'OTHER']).optional().default('M'),
  birth_date: z.string().optional().or(z.literal('')),
  voter_title: z.string().optional().or(z.literal('')),
  sus_card: z.string().optional().or(z.literal('')),
  responsible_user_id: z.string().optional().or(z.literal('')),
  is_leadership: z.boolean().default(false),
  leadership_type: z.enum(['COMMUNITY', 'RELIGIOUS', 'SPORTS', 'UNION', 'OTHER', 'NONE']).default('NONE'),
  notes: z.string().optional(),
  address: z.object({
    zip_code: z.string().optional().or(z.literal('')),
    street: z.string().optional().or(z.literal('')),
    number: z.string().optional().or(z.literal('')),
    complement: z.string().optional().or(z.literal('')),
    neighborhood: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
  }).optional()
});

export type ConstituentFormData = z.infer<typeof constituentSchema>;

/**
 * Esquema de Validação para Demandas
 */
export const demandSchema = z.object({
  title: z.string().min(5, "Título muito curto").max(150),
  description: z.string().min(10, "Descreva melhor a demanda"),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  category_id: z.string().min(1, "Selecione uma categoria"),
  assigned_to_user_id: z.string().optional().or(z.literal('')),
  deadline: z.string().optional().or(z.literal('')),
});

export type DemandFormData = z.infer<typeof demandSchema>;
