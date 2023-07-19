from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from tiktoken import get_encoding

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)  # Enable CORS
tokenizer = get_encoding("cl100k_base")

@app.route('/tokenize', methods=['POST'])
def tokenize():
    text = request.json['text']
    
    # Limit to ~10MB of text
    if len(text.encode('utf-8')) > 10000000:  # encode the text to bytes and check the length
        abort(413)  # HTTP status code 413: "Payload Too Large"

    tokenized_text = tokenizer.encode(text)
    tokenized_text = [{'token': token, 'text': tokenizer.decode([token])} for token in tokenized_text]
    return jsonify(tokenized_text=tokenized_text)

@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'tokenizer.html')

@app.route('/tokenizer')
def tokenizer_page():
    return send_from_directory(app.static_folder, 'tokenizer.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)  # Listen on all interfaces
