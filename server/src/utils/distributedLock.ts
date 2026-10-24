import { SchedulerLock } from '../models/scheduler-lock.model';

export class DistributedLock {
  /**
   * Attempts to acquire an atomic distributed lock in MongoDB.
   * Safe for PM2 cluster mode with multiple worker processes.
   *
   * @param lockKey Unique identifier for the scheduled task
   * @param ttlSeconds Lock duration before automatic expiration (default 5 minutes)
   * @returns true if lock was acquired, false if held by another worker
   */
  public static async acquire(lockKey: string, ttlSeconds = 300): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const workerId = `${process.pid}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // 1. Try updating an expired existing lock
      const updated = await SchedulerLock.findOneAndUpdate(
        {
          lockKey,
          expiresAt: { $lt: now },
        },
        {
          $set: {
            lockedAt: now,
            lockedBy: workerId,
            expiresAt,
          },
        },
        { new: true },
      );

      if (updated) {
        return true;
      }

      // 2. Try inserting new lock if none exists
      await SchedulerLock.create({
        lockKey,
        lockedAt: now,
        lockedBy: workerId,
        expiresAt,
      });

      return true;
    } catch {
      // Mongo duplicate key error (code 11000) when another worker holds the lock
      return false;
    }
  }

  /**
   * Releases the distributed lock.
   */
  public static async release(lockKey: string): Promise<void> {
    try {
      await SchedulerLock.deleteOne({ lockKey });
    } catch {
      // Non-fatal
    }
  }
}
