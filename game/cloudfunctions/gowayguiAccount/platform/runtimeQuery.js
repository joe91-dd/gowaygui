"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtimeQuery = runtimeQuery;
const EMPTY_QUERY = { get: () => null, has: () => false };
function runtimeQuery() {
    if (typeof location === 'undefined' || typeof URLSearchParams !== 'function')
        return EMPTY_QUERY;
    return new URLSearchParams(location.search);
}
