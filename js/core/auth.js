// Cuentas DEMO guardadas solo en este navegador (localStorage).
// La contraseña nunca se guarda en texto plano: se guarda un hash PBKDF2-SHA-256 con salt.
// Aun así NO es un sistema de seguridad real: cualquiera con acceso a este navegador
// puede ver o borrar los datos. No hay servidor ni verificación de correo.
import { read, write, session } from './store.js';

const ITERATIONS = 150000;
const enc = new TextEncoder();

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** crypto.subtle solo existe en contextos seguros (https o localhost). */
export function cryptoAvailable() {
  return Boolean(window.isSecureContext && window.crypto?.subtle);
}

async function hash(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toB64(bits);
}

const normEmail = (email) => email.trim().toLowerCase();

export async function register({ name, email, password }) {
  const users = read('users', {});
  const id = normEmail(email);
  if (users[id]) throw new Error('Ya existe una cuenta demo con ese correo en este navegador.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  users[id] = { name: name.trim(), salt: toB64(salt), hash: await hash(password, salt), created: Date.now() };
  write('users', users);
  session.set({ name: users[id].name, email: id });
}

export async function login({ email, password }) {
  const users = read('users', {});
  const id = normEmail(email);
  const user = users[id];
  // Mismo mensaje en ambos casos para no revelar qué correos existen.
  const fail = new Error('Correo o contraseña incorrectos.');
  if (!user) throw fail;
  if ((await hash(password, fromB64(user.salt))) !== user.hash) throw fail;
  session.set({ name: user.name, email: id });
}

export function deleteAccount(email) {
  const users = read('users', {});
  delete users[normEmail(email)];
  write('users', users);
  session.clear();
}
