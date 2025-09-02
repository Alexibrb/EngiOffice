

export type Address = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
};

export type Geo = {
  lat: number;
  lng: number;
};

export type Client = {
  codigo_cliente: string;
  nome_completo: string;
  rg: string;
  cpf_cnpj: string;
  telefone: string;
  endereco_residencial: Address;
  numero_art: string;
  historico_servicos: string[];
};

export type Supplier = {
  id: string; 
  razao_social: string;
  nome: string; // Para unificação com Payee
  tipo: 'fornecedor';
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
  produtos_servicos: string[];
};

export type Employee = {
  id: string; 
  nome: string;
  tipo: 'funcionario';
  cpf: string;
  cargo: string;
  telefone: string;
  email: string;
  status: 'ativo' | 'inativo';
  tipo_contratacao: 'salario_fixo' | 'comissao';
  salario?: number;
  taxa_comissao?: number;
};

export type Service = {
  id: string;
  descricao: string;
  cliente_id: string;
  data_cadastro: Date;
  valor_total: number;
  valor_pago: number;
  saldo_devedor: number;
  forma_pagamento: 'a_vista' | 'a_prazo';
  status: 'em andamento' | 'concluído' | 'cancelado';
  anexos?: string[];
  lucro_distribuido?: boolean;
  endereco_obra: Address;
  coordenadas: Geo;
};

export type ServiceType = {
  id: string;
  descricao: string;
};

export type Account = {
    id: string;
    descricao: string;
    referencia_id: string; 
    tipo_referencia?: 'fornecedor' | 'funcionario';
    servico_id?: string;
    valor: number;
    vencimento: Date; 
    status: 'pago' | 'pendente';
}

export type Commission = {
  id: string;
  funcionario_id: string;
  cliente_id: string;
  servico_id: string;
  valor: number;
  data: Date;
  status: 'pendente' | 'pago';
};


export type CashFlow = {
  id: string;
  data: string; 
  tipo: 'entrada' | 'saida';
  descricao: string;
  valor: number;
  saldo: number;
}

export type Document = {
  id: string;
  tipo: string;
  referencia: string; 
  arquivo: string; 
  data: string;
}

export type City = {
  id: string;
  nome_cidade: string;
  estado: string;
};

// Tipo unificado para favorecidos (funcionários ou fornecedores)
export type Payee = (Employee | Supplier) & {
    id: string;
    nome: string;
    tipo: 'funcionario' | 'fornecedor';
};

export type CompanyData = {
  logoUrl?: string;
  companyName?: string;
  slogan?: string;
  cnpj?: string;
  address?: string;
  phone?: string;
  crea?: string;
};

export type AuthorizedUser = {
  id: string;
  email: string;
  role: 'admin' | 'user';
}
    