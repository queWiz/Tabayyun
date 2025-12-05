import json
import pandas as pd
import argparse
import os

def generate_json(country_code):
    # Paths
    script_location = os.path.dirname(os.path.abspath(__file__))
    backend_ml_root = os.path.dirname(script_location)
    
    base_path = os.path.join(backend_ml_root, "data", country_code)
    
    csv_path = os.path.join(base_path, "ingredients.csv")
    json_output_path = os.path.join(base_path, "additives.json")

    # 1. Create a Dummy CSV if it doesn't exist (To get you started)
    if not os.path.exists(csv_path):
        print(f"⚠️ {csv_path} not found. Creating a template...")
        data = {
            'code': ['E120', '', '', ''],
            'name_en': ['Cochineal', 'Pork', 'Lard', 'Gelatin'],
            'name_local': ['코치닐', '돼지고기', '라드', '젤라틴'],
            'status': ['Haram', 'Haram', 'Haram', 'Mushbooh'],
            'description': ['Insect dye', 'Pig meat', 'Pig fat', 'Animal bones']
        }
        df = pd.DataFrame(data)
        df.to_csv(csv_path, index=False)
    
    # 2. Read CSV and Convert to JSON
    print(f"📖 Reading {csv_path}...")
    df = pd.read_csv(csv_path).fillna("")
    
    # Convert to list of dicts
    json_data = df.to_dict(orient='records')
    
    # 3. Save JSON
    with open(json_output_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Generated {json_output_path} (Size: {len(json_data)} items)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", type=str, default="KR")
    args = parser.parse_args()
    
    generate_json(args.country)