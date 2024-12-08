import { Message } from '../types';

import { MessageProcessor } from '../types';

export function createCustomProcessor({
  name,
  processBatch,
  processBatchSync,
}: {
  name: string;
  processBatch: (messages: Message[]) => Promise<void>;
  processBatchSync?: (messages: Message[]) => void;
}): MessageProcessor {
  return {
    name,
    processBatch: processBatch || processBatchSync,
    processBatchSync: processBatchSync || processBatch,
  };
}