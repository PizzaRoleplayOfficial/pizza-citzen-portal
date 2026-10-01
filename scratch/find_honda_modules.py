import urllib.request
import re

url = "https://www.honda.co.jp/Nbox/new/configurator/__modules__.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    print(f"Downloading {url}...")
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        
    print(f"File: __modules__.js ({len(content)} characters)")
    
    # Save the file locally so we can analyze it if needed
    with open("c:/Users/keabu/OneDrive/ドキュメント/Antigravity/gv-vehicle-registry/scratch/honda_modules.js", "w", encoding="utf-8") as f:
        f.write(content)
    print("Saved __modules__.js locally.")
    
    # Let's search for script names or class definitions in PlayCanvas
    # E.g. pc.registerScript
    script_classes = re.findall(r'pc\.registerScript\(\s*[\'"]?(\w+)[\'"]?\s*\,', content)
    print(f"Total PlayCanvas script classes registered: {len(script_classes)}")
    print("First 30 script class names:")
    print(script_classes[:30])
    
    # Look for functions related to color, grade, option, assembly or visibility
    for keyword in ['grade', 'color', 'option', 'assembly', 'visible', 'switch', 'material', 'CLR_', 'GRD_']:
        matches = len(re.findall(keyword, content, re.IGNORECASE))
        print(f"Keyword '{keyword}' matches: {matches}")
        
except Exception as e:
    print("Error:", e)
