const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');

const app = express();
app.use(cors());

// Configure file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Add error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(413).json({ error: 'File too large (max 10MB)' });
    }
    next(err);
});

let excelData = null;

// Upload Excel endpoint
app.post('/upload', upload.single('excelFile'), (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        res.json({ message: 'File uploaded and processed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error processing file' });
    }
});

// Search by ID endpoint
app.get('/search/:id', (req, res) => {
    if (!excelData) {
        return res.status(400).json({ error: 'No data loaded' });
    }
    
    const result = excelData.find(item => item.ID == req.params.id);
    if (result) {
        res.json(result);
    } else {
        res.status(404).json({ error: 'ID not found' });
    }
});

const PORT = 3000;

// Serve static files
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

