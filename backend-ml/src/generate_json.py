import json
import pandas as pd
import argparse
import os

def generate_json(country_code):
    # Paths
    script_location = os.path.dirname(os.path.abspath(__file__))
    backend_ml_root = os.path.dirname(script_location)
    base_path = os.path.join(backend_ml_root, "data", country_code)
    
    # Files
    products_csv = os.path.join(base_path, "products.csv")
    products_json = os.path.join(base_path, "products.json")

    # 1. Create MVP Product Data (If CSV doesn't exist)
    if not os.path.exists(products_csv):
        print(f"Creating template {products_csv}...")
        data = {
            'id': ['shin_ramyun', 'buldak_carbonara', 'banana_milk', 'soju', 'pepero'],
            'name_en': ['Shin Ramyun', 'Buldak Carbonara', 'Banana Milk', 'Jinro Soju', 'Pepero'],
            'status': ['Haram', 'Halal', 'Halal', 'Haram', 'Mushbooh'],
            'reason': ['Contains Beef Bone', 'Certified Halal', 'Safe Ingredients', 'Alcohol', 'Check Ingredients'],
            'color': ['#FF0000', '#00FF00', '#00FF00', '#FF0000', '#FFA500'] # Red, Green, Orange
        }
        pd.DataFrame(data).to_csv(products_csv, index=False)
  
    
    # 2. Convert to JSON (Key-Value Map for fast lookup)
    # The App will do: product_db['shin_ramyun'] -> Returns details
    print(f"Converting {products_csv} to JSON map...")
    df = pd.read_csv(products_csv)
    
    # We turn it into a Dictionary where "id" is the key
    # Output: { "shin_ramyun": { "status": "Haram", ... }, ... }
    json_map = df.set_index('id').to_dict(orient='index')
    
    with open(products_json, 'w', encoding='utf-8') as f:
        json.dump(json_map, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Generated {products_json}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", type=str, default="KR")
    args = parser.parse_args()
    generate_json(args.country)