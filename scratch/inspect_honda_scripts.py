import urllib.request
import re

url = "https://www.honda.co.jp/Nbox/new/configurator/__game-scripts.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    print(f"Downloading {url}...")
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        
    print(f"File size: {len(content)} chars")
    
    # Save a local copy
    with open("c:/Users/keabu/OneDrive/ドキュメント/Antigravity/gv-vehicle-registry/scratch/honda_game_scripts.js", "w", encoding="utf-8") as f:
        f.write(content)
        
    # Search for pc.registerScript('overrideMaterials' ... or similar
    script_defs = re.findall(r'pc\.registerScript\(\s*[\'"]?(\w+)[\'"]?', content)
    print("Registered scripts inside __game-scripts.js:")
    print(script_defs)
    
    # Look for variable names or JSON-like object definitions that define grades/colors
    # e.g., mapping, spec, config, data
    # Let's search around "overrideMaterials" class
    pos = content.find("overrideMaterials")
    if pos != -1:
        print("\n--- Snippet around 'overrideMaterials' ---")
        print(content[pos:pos+1500])
        
    pos_switch = content.find("switchParts")
    if pos_switch != -1:
        print("\n--- Snippet around 'switchParts' ---")
        print(content[pos_switch:pos_switch+1500])
        
    pos_detail = content.find("detailSettings")
    if pos_detail != -1:
        print("\n--- Snippet around 'detailSettings' ---")
        print(content[pos_detail:pos_detail+1500])
        
except Exception as e:
    print("Error:", e)
