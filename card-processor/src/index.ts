import { EachMessagePayload } from 'kafkajs';
import { getKafkaConsumer, getKafkaProducer } from './kafka/kafka';
import { cardRequestRepository } from './repositories/cardRequestRepository';
import { delay } from './utils/delay';
import { generateCardData } from './utils/generators';
import { CardRequestedEvent, CardIssuedEvent, CardRequestedDlqEvent } from './domain/events';

const REQUESTED_TOPIC = 'io.card.requested.v1';
const ISSUED_TOPIC = 'io.cards.issued.v1';
const DLQ_TOPIC = 'io.card.requested.v1.dlq';

const MAX_ATTEMPTS = 3;


function getBackoffMs(attempt: number): number {
  return 1000 * Math.pow(2, attempt);
}

// Simula la llamada al sistema externo
async function simulateExternalCall(event: CardRequestedEvent): Promise<boolean> {
  console.log(
    `[simulateExternalCall] simulateError=${event.product.simulateError} attempts=${event.attempts}`,
  );

  const baseDelay = 200 + Math.floor(Math.random() * 300);
  await delay(baseDelay);

  if (event.product.simulateError === true) {
    return false;
  }

  return Math.random() > 0.3;
}

async function handleMessage(payload: EachMessagePayload) {
  const { topic, partition, message } = payload;
  const rawValue = message.value?.toString();
  if (!rawValue) return;

  const event: CardRequestedEvent = JSON.parse(rawValue);
  const { requestId } = event;

  console.log(
    `[card-processor] Received message topic=${topic} 
    partition=${partition} requestId=${requestId} attempts=${event.attempts}`,
  );

  // Guardar/actualizar en repo
  cardRequestRepository.upsert(requestId, {
    requestId,
    customer: event.customer,
    product: event.product,
    attempts: event.attempts,
  });

  const success = await simulateExternalCall(event);
  const producer = await getKafkaProducer();

  if (success) {
    // Éxito: generar datos de tarjeta, actualizar estado y publicar evento de tarjeta emitida
    const cardData = generateCardData(requestId);

    cardRequestRepository.updateStatus(requestId, 'ISSUED', { cardData });

    const issuedEvent: CardIssuedEvent = {
      requestId,
      customer: event.customer,
      card: cardData,
      status: 'ISSUED',
      issuedAt: new Date().toISOString(),
    };

    await producer.send({
      topic: ISSUED_TOPIC,
      messages: [
        {
          key: requestId,
          value: JSON.stringify(issuedEvent),
        },
      ],
    });

    console.log(
      `[card-processor] Card issued for requestId=${requestId} cardNumber=${cardData.cardNumber}`,
    );
  } else {
    // Falla: decidir reintento o DLQ
    const currentAttempt = event.attempts;

    if (currentAttempt < MAX_ATTEMPTS) {
      const nextAttempt = currentAttempt + 1;
      const backoffMs = getBackoffMs(currentAttempt);

      console.log(
        `[card-processor] Failure for requestId=${requestId} attempt=${currentAttempt}. 
        Retrying in ${backoffMs}ms (nextAttempt=${nextAttempt})`,
      );

      setTimeout(async () => {
        const producerRetry = await getKafkaProducer();

        const retriedEvent: CardRequestedEvent = {
          ...event,
          attempts: nextAttempt,
        };

        await producerRetry.send({
          topic: REQUESTED_TOPIC,
          messages: [
            {
              key: requestId,
              value: JSON.stringify(retriedEvent),
            },
          ],
        });

        console.log(
          `[card-processor] Re-published requestId=${requestId} with attempts=${nextAttempt}`,
        );
      }, backoffMs);
    } else {
      console.log(
        `[card-processor] Max attempts reached for requestId=${requestId} attempts=${currentAttempt}. Sending to DLQ`,
      );

      const updated = cardRequestRepository.updateStatus(requestId, 'FAILED', {
        errorReason: 'Max retries exceeded',
      });

      console.log(
        `[card-processor] Status updated to FAILED for requestId=${requestId} (repoStatus=${updated?.status})`,
      );

      const dlqEvent: CardRequestedDlqEvent = {
        requestId,
        reason: 'Max retries exceeded',
        attempts: currentAttempt,
        originalPayload: event,
      };

      await producer.send({
        topic: DLQ_TOPIC,
        messages: [
          {
            key: requestId,
            value: JSON.stringify(dlqEvent),
          },
        ],
      });

      console.log(
        `[card-processor] DLQ message published for requestId=${requestId} attempts=${currentAttempt}`,
      );
    }
  }
}

async function start() {
  const consumer = await getKafkaConsumer();
  await consumer.subscribe({ topic: REQUESTED_TOPIC, fromBeginning: true });

  console.log(`[card-processor] Subscribed to ${REQUESTED_TOPIC}`);

  await consumer.run({
    eachMessage: async (payload) => {
      try {
        await handleMessage(payload);
      } catch (err) {
        console.error('[card-processor] Error processing message', err);
      }
    },
  });
}

start().catch((err) => {
  console.error('[card-processor] Fatal error', err);
  process.exit(1);
});
