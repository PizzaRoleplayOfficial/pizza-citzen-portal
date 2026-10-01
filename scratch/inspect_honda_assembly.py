import json

with open("c:/Users/keabu/OneDrive/ドキュメント/Antigravity/gv-vehicle-registry/scratch/honda_scene.json", "r", encoding="utf-8") as f:
    scene = json.load(f)
    
entities = scene.get('entities', {})

switch_parts_entities = []
override_materials_entities = []

for ent_id, ent in entities.items():
    components = ent.get('components', {})
    if 'script' in components:
        scripts = components['script'].get('scripts', {})
        if 'switchParts' in scripts:
            switch_parts_entities.append((ent_id, ent.get('name'), scripts['switchParts']))
        if 'overrideMaterials' in scripts:
            override_materials_entities.append((ent_id, ent.get('name'), scripts['overrideMaterials']))

print(f"Entities with 'switchParts': {len(switch_parts_entities)}")
print(f"Entities with 'overrideMaterials': {len(override_materials_entities)}")

# Dump all unique category/event names that trigger part switching
categories = set()
for ent_id, name, data in switch_parts_entities:
    cat = data.get('attributes', {}).get('category')
    if cat:
        categories.add(cat)
print("\nUnique categories for switchParts:")
print(categories)

# Analyze first few switchParts entity structures
print("\n--- Example of switchParts entity details ---")
for ent_id, name, data in switch_parts_entities[:5]:
    attr = data.get('attributes', {})
    print(f"Entity: {name} (ID: {ent_id}) | Category: {attr.get('category')}")
    parts = attr.get('parts', [])
    print(f"  Parts list ({len(parts)} items):")
    for item in parts:
        # Resolve entity IDs to names for readability
        entities_list = [entities.get(eid, {}).get('name', eid) for eid in item.get('entities', [])]
        print(f"    Name: {item.get('name')} -> Entities: {entities_list}")
    print("-" * 50)

# Analyze overrideMaterials
if override_materials_entities:
    print("\n--- overrideMaterials entity details ---")
    for ent_id, name, data in override_materials_entities:
        attr = data.get('attributes', {})
        print(f"Entity: {name} (ID: {ent_id})")
        # Let's inspect the attributes keys
        print(f"  Keys: {list(attr.keys())}")
        # Note: overrideMaterials likely has complex structure or reference to other settings
        # Let's print some of it
        print("  Attributes:", json.dumps(attr, indent=2)[:1000])
