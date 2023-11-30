import type {
  AllowType,
  FlashData,
  Session,
  SessionData,
  SessionDuplicationData,
} from "./type.ts";

export function createSession<T extends string, F extends string>(
  { session, flash }: { session: SessionData<T>; flash: FlashData<F> },
): {
  session: Session<T, F>;
  getDuplicateDataFunction: { (): SessionDuplicationData<T, F> };
} {
  let sessionData: SessionData<T> = (session || {}) as SessionData<T>;
  const flashData: FlashData<F> = (flash || {}) as FlashData<F>;
  const newFlashData: FlashData<F> = {} as FlashData<F>;
  const operations = {
    doDestroy: false,
    doRotateKey: false,
  };

  let duplicateData: SessionDuplicationData<T, F> | null = null;

  const sessionObj: Session<T, F> = {
    get(key) {
      return sessionData[key];
    },
    set(key, value) {
      sessionData[key] = value;
      duplicateData = this.getRawData();
    },
    delete(key) {
      const { [key]: _removed, ...res } = sessionData;
      sessionData = res as SessionData<T>;
      duplicateData = this.getRawData();
    },
    list() {
      return sessionData;
    },
    destroy() {
      operations.doDestroy = true;
      duplicateData = this.getRawData();
    },
    rotateKey() {
      operations.doRotateKey = true;
      duplicateData = this.getRawData();
    },
    has(key) {
      return key in sessionData;
    },
    clear() {
      sessionData = {} as SessionData<T>;
      duplicateData = this.getRawData();
    },
    flash(key: F, value?: AllowType) {
      if (value === undefined) {
        return flashData[key];
      }
      newFlashData[key] = value;
      duplicateData = this.getRawData();
    },
    flashNow(key: F) {
      const value = { ...flashData, ...newFlashData }[key]!
      delete newFlashData[key];
      duplicateData = this.getRawData();
      return value;
    },
    getRawData() {
      return { session: sessionData, flash: newFlashData, operations };
    },
  };
  duplicateData = sessionObj.getRawData();

  return {
    session: sessionObj,
    getDuplicateDataFunction: () => {
      return duplicateData!;
    },
  };
}
