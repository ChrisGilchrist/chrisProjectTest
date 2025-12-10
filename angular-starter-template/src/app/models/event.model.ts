export type EventLevel = 'Trace' | 'Debug' | 'Information' | 'Warning' | 'Error' | 'Critical';

export interface Event {
  eventId?: string;
  name?: string;
  description?: string;
  customProperties?: string;
  streamIds?: string[];
  level?: EventLevel;
  location?: string;
}

export interface QuixEvent {
  topicId: string;
  topicName: string;
  streamId: string;
  timestamp: number;
  tags: Record<string, unknown>;
  id: string;
  value: string;
}
