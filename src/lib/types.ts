
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
  id: string; // Adicionado para consistencia
  razao_social: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  email: string;
  produtos_servicos: string[];
};

export type Employee = {
  id: string; // Adicionado para consistencia
  nome: string;
  cpf: string;
  cargo: string;
  telefone: string;
  email: string;
  salario: number;
  status: 'ativo' | 'inativo';
};

export type Service = {
  id: string; // Adicionado para consistencia
  descricao: string;
  cliente_id: string;
  prazo: string; // Mantido como string para simplicidade no mock
  valor: number;
  status: 'em andamento' | 'concluído' | 'cancelado';
  anexos?: string[]; // Adicionado campo
};

export type Account = {
    id: string;
    descricao: string;
    referencia_id: string; // ID do cliente ou fornecedor
    valor: number;
    vencimento: string; // Mantido como string
    status: 'pago' | 'pendente' | 'recebido';
}

export type CashFlow = {
  id: string;
  data: string; // Mantido como string
  tipo: 'entrada' | 'saida';
  descricao: string;
  valor: number;
  saldo: number;
}

export type Document = {
  id: string;
  tipo: string;
  referencia: string; // ID do cliente, servico, etc.
  arquivo: string; // URL ou path do arquivo
  data: string; // Mantido como string
}
