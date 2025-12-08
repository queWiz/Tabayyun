import os
import argparse
from bing_image_downloader import downloader

def download_data(country_code):
    # 1.1 Get the absolute path of THIS script file (.../backend-ml/src/collect_data.py)
    script_location = os.path.dirname(os.path.abspath(__file__))
    
    # 1.2 Go up one level to get to 'backend-ml' folder
    backend_ml_root = os.path.dirname(script_location)
    
    # 1.3 Construct the path to the data folder
    base_dir = os.path.join(backend_ml_root, "data", country_code, "raw_images")
    
    # 2. Define Search Queries based on Country
    # We want a mix of Halal-safe and Haram-risk foods
    queries = []
    if country_code == "KR":
        queries = [
            "Shin Ramyun korean noodles package",       # Haram Example
            "Samyang Buldak Carbonara package",         # Halal Example
            "Binggrae Banana Milk bottle",              # Safe Example
            "Jinro Soju green bottle",                  # Alcohol Example
            "Lotte Pepero box"                          # Mushbooh Example
        ]
    elif country_code == "JP":
        queries = ["Takoyaki", "Ramen pork broth"]
    
    if not queries:
        print(f"No queries defined for {country_code}")
        return

    # 3. Download
    print(f"📂 Saving images to: {base_dir}")
    
    for query in queries:
        print(f"📷 Downloading: {query}...")
        downloader.download(
            query, 
            limit=50, 
            output_dir=base_dir, 
            adult_filter_off=True, 
            force_replace=False, 
            timeout=60,
            verbose=False
        )
    print(f"✅ Download complete for {country_code}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--country", type=str, default="KR", help="Country Code (e.g., KR, JP)")
    args = parser.parse_args()
    
    download_data(args.country)