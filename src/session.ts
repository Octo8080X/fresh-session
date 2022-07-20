export class Session {
  #data = new Map();
  #oldFlash = new Map();
  #newFlash = new Map();

  constructor(data = {}, flash = {}) {
    this.#data = new Map(Object.entries(data));
    this.#oldFlash = new Map(Object.entries(flash));
  }

  get data() {
    return Object.fromEntries(this.#data);
  }

  get newFlash() {
    return Object.fromEntries(this.#newFlash);
  }

  all() {
    return new Map([...this.#data, ...this.#oldFlash, ...this.#newFlash]);
  }

  set(key: string, value: string) {
    this.#data.set(key, value);
    return this;
  }

  get(key: string) {
    return this.all().get(key);
  }

  has(key: string) {
    return this.all().has(key);
  }

  clear() {
    this.#data.clear();
    this.#oldFlash.clear();
    return this;
  }

  flash(key: string, value: string) {
    this.#newFlash.set(key, value);
    return this;
  }
}
