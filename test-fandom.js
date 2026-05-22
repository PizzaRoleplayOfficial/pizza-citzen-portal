const query = '2025 Audi RS 6 Avant';
const url = `https://greenville.fandom.com/api.php?action=query&prop=pageimages&titles=${encodeURIComponent(query)}&format=json&pithumbsize=500`;

fetch(url)
  .then(r => r.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(console.error);
