export interface FigmaConfig {
  accessToken?: string;
  teamId?: string;
  outputMode: 'newFile' | 'existingFile';
  fileName?: string;
}

export interface CaptureResponse {
  captureId: string;
  status: 'pending' | 'completed' | 'failed';
  figmaUrl?: string;
  error?: string;
}

export interface ServerConfig {
  port: number;
  directory: string;
}
