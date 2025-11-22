import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'card-processor',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'card-processor-group' });

async function start() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'io.card.requested.v1', fromBeginning: true });

  console.log('card-processor listening to io.card.requested.v1');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value?.toString();
      console.log({ topic, partition, value });
      // Aquí luego metes tu lógica de reintentos/emitir tarjeta
    },
  });
}

start().catch((err) => {
  console.error('Error starting card-processor', err);
  process.exit(1);
});
