// Se carga de forma síncrona en <head> para aplicar el tema guardado antes de pintar
// (evita el destello de tema incorrecto). Oscuro por defecto.
(function () {
  var theme = 'dark';
  try {
    if (JSON.parse(localStorage.getItem('mss.theme')) === 'light') theme = 'light';
  } catch (e) { /* almacenamiento no disponible: se queda oscuro */ }
  document.documentElement.dataset.theme = theme;
})();
