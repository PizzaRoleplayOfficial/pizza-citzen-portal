import urllib.request
import json

url = "https://www.honda.co.jp/Nbox/new/configurator/config.json"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        config = json.loads(response.read().decode('utf-8'))
    
    print("Keys in config.json:", config.keys())
    
    assets = config.get('assets', {})
    print(f"Total assets: {len(assets)}")
    
    # Analyze asset types
    types = {}
    glb_assets = []
    for asset_id, info in assets.items():
        atype = info.get('type')
        types[atype] = types.get(atype, 0) + 1
        
        # Check if asset references a .glb or .gltf file
        file_info = info.get('file', {})
        if file_info:
            filename = file_info.get('filename', '')
            if filename.endswith('.glb') or filename.endswith('.gltf'):
                glb_assets.append((asset_id, info.get('name'), filename, file_info.get('url')))
                
    print("Asset types count:", types)
    print(f"Total GLB assets found: {len(glb_assets)}")
    print("\nFirst 15 GLB assets:")
    for idx, (aid, name, fn, f_url) in enumerate(glb_assets[:15]):
        print(f"  ID: {aid} | Name: {name} | Filename: {fn} | URL: {f_url}")
        
except Exception as e:
    print("Error:", e)
