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
  id: string;
  name: string;
  rg: string;
  cpfCnpj: string;
  phone: string;
  address: Address;
  workAddress: Address;
  geo: Geo;
  art: string;
  serviceHistory: string[];
};

export type Supplier = {
  id: string;
  name: string;
  cnpj: string;
  address: string;
  phone: string;
  email: string;
  supplies: string[];
};

export type Employee = {
  id: string;
  name: string;
  cpf: string;
  role: string;
  phone: string;
  email: string;
  salary: number;
  status: 'ativo' | 'inativo';
};

export type Service = {
  id: string;
  description: string;
  clientId: string;
  deadline: string;
  value: number;
  status: 'em andamento' | 'concluído' | 'cancelado';
};

export type Account = {
    id: string;
    description: string;
    party: string; // Client or Supplier name
    value: number;
    date: string; // Due date or receive date
    status: 'pago' | 'pendente' | 'recebido';
}
