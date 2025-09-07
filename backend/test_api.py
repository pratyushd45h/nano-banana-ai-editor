import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
import base64
from PIL import Image
import io

# Load environment variables
load_dotenv()

# Initialize Gemini client
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
if not GOOGLE_API_KEY:
    print("Error: GOOGLE_API_KEY not found in .env file")
    exit(1)

client = genai.Client(api_key=GOOGLE_API_KEY)
MODEL_ID = "gemini-2.5-flash-image-preview"

# Test functions
def display_response(response):
    for part in response.parts:
        if part.text:
            print(f"Text: {part.text}")
        elif hasattr(part, 'as_image') and part.as_image():
            print("Image generated successfully!")

def save_image(response, path):
    for part in response.parts:
        if hasattr(part, 'as_image') and part.as_image():
            image = part.as_image()
            image.save(path)
            print(f"Image saved to {path}")
            return True
    return False

# Test the API
print("Testing Gemini API with image generation...")
print(f"Using API Key: {GOOGLE_API_KEY[:10]}...")
print(f"Using Model: {MODEL_ID}")

prompt = 'Create a photorealistic image of a siamese cat with a green left eye and a blue right one and red patches on his face and a black and pink nose'

try:
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=['Text', 'Image']
        )
    )

    print("API call successful!")
    display_response(response)
    save_image(response, 'test_cat.png')

except Exception as e:
    print(f"Error: {e}")
    print("This could be due to:")
    print("1. Invalid API key")
    print("2. Model not available")
    print("3. API quota exceeded")
    print("4. Network issues")