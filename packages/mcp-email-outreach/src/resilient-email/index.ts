// Email queue with resilience
export {
  ResilientEmailQueue,
  InMemoryEmailQueueStorage,
  type EmailQueueStorage,
} from "./email-queue.js";

// Types
export {
  type EmailQueueEntry,
  type EmailQueueConfig,
  type EmailQueueStats,
  type EmailSendRequest,
  type BatchProcessResult,
  type EmailQueueStatus,
  EmailQueueEntrySchema,
  EmailQueueConfigSchema,
} from "./types.js";
