export class Session {
  #data = new Map();

  constructor(data = {}) {
    this.#data = new Map(Object.entries(data));
  }

  get data() {
    return Object.fromEntries(this.#data);
  }

  set(key: string, value: string) {
    this.#data.set(key, value);

    return this;
  }

  get(key: string) {
    return this.#data.get(key);
  }

  has(key: string) {
    return this.#data.has(key);
  }

  clear() {
    this.#data.clear();
    return this;
  }

  // TODO
  flash() {}

  // TODO
  destroy() {}
}
