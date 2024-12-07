import {
  type Message,
  type BatcherConfig,
  type NotificationLevel,
  type MessageProcessor,
  type IMessageBatcher
} from './types';

export function createMessageBatcher(
  processors: MessageProcessor[],
  config: Required<BatcherConfig>
): IMessageBatcher {
  const queues: Map<string, Message[]> = new Map();
  const timers: Map<string, NodeJS.Timeout> = new Map();
  let processInterval: NodeJS.Timeout | null = null;

  function startProcessing(): void {
    processInterval = setInterval(() => {
      for (const chatId of queues.keys()) {
        processBatch(chatId);
      }
    }, config.maxWaitMs);
  }

  function info(message: string): void {
    queueMessage(message, 'info');
  }

  function warning(message: string): void {
    queueMessage(message, 'warning');
  }

  function error(message: string): void {
    queueMessage(message, 'error');
  }

  function queueMessage(message: string, level: NotificationLevel): void {
    const chatId = 'default';
    if (!queues.has(chatId)) {
      queues.set(chatId, []);
    }

    const queue = queues.get(chatId) ?? [];
    queue.push({ chatId, text: message, level });

    if (queue.length >= config.maxBatchSize) {
      processBatch(chatId);
    }
  }

  async function processBatch(chatId: string): Promise<void> {
    const queue = queues.get(chatId);
    if (!queue?.length) return;

    const batch = [...queue];
    queues.set(chatId, []);

    const results = await Promise.allSettled(
      processors.map((processor) => processor.processBatch(batch))
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Processor ${index} failed:`, result.reason);
      }
    });
  }

  async function flush(): Promise<void> {
    for (const chatId of queues.keys()) {
      await processBatch(chatId);
    }
  }

  function destroy(): void {
    if (processInterval) {
      clearInterval(processInterval);
      processInterval = null;
    }
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
    queues.clear();
  }

  // Start processing on creation
  startProcessing();

  // Return the public interface
  return {
    info,
    warning,
    error,
    queueMessage,
    flush,
    destroy
  };
}


