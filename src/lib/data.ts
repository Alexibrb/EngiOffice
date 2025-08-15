import type { Client, Service, Account } from './types';

export const mockClients: Client[] = [
  {
    id: 'CLI001',
    name: 'Construtora Alfa',
    rg: '12.345.678-9',
    cpfCnpj: '12.345.678/0001-90',
    phone: '(11) 98765-4321',
    address: {
      street: 'Av. Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zip: '01310-100',
    },
    workAddress: {
      street: 'Rua da Consolação',
      number: '2000',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      zip: '01302-001',
    },
    geo: {
      lat: -23.5613,
      lng: -46.6565,
    },
    art: 'ART123456',
    serviceHistory: ['SRV001', 'SRV003'],
  },
  {
    id: 'CLI002',
    name: 'João da Silva',
    rg: '98.765.432-1',
    cpfCnpj: '123.456.789-00',
    phone: '(21) 91234-5678',
    address: {
      street: 'Av. Copacabana',
      number: '500',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zip: '22020-001',
    },
    workAddress: {
      street: 'Av. Copacabana',
      number: '500',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zip: '22020-001',
    },
    geo: {
      lat: -22.9697,
      lng: -43.1868,
    },
    art: 'ART654321',
    serviceHistory: ['SRV002'],
  },
];

export const mockServices: Service[] = [
  {
    id: 'SRV001',
    description: 'Projeto Estrutural Edifício Comercial',
    clientId: 'CLI001',
    deadline: '2024-12-31',
    value: 50000,
    status: 'em andamento',
  },
  {
    id: 'SRV002',
    description: 'Laudo Técnico Residencial',
    clientId: 'CLI002',
    deadline: '2024-08-30',
    value: 2500,
    status: 'concluído',
  },
  {
    id: 'SRV003',
    description: 'Consultoria de Fundações',
    clientId: 'CLI001',
    deadline: '2024-09-15',
    value: 15000,
    status: 'em andamento',
  },
  {
    id: 'SRV004',
    description: 'Acompanhamento de Obra',
    clientId: 'CLI002',
    deadline: '2025-06-30',
    value: 30000,
    status: 'em andamento',
  },
];

export const mockAccountsPayable: Account[] = [
    { id: 'PAY001', description: 'Aluguel do escritório', party: 'Imobiliária Central', value: 3500, date: '2024-08-05', status: 'pago'},
    { id: 'PAY002', description: 'Software de engenharia (Anual)', party: 'AutoDesk', value: 8000, date: '2024-08-10', status: 'pendente'},
    { id: 'PAY003', description: 'Fornecedor de material', party: 'Aço Forte Ltda', value: 12500, date: '2024-08-20', status: 'pendente'},
];

export const mockAccountsReceivable: Account[] = [
    { id: 'REC001', description: 'Entrada Projeto Estrutural', party: 'Construtora Alfa', value: 25000, date: '2024-07-15', status: 'recebido'},
    { id: 'REC002', description: 'Pagamento Laudo Técnico', party: 'João da Silva', value: 2500, date: '2024-08-25', status: 'pendente'},
    { id: 'REC003', description: 'Parcela 1/3 Consultoria', party: 'Construtora Alfa', value: 5000, date: '2024-08-30', status: 'pendente'},
];
