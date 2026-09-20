import { JSDOM } from "jsdom";
import jquery from "jquery";

export const NS = "breathe-and-live";
export const getProperty = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
export function setProperty(object, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  for (const key of keys) object = object[key] ??= {};
  object[last] = structuredClone(value);
}

export const hooks = new Map();
export async function fire(name, ...args) {
  for (const callback of hooks.get(name) ?? []) await callback(...args);
}

export class MockActor {
  constructor(id, system = {}, type = "slayer") {
    this.id = id;
    this.uuid = `Actor.${id}`;
    this.name = id;
    this.type = type;
    this._source = { system: structuredClone(system), flags: {} };
    this.items = Object.assign([], { contents: [] });
    this.owners = new Set(["player"]);
    this.updates = [];
    this.refresh();
  }
  get isOwner() { return game.user.isGM || this.owners.has(game.user.id); }
  testUserPermission(user) { return user.isGM || this.owners.has(user.id); }
  refresh() {
    this.system = structuredClone(this._source.system);
    this.flags = structuredClone(this._source.flags);
    this.prepareDerivedData();
  }
  prepareDerivedData() {}
  async update(update) {
    this.updates.push(structuredClone(update));
    for (const [key, value] of Object.entries(update)) setProperty(this._source, key, value);
    this.refresh();
    return this;
  }
  getFlag(namespace, key) { return this.flags[namespace]?.[key]; }
  async setFlag(namespace, key, value) { return this.update({ [`flags.${namespace}.${key}`]: value }); }
  async unsetFlag(namespace, key) {
    if (this._source.flags[namespace]) delete this._source.flags[namespace][key];
    this.refresh();
  }
}

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.$ = jquery(dom.window);
globalThis.foundry = { utils: {
  getProperty, setProperty, duplicate: structuredClone,
  hasProperty: (object, path) => getProperty(object, path) !== undefined,
  randomID: () => Math.random().toString(36).slice(2),
} };
globalThis.Actor = MockActor;
globalThis.ActorSheet = class {};
globalThis.ItemSheet = class {};
globalThis.CONFIG = { Actor: {} };
globalThis.Hooks = {
  on(name, callback) { hooks.set(name, [...(hooks.get(name) ?? []), callback]); },
  once(name, callback) { this.on(name, callback); },
};
export const gm = { id: "gm", active: true, isGM: true };
export const player = { id: "player", active: true, isGM: false };
export const observer = { id: "observer", active: true, isGM: false };
export const documents = new Map();
export const sockets = new Map();
export const emitted = [];
export const notifications = [];
globalThis.ui = {
  notifications: {
    warn: message => notifications.push(message),
    error: message => notifications.push(message),
  },
  chat: { updateMessage() {} },
};
globalThis.game = {
  user: gm,
  users: { activeGM: gm, get: id => [gm, player, observer].find(user => user.id === id) },
  settings: { get: () => false },
  actors: { contents: [], get(id) { return this.contents.find(actor => actor.id === id); } },
  messages: new Map(),
  socket: { on: (name, callback) => sockets.set(name, callback), emit: (name, payload) => emitted.push({ name, payload }) },
};
globalThis.canvas = { scene: { id: "scene" }, tokens: new Map(), grid: { size: 100 } };
globalThis.fromUuid = async uuid => documents.get(uuid);
export const chatMessages = [];
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ actor: actor.id }),
  async create(data) { chatMessages.push(data); return data; },
};
globalThis.Roll = class {
  constructor(formula) { this.formula = formula; this.total = /^\d+$/.test(formula) ? Number(formula) : 3; }
  async evaluate() { return this; }
};

export function tokenFor(actor, id = actor.id) {
  const token = { id, name: actor.name, actor, center: { x: 0, y: 0 } };
  canvas.tokens.set(id, token);
  documents.set(actor.uuid, actor);
  return token;
}

export function makeCombat(actors) {
  const entries = actors.map((actor, index) => ({ id: `c${index}`, actor }));
  entries.get = id => entries.find(entry => entry.id === id);
  return { id: "combat", round: 2, turn: 0, previous: { round: 1, turn: entries.length - 1, combatantId: entries.at(-1).id },
    combatants: entries, turns: entries, combatant: entries[0] };
}
