export interface ParameterData {
  topicId?: string;
  topicName?: string;
  streamId?: string;
  timestamps?: number[];
  numericValues?: Record<string, number[]>;
  stringValues?: Record<string, string[]>;
  binaryValues?: Record<string, string[]>;
  tagValues?: Record<string, string[]>;
}

export interface Data {
  timestamps?: number[];
  numericValues?: Record<string, number[]>;
  stringValues?: Record<string, string[]>;
  binaryValues?: Record<string, string[]>;
  tagValues?: Record<string, string[]>;
  events?: Record<string, string[]>;
}
