/**
 * Ring Buffer for event storage
 * Story 1.4 — WebSocket Server
 *
 * A bounded buffer that stores the most recent N events.
 * Older events are automatically evicted when capacity is reached.
 */

export interface TimestampedEvent {
  id: string;
  timestamp: string;
}

export class RingBuffer<T extends TimestampedEvent> {
  private events: T[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Add an event to the buffer.
   * If the buffer is full, the oldest event is evicted.
   */
  push(event: T): void {
    this.events.push(event);
    if (this.events.length > this.maxSize) {
      this.events.shift();
    }
  }

  /**
   * Get events since a specific timestamp.
   * Returns events with timestamp greater than the provided date.
   */
  getRecent(since: Date): T[] {
    return this.events.filter((e) => new Date(e.timestamp) > since);
  }

  /**
   * Get events since a specific event ID.
   * Returns all events after the event with the given ID.
   * If the event ID is not found, returns all events.
   */
  getSince(lastEventId: string): T[] {
    const index = this.events.findIndex((e) => e.id === lastEventId);
    if (index === -1) {
      // Event not found (possibly evicted), return all events
      return [...this.events];
    }
    // Return events after the found event
    return this.events.slice(index + 1);
  }

  /**
   * Get all events in the buffer.
   * Returns a copy to prevent external mutation.
   */
  getAll(): T[] {
    return [...this.events];
  }

  /**
   * Get the current size of the buffer.
   */
  size(): number {
    return this.events.length;
  }

  /**
   * Clear all events from the buffer.
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get the maximum capacity of the buffer.
   */
  capacity(): number {
    return this.maxSize;
  }
}
