from flask import Flask, request, jsonify, send_from_directory, abort, render_template
from flask_cors import CORS
# Assuming you have a tokenizer setup similar to before
from tiktoken import get_encoding

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)  # Enable CORS for cross-origin requests
tokenizer = get_encoding("cl100k_base")

@app.route('/tokenize', methods=['POST'])
def tokenize():
    text = request.json.get('text', '')
    # Limit to ~10MB of text
    if len(text.encode('utf-8')) > 10000000:
        abort(413)  # HTTP status code 413: "Payload Too Large"
    
    tokenized_text = tokenizer.encode(text)
    tokenized_text = [{'token': token, 'text': tokenizer.decode([token])} for token in tokenized_text]
    return jsonify(tokenized_text=tokenized_text)

@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/tokenizer')
def tokenizer_page():
    return send_from_directory(app.static_folder, 'tokenizer.html')

@app.route('/some-dynamic-page')
def some_dynamic_page():
    # Example of passing dynamic data to a template
    data = {"message": "Hello, World!"}
    return render_template('dynamic_page.html', data=data)

@app.errorhandler(404)
def page_not_found(e):
    # Custom error handler for 404
    return render_template('404.html'), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)  # Listen on all interfaces, enable debug mode
