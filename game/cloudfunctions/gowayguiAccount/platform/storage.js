"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStorage = exports.systemClock = void 0;
exports.systemClock = { now: () => Date.now() };
class MemoryStorage {
    constructor() {
        this.values = {};
    }
    getItem(key) { return this.values[key] ?? null; }
    setItem(key, value) { this.values[key] = value; }
}
exports.MemoryStorage = MemoryStorage;
