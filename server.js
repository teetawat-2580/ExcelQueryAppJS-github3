function excelToReadableDate(excelSerial) {
    // Excel's epoch is December 30, 1899 (with leap year bug)
    const excelEpoch = new Date(1899, 11, 30);
    
    // Calculate days and milliseconds
    const days = Math.floor(excelSerial);
    const msFraction = (excelSerial - days) * 86400000; // Milliseconds in a day
    
    // Create final date (subtract 1 day to fix Excel's 1900 leap year bug)
    const date = new Date(excelEpoch.getTime() + (days - 1) * 86400000 + msFraction);
    
    // Thai locale format: "DD/MM/YYYY HH:MM:SS"
    const pad = num => num.toString().padStart(2, '0');
    return [
      pad(date.getDate()),
      pad(date.getMonth() + 1),
      date.getFullYear()
    ].join('/') + ' ' + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join(':');
  }

const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static('public'));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

let excelData = [];
let columnHeaders = [];

app.post('/upload', upload.single('excelFile'), (req, res) => {
    try {
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      
      // Convert date columns
      excelData = excelData.map(row => ({
        ...row,
        'Start time': excelToReadableDate(row['Start time']),
        'Completion time': excelToReadableDate(row['Completion time']),
        'ทำการปรับปรุงเสร็จเรียบร้อยเมื่อวันที่': excelToReadableDate(row['ทำการปรับปรุงเสร็จเรียบร้อยเมื่อวันที่'])
      }));
      
      columnHeaders = Object.keys(excelData[0] || {});
      res.json({ success: true, data: excelData, headers: columnHeaders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

app.get('/api/data', (req, res) => {
  res.json({ 
    data: excelData,
    headers: columnHeaders 
  });
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));