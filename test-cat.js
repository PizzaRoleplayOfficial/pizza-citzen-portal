const url = 'https://greenville.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Vehicles&cmlimit=500&format=json';
fetch(url).then(r=>r.json()).then(d=>console.log(d.query.categorymembers.length, 'vehicles found. Sample:', d.query.categorymembers.slice(0,3)));
