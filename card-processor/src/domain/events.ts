import { Customer, Product, CardData } from './types';

export interface CardRequestedEvent {
  requestId: string;
  customer: Customer;
  product: Product;
  status: 'PENDING';
  attempts: number;
}

export interface CardIssuedEvent {
  requestId: string;
  customer: Customer;
  card: CardData;
  status: 'ISSUED';
  issuedAt: string; 
}

export interface CardRequestedDlqEvent {
  requestId: string;
  reason: string;
  attempts: number;
  originalPayload: CardRequestedEvent;
}
