/**
 * Unit tests for RedisConnection class
 */

import { RedisConnection } from './redis-connection';
import { defaultQueueConfig } from './config';

// Mock ioredis
jest.mock('ioredis', () => {
  const mockRedis = {
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    info: jest.fn().mockResolvedValue('redis_version:6.2.0\r\nconnected_clients:1\r\n'),
    quit: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    on: jest.fn(),
    status: 'ready',
    options: {
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0
    }
  };

  return jest.fn(() => mockRedis);
});

describe('RedisConnection', () => {
  let redisConnection: RedisConnection;

  beforeEach(() => {
    // Reset singleton instance before each test
    RedisConnection.reset();
    redisConnection = RedisConnection.getInstance();
  });

  afterEach(() => {
    RedisConnection.reset();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = RedisConnection.getInstance();
      const instance2 = RedisConnection.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should use provided config', () => {
      const customConfig = {
        ...defaultQueueConfig,
        redis: {
          ...defaultQueueConfig.redis,
          host: 'custom-host'
        }
      };
      
      const instance = RedisConnection.getInstance(customConfig);
      expect(instance).toBeInstanceOf(RedisConnection);
    });
  });

  describe('connect', () => {
    it('should establish Redis connection successfully', async () => {
      const client = await redisConnection.connect();
      
      expect(client).toBeDefined();
      expect(client.connect).toHaveBeenCalled();
      expect(client.ping).toHaveBeenCalled();
    });

    it('should return existing client if already connected', async () => {
      const client1 = await redisConnection.connect();
      const client2 = await redisConnection.connect();
      
      expect(client1).toBe(client2);
    });

    it('should handle connection errors', async () => {
      const mockRedis = require('ioredis');
      const mockInstance = new mockRedis();
      mockInstance.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      await expect(redisConnection.connect()).rejects.toThrow('Redis connection failed');
    });
  });

  describe('getClient', () => {
    it('should return connected client', async () => {
      await redisConnection.connect();
      const client = redisConnection.getClient();
      
      expect(client).toBeDefined();
      expect(client.status).toBe('ready');
    });

    it('should throw error if not connected', () => {
      expect(() => redisConnection.getClient()).toThrow('Redis client is not connected');
    });
  });

  describe('isConnected', () => {
    it('should return true when connected', async () => {
      await redisConnection.connect();
      expect(redisConnection.isConnected()).toBe(true);
    });

    it('should return false when not connected', () => {
      expect(redisConnection.isConnected()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return connection status', async () => {
      expect(redisConnection.getStatus()).toBe('disconnected');
      
      await redisConnection.connect();
      expect(redisConnection.getStatus()).toBe('ready');
    });
  });

  describe('ping', () => {
    it('should return true for successful ping', async () => {
      await redisConnection.connect();
      const result = await redisConnection.ping();
      
      expect(result).toBe(true);
    });

    it('should return false for failed ping', async () => {
      const result = await redisConnection.ping();
      expect(result).toBe(false);
    });

    it('should handle ping errors', async () => {
      await redisConnection.connect();
      const client = redisConnection.getClient();
      (client.ping as jest.Mock).mockRejectedValueOnce(new Error('Ping failed'));
      
      const result = await redisConnection.ping();
      expect(result).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('should return parsed Redis info', async () => {
      await redisConnection.connect();
      const info = await redisConnection.getInfo();
      
      expect(info).toEqual({
        redis_version: '6.2.0',
        connected_clients: '1'
      });
    });

    it('should handle info errors', async () => {
      await redisConnection.connect();
      const client = redisConnection.getClient();
      (client.info as jest.Mock).mockRejectedValueOnce(new Error('Info failed'));
      
      await expect(redisConnection.getInfo()).rejects.toThrow('Info failed');
    });
  });

  describe('disconnect', () => {
    it('should close connection gracefully', async () => {
      await redisConnection.connect();
      const client = redisConnection.getClient();
      
      await redisConnection.disconnect();
      
      expect(client.quit).toHaveBeenCalled();
    });

    it('should force disconnect on quit failure', async () => {
      await redisConnection.connect();
      const client = redisConnection.getClient();
      (client.quit as jest.Mock).mockRejectedValueOnce(new Error('Quit failed'));
      
      await redisConnection.disconnect();
      
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await expect(redisConnection.disconnect()).resolves.not.toThrow();
    });
  });

  describe('reset', () => {
    it('should reset singleton instance', async () => {
      const instance1 = RedisConnection.getInstance();
      await instance1.connect();
      
      RedisConnection.reset();
      
      const instance2 = RedisConnection.getInstance();
      expect(instance2).not.toBe(instance1);
    });
  });
});