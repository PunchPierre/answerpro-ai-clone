import { RetellWebClient } from 'retell-client-js-sdk';

interface RetellConfig {
  apiKey?: string;
}

class RetellService {
  private static instance: RetellService | null = null;
  private client: RetellWebClient | null = null;
  private apiKey: string;
  private initializationPromise: Promise<RetellWebClient> | null = null;

  private constructor(config: RetellConfig = {}) {
    // Get API key from config or environment
    const envApiKey = typeof window !== 'undefined' ? import.meta.env.VITE_RETELL_API_KEY : '';
    this.apiKey = config.apiKey || envApiKey || '';

    // Validate API key immediately
    if (!this.apiKey) {
      console.error('RetellAI API key is missing. Please set VITE_RETELL_API_KEY in your environment.');
    }
  }

  static getInstance(config: RetellConfig = {}): RetellService {
    if (!RetellService.instance) {
      RetellService.instance = new RetellService(config);
    }
    return RetellService.instance;
  }

  async getToken(agentId: string): Promise<string> {
    try {
      const response = await fetch('/api/retell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get token');
      }

      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Failed to get token:', error);
      throw error;
    }
  }

  async getClient(): Promise<RetellWebClient> {
    // Return existing initialization promise if it exists
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return existing client if it exists
    if (this.client) {
      return this.client;
    }

    if (!this.apiKey) {
      throw new Error('RetellAI API key is missing. Please set VITE_RETELL_API_KEY in your environment.');
    }

    // Create new initialization promise
    this.initializationPromise = new Promise<RetellWebClient>((resolve, reject) => {
      try {
        // Initialize client with API key
        const client = new RetellWebClient({
          apiKey: this.apiKey,
          enableDebugLog: true,
          getToken: (agentId: string) => this.getToken(agentId),
        });

        // Set up error handling
        client.on('error', (error: any) => {
          console.error('RetellAI client error:', error);
          this.resetClient();
        });

        // Set endpoint if provided
        const endpoint = typeof window !== 'undefined' ? import.meta.env.VITE_RETELL_ENDPOINT : undefined;
        if (endpoint) {
          console.log('Setting custom endpoint:', endpoint);
          client.setEndpoint(endpoint);
        }

        // Store the client and resolve the promise
        this.client = client;
        resolve(client);

        // Clear the initialization promise
        this.initializationPromise = null;

        console.log('RetellAI client initialized successfully');
      } catch (error) {
        console.error('Failed to initialize RetellAI client:', error);
        this.initializationPromise = null;
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  resetClient(): void {
    if (this.client) {
      try {
        this.client.stopCall().catch(console.error);
      } catch (error) {
        console.error('Error stopping call during reset:', error);
      }
      this.client = null;
      this.initializationPromise = null;
    }
  }

  // Validate API key without creating a client
  validateApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  // Get the current API key
  getApiKey(): string {
    return this.apiKey;
  }
}

// Export a singleton instance
export const retellService = RetellService.getInstance();

// Convenience function to get the client
export const getRetellClient = () => retellService.getClient();

// Convenience function to validate API key
export const validateRetellApiKey = () => retellService.validateApiKey();

// Types for the call state management
export interface TranscriptItem {
  role: 'assistant' | 'user';
  content: string;
  timestamp?: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

export type CallStatus = 'idle' | 'connecting' | 'active' | 'ended' | 'error';

export interface CallState {
  status: CallStatus;
  transcript: TranscriptItem[];
  error?: string;
  isMuted: boolean;
}