// Deportes, ligas y navegación de la app.

export const SPORTS = {
  futbol: { id: 'futbol', name: 'Fútbol' },
  baloncesto: { id: 'baloncesto', name: 'Baloncesto' },
  tenis: { id: 'tenis', name: 'Tenis' },
  hockey: { id: 'hockey', name: 'Hockey' },
  f1: { id: 'f1', name: 'Fórmula 1' },
};

// espn: ruta de la API pública (no oficial) de ESPN. f1 usa Jolpica. Tenis solo tiene datos demo.
export const LEAGUES = {
  laliga: { id: 'laliga', name: 'La Liga', short: 'La Liga', sport: 'futbol', espn: 'soccer/esp.1' },
  premier: { id: 'premier', name: 'Premier League', short: 'Premier', sport: 'futbol', espn: 'soccer/eng.1' },
  nba: { id: 'nba', name: 'NBA', short: 'NBA', sport: 'baloncesto', espn: 'basketball/nba' },
  rolandgarros: { id: 'rolandgarros', name: 'Roland Garros', short: 'Roland Garros', sport: 'tenis' },
  nhl: { id: 'nhl', name: 'NHL', short: 'NHL', sport: 'hockey', espn: 'hockey/nhl' },
  f1: { id: 'f1', name: 'Fórmula 1', short: 'F1', sport: 'f1', jolpica: true },
};

export const NAV = [
  { page: 'dashboard', href: 'dashboard.html', label: 'Inicio', icon: 'home' },
  { page: 'live', href: 'live.html', label: 'Partidos', icon: 'live' },
  { page: 'standings', href: 'standings.html', label: 'Tablas', icon: 'table' },
  { page: 'news', href: 'news.html', label: 'Noticias', icon: 'news' },
  { page: 'highlights', href: 'highlights.html', label: 'Resúmenes', icon: 'play' },
  { page: 'search', href: 'search.html', label: 'Buscar', icon: 'search' },
  { group: 'Tu espacio' },
  { page: 'profile', href: 'profile.html', label: 'Mi perfil', icon: 'user' },
  { page: 'about', href: 'about.html', label: 'Acerca de', icon: 'info' },
];

export const DEMO_TEXT =
  'Datos de demostración: ejemplos de muestra, no resultados en tiempo real.';
