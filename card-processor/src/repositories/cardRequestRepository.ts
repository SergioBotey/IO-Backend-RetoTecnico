import { CardRequest, CardStatus, CardData } from '../domain/types';

class CardRequestRepository {
  private items = new Map<string, CardRequest>();

  //Crea o Actualiza una tarjeta por CardRequestID
  upsert(requestId: string, partial: Partial<CardRequest>): CardRequest {
    const existing = this.items.get(requestId);
    const now = new Date();

    const base: CardRequest =
      existing ??
      ({
        requestId,
        customer: partial.customer!,
        product: partial.product!,
        status: 'PENDING',
        attempts: partial.attempts ?? 0,
        createdAt: now,
        updatedAt: now,
      } as CardRequest);

    const merged: CardRequest = {
      ...base,
      ...partial,
      updatedAt: now,
    };

    this.items.set(requestId, merged);
    return merged;
  }

  updateStatus(
    requestId: string,
    status: CardStatus,
    options?: { cardData?: CardData; errorReason?: string },
  ): CardRequest | undefined {
    const existing = this.items.get(requestId);
    if (!existing) return undefined;

    const updated: CardRequest = {
      ...existing,
      status,
      cardData: options?.cardData ?? existing.cardData,
      errorReason: options?.errorReason ?? existing.errorReason,
      updatedAt: new Date(),
    };
    this.items.set(requestId, updated);
    return updated;
  }

  findByRequestId(requestId: string): CardRequest | undefined {
    return this.items.get(requestId);
  }
}

export const cardRequestRepository = new CardRequestRepository();
