from PIL import Image
import os

source_image_path = r"C:/Users/Owner/.gemini/antigravity/brain/5ed3c900-ee8f-4e17-98f5-40fac969d0cb/uploaded_image_1764972184872.jpg"
output_dir = "icons"
sizes = [16, 32, 48, 128]

try:
    with Image.open(source_image_path) as img:
        # Convert to RGBA if not already to preserve transparency if it were a png, 
        # though input is jpg so it won't have it, but good practice.
        # Since input is jpg, we might want to ensure the output looks good.
        img = img.convert("RGBA")
        
        for size in sizes:
            # high quality resize
            resized_img = img.resize((size, size), Image.Resampling.LANCZOS)
            output_path = os.path.join(output_dir, f"icon{size}.png")
            resized_img.save(output_path, "PNG")
            print(f"Created {output_path}")
            
except Exception as e:
    print(f"Error: {e}")
