import { createMessageBatcher } from '../batcher';
import type { Message, MessageBatcher, MessageProcessor } from '../types';

describe('MessageBatcher', () => {
  let mockProcessor: MessageProcessor;
  let processedMessages: Message[];
  let batcher: MessageBatcher;

  beforeEach(() => {
    processedMessages = [];
    mockProcessor = {
      name: 'mock',
      processBatch: jest.fn(async (messages) => {
        processedMessages = messages;
      }),
    };
  });

  afterEach(() => {
    if (batcher) {
      batcher.destroy();
    }
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should process messages with concurrent processors', async () => {
    const processBatchSpy = jest.fn();
    const extraProcessor = {
      name: 'extra',
      processBatch: processBatchSpy,
    };

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
      concurrentProcessors: 2,
    });

    batcher.addExtraProcessor(extraProcessor);
    batcher.info('test message');
    await batcher.flush();

    expect(processBatchSpy).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test message',
        level: 'info',
        error: undefined,
      },
    ]);
    expect(mockProcessor.processBatch).toHaveBeenCalledWith([
      {
        chatId: 'default',
        text: 'test message',
        level: 'info',
        error: undefined,
      },
    ]);
    batcher.removeExtraProcessor(extraProcessor);
  });

  it('should handle info messages correctly', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.info('Test info message');
    await batcher.flush();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0]).toEqual({
      chatId: 'default',
      text: 'Test info message',
      level: 'info',
    });
  });

  it('should handle warning messages correctly', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.warning('Test warning message');
    await batcher.flush();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0]).toEqual({
      chatId: 'default',
      text: 'Test warning message',
      level: 'warning',
    });
  });

  it('should handle error messages correctly', async () => {
    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const testError = new Error('Test error occurred');
    batcher.error('Test error message', testError);
    await batcher.flush();

    expect(processedMessages).toHaveLength(1);
    expect(processedMessages[0]).toEqual({
      chatId: 'default',
      text: 'Test error message',
      level: 'error',
      error: testError,
    });
  });

  it('should handle processor removal', async () => {
    const extraProcessor = {
      name: 'extra',
      processBatch: jest.fn(),
    };

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addExtraProcessor(extraProcessor);
    batcher.info('test message');
    await batcher.flush();

    expect(extraProcessor.processBatch).toHaveBeenCalled();

    batcher.removeExtraProcessor(extraProcessor);
    batcher.info('another message');
    await batcher.flush();

    expect(extraProcessor.processBatch).toHaveBeenCalledTimes(1);
  });


  it('should handle processor removal with invalid name', async () => {
    const invalidProcessor = {
      name: 'invalid',
      processBatch: jest.fn(),
    };

    batcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    // Should log error and not remove processor
    batcher.removeExtraProcessor(invalidProcessor);
    expect(invalidProcessor.processBatch).not.toHaveBeenCalled();
  });

  it('should process batch when maxBatchSize is reached', async () => {
    const processBatchSpy = jest.fn();
    const testProcessor = {
      name: 'mock',
      processBatch: processBatchSpy,
    };

    batcher = createMessageBatcher([testProcessor], {
      maxBatchSize: 2,
      maxWaitMs: 1000,
    });

    // Add messages up to maxBatchSize
    batcher.info('message 1');
    batcher.info('message 2');

    // Wait for processing
    await new Promise(process.nextTick);
    await batcher.flush();

    expect(processBatchSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'message 1',
        }),
        expect.objectContaining({
          text: 'message 2',
        }),
      ])
    );
  }, 10000);

  it('should handle sync processor errors', async () => {
    const errorProcessor = {
      name: 'mock',
      processBatchSync: () => {
        throw new Error('Sync error');
      },
      processBatch: () => {
        throw new Error('Sync error');
      },
    };

    batcher = createMessageBatcher([errorProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const consoleSpy = jest.spyOn(console, 'error');
    batcher.info('test message');
    batcher.flushSync();

    expect(consoleSpy).toHaveBeenCalledWith(
      `Processor ${errorProcessor.name} failed:`,
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should handle async processor errors', async () => {
    const errorProcessor = {
      name: 'mock',
      processBatch: async () => {
        throw new Error('Async error');
      },
    };

    batcher = createMessageBatcher([errorProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const consoleSpy = jest.spyOn(console, 'error');
    batcher.info('test message');
    await batcher.flush();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Processor mock failed:',
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should handle batch processing errors', async () => {
    // resetGlobalBatcher();
    const errorProcessor = {
      name: 'error',
      processBatch: undefined as any,
    };

    batcher = createMessageBatcher([errorProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const consoleSpy = jest.spyOn(console, 'error');
    batcher.info('test message');
    await batcher.flush();

    expect(consoleSpy).toHaveBeenCalledWith(
      `Processor ${errorProcessor.name} failed:`,
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it('should handle multiple concurrent processors with different speeds', async () => {
    const slowProcessor = {
      name: 'processor1',
      processBatch: jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      }),
    };
    const fastProcessor = {
      name: 'processor2',
      processBatch: jest.fn().mockResolvedValue(undefined),
    };

    batcher = createMessageBatcher([slowProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    batcher.addExtraProcessor(fastProcessor);
    batcher.info('test message');
    await batcher.flush();

    expect(slowProcessor.processBatch).toHaveBeenCalled();
    expect(fastProcessor.processBatch).toHaveBeenCalled();
  });

  it('should reuse existing batcher instance', () => {
    const firstBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 5,
      maxWaitMs: 100,
    });

    const secondBatcher = createMessageBatcher([mockProcessor], {
      maxBatchSize: 10,
      maxWaitMs: 200,
    });

    expect(secondBatcher).toBe(firstBatcher);
  });
});
