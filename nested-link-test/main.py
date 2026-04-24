from flask import Flask, send_from_directory

app = Flask(__name__, static_folder='static')


@app.route('/quix-plugin.js')
def sdk():
    return send_from_directory(app.static_folder, 'quix-plugin.js')

@app.route('/')
def home():
    return '''<!DOCTYPE html>
<html>
<head>
  <title>Nested Link Test</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
    h1 { color: #333; }
    .btn { padding: 12px 24px; background: #1976d2; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 16px; }
    .btn:hover { background: #1565c0; }
    .token-box { margin-top: 24px; padding: 12px 16px; background: #fff; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; color: #666; max-width: 400px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>Home Page</h1>
  <p>Click the button to navigate to /test</p>
  <a class="btn" href="/test">Go to /test</a>
  <div class="token-box" id="token-display">⏳ Waiting for token...</div>

  <script src="/quix-plugin.js"></script>
  <script>
    QuixPlugin
      .init()
      .onToken(function(token) {
        document.getElementById('token-display').textContent = '✅ Token received: ' + token.substring(0, 40) + '...';
      });
  </script>
</body>
</html>'''

@app.route('/test')
def test_page():
    return '''<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <style>
    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #e8f5e9; }
    h1 { color: #2e7d32; }
    .btn { padding: 12px 24px; background: #388e3c; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 16px; }
    .btn:hover { background: #2e7d32; }
    .token-box { margin-top: 24px; padding: 12px 16px; background: #fff; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; color: #666; max-width: 400px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>✅ /test Page</h1>
  <p>Nested link navigation works!</p>
  <a class="btn" href="/">← Back Home</a>
  <div class="token-box" id="token-display">⏳ Waiting for token...</div>

  <script src="/quix-plugin.js"></script>
  <script>
    QuixPlugin
      .init()
      .onToken(function(token) {
        document.getElementById('token-display').textContent = '✅ Token received: ' + token.substring(0, 40) + '...';
      });
  </script>
</body>
</html>'''

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
