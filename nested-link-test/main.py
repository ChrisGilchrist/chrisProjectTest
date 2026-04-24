from flask import Flask

app = Flask(__name__)

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
  </style>
</head>
<body>
  <h1>Home Page</h1>
  <p>Click the button to navigate to /test</p>
  <a class="btn" href="/test">Go to /test</a>
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
  </style>
</head>
<body>
  <h1>✅ /test Page</h1>
  <p>Nested link navigation works!</p>
  <a class="btn" href="/">← Back Home</a>
</body>
</html>'''

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
