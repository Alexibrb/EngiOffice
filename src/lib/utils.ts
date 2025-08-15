
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCPF_CNPJ(value: string): string {
  const numericValue = value.replace(/\D/g, '');

  if (numericValue.length <= 11) {
    // Formato CPF: 000.000.000-00
    return numericValue
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14);
  } else {
    // Formato CNPJ: 00.000.000/0000-00
    return numericValue
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})/, '$1-$2')
      .slice(0, 18);
  }
}

export function formatTelefone(value: string): string {
    const numericValue = value.replace(/\D/g, '');
    const len = numericValue.length;

    if (len <= 10) {
        // Formato (00) 0000-0000
        return numericValue
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .slice(0, 14);
    } else {
        // Formato (00) 90000-0000
        return numericValue
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .slice(0, 15);
    }
}

export function formatCEP(value: string): string {
  const numericValue = value.replace(/\D/g, '');

  return numericValue
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 9);
}

export function formatCurrency(value: string): string {
  if (!value) return '';
  let numericValue = value.replace(/\D/g, '');

  if (numericValue === '') return '';

  // Pad with leading zeros if necessary
  numericValue = numericValue.padStart(3, '0');

  // Insert comma for decimals
  const integerPart = numericValue.slice(0, -2);
  const decimalPart = numericValue.slice(-2);
  
  let formattedIntegerPart = '';
  if (integerPart.length > 3) {
      formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  } else {
      formattedIntegerPart = integerPart;
  }
  
  if(formattedIntegerPart === '0' || formattedIntegerPart === '00') {
    formattedIntegerPart = '0';
  }


  return `${formattedIntegerPart},${decimalPart}`;
}
