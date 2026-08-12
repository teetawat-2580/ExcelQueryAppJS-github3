const app = require('./api/index.js');
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`ExcelQueryAppJS Server running on port ${PORT}`);
});