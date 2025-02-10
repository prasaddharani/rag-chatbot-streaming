
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

@app.route('/proxy', methods=['GET'])
def proxy():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'No URL provided'}), 400

    headers = {}
    if 'Range' in request.headers:
        headers['Range'] = request.headers['Range']

    response = requests.get(url, headers=headers, stream=True)
    
    if response.status_code not in [200, 206]:
        return jsonify({'error': 'Failed to fetch the video'}), response.status_code

    def generate():
        for chunk in response.iter_content(chunk_size=8192):
            yield chunk

    rv = Response(generate(), status=response.status_code, headers=dict(response.headers))
    rv.headers['Content-Type'] = 'video/mp4'
    rv.headers['Accept-Ranges'] = 'bytes'
    return rv

@app.route('/ask', methods=['POST'])
def ask():
    data = request.json
    question = data.get('question')
    print('question: ', question)
    answer, image_data, suggestions, videos_path = answer_question(question, vector_store, metadata_store, images, videos)

    response = {
        'answer': answer,
        'images': image_data,
        'suggestions': suggestions
        }
    # response = {
    #     'answer': 'hello',
    #     'images': '',
    #     'suggestions': ['How are you?', 'How can i assist you today?']
    #     }
    # If composite in question without case sensitivity
    if len(videos_path) > 0:
        response['videos'] = [url_for('static', filename='videos/' + video_path) for video_path in videos_path]
    # if 'test' in question.lower():
    #     # response['links'] = ['https://www.google.com']
    #     #response['videos'] = [url_for('static', filename='videos/test.mp4')]
    #     # some sample video to play
    #     response['videos'] = ['http://localhost:5000/proxy?url=https://www.youtube.com/watch?v=Nx4HDJ-TZn4']
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)