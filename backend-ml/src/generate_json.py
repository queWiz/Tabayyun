import json
import pandas as pd
import argparse
import os
import sys

def generate_db(country_code):
    script_location = os.path.dirname(os.path.abspath(__file__))
    backend_ml_root = os.path.dirname(script_location)
    base_path = os.path.join(backend_ml_root, "data", country_code)
    
    # Files
    products_csv = os.path.join(base_path, "products.csv")
    products_json = os.path.join(base_path, "products.json")
    ingredients_csv = os.path.join(base_path, "ingredients.csv")
    additives_json = os.path.join(base_path, "additives.json")

    # --- TASK 1: PRODUCTS (Visual) ---
    if os.path.exists(products_csv):
        print(f"📦 Processing Products...")
        df_prod = pd.read_csv(products_csv).fillna("")
        prod_map = df_prod.set_index('id').to_dict(orient='index')
        with open(products_json, 'w', encoding='utf-8') as f:
            json.dump(prod_map, f, ensure_ascii=False, indent=2)
    else:
        print("⚠️ products.csv missing. Run scraping first or create it manually.")

    # --- TASK 2: INGREDIENTS (Text) ---
    if not os.path.exists(ingredients_csv):
        print(f"❌ ERROR: {ingredients_csv} is missing.")
        print("   Please create the CSV file and paste your data there.")
        return

    print(f"📄 Processing Ingredients...")
    try:
        # Read CSV
        df_ing = pd.read_csv(ingredients_csv).fillna("")
        
        # Validation: Ensure required columns exist
        required_cols = ['code', 'name_kr', 'status']
        if not all(col in df_ing.columns for col in required_cols):
            print(f"❌ CSV Error: Missing columns. Needs {required_cols}")
            return

        # Convert to JSON
        json_list = df_ing.to_dict(orient='records')
        
        with open(additives_json, 'w', encoding='utf-8') as f:
            json.dump(json_list, f, ensure_ascii=False, indent=2)
            
        print(f"✅ Success! Database contains {len(json_list)} ingredients.")
        
    except Exception as e:
        print(f"❌ Failed to process CSV: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", type=str, default="KR")
    args = parser.parse_args()
    generate_db(args.country)