// Lógica compartida de login.html y register.html (cuentas demo locales).
import { register, login, cryptoAvailable } from '../core/auth.js';
import { prefs } from '../core/store.js';
import { $, icon } from '../core/util.js';

const form = $('#authForm');
const message = $('#formMessage');
const mode = document.body.dataset.auth; // 'login' | 'register'

// Tema
const themeBtn = $('[data-action="theme"]');
function paintTheme() {
  const dark = prefs.theme === 'dark';
  themeBtn.innerHTML = icon(dark ? 'sun' : 'moon');
  themeBtn.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}
themeBtn.addEventListener('click', () => { prefs.setTheme(prefs.theme === 'dark' ? 'light' : 'dark'); paintTheme(); });
paintTheme();

// Mostrar / ocultar contraseña
form.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-toggle]');
  if (!btn) return;
  const input = document.getElementById(btn.dataset.toggle);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', String(show));
  btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  btn.innerHTML = icon(show ? 'eye-off' : 'eye');
});

function say(text, kind = 'error') {
  message.textContent = text;
  message.className = `form-message is-${kind}`;
}

function fieldError(input, text) {
  const out = document.getElementById(`${input.id}-error`);
  input.setAttribute('aria-invalid', String(Boolean(text)));
  if (out) out.textContent = text || '';
  return !text;
}

function validate() {
  let ok = true;
  const email = form.elements.email;
  ok = fieldError(email, email.validity.valid ? '' : 'Escribe un correo válido.') && ok;
  const pwd = form.elements.password;
  if (mode === 'register') {
    const name = form.elements.name;
    ok = fieldError(name, name.value.trim().length >= 2 ? '' : 'Escribe tu nombre (mínimo 2 letras).') && ok;
    ok = fieldError(pwd, pwd.value.length >= 8 ? '' : 'Usa al menos 8 caracteres.') && ok;
    const confirm = form.elements.confirm;
    ok = fieldError(confirm, confirm.value === pwd.value ? '' : 'Las contraseñas no coinciden.') && ok;
  } else {
    ok = fieldError(pwd, pwd.value ? '' : 'Escribe tu contraseña.') && ok;
  }
  return ok;
}

if (new URLSearchParams(location.search).has('salida')) say('Sesión cerrada.', 'success');

if (!cryptoAvailable()) {
  say('Abre la app desde un servidor local (http://localhost) o desde GitHub Pages para usar las cuentas demo.');
  form.querySelector('[type="submit"]').disabled = true;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validate()) {
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  say(mode === 'register' ? 'Creando cuenta demo…' : 'Comprobando…', 'success');
  try {
    const data = {
      name: form.elements.name?.value,
      email: form.elements.email.value,
      password: form.elements.password.value,
    };
    await (mode === 'register' ? register(data) : login(data));
    say('¡Listo! Entrando…', 'success');
    location.href = 'dashboard.html';
  } catch (err) {
    say(err.message);
    submit.disabled = false;
  }
});
