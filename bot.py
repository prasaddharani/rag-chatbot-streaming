import os
import re
import fitz 
from PIL import Image
import io
import json
import numpy as np
import requests
import faiss
from dotenv import load_dotenv
from sklearn.preprocessing import normalize
from collections import OrderedDict
import time

load_dotenv()

# Custom API endpoints and auth token
EMBEDDING_URL = os.getenv("EMBEDDING_API_URL")
CHAT_COMPLETION_URL = os.getenv("CHAT_COMPLETION_API_URL")
AUTH_TOKEN = os.getenv("AUTH_TOKEN")
SAIS_APP_TYPE = os.getenv("SAIS_APP_TYPE")
print('EMBEDDING_URL: ', EMBEDDING_URL)
# Headers for API requests
headers = {
    "applicationType": SAIS_APP_TYPE,
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

schema = {
  "type": "object",
  "properties": {
    "answer": {
      "type": "string"
    },
    "images": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "suggestions": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": ["answer", "images", "suggestions"],
  "additionalProperties": False
}


json_schema = {
    'type': 'json_schema',
    'json_schema': 
    {
    'name': 'pdf_response',
    'strict': True,
    'schema': schema
    }
}

def get_llm_response_with_response_format(prompt):
    response = requests.post(
        CHAT_COMPLETION_URL,
        headers=headers,
        json={
            "model": "gpt-4o-2024-11-20",
            "messages": [{"role": "system", "content": prompt}],
            "temperature": 0,
            "response_format": json_schema,
            "stream": False
        }
    )
    print('response: ', response.text)
    result = response.json().get('choices')[0].get('message').get('content')
    return result

def generate_json_from_chunk(chunk):
    print('chunk to JSON preparation: ')
    chunk_json_list = [{"content": chunk}]
    return chunk_json_list

# SAIS API call
def get_embedding(text):
    response = requests.post(
        EMBEDDING_URL,
        headers=headers,
        json={"model": "text-embedding-3-large", "input": text}
    )
    print('response: ', response.json())
    response_json = response.json()
    if 'result' in response_json:
        embedding = response_json['result'].get('data')[0].get('embedding')
    else:
        embedding = response_json.get('data')[0].get('embedding')
    return np.array(embedding).astype('float32')


# Helper function to estimate tokens based on content length
def estimate_tokens(text):
    # Approximation: 1 token ~ 4 characters in English text
    return len(text) // 4

# Function to split text into chunks based on token limits
def split_text_with_overlap(text, max_tokens=4096, overlap_tokens=200):
    words = text.split()
    chunks = []
    current_chunk = []
    current_tokens = 0

    i = 0
    while i < len(words):
        word = words[i]
        current_tokens += estimate_tokens(word + " ")

        if current_tokens > max_tokens:
            # Add the current chunk as a single string
            chunks.append(" ".join(current_chunk).strip())
            # Reset current chunk and tokens, adding overlap
            current_chunk = words[i - overlap_tokens:i]
            current_tokens = sum(estimate_tokens(w + " ") for w in current_chunk)
        else:
            current_chunk.append(word)
            i += 1

    # Add any remaining words as the last chunk
    if current_chunk:
        chunks.append(" ".join(current_chunk).strip())

    return chunks

# Function to read PDF content as a single string
def read_pdf_content(pdf_path):
    doc = fitz.open(pdf_path)
    content = ""
    images = OrderedDict()  # To preserve order of insertion
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()
        content += text + "\n"
        
        # Extract tags in the order they appear
        pattern = r"(Fig (\d+(?:\.\d+)?)?:[^\n]+|Fig: [^\n]+)"
        image_tags = re.findall(pattern, text)
        
        ordered_tags = [tag[0] for tag in image_tags]
        for tag in ordered_tags:
            print(f"- {tag}")
        
        # Extract images
        img_list = page.get_images(full=True)
        
        page_images = []
        
        # Process each image and associate it with the correct tag by order
        for img_index, img in enumerate(img_list):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image = Image.open(io.BytesIO(image_bytes))
            
            if img_index < len(ordered_tags):
                tag = ordered_tags[img_index]
                #print(f"Associating image {img_index} with tag: {tag}")
                images[tag] = image
                page_images.append(tag)
            else:
                fallback_tag = f"Fig {page_num + 1}.{img_index + 1}: Untitled"
                #print(f"Using fallback tag for image {img_index}: {fallback_tag}")
                images[fallback_tag] = image
                page_images.append(fallback_tag)
    
    return content, images

def read_content_from_json(file_path='content_data.json'):
    with open(file_path, 'r') as json_file:
        return json.load(json_file)

def load_images_from_json(json_path='images_cache.json'):
    with open(json_path, 'r') as f:
        images = json.load(f)
    # images = {}
    # for tag, img_str in images_base64.items():
    #     images[eval(tag)] = img_str  
    return images

def load_videos_from_json(json_path='video_cache.json'):
    with open(json_path, 'r') as f:
        videos = json.load(f)
    return videos

def extract_content_and_images(pdf_path):
    content, images = read_pdf_content(pdf_path)
    print('Content creation is done!')
    chunks = split_text_with_overlap(content, max_tokens=4096, overlap_tokens=200)
    print('Chunk creation is done!')
    json_output = []
    for chunk in chunks:
        # print chunks in new lines 
        print('chunk: \n')
        print(chunk)
        print('\n')
        chunk_json_list = generate_json_from_chunk(chunk)
        json_output.extend(chunk_json_list)
    # Append unique id for each object with key as section_id
    for idx, obj in enumerate(json_output):
        obj['section_id'] = f"section_{idx + 1}"

    return json_output, images

# Main function to process PDF and get JSON output
def extract_image_tags(text):
    # Use regex pattern to match the exact format
    pattern = r'Fig (\d+(?:\.\d+)?):\s*[^,.\n]*'
    
    # Find all matches
    matches = re.finditer(pattern, text)
    
    # Extract and clean the matches
    result = []
    for match in matches:
        # Get the matched text and strip any whitespace
        tag = match.group(0).strip()
        if tag:  # Only add non-empty matches
            result.append(tag)
    return result

# Function to create FAISS vector store with metadata
def create_vector_store(content):
    # Assuming `content` is a list of chunks
    embeddings = []
    metadata = []

    for idx, chunk in enumerate(content):
        embedding = get_embedding(chunk['content'])
        embeddings.append(embedding)
        metadata.append({
            'section_id': chunk['section_id'],
            'content': chunk['content']
        })

    embeddings = np.array(embeddings).astype('float32')
    embeddings = normalize(embeddings, axis=1, norm='l2')

    # Create FAISS index
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)

    # Save the index and metadata
    faiss.write_index(index, 'saiss_faiss_index_v5')
    with open('metadata_store_v4.json', 'w') as f:
        json.dump(metadata, f)

    return index, metadata

def get_relevant_image(images, image_tags):
    print("\nTrying to match images for answer:")
    print("-" * 50)
    print(f"Answer text: {image_tags}")
    print("\nAvailable image tags:")
    matched_images = []
    for tag in image_tags:
        if tag in images:
            matched_images.append(images[tag])
    return matched_images

def get_relevant_video(videos, video_tags):
    print("\nTrying to match videos for answer:")
    print("-" * 50)
    print(f"Answer text: {video_tags}")
    print("\nAvailable video tags:")
    matched_videos = []
    for tag in video_tags:
        if tag in videos:
            matched_videos.append(videos[tag])
    return matched_videos

# Function to answer a question using the vector store and LLM
def answer_question(question, vector_store, metadata_store, images, videos):
    print('Inside answer question')
    # Get embedding for the question
    start_time_emb = time.time()
    question_embedding = get_embedding(question)
    end_time_emb = time.time()
    print(f"Execution time for Embeddings: {end_time_emb - start_time_emb} seconds")
    # Search FAISS index for the top k results
    start_time_search = time.time()
    distances, indices = vector_store.search(np.array([question_embedding]), k=3)
    end_time_search = time.time()
    execution_time_search = end_time_search - start_time_search
    print(f"Execution time: {execution_time_search} seconds")
    # Retrieve the most relevant content
    retrieved_context = ""
    for idx in indices[0]:
        retrieved_context += metadata_store[idx]['content'] + "\n"
    # from retrieved context replace 'BROADRIDGE FINANCIAL SOLUTIONS, INC. | PROPRIETARY & CONFIDENTIAL ' with ''
    retrieved_context = retrieved_context.replace('BROADRIDGE FINANCIAL SOLUTIONS, INC. | PROPRIETARY & CONFIDENTIAL', '')
    retrieved_context = retrieved_context.replace('| PROPRIETARY & CONFIDENTIAL', '')
    retrieved_context = retrieved_context.replace('Aspire PR User Guide', '')
    # Construct the prompt
    prompt_template = f"""
    You are an AI assistant. Utilize the context given below to fully answer the question using only the information provided and 
    don't truncate the relevant information, provide to the user as is.
    Ex for 'answer field':
    Ex: user question: How to search group details?
        answer:  1. Go to Performance & Maintenance -> Group screen. 
                    The Group screen is displayed.
        user question: How to view Group Information?
        answer: To access group information,
                1. Access the Account Group to view the Group information.
                2. Enter the Group ID and As of date. The As Of date is default to the latest batch process date.

    If User is asking for summarizing the response, please summarize it instead of giving bulleted points.
    
    If User is greeting, you're allowed greet the user back.

    If you can't answer the question based on the context or outside of the context question, say "Out of Performance Reporting context".
    **Important Note**: If the answer response contains step-by-step instructions, each step must be listed on a separate line by indicating\n.

    If there are relevant images on relevant section only, mention their tags in this particular format only
    "Images available as [Fig X.Y: image_name"] or ["Fig X: image_name"].
    If multiple images were present then provide list of images ['Fig X.Y: image_name', 'Fig X.Z: image_name']
    
    Based on the following context and the given question,
    suggest few (max 2 questions) next set of questions can be present in the context that can be asked, it should not relevant to question asked
    and it should be just in the form of questions only without any contextual information and without numbers.:

    Context: {retrieved_context}
    Question: {question}

    Create a response using the specified JSON schema. Note that this is not a typical JSON response; it is a JSON schema outlining the fields, required elements, and other details: {schema}    
    """
    start_time = time.time()
    llm_response = get_llm_response_with_response_format(prompt_template)
    if '''```json''' in llm_response:
        response_json = json.loads(llm_response.strip('''```json'''))
    else:
        response_json = json.loads(llm_response)

    answer, suggestions = response_json['answer'], response_json['suggestions']
    end_time = time.time()
    execution_time = end_time - start_time
    print(f"Execution time for SAIS: {execution_time} seconds")
    # suggestions = [s.strip() for s in suggestions.split('\n') if s.strip()]
    print('answer: ', answer)

    relevant_images_tag = response_json['images']
    relevant_images = get_relevant_image(images, relevant_images_tag)
    relevant_videos = get_relevant_video(videos, relevant_images_tag)

    return answer, relevant_images, suggestions, relevant_videos