

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
  endereco_obra: Address;
  coordenadas: Geo;
  numero_art: string;
  historico_servicos: string[];
};

export type Supplier = {
  id: string; 
  razao_social: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
  produtos_servicos: string[];
};

export type Employee = {
  id: string; 
  nome: string;
  cpf: string;
  cargo: string;
  telefone: string;
  email: string;
  status: 'ativo' | 'inativo';
};

export type Service = {
  id: string; 
  descricao: string;
  cliente_id: string;
  prazo: Date; 
  valor: number;
  status: 'em andamento' | 'concluído' | 'cancelado';
  anexos?: string[]; 
};

export type Account = {
    id: string;
    descricao: string;
    referencia_id: string; 
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

    