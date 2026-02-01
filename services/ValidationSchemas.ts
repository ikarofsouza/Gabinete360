
import { z } from 'zod';
import { cpf } from 'cpf-cnpj-validator';

/**
 * Esquema de Validação para Eleitores (Constituents)
 */
export const constituentSchema = z.object({
  name: z.string()
    .min(3, "Nome deve ter ao menos 3 caracteres")
    .max(100, "Nome muito longo"),
  document: z.string()
    .refine((val) => cpf.isValid(val), "CPF inválido"),
  mobile_phone: z.string()
    .min(10, "Telefone inválido")
    .max(15, "Telefone muito longo"),
  email: z.string().email("E-mail inválido").optional().or(z.literal('')),
  gender: z.enum(['M', 'F', 'OTHER']),
  birth_date: z.string().optional().or(z.literal('')),
  voter_title: z.string().optional().or(z.literal('')),
  sus_card: z.string().optional().or(z.literal('')),
  responsible_user_id: z.string().optional().or(z.literal('')),
  is_leadership: z.boolean().default(false),
  leadership_type: z.enum(['COMMUNITY', 'RELIGIOUS', 'SPORTS', 'UNION', 'OTHER', 'NONE']).default('NONE'),
  notes: z.string().optional(),
  address: z.object({
    zip_code: z.string().min(8, "CEP inválido"),
    street: z.string().min(3, "Rua é obrigatória"),
    number: z.string().min(1, "Nº é obrigatório"),
    complement: z.string().optional().or(z.literal('')),
    neighborhood: z.string().min(2, "Bairro é obrigatório"),
    city: z.string().min(2, "Cidade é obrigatória"),
    state: z.string().length(2, "UF deve ter 2 letras"),
  })
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
