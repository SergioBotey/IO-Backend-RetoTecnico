import { Kafka, Producer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'issuer-api',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

let producer: Producer | null = null;

export async function getKafkaProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer();
    try {
      await producer.connect();
      console.log('[issuer-api] Kafka producer connected');
    } catch (error) {
      console.error('[issuer-api] Error connecting Kafka producer', error);
      throw error;
    }
  }
  return producer;
}
