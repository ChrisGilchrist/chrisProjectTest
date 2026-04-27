from flask import Flask, send_from_directory

app = Flask(__name__, static_folder='static')

@app.route('/quix-plugin.js')
def sdk():
    return send_from_directory(app.static_folder, 'quix-plugin.js')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
