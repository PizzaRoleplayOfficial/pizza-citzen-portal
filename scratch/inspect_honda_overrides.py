import re

# Load the locally saved game scripts
with open("c:/Users/keabu/OneDrive/ドキュメント/Antigravity/gv-vehicle-registry/scratch/honda_game_scripts.js", "r", encoding="utf-8") as f:
    content = f.read()

# Find the definition of populateOverrideMaterials
pos = content.find("populateOverrideMaterials")
if pos != -1:
    print("--- populateOverrideMaterials snippet ---")
    # Print the function body
    print(content[pos:pos+2500])
else:
    print("populateOverrideMaterials not found.")
