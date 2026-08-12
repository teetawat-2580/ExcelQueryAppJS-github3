const app = require('./api-src/index.js');
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`ExcelQueryAppJS Server running on port ${PORT}`);
});