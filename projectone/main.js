var express = require('express');
var path = require('path');

const port = process.env.PORT || 8081;

var app = express();

module.exports = app;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://127.0.0.1:${port}`);
});
