//convert to readable date/time format

function excelToReadableDate(excelSerial) {
    // Excel's epoch is December 30, 1899 (yes, really!)
    const excelEpoch = new Date(1899, 11, 30);
    
    // Calculate days and milliseconds
    const days = Math.floor(excelSerial);
    const msFraction = (excelSerial - days) * 86400000; // Milliseconds in a day
    
    // Create final date
    const date = new Date(excelEpoch.getTime() + days * 86400000 + msFraction);
    
    // Format as "DD-MM-YYYY HH:MM:SS"
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(',', '');
  }

const startTime = excelToReadableDate(45666.6091319444); 
// Returns "09-01-2025 14:37:09"

const completionTime = excelToReadableDate(45666.6182175926); 
// Returns "09-01-2025 14:50:14"

function excelToThaiDate(excelSerial) {
    const date = new Date((excelSerial - 25569) * 86400000);
    return date.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }


  //convert to readable date/time format - end
const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Configure file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync('uploads')) {
            fs.mkdirSync('uploads');
        }
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Validate file extension
        if (file.originalname.match(/\.(xlsx|xls)$/)) {
            cb(null, true);
        } else {
            cb(new Error('Please upload only Excel files (.xlsx or .xls)'));
        }
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(413).json({ error: 'File too large (max 10MB)' });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

let excelData = null;

// Upload Excel endpoint
app.post('/upload', upload.single('excelFile'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        res.json({ 
            success: true,
            message: 'File uploaded and processed successfully',
            filename: req.file.originalname
        });
    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Error processing file',
            details: error.message
        });
    }
});

// Search by ID endpoint
app.get('/search/:id', (req, res) => {
    if (!excelData) {
        return res.status(400).json({ 
            success: false,
            error: 'No data loaded. Please upload an Excel file first.' 
        });
    }
    
    const result = excelData.find(item => item['รหัสพนักงาน (Employee ID)'] == req.params.id);
    if (result) {

        //convert to readable date/time format
        const formatted = {
            ...result,
            'Start time': excelToReadableDate(result['Start time']),
            'Completion time': excelToReadableDate(result['Completion time']),
            'ทำการปรับปรุงเสร็จเรียบร้อยเมื่อวันที่': excelToReadableDate(result['ทำการปรับปรุงเสร็จเรียบร้อยเมื่อวันที่'])
          };
         //convert to readable date/time format - end
        res.json({
            success: true,
            data: formatted
        });
    } else {
        res.status(404).json({ 
            success: false,
            error: `ID ${req.params.id} not found` 
        });
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});