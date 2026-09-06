/**
 * How many characters a search waits for before it filters or hits the server.
 *
 * ⚠️ ONE constant, because this drifted. Clients, Pets, Register Pet, Inventory
 * and the Suppliers hub each hardcoded 3 while the newer pickers and every
 * backend search used 2 — so the same two letters found a drug but not a
 * client, with nothing on screen explaining the difference (user, 2026-09-06:
 * "all searches in app to wait for just 2 char only").
 *
 * Two is the floor worth having: one character matches most of the table and
 * is not a search, two is enough to be a real prefix.
 */
export const SEARCH_MIN_CHARS = 2;
