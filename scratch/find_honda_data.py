import urllib.request
import re

base_url = "https://www.honda.co.jp/Nbox/new/configurator/"

urls = [
    "__settings__.js",
    "scripts/canvas_ui.js",
    "__start__.js"
]

for filename in urls:
    url = base_url + filename
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        print(f"Downloading {url}...")
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
            
        print(f"File: {filename} ({len(content)} characters)")
        # Show first 300 characters
        print("  Preview:")
        print("\n".join("    " + line for line in content[:500].splitlines()))
        print("-" * 50)
        
        # Look for loaded json or variables in settings/canvas_ui
        json_matches = re.findall(r'[\w\-]+\.json', content)
        if json_matches:
            print(f"  Suspected JSON files referenced: {set(json_matches)}")
            
        # Look for Grade, Color, or Assembly keys
        for keyword in ['grade', 'color', 'option', 'assembly', 'specs', 'define', 'visible']:
            matches = list(re.finditer(keyword, content, re.IGNORECASE))
            if matches:
                print(f"  Keyword '{keyword}' found {len(matches)} times.")
                
        print("=" * 60)
    except Exception as e:
        print(f"Error for {filename}: {e}")
