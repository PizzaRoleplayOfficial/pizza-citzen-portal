import urllib.request
import json
import re

url_config = "https://www.honda.co.jp/Nbox/new/configurator/config.json"
req = urllib.request.Request(url_config, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        config = json.loads(response.read().decode('utf-8'))
        
    assets = config.get('assets', {})
    script_assets = []
    
    for aid, info in assets.items():
        if info.get('type') == 'script':
            file_info = info.get('file', {})
            if file_info and file_info.get('url'):
                script_assets.append({
                    'id': aid,
                    'name': info.get('name'),
                    'url': "https://www.honda.co.jp/Nbox/new/configurator/" + file_info.get('url')
                })
                
    print(f"Found {len(script_assets)} script assets in config.json")
    
    # Download each script and check for keyword occurrences
    target_keywords = ['car:color', 'car:grade', 'car:intcolor', 'car:option', 'CLR_', 'GRD_', 'visible', 'materialAssets']
    
    for sa in script_assets:
        try:
            req_sa = urllib.request.Request(sa['url'], headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req_sa) as res:
                code = res.read().decode('utf-8')
                
            found = []
            for kw in target_keywords:
                if kw in code:
                    found.append(kw)
            
            if found:
                print(f"Script: {sa['name']} (ID: {sa['id']}) -> {sa['url']}")
                print(f"  Keywords matched: {found}")
                # Print script size
                print(f"  Size: {len(code)} characters")
                # Look for registerScript name
                reg_match = re.search(r'pc\.registerScript\(\s*[\'"]?(\w+)[\'"]?', code)
                if reg_match:
                    print(f"  PlayCanvas Script Class: {reg_match.group(1)}")
                print("-" * 50)
                
        except Exception as e:
            # print(f"Error downloading {sa['name']}: {e}")
            pass
            
except Exception as e:
    print("Error:", e)
