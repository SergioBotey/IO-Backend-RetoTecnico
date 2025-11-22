import { CardData } from '../domain/types';

export function generateCardData(requestId: string): CardData {
  return {
    cardId: `card_${requestId}`,
    cardNumber: generateCardNumber(),
    expirationDate: generateExpirationDate(),
    cvv: generateCvv(),
  };
}

function generateCardNumber(): string {
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

function generateExpirationDate(): string {
  const now = new Date();
  const year = now.getFullYear() + 3;
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function generateCvv(): string {
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}
