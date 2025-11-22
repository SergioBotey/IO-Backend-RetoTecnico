export type CardStatus = 'PENDING' | 'ISSUED' | 'FAILED';

export interface Customer {
  documentType: string;      
  documentNumber: string;
  fullName: string;
  email: string;
  age: number;
}

export interface Product {
  type: 'VISA' | 'MASTERCARD';
  currency: 'PEN' | 'USD';
  simulateError: boolean; 
}

export interface CardRequest {
  requestId: string;
  customer: Customer;
  product: Product;
  status: CardStatus;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}
