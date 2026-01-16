export interface ActionLog {
  id: string;
  type: 'booking' | 'ticket' | 'info' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  details?: any;
  emailDraft?: {
    recipient: string;
    subject: string;
    body: string;
  };
  status?: 'pending' | 'sending' | 'success' | 'error';
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface AudioVisualizerState {
  volume: number;
  isSpeaking: boolean;
}