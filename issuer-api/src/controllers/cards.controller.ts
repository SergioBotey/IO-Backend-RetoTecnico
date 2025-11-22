import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { cardIssueSchema } from '../validation/cardIssue.schema';
import { cardRequestRepository } from '../repositories/cardRequestRepository';
import { getKafkaProducer } from '../kafka/kafka';
import { CardRequest } from '../domain/types';

export const issueCard = async (req: Request, res: Response, next: NextFunction) => {
  try {

    //1) Validación con ZOD
    const parseResult = cardIssueSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: 'Payload inválido',
        errors: parseResult.error,
      });
    }

    const { customer, product } = parseResult.data;

    // 2) Validación "Solo puedo haber una tarjeta por cliente"
    const existingIssued = cardRequestRepository.findIssuedByDocument(
      customer.documentNumber,
    );
    if (existingIssued) {
      return res.status(409).json({
        message: 'El cliente ya tiene una tarjeta emitida',
        requestId: existingIssued.requestId,
      });
    }

    // 3) Creación de CardRequest en memoria
    const requestId = crypto.randomUUID();
    const now = new Date();

    const cardRequest: CardRequest = {
      requestId,
      customer,
      product,
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    cardRequestRepository.create(cardRequest);

    // 4) Publicar evento en Kafka
    const producer = await getKafkaProducer();

    const eventPayload = {
      requestId,
      customer,
      product,
      status: 'PENDING' as const,
      attempts: 0,
    };

    await producer.send({
      topic: 'io.card.requested.v1',
      messages: [
        {
          key: requestId,
          value: JSON.stringify(eventPayload),
        },
      ],
    });

    // 5) Respuesta HTTP 202 (asíncrono)
    return res.status(202).json({
      requestId,
      status: 'PENDING',
    });
  } catch (err) {
    next(err);
  }
};
