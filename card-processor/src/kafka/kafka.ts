import { Kafka, Producer, Consumer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'card-processor',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

let producer: Producer | null = null;
let consumer: Consumer | null = null;

export async function getKafkaProducer(): Promise<Producer> {
  if (!producer) {
    producer = kafka.producer();
    try {
      await producer.connect();
      console.log('[card-processor] Kafka producer connected');
    } catch (error) {
      console.error('[card-processor] Error connecting Kafka producer', error);
      throw error;
    }
  }
  return producer;
}

export async function getKafkaConsumer(): Promise<Consumer> {
  if (!consumer) {
    const groupId = process.env.KAFKA_GROUP_ID || 'card-processor-group';
    consumer = kafka.consumer({ groupId });
    try {
      await consumer.connect();
      console.log(
        `[card-processor] Kafka consumer connected (groupId=${groupId})`,
      );
    } catch (error) {
      console.error('[card-processor] Error connecting Kafka consumer', error);
      throw error;
    }
  }
  return consumer;
}
