
import type { Client, Service, Account } from './types';

export const mockClients: Client[] = [
  {
    codigo_cliente: 'CLI001',
    nome_completo: 'Construtora Alfa',
    rg: '12.345.678-9',
    cpf_cnpj: '12.345.678/0001-90',
    telefone: '(11) 98765-4321',
    endereco_residencial: {
      street: 'Av. Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zip: '01310-100',
    },
    endereco_obra: {
      street: 'Rua da Consolação',
      number: '2000',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      zip: '01302-001',
    },
    coordenadas: {
      lat: -23.5613,
      lng: -46.6565,
    },
    numero_art: 'ART123456',
    historico_servicos: ['SRV001', 'SRV003'],
  },
  {
    codigo_cliente: 'CLI002',
    nome_completo: 'João da Silva',
    rg: '98.765.432-1',
    cpf_cnpj: '123.456.789-00',
    telefone: '(21) 91234-5678',
    endereco_residencial: {
      street: 'Av. Copacabana',
      number: '500',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zip: '22020-001',
    },
    endereco_obra: {
      street: 'Av. Copacabana',
      number: '500',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zip: '22020-001',
    },
    coordenadas: {
      lat: -22.9697,
      lng: -43.1868,
    },
    numero_art: 'ART654321',
    historico_servicos: ['SRV002'],
  },
];

export const mockServices: Service[] = [
  {
    id: 'SRV001',
    descricao: 'Projeto Estrutural Edifício Comercial',
    cliente_id: 'CLI001',
    prazo: '2024-12-31',
    valor: 50000,
    status: 'em andamento',
  },
  {
    id: 'SRV002',
    descricao: 'Laudo Técnico Residencial',
    cliente_id: 'CLI002',
    prazo: '2024-08-30',
    valor: 2500,
    status: 'concluído',
  },
  {
    id: 'SRV003',
    descricao: 'Consultoria de Fundações',
    cliente_id: 'CLI001',
    prazo: '2024-09-15',
    valor: 15000,
    status: 'em andamento',
  },
  {
    id: 'SRV004',
    descricao: 'Acompanhamento de Obra',
    cliente_id: 'CLI002',
    prazo: '2025-06-30',
    valor: 30000,
    status: 'em andamento',
  },
];

export const mockAccountsPayable: Account[] = [
    { id: 'PAY001', descricao: 'Aluguel do escritório', referencia_id: 'Imobiliária Central', valor: 3500, vencimento: '2024-08-05', status: 'pago'},
    { id: 'PAY002', descricao: 'Software de engenharia (Anual)', referencia_id: 'AutoDesk', valor: 8000, vencimento: '2024-08-10', status: 'pendente'},
    { id: 'PAY003', descricao: 'Fornecedor de material', referencia_id: 'Aço Forte Ltda', valor: 12500, vencimento: '2024-08-20', status: 'pendente'},
];

export const mockAccountsReceivable: Account[] = [
    { id: 'REC001', descricao: 'Entrada Projeto Estrutural', referencia_id: 'CLI001', valor: 25000, vencimento: '2024-07-15', status: 'recebido'},
    { id: 'REC002', descricao: 'Pagamento Laudo Técnico', referencia_id: 'CLI002', valor: 2500, vencimento: '2024-08-25', status: 'pendente'},
    { id: 'REC003', descricao: 'Parcela 1/3 Consultoria', referencia_id: 'CLI001', valor: 5000, vencimento: '2024-08-30', status: 'pendente'},
];
