/**
 * Redis connection management for the queue system
 */

import Redis from 'ioredis';
import { QueueConfig } from './types';
import { defaultQueueConfig } from './config';

export class RedisConnection {
  private static instance: RedisConnection;
  private client: Redis | null = null;
  private config: QueueConfig;

  private constructor(config: QueueConfig = defaultQueueConfig) {
    this.config = config;
  }

  /**
   * Get singleton instance of RedisConnection
   */
  public static getInstance(config?: QueueConfig): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection(config);
    }
    return RedisConnection.instance;
  }

  /**
   * Initialize Redis connection
   */
  public async connect(): Promise<Redis> {
    if (this.client && this.client.status === 'ready') {
      return this.client;
    }

    try {
      const redisOptions: any = {
        host: this.config.redis.host,
        port: this.config.redis.port,
        db: this.config.redis.db,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000
      };

      if (this.config.redis.password) {
        redisOptions.password = this.config.redis.password;
      }

      this.client = new Redis(redisOptions);

      // Set up event listeners
      this.client.on('connect', () => {
        console.log('Redis connection established');
      });

      this.client.on('ready', () => {
        console.log('Redis connection ready');
      });

      this.client.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      this.client.on('close', () => {
        console.log('Redis connection closed');
      });

      this.client.on('reconnecting', () => {
        console.log('Redis reconnecting...');
      });

      // Connect to Redis
      await this.client.connect();
      
      // Test the connection
      await this.client.ping();
      
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw new Error(`Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the Redis client instance
   */
  public getClient(): Redis {
    if (!this.client || this.client.status !== 'ready') {
      throw new Error('Redis client is not connected. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  public isConnected(): boolean {
    return this.client !== null && this.client.status === 'ready';
  }

  /**
   * Get Redis connection status
   */
  public getStatus(): string {
    return this.client ? this.client.status : 'disconnected';
  }

  /**
   * Test Redis connection with ping
   */
  public async ping(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping failed:', error);
      return false;
    }
  }

  /**
   * Get Redis server info
   */
  public async getInfo(): Promise<Record<string, string>> {
    try {
      const client = this.getClient();
      const info = await client.info();
      
      // Parse info string into object
      const infoObj: Record<string, string> = {};
      info.split('\r\n').forEach(line => {
        if (line && !line.startsWith('#') && line.includes(':')) {
          const [key, value] = line.split(':');
          if (key && value !== undefined) {
            infoObj[key] = value;
          }
        }
      });
      
      return infoObj;
    } catch (error) {
      console.error('Failed to get Redis info:', error);
      throw error;
    }
  }

  /**
   * Close Redis connection
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.client = null;
        console.log('Redis connection closed gracefully');
      } catch (error) {
        console.error('Error closing Redis connection:', error);
        // Force disconnect if graceful quit fails
        if (this.client) {
          this.client.disconnect();
        }
        this.client = null;
      }
    }
  }

  /**
   * Reset the singleton instance (mainly for testing)
   */
  public static reset(): void {
    if (RedisConnection.instance) {
      RedisConnection.instance.disconnect();
      RedisConnection.instance = null as any;
    }
  }
}