#!/usr/bin/env python3
from PIL import Image, ImageFilter, ImageOps
import os
import sys

# Directory containing images
images_dir = os.path.join(os.path.dirname(__file__), '../public/images')

def convert_to_line_drawing(image_path):
    """Convert an image to a black and white line drawing"""
    try:
        # Open image
        img = Image.open(image_path)
        
        # Convert to grayscale
        img = ImageOps.grayscale(img)
        
        # Apply edge detection filter
        img = img.filter(ImageFilter.EDGE_ENHANCE_MORE)
        img = img.filter(ImageFilter.EDGE_ENHANCE_MORE)
        
        # Invert to get black lines on white background
        img = ImageOps.invert(img)
        
        # Save back to original path
        img.save(image_path, quality=95)
        return True
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        return False

def main():
    if not os.path.exists(images_dir):
        print(f"Images directory not found: {images_dir}")
        sys.exit(1)
    
    # Get all image files
    image_files = [f for f in os.listdir(images_dir) 
                   if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    if not image_files:
        print("No image files found")
        sys.exit(1)
    
    print(f"Found {len(image_files)} images to convert...")
    
    converted = 0
    for filename in image_files:
        filepath = os.path.join(images_dir, filename)
        print(f"Converting {filename}...", end=' ')
        if convert_to_line_drawing(filepath):
            print("✓")
            converted += 1
        else:
            print("✗")
    
    print(f"\nCompleted: {converted}/{len(image_files)} images converted")

if __name__ == '__main__':
    main()
