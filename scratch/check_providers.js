const BASE_URL = 'https://api.themoviedb.org/3';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI1Njk2OWYyMWIzOGNhYTg0MjEwNWJlOTI3YjM2N2E2NSIsIm5iZiI6MTc3NjAzMzU1OC40ODQsInN1YiI6IjY5ZGMxZjE2NGVjZGE5YWU1MzAyNzlhNCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.qnfXLyz1h6LAN6zuitdt6kNb8ST0zfylphwnQGIZnGs';

async function checkProviders() {
  const response = await fetch(`${BASE_URL}/watch/providers/movie?watch_region=US`, {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`
    }
  });
  const data = await response.json();
  const top20 = data.results.slice(0, 50).map(p => ({ id: p.provider_id, name: p.provider_name }));
  console.log(JSON.stringify(top20, null, 2));
}

checkProviders();
