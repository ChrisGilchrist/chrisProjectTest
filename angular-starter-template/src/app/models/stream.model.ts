export type StreamStatus = 'Open' | 'Closed' | 'Interrupted' | 'Unknown';

export interface Stream {
  streamId?: string;
  name?: string;
  topic?: string;
  createdAt?: Date;
  lastUpdate?: Date;
  timeOfRecording?: Date;
  dataStart?: number;
  dataEnd?: number;
  status?: StreamStatus;
  metadata?: Record<string, string>;
  parents?: string[];
  location?: string;
  softDeleteAt?: Date;
}
