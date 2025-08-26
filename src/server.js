const express = require('express');
const path = require('path');
const app = express();
const port = 5500;

app.use(express.static('public'));

app.get('/:pageName', (req, res) => {
    const pageName = req.params.pageName;
    res.sendFile(path.join(__dirname, 'views', `${pageName}`));
});

app.listen(port, () => {
    console.log(`Server http://localhost:${port}`);
});

