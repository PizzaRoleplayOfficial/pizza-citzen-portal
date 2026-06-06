// Test Google Transliterate API
// Path: scratch/test_transliterate.cjs

async function test() {
  const text = 'とよた';
  const url = `https://www.google.com/transliterate?langpair=ja-Hira|ja&text=${encodeURIComponent(text)}`;
  console.log('Fetching:', url);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
