import { CardRequest } from '../domain/types';

class CardRequestRepository {
  private requests = new Map<string, CardRequest>(); 

  // Crea una nueva solicitud
  create(request: CardRequest): void {
    this.requests.set(request.requestId, request);
  }

  // Actualiza parcialmente una solicitud
  update(requestId: string, partial: Partial<CardRequest>): void {
    const existing = this.requests.get(requestId);
    if (!existing) return;

    const updated: CardRequest = {
      ...existing,
      ...partial,
      updatedAt: new Date(),
    };

    this.requests.set(requestId, updated);
  }

  findByRequestId(requestId: string): CardRequest | undefined {
    return this.requests.get(requestId);
  }

  // Devuelve una solicitud "activa"(ISSUED o PENDING) para el documento dado
  findIssuedByDocument(documentNumber: string): CardRequest | undefined {
    for (const req of this.requests.values()) {
      if (
        req.customer.documentNumber === documentNumber &&
        req.status != 'FAILED'
      ) {
        return req;
      }
    }
    return undefined;
  }
}

export const cardRequestRepository = new CardRequestRepository();
