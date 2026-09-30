/* Datos de la portada. El contenido principal está escrito en index.html;
   esto solo alimenta las animaciones (partido de ejemplo del storytelling). */
(function () {
  "use strict";
  window.__BRAND__ = {
    name: "MultiSport Stats",
    story: {
      kickoff: "20:00",
      // Partido de ejemplo (demo-laliga-1 de data/matches.json): minuto y lado de cada evento.
      events: [
        { min: 12, type: "goal", side: "home" },
        { min: 34, type: "yellow", side: "away" },
        { min: 51, type: "goal", side: "away" },
        { min: 69, type: "goal", side: "home" }
      ]
    }
  };
})();
