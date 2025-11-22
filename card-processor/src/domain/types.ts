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

export interface CardData {
  cardId: string;
  cardNumber: string;
  expirationDate: string;
  cvv: string;
}

export interface CardRequest {
  requestId: string;
  customer: Customer;
  product: Product;
  status: CardStatus;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
  cardData?: CardData; //Estos son los datos de la tarjeta cuando fue emitida
  errorReason?: string; //Este es la razon de fallo de la tarjeta
}
