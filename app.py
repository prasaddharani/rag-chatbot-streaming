
from flask import Flask, render_template, request, jsonify, render_template_string, url_for
from bot import answer_question, extract_content_and_images, create_vector_store, load_images_from_json, load_videos_from_json
import base64
import io
import os
import faiss
from flask import Flask, request, jsonify, send_file, Response
import json 
import time 
import requests
from flask_cors import CORS
from io import BytesIO
from flask import Response
import json, time  # ensure time and json are imported

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": [
    "http://localhost:*", "http://10.24.130.116:*",
 "http://10.24.130.116:8080/performancereporting/", 
 "http://10.*.*.*:*", "http://10.*.*.*:8080/performancereporting/"]}})

# Load PDF and create vector store
pdf_path = "UserManual.pdf"
# In-memory FAISS vector store
index_path = "saiss_faiss_index_v5"

    
start_time = time.time()
images = None
if not os.path.exists(index_path):
    content, images = extract_content_and_images(pdf_path)
    vector_store, metadata_store = create_vector_store(content)
else:
    print("Loading existing vector store")
    images = load_images_from_json()
    vector_store, metadata_store = faiss.read_index(index_path), json.load(open('metadata_store_v4.json'))
videos = load_videos_from_json()
end_time = time.time()
execution_time = end_time - start_time
print(f"Execution time for vector load: {execution_time} seconds")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ask', methods=['POST'])
def ask():
    data = request.json
    question = data.get('question')
    print('question: ', question)
    answer, image_data, suggestions, videos_path = answer_question(question, vector_store, metadata_store, images, videos)
    
    def generate():
        # Stream the answer in lines
        for line in answer.splitlines():
            yield f"data: {json.dumps({'answer_chunk': line})}\n\n"
            time.sleep(0.1)  # simulate delay between chunks
        # Then send final payload for extra data
        yield f"data: {json.dumps({'final': True, 'images': image_data, 'suggestions': suggestions, 'videos': videos_path})}\n\n"
    return Response(generate(), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(debug=True)