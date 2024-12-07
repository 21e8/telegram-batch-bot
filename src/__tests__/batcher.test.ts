import { MessageBatcher } from '../batcher';
import type { Message, MessageProcessor } from '../types';

describe('MessageBatcher', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should batch messages within the time window', async () => {
    const processBatchMock = jest.fn();
    const mockProcessor: MessageProcessor = {
      processBatch: processBatchMock,
    };

    const batcher = MessageBatcher.create([mockProcessor], {
      maxBatchSize: 3,
      maxWaitMs: 1000,
    });

    const messages: Message[] = [
      { chatId: 'default', text: 'message1', level: 'info' },
      { chatId: 'default', text: 'message2', level: 'warning' },
    ];

    for (const msg of messages) {
      await batcher.queueMessage(msg.text, msg.level);
    }

    jest.advanceTimersByTime(1000);
    await Promise.resolve(); // Flush promises

    expect(processBatchMock).toHaveBeenCalledWith(messages);
  });

  // ... rest of your tests, updated to use jest timers
});
