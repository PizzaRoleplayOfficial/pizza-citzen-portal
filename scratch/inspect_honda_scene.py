import urllib.request
import json

url = "https://www.honda.co.jp/Nbox/new/configurator/2340401.json"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    print(f"Downloading scene JSON from {url}...")
    with urllib.request.urlopen(req) as response:
        # We can read in chunks or decode
        data_bytes = response.read()
    
    print(f"File size: {len(data_bytes) / 1024 / 1024:.2f} MB")
    
    scene = json.loads(data_bytes.decode('utf-8'))
    print("Scene root keys:", scene.keys())
    
    entities = scene.get('entities', {})
    print(f"Total entities in scene: {len(entities)}")
    
    # Save a small subset or info about entities having script components
    script_entities = []
    for ent_id, ent in entities.items():
        components = ent.get('components', {})
        if 'script' in components:
            scripts = components['script'].get('scripts', {})
            script_names = list(scripts.keys())
            script_entities.append({
                'id': ent_id,
                'name': ent.get('name'),
                'scripts': script_names
            })
            
    print(f"Total entities with script component: {len(script_entities)}")
    print("First 20 script entities and their script types:")
    for se in script_entities[:20]:
        print(f"  Entity: {se['name']} (ID: {se['id']}) -> Scripts: {se['scripts']}")
        
    # Let's save a local copy of 2340401.json
    with open("c:/Users/keabu/OneDrive/ドキュメント/Antigravity/gv-vehicle-registry/scratch/honda_scene.json", "w", encoding="utf-8") as f:
        json.dump(scene, f, indent=2)
    print("Saved scene JSON locally.")
    
except Exception as e:
    print("Error:", e)
