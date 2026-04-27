from flask import Flask, send_from_directory
import os

app = Flask(__name__, static_folder='.')

@app.route('/')
@app.route('/<path:path>')
def serve(path=''):
    return send_from_directory('.', 'index.html')

@app.route('/quix-plugin.js')
def sdk():
    # Serve the SDK from the nested-link-test static folder
    return send_from_directory('../nested-link-test/static', 'quix-plugin.js')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
