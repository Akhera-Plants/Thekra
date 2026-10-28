/**
 * Side-effect module: import it first (app/_layout.tsx) so `globalThis.crypto.getRandomValues` exists before
 * practice-core's vault runs on Hermes.
 */
import * as ExpoCrypto from 'expo-crypto';
import { installGetRandomValues } from './random';

installGetRandomValues((array) => ExpoCrypto.getRandomValues(array));

/** A v4 UUID for plans and relatives (the server uses the client id as the primary key). */
export function newId(): string {
  return ExpoCrypto.randomUUID();
}
