// https://github.com/smikhalevski/object-pool

/**
 * The array-backed object pool implementation.
 *
 * @see https://en.wikipedia.org/wiki/Object_pool_pattern Object pool pattern
 */
export class ObjectPool<T> {

  private _cache: Array<T> = [];
  private _cursor = 0;
  private _factory;
  private _reset;
  private _allocChunkSize;
  private _capacity;

  /**
   * Creates the new {@link ObjectPool} instance.
   *
   * @param factory The factory that produces new values.
   * @param reset The callback that is invoked when value is returned to the pool via {@link release}.
   */
  public constructor(factory: () => T, capacity = 0, allocChunkSize = 100, reset?: (value: T) => void) {
    this._factory = factory;
    this._reset = reset;
    this._capacity = capacity;
    this._allocChunkSize = allocChunkSize;
  }

  /**
   * Returns the next value from the pool. If there's no value available then the factory is called to produce a new
   * value which is added to the pool.
   */
  public take(): T | undefined {
    const {_cache, _cursor, _capacity, _allocChunkSize} = this;

    if (_cursor === _cache.length) {
      // this.allocate(_cache.length || 5);
      let allocChunkSize = _allocChunkSize;
      if ((_capacity > 0) && (allocChunkSize + _cache.length > _capacity)) {
        allocChunkSize = _capacity - _cache.length;
      }

      if (allocChunkSize === 0) {
        return undefined;
      }
      
      this.allocate(allocChunkSize);
    }

    const value = _cache[_cursor];
    _cache[this._cursor++] = null as unknown as T;
    return value;
  }

  /**
   * Returns a value to the pool so it can be retrieved using {@link ObjectPool.take}. There's no check that value was
   * already returned to the pool and no check that value was in the pool previously. So ensure you don't release the
   * same value twice or release a value that doesn't belong to the pool.
   */
  public release(value: T): void {
    const {_cache, _reset} = this;

    if (_reset) {
      _reset(value);
    }
    _cache[this._cursor === 0 ? _cache.length : --this._cursor] = value;
  }

  /**
   * Populates pool with new values produced by the factory.
   *
   * @param count The integer number of values to produce.
   */
  public allocate(count: number): void {
    const {_cache, _factory} = this;

    const prevLength = _cache.length;
    const nextLength = _cache.length += count;

    for (let i = prevLength; i < nextLength; i++) {
      _cache[i] = _factory();
    }
  }

  /**
   * Number of unused values remaining in pool.
   */
  public size(): number {
    return this._cache.length - this._cursor;
  }

  /**
   * Total number of values (used and unused) in pool.
   */
  public capacity(): number {
    return this._capacity;
  }
}
