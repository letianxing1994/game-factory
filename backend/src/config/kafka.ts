import { Kafka, Producer, Consumer } from 'kafkajs';
import logger from '../utils/logger';

let kafka: Kafka;
let producer: Producer;
const consumers: Consumer[] = [];

export async function connectKafka() {
  try {
    kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'game-factory-backend',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      retry: {
        retries: 5,
        initialRetryTime: 100,
        factor: 2
      }
    });

    producer = kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    await producer.connect();
    logger.info('Kafka生产者连接成功');

    // 创建必要的topic（如果不存在）
    const admin = kafka.admin();
    await admin.connect();
    
    const topics = [
      'user-events',
      'company-events',
      'agent-events',
      'market-events',
      'game-events',
      'workflow-events',
      'workflow-tasks',
      'workflow-results'
    ];

    const existingTopics = await admin.listTopics();
    const topicsToCreate = topics.filter(topic => !existingTopics.includes(topic));

    if (topicsToCreate.length > 0) {
      await admin.createTopics({
        topics: topicsToCreate.map(topic => ({
          topic,
          numPartitions: 3,
          replicationFactor: 1
        }))
      });
      logger.info(`创建Kafka topics: ${topicsToCreate.join(', ')}`);
    }

    await admin.disconnect();
    logger.info('Kafka连接成功');

  } catch (error) {
    logger.error('Kafka连接失败:', error);
    throw error;
  }
}

export const kafkaProducer = {
  async send(record: Parameters<Producer['send']>[0]) {
    if (!producer) {
      throw new Error('Kafka producer 尚未初始化');
    }
    return producer.send(record);
  }
};

export async function sendMessage(topic: string, message: any) {
  try {
    await kafkaProducer.send({
      topic,
      messages: [
        {
          key: `${topic}-${Date.now()}`,
          value: JSON.stringify({
            ...message,
            timestamp: new Date().toISOString()
          })
        }
      ]
    });
  } catch (error) {
    logger.error('Kafka发送消息失败:', { topic, message, error });
    throw error;
  }
}

export async function createConsumer(groupId: string, topics: string[], messageHandler: (message: any) => Promise<void>) {
  try {
    const consumer = kafka.consumer({ 
      groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 10000
    });

    await consumer.connect();
    for (const topic of topics) {
      await consumer.subscribe({ topic });
    }

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = JSON.parse(message.value?.toString() || '{}');
          await messageHandler(value);
        } catch (error) {
          logger.error('Kafka消息处理失败:', { topic, partition, message, error });
        }
      }
    });

    consumers.push(consumer);
    logger.info(`Kafka消费者创建成功: groupId=${groupId}, topics=${topics.join(',')}`);
    
    return consumer;
  } catch (error) {
    logger.error('Kafka消费者创建失败:', { groupId, topics, error });
    throw error;
  }
}

export async function disconnectKafka() {
  try {
    if (producer) {
      await producer.disconnect();
    }
    
    for (const consumer of consumers) {
      await consumer.disconnect();
    }
    
    logger.info('Kafka连接已关闭');
  } catch (error) {
    logger.error('Kafka断开连接失败:', error);
  }
}

export { kafka, producer };