const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public'));

// Excel storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

let excelData = [];



// Upload endpoint
app.post('/upload', upload.single('excelFile'), (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    res.json({ success: true, data: excelData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Data endpoint
app.get('/api/data', (req, res) => {
  res.json(excelData.length > 0 ? excelData : { error: 'No data loaded' });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));

