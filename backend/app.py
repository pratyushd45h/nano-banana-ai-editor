from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from google import genai
from google.genai import types
import base64
from PIL import Image
import io
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Configure CORS for production
if os.getenv('ENVIRONMENT') == 'production':
    # In production, allow your frontend domain and common development origins
    allowed_origins = [
        "https://nano-banana-frontend.onrender.com",
        "https://nano-banana.onrender.com", 
        os.getenv('FRONTEND_URL', 'https://your-frontend-app.onrender.com')
    ]
    # Remove None values
    allowed_origins = [origin for origin in allowed_origins if origin and 'your-frontend-app' not in origin]
    CORS(app, origins=allowed_origins)
    print(f"CORS configured for production with origins: {allowed_origins}")
else:
    # In development, allow all origins
    CORS(app)
    print("CORS configured for development (all origins allowed)")

# Initialize Gemini client
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
if not GOOGLE_API_KEY or GOOGLE_API_KEY == "your_api_key_here":
    print("ERROR: Valid GOOGLE_API_KEY not found in environment variables!")
    print("Please set GOOGLE_API_KEY environment variable in Render dashboard")
    print("Get an API key from: https://aistudio.google.com/app/apikey")
    # In production, don't exit but log the error
    if os.getenv('ENVIRONMENT') != 'production':
        exit(1)

client = genai.Client(api_key=GOOGLE_API_KEY) if GOOGLE_API_KEY else None
MODEL_ID = "gemini-2.5-flash-image-preview"

# LangChain-like prompt enhancement
def enhance_prompt_with_context(user_prompt, context):
    return f"{context}; apply the following edit: {user_prompt}"

@app.route('/generate', methods=['POST'])
def generate_image():
    if not client:
        return jsonify({'error': 'API key not configured. Please contact administrator.'}), 500
        
    try:
        data = request.get_json()
        prompt = data['prompt']
        print(f"Generating image with prompt: {prompt}")

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=['Image'],  # Request only image response
                temperature=0.7,  # Slightly higher temperature for creative generation
                max_output_tokens=1024
            )
        )
        print(f"API Response: {response}")

        for part in response.parts:
            if hasattr(part, 'inline_data') and part.inline_data:
                # Direct access to blob data
                blob = part.inline_data
                if hasattr(blob, 'data'):
                    img_str = base64.b64encode(blob.data).decode()
                    return jsonify({'generated_image': f'data:image/png;base64,{img_str}'})

        return jsonify({'error': 'No image generated', 'response_parts': str(response.parts)}), 500

    except Exception as e:
        print(f"Error in generate_image: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/edit-whole', methods=['POST'])
def edit_whole_image():
    if not client:
        return jsonify({'error': 'API key not configured. Please contact administrator.'}), 500
        
    try:
        data = request.get_json()
        image_data = data['image']
        prompt = data['prompt']

        image = Image.open(io.BytesIO(base64.b64decode(image_data.split(',')[1])))

        # Enhanced prompt for whole image editing
        whole_image_prompt = f"""
        Image Editing Task: Analyze and modify this entire image according to the following instruction: {prompt}
        
        Requirements:
        - Apply changes to the whole image while maintaining its core composition
        - Preserve important structural elements and proportions
        - Ensure natural lighting and consistent style throughout
        - Return only the edited image without text explanation
        """

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=[
                whole_image_prompt,
                image
            ],
            config=types.GenerateContentConfig(
                response_modalities=['Image'],  # Request only image response
                temperature=0.4,  # Balanced temperature for whole image edits
                max_output_tokens=1024
            )
        )

        for part in response.parts:
            if hasattr(part, 'inline_data') and part.inline_data:
                blob = part.inline_data
                if hasattr(blob, 'data'):
                    img_str = base64.b64encode(blob.data).decode()
                    return jsonify({'edited_image': f'data:image/png;base64,{img_str}'})

        return jsonify({'error': 'No image generated'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/blend-images', methods=['POST'])
def blend_images():
    if not client:
        return jsonify({'error': 'API key not configured. Please contact administrator.'}), 500
        
    try:
        data = request.get_json()
        base_image_data = data['baseImage']  # Main canvas image
        blend_image_data = data['blendImage']  # Additional image to blend
        prompt = data['prompt']
        
        print(f"Received blend request with prompt: {prompt}")
        
        # Decode both images
        try:
            # Decode base image
            base_b64 = base_image_data.split(',')[1] if ',' in base_image_data else base_image_data
            base_binary = base64.b64decode(base_b64)
            base_image = Image.open(io.BytesIO(base_binary))
            print(f"Base image decoded: {base_image.width}x{base_image.height}")
            
            # Decode blend image
            blend_b64 = blend_image_data.split(',')[1] if ',' in blend_image_data else blend_image_data
            blend_binary = base64.b64decode(blend_b64)
            blend_image = Image.open(io.BytesIO(blend_binary))
            print(f"Blend image decoded: {blend_image.width}x{blend_image.height}")
            
        except Exception as decode_err:
            print(f"Error decoding images: {decode_err}")
            return jsonify({'error': f'Image decode error: {str(decode_err)}'}), 400
        
        # Create enhanced prompt for blending with shape recognition
        blend_prompt = f"""
        Image Blending Task: {prompt}
        
        Blending Instructions:
        1. Analyze the shapes, objects, and composition of both images
        2. Identify the best way to integrate the second image into the first based on the prompt
        3. Create seamless transitions and natural lighting between blended elements
        4. Preserve the perspective and scale relationships
        5. Ensure the final composition looks natural and harmonious
        6. Return ONLY the edited image without any text explanation
        7. Preserve lighting, shadows, and perspective of the surrounding unchanged areas
        
        Technical Requirements:
        - Use the first image as the base/background
        - Integrate the second image according to the prompt description
        - Maintain consistent lighting, shadows, and color grading
        - Return only the blended image without text explanation
        """
        
        print(f"Sending enhanced blend prompt to Gemini API: {blend_prompt}")
        
        # Send both images to Gemini
        try:
            response = client.models.generate_content(
                model=MODEL_ID,
                contents=[
                    blend_prompt,
                    base_image,
                    blend_image
                ],
                config=types.GenerateContentConfig(
                    response_modalities=['Image'],  # Request only image response
                    temperature=0.5,  # Balanced creativity for blending
                    max_output_tokens=1024
                )
            )
            print("Gemini API blend call completed successfully")
        except Exception as api_err:
            print(f"Gemini API blend call failed: {api_err}")
            return jsonify({'error': f'API call failed: {str(api_err)}'}), 500
        
        # Extract the blended image from response
        text_parts = []
        
        for i, part in enumerate(response.parts):
            if hasattr(part, 'text') and part.text:
                text_parts.append(part.text)
                print(f"API returned text (part {i}): {part.text}")
            
            if hasattr(part, 'inline_data') and part.inline_data:
                blob = part.inline_data
                if hasattr(blob, 'data'):
                    img_str = base64.b64encode(blob.data).decode()
                    print("Successfully extracted and encoded blended image")
                    
                    return jsonify({
                        'blended_image': f'data:image/png;base64,{img_str}',
                        'prompt_used': blend_prompt,
                        'text_responses': text_parts
                    })
        
        return jsonify({'error': 'No blended image generated'}), 500
        
    except Exception as e:
        print(f"Error in blend_images: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/edit-image', methods=['POST'])
def edit_image():
    if not client:
        return jsonify({'error': 'API key not configured. Please contact administrator.'}), 500
        
    try:
        # Get data from request
        data = request.get_json()
        image_data = data['image']  # Base64 encoded original image (unused now)
        mask_data = data['mask']    # Base64 encoded combined image with yellow mask
        prompt = data['prompt']
        
        print(f"Received edit request with prompt: {prompt}")
        
        # Decode the masked image (which now contains both original image and yellow mask)
        try:
            import time
            print(f"Mask data received. Starting length: {len(mask_data)}")
            print(f"Mask data prefix: {mask_data[:50]}...")
            
            # Split at comma if it's a data URL
            mask_b64 = mask_data.split(',')[1] if ',' in mask_data else mask_data
            print(f"Base64 data extracted. Length: {len(mask_b64)}")
            
            # Decode the base64 data
            mask_binary = base64.b64decode(mask_b64)
            print(f"Decoded binary data. Size: {len(mask_binary)} bytes")
            
            # Open as image
            masked_image = Image.open(io.BytesIO(mask_binary))
            print(f"Masked image decoded successfully. Dimensions: {masked_image.width}x{masked_image.height}, Mode: {masked_image.mode}")
            
            # Save multiple versions for debugging
            try:
                timestamp = int(time.time())
                debug_dir = os.path.join(os.path.dirname(__file__), "debug")
                os.makedirs(debug_dir, exist_ok=True)

                # Use a simpler filename to avoid Windows path issues
                debug_path = os.path.join(debug_dir, f"masked_image_{timestamp}.png")
                masked_image.save(debug_path)
                print(f"Saved debug image to {debug_path}")

                # Also save a JPEG version to see if format matters
                jpeg_path = os.path.join(debug_dir, f"masked_image_{timestamp}.jpg")
                masked_image.convert("RGB").save(jpeg_path, "JPEG")
                print(f"Saved JPEG version to {jpeg_path}")
            except Exception as save_err:
                print(f"Error saving debug images: {save_err}")
                # Continue without debug saves if they fail
            
        except Exception as mask_err:
            print(f"Error processing mask: {mask_err}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'Masked image decode error: {str(mask_err)}'}), 400

        # Analyze the mask to ensure it has yellow pixels (validation)
        has_yellow = False
        try:
            # Convert to RGB if not already
            if masked_image.mode != 'RGB':
                masked_image = masked_image.convert('RGB')
            
            # Sample pixels to detect yellow mask
            pixels = list(masked_image.getdata())
            yellow_threshold = 200  # Threshold for detecting yellow pixels (R and G high, B low)
            yellow_count = 0
            
            for i, pixel in enumerate(pixels):
                # Check for first 10,000 pixels to save time
                if i > 10000:
                    break
                    
                r, g, b = pixel
                # Detect yellow pixels (high R, high G, low B)
                if r > yellow_threshold and g > yellow_threshold and b < 100:
                    yellow_count += 1
                    
            print(f"Detected {yellow_count} yellow pixels in mask")
            has_yellow = yellow_count > 50  # Consider mask valid if it has enough yellow pixels
        except Exception as color_err:
            print(f"Error analyzing mask colors: {color_err}")
        
        # Create enhanced master prompt with shape recognition and precise instructions
        master_prompt = "Image Editing Task: Analyze the yellow shapes, objects, and regions marked with bright yellow color in this image, then REPLACE the bright yellow colored areas in this image with"
        
        shape_recognition = """
        Shape Recognition Instructions:
        1. Identify the geometric shapes of yellow-marked areas, and recognize real world objects they correspond to
        2. Recognize what objects or body parts are highlighted by the yellow mask. only yellow mask not any other color
        3. The mask is kind of hand drawn using mouse like a doodle in slightly irregular shapes and lines in less transparent yellow color
        4. Understand the context and relationship of marked areas to surrounding elements, objects, body parts, and scene 
        5. Try to regonize the doodled shapes as accurately as possible in the real world context
        """
        
        precision_instructions = """
        Precision Requirements:
        - ONLY modify pixels that were originally marked with bright yellow color
        - Preserve lighting, shadows, and perspective of the surrounding unchanged areas
        - Ensure seamless integration between new content and existing image elements
        - Return ONLY the edited image without any text explanation
        """
        
        example = "Example: If a person's hat is marked with yellow and prompt is 'red baseball cap', replace only the yellow hat area with a red baseball cap while preserving the person's head shape, hair, and surrounding elements."
        
        # Add diagnostic information if yellow pixels are missing
        if not has_yellow:
            print("WARNING: No significant yellow pixels detected in mask!")
            enhanced_prompt = f"{master_prompt} {prompt}.\n\n{shape_recognition}\n{precision_instructions}\n\n{example}\n\nIMPORTANT: Look carefully for ANY yellow markings, lines, or highlighted areas in this image, even faint ones. The yellow color indicates exactly where to apply changes. If yellow areas are subtle, Return only the edited image."
        else:
            enhanced_prompt = f"{master_prompt} {prompt}.\n\n{shape_recognition}\n{precision_instructions}\n\n{example}\n\nFocus on the bright yellow areas which clearly indicate the regions to be replaced. Return only the edited image without text."
        
        print(f"Sending prompt to Gemini API: {enhanced_prompt}")
        
        # For debugging - save the masked image to see what we're sending
        try:
            debug_path = os.path.join(os.path.dirname(__file__), "debug_masked_image.png")
            masked_image.save(debug_path)
            print(f"Saved debug image to {debug_path}")
        except Exception as save_err:
            print(f"Error saving debug masked image: {save_err}")
            debug_path = None
        
        # Pass the combined image (with yellow mask) to the API
        print(f"About to call Gemini API with model: {MODEL_ID}")
        print(f"Enhanced prompt length: {len(enhanced_prompt)}")
        print(f"Masked image size: {masked_image.size}")

        try:
            response = client.models.generate_content(
                model=MODEL_ID,
                contents=[
                    enhanced_prompt,
                    masked_image
                ],
                config=types.GenerateContentConfig(
                    response_modalities=['Image'],  # Request only image response
                    temperature=0.3,  # Lower temperature for more consistent results
                    max_output_tokens=1024
                )
            )
            print("Gemini API call completed successfully")
        except Exception as api_err:
            print(f"Gemini API call failed: {api_err}")
            return jsonify({'error': f'API call failed: {str(api_err)}'}), 500

        # Extract the edited image from response
        print(f"Response received from Gemini API")
        print(f"Response type: {type(response)}")
        print(f"Response dir: {dir(response)}")
        print(f"Response parts count: {len(response.parts) if hasattr(response, 'parts') else 'No parts attribute'}")

        # First check if we have any error information
        error_message = None
        text_parts = []

        # Try to examine all parts of the response
        try:
            for i, part in enumerate(response.parts):
                print(f"Examining part {i} of type {type(part)}")
                print(f"Part {i} dir: {dir(part)}")
                print(f"Part {i} attributes: {vars(part) if hasattr(part, '__dict__') else 'No __dict__'}")

                # Check for text
                if hasattr(part, 'text') and part.text:
                    text = part.text
                    text_parts.append(text)
                    print(f"API returned text (part {i}): {text}")
                    if 'error' in text.lower():
                        error_message = text

                # Check for image data - try multiple ways
                if hasattr(part, 'inline_data') and part.inline_data:
                    print(f"Found inline_data in part {i}")
                    blob = part.inline_data
                    print(f"Blob type: {type(blob)}, dir: {dir(blob)}")
                    print(f"Blob attributes: {vars(blob) if hasattr(blob, '__dict__') else 'No __dict__'}")

                    if hasattr(blob, 'mime_type'):
                        print(f"Mime type: {blob.mime_type}")

                    if hasattr(blob, 'data'):
                        print(f"Found data in blob, type: {type(blob.data)}")
                        img_str = base64.b64encode(blob.data).decode()
                        print("Successfully extracted and encoded image from response")

                        # Debug - save the response image with timestamp
                        try:
                            timestamp = int(time.time())
                            debug_dir = os.path.join(os.path.dirname(__file__), "debug")
                            os.makedirs(debug_dir, exist_ok=True)

                            img_data = base64.b64decode(img_str)
                            img = Image.open(io.BytesIO(img_data))
                            debug_response_path = os.path.join(debug_dir, f"response_image_{timestamp}.png")
                            img.save(debug_response_path)
                            print(f"Saved response image to {debug_response_path}")
                        except Exception as save_err:
                            print(f"Error saving response debug image: {save_err}")
                            debug_response_path = None

                        # Return successful response immediately
                        return jsonify({
                            'edited_image': f'data:image/png;base64,{img_str}',
                            'prompt_used': enhanced_prompt,
                            'text_responses': text_parts,
                            'debug_info': {
                                'masked_image_path': debug_path if 'debug_path' in locals() else None,
                                'response_image_path': debug_response_path
                            }
                        })

                # Try alternative ways to access image data
                elif hasattr(part, 'blob') and part.blob:
                    print(f"Found blob in part {i}")
                    blob = part.blob
                    if hasattr(blob, 'data'):
                        print(f"Found data in blob, type: {type(blob.data)}")
                        img_str = base64.b64encode(blob.data).decode()
                        print("Successfully extracted and encoded image from blob")

                        # Return successful response immediately
                        return jsonify({
                            'edited_image': f'data:image/png;base64,{img_str}',
                            'prompt_used': enhanced_prompt,
                            'text_responses': text_parts
                        })

                # Check for other possible image attributes
                elif hasattr(part, 'image') and part.image:
                    print(f"Found image in part {i}")
                    image_obj = part.image
                    print(f"Image object type: {type(image_obj)}")
                    if hasattr(image_obj, 'data'):
                        img_str = base64.b64encode(image_obj.data).decode()
                        print("Successfully extracted and encoded image from image object")

                        # Return successful response immediately
                        return jsonify({
                            'edited_image': f'data:image/png;base64,{img_str}',
                            'prompt_used': enhanced_prompt,
                            'text_responses': text_parts
                        })
                        
                        # Return successful response immediately
                        return jsonify({
                            'edited_image': f'data:image/png;base64,{img_str}',
                            'prompt_used': enhanced_prompt,
                            'text_responses': text_parts,
                            'debug_info': {
                                'masked_image_path': debug_path if 'debug_path' in locals() else None,
                                'response_image_path': debug_response_path
                            }
                        })
        except Exception as part_err:
            print(f"Error examining response parts: {part_err}")
            import traceback
            traceback.print_exc()
        
        if error_message:
            return jsonify({'error': f'API error: {error_message}'}), 500

        # If we get here, we didn't find an image in the response
        print("No image found in API response")
        print(f"All text responses: {text_parts}")
        print(f"Response parts details:")
        for i, part in enumerate(response.parts):
            print(f"  Part {i}: {type(part)} - {getattr(part, 'text', 'No text')}")

        # Try a fallback: if we have text responses, return them
        if text_parts:
            return jsonify({
                'error': 'No image generated, but API returned text responses',
                'text_responses': text_parts,
                'prompt_used': enhanced_prompt
            }), 500

        return jsonify({'error': 'No image generated in the response'}), 500

    except Exception as e:
        print(f"Error in edit_image: {e}")
        return jsonify({'error': str(e)}), 500

# Health check endpoint for Render
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'Nano-Banana API is running'})

# Root endpoint
@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'message': 'Nano-Banana AI Image Editor API',
        'version': '1.0',
        'endpoints': ['/generate', '/edit-image', '/edit-whole', '/blend-images', '/health']
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.getenv('ENVIRONMENT') != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug_mode)