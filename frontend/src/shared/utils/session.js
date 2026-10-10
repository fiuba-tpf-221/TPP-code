const KEY = 'tpp.session.v2';

// Único lugar que toca el storage: si mañana pasan a cookies httpOnly, se cambia solo acá.
export const sessionStore = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch {
      return null;
    }
  },
  set(session) {
    localStorage.setItem(KEY, JSON.stringify(session));
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
